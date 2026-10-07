import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ChannelService,
    EventBus,
    ID,
    Injector,
    JobQueue,
    JobQueueService,
    Logger,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { Repository } from 'typeorm';

import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesMerchantNotifyEvent } from './after-sales.events';
import {
    AfterSalesTimeoutStatus,
    AfterSalesTimeoutTask,
    AfterSalesTimeoutType,
} from './after-sales-timeout.entity';
import { loggerCtx } from './constants';

export interface AfterSalesTimeoutJobData {
    taskId: string;
    requestId: number;
    channelId: number;
    type: AfterSalesTimeoutType;
}

/** 执行失败重试上限（与 order-timeout-plugin 同义） */
const MAX_RETRY = 3;
/** 退款重试基础间隔：30min × 2^attempt（指数退避） */
const REFUND_RETRY_BASE_DELAY_MS = 30 * 60 * 1000;

@Injectable()
export class AfterSalesTimeoutJob {
    private jobQueue!: JobQueue<AfterSalesTimeoutJobData>;
    private taskRepo: Repository<AfterSalesTimeoutTask>;
    private requestRepo: Repository<AfterSalesRequest>;
    private injector!: Injector;
    private eventBus!: EventBus;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
        private moduleRef: ModuleRef,
        private afterSalesService: AfterSalesService,
    ) {
        this.taskRepo = this.connection.rawConnection.getRepository(AfterSalesTimeoutTask);
        this.requestRepo = this.connection.rawConnection.getRepository(AfterSalesRequest);
    }

    async init(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.eventBus = this.injector.get(EventBus);
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'after-sales-timeout',
            process: async (job) => {
                await this.process(job.data);
            },
        });
    }

    private async process(data: AfterSalesTimeoutJobData): Promise<void> {
        const { taskId } = data;
        const task = await this.taskRepo.findOne({ where: { id: taskId as any } });
        if (!task) {
            Logger.warn(`Task ${taskId} not found, skipping timeout job`, loggerCtx);
            return;
        }
        if (task.status !== AfterSalesTimeoutStatus.PENDING) {
            Logger.info(`Task ${taskId} status=${task.status}, skipping`, loggerCtx);
            return;
        }
        // SQL JobQueue（DefaultJobQueuePlugin）忽略 `delay` 选项，任务入队后可能立即执行。
        // 若未到 dueAt 则跳过执行，任务保持 PENDING，由补偿扫描任务在到期后重新入队。
        if (new Date() < task.dueAt) {
            Logger.debug(
                `Task ${taskId} not due until ${task.dueAt.toISOString()}, skipping (compensation will re-enqueue)`,
                loggerCtx,
            );
            return;
        }

        try {
            const ctx = await this.buildCtx(task.channelId);
            if (!ctx) {
                throw new Error(`Channel ${task.channelId} not found`);
            }
            const request = await this.requestRepo.findOne({ where: { id: task.requestId as any } });
            if (!request) {
                task.status = AfterSalesTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                Logger.warn(`AfterSalesRequest ${task.requestId} not found, task ${taskId} CANCELLED`, loggerCtx);
                return;
            }
            // 状态不一致即作废：防止过期动作（如 Pending 已被人工处理/取消）
            if (request.state !== task.expectedState) {
                task.status = AfterSalesTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                Logger.info(
                    `Request ${task.requestId} state=${request.state} no longer matches ${task.expectedState}, task ${taskId} CANCELLED`,
                    loggerCtx,
                );
                return;
            }

            switch (task.type) {
                case AfterSalesTimeoutType.PENDING_REMIND:
                    await this.notifyMerchant(
                        ctx,
                        task,
                        '售后处理超时提醒',
                        `您有一笔售后申请（#${task.requestId}）已超过处理时限仍未处理，请尽快登录后台处理。`,
                    );
                    break;
                case AfterSalesTimeoutType.PENDING_AUTO_APPROVE:
                    await this.afterSalesService.approveRequest(ctx, task.requestId as ID);
                    Logger.info(`Request ${task.requestId} auto-approved after timeout`, loggerCtx);
                    break;
                case AfterSalesTimeoutType.REFUND_RETRY:
                    // 退款重试的终态/重排逻辑全部在 executeRefundRetry 内自行落库
                    await this.executeRefundRetry(ctx, task);
                    break;
                default:
                    throw new Error(`Unknown timeout type: ${task.type}`);
            }
            if (task.type === AfterSalesTimeoutType.REFUND_RETRY) {
                return; // 已自行落 EXECUTED/CANCELLED，或重排 dueAt 保持 PENDING
            }
            task.status = AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            task.lastError = null;
            await this.taskRepo.save(task);
            Logger.info(`Timeout ${task.type} for request ${task.requestId} executed (task ${taskId})`, loggerCtx);
        } catch (e: any) {
            task.retryCount += 1;
            task.lastError = String(e?.message ?? e);
            if (task.retryCount >= MAX_RETRY) {
                task.status = AfterSalesTimeoutStatus.FAILED;
                Logger.error(
                    `Task ${taskId} marked FAILED after ${task.retryCount} retries: ${task.lastError}`,
                    loggerCtx,
                );
            } else {
                Logger.warn(
                    `Task ${taskId} failed (retry ${task.retryCount}/${MAX_RETRY}): ${task.lastError}`,
                    loggerCtx,
                );
            }
            await this.taskRepo.save(task);
            throw e;
        }
    }

    /**
     * RefundFailed 自动重试：调 retryRefund 复用退款核心；成功→EXECUTED；
     * 失败且未耗尽→指数退避重排（任务保持 PENDING）；耗尽→EXECUTED + 商家提醒。
     */
    private async executeRefundRetry(ctx: RequestContext, task: AfterSalesTimeoutTask): Promise<void> {
        const markExhausted = async () => {
            task.status = AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            await this.taskRepo.save(task);
            await this.notifyMerchant(
                ctx,
                task,
                '退款自动重试耗尽',
                `售后单 #${task.requestId} 退款自动重试已达上限（${task.maxAttempt} 次）仍未成功，请人工处理。`,
            );
            Logger.warn(`Refund auto-retry exhausted for request ${task.requestId} (task ${task.id})`, loggerCtx);
        };
        // 防御：补偿扫描重复入队等场景下 attempt 已达上限则直接终态
        if (task.maxAttempt > 0 && task.attempt >= task.maxAttempt) {
            await markExhausted();
            return;
        }
        const request = await this.requestRepo.findOne({ where: { id: task.requestId as any } });
        if (!request) {
            task.status = AfterSalesTimeoutStatus.CANCELLED;
            task.lastError = `AfterSalesRequest ${task.requestId} not found`;
            await this.taskRepo.save(task);
            return;
        }
        if (request.type === 'exchange') {
            // 换货单不走退款链路（与 EXCHANGE_NO_REFUND 约束同源）
            task.status = AfterSalesTimeoutStatus.CANCELLED;
            await this.taskRepo.save(task);
            Logger.info(`Exchange request ${task.requestId} skips refund retry, task ${task.id} CANCELLED`, loggerCtx);
            return;
        }

        const after = await this.afterSalesService.retryRefund(ctx, task.requestId as ID);
        task.attempt += 1;
        if (after.state === 'Refunded') {
            task.status = AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            task.lastError = null;
            await this.taskRepo.save(task);
            Logger.info(`Refund retry succeeded for request ${task.requestId} (task ${task.id})`, loggerCtx);
            return;
        }
        if (task.attempt >= task.maxAttempt) {
            await markExhausted();
            return;
        }
        // 未耗尽：指数退避登记下一次重试（任务保持 PENDING，等补偿扫描/延迟队列兜底）
        const delayMs = REFUND_RETRY_BASE_DELAY_MS * Math.pow(2, task.attempt);
        task.dueAt = new Date(Date.now() + delayMs);
        await this.taskRepo.save(task);
        await this.jobQueue.add(
            { taskId: String(task.id), requestId: task.requestId, channelId: task.channelId, type: task.type },
            { delay: delayMs, retries: MAX_RETRY } as any,
        );
        Logger.info(
            `Refund retry ${task.attempt}/${task.maxAttempt} rescheduled for request ${task.requestId} due at ${task.dueAt.toISOString()}`,
            loggerCtx,
        );
    }

    /**
     * 商家侧站内信提醒：发布 AfterSalesMerchantNotifyEvent，由 notification-plugin 订阅落库。
     * 经 EventBus 解耦——本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）；
     * 发布失败仅告警，不影响任务状态落库。
     */
    private async notifyMerchant(
        ctx: RequestContext,
        task: AfterSalesTimeoutTask,
        title: string,
        content: string,
    ): Promise<void> {
        try {
            this.eventBus.publish(new AfterSalesMerchantNotifyEvent(ctx, task.requestId, title, content));
        } catch (e: any) {
            Logger.warn(`Merchant notify publish failed for request ${task.requestId}: ${e?.message ?? e}`, loggerCtx);
        }
    }

    private async buildCtx(channelId: number | string): Promise<RequestContext | null> {
        try {
            const channelService = this.injector.get(ChannelService);
            const emptyCtx = RequestContext.empty();
            const channel = await channelService.findOne(emptyCtx, channelId as ID);
            if (!channel) return null;
            return new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
        } catch (e: any) {
            Logger.warn(`AfterSalesTimeoutJob buildCtx failed: ${e?.message ?? e}`, loggerCtx);
            return null;
        }
    }

    /** 登记超时任务：落库 + 入 delayed job（SQL JobQueue 忽略 delay 时由补偿扫描兜底） */
    async scheduleTimeout(
        type: AfterSalesTimeoutType,
        requestId: number,
        channelId: number,
        delayMs: number,
        expectedState: string,
        maxAttempt = 0,
    ): Promise<void> {
        const dueAt = new Date(Date.now() + delayMs);
        const task = this.taskRepo.create({
            type,
            requestId,
            channelId,
            dueAt,
            status: AfterSalesTimeoutStatus.PENDING,
            expectedState,
            attempt: 0,
            maxAttempt,
            retryCount: 0,
        });
        const saved = await this.taskRepo.save(task);
        // BullMQ backend persists `delay` option; default SQL strategy ignores it.
        // Reliability is guaranteed by the compensation ScheduledTask scanning `dueAt`.
        await this.jobQueue.add(
            { taskId: String(saved.id), requestId, channelId, type },
            { delay: delayMs, retries: MAX_RETRY } as any,
        );
        Logger.info(
            `Scheduled ${type} timeout for after-sales request ${requestId} due at ${dueAt.toISOString()}`,
            loggerCtx,
        );
    }

    /**
     * 补偿扫描：捡起 dueAt 已过但未执行的 PENDING 任务重新入队
     * （进程重启 / SQL JobQueue 忽略 delay / Pod 漂移兜底），由标准 handler 带完整状态校验执行。
     */
    async runCompensation(): Promise<void> {
        const now = new Date();
        const overdue = await this.taskRepo.find({ where: { status: AfterSalesTimeoutStatus.PENDING } });
        let requeued = 0;
        for (const task of overdue) {
            if (task.dueAt > now || task.retryCount >= MAX_RETRY) continue;
            await this.jobQueue.add(
                { taskId: String(task.id), requestId: task.requestId, channelId: task.channelId, type: task.type },
                { retries: MAX_RETRY } as any,
            );
            requeued++;
        }
        if (requeued > 0) {
            Logger.info(`After-sales timeout compensation re-enqueued ${requeued} overdue task(s)`, loggerCtx);
        }
    }
}
