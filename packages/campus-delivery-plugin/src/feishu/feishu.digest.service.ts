import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, TransactionalConnection } from '@vendure/core';

import { campusDayKey, CAMPUS_TZ_OFFSET_MS, startOfCampusDay } from '../campus-time';
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
    private timer?: NodeJS.Timeout;
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
        if (this.timer || !this.client.enabled) return;
        this.timer = setInterval(() => {
            void this.tick().catch(e => Logger.error(`digest tick: ${e?.message ?? e}`, loggerCtx));
        }, intervalMs);
        Logger.info(`每日汇总已启用，时间 ${this.cfg.settings.digestAt}（UTC+8）`, loggerCtx);
    }

    onApplicationShutdown(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
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
}
