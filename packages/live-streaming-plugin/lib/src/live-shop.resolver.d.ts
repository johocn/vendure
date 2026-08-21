import { ID, RequestContext } from '@vendure/core';
import { LiveRoomService } from './live-room.service';
import { LiveRoomShopService } from './live-room-shop.service';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveShopResolver {
    private options;
    private liveRoomService;
    private liveRoomShopService;
    constructor(options: LiveStreamingPluginOptions, liveRoomService: LiveRoomService, liveRoomShopService: LiveRoomShopService);
    liveRooms(ctx: RequestContext, status?: string): Promise<import("./live-room.entity").LiveRoom[]>;
    liveRoom(ctx: RequestContext, id: ID): Promise<import("./live-room.entity").LiveRoom>;
    liveRoomProducts(ctx: RequestContext, id: ID): Promise<import("./live-room-product.entity").LiveRoomProduct[]>;
    enterLiveRoom(ctx: RequestContext, roomId: ID): Promise<{
        roomId: string;
        playUrl: string | null;
        pushUrl: string | null;
        wsUrl: string;
        wsTicket: string;
    }>;
}
