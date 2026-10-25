import { KbDocument } from './types';
export interface ProductProjection {
    productId: string;
    /** 主渠道（价格口径） */
    channelId: string;
    /** 商品所属全部渠道（含默认渠道），搜索按数组过滤 */
    channelIds: string[];
    status: string;
    updatedAt: number;
    nameZh: string;
    nameEn: string;
    descZh: string;
    descEn: string;
    slugZh: string;
    slugEn: string;
    price: number;
    collectionIds: string[];
    tags: string[];
    urlBase: string;
    /** 商品主图绝对地址（featuredAsset.preview + 资产域名）；空则省略 thumbnail */
    thumbnailUrl?: string;
}
export declare function productDocId(productId: string): string;
export declare function toProductDocuments(p: ProductProjection, locales: string[]): KbDocument[];
