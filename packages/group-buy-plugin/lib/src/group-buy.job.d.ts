import { ChannelService, JobQueueService, OrderService, TransactionalConnection } from '@vendure/core';
export declare class GroupBuyJob {
    private jobQueueService;
    private connection;
    private orderService;
    private channelService;
    private jobQueue;
    constructor(jobQueueService: JobQueueService, connection: TransactionalConnection, orderService: OrderService, channelService: ChannelService);
    init(): Promise<void>;
    scheduleCheck(): void;
}
