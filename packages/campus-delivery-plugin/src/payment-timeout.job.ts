import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
    ChannelService,
    ID,
    JobQueue,
    JobQueueService,
    Logger,
    Order,
    OrderService,
    RequestContext,
    StockMovementService,
    TransactionalConnection,
} from '@vendure/core';
import { In, Repository } from 'typeorm';

import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
import { PaymentTimeoutStatus, PaymentTimeoutTask, PaymentTimeoutType } from './payment-timeout.entity';

export interface PaymentTimeoutJobData { taskId: number; }

/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
export const PAYMENT_REMIND_MS = 10 * 60 * 1000;
export const PAYMENT_CANCEL_MS = 15 * 60 * 1000;
const MAX_RETRY = 3;
const loggerCtx = 'PaymentTimeout';
const TASK_BUSY = 'PAYMENT_TIMEOUT_TASK_BUSY';
/** 补偿扫描周期：SQL JobQueue 不按 delay 排队，任务 job 往往在到期前就被执行掉，全靠补偿重入队 */
const COMPENSATION_INTERVAL_MS = 5 * 60_000;
/** 启动后首跑延迟：等 JobQueue 完成初始化 */
const COMPENSATION_BOOT_DELAY_MS = 30_000;
/** FAILED 任务告警重复窗口：同一任务 24h 内只推一次（避免每 5min 补偿轮次刷屏） */
const FAILED_ALERT_REPEAT_MS = 24 * 3600_000;
/** 单轮最多扫描的 FAILED 任务数（防长事务） */
const FAILED_SCAN_LIMIT = 100;

/**
 * 到点复查是竞态防线：任务执行时订单已离开 ArrangingPayment（已支付/已取消）→ 任务作废。
 * 取消路径按 order-timeout-plugin 先例：先幂等释放库存分配（createOutstandingReleasesForOrderLines），
 * 再 cancelOrder。任务级咨询锁保证队列 / 手动 / 补偿扫描并发时只有一人真正执行。
 *
 * 补偿扫描用自管定时器（startCompensationLoop）而非 Vendure ScheduledTask：生产为单进程
 * （pm2 只跑 API，dev-config 配 runTasksInWorkerOnly: true），ScheduledTask 在生产从不执行，
 * 曾导致超时任务永久 PENDING、订单卡在 ArrangingPayment。本插件其余后台任务（调度扫描 /
 * 飞书汇总）同样用自管定时器，部署形态一致。
 */
