import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare enum PaymentTimeoutType {
    REMIND = "REMIND",
    CANCEL = "CANCEL"
}
export declare enum PaymentTimeoutStatus {
    PENDING = "PENDING",
    EXECUTED = "EXECUTED",
    CANCELLED = "CANCELLED",
    FAILED = "FAILED"
}
/** 待付款定时任务：订单进入 ArrangingPayment 时登记 +10min 提醒 / +15min 取消（时长常量，spec §4.3） */
export declare class PaymentTimeoutTask extends VendureEntity {
    [key: string]: any;
    orderId: ID;
    channelId: ID;
    type: PaymentTimeoutType;
    dueAt: Date;
    status: PaymentTimeoutStatus;
    expectedState: string;
    retryCount: number;
    lastError: string | null;
    constructor(input?: DeepPartial<PaymentTimeoutTask>);
}
