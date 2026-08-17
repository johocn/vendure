import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    JobQueue,
    JobQueueService,
    Logger,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { Repository } from 'typeorm';

import { loggerCtx } from './constants';
import { OrderTimeoutTask, TimeoutTaskStatus, TimeoutType } from './order-timeout-task.entity';

export interface OrderTimeoutJobData {
    taskId: string;
    orderId: string;
    channelId: string;
    type: TimeoutType;
}

const MAX_RETRY = 3;

@Injectable()
export class OrderTimeoutJob {
    private jobQueue!: JobQueue<OrderTimeoutJobData>;
    private taskRepo: Repository<OrderTimeoutTask>;

    constructor(
        private jobQueueService: JobQueueService,
        private orderService: OrderService,
        private channelService: ChannelService,
        private connection: TransactionalConnection,
    ) {
        this.taskRepo = this.connection.rawConnection.getRepository(OrderTimeoutTask);
    }

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'order-timeout',
            process: async (job) => {
                const { taskId } = job.data;
                const task = await this.taskRepo.findOne({ where: { id: taskId as any } });
                if (!task) {
                    Logger.warn(`Task ${taskId} not found, skipping timeout job`, loggerCtx);
                    return;
                }
                if (task.status !== TimeoutTaskStatus.PENDING) {
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

                    const order = await this.orderService.findOne(ctx, task.orderId as ID);
                    if (!order) {
                        task.status = TimeoutTaskStatus.CANCELLED;
                        await this.taskRepo.save(task);
                        Logger.warn(`Order ${task.orderId} not found, task ${taskId} CANCELLED`, loggerCtx);
                        return;
                    }

                    if (!this.isStateMatching(task.type, order)) {
                        task.status = TimeoutTaskStatus.CANCELLED;
                        await this.taskRepo.save(task);
                        Logger.info(
                            `Order ${task.orderId} state=${order.state} no longer matches ${task.type}, task ${taskId} CANCELLED`,
                            loggerCtx,
                        );
                        return;
                    }

                    await this.executeTimeoutAction(ctx, task.type, order);
                    task.status = TimeoutTaskStatus.EXECUTED;
                    task.executedAt = new Date();
                    task.lastError = null;
                    await this.taskRepo.save(task);
                    Logger.info(`Timeout ${task.type} for order ${task.orderId} executed (task ${taskId})`, loggerCtx);
                } catch (e: any) {
                    task.retryCount += 1;
                    task.lastError = String(e?.message ?? e);
                    if (task.retryCount >= MAX_RETRY) {
                        task.status = TimeoutTaskStatus.FAILED;
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
            },
        });
    }

    private isStateMatching(type: TimeoutType, order: Order | undefined): boolean {
        if (!order) return false;
        switch (type) {
            case TimeoutType.PAYMENT:
                return order.state === 'ArrangingPayment';
            case TimeoutType.FULFILLMENT:
                return order.state === 'PaymentSettled' || order.state === 'PaymentAuthorized';
            case TimeoutType.RECEIPT:
                return order.state === 'Shipped';
            case TimeoutType.REVIEW:
                return order.state === 'Delivered';
            default:
                return false;
        }
    }

    private async executeTimeoutAction(ctx: RequestContext, type: TimeoutType, order: Order): Promise<void> {
        const orderId = order.id as ID;
        switch (type) {
            case TimeoutType.PAYMENT:
                await this.orderService.cancelOrder(ctx, { orderId });
                Logger.warn(`Order ${order.id} cancelled due to payment timeout`, loggerCtx);
                break;
            case TimeoutType.FULFILLMENT:
                Logger.warn(
                    `Order ${order.id} awaiting fulfillment beyond timeout, please ship ASAP`,
                    loggerCtx,
                );
                break;
            case TimeoutType.RECEIPT:
                await this.orderService.transitionToState(ctx, orderId, 'Delivered' as any);
                Logger.info(`Order ${order.id} auto-transitioned to Delivered`, loggerCtx);
                break;
            case TimeoutType.REVIEW:
                Logger.info(`Order ${order.id} completed, remind customer to review`, loggerCtx);
                break;
            default:
                throw new Error(`Unknown timeout type: ${type}`);
        }
    }

    private async buildCtx(channelId: number | string): Promise<RequestContext | null> {
        const emptyCtx = RequestContext.empty();
        const channel = await this.channelService.findOne(emptyCtx, channelId as ID);
        if (!channel) return null;
        return new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    async scheduleTimeout(
        type: TimeoutType,
        orderId: string,
        channelId: string,
        timeoutMs: number,
    ): Promise<void> {
        const dueAt = new Date(Date.now() + timeoutMs);
        const task = this.taskRepo.create({
            type,
            orderId: Number(orderId),
            channelId: Number(channelId),
            dueAt,
            status: TimeoutTaskStatus.PENDING,
            retryCount: 0,
        });
        const saved = await this.taskRepo.save(task);
        // BullMQ backend persists `delay` option; default SQL strategy ignores it.
        // Reliability is guaranteed by the compensation ScheduledTask scanning `dueAt`.
        await this.jobQueue.add(
            {
                taskId: String(saved.id),
                orderId,
                channelId,
                type,
            },
            { delay: timeoutMs, retries: MAX_RETRY } as any,
        );
        Logger.info(
            `Scheduled ${type} timeout for order ${orderId} due at ${dueAt.toISOString()}`,
            loggerCtx,
        );
    }

    /**
     * Compensation scan: pick up PENDING tasks whose dueAt has passed but were not
     * executed (e.g. process restart, Pod drift, or JobQueue failure). Re-enqueues
     * them so the standard job handler can process them with full state validation.
     */
    async runCompensation(): Promise<void> {
        const now = new Date();
        const overdue = await this.taskRepo
            .createQueryBuilder('t')
            .where('t.status = :status', { status: TimeoutTaskStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();

        if (overdue.length === 0) return;
        Logger.info(`Compensation scan found ${overdue.length} overdue task(s)`, loggerCtx);

        for (const task of overdue) {
            try {
                await this.jobQueue.add({
                    taskId: String(task.id),
                    orderId: String(task.orderId),
                    channelId: String(task.channelId),
                    type: task.type,
                });
            } catch (e: any) {
                task.retryCount += 1;
                task.lastError = String(e?.message ?? e);
                if (task.retryCount >= MAX_RETRY) {
                    task.status = TimeoutTaskStatus.FAILED;
                }
                await this.taskRepo.save(task);
                Logger.error(
                    `Compensation enqueue failed for task ${task.id}: ${task.lastError}`,
                    loggerCtx,
                );
            }
        }
    }
}
