import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    JobQueue,
    JobQueueService,
    Logger,
    OrderService,
    RequestContext,
    StockMovementService,
    TransactionalConnection,
} from '@vendure/core';
import { Repository } from 'typeorm';

import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { PaymentTimeoutStatus, PaymentTimeoutTask, PaymentTimeoutType } from './payment-timeout.entity';

export interface PaymentTimeoutJobData { taskId: number; }

/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
export const PAYMENT_REMIND_MS = 10 * 60 * 1000;
export const PAYMENT_CANCEL_MS = 15 * 60 * 1000;
const MAX_RETRY = 3;
const loggerCtx = 'PaymentTimeout';

/**
 * 到点复查是竞态防线：任务执行时订单已离开 ArrangingPayment（已支付/已取消）→ 任务作废。
 * 取消路径按 order-timeout-plugin 先例：先显式释放库存分配（active 订单 cancelOrder 不释放），
 * 再 cancelOrder。与 OrderTimeoutPlugin（渠道 30min 兜底）共存，幂等无害。
 */
@Injectable()
export class PaymentTimeoutJob {
    private jobQueue!: JobQueue<PaymentTimeoutJobData>;
    private taskRepo: Repository<PaymentTimeoutTask>;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private channelService: ChannelService,
        private stockMovementService: StockMovementService,
        private notify: CampusNotifyService,
        private campusConfig: CampusConfigService,
    ) {
        this.taskRepo = this.connection.rawConnection.getRepository(PaymentTimeoutTask);
    }

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'payment-timeout',
            process: async (job) => { await this.process(job.data); },
        });
    }

    async process(data: PaymentTimeoutJobData): Promise<void> {
        const task = await this.taskRepo.findOne({ where: { id: data.taskId as any } });
        if (!task || task.status !== PaymentTimeoutStatus.PENDING) return;
        if (new Date() < new Date(task.dueAt)) return; // SQL JobQueue 忽略 delay → 补偿扫描兜底
        await this.runTask(task);
    }

    /** 执行核心（定时队列与手动执行共用）：状态复查 → 提醒/取消 → 落库 */
    private async runTask(task: PaymentTimeoutTask): Promise<void> {
        try {
            const ctx = await this.buildCtx(task.channelId);
            if (!ctx) throw new Error(`Channel ${task.channelId} not found`);
            const order = await this.orderService.findOne(ctx, task.orderId as any);
            if (!order || order.state !== task.expectedState) {
                task.status = PaymentTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                Logger.info(`Task ${task.id} stale (order state=${order?.state}), CANCELLED`, loggerCtx);
                return;
            }
            if (task.type === PaymentTimeoutType.REMIND) {
                this.notify.user(ctx, order.id, 'paymentPending', undefined, await this.h5Base(ctx));
            } else {
                // 先释放库存分配再取消（order-timeout.job.ts 先例），失败即抛走重试
                const lines = (order.lines ?? []).map((l: any) => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length) await this.stockMovementService.createReleasesForOrderLines(ctx, lines as any);
                await this.orderService.cancelOrder(ctx, { orderId: order.id as any });
                this.notify.user(ctx, order.id, 'orderCancelled', '订单超时未支付，已自动取消', await this.h5Base(ctx));
            }
            task.status = PaymentTimeoutStatus.EXECUTED;
            task.lastError = null;
            await this.taskRepo.save(task);
        } catch (e: any) {
            task.retryCount += 1;
            task.lastError = String(e?.message ?? e);
            if (task.retryCount >= MAX_RETRY) task.status = PaymentTimeoutStatus.FAILED;
            await this.taskRepo.save(task);
            Logger.warn(`Task ${task.id} failed (${task.retryCount}/${MAX_RETRY}): ${task.lastError}`, loggerCtx);
            if (task.status !== PaymentTimeoutStatus.FAILED) throw e; // 未耗尽才重抛触发队列重试
        }
    }

    /** 登记：进入 ArrangingPayment 时调用（提醒 + 取消两个任务） */
    async scheduleForOrder(ctx: RequestContext, orderId: number, channelId: number, expectedState: string): Promise<void> {
        for (const [type, delayMs] of [[PaymentTimeoutType.REMIND, PAYMENT_REMIND_MS], [PaymentTimeoutType.CANCEL, PAYMENT_CANCEL_MS]] as const) {
            const task = await this.taskRepo.save(this.taskRepo.create({
                orderId, channelId, type, expectedState,
                dueAt: new Date(Date.now() + delayMs),
                status: PaymentTimeoutStatus.PENDING, retryCount: 0,
            }));
            await this.jobQueue.add({ taskId: Number(task.id) }, { delay: delayMs, retries: MAX_RETRY } as any);
        }
        Logger.info(`payment timeout scheduled for order ${orderId} (+10min remind / +15min cancel)`, loggerCtx);
    }

    /** 离开 ArrangingPayment → 作废该订单全部 PENDING 任务 */
    async cancelForOrder(orderId: number): Promise<void> {
        const pending = await this.taskRepo.find({ where: { orderId, status: PaymentTimeoutStatus.PENDING } as any });
        for (const t of pending) {
            t.status = PaymentTimeoutStatus.CANCELLED;
            await this.taskRepo.save(t);
        }
    }

    /** 手动执行：PENDING（无视 dueAt）/ FAILED 重试；EXECUTED/CANCELLED 拒绝。条件防并发：执行前复查状态 */
    async executeTaskNow(taskId: number): Promise<PaymentTimeoutTask> {
        const task = await this.taskRepo.findOne({ where: { id: taskId as any } });
        if (!task) throw new Error('PAYMENT_TIMEOUT_TASK_NOT_FOUND');
        if (task.status === PaymentTimeoutStatus.EXECUTED || task.status === PaymentTimeoutStatus.CANCELLED) {
            throw new Error('PAYMENT_TIMEOUT_TASK_NOT_EXECUTABLE');
        }
        await this.runTask(task);
        return task;
    }

    /** 手动重发提醒：按任务取 orderId/channelId 直发通知，不经状态机 */
    async resendRemind(taskId: number): Promise<boolean> {
        const task = await this.taskRepo.findOne({ where: { id: taskId as any } });
        if (!task || task.type !== PaymentTimeoutType.REMIND) throw new Error('PAYMENT_TIMEOUT_REMIND_TASK_NOT_FOUND');
        const ctx = await this.buildCtx(task.channelId);
        if (!ctx) throw new Error('PAYMENT_TIMEOUT_CHANNEL_NOT_FOUND');
        const order = await this.orderService.findOne(ctx, task.orderId as any);
        if (!order) throw new Error('PAYMENT_TIMEOUT_ORDER_NOT_FOUND');
        this.notify.user(ctx, order.id, 'paymentPending', undefined, await this.h5Base(ctx));
        return true;
    }

    /** 补偿扫描：捡起 dueAt 已过的 PENDING 任务重新入队，返回处理条数 */
    async runCompensation(): Promise<number> {
        const now = new Date();
        const overdue = await this.taskRepo.createQueryBuilder('t')
            .where('t.status = :status', { status: PaymentTimeoutStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();
        for (const t of overdue) {
            await this.jobQueue.add({ taskId: Number(t.id) }, { retries: MAX_RETRY } as any);
        }
        return overdue.length;
    }

    private async h5Base(ctx: RequestContext): Promise<string | undefined> {
        try {
            const cfg = await this.campusConfig.getConfig(ctx);
            return (cfg as any)?.h5BaseUrl ?? undefined;
        } catch { return undefined; }
    }

    private async buildCtx(channelId: number | string): Promise<RequestContext | null> {
        const channel = await this.channelService.findOne(RequestContext.empty(), channelId as ID);
        if (!channel) return null;
        return new RequestContext({ apiType: 'admin', channel, isAuthorized: true, authorizedAsOwnerOnly: false });
    }
}
