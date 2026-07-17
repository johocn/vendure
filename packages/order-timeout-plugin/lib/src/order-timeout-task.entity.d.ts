import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare enum TimeoutType {
    PAYMENT = "payment",
    FULFILLMENT = "fulfillment",
    RECEIPT = "receipt",
    REVIEW = "review"
}
export declare enum TimeoutTaskStatus {
    PENDING = "pending",
    EXECUTED = "executed",
    CANCELLED = "cancelled",
    FAILED = "failed"
}
export declare class OrderTimeoutTask extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<OrderTimeoutTask>);
    type: TimeoutType;
    orderId: number;
    channelId: number;
    dueAt: Date;
    status: TimeoutTaskStatus;
    retryCount: number;
    lastError: string | null;
    executedAt?: Date;
    channel: Channel;
    channels: Channel[];
}
