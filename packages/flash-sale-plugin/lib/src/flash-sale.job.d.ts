import { JobQueueService, Injector, TransactionalConnection } from '@vendure/core';
export declare class FlashSaleJob {
    private jobQueueService;
    private connection;
    private jobQueue;
    private intervalRef;
    constructor(jobQueueService: JobQueueService, connection: TransactionalConnection);
    private stockPrewarmService;
    initStock(injector: Injector): void;
    init(): Promise<void>;
    scheduleCheck(): void;
    private processStatusTransitions;
}
