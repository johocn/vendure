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
exports.AutoAcceptJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_config_service_1 = require("./campus-config.service");
const business_hours_1 = require("./business-hours");
const auto_accept_1 = require("./auto-accept");
const merchant_admin_service_1 = require("./merchant-admin.service");
const loggerCtx = 'CampusAutoAccept';
/** 启动后首跑延迟：等迁移补列（p13）与 DB 连接稳定 */
const BOOT_DELAY_MS = 45000;
/** 检查周期：15s，保证「延迟秒数」配置的落地精度 */
const INTERVAL_MS = 15000;
/** 单渠道单轮上限：积压时按 id 升序先处理最老的单 */
const SCAN_LIMIT = 50;
/**
 * 商家自动接单（§69）：营业中且未临时休息的店铺，待接单订单超过「延迟秒数」后自动确认，
 * 与手动接单同一条状态机（条件写防并发 + 用户通知 + 接单即出票）。
 * 每日自动接单达到上限后新单退回人工接单；休息中/非营业时段不自动接（避免无人出餐）。
 * 店铺可在经营设置关闭；渠道间用咨询锁隔离，多实例部署幂等。
 */
let AutoAcceptJob = class AutoAcceptJob {
    constructor(connection, config, merchant) {
        this.connection = connection;
        this.config = config;
        this.merchant = merchant;
        this.timer = null;
        this.bootTimer = null;
        this.running = false;
    }
    start() {
        if (this.timer)
            return;
        const tick = () => {
            if (this.running)
                return;
            this.running = true;
            this.run()
                .catch(e => { var _a; return core_1.Logger.warn(`auto accept tick failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx); })
                .finally(() => {
                this.running = false;
            });
        };
        this.bootTimer = setTimeout(tick, BOOT_DELAY_MS);
        this.timer = setInterval(tick, INTERVAL_MS);
    }
    stop() {
        if (this.bootTimer)
            clearTimeout(this.bootTimer);
        if (this.timer)
            clearInterval(this.timer);
        this.bootTimer = null;
        this.timer = null;
    }
    onApplicationShutdown() {
        this.stop();
    }
    /** 扫描全部渠道（仅启用了自动接单的渠道有额外开销） */
    async run() {
        const rows = await this.connection.rawConnection.query('SELECT "channelId" FROM campus_fulfillment_config WHERE "autoacceptenabled" = true');
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        for (const r of Array.isArray(list) ? list : []) {
            const channelId = Number(r.channelId);
            if (!channelId)
                continue;
            await this.runChannelWithLock(channelId);
        }
    }
    async runChannelWithLock(channelId) {
        var _a;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:autoaccept:${channelId}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                await this.runChannel(channelId);
            }
            catch (e) {
                core_1.Logger.error(`auto accept failed for channel ${channelId}: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
            }
        }
        finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            }
            catch (_b) {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }
    async runChannel(channelId) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const channel = (_a = (await this.connection.rawConnection.getRepository(core_1.Channel).findOne({
            where: { id: channelId },
            relations: ['defaultTaxZone'],
        }))) !== null && _a !== void 0 ? _a : new core_1.Channel({ id: channelId });
        const ctx = new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const cfg = await this.config.getConfig(ctx);
        if (!cfg.autoAcceptEnabled)
            return;
        // 营业时段外 / 临时休息：不自动接单（无人出餐风险），订单保持待接单等人工处理
        const hours = (_c = ((_b = channel.customFields) !== null && _b !== void 0 ? _b : {}).waimaiBusinessHours) !== null && _c !== void 0 ? _c : null;
        const openNow = (0, business_hours_1.isWithinBusinessHours)(hours) && !cfg.paused;
        if (!openNow)
            return;
        const delaySeconds = Number((_d = cfg.autoAcceptDelaySeconds) !== null && _d !== void 0 ? _d : 0);
        const routes = (0, auto_accept_1.normalizeAutoAcceptRoutes)(cfg.autoAcceptRoutes);
        const dailyLimit = Number((_e = cfg.autoAcceptDailyLimit) !== null && _e !== void 0 ? _e : 0);
        let acceptedToday = await this.merchant.countAutoAcceptedToday(channelId);
        if (dailyLimit > 0 && acceptedToday >= dailyLimit)
            return;
        const rows = await this.connection.rawConnection.query('SELECT o.id, o.code, o."createdAt", o."customFieldsHallenteredat" AS "enteredAt", '
            + 'o."customFieldsFulfillmentroute" AS route '
            + 'FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id AND oc."channelId" = $1 '
            + 'WHERE o."customFieldsHallstatus" = \'pending_merchant\' AND o.state <> \'Cancelled\' '
            + 'ORDER BY o.id ASC LIMIT $2', [channelId, SCAN_LIMIT]);
        const list = (_f = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows)) !== null && _f !== void 0 ? _f : [];
        const now = Date.now();
        for (const row of list) {
            const entered = (_g = row.enteredAt) !== null && _g !== void 0 ? _g : row.createdAt;
            const enteredAt = new Date(entered).getTime();
            const due = (0, auto_accept_1.isAutoAcceptDue)({
                enabled: true,
                openNow,
                elapsedMs: Number.isFinite(enteredAt) ? now - enteredAt : 0,
                delaySeconds,
                route: String((_h = row.route) !== null && _h !== void 0 ? _h : ''),
                routes,
                acceptedToday,
                dailyLimit,
            });
            if (!due)
                continue;
            const moved = await this.merchant.transitionToAccepted(ctx, row.id, 'auto');
            if (!moved)
                continue; // 期间已被人工接单/取消/兜底转出
            acceptedToday += 1;
            core_1.Logger.info(`Order ${row.code} auto-accepted after ${delaySeconds}s (channel ${channelId})`, loggerCtx);
            if (dailyLimit > 0 && acceptedToday >= dailyLimit)
                break;
        }
    }
};
exports.AutoAcceptJob = AutoAcceptJob;
exports.AutoAcceptJob = AutoAcceptJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        campus_config_service_1.CampusConfigService,
        merchant_admin_service_1.MerchantAdminService])
], AutoAcceptJob);
//# sourceMappingURL=auto-accept.job.js.map