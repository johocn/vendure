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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcoReporter = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 生态行为上报器（三处复用：purchase / distribute / view_product|view_price 转发端点）。
 * 契约（与游戏服务器 eco-events 服务对齐）：
 * - POST {gameUrl}/api/client/v1/eco/events
 * - 请求头：X-Eco-Sign = hex(hmac_sha256(secret, rawBody + "|" + timestamp))、X-Eco-Ts = unix 秒
 * - 服务端用 req.rawBody 原文验签，因此发送体与签名体必须是同一字符串（固定键序 JSON.stringify）
 * fire-and-forget：2s 超时 + 失败仅 console.warn，绝不抛出、绝不影响主流程。
 */
let EcoReporter = class EcoReporter {
    constructor(options) {
        this.options = options;
    }
    get gameUrl() {
        return this.options.gameUrl || process.env.GAME_ECO_URL || '';
    }
    get secret() {
        return this.options.secret || process.env.GAME_ECO_SECRET || '';
    }
    /**
     * 上报一个生态行为（fire-and-forget）。ssoId 取不到或未配置 URL/密钥时静默跳过。
     */
    report(ssoId, action, targetId, extra) {
        if (!ssoId || !targetId) {
            return;
        }
        if (!this.gameUrl || !this.secret) {
            core_1.Logger.warn(`GAME_ECO_URL/GAME_ECO_SECRET 未配置，跳过生态上报 action=${action} ssoId=${ssoId}`, constants_1.loggerCtx);
            return;
        }
        const body = {
            action,
            scope: this.options.scope || 'youshop',
            ssoId,
            targetId,
            extra: extra !== null && extra !== void 0 ? extra : {},
        };
        void this.post(body).catch(err => core_1.Logger.warn(`生态上报失败 action=${body.action} ssoId=${body.ssoId}: ${err.message}`, constants_1.loggerCtx));
    }
    async post(body) {
        var _a;
        const ts = Math.floor(Date.now() / 1000);
        // 固定键序（对象键按插入顺序）序列化；发送原文即签名原文
        const rawBody = JSON.stringify(body);
        const sign = (0, crypto_1.createHmac)('sha256', this.secret)
            .update(`${rawBody}|${ts}`)
            .digest('hex');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), (_a = this.options.timeoutMs) !== null && _a !== void 0 ? _a : 2000);
        try {
            const res = await fetch(`${this.gameUrl.replace(/\/+$/, '')}/${constants_1.ECO_EVENTS_PATH}`, {
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
                core_1.Logger.warn(`生态上报 HTTP ${res.status} action=${body.action} ssoId=${body.ssoId}`, constants_1.loggerCtx);
            }
        }
        finally {
            clearTimeout(timer);
        }
    }
};
exports.EcoReporter = EcoReporter;
exports.EcoReporter = EcoReporter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.ECO_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], EcoReporter);
//# sourceMappingURL=eco-reporter.service.js.map