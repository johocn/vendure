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
exports.CompensationRetryJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const campus_notify_service_1 = require("./campus-notify.service");
const compensation_task_service_1 = require("./compensation-task.service");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const periodic_fallback_1 = require("./periodic-fallback");
const MAX_ATTEMPTS = 5;
/** 第 1/2/3/4 次失败后的退避（分钟）：1 → 5 → 15 → 60；第 5 次耗尽转 failed */
const BACKOFF_MINUTES = [1, 5, 15, 60];
/**
 * R2 补偿任务重试（每 1 分钟）：券补发 / 站内信补发。
 * 多实例安全：先按 `attempts` 条件认领，只有认领成功的实例执行；
 * 重试耗尽只告警一次（dedupeKey=compensation_exhausted:<任务键>）。
 */
let CompensationRetryJob = class CompensationRetryJob {
    constructor(tasks, notify, feishu, requestContextService, moduleRef) {
        this.tasks = tasks;
        this.notify = notify;
        this.feishu = feishu;
        this.requestContextService = requestContextService;
        this.moduleRef = moduleRef;
        this.fallback = null;
        /** 可选：直接指定补偿券执行器（单测/裁剪部署用；生产为 null 走动态解析）。
         *  注意不能作为构造参数：接口类型在运行时为 Object，Nest 会尝试注入并启动失败。 */
        this.couponOverride = null;
    }
    start(intervalMs = 60000) {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({ name: 'compensation-retry', intervalMs, loggerCtx: 'CampusCompensation' });
        this.fallback.start(async () => {
            await this.runOnce();
        });
    }
    onApplicationShutdown() {
        var _a;
        (_a = this.fallback) === null || _a === void 0 ? void 0 : _a.stop();
        this.fallback = null;
    }
    /** 处理一批到期任务（运维/单测可直接调用） */
    async runOnce(limit = 20) {
        var _a;
        const due = await this.tasks.due(limit);
        let done = 0;
        let retried = 0;
        let failed = 0;
        for (const task of due) {
            if (!(await this.tasks.claim(task.id, task.attempts)))
                continue;
            const attempts = task.attempts + 1;
            try {
                await this.execute(task);
                await this.tasks.markDone(task.id);
                done++;
            }
            catch (e) {
                const message = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
                const exhausted = attempts >= MAX_ATTEMPTS;
                const next = exhausted ? null : new Date(Date.now() + this.backoffMinutes(attempts) * 60000);
                await this.tasks.markFailed(task.id, exhausted, message, next);
                if (exhausted) {
                    failed++;
                    common_1.Logger.error(`补偿任务耗尽（${task.dedupeKey}）：${message}`, 'CampusCompensation');
                    void this.feishu.pushEvent('alert', '补偿任务重试耗尽', `${task.kind === 'coupon' ? '补偿券' : '站内信'}补发失败（订单 ${task.orderId}），已重试 ${attempts} 次，请人工处理。原因：${message}`, undefined, `compensation_exhausted:${task.dedupeKey}`);
                }
                else {
                    retried++;
                    common_1.Logger.warn(`补偿任务重试 ${attempts}/${MAX_ATTEMPTS}（${task.dedupeKey}）：${message}`, 'CampusCompensation');
                }
            }
        }
        return { done, retried, failed };
    }
    backoffMinutes(attempts) {
        return BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
    }
    async execute(task) {
        var _a, _b;
        const payload = this.parsePayload(task);
        if (task.kind === 'coupon') {
            const svc = this.couponService();
            if (!svc)
                throw new Error('coupon-plugin 未启用');
            if (task.customerId == null)
                throw new Error('缺少 customerId');
            const templateId = String((_a = payload.templateId) !== null && _a !== void 0 ? _a : '');
            if (!templateId)
                throw new Error('缺少 templateId');
            const pc = await this.platformCtx();
            await svc.grantCoupon(pc, templateId, [task.customerId]);
            return;
        }
        // notify：幂等键在 message 落库前由站内信自身保证；这里只重放写入
        await this.notify.retryInApp(task.orderId, task.channelId, String((_b = payload.event) !== null && _b !== void 0 ? _b : ''), payload.text == null ? undefined : String(payload.text));
    }
    parsePayload(task) {
        try {
            return task.payload ? JSON.parse(task.payload) : {};
        }
        catch (_a) {
            return {};
        }
    }
    async platformCtx() {
        return this.requestContextService.create({ apiType: 'admin' });
    }
    injector() {
        return new core_2.Injector(this.moduleRef);
    }
    /** coupon-plugin 为可选依赖：优先用注入的执行器，否则动态 require + Injector 解析 */
    couponService() {
        var _a;
        if (this.couponOverride)
            return this.couponOverride;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('@vendure/coupon-plugin');
            if (mod === null || mod === void 0 ? void 0 : mod.CouponService)
                return (_a = this.injector().get(mod.CouponService)) !== null && _a !== void 0 ? _a : null;
        }
        catch (_b) {
            // coupon-plugin 未安装或未启用
        }
        return null;
    }
};
exports.CompensationRetryJob = CompensationRetryJob;
exports.CompensationRetryJob = CompensationRetryJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [compensation_task_service_1.CompensationTaskService,
        campus_notify_service_1.CampusNotifyService,
        feishu_notify_service_1.FeishuNotifyService,
        core_2.RequestContextService,
        core_1.ModuleRef])
], CompensationRetryJob);
//# sourceMappingURL=compensation-retry.job.js.map