import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class CommissionRecord extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommissionRecord>);
    distributorId: string;
    orderId: string;
    orderLineId: string;
    fromDistributorId: string;
    commissionType: 'direct' | 'indirect';
    commissionRate: number;
    orderAmount: number;
    commissionAmount: number;
    status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
    settledAt: Date;
    channels: Channel[];
}
