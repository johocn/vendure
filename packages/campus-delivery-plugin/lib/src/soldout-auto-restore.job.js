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
exports.SoldOutAutoRestoreJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const advisory_lock_1 = require("./advisory-lock");
const periodic_fallback_1 = require("./periodic-fallback");
const rider_shift_window_1 = require("./rider-shift-window");
const campus_time_1 = require("./campus-time");
const loggerCtx = 'CampusSoldOutAutoRestore';
/** 启动后首跑延迟：等迁移建表 / DB 连接稳定 */
const BOOT_DELAY_MS = 120000;
/** 检查周期：每 10 分钟看一次是否到点（生产单进程自管定时器，与黑名单扫描同形态） */
const INTERVAL_MS = 10 * 60000;
/** 每日恢复时点（校园本地时间 UTC+8）：凌晨 4 点，早于早餐备货 */
const RESTORE_HOUR = 4;
/**
 * 沽清次日自动恢复（§66）：每天 04:00 把「全店沽清」批次登记的商品恢复在售，
 * 并清空登记。单品手动沽清不会进入批次表，因此不受影响。
 * 店铺可在后台关闭自动恢复（channel.customFields.waimaiSoldOutAutoRestore）。
 */
let SoldOutAutoRestoreJob = class SoldOutAutoRestoreJob {
    constructor(connection) {
        this.connection = connection;
        this.fallback = null;
        this.lastRunDay = null;
    }
    start() {
        if (this.fallback)
            return;
        this.fallback = new periodic_fallback_1.PeriodicFallback({
            name: 'soldout-auto-restore',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => 
        // 多实例互斥：拿不到锁说明其他实例正在恢复，本轮直接跳过
        (0, advisory_lock_1.withAdvisoryLock)(this.connection, 'campus:soldout-auto-restore', () => this.runOnce()));
    }
    stop() {
        var _a;
        (_a = this.fallback) === null || _a === void 0 ? void 0 : _a.stop();
        this.fallback = null;
    }
    onApplicationShutdown() {
        this.stop();
    }
    async runOnce() {
        const now = new Date();
        // 与 localDateKey 保持同一时区口径（固定 UTC+8），避免非 UTC+8 服务器恢复时点漂移
        if ((0, campus_time_1.campusHour)(now.getTime()) < RESTORE_HOUR)
            return;
        const day = (0, rider_shift_window_1.localDateKey)(now);
        if (this.lastRunDay === day)
            return;
        const done = await this.restoreAll();
        if (done) {
            this.lastRunDay = day;
            if (done.restored > 0) {
                core_1.Logger.info(`auto restored ${done.restored} sold-out products in ${done.channels} shop(s)`, loggerCtx);
            }
        }
    }
    /** 按店铺恢复批次内商品；返回受影响统计 */
    async restoreAll() {
        var _a, _b;
        const raw = this.connection.rawConnection;
        const rows = await raw.query('SELECT "channelId", "productId" FROM campus_soldout_batch');
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        if (!list.length)
            return { restored: 0, channels: 0 };
        const byChannel = new Map();
        for (const r of list) {
            const ch = Number(r.channelId);
            const ids = (_a = byChannel.get(ch)) !== null && _a !== void 0 ? _a : [];
            ids.push(Number(r.productId));
            byChannel.set(ch, ids);
        }
        let restored = 0;
        let channels = 0;
        for (const [channelId, ids] of byChannel) {
            const flagRows = await raw.query('SELECT "customFieldsWaimaisoldoutautorestore" AS enabled FROM channel WHERE id = $1', [channelId]);
            const flagList = Array.isArray(flagRows) && Array.isArray(flagRows[0]) ? flagRows[0] : flagRows;
            // 关闭自动恢复的店铺：保留登记，等下次开启后继续生效
            if (((_b = flagList === null || flagList === void 0 ? void 0 : flagList[0]) === null || _b === void 0 ? void 0 : _b.enabled) === false)
                continue;
            const updated = await raw.query('UPDATE product SET "customFieldsWaimaisoldout" = false WHERE id = ANY($1::int[]) RETURNING id', [ids]);
            const upList = Array.isArray(updated) && Array.isArray(updated[0]) ? updated[0] : updated;
            restored += Array.isArray(upList) ? upList.length : 0;
            channels += 1;
            await raw.query('DELETE FROM campus_soldout_batch WHERE "channelId" = $1 AND "productId" = ANY($2::int[])', [channelId, ids]);
        }
        return { restored, channels };
    }
};
exports.SoldOutAutoRestoreJob = SoldOutAutoRestoreJob;
exports.SoldOutAutoRestoreJob = SoldOutAutoRestoreJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SoldOutAutoRestoreJob);
//# sourceMappingURL=soldout-auto-restore.job.js.map