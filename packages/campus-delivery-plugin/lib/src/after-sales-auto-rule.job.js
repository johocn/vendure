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
exports.AfterSalesAutoRuleJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const merchant_admin_service_1 = require("./merchant-admin.service");
const periodic_fallback_1 = require("./periodic-fallback");
const loggerCtx = 'CampusAfterSalesAutoRule';
/** 启动后首跑延迟：等迁移补分流规则表与订单数据稳定 */
const BOOT_DELAY_MS = 90000;
/** 扫描周期：2 分钟，新售后单尽快按规则分流 */
const INTERVAL_MS = 2 * 60000;
/**
 * 售后自动分流（§98）：按渠道执行 campus_after_sales_auto_rule，
 * 命中规则的待处理售后单自动同意 / 驳回 / 转平台仲裁。
 * - 只处理近 7 日未分流过的 Pending 单（服务层写 autoRuleAppliedAt 防重复）。
 * - 渠道级咨询锁：多实例部署同一渠道只有一个进程执行，避免重复退款。
 */
let AfterSalesAutoRuleJob = class AfterSalesAutoRuleJob {
    constructor(connection, merchant) {
        this.connection = connection;
        this.merchant = merchant;
        this.fallback = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'after-sales-auto-rule',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => this.run());
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
            channels = await this.connection.rawConnection.getRepository(core_1.Channel).find();
        }
        catch (e) {
            core_1.Logger.warn(`query channels failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                await this.runChannelWithLock(channel);
            }
            catch (e) {
                core_1.Logger.warn(`auto rule failed for channel ${channel.code}: ${String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e)}`, loggerCtx);
            }
        }
    }
    async runChannelWithLock(channel) {
        var _a;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:asrule:${channel.id}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                const ctx = new core_1.RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                const applied = await this.merchant.applyAfterSalesAutoRules(ctx);
                if (applied > 0) {
                    core_1.Logger.info(`auto-ruled ${applied} request(s) for channel ${channel.code}`, loggerCtx);
                }
            }
            finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        }
        finally {
            await runner.release();
        }
    }
};
exports.AfterSalesAutoRuleJob = AfterSalesAutoRuleJob;
exports.AfterSalesAutoRuleJob = AfterSalesAutoRuleJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, merchant_admin_service_1.MerchantAdminService])
], AfterSalesAutoRuleJob);
//# sourceMappingURL=after-sales-auto-rule.job.js.map