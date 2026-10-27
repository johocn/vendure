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
exports.SearchAssistService = void 0;
// P2-2 语音/拍照搜索：按渠道配置选择识别 Provider，统一收敛为「关键词」。
//
// 返回结构固定，不抛识别异常（失败以 { ok:false, error } 表达），避免 C 端因服务商抖动整页报错；
// 只有「类型非法 / 店铺未开启 / 服务商未注册」这类调用方错误才抛 UserInputError。
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const search_assist_1 = require("./search-assist");
let SearchAssistService = class SearchAssistService {
    constructor(connection) {
        this.connection = connection;
    }
    async assist(ctx, type, payload) {
        var _a, _b, _c, _d;
        const t = String(type !== null && type !== void 0 ? type : '').trim();
        if (t !== 'voice' && t !== 'image') {
            throw new core_1.UserInputError(`不支持的识别类型: ${type || '(空)'}（仅接受 voice/image）`);
        }
        const repo = this.connection.getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig);
        const cfg = await repo.findOne({ where: { channelId: ctx.channelId } });
        const providerName = (_a = (t === 'voice' ? cfg === null || cfg === void 0 ? void 0 : cfg.voiceSearchProvider : cfg === null || cfg === void 0 ? void 0 : cfg.imageSearchProvider)) !== null && _a !== void 0 ? _a : 'mock';
        if (!providerName || providerName === 'none') {
            throw new core_1.UserInputError(t === 'voice' ? '店铺未开启语音搜索' : '店铺未开启拍照搜索');
        }
        const provider = search_assist_1.SEARCH_ASSIST_PROVIDERS[providerName];
        if (!provider) {
            throw new core_1.UserInputError(`不支持的识别服务商: ${providerName}`);
        }
        const started = Date.now();
        try {
            const out = await provider.recognize({ type: t, payload: payload !== null && payload !== void 0 ? payload : null });
            const keywords = (0, search_assist_1.normalizeKeywords)(out.keywords);
            const latencyMs = Date.now() - started;
            if (!keywords.length) {
                return { ok: false, type: t, provider: providerName, text: (_b = out.text) !== null && _b !== void 0 ? _b : '', keywords: [], latencyMs, error: '未识别到可用关键词' };
            }
            return { ok: true, type: t, provider: providerName, text: (_c = out.text) !== null && _c !== void 0 ? _c : '', keywords, latencyMs, error: null };
        }
        catch (e) {
            return { ok: false, type: t, provider: providerName, text: '', keywords: [], latencyMs: Date.now() - started, error: (_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : '识别失败' };
        }
    }
};
exports.SearchAssistService = SearchAssistService;
exports.SearchAssistService = SearchAssistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], SearchAssistService);
//# sourceMappingURL=search-assist.service.js.map