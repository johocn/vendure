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
exports.AfterSalesAutoAssignJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const advisory_lock_1 = require("./advisory-lock");
const merchant_admin_service_1 = require("./merchant-admin.service");
const periodic_fallback_1 = require("./periodic-fallback");
const loggerCtx = 'CampusAfterSalesAutoAssign';
/** 启动后首跑延迟：等迁移补 Channel 自定义字段与 DB 连接稳定 */
const BOOT_DELAY_MS = 120000;
/** 扫描周期：5 分钟，新售后单尽快落到处理人名下 */
const INTERVAL_MS = 5 * 60000;
/**
 * 售后自动分配（§96）：扫描开启自动分配的渠道，把未指派的未完结售后单
 * 派给当前未完结量最少的本店管理员（具体规则见 MerchantAdminService.afterSalesAutoAssign）。
 * - 分配给谁由服务层保证：同一单只会落一个处理人（指派表按 requestId 唯一）。
 * - 单个渠道失败只告警，不影响其他渠道。
 */
let AfterSalesAutoAssignJob = class AfterSalesAutoAssignJob {
    constructor(connection, merchant) {
        this.connection = connection;
        this.merchant = merchant;
        this.fallback = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'after-sales-auto-assign',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => 
        // 多实例互斥：拿不到锁说明其他实例正在分配，本轮直接跳过（避免重复指派历史/值班预警推送）
        (0, advisory_lock_1.withAdvisoryLock)(this.connection, 'campus:after-sales-auto-assign', () => this.run()));
    }
    stop() {
        var _a;
        (_a = this.fallback) === null || _a === void 0 ? void 0 : _a.stop();
        this.fallback = null;
    }
    onApplicationShutdown() {
        this.stop();
    }
    async run() {
        var _a, _b;
        let channels;
        try {
            channels = await this.connection.rawConnection
                .getRepository(core_1.Channel)
                .createQueryBuilder('channel')
                .where('channel.customFields.waimaiAfterSalesAutoAssignEnabled = :on', { on: true })
                .getMany();
        }
        catch (e) {
            // 列缺失（迁移未跑完）时本轮跳过
            core_1.Logger.warn(`query auto-assign channels failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                const ctx = new core_1.RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                const assigned = await this.merchant.afterSalesAutoAssign(ctx);
                if (assigned > 0) {
                    core_1.Logger.info(`auto-assigned ${assigned} request(s) for channel ${channel.code}`, loggerCtx);
                }
            }
            catch (e) {
                core_1.Logger.warn(`auto-assign failed for channel ${channel.code}: ${String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e)}`, loggerCtx);
            }
        }
    }
};
exports.AfterSalesAutoAssignJob = AfterSalesAutoAssignJob;
exports.AfterSalesAutoAssignJob = AfterSalesAutoAssignJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, merchant_admin_service_1.MerchantAdminService])
], AfterSalesAutoAssignJob);
//# sourceMappingURL=after-sales-auto-assign.job.js.map