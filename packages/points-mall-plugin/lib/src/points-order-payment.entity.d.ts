import { DeepPartial, VendureEntity } from '@vendure/core';
/** 混合价现金支付单（微信），参照 RechargeOrder 的幂等模式 */
export declare class PointsOrderPayment extends VendureEntity {
    constructor(input?: DeepPartial<PointsOrderPayment>);
    orderId: number;
    customerId: number;
    amount: number;
    status: string;
    externalRef: string | null;
    transactionId: string | null;
    paidAt: Date | null;
    channelId: number;
}
