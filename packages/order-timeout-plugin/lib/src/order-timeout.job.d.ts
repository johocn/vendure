import { ChannelService, JobQueueService, OrderService, TransactionalConnection } from '@vendure/core';
import { TimeoutType } from './order-timeout-task.entity';
export interface OrderTimeoutJobData {
    taskId: string;
    orderId: string;
    channelId: string;
    type: TimeoutType;
}
export declare class OrderTimeoutJob {
    private jobQueueService;
    private orderService;
    private channelService;
    private connection;
    private jobQueue;
    private taskRepo;
    constructor(jobQueueService: JobQueueService, orderService: OrderService, channelService: ChannelService, connection: TransactionalConnection);
    init(): Promise<void>;
    private isStateMatching;
    private executeTimeoutAction;
    private buildCtx;
    scheduleTimeout(type: TimeoutType, orderId: string, channelId: string, timeoutMs: number): Promise<void>;
    /**
     * Compensation scan: pick up PENDING tasks whose dueAt has passed but were not
     * executed (e.g. process restart, Pod drift, or JobQueue failure). Re-enqueues
     * them so the standard job handler can process them with full state validation.
     */
    runCompensation(): Promise<void>;
}
