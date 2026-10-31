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
exports.AfterSalesMonthlyPushJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_time_1 = require("./campus-time");
const feishu_client_1 = require("./feishu/feishu.client");
const periodic_fallback_1 = require("./periodic-fallback");
const loggerCtx = 'CampusAfterSalesMonthly';
/** 启动后首跑延迟：等迁移补 Channel 自定义字段与 DB 连接稳定 */
const BOOT_DELAY_MS = 60000;
/** 检查周期：30 分钟；月报只在跨过设定时刻的那一轮推一次 */
const INTERVAL_MS = 30 * 60000;
/** 默认推送时间 21:30 / 每月 1 日 */
const DEFAULT_TIME = '21:30';
const DEFAULT_DAY = 1;
/**
 * 售后月度摘要推送（§95）：店铺开启后，每月指定日（默认 1 日）到设定时间，
 * 把「上一个自然月」的售后汇总推到店铺群（feishu broadcast，channel=店铺 code）。
 * - 口径：按校园时区（UTC+8）自然月切分；新建单按 createdAt，退款按 refundedAt。
 * - 幂等：Channel.waimaiAfterSalesMonthlyPushLastMonth 记已推送月份；同月只推一条，改设置不会重复推。
 * - 漏推补发：当天错过后，只要月份未推送且已过设定日/时刻，下一轮自动补推。
 * - 渠道间用咨询锁隔离，多实例部署不重复推送。
 */
