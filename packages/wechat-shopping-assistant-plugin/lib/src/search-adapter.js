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
/** 候选池倍数：先多取再按标题相关度重排，避免「雪花」把长标题商品排到「雪花粉」前面 */
const CANDIDATE_MULTIPLIER = 4;
/**
 * MeiliSearch 搜索适配：type=product + published + 渠道过滤，
 * 5s 超时/异常降级（调用方捕获后回兜底文案）。
 *
 * 检索策略（微信公众号用户常发口语词/品牌词）：
 * ① 标题优先：只检索 title，商品名/品牌名命中不会被正文里的店铺名稀释；
 * ② 全字段兜底：标题命中不足时补正文/标签命中；
 * ③ 合并去重后按标题相关度（全等 > 前缀 > 包含 > 其它）重排，取最终 limit 条。
 */
let AssistantSearchService = class AssistantSearchService {
    constructor(meili) {
        this.meili = meili;
    }
    async searchProducts(input) {
        var _a;
        const query = ((_a = input.query) !== null && _a !== void 0 ? _a : '').trim();
        if (!query)
            return [];
        const candidateLimit = Math.max(input.limit * CANDIDATE_MULTIPLIER, 20);
        const [titleResult, allResult] = await this.withTimeout(Promise.all([
            this.meili.search(input.locale, {
                q: query,
                channelId: input.channelId,
                limit: candidateLimit,
                attributesToSearchOn: ['title'],
            }),
            this.meili.search(input.locale, {
                q: query,
                channelId: input.channelId,
                limit: candidateLimit,
            }),
        ]), SEARCH_TIMEOUT_MS);
        const hits = this.mergeAndRank(titleResult.hits, allResult.hits, query, input.limit);
        return hits
            .filter(h => h.sourceId)
            .map((h, i) => this.toCardProduct(h, i + 1, input.storefrontUrl, input.productUrlTemplate));
    }
    /** 标题命中优先 + 全字段补全去重，再按标题相关度稳定排序 */
    mergeAndRank(titleHits, allHits, query, limit) {
        const seen = new Map();
        const add = (hit, titleBoost) => {
            var _a, _b, _c;
            if (!hit)
                return;
            const key = String((_b = (_a = hit.sourceId) !== null && _a !== void 0 ? _a : hit.id) !== null && _b !== void 0 ? _b : '');
            if (!key)
                return;
            const score = this.titleScore(String((_c = hit.title) !== null && _c !== void 0 ? _c : ''), query) + (titleBoost ? 100 : 0);
            const existing = seen.get(key);
            if (existing) {
                existing.score = Math.max(existing.score, score);
                return;
            }
            seen.set(key, { hit, order: seen.size, score });
        };
        titleHits.forEach(h => add(h, true));
        allHits.forEach(h => add(h, false));
        return [...seen.values()]
            .sort((a, b) => b.score - a.score || a.order - b.order)
            .slice(0, limit)
            .map(x => x.hit);
    }
    /** 标题与查询的相关度：全等 > 前缀 > 包含（标题越短分越高） */
    titleScore(title, query) {
        const t = title.toLowerCase();
        const q = query.toLowerCase();
        if (!t || !q)
            return 0;
        if (t === q)
            return 1000;
        if (t.startsWith(q))
            return 900 - Math.min(t.length, 100);
        if (t.includes(q))
            return 800 - Math.min(t.length, 100);
        return 0;
    }
    toCardProduct(hit, index, storefrontUrl, productUrlTemplate) {
        var _a, _b;
        const slug = typeof hit.slug === 'string' && hit.slug
            ? hit.slug
            : (typeof hit.url === 'string' ? hit.url.split('/').filter(Boolean).pop() || '' : '');
        // 卡片点击直达商品详情页：优先 URL 模板（hash 路由前端，如 uni-app H5
        // `https://host/#/pkg-product/pages/detail?slug={slug}`）；未配置模板退回
        // `{storefront}/product/{slug}`；仍无则退回文档 url 原样
        const url = productUrlTemplate && slug
            ? productUrlTemplate.replace('{slug}', encodeURIComponent(slug))
            : storefrontUrl && slug
                ? `${storefrontUrl.replace(/\/+$/, '')}/product/${slug}`
                : (typeof hit.url === 'string' && hit.url ? hit.url : undefined);
        return {
            index,
            productId: String(hit.sourceId),
            title: (_a = hit.title) !== null && _a !== void 0 ? _a : '未命名商品',
            price: Number((_b = hit.price) !== null && _b !== void 0 ? _b : 0),
            thumbnail: hit.thumbnail || undefined,
            url,
            slug,
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