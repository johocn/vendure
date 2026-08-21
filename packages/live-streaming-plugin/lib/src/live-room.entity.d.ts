import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { LiveRoomProduct } from './live-room-product.entity';
export declare class LiveRoom extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<LiveRoom>);
    name: string;
    coverUrl: string | null;
    description: string | null;
    streamerCustomerId: string | null;
    streamerName: string | null;
    type: string;
    status: string;
    scheduledStartAt: Date | null;
    startedAt: Date | null;
    endedAt: Date | null;
    streamKey: string | null;
    playUrl: string | null;
    replayUrl: string | null;
    likeCount: number;
    viewCount: number;
    products: LiveRoomProduct[];
    channels: Channel[];
}
