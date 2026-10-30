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
exports.BlacklistAutoScanJob = exports.BLACKLIST_CANCEL_WINDOW_DAYS = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const feishu_notify_service_1 = require("./feishu/feishu-notify.service");
const periodic_fallback_1 = require("./periodic-fallback");
const rider_shift_window_1 = require("./rider-shift-window");
const loggerCtx = 'CampusBlacklistScan';
/** 启动后首跑延迟：等迁移补列 / DB 连接稳定 */
const BOOT_DELAY_MS = 120000;
/** 扫描周期：每 6h 一轮，同日只跑一次（多实例/重启由 INSERT 幂等兜底） */
const INTERVAL_MS = 6 * 3600000;
/** 取消统计窗口（天） */
exports.BLACKLIST_CANCEL_WINDOW_DAYS = 30;
/** 单店铺单轮最多自动拉黑人数，防一次事故批量误伤 */
const MAX_PER_CHANNEL = 50;
/**
 * P3-2 黑名单自动规则：近 30 天「顾客主动取消」订单达到店铺阈值（blacklistAutoCancelCount）
 * 的顾客自动加入黑名单。
 *
 * 取消归因由插件在订单转 Cancelled 时写入 customFieldsCampuscancelcause（customer/system/ops），
 * 只统计 customer，避免把超时/无骑手等系统取消误判成顾客恶意取消。
 *
 * 生产为单进程（pm2 只跑 API），沿用本插件自管定时器；阈值 0 = 关闭，默认不改变既有行为。
 */
let BlacklistAutoScanJob = class BlacklistAutoScanJob {
    constructor(connection, feishu) {
        this.connection = connection;
        this.feishu = feishu;
        this.fallback = null;
        this.lastRunDay = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'blacklist-auto-scan',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => this.runOnce());
    }
    stop() {
        var _a;
        (_a = this.fallback) === null || _a === void 0 ? void 0 : _a.stop();
        this.fallback = null;
    }
    onApplicationShutdown() {
        this.stop();
    }
    /** 每日一轮：同日重复触发直接跳过（force 供手动/测试） */
    async runOnce(force = false) {
        const day = (0, rider_shift_window_1.localDateKey)(new Date());
        if (!force && this.lastRunDay === day)
            return { added: 0, channels: 0 };
        this.lastRunDay = day;
        return this.scan();
    }
    async scan() {
        const raw = this.connection.rawConnection;
        const configs = await raw.query(`SELECT "channelId", "blacklistAutoCancelCount" AS threshold
               FROM campus_fulfillment_config
              WHERE "blacklistAutoCancelCount" > 0`);
        let added = 0;
        let channels = 0;
        const touched = [];
        for (const cfg of configs) {
            const channelId = Number(cfg.channelId);
            const threshold = Math.max(1, Number(cfg.threshold));
            if (!channelId)
                continue;
            channels += 1;
            // 取消归因列由 custom-fields 生成（PG 折叠为小写：customFieldsCampuscancelcause）
            const rows = await raw.query(`SELECT o."customerId" AS "customerId", COUNT(*)::int AS cnt
                   FROM "order" o
                   JOIN "order_channels_channel" oc ON oc."orderId" = o.id AND oc."channelId" = $1
                  WHERE o.state = 'Cancelled'
                    AND o."customFieldsCampuscancelcause" = 'customer'
                    AND o."customerId" IS NOT NULL
                    AND o."createdAt" >= now() - interval '${exports.BLACKLIST_CANCEL_WINDOW_DAYS} days'
                  GROUP BY o."customerId"
                 HAVING COUNT(*) >= $2
                  ORDER BY COUNT(*) DESC
                  LIMIT $3`, [channelId, threshold, MAX_PER_CHANNEL]);
            for (const row of rows) {
                const customerId = Number(row.customerId);
                const count = Number(row.cnt);
                if (!customerId)
                    continue;
                const inserted = await raw.query(`INSERT INTO campus_blacklist ("channelId", type, "customerId", phone, reason, "createdBy", active)
                     SELECT $1, 'user', $2, NULL, $3, 'system', true
                      WHERE NOT EXISTS (
                            SELECT 1 FROM campus_blacklist b
                             WHERE b."channelId" = $1 AND b.type = 'user'
                               AND b."customerId" = $2 AND b.active = true
                        )
                     RETURNING id`, [
                    channelId,
                    customerId,
                    `近${exports.BLACKLIST_CANCEL_WINDOW_DAYS}天主动取消订单 ${count} 次（自动规则）`,
                ]);
                if (Array.isArray(inserted) && inserted.length) {
                    added += 1;
                    if (!touched.includes(channelId))
                        touched.push(channelId);
                }
            }
        }
        if (added > 0) {
            await this.feishu.pushEvent('blacklist_auto', '黑名单自动规则命中', `近${exports.BLACKLIST_CANCEL_WINDOW_DAYS}天顾客主动取消达标，自动加入黑名单 ${added} 人（店铺 ${touched.join(', ')}）`, undefined, `blacklist_auto:${(0, rider_shift_window_1.localDateKey)(new Date())}:${added}`).catch(e => { var _a; return core_1.Logger.warn(`blacklist auto feishu failed: ${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx); });
            core_1.Logger.warn(`blacklist auto scan added ${added} customer(s) in channels ${touched.join(',')}`, loggerCtx);
        }
        return { added, channels };
    }
};
exports.BlacklistAutoScanJob = BlacklistAutoScanJob;
exports.BlacklistAutoScanJob = BlacklistAutoScanJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        feishu_notify_service_1.FeishuNotifyService])
], BlacklistAutoScanJob);
//# sourceMappingURL=blacklist-scan.job.js.map