import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, TransactionalConnection } from '@vendure/core';

import { campusDayKey, CAMPUS_TZ_OFFSET_MS, startOfCampusDay } from '../campus-time';
import { PeriodicFallback } from '../periodic-fallback';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
import { FeishuClient } from './feishu.client';
import { FeishuCommandService } from './feishu.command.service';

const loggerCtx = 'Feishu';

/** 当前校园时区 HH:mm */
export function campusHhmm(t: number): string {
    const d = new Date(t + CAMPUS_TZ_OFFSET_MS);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * 到达汇总时间且今天未发 → 逐群推送当天经营汇总。
 * 零建表：防重不落库，发送前用飞书消息列表接口回读当天是否已有「【每日汇总】」；
 * 多进程并发仍用 PG advisory lock 兜底（不建表）。
 */
@Injectable()
export class FeishuDigestService implements OnApplicationShutdown {
    /** 汇总与心跳各自一条兜底循环：互不阻塞（汇总推送慢时不拖住心跳） */
    private digestLoop: PeriodicFallback | null = null;
    private heartbeatLoop: PeriodicFallback | null = null;
    private running = false;
    /** 进程内兜底（webhook 模式无法回读消息时防同进程重复发送，不落库） */
    private sent = new Map<string, string>();

    constructor(
        private cfg: FeishuConfigService,
        private client: FeishuClient,
        private connection: TransactionalConnection,
        private command: FeishuCommandService,
    ) {}

    start(intervalMs = 60_000): void {
        if (this.digestLoop || !this.client.enabled) return;
        this.digestLoop = new PeriodicFallback({ name: 'feishu-digest', intervalMs, loggerCtx });
        this.heartbeatLoop = new PeriodicFallback({ name: 'feishu-heartbeat', intervalMs, loggerCtx });
        this.digestLoop.start(() => this.tick());
        this.heartbeatLoop.start(() => this.heartbeatTick());
        Logger.info(`每日汇总 + 心跳已启用，汇总 ${this.cfg.settings.digestAt}（UTC+8），心跳 1h（UTC+8）`, loggerCtx);
    }

    onApplicationShutdown(): void {
        this.digestLoop?.stop();
        this.heartbeatLoop?.stop();
        this.digestLoop = null;
        this.heartbeatLoop = null;
    }

    private async tick(): Promise<void> {
        if (!this.cfg.enabled || this.running) return;
        if (campusHhmm(Date.now()) < this.cfg.settings.digestAt) return;
        this.running = true;
        try {
            for (const [chatId, chat] of Object.entries(this.cfg.settings.chats)) {
                await this.sendOnce(chatId, chat);
            }
        } finally {
            this.running = false;
        }
    }

    private async sendOnce(chatId: string, chat: FeishuChatConfig): Promise<void> {
        const day = campusDayKey(Date.now());
        if (this.sent.get(chatId) === day) return;
        if (await this.sentToday(chatId, day)) {
            this.sent.set(chatId, day);
            return;
        }

        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:feishu:digest:${chatId}:${day}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return;
            try {
                if (await this.sentToday(chatId, day)) return;
                // 没有 app 凭据时无法回读消息，退化为进程内标记 + advisory lock
                const text = await this.buildDigest(chat);
                if (await this.client.sendToChat(chatId, text)) {
                    this.sent.set(chatId, day);
                    Logger.info(`每日汇总已发送 chat=${chatId} day=${day}`, loggerCtx);
                }
            } finally {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
            }
        } finally {
            await runner.release();
        }
    }

    /** 汇总内容由指令服务统一生成：平台群走全平台，店铺群走单店 */
    private buildDigest(chat: FeishuChatConfig): Promise<string> {
        return this.command.renderDigest(chat);
    }

    /** 回读当天群消息，已有当日「【每日汇总】」则跳过（最多翻 5 页，纯读）
     * 只从当日汇总时间点开始算，避免早上人工查过一次汇总就把定时汇总吞掉 */
    private async sentToday(chatId: string, day: string): Promise<boolean> {
        const base = startOfCampusDay(Date.now());
        const [h, m] = this.cfg.settings.digestAt.split(':').map(Number);
        const scheduled = base + (h || 0) * 3600_000 + (m || 0) * 60_000;
        const startSec = Math.floor(Math.max(base, scheduled) / 1000);
        const endSec = Math.floor(Date.now() / 1000);
        let pageToken: string | undefined;
        for (let page = 0; page < 5; page++) {
            const { items, nextToken } = await this.client.listMessages(chatId, startSec, endSec, pageToken);
            for (const m of items) {
                const content = m.body?.content ?? '';
                if (content.includes('【每日汇总】') && content.includes(day)) return true;
            }
            if (!nextToken) break;
            pageToken = nextToken;
        }
        return false;
    }

    // ---------- 心跳（每整点一次；静默 ≠ 没事；进程挂了不会有人收到这条） ----------
    // Bug 3 修复：多实例容器部署时 heartbeatTick 没有 PG lock → 每整点 N 条心跳刷屏
    // 改成和 digest.sendOnce 一样的 advisory lock 模式，逐群拿 campus:feishu:heartbeat:${chatId}:${hour} 锁

    private sentHeartbeat = new Map<string, string>();

    private async heartbeatTick(): Promise<void> {
        if (!campusHhmm(Date.now()).endsWith(':00')) return; // 只在每整点触发
        const hh = campusHhmm(Date.now()).slice(0, 2);
        const hour = `${campusDayKey(Date.now())}-${hh}`;
        // Bug 5/6 模式安全 GC sentHeartbeat
        this.gcSentHeartbeat();

        for (const [chatId] of Object.entries(this.cfg.settings.chats)) {
            if (this.sentHeartbeat.get(chatId) === hour) continue;

            // 和 digest 同模式：拿 PG advisory lock，拿不到说明别的实例在发 → 跳过
            const runner = this.connection.rawConnection.createQueryRunner();
            await runner.connect();
            const lockKey = `campus:feishu:heartbeat:${chatId}:${hour}`;
            try {
                const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
                const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
                if (!rows?.[0]?.ok) continue; // 别的实例拿了锁，跳过
                try {
                    if (this.sentHeartbeat.get(chatId) === hour) continue; // double-check
                    const text = await this.buildHeartbeat();
                    if (await this.client.sendToChat(chatId, text)) {
                        this.sentHeartbeat.set(chatId, hour);
                    }
                } finally {
                    await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
                }
            } finally {
                await runner.release();
            }
        }
    }

    // Bug 3 配套：sentHeartbeat 是进程内 Map，理论上永远有新 hour 写入，但清理旧数据避免 Map 膨胀
    private gcSentHeartbeat(): void {
        const expired: string[] = [];
        const keep = campusDayKey(Date.now());
        for (const [k, v] of this.sentHeartbeat) {
            if (!v.startsWith(keep)) expired.push(k);
        }
        for (const k of expired) this.sentHeartbeat.delete(k);
    }

    /** 轻量心跳：活动中订单数（非终态）+ 店铺数 + 系统时间戳，一次 COUNT 搞定 */
    private async buildHeartbeat(): Promise<string> {
        const [active, channels] = await Promise.all([
            this.connection.rawConnection.query(
                `SELECT COUNT(*)::int AS n FROM "order"
                 WHERE "customFieldsHallstatus" NOT IN ('delivered','cancelled','exception_final')`,
            ).then((r: any) => Number(r?.[0]?.n ?? 0)).catch(() => -1),
            this.connection.rawConnection.query(
                `SELECT COUNT(*)::int AS n FROM "channel" WHERE "enabled"=true AND "code"<>'__default_channel__'`,
            ).then((r: any) => Number(r?.[0]?.n ?? 0)).catch(() => -1),
        ]);
        const ts = campusHhmm(Date.now());
        return `💓 服务健康 · ${campusDayKey(Date.now())} ${ts} · 活动单 ${active === -1 ? 'DB查询异常' : active} · 店铺 ${channels === -1 ? '?' : channels}`;
    }
}
