"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentTimeoutJob = exports.PAYMENT_CANCEL_MS = exports.PAYMENT_REMIND_MS = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const campus_config_service_1 = require("./campus-config.service");
const campus_dedupe_service_1 = require("./campus-dedupe.service");
const campus_notify_service_1 = require("./campus-notify.service");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
const periodic_fallback_1 = require("./periodic-fallback");
/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
exports.PAYMENT_REMIND_MS = 10 * 60 * 1000;
exports.PAYMENT_CANCEL_MS = 15 * 60 * 1000;
const MAX_RETRY = 3;
const loggerCtx = 'PaymentTimeout';
const TASK_BUSY = 'PAYMENT_TIMEOUT_TASK_BUSY';
/** 补偿扫描周期：SQL JobQueue 不按 delay 排队，任务 job 往往在到期前就被执行掉，全靠补偿重入队 */
const COMPENSATION_INTERVAL_MS = 5 * 60000;
/** 启动后首跑延迟：等 JobQueue 完成初始化 */
const COMPENSATION_BOOT_DELAY_MS = 30000;
/** FAILED 任务告警重复窗口：同一任务 24h 内只推一次（避免每 5min 补偿轮次刷屏） */
const FAILED_ALERT_REPEAT_MS = 24 * 3600000;
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
let PaymentTimeoutJob = class PaymentTimeoutJob {
    constructor(jobQueueService, connection, orderService, channelService, stockMovementService, notify, campusConfig, feishu, 
    /** M5 跨实例告警去重；未注入退回进程内 Map */
    dedupe) {
        this.jobQueueService = jobQueueService;
        this.connection = connection;
        this.orderService = orderService;
        this.channelService = channelService;
        this.stockMovementService = stockMovementService;
        this.notify = notify;
        this.campusConfig = campusConfig;
        this.feishu = feishu;
        this.dedupe = dedupe;
        this.compensation = null;
        /** FAILED 任务告警去重：taskId → 上次告警时间（24h 内不重复推；M5 经 dedupe 跨实例，未注入退回 Map） */
        this.alertedFailed = new Map();
        this.taskRepo = this.connection.rawConnection.getRepository(payment_timeout_entity_1.PaymentTimeoutTask);
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'payment-timeout',
            process: async (job) => { await this.process(job.data); },
        });
    }
    /**
     * 启动补偿扫描循环（幂等）：30s 后首跑，此后每 intervalMs 一轮。
     * 必须晚于 init()（runCompensation 依赖 jobQueue）。
     */
    startCompensationLoop(intervalMs = COMPENSATION_INTERVAL_MS) {
        if (this.compensation)
            return;
        this.compensation = new periodic_fallback_1.PeriodicFallback({
            name: 'payment-timeout-compensation',
            intervalMs,
            bootDelayMs: COMPENSATION_BOOT_DELAY_MS,
            loggerCtx,
        });
        this.compensation.start(() => this.runCompensation());
    }
    stopCompensationLoop() {
        var _a;
        (_a = this.compensation) === null || _a === void 0 ? void 0 : _a.stop();
        this.compensation = null;
    }
    onApplicationShutdown() {
        this.stopCompensationLoop();
    }
    async process(data) {
        const task = await this.taskRepo.findOne({ where: { id: data.taskId } });
        if (!task || task.status !== payment_timeout_entity_1.PaymentTimeoutStatus.PENDING)
            return;
        if (new Date() < new Date(task.dueAt))
            return; // SQL JobQueue 忽略 delay → 补偿扫描兜底
        try {
            await this.runTask(task);
        }
        catch (e) {
            // 同一任务已被其他执行者持锁处理：本轮跳过，补偿扫描会再兜底
            if (String(e === null || e === void 0 ? void 0 : e.message) === TASK_BUSY) {
                core_1.Logger.info(`Task ${task.id} busy, skip this round`, loggerCtx);
                return;
            }
            throw e;
        }
    }
    /** 执行核心（定时队列与手动执行共用）：任务级咨询锁 → 锁内复查状态 → 提醒/取消 → 落库 */
    async runTask(task) {
        const outcome = await this.withTaskLock(Number(task.id), async () => {
            // 锁内重新读取：并发的第二个执行者应看到已完成状态而直接退出，避免重复通知/重复取消
            const fresh = await this.taskRepo.findOne({ where: { id: task.id } });
            if (!fresh)
                return;
            if (fresh.status === payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED || fresh.status === payment_timeout_entity_1.PaymentTimeoutStatus.CANCELLED)
                return;
            await this.runTaskLocked(fresh);
            task.status = fresh.status;
            task.retryCount = fresh.retryCount;
            task.lastError = fresh.lastError;
        });
        if (!outcome.locked)
            throw new Error(TASK_BUSY);
    }
    /**
     * 会话级咨询锁（手动执行 + 队列 + 5min 补偿扫描可能同时命中同一任务）。
     * 持锁连接全程不归还连接池，保证 unlock 命中同一会话。
     */
    async withTaskLock(taskId, fn) {
        var _a, _b;
        const key = `campus:paytimeout:${taskId}`;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        try {
            const rows = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key]);
            const locked = ((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.locked) === true || ((_b = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _b === void 0 ? void 0 : _b.locked) === 't';
            if (!locked)
                return { locked: false };
            try {
                return { locked: true, result: await fn() };
            }
            finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
            }
        }
        finally {
            await runner.release();
        }
    }
    async runTaskLocked(task) {
        var _a, _b;
        try {
            const ctx = await this.buildCtx(task.channelId);
            if (!ctx)
                throw new Error(`Channel ${task.channelId} not found`);
            const order = await this.orderService.findOne(ctx, task.orderId);
            if (!order || order.state !== task.expectedState) {
                task.status = payment_timeout_entity_1.PaymentTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                core_1.Logger.info(`Task ${task.id} stale (order state=${order === null || order === void 0 ? void 0 : order.state}), CANCELLED`, loggerCtx);
                return;
            }
            if (task.type === payment_timeout_entity_1.PaymentTimeoutType.REMIND) {
                this.notify.user(ctx, order.id, 'paymentPending', undefined, await this.h5Base(ctx));
            }
            else {
                // 幂等释放：只释放尚未释放的分配，重试/并发重复执行不会重复扣减与重复生成 Release
                const lines = ((_a = order.lines) !== null && _a !== void 0 ? _a : []).map((l) => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length)
                    await this.stockMovementService.createOutstandingReleasesForOrderLines(ctx, lines);
                let cancelled = false;
                try {
                    await this.orderService.cancelOrder(ctx, { orderId: order.id });
                    cancelled = true;
                }
                catch (e) {
                    // 并发路径已把订单取消 → 视为成功，避免重试无限循环；通知由先成功者发出
                    const freshOrder = await this.orderService.findOne(ctx, order.id);
                    if ((freshOrder === null || freshOrder === void 0 ? void 0 : freshOrder.state) !== 'Cancelled')
                        throw e;
                    core_1.Logger.info(`Task ${task.id}: order ${order.id} already cancelled`, loggerCtx);
                }
                if (cancelled)
                    this.notify.user(ctx, order.id, 'orderCancelled', '订单超时未支付，已自动取消', await this.h5Base(ctx));
            }
            task.status = payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED;
            task.lastError = null;
            await this.taskRepo.save(task);
        }
        catch (e) {
            task.retryCount += 1;
            task.lastError = String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e);
            if (task.retryCount >= MAX_RETRY)
                task.status = payment_timeout_entity_1.PaymentTimeoutStatus.FAILED;
            await this.taskRepo.save(task);
            core_1.Logger.warn(`Task ${task.id} failed (${task.retryCount}/${MAX_RETRY}): ${task.lastError}`, loggerCtx);
            if (task.status !== payment_timeout_entity_1.PaymentTimeoutStatus.FAILED)
                throw e; // 未耗尽才重抛触发队列重试
        }
    }
    /** 登记：进入 ArrangingPayment 时调用（提醒 + 取消两个任务） */
    async scheduleForOrder(ctx, orderId, channelId, expectedState) {
        for (const [type, delayMs] of [[payment_timeout_entity_1.PaymentTimeoutType.REMIND, exports.PAYMENT_REMIND_MS], [payment_timeout_entity_1.PaymentTimeoutType.CANCEL, exports.PAYMENT_CANCEL_MS]]) {
            // 同单同类型去重：重复进入 ArrangingPayment（支付失败后重试）不得叠加两套定时任务，
            // 否则会重复提醒、且旧任务的 dueAt 会让取消提前触发
            const dup = await this.taskRepo.findOne({
                where: { orderId, type, status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING },
            });
            if (dup)
                continue;
            const task = await this.taskRepo.save(this.taskRepo.create({
                orderId, channelId, type, expectedState,
                dueAt: new Date(Date.now() + delayMs),
                status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING, retryCount: 0,
            }));
            await this.jobQueue.add({ taskId: Number(task.id) }, { delay: delayMs, retries: MAX_RETRY });
        }
        core_1.Logger.info(`payment timeout scheduled for order ${orderId} (+10min remind / +15min cancel)`, loggerCtx);
    }
    /** 离开 ArrangingPayment → 作废该订单全部 PENDING 任务 */
    async cancelForOrder(orderId) {
        const pending = await this.taskRepo.find({ where: { orderId, status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING } });
        for (const t of pending) {
            t.status = payment_timeout_entity_1.PaymentTimeoutStatus.CANCELLED;
            await this.taskRepo.save(t);
        }
    }
    /** 手动执行：PENDING（无视 dueAt）/ FAILED 重试；EXECUTED/CANCELLED 拒绝。条件防并发：执行前复查状态 */
    async executeTaskNow(taskId) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task)
            throw new Error('PAYMENT_TIMEOUT_TASK_NOT_FOUND');
        if (task.status === payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED || task.status === payment_timeout_entity_1.PaymentTimeoutStatus.CANCELLED) {
            throw new Error('PAYMENT_TIMEOUT_TASK_NOT_EXECUTABLE');
        }
        await this.runTask(task);
        return task;
    }
    /** 手动重发提醒：按任务取 orderId/channelId 直发通知，不经状态机 */
    async resendRemind(taskId) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task || task.type !== payment_timeout_entity_1.PaymentTimeoutType.REMIND)
            throw new Error('PAYMENT_TIMEOUT_REMIND_TASK_NOT_FOUND');
        const ctx = await this.buildCtx(task.channelId);
        if (!ctx)
            throw new Error('PAYMENT_TIMEOUT_CHANNEL_NOT_FOUND');
        const order = await this.orderService.findOne(ctx, task.orderId);
        if (!order)
            throw new Error('PAYMENT_TIMEOUT_ORDER_NOT_FOUND');
        this.notify.user(ctx, order.id, 'paymentPending', undefined, await this.h5Base(ctx));
        return true;
    }
    /** 补偿扫描：捡起 dueAt 已过的 PENDING 任务重新入队，返回处理条数 */
    async runCompensation() {
        if (!this.jobQueue)
            return 0; // init 未完成（启动窗口）
        const now = new Date();
        const overdue = await this.taskRepo.createQueryBuilder('t')
            .where('t.status = :status', { status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();
        for (const t of overdue) {
            await this.jobQueue.add({ taskId: Number(t.id) }, { retries: MAX_RETRY });
        }
        if (overdue.length) {
            core_1.Logger.info(`compensation re-enqueued ${overdue.length} overdue task(s)`, loggerCtx);
        }
        // FAILED 任务（重试耗尽、订单仍卡在 ArrangingPayment）推飞书，运营不再靠翻 PM2 日志发现卡单
        await this.alertFailedTasks().catch(e => { var _a; return core_1.Logger.warn(`failed-task alert sweep error: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx); });
        return overdue.length;
    }
    /**
     * FAILED 任务告警：补偿轮次里扫 FAILED 任务，按 taskId 24h 内只推一次飞书。
     * 此前仅 Logger.warn 到 stdout，生产曾有订单卡在 ArrangingPayment 11 天才被发现。
     * 未启用飞书时 pushEvent 静默降级，不影响主流程。
     */
    async alertFailedTasks() {
        var _a, _b, _c;
        const now = Date.now();
        // GC：超过去重窗口的记录清除，保证 Map 有界（dedupe 后端由 TTL 自动过期）
        if (!this.dedupe) {
            const expired = [];
            for (const [id, at] of this.alertedFailed)
                if (now - at > FAILED_ALERT_REPEAT_MS)
                    expired.push(id);
            for (const id of expired)
                this.alertedFailed.delete(id);
        }
        const failed = await this.taskRepo.find({
            where: { status: payment_timeout_entity_1.PaymentTimeoutStatus.FAILED },
            order: { updatedAt: 'DESC' },
            take: FAILED_SCAN_LIMIT,
        });
        if (!failed.length)
            return;
        const orderIds = [...new Set(failed.map(t => Number(t.orderId)))];
        const orders = orderIds.length
            ? await this.connection.rawConnection.getRepository(core_1.Order).find({ where: { id: (0, typeorm_1.In)(orderIds) } })
            : [];
        const codeById = new Map(orders.map((o) => [Number(o.id), o.code]));
        for (const t of failed) {
            const tid = Number(t.id);
            if (this.dedupe) {
                if (await this.dedupe.seen(`paytimeout_failed_alert:${tid}`, FAILED_ALERT_REPEAT_MS))
                    continue;
            }
            else if (this.alertedFailed.has(tid)) {
                continue;
            }
            const code = (_a = codeById.get(Number(t.orderId))) !== null && _a !== void 0 ? _a : `#${t.orderId}`;
            const typeLabel = t.type === payment_timeout_entity_1.PaymentTimeoutType.CANCEL ? '超时取消' : '待付款提醒';
            try {
                const sent = await this.feishu.pushEvent('payment_timeout_failed', '待付款任务失败', `订单 ${code} ${typeLabel}重试 ${t.retryCount} 次仍失败：${(_b = t.lastError) !== null && _b !== void 0 ? _b : '未知错误'}（订单可能卡在待付款）`, String(code), `paytimeout_failed:${tid}`);
                // 送达成功才登记 24h 去重：推送失败时下一轮继续重试，避免失败一次就静默一天
                if (sent) {
                    if (this.dedupe)
                        await this.dedupe.mark(`paytimeout_failed_alert:${tid}`, FAILED_ALERT_REPEAT_MS);
                    else
                        this.alertedFailed.set(tid, now);
                }
                else {
                    core_1.Logger.warn(`failed-task alert not delivered task=${tid}, will retry next sweep`, loggerCtx);
                }
            }
            catch (e) {
                core_1.Logger.warn(`failed-task alert push error task=${tid}: ${String((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e)}`, loggerCtx);
            }
        }
    }
    async h5Base(ctx) {
        var _a;
        try {
            const cfg = await this.campusConfig.getConfig(ctx);
            return (_a = cfg === null || cfg === void 0 ? void 0 : cfg.h5BaseUrl) !== null && _a !== void 0 ? _a : undefined;
        }
        catch (_b) {
            return undefined;
        }
    }
    async buildCtx(channelId) {
        const channel = await this.channelService.findOne(core_1.RequestContext.empty(), channelId);
        if (!channel)
            return null;
        return new core_1.RequestContext({ apiType: 'admin', channel, isAuthorized: true, authorizedAsOwnerOnly: false });
    }
};
exports.PaymentTimeoutJob = PaymentTimeoutJob;
exports.PaymentTimeoutJob = PaymentTimeoutJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.ChannelService,
        core_1.StockMovementService,
        campus_notify_service_1.CampusNotifyService,
        campus_config_service_1.CampusConfigService,
        feishu_notify_service_1.FeishuNotifyService,
        campus_dedupe_service_1.CampusDedupeService])
], PaymentTimeoutJob);
//# sourceMappingURL=payment-timeout.job.js.map