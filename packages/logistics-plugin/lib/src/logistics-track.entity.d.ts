import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class LogisticsTrack extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<LogisticsTrack>);
    fulfillmentId: number;
    trackingNo: string;
    carrierCode: string;
    status: string;
    trackInfo: string | null;
    signedAt?: Date;
    lastError: string | null;
    lastSyncedAt?: Date;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
