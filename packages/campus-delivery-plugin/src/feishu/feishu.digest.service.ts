import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Logger, TransactionalConnection } from '@vendure/core';

import { campusDayKey, CAMPUS_TZ_OFFSET_MS } from '../campus-time';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
import { FeishuClient } from './feishu.client';
import { FeishuCommandService } from './feishu.command.service';

const loggerCtx = 'Feishu';
const DIGEST_TABLE = 'feishu_digest_state';

/** 当前校园时区 HH:mm */
export function campusHhmm(t: number): string {
    const d = new Date(t + CAMPUS_TZ_OFFSET_MS);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 到达汇总时间且今天未发 → 逐群推送当天经营汇总（advisory lock + 落库标记，防多进程/重发） */
@Injectable()
export class FeishuDigestService implements OnApplicationShutdown {
    private timer?: NodeJS.Timeout;
    private running = false;
    private ready = false;

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
            if (!this.ready) {
                await this.ensureStateTable();
                this.ready = true;
            }
            for (const [chatId, chat] of Object.entries(this.cfg.settings.chats)) {
                await this.sendOnce(chatId, chat);
            }
        } finally {
            this.running = false;
        }
    }

    private async sendOnce(chatId: string, chat: FeishuChatConfig): Promise<void> {
        const day = campusDayKey(Date.now());
        if (await this.sentOn(chatId, day)) return;

        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:feishu:digest:${chatId}:${day}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) return;
            try {
                if (await this.sentOn(chatId, day)) return;
                const text = await this.buildDigest(chat);
                if (await this.client.sendToChat(chatId, text)) {
                    await this.markSent(chatId, day);
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

    private async ensureStateTable(): Promise<void> {
        await this.connection.rawConnection.query(
            `CREATE TABLE IF NOT EXISTS "${DIGEST_TABLE}" ("chatId" varchar PRIMARY KEY, "sentDay" varchar NOT NULL, "sentAt" timestamp NOT NULL DEFAULT now())`,
        );
    }

    private async sentOn(chatId: string, day: string): Promise<boolean> {
        try {
            const rows: any = await this.connection.rawConnection.query(
                `SELECT "sentDay" FROM "${DIGEST_TABLE}" WHERE "chatId" = $1`,
                [chatId],
            );
            const row = Array.isArray(rows) ? rows[0] : undefined;
            return row?.sentDay === day;
        } catch {
            return false;
        }
    }

    private async markSent(chatId: string, day: string): Promise<void> {
        await this.connection.rawConnection.query(
            `INSERT INTO "${DIGEST_TABLE}" ("chatId", "sentDay", "sentAt") VALUES ($1, $2, now())
             ON CONFLICT ("chatId") DO UPDATE SET "sentDay" = $2, "sentAt" = now()`,
            [chatId, day],
        );
    }
}
