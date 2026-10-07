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
exports.AfterSalesTimeoutJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const after_sales_service_1 = require("./after-sales.service");
const after_sales_events_1 = require("./after-sales.events");
const after_sales_timeout_entity_1 = require("./after-sales-timeout.entity");
const constants_1 = require("./constants");
/** 执行失败重试上限（与 order-timeout-plugin 同义） */
const MAX_RETRY = 3;
/** 退款重试基础间隔：30min × 2^attempt（指数退避） */
const REFUND_RETRY_BASE_DELAY_MS = 30 * 60 * 1000;
let AfterSalesTimeoutJob = class AfterSalesTimeoutJob {
    constructor(jobQueueService, connection, moduleRef, afterSalesService) {
        this.jobQueueService = jobQueueService;
        this.connection = connection;
        this.moduleRef = moduleRef;
        this.afterSalesService = afterSalesService;
        this.taskRepo = this.connection.rawConnection.getRepository(after_sales_timeout_entity_1.AfterSalesTimeoutTask);
        this.requestRepo = this.connection.rawConnection.getRepository(after_sales_request_entity_1.AfterSalesRequest);
    }
    async init() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.eventBus = this.injector.get(core_2.EventBus);
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'after-sales-timeout',
            process: async (job) => {
                await this.process(job.data);
            },
        });
    }
    async process(data) {
        var _a;
        const { taskId } = data;
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
            core_2.Logger.warn(`Task ${taskId} not found, skipping timeout job`, constants_1.loggerCtx);
            return;
        }
        if (task.status !== after_sales_timeout_entity_1.AfterSalesTimeoutStatus.PENDING) {
            core_2.Logger.info(`Task ${taskId} status=${task.status}, skipping`, constants_1.loggerCtx);
            return;
        }
        // SQL JobQueue（DefaultJobQueuePlugin）忽略 `delay` 选项，任务入队后可能立即执行。
        // 若未到 dueAt 则跳过执行，任务保持 PENDING，由补偿扫描任务在到期后重新入队。
        if (new Date() < task.dueAt) {
            core_2.Logger.debug(`Task ${taskId} not due until ${task.dueAt.toISOString()}, skipping (compensation will re-enqueue)`, constants_1.loggerCtx);
            return;
        }
        try {
            const ctx = await this.buildCtx(task.channelId);
            if (!ctx) {
                throw new Error(`Channel ${task.channelId} not found`);
            }
            const request = await this.requestRepo.findOne({ where: { id: task.requestId } });
            if (!request) {
                task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                core_2.Logger.warn(`AfterSalesRequest ${task.requestId} not found, task ${taskId} CANCELLED`, constants_1.loggerCtx);
                return;
            }
            // 状态不一致即作废：防止过期动作（如 Pending 已被人工处理/取消）
            if (request.state !== task.expectedState) {
                task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.CANCELLED;
                await this.taskRepo.save(task);
                core_2.Logger.info(`Request ${task.requestId} state=${request.state} no longer matches ${task.expectedState}, task ${taskId} CANCELLED`, constants_1.loggerCtx);
                return;
            }
            switch (task.type) {
                case after_sales_timeout_entity_1.AfterSalesTimeoutType.PENDING_REMIND:
                    await this.notifyMerchant(ctx, task, '售后处理超时提醒', `您有一笔售后申请（#${task.requestId}）已超过处理时限仍未处理，请尽快登录后台处理。`);
                    break;
                case after_sales_timeout_entity_1.AfterSalesTimeoutType.PENDING_AUTO_APPROVE:
                    await this.afterSalesService.approveRequest(ctx, task.requestId);
                    core_2.Logger.info(`Request ${task.requestId} auto-approved after timeout`, constants_1.loggerCtx);
                    break;
                case after_sales_timeout_entity_1.AfterSalesTimeoutType.REFUND_RETRY:
                    // 退款重试的终态/重排逻辑全部在 executeRefundRetry 内自行落库
                    await this.executeRefundRetry(ctx, task);
                    break;
                default:
                    throw new Error(`Unknown timeout type: ${task.type}`);
            }
            if (task.type === after_sales_timeout_entity_1.AfterSalesTimeoutType.REFUND_RETRY) {
                return; // 已自行落 EXECUTED/CANCELLED，或重排 dueAt 保持 PENDING
            }
            task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            task.lastError = null;
            await this.taskRepo.save(task);
            core_2.Logger.info(`Timeout ${task.type} for request ${task.requestId} executed (task ${taskId})`, constants_1.loggerCtx);
        }
        catch (e) {
            task.retryCount += 1;
            task.lastError = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
            if (task.retryCount >= MAX_RETRY) {
                task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.FAILED;
                core_2.Logger.error(`Task ${taskId} marked FAILED after ${task.retryCount} retries: ${task.lastError}`, constants_1.loggerCtx);
            }
            else {
                core_2.Logger.warn(`Task ${taskId} failed (retry ${task.retryCount}/${MAX_RETRY}): ${task.lastError}`, constants_1.loggerCtx);
            }
            await this.taskRepo.save(task);
            throw e;
        }
    }
    /**
     * RefundFailed 自动重试：调 retryRefund 复用退款核心；成功→EXECUTED；
     * 失败且未耗尽→指数退避重排（任务保持 PENDING）；耗尽→EXECUTED + 商家提醒。
     */
    async executeRefundRetry(ctx, task) {
        const markExhausted = async () => {
            task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            await this.taskRepo.save(task);
            await this.notifyMerchant(ctx, task, '退款自动重试耗尽', `售后单 #${task.requestId} 退款自动重试已达上限（${task.maxAttempt} 次）仍未成功，请人工处理。`);
            core_2.Logger.warn(`Refund auto-retry exhausted for request ${task.requestId} (task ${task.id})`, constants_1.loggerCtx);
        };
        // 防御：补偿扫描重复入队等场景下 attempt 已达上限则直接终态
        if (task.maxAttempt > 0 && task.attempt >= task.maxAttempt) {
            await markExhausted();
            return;
        }
        const request = await this.requestRepo.findOne({ where: { id: task.requestId } });
        if (!request) {
            task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.CANCELLED;
            task.lastError = `AfterSalesRequest ${task.requestId} not found`;
            await this.taskRepo.save(task);
            return;
        }
        if (request.type === 'exchange') {
            // 换货单不走退款链路（与 EXCHANGE_NO_REFUND 约束同源）
            task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.CANCELLED;
            await this.taskRepo.save(task);
            core_2.Logger.info(`Exchange request ${task.requestId} skips refund retry, task ${task.id} CANCELLED`, constants_1.loggerCtx);
            return;
        }
        const after = await this.afterSalesService.retryRefund(ctx, task.requestId);
        task.attempt += 1;
        if (after.state === 'Refunded') {
            task.status = after_sales_timeout_entity_1.AfterSalesTimeoutStatus.EXECUTED;
            task.executedAt = new Date();
            task.lastError = null;
            await this.taskRepo.save(task);
            core_2.Logger.info(`Refund retry succeeded for request ${task.requestId} (task ${task.id})`, constants_1.loggerCtx);
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
        await this.jobQueue.add({ taskId: String(task.id), requestId: task.requestId, channelId: task.channelId, type: task.type }, { delay: delayMs, retries: MAX_RETRY });
        core_2.Logger.info(`Refund retry ${task.attempt}/${task.maxAttempt} rescheduled for request ${task.requestId} due at ${task.dueAt.toISOString()}`, constants_1.loggerCtx);
    }
    /**
     * 商家侧站内信提醒：发布 AfterSalesMerchantNotifyEvent，由 notification-plugin 订阅落库。
     * 经 EventBus 解耦——本插件可独立使用（未装 notification-plugin 时事件无人订阅，仅无提醒）；
     * 发布失败仅告警，不影响任务状态落库。
     */
    async notifyMerchant(ctx, task, title, content) {
        var _a;
        try {
            this.eventBus.publish(new after_sales_events_1.AfterSalesMerchantNotifyEvent(ctx, task.requestId, title, content));
        }
        catch (e) {
            core_2.Logger.warn(`Merchant notify publish failed for request ${task.requestId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
        }
    }
    async buildCtx(channelId) {
        var _a;
        try {
            const channelService = this.injector.get(core_2.ChannelService);
            const emptyCtx = core_2.RequestContext.empty();
            const channel = await channelService.findOne(emptyCtx, channelId);
            if (!channel)
                return null;
            return new core_2.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
        }
        catch (e) {
            core_2.Logger.warn(`AfterSalesTimeoutJob buildCtx failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            return null;
        }
    }
    /** 登记超时任务：落库 + 入 delayed job（SQL JobQueue 忽略 delay 时由补偿扫描兜底） */
    async scheduleTimeout(type, requestId, channelId, delayMs, expectedState, maxAttempt = 0) {
        const dueAt = new Date(Date.now() + delayMs);
        const task = this.taskRepo.create({
            type,
            requestId,
            channelId,
            dueAt,
            status: after_sales_timeout_entity_1.AfterSalesTimeoutStatus.PENDING,
            expectedState,
            attempt: 0,
            maxAttempt,
            retryCount: 0,
        });
        const saved = await this.taskRepo.save(task);
        // BullMQ backend persists `delay` option; default SQL strategy ignores it.
        // Reliability is guaranteed by the compensation ScheduledTask scanning `dueAt`.
        await this.jobQueue.add({ taskId: String(saved.id), requestId, channelId, type }, { delay: delayMs, retries: MAX_RETRY });
        core_2.Logger.info(`Scheduled ${type} timeout for after-sales request ${requestId} due at ${dueAt.toISOString()}`, constants_1.loggerCtx);
    }
    /**
     * 补偿扫描：捡起 dueAt 已过但未执行的 PENDING 任务重新入队
     * （进程重启 / SQL JobQueue 忽略 delay / Pod 漂移兜底），由标准 handler 带完整状态校验执行。
     */
    async runCompensation() {
        const now = new Date();
        const overdue = await this.taskRepo.find({ where: { status: after_sales_timeout_entity_1.AfterSalesTimeoutStatus.PENDING } });
        let requeued = 0;
        for (const task of overdue) {
            if (task.dueAt > now || task.retryCount >= MAX_RETRY)
                continue;
            await this.jobQueue.add({ taskId: String(task.id), requestId: task.requestId, channelId: task.channelId, type: task.type }, { retries: MAX_RETRY });
            requeued++;
        }
        if (requeued > 0) {
            core_2.Logger.info(`After-sales timeout compensation re-enqueued ${requeued} overdue task(s)`, constants_1.loggerCtx);
        }
    }
};
exports.AfterSalesTimeoutJob = AfterSalesTimeoutJob;
exports.AfterSalesTimeoutJob = AfterSalesTimeoutJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_2.JobQueueService,
        core_2.TransactionalConnection,
        core_1.ModuleRef,
        after_sales_service_1.AfterSalesService])
], AfterSalesTimeoutJob);
//# sourceMappingURL=after-sales-timeout.job.js.map