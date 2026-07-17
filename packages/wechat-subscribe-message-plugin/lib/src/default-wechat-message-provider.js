"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultWechatMessageProvider = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
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
let DefaultWechatMessageProvider = class DefaultWechatMessageProvider {
    constructor() {
        this.tokenCache = new Map();
    }
    async getAccessToken(ctx, channelId) {
        var _a;
        const cacheKey = String(channelId);
        const cached = this.tokenCache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAt - now > 60000) {
            return cached.token;
        }
        const { appId, appSecret } = this.readCredentials(ctx);
        if (!appId || !appSecret) {
            throw new Error(`Wechat appId/appSecret not configured for channel ${channelId} (channel.customFields.authConfig.overrides.wechat)`);
        }
        const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
        const resp = await fetch(url, { method: 'GET' });
        const data = (await resp.json());
        if (!data.access_token) {
            throw new Error(`Failed to fetch wechat access_token: errcode=${data.errcode} errmsg=${data.errmsg}`);
        }
        const expiresIn = Number((_a = data.expires_in) !== null && _a !== void 0 ? _a : 7200);
        const entry = {
            token: data.access_token,
            expiresAt: now + expiresIn * 1000,
        };
        this.tokenCache.set(cacheKey, entry);
        return entry.token;
    }
    async sendSubscribeMessage(ctx, input) {
        var _a, _b, _c;
        let accessToken;
        try {
            accessToken = await this.getAccessToken(ctx, String(ctx.channelId));
        }
        catch (e) {
            return { success: false, error: (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : String(e) };
        }
        const body = {
            touser: input.openid,
            template_id: input.templateId,
            data: input.data,
        };
        if (input.page)
            body.page = input.page;
        if (input.miniprogramState)
            body.miniprogram_state = input.miniprogramState;
        try {
            const resp = await fetch(`${SEND_URL}?access_token=${encodeURIComponent(accessToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = (await resp.json());
            if (data.errcode !== 0) {
                return {
                    success: false,
                    error: `errcode=${data.errcode} errmsg=${data.errmsg}`,
                };
            }
            return { success: true, msgId: String((_b = data.msgid) !== null && _b !== void 0 ? _b : '') };
        }
        catch (e) {
            return { success: false, error: (_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : String(e) };
        }
    }
    /**
     * 强制刷新某 channel 的 access_token 缓存（暴露给上层在 401/invalid token 时调用）。
     */
    invalidate(channelId) {
        this.tokenCache.delete(String(channelId));
    }
    readCredentials(ctx) {
        var _a, _b;
        const authConfig = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.authConfig;
        if (!authConfig) {
            return { appId: '', appSecret: '' };
        }
        const overridesJson = authConfig.overridesJson;
        if (!overridesJson) {
            return { appId: '', appSecret: '' };
        }
        let overrides;
        try {
            overrides = JSON.parse(overridesJson);
        }
        catch (_c) {
            core_1.Logger.warn(`Failed to parse authConfig.overridesJson for channel ${ctx.channelId}`, constants_1.loggerCtx);
            return { appId: '', appSecret: '' };
        }
        const wechat = overrides === null || overrides === void 0 ? void 0 : overrides.wechat;
        if (!(wechat === null || wechat === void 0 ? void 0 : wechat.appId) || !(wechat === null || wechat === void 0 ? void 0 : wechat.appSecret)) {
            return { appId: '', appSecret: '' };
        }
        return {
            appId: wechat.appId,
            appSecret: this.maybeDecrypt(wechat.appSecret),
        };
    }
    maybeDecrypt(value) {
        var _a;
        if (!value || !value.startsWith(ENC_PREFIX))
            return value;
        try {
            const [, ivHex, tagHex, encHex] = value.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const tag = Buffer.from(tagHex, 'hex');
            const enc = Buffer.from(encHex, 'hex');
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', this.getCryptoKey(), iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
        }
        catch (e) {
            core_1.Logger.warn(`Failed to decrypt wechat appSecret: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            return '';
        }
    }
    getCryptoKey() {
        const secret = process.env.AUTH_SECRET || 'default-dev-key-change-in-prod';
        return (0, crypto_1.scryptSync)(secret, 'vendure-auth-salt', 32);
    }
};
exports.DefaultWechatMessageProvider = DefaultWechatMessageProvider;
exports.DefaultWechatMessageProvider = DefaultWechatMessageProvider = __decorate([
    (0, common_1.Injectable)()
], DefaultWechatMessageProvider);
//# sourceMappingURL=default-wechat-message-provider.js.map