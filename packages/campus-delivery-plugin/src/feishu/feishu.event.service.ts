import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import { FeishuCommandService } from './feishu.command.service';
import { FeishuConfigService } from './feishu.config';
import { decryptFeishuPayload } from './feishu.crypto';

const loggerCtx = 'Feishu';
const EVENT_DEDUPE_MS = 10 * 60_000;

export interface FeishuEventResult {
    status: number;
    body: Record<string, unknown>;
}

/**
 * 飞书事件订阅入口：URL 验证（challenge）→ 可选解密 → token 校验 → event_id 去重 → 异步执行指令。
 * 先返回 200 再处理业务：飞书 3 秒超时会重试，重试叠加接单/退款很难看；真正的幂等由领域层保证。
 */
@Injectable()
export class FeishuEventService {
    private seen = new Map<string, number>();

    constructor(private cfg: FeishuConfigService, private command: FeishuCommandService) {}

    async handle(raw: any): Promise<FeishuEventResult> {
        if (!this.cfg.enabled) return { status: 200, body: {} };

        const payload = await this.decode(raw);
        if (!payload) return { status: 400, body: { error: 'invalid payload' } };

        const token = payload?.header?.token ?? payload?.token;
        if (this.cfg.settings.verifyToken && token !== this.cfg.settings.verifyToken) {
            Logger.warn('飞书回调 token 校验失败', loggerCtx);
            return { status: 403, body: {} };
        }
        if (payload?.challenge) {
            return { status: 200, body: { challenge: payload.challenge } };
        }
        if (this.cfg.settings.verifyToken && !token) {
            Logger.warn('飞书回调缺少 token', loggerCtx);
            return { status: 403, body: {} };
        }

        const eventId = payload?.header?.event_id as string | undefined;
        if (eventId && this.isDuplicate(eventId)) {
            return { status: 200, body: {} };
        }
        if (payload?.header?.event_type !== 'im.message.receive_v1') {
            return { status: 200, body: {} };
        }

        const event = payload.event ?? {};
        const message = event.message ?? {};
        if (message.message_type !== 'text') return { status: 200, body: {} };
        if (event.sender?.sender_type === 'app') return { status: 200, body: {} };

        let text = '';
        try {
            text = JSON.parse(message.content ?? '{}').text ?? '';
        } catch {
            return { status: 200, body: {} };
        }
        const chatId = message.chat_id as string | undefined;
        const openId = event.sender?.sender_id?.open_id as string | undefined;
        if (!chatId || !openId || !text.trim()) return { status: 200, body: {} };

        void this.command.handleMessage({ chatId, openId, text }).catch(e =>
            Logger.error(`飞书指令处理失败 chat=${chatId}: ${e?.message ?? e}`, loggerCtx),
        );
        return { status: 200, body: {} };
    }

    private async decode(raw: any): Promise<any | null> {
        if (!raw) return null;
        if (raw.encrypt) {
            const key = this.cfg.settings.encryptKey;
            if (!key) {
                Logger.warn('收到加密事件但未配置 FEISHU_ENCRYPT_KEY', loggerCtx);
                return null;
            }
            return decryptFeishuPayload(raw.encrypt, key);
        }
        return raw;
    }

    private isDuplicate(eventId: string): boolean {
        const now = Date.now();
        for (const [k, at] of this.seen) {
            if (now - at > EVENT_DEDUPE_MS) this.seen.delete(k);
        }
        if (this.seen.has(eventId)) return true;
        this.seen.set(eventId, now);
        return false;
    }
}
