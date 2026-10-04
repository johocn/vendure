import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { LiveRoom } from './live-room.entity';
export declare class LiveRoomPlatform extends VendureEntity {
    constructor(input?: DeepPartial<LiveRoomPlatform>);
    liveRoom: LiveRoom;
    platform: string;
    externalUrl: string;
    channels: Channel[];
}
