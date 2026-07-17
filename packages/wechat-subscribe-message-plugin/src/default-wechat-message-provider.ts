import { createDecipheriv, scryptSync } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Logger, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';
import {
    SendSubscribeMessageInput,
    SendSubscribeMessageResult,
    WechatMessageProvider,
} from './wechat-message-provider';

interface AccessTokenCacheEntry {
    token: string;
    expiresAt: number;
}

interface WechatCredentials {
    appId: string;
    appSecret: string;
}

const ENC_PREFIX = 'enc:';
const TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const SEND_URL = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send';

/**
 * 默认微信订阅消息 Provider。
 *
 * 微信 appId/appSecret 从 channel.customFields.authConfig 读取
 * （兼容 cjk-plugin 的 TenantAuthConfig struct，字段路径 overrides.wechat.appId/appSecret）。
 * 若 appSecret 被加密（前缀 enc:），使用 AUTH_SECRET 环境变量按 AES-256-GCM 解密，
 * 算法与 cjk-plugin 的 auth/crypto.ts 一致。
 *
 * access_token 按 channelId 缓存于内存，有效期内的 token 直接复用。
 */
@Injectable()
export class DefaultWechatMessageProvider implements WechatMessageProvider {
    private tokenCache = new Map<string, AccessTokenCacheEntry>();

    async getAccessToken(ctx: RequestContext, channelId: string): Promise<string> {
        const cacheKey = String(channelId);
        const cached = this.tokenCache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAt - now > 60_000) {
            return cached.token;
        }

        const { appId, appSecret } = this.readCredentials(ctx);
        if (!appId || !appSecret) {
            throw new Error(
                `Wechat appId/appSecret not configured for channel ${channelId} (channel.customFields.authConfig.overrides.wechat)`,
            );
        }

        const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
        const resp = await fetch(url, { method: 'GET' });
        const data = (await resp.json()) as any;
        if (!data.access_token) {
            throw new Error(
                `Failed to fetch wechat access_token: errcode=${data.errcode} errmsg=${data.errmsg}`,
            );
        }

        const expiresIn = Number(data.expires_in ?? 7200);
        const entry: AccessTokenCacheEntry = {
            token: data.access_token,
            expiresAt: now + expiresIn * 1000,
        };
        this.tokenCache.set(cacheKey, entry);
        return entry.token;
    }

    async sendSubscribeMessage(
        ctx: RequestContext,
        input: SendSubscribeMessageInput,
    ): Promise<SendSubscribeMessageResult> {
        let accessToken: string;
        try {
            accessToken = await this.getAccessToken(ctx, String(ctx.channelId));
        } catch (e: any) {
            return { success: false, error: e?.message ?? String(e) };
        }

        const body: Record<string, unknown> = {
            touser: input.openid,
            template_id: input.templateId,
            data: input.data,
        };
        if (input.page) body.page = input.page;
        if (input.miniprogramState) body.miniprogram_state = input.miniprogramState;

        try {
            const resp = await fetch(`${SEND_URL}?access_token=${encodeURIComponent(accessToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = (await resp.json()) as any;
            if (data.errcode !== 0) {
                return {
                    success: false,
                    error: `errcode=${data.errcode} errmsg=${data.errmsg}`,
                };
            }
            return { success: true, msgId: String(data.msgid ?? '') };
        } catch (e: any) {
            return { success: false, error: e?.message ?? String(e) };
        }
    }

    /**
     * 强制刷新某 channel 的 access_token 缓存（暴露给上层在 401/invalid token 时调用）。
     */
    invalidate(channelId: string): void {
        this.tokenCache.delete(String(channelId));
    }

    private readCredentials(ctx: RequestContext): WechatCredentials {
        const authConfig = (ctx.channel as any)?.customFields?.authConfig;
        if (!authConfig) {
            return { appId: '', appSecret: '' };
        }
        const overridesJson: string | undefined = authConfig.overridesJson;
        if (!overridesJson) {
            return { appId: '', appSecret: '' };
        }
        let overrides: any;
        try {
            overrides = JSON.parse(overridesJson);
        } catch {
            Logger.warn(`Failed to parse authConfig.overridesJson for channel ${ctx.channelId}`, loggerCtx);
            return { appId: '', appSecret: '' };
        }
        const wechat = overrides?.wechat;
        if (!wechat?.appId || !wechat?.appSecret) {
            return { appId: '', appSecret: '' };
        }
        return {
            appId: wechat.appId,
            appSecret: this.maybeDecrypt(wechat.appSecret),
        };
    }

    private maybeDecrypt(value: string): string {
        if (!value || !value.startsWith(ENC_PREFIX)) return value;
        try {
            const [, ivHex, tagHex, encHex] = value.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const tag = Buffer.from(tagHex, 'hex');
            const enc = Buffer.from(encHex, 'hex');
            const decipher = createDecipheriv('aes-256-gcm', this.getCryptoKey(), iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
        } catch (e: any) {
            Logger.warn(`Failed to decrypt wechat appSecret: ${e?.message ?? e}`, loggerCtx);
            return '';
        }
    }

    private getCryptoKey(): Buffer {
        const secret = process.env.AUTH_SECRET || 'default-dev-key-change-in-prod';
        return scryptSync(secret, 'vendure-auth-salt', 32);
    }
}
