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
    urlBase: string; // 从 env/动态 origin 注入，禁止硬编码域名
}

export function productDocId(productId: string): string {
    return `product-${productId}`;
}

const pick = (zh: string, en: string) => (en && en.trim() ? en : zh);

export function toProductDocuments(p: ProductProjection, locales: string[]): KbDocument[] {
    if (p.status !== 'published') return [];
    const id = productDocId(p.productId);
    return locales.map(
        locale =>
            ({
                id,
                type: 'product',
                sourceId: p.productId,
                sourceSystem: 'vendure' as const,
                url: `${p.urlBase}/${locale === 'zh' ? p.slugZh || p.productId : p.slugEn || p.slugZh || p.productId}`,
                channelId: p.channelId,
                status: p.status,
                tags: p.tags,
                title: locale === 'zh' ? p.nameZh : pick(p.nameZh, p.nameEn),
                body: locale === 'zh' ? p.descZh : pick(p.descZh, p.descEn),
                updatedAt: p.updatedAt,
                price: p.price,
                collectionIds: p.collectionIds,
                slug: p.slugZh || p.slugEn,
            }) satisfies KbDocument,
    );
}
