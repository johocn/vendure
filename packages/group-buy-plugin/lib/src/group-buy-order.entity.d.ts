import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class GroupBuyOrder extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<GroupBuyOrder>);
    groupBuyActivityId: string;
    orderId: string;
    isLeader: boolean;
    status: 'pending' | 'success' | 'failed';
    channels: Channel[];
}
