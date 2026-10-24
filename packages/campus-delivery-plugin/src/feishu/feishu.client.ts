import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { createHmac } from 'crypto';

import { FeishuConfigService } from './feishu.config';

const loggerCtx = 'Feishu';
const API_BASE = 'https://open.feishu.cn/open-apis';
const HTTP_TIMEOUT_MS = 5000;

/** 自定义群机器人签名：base64(hmac_sha256(key = `${timestamp}\n${secret}`, data = '')) */
export function buildWebhookSignature(timestamp: string, secret: string): string {
    return createHmac('sha256', `${timestamp}\n${secret}`).update('').digest('base64');
}

export function buildWebhookPayload(text: string, secret?: string, now = Date.now()): Record<string, unknown> {
    const payload: Record<string, unknown> = { msg_type: 'text', content: { text } };
    if (secret) {
        const timestamp = String(Math.floor(now / 1000));
        payload.timestamp = timestamp;
        payload.sign = buildWebhookSignature(timestamp, secret);
    }
    return payload;
}

async function postJson(url: string, body: unknown, timeoutMs = HTTP_TIMEOUT_MS): Promise<any | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        const json: any = await res.json().catch(() => null);
        return res.ok ? json : { __httpStatus: res.status, ...(json ?? {}) };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 飞书发送通道：
 * - 群自定义机器人 webhook（只能发，最简单，用于运维群推送）
 * - 自建应用 bot（tenant_access_token，可定向回复任意已加入的群）
 * 失败只记日志并返回 false，绝不抛到订单主流程。
 */
@Injectable()
export class FeishuClient {
    private token?: { value: string; expiresAt: number };
    private inflight?: Promise<string | null>;

    constructor(private cfg: FeishuConfigService) {}

    get enabled(): boolean {
        return this.cfg.enabled;
    }

    /** 推送到群自定义机器人（or 单群 webhook） */
    async sendWebhook(text: string): Promise<boolean> {
        const { webhook, secret } = this.cfg.settings;
        if (!webhook) return false;
        try {
            const json = await postJson(webhook, buildWebhookPayload(text, secret));
            const code = json?.code ?? json?.StatusCode;
            if (json && (code === 0 || code === undefined) && !json.__httpStatus) return true;
            Logger.warn(`飞书 webhook 发送失败：code=${code ?? 'n/a'} msg=${json?.msg ?? json?.StatusMessage ?? 'n/a'}`, loggerCtx);
            return false;
        } catch (e: any) {
            Logger.warn(`飞书 webhook 发送异常：${e?.message ?? e}`, loggerCtx);
            return false;
        }
    }

    /** 以自建应用身份发到指定群；未配置应用时退回 webhook */
    async sendToChat(chatId: string, text: string): Promise<boolean> {
        const { appId, appSecret } = this.cfg.settings;
        if (!appId || !appSecret) return this.sendWebhook(text);
        const token = await this.tenantToken();
        if (!token) return false;
        try {
            const url = `${API_BASE}/im/v1/messages?receive_id_type=chat_id`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    receive_id: chatId,
                    msg_type: 'text',
                    content: JSON.stringify({ text }),
                }),
                signal: ctrl.signal,
            }).finally(() => clearTimeout(timer));
            const json: any = await res.json().catch(() => null);
            if (res.ok && (json?.code === 0 || json?.code === undefined)) return true;
            Logger.warn(`飞书消息发送失败：http=${res.status} code=${json?.code ?? 'n/a'} msg=${json?.msg ?? 'n/a'}`, loggerCtx);
            return false;
        } catch (e: any) {
            Logger.warn(`飞书消息发送异常：${e?.message ?? e}`, loggerCtx);
            return false;
        }
    }

    /** 广播：优先发到所有已映射群；没有群映射时退回 webhook */
    async broadcast(text: string): Promise<boolean> {
        if (!this.enabled) return false;
        const chats = Object.keys(this.cfg.settings.chats);
        if (chats.length === 0) return this.sendWebhook(text);
        let ok = false;
        for (const chatId of chats) {
            if (await this.sendToChat(chatId, text)) ok = true;
        }
        return ok;
    }

    /** tenant_access_token 缓存（提前 5 分钟过期），单飞防并发重复取 */
    private async tenantToken(): Promise<string | null> {
        const { appId, appSecret } = this.cfg.settings;
        if (!appId || !appSecret) return null;
        const now = Date.now();
        if (this.token && this.token.expiresAt > now) return this.token.value;
        if (this.inflight) return this.inflight;
        this.inflight = (async () => {
            try {
                const json = await postJson(`${API_BASE}/auth/v3/tenant_access_token/internal`, {
                    app_id: appId,
                    app_secret: appSecret,
                });
                if (!json?.tenant_access_token) {
                    Logger.warn(`获取 tenant_access_token 失败：code=${json?.code ?? 'n/a'} msg=${json?.msg ?? 'n/a'}`, loggerCtx);
                    return null;
                }
                const ttl = Number(json.expire ?? 7200) * 1000;
                this.token = { value: json.tenant_access_token, expiresAt: now + ttl - 5 * 60_000 };
                return json.tenant_access_token;
            } catch (e: any) {
                Logger.warn(`获取 tenant_access_token 异常：${e?.message ?? e}`, loggerCtx);
                return null;
            } finally {
                this.inflight = undefined;
            }
        })();
        return this.inflight;
    }
}
