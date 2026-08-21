import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export type RechargeOrderStatus = 'pending' | 'paid' | 'cancelled';
export declare class RechargeOrder extends VendureEntity {
    constructor(input?: DeepPartial<RechargeOrder>);
    customerId: number;
    amount: number;
    status: RechargeOrderStatus;
    paymentMethod: string | null;
    externalRef: string | null;
    paidAt: Date | null;
    remark: string | null;
    channel: Channel;
    channelId: number;
}
