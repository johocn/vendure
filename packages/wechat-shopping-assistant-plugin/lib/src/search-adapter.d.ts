import { MeiliService } from '@vendure/meilisearch-plugin';
import { CardProduct } from './types';
/**
 * MeiliSearch 搜索适配：type=product + published + 渠道过滤，
 * 5s 超时/异常降级（调用方捕获后回兜底文案）。
 */
export declare class AssistantSearchService {
    private meili;
    constructor(meili: MeiliService);
    searchProducts(input: {
        query: string;
        channelId: string;
        locale: string;
        limit: number;
        storefrontUrl: string;
    }): Promise<CardProduct[]>;
    private toCardProduct;
    private withTimeout;
}
