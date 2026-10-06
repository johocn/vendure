import { Injectable } from '@nestjs/common';
import {
    EntityHydrator,
    Logger,
    OrderService,
    OrderStateTransitionEvent,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';

/**
 * R4 打标写入方（二期 spec §5.4 缺口修复）：
 * waimai checkout「到店自取」直接 setOrderShippingMethod(store-pickup)，全链路无入口写
 * fulfillmentRoute='R4'（campusSetDeliveryTarget 拒绝 R4），订单详情核销码块
 * （isR4 && pickupCode）对真实用户永不渲染。
 * 统一在支付闸门（→ ArrangingPayment）打标：幂等、仅 campus 渠道、不覆盖已有路线。
 */
@Injectable()
export class R4TagService {
    constructor(
        private connection: TransactionalConnection,
        private hydrator: EntityHydrator,
        private orderService: OrderService,
    ) {}

    async tagR4({ ctx, order, toState }: OrderStateTransitionEvent): Promise<void> {
        if (toState !== 'ArrangingPayment') return;
        if ((order.customFields as any)?.fulfillmentRoute) return; // 已有路线（R1/R2/R3/R5）不碰
        const cfg = await this.connection.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        if (!cfg) return; // 仅 campus 渠道生效
        const hydrated = await this.hydrator.hydrate(ctx, order, {
            relations: ['shippingLines', 'shippingLines.shippingMethod'],
        });
        const isStorePickup = (hydrated.shippingLines ?? []).some(
            l => (l.shippingMethod as any)?.code?.startsWith('store-pickup'),
        );
        if (!isStorePickup) return;
        await this.orderService.updateCustomFields(ctx, order.id, { fulfillmentRoute: 'R4' } as any);
        Logger.info(`order=${order.code} tagged fulfillmentRoute=R4`, 'CampusR4Tag');
    }
}
