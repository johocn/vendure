import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 积分订单。状态机：
 *  纯积分+virtual: completed（扣分即完成）
 *  纯积分+physical: pending_ship → shipped → completed
 *  混合价: pending_payment(已扣分+已建支付单) → 支付回调后 → pending_ship/completed
 *  cancelled: 未支付取消（退积分+回补库存）
 */
export declare class PointsOrder extends VendureEntity {
    constructor(input?: DeepPartial<PointsOrder>);
    code: string;
    customerId: number;
    pointsProductId: number;
    /** 商品快照：{ productId, variantId, name, image, spec } */
    productSnapshot: Record<string, any>;
    quantity: number;
    pointsTotal: number;
    cashTotal: number;
    deliveryType: string;
    /** 实物必填：{ name, phone, province, city, district, detail } */
    addressSnapshot: Record<string, any> | null;
    status: string;
    trackingNo: string | null;
    paidAt: Date | null;
    shippedAt: Date | null;
    completedAt: Date | null;
    channelId: number;
}
