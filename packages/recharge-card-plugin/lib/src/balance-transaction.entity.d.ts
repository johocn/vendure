import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare enum BalanceTransactionType {
    RECHARGE = "recharge",
    CONSUME = "consume",
    REFUND = "refund",
    FREEZE = "freeze",
    UNFREEZE = "unfreeze",
    ADJUST = "adjust"
}
export declare class BalanceTransaction extends VendureEntity {
    constructor(input?: DeepPartial<BalanceTransaction>);
    customerId: number;
    type: BalanceTransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    orderId: number | null;
    paymentId: number | null;
    rechargeCardId: number | null;
    remark: string | null;
    channel: Channel;
    channelId: number;
}
