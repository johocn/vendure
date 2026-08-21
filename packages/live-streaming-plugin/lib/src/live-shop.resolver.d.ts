import { ID, OrderService, RequestContext } from '@vendure/core';
import { LiveRoomService } from './live-room.service';
import { LiveRoomShopService } from './live-room-shop.service';
import { LiveCommissionService } from './live-commission.service';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveShopResolver {
    private options;
    private liveRoomService;
    private liveRoomShopService;
    private liveCommissionService;
    private orderService;
    constructor(options: LiveStreamingPluginOptions, liveRoomService: LiveRoomService, liveRoomShopService: LiveRoomShopService, liveCommissionService: LiveCommissionService, orderService: OrderService);
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
    setOrderLiveRoom(ctx: RequestContext, roomId: ID): Promise<import("@vendure/core").Order | undefined>;
}
