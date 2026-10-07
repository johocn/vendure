import { ModuleRef } from '@nestjs/core';
import { JobQueueService, TransactionalConnection } from '@vendure/core';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesTimeoutType } from './after-sales-timeout.entity';
export interface AfterSalesTimeoutJobData {
    taskId: string;
    requestId: number;
    channelId: number;
    type: AfterSalesTimeoutType;
}
export declare class AfterSalesTimeoutJob {
    private jobQueueService;
    private connection;
    private moduleRef;
    private afterSalesService;
    private jobQueue;
    private taskRepo;
    private requestRepo;
    private injector;
    private eventBus;
    constructor(jobQueueService: JobQueueService, connection: TransactionalConnection, moduleRef: ModuleRef, afterSalesService: AfterSalesService);
    init(): Promise<void>;
    private process;
    /**
     * RefundFailed 自动重试：调 retryRefund 复用退款核心；成功→EXECUTED；
     * 失败且未耗尽→指数退避重排（任务保持 PENDING）；耗尽→EXECUTED + 商家提醒。
     */
    private executeRefundRetry;
    /**
     * 商家侧站内信提醒：发布 AfterSalesMerchantNotifyEvent，由 notification-plugin 订阅落库。
     * 经 EventBus 解耦——本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）；
     * 发布失败仅告警，不影响任务状态落库。
     */
    private notifyMerchant;
    private buildCtx;
    /** 登记超时任务：落库 + 入 delayed job（SQL JobQueue 忽略 delay 时由补偿扫描兜底） */
    scheduleTimeout(type: AfterSalesTimeoutType, requestId: number, channelId: number, delayMs: number, expectedState: string, maxAttempt?: number): Promise<void>;
    /**
     * 补偿扫描：捡起 dueAt 已过但未执行的 PENDING 任务重新入队
     * （进程重启 / SQL JobQueue 忽略 delay / Pod 漂移兜底），由标准 handler 带完整状态校验执行。
     */
    runCompensation(): Promise<void>;
}
