"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productDocId = productDocId;
exports.toProductDocuments = toProductDocuments;
function productDocId(productId) {
    return `product-${productId}`;
}
const pick = (zh, en) => (en && en.trim() ? en : zh);
function toProductDocuments(p, locales) {
    if (p.status !== 'published')
        return [];
    const id = productDocId(p.productId);
    return locales.map(locale => ({
        id,
        type: 'product',
        sourceId: p.productId,
        sourceSystem: 'vendure',
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
    }));
}
//# sourceMappingURL=product-document.mapper.js.map