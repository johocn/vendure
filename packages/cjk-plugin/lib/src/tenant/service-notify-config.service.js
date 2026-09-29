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
exports.ServiceNotifyConfigService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = require("../auth/crypto");
function parseJson(value) {
    if (!value)
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return undefined;
    }
}
function stringify(value) {
    return value == null ? null : JSON.stringify(value);
}
let ServiceNotifyConfigService = class ServiceNotifyConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    parseStruct(raw) {
        if (!raw)
            return null;
        const out = {};
        if (raw.wecomEnabled != null)
            out.wecomEnabled = raw.wecomEnabled;
        if (raw.wecomAgentId != null)
            out.wecomAgentId = raw.wecomAgentId;
        if (raw.wecomCorpId != null)
            out.wecomCorpId = raw.wecomCorpId;
        if (raw.wecomCorpSecret != null)
            out.wecomCorpSecret = raw.wecomCorpSecret;
        if (raw.wechatPushEnabled != null)
            out.wechatPushEnabled = raw.wechatPushEnabled;
        if (raw.chatChannelEnabled != null)
            out.chatChannelEnabled = raw.chatChannelEnabled;
        const template = parseJson(raw.wechatPushTemplateJson);
        if (template)
            out.wechatPushTemplate = template;
        return Object.keys(out).length > 0 ? out : null;
    }
    serializeDomain(domain) {
        var _a, _b, _c, _d, _e, _f;
        return {
            wecomEnabled: (_a = domain === null || domain === void 0 ? void 0 : domain.wecomEnabled) !== null && _a !== void 0 ? _a : null,
            wecomAgentId: (_b = domain === null || domain === void 0 ? void 0 : domain.wecomAgentId) !== null && _b !== void 0 ? _b : null,
            wecomCorpId: (_c = domain === null || domain === void 0 ? void 0 : domain.wecomCorpId) !== null && _c !== void 0 ? _c : null,
            wecomCorpSecret: (_d = domain === null || domain === void 0 ? void 0 : domain.wecomCorpSecret) !== null && _d !== void 0 ? _d : null,
            wechatPushEnabled: (_e = domain === null || domain === void 0 ? void 0 : domain.wechatPushEnabled) !== null && _e !== void 0 ? _e : null,
            wechatPushTemplateJson: stringify(domain === null || domain === void 0 ? void 0 : domain.wechatPushTemplate),
            chatChannelEnabled: (_f = domain === null || domain === void 0 ? void 0 : domain.chatChannelEnabled) !== null && _f !== void 0 ? _f : null,
        };
    }
    mask(raw) {
        return Object.assign(Object.assign({}, raw), { wecomCorpSecret: raw.wecomCorpSecret ? '***' : undefined });
    }
    async getMasked(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.serviceNotifyConfig;
        const domain = this.parseStruct(raw);
        if (!domain)
            return null;
        return this.mask(domain);
    }
    async update(ctx, channelId, patch) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const original = this.parseStruct((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.serviceNotifyConfig) || {};
        const incoming = Object.assign({}, (patch || {}));
        // 保留密码：前端传 *** 则保留原加密值
        if (incoming.wecomCorpSecret === '***' && original.wecomCorpSecret) {
            incoming.wecomCorpSecret = original.wecomCorpSecret;
        }
        else if (incoming.wecomCorpSecret) {
            incoming.wecomCorpSecret = (0, crypto_1.encrypt)(incoming.wecomCorpSecret);
        }
        const merged = Object.assign(Object.assign({}, original), incoming);
        await this.channelService.update(ctx, { id: channelId, customFields: { serviceNotifyConfig: this.serializeDomain(merged) } });
        return this.mask(merged);
    }
};
exports.ServiceNotifyConfigService = ServiceNotifyConfigService;
exports.ServiceNotifyConfigService = ServiceNotifyConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], ServiceNotifyConfigService);
//# sourceMappingURL=service-notify-config.service.js.map