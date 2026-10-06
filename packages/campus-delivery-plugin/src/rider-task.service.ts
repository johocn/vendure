import { Injectable, Logger } from '@nestjs/common';
import {
    ForbiddenError,
    ID,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
    Customer,
} from '@vendure/core';
import { getCouponBalancePort } from '@vendure/coupon-plugin';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusNotifyService } from './campus-notify.service';
import { HallService } from './hall.service';
import { CREDIT_COMPLETE, RiderCreditService } from './rider-credit.service';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';

@Injectable()
export class RiderTaskService {
    constructor(
        private connection: TransactionalConnection,
        private riderService: RiderService,
        private credit: RiderCreditService,
        private hall: HallService,
        private notify: CampusNotifyService,
    ) {}

    /** 订单骑手卡信息：C 端订单跟踪轮询用。未指派返回 null。 */
    async orderRider(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({ where: { id: orderId as any } });
        const riderId = Number((order?.customFields as any)?.deliveryStaffId ?? NaN);
        if (!riderId) return null;
        const rider = await this.connection.getRepository(ctx, Customer).findOne({ where: { id: riderId } });
        if (!rider) return null;
        const cf = (rider.customFields ?? {}) as any;
        return { realName: cf.riderRealName ?? '骑手', credit: cf.riderCredit ?? 100 };
    }

    /** 我的任务：本骑手名下已进入配送流程的订单，按下单时间倒序。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 order.customFields.deliveryStaffId
     * （与 delivery-plugin 写法一致），裸列 order.deliveryStaffId 在 PG 不存在。
     * 渠道过滤：Order 无标量 channelId，join order.channels 过滤 channel.id（同 hall()）。 */
    async myTasks(ctx: RequestContext, status?: string) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.deliveryStaffId = :id', { id: String(rider.id) })
            .andWhere('order.customFields.deliveryStatus IS NOT NULL');
        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :s', { s: status });
        }
        return qb.orderBy('order.createdAt', 'DESC').getMany();
    }

    /** 转单回大厅：assigned 未取货直接回；in_progress 已取货必须拍照交接存证。
     * 回大厅复用 backToHall（清骑手指派、hallStatus 复位 open），存证写 transferPhotos。
     * 一期转单不扣信用分（规则后续租户可配）。 */
    async transfer(ctx: RequestContext, orderId: ID, photos: string[], note?: string) {
        const order = await this.assertOwner(ctx, orderId);
        const status = (order.customFields as any).deliveryStatus;
        if (status === 'in_progress' && !photos?.length) {
            throw new UserInputError('已取货转单需拍照交接');
        }
        if (status !== 'assigned' && status !== 'in_progress') {
            throw new UserInputError('当前状态不允许转单');
        }
        await this.hall.backToHall(ctx, order.id as any);
        if (photos?.length) {
            await this.connection.getRepository(ctx, Order).update(order.id, {
                customFields: {
                    transferPhotos: photos,
                    transferNote: note ?? null,
                    transferAt: new Date(),
                },
            } as any);
        }
        return order;
    }

    /** 开始配送：assigned → in_progress */
    async start(ctx: RequestContext, orderId: ID) {
        const order = await this.assertOwner(ctx, orderId, 'assigned');
        await this.connection
            .getRepository(ctx, Order)
            .update(order.id, { customFields: { deliveryStatus: 'in_progress' } } as any);
        return order;
    }

    /** 送达：拍照必传 → delivered → 分成入余额（0 分成单跳过入账） */
    async deliver(ctx: RequestContext, orderId: ID, photos: string[], note?: string) {
        if (!photos?.length) throw new UserInputError('送达需至少一张照片');
        const order = await this.assertOwner(ctx, orderId, 'in_progress');
        const rider = await this.riderService.assertApprovedRider(ctx);
        const earning = this.calcEarning(order, await this.getConfig(ctx));
        const tip = (order.customFields as any).tip ?? 0;
        await this.connection.getRepository(ctx, Order).update(order.id, {
            customFields: {
                deliveryStatus: 'delivered',
                deliveredAt: new Date(),
                deliveryPhotos: photos,
                deliveryNote: note ?? null,
                riderEarning: earning,
            },
        } as any);
        if (earning === 0 && tip === 0) {
            // 0 分成单：不写 earning 不调 addBalance（余额端口对 0 金额入账会抛错）
            Logger.log(`订单 ${order.code ?? order.id} 0 分成，跳过入账`, 'RiderTask');
        } else {
            await this.connection.getRepository(ctx, RiderEarning).save({
                orderId: order.id,
                riderCustomerId: rider.id,
                amount: earning,
                tip,
                status: 'credited',
                channelId: ctx.channelId,
            } as any);
            const port = getCouponBalancePort();
            if (port) {
                await port.addBalance(ctx, rider.id as number, earning);
            } else {
                Logger.warn('余额端口未注册，分成未入账', 'RiderTask');
            }
        }
        // 完单信用加分（+2）
        await this.credit.adjust(ctx, rider.id as any, CREDIT_COMPLETE, 'complete', order.id as any);
        // 通知下单用户已送达（fire-and-forget）
        this.notify.user(ctx, order.id as any, 'orderDelivered');
        return order;
    }

    /** 异常上报：不校验状态，标记 exception */
    async reportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string) {
        const order = await this.assertOwner(ctx, orderId);
        await this.connection.getRepository(ctx, Order).update(order.id, {
            customFields: {
                deliveryStatus: 'exception',
                exceptionType: type,
                exceptionPhotos: photos,
                exceptionNote: note ?? null,
            },
        } as any);
        return order;
    }

    private calcEarning(order: Order, cfg: CampusFulfillmentConfig): number {
        // 跑腿单：跑腿费在 orderLines 单价中（虚拟商品 0 元时全在 shipping）；统一取 shipping + 小费
        const shipping = order.shipping || 0;
        const tip = (order.customFields as any).tip ?? 0;
        return Math.floor(((shipping + tip) * cfg.riderCommissionRate) / 100);
    }

    private async getConfig(ctx: RequestContext) {
        const cfg = await this.connection
            .getRepository(ctx, CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId as any } });
        if (!cfg) throw new UserInputError('校园履约未配置');
        return cfg;
    }

    private async assertOwner(ctx: RequestContext, orderId: ID, expect?: string) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const order = await this.connection
            .getRepository(ctx, Order)
            .findOne({ where: { id: orderId as any }, relations: ['customer'] });
        const cf = order?.customFields as any;
        if (!order || cf?.deliveryStaffId !== String(rider.id)) throw new ForbiddenError();
        if (expect && cf?.deliveryStatus !== expect) {
            throw new UserInputError(`当前状态不允许该操作（期望 ${expect}）`);
        }
        return order;
    }
}
