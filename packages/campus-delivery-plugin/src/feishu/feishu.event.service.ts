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

        // 卡片回调的事件体有时把 token 放在 event.token，两处都取
        const token = payload?.header?.token ?? payload?.event?.token ?? payload?.token;
        // URL 验证是纯握手（不回显任何业务数据），先放行，避免控制台保存回调地址被 token 挡住
        if (payload?.challenge) {
            return { status: 200, body: { challenge: payload.challenge } };
        }
        // fail closed：未配置 verifyToken 时任何人都能伪造回调，直接拒绝
        const allowed = this.verifyTokens();
        if (!allowed.length) {
            Logger.error('未配置 FEISHU_VERIFY_TOKEN，拒绝飞书回调', loggerCtx);
            return { status: 403, body: {} };
        }
        if (typeof token !== 'string' || !allowed.includes(token)) {
            // 不打印 token 原文，只暴露事件类型与长度便于排查是哪个回调的验证令牌
            Logger.warn(
                `飞书回调 token 校验失败 type=${payload?.header?.event_type ?? '-'} tokenLen=${
                    typeof token === 'string' ? token.length : 'none'
                }`,
                loggerCtx,
            );
            return { status: 403, body: {} };
        }

        const eventId = payload?.header?.event_id as string | undefined;
        if (eventId && this.isDuplicate(eventId)) {
            return { status: 200, body: {} };
        }

        const eventType = payload?.header?.event_type as string | undefined;
        if (eventType === 'card.action.trigger') {
            return this.handleCardAction(payload.event ?? {});
        }
        if (eventType !== 'im.message.receive_v1') {
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

        void this.command
            .handleMessage({
                chatId,
                openId,
                text,
                parentId: message.parent_id as string | undefined,
                rootId: message.root_id as string | undefined,
            })
            .catch(e => Logger.error(`飞书指令处理失败 chat=${chatId}: ${e?.message ?? e}`, loggerCtx));
        return { status: 200, body: {} };
    }

    /** 卡片按钮回调：value 里带着完整单号，直接转指令服务（先 200 再异步执行） */
    private handleCardAction(event: any): FeishuEventResult {
        const chatId = event.context?.open_chat_id ?? event.open_chat_id;
        const openId = event.operator?.open_id ?? event.open_id;
        const messageId = event.context?.open_message_id ?? event.open_message_id;
        const value = event.action?.value;
        if (!chatId || !openId || !value) return { status: 200, body: {} };

        void this.command
            .handleCardAction({ chatId, openId, value, messageId })
            .catch(e => Logger.error(`飞书卡片操作失败 chat=${chatId}: ${e?.message ?? e}`, loggerCtx));
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

    /** 事件订阅与卡片回调可能各有一份验证令牌，支持用逗号并列配置 */
    private verifyTokens(): string[] {
        return String(this.cfg.settings.verifyToken ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }

    // Bug 5 修复：Map 遍历时 delete 会跳过下一个元素，导致每次只清一半过期 key
    // 改成先收集要删的 key 数组，遍历完统一 delete
    private isDuplicate(eventId: string): boolean {
        const now = Date.now();
        const expired: string[] = [];
        for (const [k, at] of this.seen) {
            if (now - at > EVENT_DEDUPE_MS) expired.push(k);
        }
        for (const k of expired) this.seen.delete(k);
        if (this.seen.has(eventId)) return true;
        this.seen.set(eventId, now);
        return false;
    }
}