@Injectable()
export class PaymentTimeoutJob implements OnApplicationShutdown {
    private jobQueue!: JobQueue<PaymentTimeoutJobData>;
    private taskRepo: Repository<PaymentTimeoutTask>;
    private compensationTimer: ReturnType<typeof setInterval> | null = null;
    private compensationBootTimer: ReturnType<typeof setTimeout> | null = null;
    private compensationRunning = false;
    /** FAILED 任务告警去重：taskId → 上次告警时间（24h 内不重复推） */
    private alertedFailed = new Map<number, number>();

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private channelService: ChannelService,
        private stockMovementService: StockMovementService,
        private notify: CampusNotifyService,
        private campusConfig: CampusConfigService,
        private feishu: FeishuNotifyService,
    ) {
        this.taskRepo = this.connection.rawConnection.getRepository(PaymentTimeoutTask);
    }

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'payment-timeout',
            process: async (job) => { await this.process(job.data); },
        });
    }

    /**
     * 启动补偿扫描循环（幂等）：30s 后首跑，此后每 intervalMs 一轮。
     * 必须晚于 init()（runCompensation 依赖 jobQueue）。
     */
    startCompensationLoop(intervalMs = COMPENSATION_INTERVAL_MS): void {
        if (this.compensationTimer) return;
        const tick = () => {
            if (this.compensationRunning) return; // 上一轮未结束跳过，避免堆积
            this.compensationRunning = true;
            this.runCompensation()
                .catch(e => Logger.warn(`payment timeout compensation failed: ${String(e?.message ?? e)}`, loggerCtx))
                .finally(() => { this.compensationRunning = false; });
        };
        this.compensationBootTimer = setTimeout(tick, COMPENSATION_BOOT_DELAY_MS);
        this.compensationTimer = setInterval(tick, intervalMs);
    }

    stopCompensationLoop(): void {
        if (this.compensationBootTimer) clearTimeout(this.compensationBootTimer);
        if (this.compensationTimer) clearInterval(this.compensationTimer);
        this.compensationBootTimer = null;
        this.compensationTimer = null;
    }

    onApplicationShutdown(): void {
        this.stopCompensationLoop();
    }

    async process(data: PaymentTimeoutJobData): Promise<void> {
        const task = await this.taskRepo.findOne({ where: { id: data.taskId as any } });
        if (!task || task.status !== PaymentTimeoutStatus.PENDING) return;
        if (new Date() < new Date(task.dueAt)) return; // SQL JobQueue 忽略 delay → 补偿扫描兜底
        try {
            await this.runTask(task);
        } catch (e: any) {
            // 同一任务已被其他执行者持锁处理：本轮跳过，补偿扫描会再兜底
            if (String(e?.message) === TASK_BUSY) {
                Logger.info(`Task ${task.id} busy, skip this round`, loggerCtx);
                return;
            }
            throw e;
        }
    }

    /** 执行核心（定时队列与手动执行共用）：任务级咨询锁 → 锁内复查状态 → 提醒/取消 → 落库 */
    private async runTask(task: PaymentTimeoutTask): Promise<void> {
        const outcome = await this.withTaskLock(Number(task.id), async () => {
            // 锁内重新读取：并发的第二个执行者应看到已完成状态而直接退出，避免重复通知/重复取消
            const fresh = await this.taskRepo.findOne({ where: { id: task.id as any } });
            if (!fresh) return;
            if (fresh.status === PaymentTimeoutStatus.EXECUTED || fresh.status === PaymentTimeoutStatus.CANCELLED) return;
            await this.runTaskLocked(fresh);
            task.status = fresh.status;
            task.retryCount = fresh.retryCount;
            task.lastError = fresh.lastError;
        });
        if (!outcome.locked) throw new Error(TASK_BUSY);
    }

    /**
     * 会话级咨询锁（手动执行 + 队列 + 5min 补偿扫描可能同时命中同一任务）。
     * 持锁连接全程不归还连接池，保证 unlock 命中同一会话。
     */
    private async withTaskLock<T>(taskId: number, fn: () => Promise<T>): Promise<{ locked: boolean; result?: T }> {
        const key = `campus:paytimeout:${taskId}`;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        try {
            const rows: any[] = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key]);
            const locked = rows?.[0]?.locked === true || rows?.[0]?.locked === 't';
            if (!locked) return { locked: false };
            try {
                return { locked: true, result: await fn() };
            } finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
            }
        } finally {
            await runner.release();
        }
    }

    private async runTaskLocked(task: PaymentTimeoutTask): Promise<void> {
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
                // 幂等释放：只释放尚未释放的分配，重试/并发重复执行不会重复扣减与重复生成 Release
                const lines = (order.lines ?? []).map((l: any) => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length) await this.stockMovementService.createOutstandingReleasesForOrderLines(ctx, lines as any);
                let cancelled = false;
                try {
                    await this.orderService.cancelOrder(ctx, { orderId: order.id as any });
                    cancelled = true;
                } catch (e) {
                    // 并发路径已把订单取消 → 视为成功，避免重试无限循环；通知由先成功者发出
                    const freshOrder = await this.orderService.findOne(ctx, order.id as any);
                    if (freshOrder?.state !== 'Cancelled') throw e;
                    Logger.info(`Task ${task.id}: order ${order.id} already cancelled`, loggerCtx);
                }
                if (cancelled) this.notify.user(ctx, order.id, 'orderCancelled', '订单超时未支付，已自动取消', await this.h5Base(ctx));
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
            // 同单同类型去重：重复进入 ArrangingPayment（支付失败后重试）不得叠加两套定时任务，
            // 否则会重复提醒、且旧任务的 dueAt 会让取消提前触发
            const dup = await this.taskRepo.findOne({
                where: { orderId, type, status: PaymentTimeoutStatus.PENDING } as any,
            });
            if (dup) continue;
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
        if (!this.jobQueue) return 0; // init 未完成（启动窗口）
        const now = new Date();
        const overdue = await this.taskRepo.createQueryBuilder('t')
            .where('t.status = :status', { status: PaymentTimeoutStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();
        for (const t of overdue) {
            await this.jobQueue.add({ taskId: Number(t.id) }, { retries: MAX_RETRY } as any);
        }
        if (overdue.length) {
            Logger.info(`compensation re-enqueued ${overdue.length} overdue task(s)`, loggerCtx);
        }
        // FAILED 任务（重试耗尽、订单仍卡在 ArrangingPayment）推飞书，运营不再靠翻 PM2 日志发现卡单
        await this.alertFailedTasks().catch(e =>
            Logger.warn(`failed-task alert sweep error: ${String(e?.message ?? e)}`, loggerCtx),
        );
        return overdue.length;
    }

    /**
     * FAILED 任务告警：补偿轮次里扫 FAILED 任务，按 taskId 24h 内只推一次飞书。
     * 此前仅 Logger.warn 到 stdout，生产曾有订单卡在 ArrangingPayment 11 天才被发现。
     * 未启用飞书时 pushEvent 静默降级，不影响主流程。
     */
    private async alertFailedTasks(): Promise<void> {
        const now = Date.now();
        // GC：超过去重窗口的记录清除，保证 Map 有界
        const expired: number[] = [];
        for (const [id, at] of this.alertedFailed) if (now - at > FAILED_ALERT_REPEAT_MS) expired.push(id);
        for (const id of expired) this.alertedFailed.delete(id);

        const failed = await this.taskRepo.find({
            where: { status: PaymentTimeoutStatus.FAILED } as any,
            order: { updatedAt: 'DESC' } as any,
            take: FAILED_SCAN_LIMIT,
        });
        if (!failed.length) return;

        const orderIds = [...new Set(failed.map(t => Number(t.orderId)))];
        const orders = orderIds.length
            ? await this.connection.rawConnection.getRepository(Order).find({ where: { id: In(orderIds) } as any })
            : [];
        const codeById = new Map(orders.map((o: any) => [Number(o.id), o.code]));

        for (const t of failed) {
            const tid = Number(t.id);
            if (this.alertedFailed.has(tid)) continue;
            this.alertedFailed.set(tid, now);
            const code = codeById.get(Number(t.orderId)) ?? `#${t.orderId}`;
            const typeLabel = t.type === PaymentTimeoutType.CANCEL ? '超时取消' : '待付款提醒';
            try {
                await this.feishu.pushEvent(
                    'payment_timeout_failed',
                    '待付款任务失败',
                    `订单 ${code} ${typeLabel}重试 ${t.retryCount} 次仍失败：${t.lastError ?? '未知错误'}（订单可能卡在待付款）`,
                    String(code),
                    `paytimeout_failed:${tid}`,
                );
            } catch (e: any) {
                Logger.warn(`failed-task alert push error task=${tid}: ${String(e?.message ?? e)}`, loggerCtx);
            }
        }
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
