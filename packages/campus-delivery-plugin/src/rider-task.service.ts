import { Injectable, Logger } from '@nestjs/common';
import {
    ForbiddenError,
    ID,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { getCouponBalancePort } from '@vendure/coupon-plugin';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';

@Injectable()
export class RiderTaskService {
    constructor(private connection: TransactionalConnection, private riderService: RiderService) {}

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

    /** 开始配送：assigned → in_progress */
    async start(ctx: RequestContext, orderId: ID) {
        const order = await this.assertOwner(ctx, orderId, 'assigned');
        await this.connection
            .getRepository(ctx, Order)
            .update(order.id, { customFields: { deliveryStatus: 'in_progress' } } as any);
        return order;
    }

    /** 送达：拍照必传 → delivered → 分成入余额 */
    async deliver(ctx: RequestContext, orderId: ID, photos: string[], note?: string) {
        if (!photos?.length) throw new UserInputError('送达需至少一张照片');
        const order = await this.assertOwner(ctx, orderId, 'in_progress');
        const rider = await this.riderService.assertApprovedRider(ctx);
        const earning = this.calcEarning(order, await this.getConfig(ctx));
        await this.connection.getRepository(ctx, Order).update(order.id, {
            customFields: {
                deliveryStatus: 'delivered',
                deliveredAt: new Date(),
                deliveryPhotos: photos,
                deliveryNote: note ?? null,
                riderEarning: earning,
            },
        } as any);
        await this.connection.getRepository(ctx, RiderEarning).save({
            orderId: order.id,
            riderCustomerId: rider.id,
            amount: earning,
            tip: (order.customFields as any).tip ?? 0,
            status: 'credited',
            channelId: ctx.channelId,
        } as any);
        const port = getCouponBalancePort();
        if (port) {
            await port.addBalance(ctx, rider.id as number, earning);
        } else {
            Logger.warn('余额端口未注册，分成未入账', 'RiderTask');
        }
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
