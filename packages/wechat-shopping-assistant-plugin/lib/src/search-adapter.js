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
exports.AssistantSearchService = void 0;
const common_1 = require("@nestjs/common");
const meilisearch_plugin_1 = require("@vendure/meilisearch-plugin");
const SEARCH_TIMEOUT_MS = 5000;
/**
 * MeiliSearch 搜索适配：type=product + published + 渠道过滤，
 * 5s 超时/异常降级（调用方捕获后回兜底文案）。
 */
let AssistantSearchService = class AssistantSearchService {
    constructor(meili) {
        this.meili = meili;
    }
    async searchProducts(input) {
        const r = await this.withTimeout(this.meili.search(input.locale, {
            q: input.query,
            channelId: input.channelId,
            limit: input.limit,
        }), SEARCH_TIMEOUT_MS);
        return r.hits
            .filter(h => h.sourceId)
            .map((h, i) => this.toCardProduct(h, i + 1, input.storefrontUrl));
    }
    toCardProduct(hit, index, storefrontUrl) {
        var _a, _b;
        let url = typeof hit.url === 'string' && hit.url ? hit.url : undefined;
        // urlBase 缺失时文档 url 可能是相对路径，用店铺前端地址补全
        if (url && url.startsWith('/') && storefrontUrl) {
            url = `${storefrontUrl.replace(/\/+$/, '')}${url}`;
        }
        return {
            index,
            productId: String(hit.sourceId),
            title: (_a = hit.title) !== null && _a !== void 0 ? _a : '未命名商品',
            price: Number((_b = hit.price) !== null && _b !== void 0 ? _b : 0),
            thumbnail: hit.thumbnail || undefined,
            url,
            slug: hit.slug,
        };
    }
    withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => { var _a, _b; return (_b = (_a = setTimeout(() => reject(new Error(`Meili search timeout after ${ms}ms`)), ms)).unref) === null || _b === void 0 ? void 0 : _b.call(_a); }),
        ]);
    }
};
exports.AssistantSearchService = AssistantSearchService;
exports.AssistantSearchService = AssistantSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [meilisearch_plugin_1.MeiliService])
], AssistantSearchService);
//# sourceMappingURL=search-adapter.js.map