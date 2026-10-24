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
exports.FeishuConfigService = void 0;
exports.parseChatMap = parseChatMap;
exports.readFeishuSettings = readFeishuSettings;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const loggerCtx = 'Feishu';
function splitIds(v) {
    return (v !== null && v !== void 0 ? v : '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}
/** 解析 FEISHU_CHAT_MAP（坏 JSON 只告警并退回空表，绝不抛错） */
function parseChatMap(raw) {
    if (!raw || !raw.trim())
        return {};
    try {
        const parsed = JSON.parse(raw);
        const out = {};
        for (const [chatId, v] of Object.entries(parsed !== null && parsed !== void 0 ? parsed : {})) {
            const item = v;
            if (!item)
                continue;
            // channel='*' 或 scope='platform' 表示平台管理群（跨店铺）
            const platform = item.scope === 'platform' || item.channel === '*';
            const channel = typeof item.channel === 'string' && item.channel !== '*' ? item.channel : undefined;
            if (!platform && !channel)
                continue;
            out[chatId] = {
                scope: platform ? 'platform' : 'channel',
                channel,
                operators: Array.isArray(item.operators)
                    ? item.operators.map(String)
                    : splitIds(item.operators),
                owners: Array.isArray(item.owners) ? item.owners.map(String) : splitIds(item.owners),
            };
        }
        return out;
    }
    catch (e) {
        core_1.Logger.error(`FEISHU_CHAT_MAP 解析失败，指令功能将不可用：${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
        return {};
    }
}
function readFeishuSettings(env = process.env) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const enabled = String((_a = env.FEISHU_ENABLED) !== null && _a !== void 0 ? _a : '').toLowerCase() === 'true'
        || String((_b = env.FEISHU_ENABLED) !== null && _b !== void 0 ? _b : '') === '1';
    const settings = {
        enabled,
        webhook: ((_c = env.FEISHU_WEBHOOK) === null || _c === void 0 ? void 0 : _c.trim()) || undefined,
        secret: ((_d = env.FEISHU_SECRET) === null || _d === void 0 ? void 0 : _d.trim()) || undefined,
        appId: ((_e = env.FEISHU_APP_ID) === null || _e === void 0 ? void 0 : _e.trim()) || undefined,
        appSecret: ((_f = env.FEISHU_APP_SECRET) === null || _f === void 0 ? void 0 : _f.trim()) || undefined,
        verifyToken: ((_g = env.FEISHU_VERIFY_TOKEN) === null || _g === void 0 ? void 0 : _g.trim()) || undefined,
        encryptKey: ((_h = env.FEISHU_ENCRYPT_KEY) === null || _h === void 0 ? void 0 : _h.trim()) || undefined,
        chats: parseChatMap(env.FEISHU_CHAT_MAP),
        digestAt: /^\d{2}:\d{2}$/.test((_j = env.FEISHU_DIGEST_AT) !== null && _j !== void 0 ? _j : '') ? String(env.FEISHU_DIGEST_AT) : '08:30',
    };
    if (!enabled)
        return settings;
    const hasSend = !!(settings.webhook || (settings.appId && settings.appSecret));
    const hasReceive = !!(settings.appId && settings.appSecret && settings.verifyToken);
    if (!hasSend && !hasReceive) {
        core_1.Logger.error('FEISHU_ENABLED=true 但未配置发送通道（FEISHU_WEBHOOK 或 FEISHU_APP_ID/SECRET），飞书功能禁用', loggerCtx);
        settings.enabled = false;
    }
    else if (!hasSend) {
        core_1.Logger.warn('飞书接收通道已配置但缺发送通道，推送与回复将不可用', loggerCtx);
    }
    return settings;
}
let FeishuConfigService = class FeishuConfigService {
    constructor() {
        this.settings = readFeishuSettings(process.env);
        if (this.settings.enabled) {
            const mode = this.settings.webhook ? 'webhook' : 'app';
            core_1.Logger.info(`飞书已启用（${mode}，群数 ${Object.keys(this.settings.chats).length}）`, loggerCtx);
        }
    }
    get enabled() {
        return this.settings.enabled;
    }
    chatOf(chatId) {
        return this.settings.chats[chatId];
    }
};
exports.FeishuConfigService = FeishuConfigService;
exports.FeishuConfigService = FeishuConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FeishuConfigService);
//# sourceMappingURL=feishu.config.js.map