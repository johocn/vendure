import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Channel, Logger, TransactionalConnection } from '@vendure/core';
import { campusDayKey, startOfCampusDay } from './campus-time';
import { FeishuClient } from './feishu/feishu.client';
import { PeriodicFallback } from './periodic-fallback';

const loggerCtx = 'CampusAfterSalesAlert';
/** 启动后首跑延迟：等迁移补 Channel 自定义字段与 DB 连接稳定 */
const BOOT_DELAY_MS = 60_000;
/** 检查周期：30 分钟，异常恢复或指标累积后下一轮可再次判断 */
const INTERVAL_MS = 30 * 60_000;
/** 统计窗口：近 7 个校园日（含今日） */
const WINDOW_DAYS = 7;
const DAY_MS = 24 * 3600_000;

interface Metrics {
    orders: number;
    refunded: number;
    /** 退款率（百分比，保留两位） */
    refundRate: number;
    overdue: number;
}

/**
 * 售后异常预警推送（§96）：店铺开启后，近 7 日退款率或超时待处理数超过渠道阈值时，
 * 向店铺群推送一条预警（同一天最多一条，由 waimaiAfterSalesAlertLastDay 幂等）。
 * - 退款率口径：近 7 日新建售后单中 Refunded 的单数 / 近 7 日下单量。
 * - 超时口径：当前 Pending 且超过渠道处理时限（已暂停 SLA 的单不计），与工作台一致。
 * - 渠道间用咨询锁隔离，多实例部署不重复推送。
 */
@Injectable()
export class AfterSalesAnomalyAlertJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;

    constructor(private connection: TransactionalConnection, private feishu: FeishuClient) {}

    start(): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({
            name: 'after-sales-anomaly-alert',
            intervalMs: INTERVAL_MS,
            bootDelayMs: BOOT_DELAY_MS,
            loggerCtx,
        });
        this.fallback.start(() => this.run());
    }

    stop(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    onApplicationShutdown(): void {
        this.stop();
    }

    async run(): Promise<void> {
        if (!this.feishu.enabled) return;
        let channels: Channel[];
        try {
            channels = await this.connection.rawConnection
                .getRepository(Channel)
                .createQueryBuilder('channel')
                .where('channel.customFields.waimaiAfterSalesAlertEnabled = :on', { on: true })
                .getMany();
        } catch (e: any) {
            Logger.warn(`query alert channels failed: ${String(e?.message ?? e)}`, loggerCtx);
            return;
        }
        for (const channel of channels) {
            try {
                await this.runChannelWithLock(Number(channel.id));
            } catch (e: any) {
                Logger.warn(`alert check failed for channel ${channel.code}: ${String(e?.message ?? e)}`, loggerCtx);
            }
        }
    }

    private async runChannelWithLock(channelId: number): Promise<void> {
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:asalert:${channelId}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return;
            try {
                await this.runChannel(channelId);
            } finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        } finally {
            await runner.release();
        }
    }

    async runChannel(channelId: number): Promise<void> {
        const repo = this.connection.rawConnection.getRepository(Channel);
        const channel = await repo.findOne({ where: { id: channelId } as any });
        if (!channel) return;
        const cf = (channel.customFields ?? {}) as any;
        if (!cf.waimaiAfterSalesAlertEnabled) return;
        const rateThreshold = Math.max(0, Math.floor(Number(cf.waimaiAfterSalesAlertRefundRate ?? 0) || 0));
        const overdueThreshold = Math.max(0, Math.floor(Number(cf.waimaiAfterSalesAlertOverdueCount ?? 0) || 0));
        if (rateThreshold <= 0 && overdueThreshold <= 0) return;
        const now = Date.now();
        const todayKey = campusDayKey(now);
        // 幂等键按「预警日」记：同一天只推一条
        if (cf.waimaiAfterSalesAlertLastDay === todayKey) return;

        const metrics = await this.collect(channel, now);
        const rateHit = rateThreshold > 0 && metrics.refundRate >= rateThreshold;
        const overdueHit = overdueThreshold > 0 && metrics.overdue >= overdueThreshold;
        if (!rateHit && !overdueHit) return;

        const text = this.renderText(channel.code, metrics, rateThreshold, overdueThreshold);
        const ok = await this.feishu.broadcast(text, { channel: channel.code });
        if (!ok) {
            Logger.warn(`alert not delivered (channel ${channel.code}), retry next round`, loggerCtx);
            return;
        }
        const fresh = await repo.findOne({ where: { id: channelId } as any });
        if (fresh) {
            (fresh.customFields as any).waimaiAfterSalesAlertLastDay = todayKey;
            await repo.save(fresh);
        }
        Logger.info(`alert pushed for channel ${channel.code} (refundRate=${metrics.refundRate}%, overdue=${metrics.overdue})`, loggerCtx);
    }

    /** 近 7 日售后指标：下单量 / 退款单数 / 退款率 / 超时待处理 */
    private async collect(channel: Channel, now: number): Promise<Metrics> {
        const raw = this.connection.rawConnection;
        const channelId = Number(channel.id);
        const since = new Date(startOfCampusDay(now) - (WINDOW_DAYS - 1) * DAY_MS);
        const scope = 'EXISTS (SELECT 1 FROM order_channels_channel oc WHERE oc."orderId" = o.id AND oc."channelId" = $1)';
        const orderRows: any = await raw.query(
            `SELECT COUNT(*)::int AS n FROM "order" o
              WHERE o."createdAt" >= $2 AND o."customFieldsHallstatus" IS NOT NULL AND ${scope}`,
            [channelId, since],
        );
        const refundRows: any = await raw.query(
            `SELECT COUNT(*)::int AS n FROM after_sales_request a
               JOIN "order" o ON o.id = a."orderId"
              WHERE a."createdAt" >= $2 AND a.state = 'Refunded' AND ${scope}`,
            [channelId, since],
        );
        const timeoutHours = this.timeoutHours(channel);
        const overdueRows: any = await raw.query(
            `SELECT COUNT(*)::int AS n FROM after_sales_request a
               JOIN "order" o ON o.id = a."orderId"
              WHERE a.state = 'Pending' AND a."slaPausedAt" IS NULL
                AND a."createdAt" + make_interval(hours => $2)
                    + (COALESCE(a."slaPausedMs", 0) / 1000) * interval '1 second' <= now()
                AND ${scope}`,
            [channelId, timeoutHours],
        );
        const orders = Number(this.rows(orderRows)?.[0]?.n ?? 0) || 0;
        const refunded = Number(this.rows(refundRows)?.[0]?.n ?? 0) || 0;
        const overdue = Number(this.rows(overdueRows)?.[0]?.n ?? 0) || 0;
        const refundRate = orders > 0 ? Math.round((refunded / orders) * 10000) / 100 : 0;
        return { orders, refunded, refundRate, overdue };
    }

    /** 渠道处理时限（小时）：afterSalesTimeoutHours，未配置按 48 */
    private timeoutHours(channel: Channel): number {
        const n = Number(((channel.customFields ?? {}) as any).afterSalesTimeoutHours ?? 48);
        return Number.isFinite(n) && n >= 0 ? n : 48;
    }

    /** 文本预警：只展示已开启阈值的指标，金额/百分比按校园口径 */
    private renderText(code: string, m: Metrics, rateThreshold: number, overdueThreshold: number): string {
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
    private rows(result: any): any[] {
        if (!Array.isArray(result)) return [];
        return Array.isArray(result[0]) ? result[0] : result;
    }
}
