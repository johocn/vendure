import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, TransactionalConnection } from '@vendure/core';
import { PeriodicFallback } from './periodic-fallback';
import { localDateKey } from './rider-shift-window';
import { campusHour } from './campus-time';

const loggerCtx = 'CampusSoldOutAutoRestore';
/** 启动后首跑延迟：等迁移建表 / DB 连接稳定 */
const BOOT_DELAY_MS = 120_000;
/** 检查周期：每 10 分钟看一次是否到点（生产单进程自管定时器，与黑名单扫描同形态） */
const INTERVAL_MS = 10 * 60_000;
/** 每日恢复时点（校园本地时间 UTC+8）：凌晨 4 点，早于早餐备货 */
const RESTORE_HOUR = 4;

/**
 * 沽清次日自动恢复（§66）：每天 04:00 把「全店沽清」批次登记的商品恢复在售，
 * 并清空登记。单品手动沽清不会进入批次表，因此不受影响。
 * 店铺可在后台关闭自动恢复（channel.customFields.waimaiSoldOutAutoRestore）。
 */
@Injectable()
export class SoldOutAutoRestoreJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;
    private lastRunDay: string | null = null;

    constructor(private connection: TransactionalConnection) {}

    start(): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({
            name: 'soldout-auto-restore',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => this.runOnce());
    }

    stop(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    onApplicationShutdown(): void {
        this.stop();
    }

    async runOnce(): Promise<void> {
        const now = new Date();
        // 与 localDateKey 保持同一时区口径（固定 UTC+8），避免非 UTC+8 服务器恢复时点漂移
        if (campusHour(now.getTime()) < RESTORE_HOUR) return;
        const day = localDateKey(now);
        if (this.lastRunDay === day) return;
        const done = await this.restoreAll();
        if (done) {
            this.lastRunDay = day;
            if (done.restored > 0) {
                Logger.info(`auto restored ${done.restored} sold-out products in ${done.channels} shop(s)`, loggerCtx);
            }
        }
    }

    /** 按店铺恢复批次内商品；返回受影响统计 */
    private async restoreAll(): Promise<{ restored: number; channels: number }> {
        const raw = this.connection.rawConnection;
        const rows: any = await raw.query('SELECT "channelId", "productId" FROM campus_soldout_batch');
        const list: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        if (!list.length) return { restored: 0, channels: 0 };

        const byChannel = new Map<number, number[]>();
        for (const r of list) {
            const ch = Number(r.channelId);
            const ids = byChannel.get(ch) ?? [];
            ids.push(Number(r.productId));
            byChannel.set(ch, ids);
        }

        let restored = 0;
        let channels = 0;
        for (const [channelId, ids] of byChannel) {
            const flagRows: any = await raw.query(
                'SELECT "customFieldsWaimaisoldoutautorestore" AS enabled FROM channel WHERE id = $1',
                [channelId],
            );
            const flagList: any[] = Array.isArray(flagRows) && Array.isArray(flagRows[0]) ? flagRows[0] : flagRows;
            // 关闭自动恢复的店铺：保留登记，等下次开启后继续生效
            if (flagList?.[0]?.enabled === false) continue;
            const updated: any = await raw.query(
                'UPDATE product SET "customFieldsWaimaisoldout" = false WHERE id = ANY($1::int[]) RETURNING id',
                [ids],
            );
            const upList: any[] = Array.isArray(updated) && Array.isArray(updated[0]) ? updated[0] : updated;
            restored += Array.isArray(upList) ? upList.length : 0;
            channels += 1;
            await raw.query(
                'DELETE FROM campus_soldout_batch WHERE "channelId" = $1 AND "productId" = ANY($2::int[])',
                [channelId, ids],
            );
        }
        return { restored, channels };
    }
}
