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
    urlBase: string; // 从 env/动态 origin 注入，禁止硬编码域名
    /** 商品主图绝对地址（featuredAsset.preview + 资产域名）；空则省略 thumbnail */
    thumbnailUrl?: string;
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
                channelIds: p.channelIds,
                status: p.status,
                tags: p.tags,
                title: locale === 'zh' ? p.nameZh : pick(p.nameZh, p.nameEn),
                body: locale === 'zh' ? p.descZh : pick(p.descZh, p.descEn),
                updatedAt: p.updatedAt,
                price: p.price,
                collectionIds: p.collectionIds,
                slug: p.slugZh || p.slugEn,
                ...(p.thumbnailUrl ? { thumbnail: p.thumbnailUrl } : {}),
            }) satisfies KbDocument,
    );
}
