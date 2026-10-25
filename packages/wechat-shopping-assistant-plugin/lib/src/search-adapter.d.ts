import { MeiliService } from '@vendure/meilisearch-plugin';
import { CardProduct } from './types';
/**
 * MeiliSearch 搜索适配：type=product + published + 渠道过滤，
 * 5s 超时/异常降级（调用方捕获后回兜底文案）。
 *
 * 检索策略（微信公众号用户常发口语词/品牌词）：
 * ① 标题优先：只检索 title，商品名/品牌名命中不会被正文里的店铺名稀释；
 * ② 全字段兜底：标题命中不足时补正文/标签命中；
 * ③ 合并去重后按标题相关度（全等 > 前缀 > 包含 > 其它）重排，取最终 limit 条。
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
        productUrlTemplate?: string;
    }): Promise<CardProduct[]>;
    /** 标题命中优先 + 全字段补全去重，再按标题相关度稳定排序 */
    private mergeAndRank;
    /** 标题与查询的相关度：全等 > 前缀 > 包含（标题越短分越高） */
    private titleScore;
    private toCardProduct;
    private withTimeout;
}
