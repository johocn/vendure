import { ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { LiveRoom } from './live-room.entity';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveRoomService {
    private connection;
    private listQueryBuilder;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    private opts;
    setOptions(opts: LiveStreamingPluginOptions): void;
    findAll(ctx: RequestContext, options?: ListQueryOptions<LiveRoom>): Promise<PaginatedList<LiveRoom>>;
    findOne(ctx: RequestContext, id: ID): Promise<LiveRoom | undefined>;
    create(ctx: RequestContext, input: any): Promise<LiveRoom>;
    update(ctx: RequestContext, input: any): Promise<LiveRoom>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
    start(ctx: RequestContext, id: ID): Promise<LiveRoom>;
    stop(ctx: RequestContext, id: ID, replayUrl?: string): Promise<LiveRoom>;
    pushUrlOf(room: LiveRoom): string | null;
    addProduct(ctx: RequestContext, roomId: ID, input: any): Promise<LiveRoom>;
    removeProduct(ctx: RequestContext, roomId: ID, productId: ID): Promise<LiveRoom>;
}
