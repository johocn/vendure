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
exports.MultiLanguageConfigService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
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
let MultiLanguageConfigService = class MultiLanguageConfigService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    parseStruct(raw) {
        if (!raw)
            return null;
        const out = {};
        if (raw.availableLanguageCodes)
            out.availableLanguageCodes = raw.availableLanguageCodes;
        if (raw.defaultLanguageCode != null)
            out.defaultLanguageCode = raw.defaultLanguageCode;
        if (raw.translationWorkflowEnabled != null)
            out.translationWorkflowEnabled = raw.translationWorkflowEnabled;
        const operationalCopy = parseJson(raw.operationalCopyJson);
        if (operationalCopy)
            out.operationalCopy = operationalCopy;
        return Object.keys(out).length > 0 ? out : null;
    }
    serializeDomain(domain) {
        var _a, _b, _c;
        return {
            availableLanguageCodes: (_a = domain === null || domain === void 0 ? void 0 : domain.availableLanguageCodes) !== null && _a !== void 0 ? _a : null,
            defaultLanguageCode: (_b = domain === null || domain === void 0 ? void 0 : domain.defaultLanguageCode) !== null && _b !== void 0 ? _b : null,
            translationWorkflowEnabled: (_c = domain === null || domain === void 0 ? void 0 : domain.translationWorkflowEnabled) !== null && _c !== void 0 ? _c : null,
            operationalCopyJson: stringify(domain === null || domain === void 0 ? void 0 : domain.operationalCopy),
        };
    }
    async get(ctx, channelId) {
        var _a;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const raw = (_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.multiLanguageConfig;
        return this.parseStruct(raw);
    }
    async update(ctx, channelId, patch) {
        var _a, _b;
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            return null;
        const original = this.parseStruct((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.multiLanguageConfig) || {};
        const merged = Object.assign(Object.assign({}, original), (patch || {}));
        await this.channelService.update(ctx, { id: channelId, customFields: { multiLanguageConfig: this.serializeDomain(merged) } });
        // 同步写 Vendure 原生渠道语言字段
        if ((patch === null || patch === void 0 ? void 0 : patch.availableLanguageCodes) || (patch === null || patch === void 0 ? void 0 : patch.defaultLanguageCode)) {
            const updateInput = {};
            if ((_b = patch.availableLanguageCodes) === null || _b === void 0 ? void 0 : _b.length) {
                updateInput.availableLanguages = patch.availableLanguageCodes;
            }
            if (patch.defaultLanguageCode) {
                updateInput.defaultLanguageCode = patch.defaultLanguageCode;
            }
            await this.channelService.update(ctx, Object.assign({ id: channelId }, updateInput));
        }
        return merged;
    }
};
exports.MultiLanguageConfigService = MultiLanguageConfigService;
exports.MultiLanguageConfigService = MultiLanguageConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], MultiLanguageConfigService);
//# sourceMappingURL=multi-language-config.service.js.map