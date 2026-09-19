import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { createHmac } from 'crypto';

import { ECO_EVENTS_PATH, ECO_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { EcoAction, EcoPluginOptions } from './types';

export interface EcoReportBody {
    action: string;
    scope: string;
    ssoId: string;
    targetId: string;
    extra?: Record<string, any>;
}

/**
 * 生态行为上报器（三处复用：purchase / distribute / view_product|view_price 转发端点）。
 * 契约（与游戏服务器 eco-events 服务对齐）：
 * - POST {gameUrl}/api/client/v1/eco/events
 * - 请求头：X-Eco-Sign = hex(hmac_sha256(secret, rawBody + "|" + timestamp))、X-Eco-Ts = unix 秒
 * - 服务端用 req.rawBody 原文验签，因此发送体与签名体必须是同一字符串（固定键序 JSON.stringify）
 * fire-and-forget：2s 超时 + 失败仅 console.warn，绝不抛出、绝不影响主流程。
 */
@Injectable()
export class EcoReporter {
    constructor(@Inject(ECO_PLUGIN_OPTIONS) private options: EcoPluginOptions) {}

    private get gameUrl(): string {
        return this.options.gameUrl || process.env.GAME_ECO_URL || '';
    }

    private get secret(): string {
        return this.options.secret || process.env.GAME_ECO_SECRET || '';
    }

    /**
     * 上报一个生态行为（fire-and-forget）。ssoId 取不到或未配置 URL/密钥时静默跳过。
     */
    report(
        ssoId: string | undefined,
        action: EcoAction,
        targetId: string,
        extra?: Record<string, any>,
    ): void {
        if (!ssoId || !targetId) {
            return;
        }
        if (!this.gameUrl || !this.secret) {
            Logger.warn(
                `GAME_ECO_URL/GAME_ECO_SECRET 未配置，跳过生态上报 action=${action} ssoId=${ssoId}`,
                loggerCtx,
            );
            return;
        }
        const body: EcoReportBody = {
            action,
            scope: this.options.scope || 'youshop',
            ssoId,
            targetId,
            extra: extra ?? {},
        };
        void this.post(body).catch(err =>
            Logger.warn(
                `生态上报失败 action=${body.action} ssoId=${body.ssoId}: ${(err as Error).message}`,
                loggerCtx,
            ),
        );
    }

    private async post(body: EcoReportBody): Promise<void> {
        const ts = Math.floor(Date.now() / 1000);
        // 固定键序（对象键按插入顺序）序列化；发送原文即签名原文
        const rawBody = JSON.stringify(body);
        const sign = createHmac('sha256', this.secret).update(`${rawBody}|${ts}`).digest('hex');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 2000);
        try {
            const res = await fetch(`${this.gameUrl.replace(/\/+$/, '')}/${ECO_EVENTS_PATH}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Eco-Sign': sign,
                    'X-Eco-Ts': String(ts),
                },
                body: rawBody,
                signal: controller.signal,
            });
            if (!res.ok) {
                Logger.warn(
                    `生态上报 HTTP ${res.status} action=${body.action} ssoId=${body.ssoId}`,
                    loggerCtx,
                );
            }
        } finally {
            clearTimeout(timer);
        }
    }
}
