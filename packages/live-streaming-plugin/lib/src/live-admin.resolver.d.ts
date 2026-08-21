import { ID, RequestContext } from '@vendure/core';
import { LiveRoomService } from './live-room.service';
export declare class LiveAdminResolver {
    private liveRoomService;
    constructor(liveRoomService: LiveRoomService);
    liveRooms(ctx: RequestContext, options?: any): Promise<import("@vendure/core").PaginatedList<import("./live-room.entity").LiveRoom>>;
    liveRoom(ctx: RequestContext, id: ID): Promise<import("./live-room.entity").LiveRoom | undefined>;
    createLiveRoom(ctx: RequestContext, input: any): Promise<import("./live-room.entity").LiveRoom>;
    updateLiveRoom(ctx: RequestContext, input: any): Promise<import("./live-room.entity").LiveRoom>;
    deleteLiveRoom(ctx: RequestContext, id: ID): Promise<boolean>;
    startLiveRoom(ctx: RequestContext, id: ID): Promise<import("./live-room.entity").LiveRoom>;
    stopLiveRoom(ctx: RequestContext, id: ID, replayUrl?: string): Promise<import("./live-room.entity").LiveRoom>;
    addLiveRoomProduct(ctx: RequestContext, roomId: ID, input: any): Promise<import("./live-room.entity").LiveRoom>;
    removeLiveRoomProduct(ctx: RequestContext, roomId: ID, productId: ID): Promise<import("./live-room.entity").LiveRoom>;
}
