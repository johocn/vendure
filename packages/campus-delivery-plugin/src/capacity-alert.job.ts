import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, TransactionalConnection } from '@vendure/core';
import { CampusDedupeService } from './campus-dedupe.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
import { PeriodicFallback } from './periodic-fallback';

export type CapacitySeverity = 'critical' | 'warning';

/** 级别状态保留 24h（需跨冷却窗口，才能识别后续升级/恢复；冷却本身另外计时） */
const SEVERITY_TTL_MS = 24 * 3600_000;

export interface CapacityAlertSettings {
    /** 总开关（CAPACITY_ALERT_ENABLED，默认开） */
    enabled: boolean;
    /** 扫描周期（CAPACITY_ALERT_INTERVAL_MIN，默认 5 分钟） */
    intervalMs: number;
    /** 启动首跑延迟，等连接池/事件总线就绪（CAPACITY_ALERT_BOOT_DELAY_SEC，默认 60s） */
    bootDelayMs: number;
    /** 同渠道同级别告警冷却（CAPACITY_ALERT_COOLDOWN_MIN，默认 30 分钟） */
    cooldownMs: number;
    /** 无在线骑手时触发告警的待抢单量下限（CAPACITY_ALERT_NO_RIDER_BACKLOG，默认 1） */
    noRiderBacklog: number;
    /** 运力紧张：待抢单量下限（CAPACITY_ALERT_TIGHT_BACKLOG，默认 5） */
    tightBacklog: number;
    /** 运力紧张：在线骑手数上限（CAPACITY_ALERT_TIGHT_RIDERS，默认 2） */
    tightRiders: number;
    /** 严重告警是否 @所有人（CAPACITY_ALERT_AT_ALL，默认开） */
    atAll: boolean;
    /** 只对这些渠道 code 告警，空 = 全部（CAPACITY_ALERT_CHANNELS，逗号分隔） */
    channels: string[];
}

function num(env: NodeJS.ProcessEnv, key: string, def: number, min = 0): number {
    const raw = env[key];
    if (raw == null || String(raw).trim() === '') return def;
    const v = Number(raw);
    return Number.isFinite(v) && v >= min ? v : def;
}

