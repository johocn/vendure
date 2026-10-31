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
exports.AfterSalesAnomalyAlertJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_time_1 = require("./campus-time");
const feishu_client_1 = require("./feishu/feishu.client");
const periodic_fallback_1 = require("./periodic-fallback");
const loggerCtx = 'CampusAfterSalesAlert';
/** 启动后首跑延迟：等迁移补 Channel 自定义字段与 DB 连接稳定 */
const BOOT_DELAY_MS = 60000;
/** 检查周期：30 分钟，异常恢复或指标累积后下一轮可再次判断 */
const INTERVAL_MS = 30 * 60000;
/** 统计窗口：近 7 个校园日（含今日） */
const WINDOW_DAYS = 7;
const DAY_MS = 24 * 3600000;
/**
 * 售后异常预警推送（§96）：店铺开启后，近 7 日退款率或超时待处理数超过渠道阈值时，
 * 向店铺群推送一条预警（同一天最多一条，由 waimaiAfterSalesAlertLastDay 幂等）。
 * - 退款率口径：近 7 日新建售后单中 Refunded 的单数 / 近 7 日下单量。
 * - 超时口径：当前 Pending 且超过渠道处理时限（已暂停 SLA 的单不计），与工作台一致。
 * - 渠道间用咨询锁隔离，多实例部署不重复推送。
 */
