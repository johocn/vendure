import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { LiveRoom } from './live-room.entity';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveRoomShopService {
    private connection;
    constructor(connection: TransactionalConnection);
    private opts;
    setOptions(opts: LiveStreamingPluginOptions): void;
    list(ctx: RequestContext, status?: string): Promise<LiveRoom[]>;
    detail(ctx: RequestContext, id: ID): Promise<LiveRoom>;
    enterForRoom(room: LiveRoom, customerId: ID | undefined, wsUrl: string | undefined, wsSecret: string | undefined): {
        roomId: string;
        playUrl: string | null;
        pushUrl: string | null;
        wsUrl: string;
        wsTicket: string;
    };
    listProducts(ctx: RequestContext, id: ID): Promise<LiveRoom['products']>;
}
