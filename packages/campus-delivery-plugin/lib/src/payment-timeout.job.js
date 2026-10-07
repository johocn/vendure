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
const campus_config_service_1 = require("./campus-config.service");
const campus_notify_service_1 = require("./campus-notify.service");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
exports.PAYMENT_REMIND_MS = 10 * 60 * 1000;
exports.PAYMENT_CANCEL_MS = 15 * 60 * 1000;
const MAX_RETRY = 3;
const loggerCtx = 'PaymentTimeout';
/**
 * 到点复查是竞态防线：任务执行时订单已离开 ArrangingPayment（已支付/已取消）→ 任务作废。
 * 取消路径按 order-timeout-plugin 先例：先显式释放库存分配（active 订单 cancelOrder 不释放），
 * 再 cancelOrder。与 OrderTimeoutPlugin（渠道 30min 兜底）共存，幂等无害。
 */
let PaymentTimeoutJob = class PaymentTimeoutJob {
    constructor(jobQueueService, connection, orderService, channelService, stockMovementService, notify, campusConfig) {
        this.jobQueueService = jobQueueService;
        this.connection = connection;
        this.orderService = orderService;
        this.channelService = channelService;
        this.stockMovementService = stockMovementService;
        this.notify = notify;
        this.campusConfig = campusConfig;
        this.taskRepo = this.connection.rawConnection.getRepository(payment_timeout_entity_1.PaymentTimeoutTask);
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'payment-timeout',
            process: async (job) => { await this.process(job.data); },
        });
    }
    async process(data) {
        const task = await this.taskRepo.findOne({ where: { id: data.taskId } });
        if (!task || task.status !== payment_timeout_entity_1.PaymentTimeoutStatus.PENDING)
            return;
        if (new Date() < new Date(task.dueAt))
            return; // SQL JobQueue 忽略 delay → 补偿扫描兜底
        await this.runTask(task);
    }
    /** 执行核心（定时队列与手动执行共用）：状态复查 → 提醒/取消 → 落库 */
    async runTask(task) {
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
                // 先释放库存分配再取消（order-timeout.job.ts 先例），失败即抛走重试
                const lines = ((_a = order.lines) !== null && _a !== void 0 ? _a : []).map((l) => ({ orderLineId: l.id, quantity: l.quantity }));
                if (lines.length)
                    await this.stockMovementService.createReleasesForOrderLines(ctx, lines);
                await this.orderService.cancelOrder(ctx, { orderId: order.id });
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
        const now = new Date();
        const overdue = await this.taskRepo.createQueryBuilder('t')
            .where('t.status = :status', { status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();
        for (const t of overdue) {
            await this.jobQueue.add({ taskId: Number(t.id) }, { retries: MAX_RETRY });
        }
        return overdue.length;
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
        campus_config_service_1.CampusConfigService])
], PaymentTimeoutJob);
//# sourceMappingURL=payment-timeout.job.js.map