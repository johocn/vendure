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
exports.FeishuEventService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const feishu_command_service_1 = require("./feishu.command.service");
const feishu_config_1 = require("./feishu.config");
const feishu_crypto_1 = require("./feishu.crypto");
const loggerCtx = 'Feishu';
const EVENT_DEDUPE_MS = 10 * 60000;
/**
 * 飞书事件订阅入口：URL 验证（challenge）→ 可选解密 → token 校验 → event_id 去重 → 异步执行指令。
 * 先返回 200 再处理业务：飞书 3 秒超时会重试，重试叠加接单/退款很难看；真正的幂等由领域层保证。
 */
let FeishuEventService = class FeishuEventService {
    constructor(cfg, command) {
        this.cfg = cfg;
        this.command = command;
        this.seen = new Map();
    }
    async handle(raw) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!this.cfg.enabled)
            return { status: 200, body: {} };
        const payload = await this.decode(raw);
        if (!payload)
            return { status: 400, body: { error: 'invalid payload' } };
        const token = (_b = (_a = payload === null || payload === void 0 ? void 0 : payload.header) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : payload === null || payload === void 0 ? void 0 : payload.token;
        if (this.cfg.settings.verifyToken && token !== this.cfg.settings.verifyToken) {
            core_1.Logger.warn('飞书回调 token 校验失败', loggerCtx);
            return { status: 403, body: {} };
        }
        if (payload === null || payload === void 0 ? void 0 : payload.challenge) {
            return { status: 200, body: { challenge: payload.challenge } };
        }
        if (this.cfg.settings.verifyToken && !token) {
            core_1.Logger.warn('飞书回调缺少 token', loggerCtx);
            return { status: 403, body: {} };
        }
        const eventId = (_c = payload === null || payload === void 0 ? void 0 : payload.header) === null || _c === void 0 ? void 0 : _c.event_id;
        if (eventId && this.isDuplicate(eventId)) {
            return { status: 200, body: {} };
        }
        if (((_d = payload === null || payload === void 0 ? void 0 : payload.header) === null || _d === void 0 ? void 0 : _d.event_type) !== 'im.message.receive_v1') {
            return { status: 200, body: {} };
        }
        const event = (_e = payload.event) !== null && _e !== void 0 ? _e : {};
        const message = (_f = event.message) !== null && _f !== void 0 ? _f : {};
        if (message.message_type !== 'text')
            return { status: 200, body: {} };
        if (((_g = event.sender) === null || _g === void 0 ? void 0 : _g.sender_type) === 'app')
            return { status: 200, body: {} };
        let text = '';
        try {
            text = (_j = JSON.parse((_h = message.content) !== null && _h !== void 0 ? _h : '{}').text) !== null && _j !== void 0 ? _j : '';
        }
        catch (_m) {
            return { status: 200, body: {} };
        }
        const chatId = message.chat_id;
        const openId = (_l = (_k = event.sender) === null || _k === void 0 ? void 0 : _k.sender_id) === null || _l === void 0 ? void 0 : _l.open_id;
        if (!chatId || !openId || !text.trim())
            return { status: 200, body: {} };
        void this.command.handleMessage({ chatId, openId, text }).catch(e => { var _a; return core_1.Logger.error(`飞书指令处理失败 chat=${chatId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx); });
        return { status: 200, body: {} };
    }
    async decode(raw) {
        if (!raw)
            return null;
        if (raw.encrypt) {
            const key = this.cfg.settings.encryptKey;
            if (!key) {
                core_1.Logger.warn('收到加密事件但未配置 FEISHU_ENCRYPT_KEY', loggerCtx);
                return null;
            }
            return (0, feishu_crypto_1.decryptFeishuPayload)(raw.encrypt, key);
        }
        return raw;
    }
    isDuplicate(eventId) {
        const now = Date.now();
        for (const [k, at] of this.seen) {
            if (now - at > EVENT_DEDUPE_MS)
                this.seen.delete(k);
        }
        if (this.seen.has(eventId))
            return true;
        this.seen.set(eventId, now);
        return false;
    }
};
exports.FeishuEventService = FeishuEventService;
exports.FeishuEventService = FeishuEventService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_config_1.FeishuConfigService, feishu_command_service_1.FeishuCommandService])
], FeishuEventService);
//# sourceMappingURL=feishu.event.service.js.map