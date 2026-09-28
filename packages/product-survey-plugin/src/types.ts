/**
 * 插件选项（均有默认值，dev-config 可直接 init()）。
 */
export interface ProductSurveyPluginOptions {
    /** take 缺省值，默认 50 */
    defaultTake?: number;
    /** take 上限，默认 100 */
    maxTake?: number;
    /** onsale 分支每个商品最多返回的变体数，默认 20 */
    maxVariantsPerProduct?: number;
}

/** 出参：渠道标识（字符串化，避免 C 端处理 bigint/数字差异） */
export interface SurveyChannel {
    id: string;
    code: string;
}

/** 出参：Collection 标识 */
export interface SurveyCollection {
    slug: string;
    name: string;
}

/** 出参：变体（未配价时不输出 priceText） */
export interface SurveyVariant {
    id: string;
    name: string;
    priceText?: string;
}

/** 出参：商品卡片 */
export interface SurveyProductCard {
    id: string;
    name: string;
    slug: string | null;
    image: string | null;
    enabled: boolean;
    link: string | null;
    linkAvailable: boolean;
    priceConfigured: boolean;
    /** 未配价时不输出 */
    priceFromText?: string;
    variants: SurveyVariant[];
}

/** 端点完整出参 */
export interface CandidatesResponse {
    channel: SurveyChannel;
    collection: SurveyCollection | null;
    products: SurveyProductCard[];
}
