"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuClient = void 0;
exports.buildWebhookSignature = buildWebhookSignature;
exports.buildWebhookPayload = buildWebhookPayload;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = require("crypto");
const feishu_config_1 = require("./feishu.config");
const loggerCtx = 'Feishu';
const API_BASE = 'https://open.feishu.cn/open-apis';
const HTTP_TIMEOUT_MS = 5000;
/** 自定义群机器人签名：base64(hmac_sha256(key = `${timestamp}\n${secret}`, data = '')) */
function buildWebhookSignature(timestamp, secret) {
    return (0, crypto_1.createHmac)('sha256', `${timestamp}\n${secret}`).update('').digest('base64');
}
function buildWebhookPayload(text, secret, now = Date.now()) {
    const payload = { msg_type: 'text', content: { text } };
    if (secret) {
        const timestamp = String(Math.floor(now / 1000));
        payload.timestamp = timestamp;
        payload.sign = buildWebhookSignature(timestamp, secret);
    }
    return payload;
}
async function postJson(url, body, timeoutMs = HTTP_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        const json = await res.json().catch(() => null);
        return res.ok ? json : Object.assign({ __httpStatus: res.status }, (json !== null && json !== void 0 ? json : {}));
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * 飞书发送通道：
 * - 群自定义机器人 webhook（只能发，最简单，用于运维群推送）
 * - 自建应用 bot（tenant_access_token，可定向回复任意已加入的群）
 * 失败只记日志并返回 false，绝不抛到订单主流程。
 */
let FeishuClient = class FeishuClient {
    constructor(cfg) {
        this.cfg = cfg;
    }
    get enabled() {
        return this.cfg.enabled;
    }
    /** 推送到群自定义机器人（or 单群 webhook） */
    async sendWebhook(text) {
        var _a, _b, _c, _d;
        const { webhook, secret } = this.cfg.settings;
        if (!webhook)
            return false;
        try {
            const json = await postJson(webhook, buildWebhookPayload(text, secret));
            const code = (_a = json === null || json === void 0 ? void 0 : json.code) !== null && _a !== void 0 ? _a : json === null || json === void 0 ? void 0 : json.StatusCode;
            if (json && (code === 0 || code === undefined) && !json.__httpStatus)
                return true;
            core_1.Logger.warn(`飞书 webhook 发送失败：code=${code !== null && code !== void 0 ? code : 'n/a'} msg=${(_c = (_b = json === null || json === void 0 ? void 0 : json.msg) !== null && _b !== void 0 ? _b : json === null || json === void 0 ? void 0 : json.StatusMessage) !== null && _c !== void 0 ? _c : 'n/a'}`, loggerCtx);
            return false;
        }
        catch (e) {
            core_1.Logger.warn(`飞书 webhook 发送异常：${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, loggerCtx);
            return false;
        }
    }
    /** 以自建应用身份发到指定群；未配置应用时退回 webhook */
    async sendToChat(chatId, text) {
        var _a, _b, _c;
        const { appId, appSecret } = this.cfg.settings;
        if (!appId || !appSecret)
            return this.sendWebhook(text);
        const token = await this.tenantToken();
        if (!token)
            return false;
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
            const json = await res.json().catch(() => null);
            if (res.ok && ((json === null || json === void 0 ? void 0 : json.code) === 0 || (json === null || json === void 0 ? void 0 : json.code) === undefined))
                return true;
            core_1.Logger.warn(`飞书消息发送失败：http=${res.status} code=${(_a = json === null || json === void 0 ? void 0 : json.code) !== null && _a !== void 0 ? _a : 'n/a'} msg=${(_b = json === null || json === void 0 ? void 0 : json.msg) !== null && _b !== void 0 ? _b : 'n/a'}`, loggerCtx);
            return false;
        }
        catch (e) {
            core_1.Logger.warn(`飞书消息发送异常：${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, loggerCtx);
            return false;
        }
    }
    /** 广播：优先发到所有已映射群；没有群映射时退回 webhook */
    async broadcast(text) {
        if (!this.enabled)
            return false;
        const chats = Object.keys(this.cfg.settings.chats);
        if (chats.length === 0)
            return this.sendWebhook(text);
        let ok = false;
        for (const chatId of chats) {
            if (await this.sendToChat(chatId, text))
                ok = true;
        }
        return ok;
    }
    /** tenant_access_token 缓存（提前 5 分钟过期），单飞防并发重复取 */
    async tenantToken() {
        const { appId, appSecret } = this.cfg.settings;
        if (!appId || !appSecret)
            return null;
        const now = Date.now();
        if (this.token && this.token.expiresAt > now)
            return this.token.value;
        if (this.inflight)
            return this.inflight;
        this.inflight = (async () => {
            var _a, _b, _c, _d;
            try {
                const json = await postJson(`${API_BASE}/auth/v3/tenant_access_token/internal`, {
                    app_id: appId,
                    app_secret: appSecret,
                });
                if (!(json === null || json === void 0 ? void 0 : json.tenant_access_token)) {
                    core_1.Logger.warn(`获取 tenant_access_token 失败：code=${(_a = json === null || json === void 0 ? void 0 : json.code) !== null && _a !== void 0 ? _a : 'n/a'} msg=${(_b = json === null || json === void 0 ? void 0 : json.msg) !== null && _b !== void 0 ? _b : 'n/a'}`, loggerCtx);
                    return null;
                }
                const ttl = Number((_c = json.expire) !== null && _c !== void 0 ? _c : 7200) * 1000;
                this.token = { value: json.tenant_access_token, expiresAt: now + ttl - 5 * 60000 };
                return json.tenant_access_token;
            }
            catch (e) {
                core_1.Logger.warn(`获取 tenant_access_token 异常：${(_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e}`, loggerCtx);
                return null;
            }
            finally {
                this.inflight = undefined;
            }
        })();
        return this.inflight;
    }
};
exports.FeishuClient = FeishuClient;
exports.FeishuClient = FeishuClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_config_1.FeishuConfigService])
], FeishuClient);
//# sourceMappingURL=feishu.client.js.map