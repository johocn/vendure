import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Channel, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { isWithinBusinessHours } from './business-hours';
import { closedToday, safeClosureDates } from './closure-calendar';
import { isAutoAcceptDue, normalizeAutoAcceptRoutes } from './auto-accept';
import { MerchantAdminService } from './merchant-admin.service';

const loggerCtx = 'CampusAutoAccept';
/** 启动后首跑延迟：等迁移补列（p13）与 DB 连接稳定 */
const BOOT_DELAY_MS = 45_000;
/** 检查周期：15s，保证「延迟秒数」配置的落地精度 */
const INTERVAL_MS = 15_000;
/** 单渠道单轮上限：积压时按 id 升序先处理最老的单 */
const SCAN_LIMIT = 50;

interface PendingRow {
    id: number;
    code: string;
    createdAt: Date | string;
    enteredAt: Date | string | null;
    route: string | null;
}

/**
 * 商家自动接单（§69）：营业中且未临时休息的店铺，待接单订单超过「延迟秒数」后自动确认，
 * 与手动接单同一条状态机（条件写防并发 + 用户通知 + 接单即出票）。
 * 每日自动接单达到上限后新单退回人工接单；休息中/非营业时段不自动接（避免无人出餐）。
 * 店铺可在经营设置关闭；渠道间用咨询锁隔离，多实例部署幂等。
 */
@Injectable()
export class AutoAcceptJob implements OnApplicationShutdown {
    private timer: ReturnType<typeof setInterval> | null = null;
    private bootTimer: ReturnType<typeof setTimeout> | null = null;
    private running = false;

    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private merchant: MerchantAdminService,
    ) {}

    start(): void {
        if (this.timer) return;
        const tick = () => {
            if (this.running) return;
            this.running = true;
            this.run()
                .catch(e => Logger.warn(`auto accept tick failed: ${String(e?.message ?? e)}`, loggerCtx))
                .finally(() => {
                    this.running = false;
                });
        };
        this.bootTimer = setTimeout(tick, BOOT_DELAY_MS);
        this.timer = setInterval(tick, INTERVAL_MS);
    }

    stop(): void {
        if (this.bootTimer) clearTimeout(this.bootTimer);
        if (this.timer) clearInterval(this.timer);
        this.bootTimer = null;
        this.timer = null;
    }

    onApplicationShutdown(): void {
        this.stop();
    }

    /** 扫描全部渠道（仅启用了自动接单的渠道有额外开销） */
    async run(): Promise<void> {
        const rows: any = await this.connection.rawConnection.query(
            'SELECT "channelId" FROM campus_fulfillment_config WHERE "autoAcceptEnabled" = true',
        );
        const list: any[] = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        for (const r of Array.isArray(list) ? list : []) {
            const channelId = Number(r.channelId);
            if (!channelId) continue;
            await this.runChannelWithLock(channelId);
        }
    }

    private async runChannelWithLock(channelId: number): Promise<void> {
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:autoaccept:${channelId}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return;
            try {
                await this.runChannel(channelId);
            } catch (e: any) {
                Logger.error(`auto accept failed for channel ${channelId}: ${e?.message}`, loggerCtx);
            }
        } finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            } catch {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }

    async runChannel(channelId: number): Promise<void> {
        const channel =
            (await this.connection.rawConnection.getRepository(Channel).findOne({
                where: { id: channelId as any },
                relations: ['defaultTaxZone'],
            })) ?? new Channel({ id: channelId });
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const cfg = await this.config.getConfig(ctx);
        if (!cfg.autoAcceptEnabled) return;
        // 营业时段外 / 临时休息 / 今日休业（营业日历）：不自动接单（无人出餐风险），订单保持待接单等人工处理
        const hours = ((channel.customFields ?? {}) as any).waimaiBusinessHours ?? null;
        const openNow = isWithinBusinessHours(hours) && !cfg.paused && !closedToday(safeClosureDates(cfg.closureDates));
        if (!openNow) return;

        const delaySeconds = Number(cfg.autoAcceptDelaySeconds ?? 0);
        const routes = normalizeAutoAcceptRoutes(cfg.autoAcceptRoutes);
        const dailyLimit = Number(cfg.autoAcceptDailyLimit ?? 0);
        let acceptedToday = await this.merchant.countAutoAcceptedToday(channelId);
        if (dailyLimit > 0 && acceptedToday >= dailyLimit) return;

        const rows: any = await this.connection.rawConnection.query(
            'SELECT o.id, o.code, o."createdAt", o."customFieldsHallenteredat" AS "enteredAt", '
            + 'o."customFieldsFulfillmentroute" AS route '
            + 'FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id AND oc."channelId" = $1 '
            + 'WHERE o."customFieldsHallstatus" = \'pending_merchant\' AND o.state <> \'Cancelled\' '
            + 'ORDER BY o.id ASC LIMIT $2',
            [channelId, SCAN_LIMIT],
        );
        const list: PendingRow[] = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows) ?? [];
        const now = Date.now();
        for (const row of list) {
            const entered = row.enteredAt ?? row.createdAt;
            const enteredAt = new Date(entered).getTime();
            const due = isAutoAcceptDue({
                enabled: true,
                openNow,
                elapsedMs: Number.isFinite(enteredAt) ? now - enteredAt : 0,
                delaySeconds,
                route: String(row.route ?? ''),
                routes,
                acceptedToday,
                dailyLimit,
            });
            if (!due) continue;
            const moved = await this.merchant.transitionToAccepted(ctx, row.id as any, 'auto');
            if (!moved) continue; // 期间已被人工接单/取消/兜底转出
            acceptedToday += 1;
            Logger.info(`Order ${row.code} auto-accepted after ${delaySeconds}s (channel ${channelId})`, loggerCtx);
            if (dailyLimit > 0 && acceptedToday >= dailyLimit) break;
        }
    }
}
