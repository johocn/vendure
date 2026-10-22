import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Channel,
    ID,
    Injector,
    Logger,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusNotifyService } from './campus-notify.service';
import { HallService } from './hall.service';
import { ExternalProviderCode, GeoPointLike, resolveDropoff, resolvePickup, resolveRoutePlan } from './route-matrix';

const loggerCtx = 'ThirdPartyDelivery';

/** 第一段完成后的本地状态（纯函数，便于单测）：只有「直送」才算完成，其余都进大厅接力 */
export function nextHallStateAfterHandover(handover: string): { hallStatus: string; deliveryStatus: string | null } {
    if (handover === 'direct_to_user') return { hallStatus: 'delivered', deliveryStatus: 'delivered' };
    return { hallStatus: 'open', deliveryStatus: null };
}

interface GatewayLike {
    createDelivery(ctx: RequestContext, input: any): Promise<any>;
    cancelDelivery(ctx: RequestContext, deliveryOrderId: ID, reason?: string): Promise<{ success: boolean; reason?: string }>;
    registerStatusSink(sink: unknown): void;
}

@Injectable()
export class ThirdPartyDeliveryService implements OnApplicationBootstrap {
    constructor(
        private connection: TransactionalConnection,
        private hall: HallService,
        private notify: CampusNotifyService,
        private moduleRef: ModuleRef,
    ) {}

    onApplicationBootstrap(): void {
        try {
            this.gateway.registerStatusSink(this);
            Logger.info('外部快递状态回调已接入订单履约', loggerCtx);
        } catch (e: any) {
            Logger.warn(`外部快递状态回调接入失败: ${e?.message ?? e}`, loggerCtx);
        }
    }

    /** 懒解析网关（字符串 token，避免 campus → gateway 编译依赖） */
    private get gateway(): GatewayLike {
        return new Injector(this.moduleRef).get('DeliveryGatewayService') as GatewayLike;
    }

    private get cfgRepo() {
        return this.connection.rawConnection.getRepository(CampusFulfillmentConfig);
    }

