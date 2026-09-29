import {
    ChannelService,
    CollectionService,
    ProductService,
    ProductVariantService,
    TranslatorService,
} from '@vendure/core';
import { CandidatesResponse, ProductSurveyPluginOptions } from './types';
interface CandidatesParams {
    productIds?: string;
    collection?: string;
    onsale?: string;
    take?: string;
}
/**
 * 只读候选商品服务：供 C 端活动页读取候选（含未上架）、上架在售商品，
 * 以及运营端指定商品集合（productIds，按传入顺序返回）。
 * 所有价格/链接/图片加工都在服务端完成，C 端不拼不算。
 */
export declare class ProductSurveyService {
    private channelService;
    private collectionService;
    private productService;
    private productVariantService;
    private translator;
    private options;
    constructor(
        channelService: ChannelService,
        collectionService: CollectionService,
        productService: ProductService,
        productVariantService: ProductVariantService,
        translator: TranslatorService,
        options: ProductSurveyPluginOptions,
    );
    private get defaultTake();
    private get maxTake();
    getCandidates(token: string | undefined, params: CandidatesParams): Promise<CandidatesResponse>;
    /** vendure-token 解析渠道；无 header 传 '' 返回默认渠道，非法 token → 400 */
    private resolveChannel;
    /** collection 分支：返回集合内全部变体（不过滤 product.enabled），聚合为商品卡片 */
    private buildFromCollection;
    /** onsale 分支：该渠道全部上架（enabled=true）商品，take 语义为商品数 */
    private buildOnSale;
    /**
     * productIds 分支：运营端指定商品集合，按传入顺序返回。
     * - 解析：逗号分隔 → trim → 去空 → 去重保序；非整数 token 直接丢弃
     * - 顺序：严格等于传入顺序；渠道内查不到的（不存在/不属于本渠道/已删除）丢弃
     * - 数量：去重后超过 maxTake → 400；结果不按 take 截断（运营已显式定序选品）
     */
    private buildFromProductIds;
    /**
     * 商品卡片转换（三个分支共用）。
     * - 链接：仅当 slug 匹配 ^[a-z0-9][a-z0-9-]*$ 时拼 /pkg-product/pages/detail?slug=<slug>
     * - 价格：统一用 variant.priceWithTax（整数，单位分）转元；<=0 视为未配价
     * - 图片：首个有 featuredAsset 的变体 → 商品 featuredAsset → null
     * - 划线价：Vendure 无该字段，不提供
     */
    private toProductCard;
}
export {};