let AfterSalesAnomalyAlertJob = class AfterSalesAnomalyAlertJob {
    constructor(connection, feishu) {
        this.connection = connection;
        this.feishu = feishu;
        this.fallback = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'after-sales-anomaly-alert',
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
        if (!this.feishu.enabled)
            return;
        let channels;
        try {
            channels = await this.connection.rawConnection
                .getRepository(core_1.Channel)
                .createQueryBuilder('channel')
                .where('channel.customFields.waimaiAfterSalesAlertEnabled = :on', { on: true })
                .getMany();
        }
        catch (e) {
            core_1.Logger.warn(`query alert channels failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                await this.runChannelWithLock(Number(channel.id));
            }
            catch (e) {
                core_1.Logger.warn(`alert check failed for channel ${channel.code}: ${String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e)}`, loggerCtx);
            }
        }
    }
    async runChannelWithLock(channelId) {
        var _a;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:asalert:${channelId}`;
        try {
            const got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.ok))
                return;
            try {
                await this.runChannel(channelId);
            }
            finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        }
        finally {
            await runner.release();
        }
    }
    async runChannel(channelId) {
        var _a, _b, _c;
        const repo = this.connection.rawConnection.getRepository(core_1.Channel);
        const channel = await repo.findOne({ where: { id: channelId } });
        if (!channel)
            return;
        const cf = ((_a = channel.customFields) !== null && _a !== void 0 ? _a : {});
        if (!cf.waimaiAfterSalesAlertEnabled)
            return;
        const rateThreshold = Math.max(0, Math.floor(Number((_b = cf.waimaiAfterSalesAlertRefundRate) !== null && _b !== void 0 ? _b : 0) || 0));
        const overdueThreshold = Math.max(0, Math.floor(Number((_c = cf.waimaiAfterSalesAlertOverdueCount) !== null && _c !== void 0 ? _c : 0) || 0));
        if (rateThreshold <= 0 && overdueThreshold <= 0)
            return;
        const now = Date.now();
        const todayKey = (0, campus_time_1.campusDayKey)(now);
        // 幂等键按「预警日」记：同一天只推一条
        if (cf.waimaiAfterSalesAlertLastDay === todayKey)
            return;
        const metrics = await this.collect(channel, now);
        const rateHit = rateThreshold > 0 && metrics.refundRate >= rateThreshold;
        const overdueHit = overdueThreshold > 0 && metrics.overdue >= overdueThreshold;
        if (!rateHit && !overdueHit)
            return;
        const text = this.renderText(channel.code, metrics, rateThreshold, overdueThreshold);
        const ok = await this.feishu.broadcast(text, { channel: channel.code });
        if (!ok) {
            core_1.Logger.warn(`alert not delivered (channel ${channel.code}), retry next round`, loggerCtx);
            return;
        }
        const fresh = await repo.findOne({ where: { id: channelId } });
        if (fresh) {
            fresh.customFields.waimaiAfterSalesAlertLastDay = todayKey;
            await repo.save(fresh);
        }
        core_1.Logger.info(`alert pushed for channel ${channel.code} (refundRate=${metrics.refundRate}%, overdue=${metrics.overdue})`, loggerCtx);
    }
    /** 近 7 日售后指标：下单量 / 退款单数 / 退款率 / 超时待处理 */
    async collect(channel, now) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const raw = this.connection.rawConnection;
        const channelId = Number(channel.id);
        const since = new Date((0, campus_time_1.startOfCampusDay)(now) - (WINDOW_DAYS - 1) * DAY_MS);
        const scope = 'EXISTS (SELECT 1 FROM order_channels_channel oc WHERE oc."orderId" = o.id AND oc."channelId" = $1)';
        const orderRows = await raw.query(`SELECT COUNT(*)::int AS n FROM "order" o
              WHERE o."createdAt" >= $2 AND o."customFieldsHallstatus" IS NOT NULL AND ${scope}`, [channelId, since]);
        const refundRows = await raw.query(`SELECT COUNT(*)::int AS n FROM after_sales_request a
               JOIN "order" o ON o.id = a."orderId"
              WHERE a."createdAt" >= $2 AND a.state = 'Refunded' AND ${scope}`, [channelId, since]);
        const timeoutHours = this.timeoutHours(channel);
        const overdueRows = await raw.query(`SELECT COUNT(*)::int AS n FROM after_sales_request a
               JOIN "order" o ON o.id = a."orderId"
              WHERE a.state = 'Pending' AND a."slaPausedAt" IS NULL
                AND a."createdAt" + make_interval(hours => $2)
                    + (COALESCE(a."slaPausedMs", 0) / 1000) * interval '1 second' <= now()
                AND ${scope}`, [channelId, timeoutHours]);
        const orders = Number((_c = (_b = (_a = this.rows(orderRows)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.n) !== null && _c !== void 0 ? _c : 0) || 0;
        const refunded = Number((_f = (_e = (_d = this.rows(refundRows)) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.n) !== null && _f !== void 0 ? _f : 0) || 0;
        const overdue = Number((_j = (_h = (_g = this.rows(overdueRows)) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.n) !== null && _j !== void 0 ? _j : 0) || 0;
        const refundRate = orders > 0 ? Math.round((refunded / orders) * 10000) / 100 : 0;
        return { orders, refunded, refundRate, overdue };
    }
    /** 渠道处理时限（小时）：afterSalesTimeoutHours，未配置按 48 */
    timeoutHours(channel) {
        var _a, _b;
        const n = Number((_b = ((_a = channel.customFields) !== null && _a !== void 0 ? _a : {}).afterSalesTimeoutHours) !== null && _b !== void 0 ? _b : 48);
        return Number.isFinite(n) && n >= 0 ? n : 48;
    }
    /** 文本预警：只展示已开启阈值的指标，金额/百分比按校园口径 */
    renderText(code, m, rateThreshold, overdueThreshold) {
        const lines = [`【${code}】售后异常预警（近 ${WINDOW_DAYS} 日）`];
        if (rateThreshold > 0) {
            lines.push(`退款率：${m.refundRate}%（${m.refunded}/${m.orders} 单，阈值 ${rateThreshold}%）`);
        }
        if (overdueThreshold > 0) {
            lines.push(`超时待处理：${m.overdue} 单（阈值 ${overdueThreshold} 单）`);
        }
        lines.push('请尽快处理售后待办，避免顾客投诉升级；可调整售后规则或处理时限降低风险。');
        return lines.join('\n');
    }
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    rows(result) {
        if (!Array.isArray(result))
            return [];
        return Array.isArray(result[0]) ? result[0] : result;
    }
};
exports.AfterSalesAnomalyAlertJob = AfterSalesAnomalyAlertJob;
exports.AfterSalesAnomalyAlertJob = AfterSalesAnomalyAlertJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, feishu_client_1.FeishuClient])
], AfterSalesAnomalyAlertJob);
//# sourceMappingURL=after-sales-anomaly-alert.job.js.map