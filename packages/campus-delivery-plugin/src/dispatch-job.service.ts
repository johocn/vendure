import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Channel,
    ID,
    Injector,
    Logger,
    Order,
    OrderService,
    Payment,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { CREDIT_LIMIT, CREDIT_TIMEOUT, RiderCreditService } from './rider-credit.service';

const NOT_PICKED_TIMEOUT_MIN = 15;

@Injectable()
export class DispatchJobService implements OnApplicationShutdown {
    private timer: ReturnType<typeof setInterval> | null = null;
    private running = false;
    // T4 惰性服务（job 定时器早于插件依赖可用，首次执行时经 Injector 解析）
    private orderSvc?: OrderService;
    private couponSvc?: { grantCoupon: (ctx: RequestContext, templateId: ID, customerIds: ID[]) => Promise<string[]> } | null;
    private paymentRepo?: any;

    constructor(
        private connection: TransactionalConnection,
        private grab: HallGrabService,
        private hall: HallService,
        private capacity: CapacityService,
        private credit: RiderCreditService,
        private moduleRef: ModuleRef,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    start(intervalMs = 60_000) {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this.tick().catch(e => Logger.error(`dispatch tick: ${e?.message}`, 'CampusDispatch'));
        }, intervalMs);
    }

    onApplicationShutdown() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private async tick() {
        if (this.running) return; // 上一轮未结束跳过
        this.running = true;
        try {
            // 扫描跨渠道：逐渠道配置构造真实 RequestContext（getRepository 仅接受 RequestContext 实例）
            const cfgs = await this.connection.rawConnection
                .getRepository(CampusFulfillmentConfig)
                .find();
            for (const cfg of cfgs) {
                await this.scan(await this.ctxForChannel(cfg.channelId));
            }
        } finally {
            this.running = false;
        }
    }

    private async ctxForChannel(channelId: ID): Promise<RequestContext> {
        // 必须查完整 Channel 实体（含 defaultTaxZone）：手工 new Channel({id}) 无 taxZone，
        // order-calculator 重算价时 taxZoneStrategy.determineTaxZone 返回 undefined → error.no-active-tax-zone
        const channel =
            (await this.connection.rawConnection.getRepository(Channel).findOne({
                where: { id: channelId as any },
                relations: ['defaultTaxZone'],
            })) ?? new Channel({ id: channelId });
        return new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    async scan(ctx: RequestContext) {
        const repo = this.connection.getRepository(ctx, Order);
        const orders = await repo.createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.hallStatus IN ('open', 'grabbed')")
            .getMany();
        const now = Date.now();

        // 1) assigned 超 15min 未取货 → 回大厅 + 扣分
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.hallStatus === 'grabbed' && cf.deliveryStatus === 'assigned' && cf.assignedAt) {
                if (now - new Date(cf.assignedAt).getTime() > NOT_PICKED_TIMEOUT_MIN * 60_000) {
                    await this.hall.backToHall(ctx, o.id as any);
                    await this.credit.adjust(ctx, Number(cf.deliveryStaffId), CREDIT_TIMEOUT, 'timeout_not_picked', o.id as any);
                    Logger.warn(`Order ${o.code} reassigned (rider ${cf.deliveryStaffId} not picked in ${NOT_PICKED_TIMEOUT_MIN}min)`, 'CampusDispatch');
                }
            }
        }

        // 2) T2 强派（无在线骑手时跳过，不阻断 T4）
        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        if (cfg) {
            const riders = await this.capacity.listOnlineRiders(ctx);
            const eligible = riders
                .filter(r => ((r.customFields as any).riderCredit ?? 100) >= CREDIT_LIMIT)
                .sort((a, b) => {
                    const ca = (a.customFields as any).riderCredit ?? 100;
                    const cb = (b.customFields as any).riderCredit ?? 100;
                    if (cb !== ca) return cb - ca; // 信用分高者优先
                    const ta = new Date((a.customFields as any).riderOnlineAt).getTime();
                    const tb = new Date((b.customFields as any).riderOnlineAt).getTime();
                    return tb - ta; // 最近活跃优先
                });
            if (eligible.length) {
                const stale = orders.filter(o => {
                    const cf = o.customFields as any;
                    return cf.hallStatus === 'open' && this.orderInChannel(o, cfg) && cf.hallEnteredAt
                        && now - new Date(cf.hallEnteredAt).getTime() > (cfg.autoAssignMinutes ?? 10) * 60_000;
                }).sort((a, b) => new Date((a.customFields as any).hallEnteredAt).getTime()
                         - new Date((b.customFields as any).hallEnteredAt).getTime());
                for (const o of stale) {
                    const ok = await this.grab.grabByRider(ctx, o.id as any, eligible[0]);
                    if (ok) Logger.warn(`Order ${o.code} auto-assigned to rider ${eligible[0].id} (T2)`, 'CampusDispatch');
                    // 无论成败，该单已离开 open 大厅（成功→grabbed；失败→已被抢/已退款），
                    // 内存标记防止同轮 T4 对已派单误退款（grabByRider 事务内有二次校验兜底）。
                    (o.customFields as any).hallStatus = 'grabbed';
                }
            }

            // 3) T4: open 超 autoRefundMinutes 无人接 → 自动退款终态（降级阶梯最后一级）
            const staleFinal = orders.filter(o => {
                const cf = o.customFields as any;
                return cf.hallStatus === 'open' && cf.hallEnteredAt
                    && now - new Date(cf.hallEnteredAt).getTime() > (cfg.autoRefundMinutes ?? 30) * 60_000;
            });
            for (const o of staleFinal) {
                await this.refundNoRider(ctx, o, cfg);
            }
        }
    }

    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    private orderInChannel(o: Order, cfg: CampusFulfillmentConfig): boolean {
        const channels = (o as any).channels as Array<{ id: ID }> | undefined;
        return !channels?.length || channels.some(c => c.id != null && String(c.id) === String(cfg.channelId));
    }

    /** T4 惰性服务解析（job 定时器首跳早于完整依赖可用，首次退款时才初始化） */
    private services() {
        if (!this.orderSvc) {
            this.orderSvc = this.injector.get(OrderService);
            this.paymentRepo = this.connection.rawConnection.getRepository(Payment);
            this.couponSvc = this.tryGetCouponService();
        }
        return { order: this.orderSvc, coupon: this.couponSvc ?? null };
    }

    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析，
     * 未安装/未启用/解析失败一律返回 null（跳过发券，不阻断退款主流程）。 */
    private tryGetCouponService():
        { grantCoupon: (ctx: RequestContext, templateId: ID, customerIds: ID[]) => Promise<string[]> } | null {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod: any = require('@vendure/coupon-plugin');
            if (mod?.CouponService) return this.injector.get(mod.CouponService) ?? null;
        } catch {
            // coupon-plugin 未安装或未启用
        }
        return null;
    }

    /**
     * T4: open 超 autoRefundMinutes 无人接单 → 全额原路退款 + Cancelled + no_rider 对账标记 + 定向补偿券。
     * 本 fork 无 core RefundService，退款走 OrderService.refundOrder/settleRefund（与 after-sales 插件同源）。
     * 失败降级：同样写 campusCause='no_rider' + hallStatus='no_rider_final' 留人工，Logger 留痕，不抛出。
     */
    private async refundNoRider(ctx: RequestContext, order: Order, cfg: CampusFulfillmentConfig) {
        const mark = () => this.hall.updateOrder(ctx, order.id as any, {
            customFields: { campusCause: 'no_rider', hallStatus: 'no_rider_final' },
        });
        try {
            const { order: orderSvc, coupon } = this.services();
            const payment = await this.paymentRepo!.findOne({
                where: { order: { id: order.id } },
                order: { id: 'DESC' as any },
            });
            if (payment) {
                const created = await orderSvc!.refundOrder(ctx, {
                    paymentId: payment.id,
                    amount: payment.amount,
                    // fork 的 refund 表 shipping/adjustment 列 NOT NULL（payment.service createRefund 透传
                    // input.shipping/input.adjustment），全额退款经 amount 通道，两者必须显式给 0，
                    // 否则 INSERT 报 not-null violation
                    shipping: 0,
                    adjustment: 0,
                    reason: `no_rider auto refund (${order.code})`,
                } as any);
                if (!created || (created as any).errorCode) {
                    throw new Error(`refundOrder failed: ${(created as any)?.errorCode ?? 'no result'}`);
                }
                await orderSvc!.settleRefund(ctx, { id: (created as any).id } as any);
            }
            await orderSvc!.transitionToState(ctx, order.id as any, 'Cancelled');
            await mark();
            const templateId = cfg.compensationCouponTemplateId;
            if (templateId && order.customerId && coupon) {
                await coupon.grantCoupon(ctx, templateId, [order.customerId as any]);
            }
            Logger.warn(
                `Order ${order.code} auto-refunded (no rider within ${cfg.autoRefundMinutes ?? 30}min)`,
                'CampusDispatch',
            );
        } catch (e: any) {
            Logger.error(`T4 refund failed for order ${order.code}: ${e?.message}`, 'CampusDispatch');
            try {
                await mark();
            } catch (e2: any) {
                Logger.error(`T4 fallback mark failed for order ${order.code}: ${e2?.message}`, 'CampusDispatch');
            }
        }
    }
}
