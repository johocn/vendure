import { Injectable, Logger } from '@nestjs/common';
import { MeiliService } from '@vendure/meilisearch-plugin';

import { loggerCtx } from './constants';
import { CardProduct } from './types';

const SEARCH_TIMEOUT_MS = 5000;

/**
 * MeiliSearch 搜索适配：type=product + published + 渠道过滤，
 * 5s 超时/异常降级（调用方捕获后回兜底文案）。
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
        const r = await this.withTimeout(
            this.meili.search(input.locale, {
                q: input.query,
                channelId: input.channelId,
                limit: input.limit,
            }),
            SEARCH_TIMEOUT_MS,
        );
        return r.hits
            .filter(h => h.sourceId)
            .map((h, i) => this.toCardProduct(h, i + 1, input.storefrontUrl, input.productUrlTemplate));
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
