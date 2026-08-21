import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type CommunityLeaderStatus = 'applied' | 'active' | 'suspended';
export declare class CommunityLeader extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommunityLeader>);
    channelId: number;
    channels: Channel[];
    userId: number;
    customerId?: number | null;
    pickupLocationId: number;
    status: CommunityLeaderStatus;
    totalCommission: number;
}
