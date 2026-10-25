import { Injectable, Logger } from '@nestjs/common';
import { MeiliService } from '@vendure/meilisearch-plugin';

import { loggerCtx } from './constants';
import { CardProduct } from './types';

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
@Injectable()
export class AssistantSearchService {
    constructor(private meili: MeiliService) {}

    async searchProducts(input: {
        query: string;
        channelId: string;
        locale: string;
        limit: number;
        storefrontUrl: string;
        productUrlTemplate?: string;
    }): Promise<CardProduct[]> {
        const query = (input.query ?? '').trim();
        if (!query) return [];
        const candidateLimit = Math.max(input.limit * CANDIDATE_MULTIPLIER, 20);
        const [titleResult, allResult] = await this.withTimeout(
            Promise.all([
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
            ]),
            SEARCH_TIMEOUT_MS,
        );
        const hits = this.mergeAndRank(titleResult.hits, allResult.hits, query, input.limit);
        return hits
            .filter(h => h.sourceId)
            .map((h, i) => this.toCardProduct(h, i + 1, input.storefrontUrl, input.productUrlTemplate));
    }

    /** 标题命中优先 + 全字段补全去重，再按标题相关度稳定排序 */
    private mergeAndRank(titleHits: any[], allHits: any[], query: string, limit: number): any[] {
        const seen = new Map<string, { hit: any; order: number; score: number }>();
        const add = (hit: any, titleBoost: boolean) => {
            if (!hit) return;
            const key = String(hit.sourceId ?? hit.id ?? '');
            if (!key) return;
            const score = this.titleScore(String(hit.title ?? ''), query) + (titleBoost ? 100 : 0);
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
    private titleScore(title: string, query: string): number {
        const t = title.toLowerCase();
        const q = query.toLowerCase();
        if (!t || !q) return 0;
        if (t === q) return 1000;
        if (t.startsWith(q)) return 900 - Math.min(t.length, 100);
        if (t.includes(q)) return 800 - Math.min(t.length, 100);
        return 0;
    }

    private toCardProduct(hit: any, index: number, storefrontUrl: string, productUrlTemplate?: string): CardProduct {
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
            title: hit.title ?? '未命名商品',
            price: Number(hit.price ?? 0),
            thumbnail: hit.thumbnail || undefined,
            url,
            slug,
        };
    }

    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Meili search timeout after ${ms}ms`)), ms).unref?.()),
        ]);
    }
}