    private orderRepo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, Order);
    }

    private async ctxForChannel(channelId: ID): Promise<RequestContext> {
        const channel =
            (await this.connection.rawConnection.getRepository(Channel).findOne({
                where: { id: channelId as any },
                relations: ['defaultTaxZone'],
            })) ?? new Channel({ id: channelId });
        return new RequestContext({ apiType: 'admin', channel, isAuthorized: true, authorizedAsOwnerOnly: false });
    }

    /**
     * 推送外部快递（运营中心在派单时选择提供方）。
     * - R2：外部快递从商户取货 → 校园交接点（R2 交接点）
     * - R3：当前策略为 external 时，外部快递整段直送学生
     */
    async dispatchExternal(ctx: RequestContext, orderId: number, provider: ExternalProviderCode) {
        if (provider !== 'dada' && provider !== 'meituan') throw new UserInputError('外部快递仅支持 dada/meituan');
        const order = await this.orderRepo(ctx).findOne({
            where: { id: orderId as any },
            relations: ['channels', 'lines', 'lines.productVariant', 'customer', 'shippingAddress'],
        });
        if (!order) throw new UserInputError('订单不存在');
        const cf = order.customFields as any;
        if (cf.hallStatus === 'cancelled') throw new UserInputError('订单已取消');
        if (cf.thirdPartyNo && cf.thirdPartyState !== 'cancelled') {
            return { ok: true, already: true, thirdPartyNo: cf.thirdPartyNo };
        }

        const channelId = order.channels?.[0]?.id ?? ctx.channelId;
        const cfg = await this.cfgRepo.findOne({ where: { channelId: channelId as any } });
        if (!cfg) throw new UserInputError('店铺未配置履约信息');

        const route = String(cf.fulfillmentRoute ?? '');
        const plan = resolveRoutePlan(route, cfg, provider);
        if (!plan) throw new UserInputError(`路线 ${route} 不支持外部快递`);
        // 在途单以「下单快照」为准，避免中途改配置换运力
        const leg1 = String(cf.deliveryPlan || plan.leg1);
        if (plan.dispatch !== 'external_push' && leg1 !== 'external_courier') {
            throw new UserInputError(`路线 ${route} 当前未启用外部快递`);
        }

        const oCtx = await this.ctxForChannel(channelId);
        const pickup = resolvePickup(plan.route, cfg);
        if (!pickup) throw new UserInputError('店铺取货点经纬度缺失，无法推送外部快递');

        const building = cf.buildingId
            ? await this.connection.rawConnection.getRepository(CampusBuilding).findOne({
                  where: { id: Number(cf.buildingId) as any },
              })
            : null;
        const userPoint: GeoPointLike = {
            name: order.shippingAddress?.fullName ?? '用户',
            address: [building?.name, order.shippingAddress?.streetLine1].filter(Boolean).join(' ') || undefined,
            lat: Number(building?.lat ?? 0),
            lng: Number(building?.lng ?? 0),
            phone: order.shippingAddress?.phoneNumber ?? undefined,
        };
        // 交接点按「本路线」取：下单快照优先，缺失才用店铺当前配置
        const snapPoint =
            cf.handoverPointLat != null && cf.handoverPointLng != null
                ? {
                      name: String(cf.handoverPointName ?? ''),
                      address: cf.handoverPointAddress ?? undefined,
                      lat: Number(cf.handoverPointLat),
                      lng: Number(cf.handoverPointLng),
                  }
                : undefined;
        const effCfg = {
            ...cfg,
            handoverPoints: {
                ...(cfg.handoverPoints ?? {}),
                ...(snapPoint ? { [plan.route]: [snapPoint] } : {}),
            },
        };
        // 无快照时按楼栋坐标挑最近交接点；楼栋缺坐标则由默认点兜底
        const dest =
            building?.lat != null && building?.lng != null
                ? { lat: Number(building.lat), lng: Number(building.lng) }
                : null;
        const dropoff = resolveDropoff(plan.route, plan, effCfg, userPoint, dest);
        if (!dropoff) throw new UserInputError(`路线 ${plan.route} 未配置校园交接点，无法推送外部快递`);
        if (!dropoff.lat || !dropoff.lng) throw new UserInputError('收货点经纬度缺失，无法推送外部快递');

        const delivery = await this.gateway.createDelivery(oCtx, {
            orderId: order.id,
            packageId: String(order.id),
            providerCode: provider,
            providerShopNo: cfg.providerShopNo?.[provider] ?? undefined,
            pickup,
            dropoff,
            items: (order.lines ?? []).map(l => ({ name: l.productVariant?.name ?? '餐品', quantity: l.quantity })),
            remark: cf.note ?? undefined,
        });

        await this.hall.updateOrder(oCtx, orderId, {
            customFields: {
                deliveryPlan: 'external_courier',
                handoverMode: plan.handover ?? '',
                thirdPartyProvider: provider,
                thirdPartyDeliveryOrderId: String(delivery.id),
                thirdPartyNo: delivery.thirdPartyNo ?? delivery.code,
                thirdPartyState: delivery.status,
                thirdPartyFee: delivery.fee ?? null,
                thirdPartyDispatchAt: new Date(),
                handoverPointName: dropoff.name ?? '',
                handoverPointAddress: dropoff.address ?? null,
                handoverPointLat: dropoff.lat,
                handoverPointLng: dropoff.lng,
                hallStatus: 'third_party',
                campusCause: 'external_dispatched',
            },
        } as any);

        Logger.info(`订单 ${order.code} 已推送 ${provider}:${delivery.thirdPartyNo ?? delivery.code}`, loggerCtx);
        return { ok: true, thirdPartyNo: delivery.thirdPartyNo ?? delivery.code, provider };
    }

    /** 取消外部快递配送（商家关单 / 推送失败回落前调用），幂等 */
    async cancel(ctx: RequestContext, orderId: number, reason?: string) {
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId as any }, relations: ['channels'] });
        if (!order) throw new UserInputError('订单不存在');
        const cf = order.customFields as any;
        if (!cf.thirdPartyDeliveryOrderId) return { ok: true, skipped: true };
        const oCtx = await this.ctxForChannel(order.channels?.[0]?.id ?? ctx.channelId);
        const res = await this.gateway.cancelDelivery(oCtx, Number(cf.thirdPartyDeliveryOrderId), reason);
        if (res.success) {
            await this.hall.updateOrder(oCtx, orderId, {
                customFields: { thirdPartyState: 'cancelled', campusCause: 'third_party_cancelled' },
            } as any);
        }
        return { ok: res.success, reason: res.reason };
    }

    /** 网关回调（由 DeliveryStatusSink 调用） */
    async onDeliveryStatus(
        ctx: RequestContext,
        update: {
            orderId: ID;
            thirdPartyNo: string;
            status: 'pending' | 'accepted' | 'pickup' | 'delivered' | 'cancelled' | 'exception';
            courierName?: string;
            courierPhone?: string;
            reason?: string;
        },
    ): Promise<void> {
        const order = await this.orderRepo(ctx).findOne({
            where: { id: update.orderId as any },
            relations: ['channels', 'customer'],
        });
        if (!order) {
            Logger.warn(`回调订单不存在 #${update.orderId}`, loggerCtx);
            return;
        }
        const channelId = order.channels?.[0]?.id ?? ctx.channelId;
        const oCtx = await this.ctxForChannel(channelId);
        const cf = order.customFields as any;
        const patch: Record<string, unknown> = {
            thirdPartyState: update.status,
            thirdPartyNo: update.thirdPartyNo || cf.thirdPartyNo,
        };
        if (update.courierName) patch.thirdPartyCourierName = update.courierName;
        if (update.courierPhone) patch.thirdPartyCourierPhone = update.courierPhone;

        if (update.status === 'delivered') {
            const next = nextHallStateAfterHandover(String(cf.handoverMode ?? ''));
            patch.handoverAt = new Date();
            if (next.hallStatus === 'open') {
                // R1/R2：送达交接点 → 进大厅接力（统一写 open/hallEnteredAt/campusCause 并提醒骑手）
                await this.hall.updateOrder(oCtx, Number(order.id), {
                    customFields: { ...patch, thirdPartyState: update.status, thirdPartyNo: patch.thirdPartyNo },
                } as any);
                await this.hall.enterHallForHandover(oCtx, Number(order.id), 'external_handover');
                return;
            }
            // R3 外部快递整段直送：直接完成
            patch.hallStatus = 'delivered';
            patch.deliveryStatus = 'delivered';
            patch.deliveredAt = new Date();
        } else if (update.status === 'cancelled' || update.status === 'exception') {
            const route = String(cf.fulfillmentRoute ?? '');
            if (route === 'R2') {
                // R2 回到待推送，由运营中心换一家外部快递
                patch.hallStatus = 'pending_dispatch';
                patch.campusCause = update.status === 'exception' ? 'external_exception' : 'external_cancelled';
            } else {
                // R3 运力失败 → 回抢单大厅，由传信者兜底
                patch.hallStatus = 'open';
                patch.deliveryPlan = 'campus_rider';
                patch.handoverMode = '';
                patch.thirdPartyProvider = '';
                patch.campusCause = 'external_failed_to_hall';
            }
        }

        await this.hall.updateOrder(oCtx, Number(order.id), { customFields: patch } as any);

        if (update.status === 'delivered' && cf.handoverMode === 'direct_to_user') {
            this.notify.user(oCtx, order.id, 'orderDelivered');
        }
    }

    /** 自营快递接单（R1 商户超时转自营 / R3 自营快递池） */
    async acceptOwned(ctx: RequestContext, orderId: number) {
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId as any } });
        if (!order) throw new UserInputError('订单不存在');
        const cf = order.customFields as any;
        if (!['pending_merchant', 'open', 'owned_pool'].includes(String(cf.hallStatus ?? ''))) {
            throw new UserInputError('订单当前状态不可由自营快递接单');
        }
        await this.hall.updateOrder(ctx, orderId, {
            customFields: {
                deliveryPlan: 'owned',
                hallStatus: 'owned_dispatched',
                assignedAt: new Date(),
                campusCause: 'owned_accepted',
            },
        } as any);
        return { ok: true };
    }

    /** 第一段（商户 / 自营快递）送达校园交接点：R1/R2 进大厅接力，R3 直接完成 */
    async completeFirstLeg(ctx: RequestContext, orderId: number, cause: string) {
        const order = await this.orderRepo(ctx).findOne({ where: { id: orderId as any } });
        if (!order) throw new UserInputError('订单不存在');
        const cf = order.customFields as any;
        const route = String(cf.fulfillmentRoute ?? '');
        if (!['merchant', 'owned'].includes(String(cf.deliveryPlan ?? ''))) {
            throw new UserInputError('当前订单第一段不是商户/自营快递');
        }
        if (route === 'R3') {
            await this.hall.updateOrder(ctx, orderId, {
                customFields: {
                    hallStatus: 'delivered',
                    deliveryStatus: 'delivered',
                    deliveredAt: new Date(),
                    handoverAt: new Date(),
                    campusCause: cause,
                },
            } as any);
            this.notify.user(ctx, order.id, 'orderDelivered');
            return { ok: true, done: true };
        }
        await this.hall.updateOrder(ctx, orderId, {
            customFields: { handoverAt: new Date(), thirdPartyState: '' },
        } as any);
        await this.hall.enterHallForHandover(ctx, orderId, cause);
        return { ok: true, done: false };
    }
}
