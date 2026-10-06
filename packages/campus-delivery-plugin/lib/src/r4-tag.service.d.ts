import { EntityHydrator, OrderService, OrderStateTransitionEvent, TransactionalConnection } from '@vendure/core';
/**
 * R4 打标写入方（二期 spec §5.4 缺口修复）：
 * waimai checkout「到店自取」直接 setOrderShippingMethod(store-pickup)，全链路无入口写
 * fulfillmentRoute='R4'（campusSetDeliveryTarget 拒绝 R4），订单详情核销码块
 * （isR4 && pickupCode）对真实用户永不渲染。
 * 统一在支付闸门（→ ArrangingPayment）打标：幂等、仅 campus 渠道、不覆盖已有路线。
 */
export declare class R4TagService {
    private connection;
    private hydrator;
    private orderService;
    constructor(connection: TransactionalConnection, hydrator: EntityHydrator, orderService: OrderService);
    tagR4({ ctx, order, toState }: OrderStateTransitionEvent): Promise<void>;
}
