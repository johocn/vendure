import { ChannelService, JobQueueService, OrderService } from '@vendure/core';
export declare class OrderTimeoutJob {
    private jobQueueService;
    private orderService;
    private channelService;
    private jobQueue;
    constructor(jobQueueService: JobQueueService, orderService: OrderService, channelService: ChannelService);
    init(): Promise<void>;
    scheduleCancellation(orderId: string, channelId: string, timeoutMinutes: number): Promise<void>;
}
