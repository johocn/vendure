import { KbDocument } from './types';
export interface ProductProjection {
    productId: string;
    channelId: string;
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
