import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type CommunityActivityStatus = 'draft' | 'open' | 'cutover' | 'closed';
export declare class CommunityActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CommunityActivity>);
    channelId: number;
    channels: Channel[];
    leaderId: number;
    pickupLocationId: number;
    windowStart: Date;
    windowEnd: Date;
    cutoffTime: Date;
    commissionRate: number;
    status: CommunityActivityStatus;
}
