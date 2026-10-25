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
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
/** 扫描周期（分钟级足够；骑手心跳 5min 一档） */
const DEFAULT_INTERVAL_MS = 5 * 60000;
/** 启动后首跑延迟：等连接池/事件总线就绪 */
const BOOT_DELAY_MS = 60000;
/** 同一渠道告警冷却（避免 5min 一轮刷屏） */
const ALERT_COOLDOWN_MS = 30 * 60000;
/** 无人在线时的 backlog 阈值 / 运力紧张阈值 */
const NO_RIDER_BACKLOG = 1;
const TIGHT_BACKLOG = 5;
const TIGHT_RIDERS = 2;
/**
 * 运力预警定时器（生产单进程，自管 setInterval；与 PaymentTimeoutJob / DispatchJobService 同形态）：
 * 1) 关闭心跳超时的骑手在线会话（在线时长统计收口）；
 * 2) 按渠道统计「待抢大厅单量 vs 5min 内在线骑手数」，触发无骑手 / 运力紧张告警推飞书。
 */
let CapacityAlertJob = class CapacityAlertJob {
    constructor(connection, feishu) {
        this.connection = connection;
        this.feishu = feishu;
        this.timer = null;
        this.bootTimer = null;
        this.running = false;
        this.alerted = new Map();
    }
    start(intervalMs = DEFAULT_INTERVAL_MS) {
        if (this.timer)
            return;
        const tick = () => {
            if (this.running)
                return;
            this.running = true;
            this.run()
                .catch(e => { var _a; return core_1.Logger.warn(`capacity alert tick failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, 'CampusCapacity'); })
                .finally(() => { this.running = false; });
        };
        this.bootTimer = setTimeout(tick, BOOT_DELAY_MS);
        this.timer = setInterval(tick, intervalMs);
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
    async run() {
        var _a;
        await this.closeStaleSessions();
        const channels = await this.query('SELECT cfg."channelId" AS id, ch.code AS code FROM campus_fulfillment_config cfg '
            + 'JOIN channel ch ON ch.id = cfg."channelId"');
        for (const ch of channels) {
            const channelId = Number(ch.id);
            const riders = await this.countOnlineRiders(channelId);
            const backlog = await this.countBacklog(channelId);
            const title = riders === 0 && backlog >= NO_RIDER_BACKLOG
                ? '运力告警：无在线骑手'
                : riders <= TIGHT_RIDERS && backlog >= TIGHT_BACKLOG
                    ? '运力告警：骑手紧张'
                    : null;
            if (!title)
                continue;
            if (!this.shouldAlert(channelId))
                continue;
            await this.feishu.pushEvent('alert', title, `店铺 ${(_a = ch.code) !== null && _a !== void 0 ? _a : channelId}：待抢订单 ${backlog} 单，在线骑手 ${riders} 人，请及时调度或切换承运方式。`, undefined, `capacity-alert:${channelId}:${Math.floor(Date.now() / ALERT_COOLDOWN_MS)}`).catch((e) => { var _a; return core_1.Logger.warn(`capacity alert push failed: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, 'CampusCapacity'); });
            core_1.Logger.warn(`capacity alert channel=${channelId} backlog=${backlog} riders=${riders}`, 'CampusCapacity');
        }
    }
    /** 心跳超过 5min 的会话按最后心跳关账 */
    async closeStaleSessions() {
        await this.query('UPDATE campus_rider_session SET "endedAt" = COALESCE("lastHeartbeatAt", "startedAt"), '
            + '"minutes" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE("lastHeartbeatAt", now()) - "startedAt")) / 60)) '
            + 'WHERE "endedAt" IS NULL AND COALESCE("lastHeartbeatAt", "startedAt") < now() - interval \'5 minutes\'');
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
        var _a, _b;
        const rows = await this.query('SELECT COUNT(DISTINCT o.id)::int AS n FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'WHERE oc."channelId" = $1 AND o."customFieldsHallstatus" IN (\'open\', \'owned_pool\')', [channelId]);
        return Number((_b = (_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0);
    }
    shouldAlert(channelId) {
        var _a;
        const last = (_a = this.alerted.get(channelId)) !== null && _a !== void 0 ? _a : 0;
        if (Date.now() - last < ALERT_COOLDOWN_MS)
            return false;
        this.alerted.set(channelId, Date.now());
        return true;
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
        feishu_notify_service_1.FeishuNotifyService])
], CapacityAlertJob);
//# sourceMappingURL=capacity-alert.job.js.map