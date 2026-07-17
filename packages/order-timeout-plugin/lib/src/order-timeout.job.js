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
exports.OrderTimeoutJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const order_timeout_task_entity_1 = require("./order-timeout-task.entity");
const MAX_RETRY = 3;
let OrderTimeoutJob = class OrderTimeoutJob {
    constructor(jobQueueService, orderService, channelService, connection) {
        this.jobQueueService = jobQueueService;
        this.orderService = orderService;
        this.channelService = channelService;
        this.connection = connection;
        this.taskRepo = this.connection.rawConnection.getRepository(order_timeout_task_entity_1.OrderTimeoutTask);
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'order-timeout',
            process: async (job) => {
                var _a;
                const { taskId } = job.data;
                const task = await this.taskRepo.findOne({ where: { id: taskId } });
                if (!task) {
                    core_1.Logger.warn(`Task ${taskId} not found, skipping timeout job`, constants_1.loggerCtx);
                    return;
                }
                if (task.status !== order_timeout_task_entity_1.TimeoutTaskStatus.PENDING) {
                    core_1.Logger.info(`Task ${taskId} status=${task.status}, skipping`, constants_1.loggerCtx);
                    return;
                }
                try {
                    const ctx = await this.buildCtx(task.channelId);
                    if (!ctx) {
                        throw new Error(`Channel ${task.channelId} not found`);
                    }
                    const order = await this.orderService.findOne(ctx, task.orderId);
                    if (!order) {
                        task.status = order_timeout_task_entity_1.TimeoutTaskStatus.CANCELLED;
                        await this.taskRepo.save(task);
                        core_1.Logger.warn(`Order ${task.orderId} not found, task ${taskId} CANCELLED`, constants_1.loggerCtx);
                        return;
                    }
                    if (!this.isStateMatching(task.type, order)) {
                        task.status = order_timeout_task_entity_1.TimeoutTaskStatus.CANCELLED;
                        await this.taskRepo.save(task);
                        core_1.Logger.info(`Order ${task.orderId} state=${order.state} no longer matches ${task.type}, task ${taskId} CANCELLED`, constants_1.loggerCtx);
                        return;
                    }
                    await this.executeTimeoutAction(ctx, task.type, order);
                    task.status = order_timeout_task_entity_1.TimeoutTaskStatus.EXECUTED;
                    task.executedAt = new Date();
                    task.lastError = null;
                    await this.taskRepo.save(task);
                    core_1.Logger.info(`Timeout ${task.type} for order ${task.orderId} executed (task ${taskId})`, constants_1.loggerCtx);
                }
                catch (e) {
                    task.retryCount += 1;
                    task.lastError = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
                    if (task.retryCount >= MAX_RETRY) {
                        task.status = order_timeout_task_entity_1.TimeoutTaskStatus.FAILED;
                        core_1.Logger.error(`Task ${taskId} marked FAILED after ${task.retryCount} retries: ${task.lastError}`, constants_1.loggerCtx);
                    }
                    else {
                        core_1.Logger.warn(`Task ${taskId} failed (retry ${task.retryCount}/${MAX_RETRY}): ${task.lastError}`, constants_1.loggerCtx);
                    }
                    await this.taskRepo.save(task);
                    throw e;
                }
            },
        });
    }
    isStateMatching(type, order) {
        if (!order)
            return false;
        switch (type) {
            case order_timeout_task_entity_1.TimeoutType.PAYMENT:
                return order.state === 'ArrangingPayment';
            case order_timeout_task_entity_1.TimeoutType.FULFILLMENT:
                return order.state === 'PaymentSettled' || order.state === 'PaymentAuthorized';
            case order_timeout_task_entity_1.TimeoutType.RECEIPT:
                return order.state === 'Shipped';
            case order_timeout_task_entity_1.TimeoutType.REVIEW:
                return order.state === 'Delivered';
            default:
                return false;
        }
    }
    async executeTimeoutAction(ctx, type, order) {
        const orderId = order.id;
        switch (type) {
            case order_timeout_task_entity_1.TimeoutType.PAYMENT:
                await this.orderService.cancelOrder(ctx, { orderId });
                core_1.Logger.warn(`Order ${order.id} cancelled due to payment timeout`, constants_1.loggerCtx);
                break;
            case order_timeout_task_entity_1.TimeoutType.FULFILLMENT:
                core_1.Logger.warn(`Order ${order.id} awaiting fulfillment beyond timeout, please ship ASAP`, constants_1.loggerCtx);
                break;
            case order_timeout_task_entity_1.TimeoutType.RECEIPT:
                await this.orderService.transitionToState(ctx, orderId, 'Delivered');
                core_1.Logger.info(`Order ${order.id} auto-transitioned to Delivered`, constants_1.loggerCtx);
                break;
            case order_timeout_task_entity_1.TimeoutType.REVIEW:
                core_1.Logger.info(`Order ${order.id} completed, remind customer to review`, constants_1.loggerCtx);
                break;
            default:
                throw new Error(`Unknown timeout type: ${type}`);
        }
    }
    async buildCtx(channelId) {
        const emptyCtx = core_1.RequestContext.empty();
        const channel = await this.channelService.findOne(emptyCtx, channelId);
        if (!channel)
            return null;
        return new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }
    async scheduleTimeout(type, orderId, channelId, timeoutMs) {
        const dueAt = new Date(Date.now() + timeoutMs);
        const task = this.taskRepo.create({
            type,
            orderId: Number(orderId),
            channelId: Number(channelId),
            dueAt,
            status: order_timeout_task_entity_1.TimeoutTaskStatus.PENDING,
            retryCount: 0,
        });
        const saved = await this.taskRepo.save(task);
        // BullMQ backend persists `delay` option; default SQL strategy ignores it.
        // Reliability is guaranteed by the compensation ScheduledTask scanning `dueAt`.
        await this.jobQueue.add({
            taskId: String(saved.id),
            orderId,
            channelId,
            type,
        }, { delay: timeoutMs, retries: MAX_RETRY });
        core_1.Logger.info(`Scheduled ${type} timeout for order ${orderId} due at ${dueAt.toISOString()}`, constants_1.loggerCtx);
    }
    /**
     * Compensation scan: pick up PENDING tasks whose dueAt has passed but were not
     * executed (e.g. process restart, Pod drift, or JobQueue failure). Re-enqueues
     * them so the standard job handler can process them with full state validation.
     */
    async runCompensation() {
        var _a;
        const now = new Date();
        const overdue = await this.taskRepo
            .createQueryBuilder('t')
            .where('t.status = :status', { status: order_timeout_task_entity_1.TimeoutTaskStatus.PENDING })
            .andWhere('t.dueAt < :now', { now })
            .andWhere('t.retryCount < :max', { max: MAX_RETRY })
            .getMany();
        if (overdue.length === 0)
            return;
        core_1.Logger.info(`Compensation scan found ${overdue.length} overdue task(s)`, constants_1.loggerCtx);
        for (const task of overdue) {
            try {
                await this.jobQueue.add({
                    taskId: String(task.id),
                    orderId: String(task.orderId),
                    channelId: String(task.channelId),
                    type: task.type,
                });
            }
            catch (e) {
                task.retryCount += 1;
                task.lastError = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
                if (task.retryCount >= MAX_RETRY) {
                    task.status = order_timeout_task_entity_1.TimeoutTaskStatus.FAILED;
                }
                await this.taskRepo.save(task);
                core_1.Logger.error(`Compensation enqueue failed for task ${task.id}: ${task.lastError}`, constants_1.loggerCtx);
            }
        }
    }
};
exports.OrderTimeoutJob = OrderTimeoutJob;
exports.OrderTimeoutJob = OrderTimeoutJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        core_1.OrderService,
        core_1.ChannelService,
        core_1.TransactionalConnection])
], OrderTimeoutJob);
//# sourceMappingURL=order-timeout.job.js.map