function flag(env: NodeJS.ProcessEnv, key: string, def: boolean): boolean {
    const raw = String(env[key] ?? '').trim().toLowerCase();
    if (!raw) return def;
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

export function readCapacityAlertSettings(env: NodeJS.ProcessEnv = process.env): CapacityAlertSettings {
    return {
        enabled: flag(env, 'CAPACITY_ALERT_ENABLED', true),
        intervalMs: Math.max(60_000, num(env, 'CAPACITY_ALERT_INTERVAL_MIN', 5, 1) * 60_000),
        bootDelayMs: num(env, 'CAPACITY_ALERT_BOOT_DELAY_SEC', 60, 0) * 1000,
        cooldownMs: num(env, 'CAPACITY_ALERT_COOLDOWN_MIN', 30, 0) * 60_000,
        noRiderBacklog: num(env, 'CAPACITY_ALERT_NO_RIDER_BACKLOG', 1, 0),
        tightBacklog: num(env, 'CAPACITY_ALERT_TIGHT_BACKLOG', 5, 0),
        tightRiders: num(env, 'CAPACITY_ALERT_TIGHT_RIDERS', 2, 0),
        atAll: flag(env, 'CAPACITY_ALERT_AT_ALL', true),
        channels: String(env.CAPACITY_ALERT_CHANNELS ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
    };
}

/**
 * 调度看板链接：优先 CAPACITY_ALERT_LINK；否则按 ADMIN_UI_BASE_URL（origin 或已带 /guanli）拼后台运营中心。
 */
export function capacityOpsLink(env: NodeJS.ProcessEnv = process.env): string {
    const override = String(env.CAPACITY_ALERT_LINK ?? '').trim();
    if (override) return override;
    const raw = String(env.ADMIN_UI_BASE_URL ?? '').trim().replace(/\/+$/, '') || 'https://e.joho.cn';
    const base = raw.endsWith('/guanli') ? raw : `${raw}/guanli`;
    return `${base}/#/pages/campus/ops`;
}

/** 待抢单量 + 最久等待时长 */
export interface BacklogStat {
    count: number;
    oldestMinutes: number;
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
@Injectable()
export class CapacityAlertJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;
    /** channelId → 上次告警时间（冷却用；无 dedupe 时的进程内兜底） */
    private alerted = new Map<number, number>();
    /** channelId → 当前级别（用于升级立即推 / 恢复通知；无 dedupe 时的进程内兜底） */
    private severity = new Map<number, CapacitySeverity>();
    private settings: CapacityAlertSettings = readCapacityAlertSettings();

    constructor(
        private connection: TransactionalConnection,
        private feishu: FeishuNotifyService,
        /** M4 跨实例冷却/级别；未注入时退回进程内 Map（单测/旧装配兼容） */
        private dedupe?: CampusDedupeService,
    ) {}

    /** 运维/单测覆盖阈值（start 时会用环境变量重置） */
    configure(partial: Partial<CapacityAlertSettings>): void {
        this.settings = { ...this.settings, ...partial };
    }

    start(overrides?: Partial<CapacityAlertSettings>): void {
        if (this.fallback) return;
        this.settings = { ...readCapacityAlertSettings(), ...(overrides ?? {}) };
        if (!this.settings.enabled) {
            Logger.info('运力预警已关闭（CAPACITY_ALERT_ENABLED=false）', 'CampusCapacity');
            return;
        }
        this.fallback = new PeriodicFallback({
            name: 'capacity-alert',
            intervalMs: this.settings.intervalMs,
            bootDelayMs: this.settings.bootDelayMs,
            loggerCtx: 'CampusCapacity',
        });
        this.fallback.start(() => this.run());
        Logger.info(
            `运力预警已启动：每 ${Math.round(this.settings.intervalMs / 60_000)} 分钟扫描，`
            + `冷却 ${Math.round(this.settings.cooldownMs / 60_000)} 分钟，`
            + `阈值 无骑手≥${this.settings.noRiderBacklog} 单 / 紧张≥${this.settings.tightBacklog} 单且≤${this.settings.tightRiders} 人，`
            + `渠道 ${this.settings.channels.length ? this.settings.channels.join(',') : '全部'}`,
            'CampusCapacity',
        );
    }

    stop(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    onApplicationShutdown(): void {
        this.stop();
    }

    async run(): Promise<void> {
        await this.closeStaleSessions();
        const channels: any[] = await this.query(
            'SELECT cfg."channelId" AS id, ch.code AS code, ch."customFieldsShopname" AS shopname '
            + 'FROM campus_fulfillment_config cfg JOIN channel ch ON ch.id = cfg."channelId"',
        );
        const allow = new Set(this.settings.channels);
        for (const ch of channels) {
            const channelId = Number(ch.id);
            const code = String(ch.code ?? channelId);
            if (allow.size && !allow.has(code)) continue;
            const name = String(ch.shopname ?? '').trim() || code;
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
            if (!escalated && !(await this.canAlert(channelId))) continue;

            const atAll = severity === 'critical' && this.settings.atAll;
            if (!this.feishu.enabled) {
                // 飞书未启用：只记录（保留冷却，避免每 5 分钟刷日志）
                await this.markAlerted(channelId, severity);
                Logger.warn(
                    `运力预警（飞书未启用，仅记录）channel=${channelId}(${code}) severity=${severity} `
                    + `backlog=${backlog.count} riders=${riders}`,
                    'CampusCapacity',
                );
                continue;
            }

            const ok = await this.feishu.pushEvent(
                'alert',
                severity === 'critical' ? '运力告警：无在线骑手' : '运力告警：骑手紧张',
                this.buildContent(name, code, backlog, riders, severity),
                undefined,
                `capacity-alert:${channelId}:${severity}:${this.bucket()}`,
                { channel: code, atAll },
            ).catch((e: any) => {
                Logger.warn(`capacity alert push failed: ${e?.message ?? e}`, 'CampusCapacity');
                return false;
            });
            // 只有送达成功才占冷却窗口：失败下一轮仍会重试
            if (ok) {
                await this.markAlerted(channelId, severity);
            }
            Logger.warn(
                `运力预警 channel=${channelId}(${code}) severity=${severity} backlog=${backlog.count} `
                + `oldest=${backlog.oldestMinutes}min riders=${riders} delivered=${ok}`,
                'CampusCapacity',
            );
        }
    }

    /** 心跳超过 5min 的会话按最后心跳关账 */
    async closeStaleSessions(): Promise<void> {
        await this.query(
            'UPDATE campus_rider_session SET "endedAt" = COALESCE("lastHeartbeatAt", "startedAt"), '
            + '"minutes" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE("lastHeartbeatAt", now()) - "startedAt")) / 60)) '
            + 'WHERE "endedAt" IS NULL AND COALESCE("lastHeartbeatAt", "startedAt") < now() - interval \'5 minutes\'',
        );
    }

    private severityOf(riders: number, backlog: number): CapacitySeverity | null {
        if (riders === 0 && backlog >= this.settings.noRiderBacklog) return 'critical';
        if (riders <= this.settings.tightRiders && backlog >= this.settings.tightBacklog) return 'warning';
        return null;
    }

    private buildContent(name: string, code: string, backlog: BacklogStat, riders: number, severity: CapacitySeverity): string {
        const wait = backlog.oldestMinutes > 0 ? `（最久已等待 ${backlog.oldestMinutes} 分钟）` : '';
        const supply = severity === 'critical' ? '近 5 分钟无在线骑手' : `在线骑手仅 ${riders} 人`;
        const advice = severity === 'critical'
            ? '请立即人工调度或切换承运方式。'
            : '请及时增派运力或调整接单上限。';
        return `店铺 ${name}（${code}）：待抢订单 ${backlog.count} 单${wait}，${supply}。${advice}\n调度看板：${capacityOpsLink()}`;
    }

    private async pushRecovered(channelId: number, code: string, name: string, riders: number, backlog: number): Promise<void> {
        if (!this.feishu.enabled) {
            Logger.info(`运力恢复（飞书未启用，仅记录）channel=${channelId}(${code}) riders=${riders} backlog=${backlog}`, 'CampusCapacity');
            return;
        }
        const ok = await this.feishu.pushEvent(
            'alert',
            '运力已恢复',
            `店铺 ${name}（${code}）：在线骑手 ${riders} 人，待抢订单 ${backlog} 单，运力已恢复正常。`,
            undefined,
            `capacity-recover:${channelId}:${Math.floor(Date.now() / 60_000)}`,
            { channel: code },
        ).catch((e: any) => {
            Logger.warn(`capacity recover push failed: ${e?.message ?? e}`, 'CampusCapacity');
            return false;
        });
        Logger.info(`运力恢复 channel=${channelId}(${code}) riders=${riders} backlog=${backlog} delivered=${ok}`, 'CampusCapacity');
    }

    private async countOnlineRiders(channelId: number): Promise<number> {
        const rows: any[] = await this.query(
            'SELECT COUNT(DISTINCT c.id)::int AS n FROM customer c '
            + 'JOIN customer_channels_channel cc ON cc."customerId" = c.id '
            + 'WHERE cc."channelId" = $1 AND c."customFieldsRiderstatus" = \'approved\' '
            + 'AND c."customFieldsRideronlineat" > now() - interval \'5 minutes\'',
            [channelId],
        );
        return Number(rows?.[0]?.n ?? 0);
    }

    private async countBacklog(channelId: number): Promise<BacklogStat> {
        const rows: any[] = await this.query(
            'SELECT COUNT(DISTINCT o.id)::int AS n, MIN(o."createdAt") AS oldest FROM "order" o '
            + 'JOIN order_channels_channel oc ON oc."orderId" = o.id '
            + 'WHERE oc."channelId" = $1 AND o."customFieldsHallstatus" IN (\'open\', \'owned_pool\')',
            [channelId],
        );
        const count = Number(rows?.[0]?.n ?? 0);
        const oldest = rows?.[0]?.oldest ? new Date(rows[0].oldest).getTime() : 0;
        const oldestMinutes = oldest > 0 ? Math.max(0, Math.round((Date.now() - oldest) / 60_000)) : 0;
        return { count, oldestMinutes };
    }

    private async canAlert(channelId: number): Promise<boolean> {
        if (!this.dedupe) {
            const last = this.alerted.get(channelId) ?? 0;
            return Date.now() - last >= this.settings.cooldownMs;
        }
        return !(await this.dedupe.seen(`capacity:alert:${channelId}`, this.settings.cooldownMs));
    }

    /** 记冷却 + 当前级别（送达成功后调用；多实例共享） */
    private async markAlerted(channelId: number, severity: CapacitySeverity): Promise<void> {
        this.alerted.set(channelId, Date.now());
        this.severity.set(channelId, severity);
        if (!this.dedupe) return;
        await this.dedupe.mark(`capacity:alert:${channelId}`, this.settings.cooldownMs);
        await this.dedupe.setJson(`capacity:severity:${channelId}`, severity, SEVERITY_TTL_MS);
    }

    private async currentSeverity(channelId: number): Promise<CapacitySeverity | null> {
        if (!this.dedupe) return this.severity.get(channelId) ?? null;
        return this.dedupe.getJson<CapacitySeverity>(`capacity:severity:${channelId}`);
    }

    private async clearAlert(channelId: number): Promise<void> {
        this.severity.delete(channelId);
        this.alerted.delete(channelId);
        if (!this.dedupe) return;
        await this.dedupe.del(`capacity:severity:${channelId}`);
        await this.dedupe.del(`capacity:alert:${channelId}`);
    }

    /** 去重键时间槽：冷却为 0 时按分钟分桶（避免除零） */
    private bucket(): number {
        return Math.floor(Date.now() / Math.max(60_000, this.settings.cooldownMs));
    }

    /** 原始查询结果归一化（pg 驱动返回 [rows, count] 两层数组） */
    private async query(sql: string, params: any[] = []): Promise<any[]> {
        const out: any = await this.connection.rawConnection.query(sql, params);
        return Array.isArray(out) && Array.isArray(out[0]) ? out[0] : (out ?? []);
    }
}
