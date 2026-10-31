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
exports.CapacityAlertJob = void 0;
exports.readCapacityAlertSettings = readCapacityAlertSettings;
exports.capacityOpsLink = capacityOpsLink;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_dedupe_service_1 = require("./campus-dedupe.service");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const periodic_fallback_1 = require("./periodic-fallback");
/** 级别状态保留 24h（需跨冷却窗口，才能识别后续升级/恢复；冷却本身另外计时） */
const SEVERITY_TTL_MS = 24 * 3600000;
function num(env, key, def, min = 0) {
    const raw = env[key];
    if (raw == null || String(raw).trim() === '')
        return def;
    const v = Number(raw);
    return Number.isFinite(v) && v >= min ? v : def;
}
function flag(env, key, def) {
    var _a;
    const raw = String((_a = env[key]) !== null && _a !== void 0 ? _a : '').trim().toLowerCase();
    if (!raw)
        return def;
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
function readCapacityAlertSettings(env = process.env) {
    var _a;
    return {
        enabled: flag(env, 'CAPACITY_ALERT_ENABLED', true),
        intervalMs: Math.max(60000, num(env, 'CAPACITY_ALERT_INTERVAL_MIN', 5, 1) * 60000),
        bootDelayMs: num(env, 'CAPACITY_ALERT_BOOT_DELAY_SEC', 60, 0) * 1000,
        cooldownMs: num(env, 'CAPACITY_ALERT_COOLDOWN_MIN', 30, 0) * 60000,
        noRiderBacklog: num(env, 'CAPACITY_ALERT_NO_RIDER_BACKLOG', 1, 0),
        tightBacklog: num(env, 'CAPACITY_ALERT_TIGHT_BACKLOG', 5, 0),
        tightRiders: num(env, 'CAPACITY_ALERT_TIGHT_RIDERS', 2, 0),
        atAll: flag(env, 'CAPACITY_ALERT_AT_ALL', true),
        channels: String((_a = env.CAPACITY_ALERT_CHANNELS) !== null && _a !== void 0 ? _a : '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
    };
}
/**
 * 调度看板链接：优先 CAPACITY_ALERT_LINK；否则按 ADMIN_UI_BASE_URL（origin 或已带 /guanli）拼后台运营中心。
 */
function capacityOpsLink(env = process.env) {
    var _a, _b;
    const override = String((_a = env.CAPACITY_ALERT_LINK) !== null && _a !== void 0 ? _a : '').trim();
    if (override)
        return override;
    const raw = String((_b = env.ADMIN_UI_BASE_URL) !== null && _b !== void 0 ? _b : '').trim().replace(/\/+$/, '') || 'https://e.joho.cn';
    const base = raw.endsWith('/guanli') ? raw : `${raw}/guanli`;
    return `${base}/#/pages/campus/ops`;
}
/**
 * 运力预警定时器（生产单进程无 worker，统一走 PeriodicFallback 进程内兜底，与其它后台任务同形态）：
 * 1) 关闭心跳超时的骑手在线会话（在线时长统计收口）；
 * 2) 按渠道统计「待抢大厅单量 vs 5min 内在线骑手数」，分级告警推飞书（严格项 @所有人），
 *    恢复健康后补一条「运力已恢复」，避免运营只看到告警看不到恢复。
 *
 * 推送口径：店铺定向（channel 群 + 平台群），店铺名优先 channel.customFields.shopName；
 * 死信保护：仅送达成功才登记冷却，推送失败下一轮重试。
 */
let CapacityAlertJob = class CapacityAlertJob {
    constructor(connection, feishu, 
    /** M4 跨实例冷却/级别；未注入时退回进程内 Map（单测/旧装配兼容） */
    dedupe) {
        this.connection = connection;
        this.feishu = feishu;
        this.dedupe = dedupe;
        this.fallback = null;
        /** channelId → 上次告警时间（冷却用；无 dedupe 时的进程内兜底） */
        this.alerted = new Map();
        /** channelId → 当前级别（用于升级立即推 / 恢复通知；无 dedupe 时的进程内兜底） */
        this.severity = new Map();
        this.settings = readCapacityAlertSettings();
    }
    /** 运维/单测覆盖阈值（start 时会用环境变量重置） */
    configure(partial) {
        this.settings = Object.assign(Object.assign({}, this.settings), partial);
    }
    start(overrides) {
        if (this.fallback)
            return;
        this.settings = Object.assign(Object.assign({}, readCapacityAlertSettings()), (overrides !== null && overrides !== void 0 ? overrides : {}));
        if (!this.settings.enabled) {
            core_1.Logger.info('运力预警已关闭（CAPACITY_ALERT_ENABLED=false）', 'CampusCapacity');
            return;
        }
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'capacity-alert',
            intervalMs: this.settings.intervalMs,
            bootDelayMs: this.settings.bootDelayMs,
            loggerCtx: 'CampusCapacity',
        });
        this.fallback.start(() => this.run());
        core_1.Logger.info(`运力预警已启动：每 ${Math.round(this.settings.intervalMs / 60000)} 分钟扫描，`
            + `冷却 ${Math.round(this.settings.cooldownMs / 60000)} 分钟，`
            + `阈值 无骑手≥${this.settings.noRiderBacklog} 单 / 紧张≥${this.settings.tightBacklog} 单且≤${this.settings.tightRiders} 人，`
            + `渠道 ${this.settings.channels.length ? this.settings.channels.join(',') : '全部'}`, 'CampusCapacity');
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
        await this.closeStaleSessions();
        const channels = await this.query('SELECT cfg."channelId" AS id, ch.code AS code, ch."customFieldsShopname" AS shopname '
            + 'FROM campus_fulfillment_config cfg JOIN channel ch ON ch.id = cfg."channelId"');
        const allow = new Set(this.settings.channels);
        for (const ch of channels) {
            const channelId = Number(ch.id);
            const code = String((_a = ch.code) !== null && _a !== void 0 ? _a : channelId);
            if (allow.size && !allow.has(code))
                continue;
            const name = String((_b = ch.shopname) !== null && _b !== void 0 ? _b : '').trim() || code;
            const riders = await this.countOnlineRiders(channelId);
            const backlog = await this.countBacklog(channelId);
            const severity = this.severityOf(riders, backlog.count);
            if (!severity) {
                const prev = await this.currentSeverity(channelId);
                if (prev) {
                    await this.clearAlert(channelId);
                    await this.pushRecovered(channelId, code, name, riders, backlog.count);
                }
                continue;
            }
            // 级别升级（紧张 → 无骑手）不受冷却限制，避免「更严重的情况被上一轮普通告警压住」
            const escalated = (await this.currentSeverity(channelId)) === 'warning' && severity === 'critical';
            if (!escalated && !(await this.canAlert(channelId)))
                continue;
            const atAll = severity === 'critical' && this.settings.atAll;
            if (!this.feishu.enabled) {
                // 飞书未启用：只记录（保留冷却，避免每 5 分钟刷日志）
                await this.markAlerted(channelId, severity);
                core_1.Logger.warn(`运力预警（飞书未启用，仅记录）channel=${channelId}(${code}) severity=${severity} `
                    + `backlog=${backlog.count} riders=${riders}`, 'CampusCapacity');
                continue;
            }
            const ok = await this.feishu.pushEvent('alert', severity === 'critical' ? '运力告警：无在线骑手' : '运力告警：骑手紧张', this.buildContent(name, code, backlog, riders, severity), undefined, `capacity-alert:${channelId}:${severity}:${this.bucket()}`, { channel: code, atAll }).catch((e) => {
                var _a;
                core_1.Logger.warn(`capacity alert push failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, 'CampusCapacity');
                return false;
            });
            // 只有送达成功才占冷却窗口：失败下一轮仍会重试
            if (ok) {
                await this.markAlerted(channelId, severity);
            }
            core_1.Logger.warn(`运力预警 channel=${channelId}(${code}) severity=${severity} backlog=${backlog.count} `
                + `oldest=${backlog.oldestMinutes}min riders=${riders} delivered=${ok}`, 'CampusCapacity');
        }
    }
    /** 心跳超过 5min 的会话按最后心跳关账 */
    async closeStaleSessions() {
        await this.query('UPDATE campus_rider_session SET "endedAt" = COALESCE("lastHeartbeatAt", "startedAt"), '
            + '"minutes" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE("lastHeartbeatAt", now()) - "startedAt")) / 60)) '
            + 'WHERE "endedAt" IS NULL AND COALESCE("lastHeartbeatAt", "startedAt") < now() - interval \'5 minutes\'');
    }
    severityOf(riders, backlog) {
        if (riders === 0 && backlog >= this.settings.noRiderBacklog)
            return 'critical';
        if (riders <= this.settings.tightRiders && backlog >= this.settings.tightBacklog)
            return 'warning';
        return null;
    }
    buildContent(name, code, backlog, riders, severity) {
        const wait = backlog.oldestMinutes > 0 ? `（最久已等待 ${backlog.oldestMinutes} 分钟）` : '';
        const supply = severity === 'critical' ? '近 5 分钟无在线骑手' : `在线骑手仅 ${riders} 人`;
        const advice = severity === 'critical'
            ? '请立即人工调度或切换承运方式。'
            : '请及时增派运力或调整接单上限。';
        return `店铺 ${name}（${code}）：待抢订单 ${backlog.count} 单${wait}，${supply}。${advice}\n调度看板：${capacityOpsLink()}`;
    }
    async pushRecovered(channelId, code, name, riders, backlog) {
        if (!this.feishu.enabled) {
            core_1.Logger.info(`运力恢复（飞书未启用，仅记录）channel=${channelId}(${code}) riders=${riders} backlog=${backlog}`, 'CampusCapacity');
            return;
        }
        const ok = await this.feishu.pushEvent('alert', '运力已恢复', `店铺 ${name}（${code}）：在线骑手 ${riders} 人，待抢订单 ${backlog} 单，运力已恢复正常。`, undefined, `capacity-recover:${channelId}:${Math.floor(Date.now() / 60000)}`, { channel: code }).catch((e) => {
            var _a;
            core_1.Logger.warn(`capacity recover push failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, 'CampusCapacity');
            return false;
        });
        core_1.Logger.info(`运力恢复 channel=${channelId}(${code}) riders=${riders} backlog=${backlog} delivered=${ok}`, 'CampusCapacity');
    }
    async countOnlineRiders(channelId) {
        var _a, _b;
        const rows = await this.query('SELECT COUNT(DISTINCT c.id)::int AS n FROM customer c '
            + 'JOIN customer_channels_channel cc ON cc."customerId" = c.id '
            + 'WHERE cc."channelId" = $1 AND c."customFieldsRiderstatus" = \'approved\' '
            + 'AND c."customFieldsRideronlineat" > now() - interval \'5 minutes\'', [channelId]);
        return Number((_b = (_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0);
    }
    async countBacklog(channelId) {
        var _a, _b, _c;
        const rows = await this.query('SELECT COUNT(DISTINCT o.id)::int AS n, MIN(o."createdAt") AS oldest FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'WHERE oc."channelId" = $1 AND o."customFieldsHallstatus" IN (\'open\', \'owned_pool\')', [channelId]);
        const count = Number((_b = (_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0);
        const oldest = ((_c = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _c === void 0 ? void 0 : _c.oldest) ? new Date(rows[0].oldest).getTime() : 0;
        const oldestMinutes = oldest > 0 ? Math.max(0, Math.round((Date.now() - oldest) / 60000)) : 0;
        return { count, oldestMinutes };
    }
    async canAlert(channelId) {
        var _a;
        if (!this.dedupe) {
            const last = (_a = this.alerted.get(channelId)) !== null && _a !== void 0 ? _a : 0;
            return Date.now() - last >= this.settings.cooldownMs;
        }
        return !(await this.dedupe.seen(`capacity:alert:${channelId}`, this.settings.cooldownMs));
    }
    /** 记冷却 + 当前级别（送达成功后调用；多实例共享） */
    async markAlerted(channelId, severity) {
        this.alerted.set(channelId, Date.now());
        this.severity.set(channelId, severity);
        if (!this.dedupe)
            return;
        await this.dedupe.mark(`capacity:alert:${channelId}`, this.settings.cooldownMs);
        await this.dedupe.setJson(`capacity:severity:${channelId}`, severity, SEVERITY_TTL_MS);
    }
    async currentSeverity(channelId) {
        var _a;
        if (!this.dedupe)
            return (_a = this.severity.get(channelId)) !== null && _a !== void 0 ? _a : null;
        return this.dedupe.getJson(`capacity:severity:${channelId}`);
    }
    async clearAlert(channelId) {
        this.severity.delete(channelId);
        this.alerted.delete(channelId);
        if (!this.dedupe)
            return;
        await this.dedupe.del(`capacity:severity:${channelId}`);
        await this.dedupe.del(`capacity:alert:${channelId}`);
    }
    /** 去重键时间槽：冷却为 0 时按分钟分桶（避免除零） */
    bucket() {
        return Math.floor(Date.now() / Math.max(60000, this.settings.cooldownMs));
    }
    /** 原始查询结果归一化（pg 驱动返回 [rows, count] 两层数组） */
    async query(sql, params = []) {
        const out = await this.connection.rawConnection.query(sql, params);
        return Array.isArray(out) && Array.isArray(out[0]) ? out[0] : (out !== null && out !== void 0 ? out : []);
    }
};
exports.CapacityAlertJob = CapacityAlertJob;
exports.CapacityAlertJob = CapacityAlertJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        feishu_notify_service_1.FeishuNotifyService,
        campus_dedupe_service_1.CampusDedupeService])
], CapacityAlertJob);
//# sourceMappingURL=capacity-alert.job.js.map