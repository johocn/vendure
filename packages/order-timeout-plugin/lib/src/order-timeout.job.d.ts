import { ChannelService, JobQueueService, OrderService, StockMovementService, TransactionalConnection } from '@vendure/core';
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
    private stockMovementService;
    private jobQueue;
    private taskRepo;
    constructor(jobQueueService: JobQueueService, orderService: OrderService, channelService: ChannelService, connection: TransactionalConnection, stockMovementService: StockMovementService);
    init(): Promise<void>;
    private isStateMatching;
    private executeTimeoutAction;
    /**
     * 显式释放订单行的库存分配。
     * Vendure 的 cancelOrder 对 active 订单（如 ArrangingPayment）不会释放库存，
     * 需在取消前调用 createReleasesForOrderLines 把分配归还（写 RELEASE 流水并回退 stockAllocated）。
     */
    private releaseAllocationsForOrder;
    private buildCtx;
    scheduleTimeout(type: TimeoutType, orderId: string, channelId: string, timeoutMs: number): Promise<void>;
    /**
     * Compensation scan: pick up PENDING tasks whose dueAt has passed but were not
     * executed (e.g. process restart, Pod drift, or JobQueue failure). Re-enqueues
     * them so the standard job handler can process them with full state validation.
     */
    runCompensation(): Promise<void>;
}
