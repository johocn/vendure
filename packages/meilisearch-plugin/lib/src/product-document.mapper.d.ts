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
}
export declare function productDocId(productId: string): string;
export declare function toProductDocuments(p: ProductProjection, locales: string[]): KbDocument[];
