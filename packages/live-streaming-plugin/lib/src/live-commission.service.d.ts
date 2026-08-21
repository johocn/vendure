import { EventBus, RequestContext, TransactionalConnection } from '@vendure/core';
import { LiveStreamingPluginOptions } from './types';
export declare class LiveCommissionService {
    private connection;
    private eventBus;
    private initialized;
    private opts;
    constructor(connection: TransactionalConnection, eventBus: EventBus);
    setOptions(opts: LiveStreamingPluginOptions): void;
    init(): void;
    setOrderLiveRoom(ctx: RequestContext, orderId: string, roomId: string): Promise<void>;
    private calculateLiveCommission;
}
