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
            .map((h, i) => this.toCardProduct(h, i + 1, input.storefrontUrl));
    }

    private toCardProduct(hit: any, index: number, storefrontUrl: string): CardProduct {
        let url: string | undefined = typeof hit.url === 'string' && hit.url ? hit.url : undefined;
        // urlBase 缺失时文档 url 可能是相对路径，用店铺前端地址补全
        if (url && url.startsWith('/') && storefrontUrl) {
            url = `${storefrontUrl.replace(/\/+$/, '')}${url}`;
        }
        return {
            index,
            productId: String(hit.sourceId),
            title: hit.title ?? '未命名商品',
            price: Number(hit.price ?? 0),
            thumbnail: hit.thumbnail || undefined,
            url,
            slug: hit.slug,
        };
    }

    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Meili search timeout after ${ms}ms`)), ms).unref?.()),
        ]);
    }
}