let AfterSalesMonthlyPushJob = class AfterSalesMonthlyPushJob {
    constructor(connection, feishu) {
        this.connection = connection;
        this.feishu = feishu;
        this.fallback = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'after-sales-monthly-push',
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
    /** 扫描全部启用了售后月报推送的渠道（未配置飞书发送能力时整体跳过） */
    async run() {
        if (!this.feishu.enabled)
            return;
        const channels = await this.connection.rawConnection
            .getRepository(core_1.Channel)
            .createQueryBuilder('channel')
            .where('channel.customFields.waimaiAfterSalesMonthlyPushEnabled = :on', { on: true })
            .getMany();
        for (const channel of channels) {
            try {
                await this.runChannelWithLock(Number(channel.id));
            }
            catch (e) {
                core_1.Logger.error(`after-sales monthly push failed for channel ${channel.id}: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
            }
        }
    }
    async runChannelWithLock(channelId) {
        var _a;
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:asmonthly:${channelId}`;
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
        var _a, _b;
        const repo = this.connection.rawConnection.getRepository(core_1.Channel);
        const channel = await repo.findOne({ where: { id: channelId } });
        if (!channel)
            return;
        const cf = ((_a = channel.customFields) !== null && _a !== void 0 ? _a : {});
        if (!cf.waimaiAfterSalesMonthlyPushEnabled)
            return;
        const now = Date.now();
        const todayStart = (0, campus_time_1.startOfCampusDay)(now);
        const day = Math.min(28, Math.max(1, Math.floor(Number((_b = cf.waimaiAfterSalesMonthlyPushDay) !== null && _b !== void 0 ? _b : DEFAULT_DAY)) || DEFAULT_DAY));
        // 校园时区当日序号（1-31）
        const dayOfMonth = Number((0, campus_time_1.campusDayKey)(now).slice(8, 10));
        if (!Number.isFinite(dayOfMonth) || dayOfMonth < day)
            return;
        const pushTime = this.normalizeTime(cf.waimaiAfterSalesMonthlyPushTime);
        if (now < todayStart + this.minutesOf(pushTime) * 60000)
            return;
        const curStart = this.campusMonthStart(now);
        const prevStart = this.campusMonthStart(curStart - 1);
        const prevMonthKey = (0, campus_time_1.campusDayKey)(prevStart).slice(0, 7);
        // 幂等键按上月记：同一个月只推一条
        if (cf.waimaiAfterSalesMonthlyPushLastMonth === prevMonthKey)
            return;
        const report = await this.buildReport(channelId, prevStart, curStart);
        const text = this.renderText(channel.code, report);
        const ok = await this.feishu.broadcast(text, { channel: channel.code });
        if (!ok) {
            core_1.Logger.warn(`after-sales monthly report not delivered (channel ${channel.code}), retry next round`, loggerCtx);
            return;
        }
        const fresh = await repo.findOne({ where: { id: channelId } });
        if (fresh) {
            fresh.customFields.waimaiAfterSalesMonthlyPushLastMonth = prevMonthKey;
            await repo.save(fresh);
        }
        core_1.Logger.info(`after-sales monthly report pushed for channel ${channel.code} (${report.monthKey})`, loggerCtx);
    }
    /** 上月售后汇总：新建单 / 退款 / 超时待处理 / 满意度（满意度表缺失时降级为 0） */
    async buildReport(channelId, start, end) {
        var _a, _b, _c, _d, _e;
        const raw = this.connection.rawConnection;
        const scope = 'EXISTS (SELECT 1 FROM "order" o JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'AND oc."channelId" = $1 WHERE o.id = a."orderId")';
        const monthKey = (0, campus_time_1.campusDayKey)(start).slice(0, 7);
        const createdRows = await raw.query(`SELECT COUNT(*)::int AS n FROM after_sales_request a
              WHERE a."createdAt" >= $2 AND a."createdAt" < $3 AND ${scope}`, [channelId, new Date(start), new Date(end)]);
        const refundRows = await raw.query(`SELECT COUNT(*)::int AS n,
                    COALESCE(SUM(COALESCE(a."actualRefundAmount", a."refundAmount")), 0)::int AS amount
               FROM after_sales_request a
              WHERE a.state = 'Refunded' AND a."refundedAt" >= $2 AND a."refundedAt" < $3 AND ${scope}`, [channelId, new Date(start), new Date(end)]);
        const timeoutHours = await this.timeoutHours(channelId);
        const overdueRows = await raw.query(`SELECT COUNT(*)::int AS n FROM after_sales_request a
              WHERE a.state = 'Pending' AND a."createdAt" >= $2 AND a."createdAt" < $3
                AND a."slaPausedAt" IS NULL
                AND a."createdAt" + make_interval(hours => $4)
                    + (COALESCE(a."slaPausedMs", 0) / 1000) * interval '1 second' <= now()
                AND ${scope}`, [channelId, new Date(start), new Date(end), timeoutHours]);
        let reviewTotal = 0;
        let avgScore = 0;
        let lowScoreCount = 0;
        try {
            const reviewRows = await raw.query(`SELECT COUNT(*)::int AS total, COALESCE(AVG(score), 0) AS avg,
                        COUNT(*) FILTER (WHERE score <= 2)::int AS low
                   FROM campus_after_sales_review
                  WHERE "channelId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`, [channelId, new Date(start), new Date(end)]);
            const agg = (_a = this.rows(reviewRows)[0]) !== null && _a !== void 0 ? _a : {};
            reviewTotal = Number(agg.total) || 0;
            avgScore = reviewTotal ? Math.round(Number(agg.avg) * 10) / 10 : 0;
            lowScoreCount = Number(agg.low) || 0;
        }
        catch (_f) {
            // 满意度表缺失（迁移未跑完）时按无评分处理
        }
        return {
            monthKey,
            created: Number((_b = this.rows(createdRows)[0]) === null || _b === void 0 ? void 0 : _b.n) || 0,
            refunded: Number((_c = this.rows(refundRows)[0]) === null || _c === void 0 ? void 0 : _c.n) || 0,
            refundAmount: Number((_d = this.rows(refundRows)[0]) === null || _d === void 0 ? void 0 : _d.amount) || 0,
            overdue: Number((_e = this.rows(overdueRows)[0]) === null || _e === void 0 ? void 0 : _e.n) || 0,
            reviewTotal,
            avgScore,
            lowScoreCount,
        };
    }
    /** 渠道售后处理时限（小时，与商家端同口径：customFields.afterSalesTimeoutHours，默认 48） */
    async timeoutHours(channelId) {
        var _a, _b;
        const channel = await this.connection.rawConnection
            .getRepository(core_1.Channel)
            .findOne({ where: { id: channelId } });
        const n = Number((_b = ((_a = channel === null || channel === void 0 ? void 0 : channel.customFields) !== null && _a !== void 0 ? _a : {}).afterSalesTimeoutHours) !== null && _b !== void 0 ? _b : 48);
        return Number.isFinite(n) && n >= 0 ? n : 48;
    }
    /** 文本月报：金额分转元；无数据的行整行省略，避免「—」噪声 */
    renderText(code, r) {
        const yuan = (cents) => `¥${(cents / 100).toFixed(2)}`;
        const lines = [
            `【${code}】${r.monthKey} 售后月报`,
            `新建售后单：${r.created} 单`,
            `退款完成：${r.refunded} 单，${yuan(r.refundAmount)}`,
        ];
        if (r.overdue)
            lines.push(`超时未处理：${r.overdue} 单`);
        if (r.reviewTotal) {
            lines.push(`满意度：${r.avgScore} 分（${r.reviewTotal} 条评价${r.lowScoreCount ? `，低分 ${r.lowScoreCount} 条` : ''}）`);
        }
        if (!r.created)
            lines.push('上月无售后申请。');
        return lines.join('\n');
    }
    /** 校园时区（UTC+8）自然月起点的毫秒时间戳 */
    campusMonthStart(ms) {
        const shifted = ms + 8 * 3600000;
        const d = new Date(shifted);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 8 * 3600000;
    }
    /** 'HH:MM' 归一；为空/非法按 21:30（写入口已校验，这里只做兜底） */
    normalizeTime(v) {
        const s = String(v !== null && v !== void 0 ? v : '').trim();
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : DEFAULT_TIME;
    }
    minutesOf(v) {
        const [h, m] = v.split(':').map(Number);
        return h * 60 + m;
    }
    /** 兼容不同驱动的返回结构：部分驱动把结果再包一层数组 */
    rows(result) {
        if (!Array.isArray(result))
            return [];
        return Array.isArray(result[0]) ? result[0] : result;
    }
};
exports.AfterSalesMonthlyPushJob = AfterSalesMonthlyPushJob;
exports.AfterSalesMonthlyPushJob = AfterSalesMonthlyPushJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        feishu_client_1.FeishuClient])
], AfterSalesMonthlyPushJob);
//# sourceMappingURL=after-sales-monthly-push.job.js.map