import { describe, expect, test } from 'vitest';
import { productDocId, toProductDocuments, ProductProjection } from '../src/product-document.mapper';

const base: ProductProjection = {
    productId: '42',
    channelId: '37',
    status: 'published',
    updatedAt: 1728777600000,
    nameZh: '温泉门票',
    nameEn: 'Hot Spring Ticket',
    descZh: '节假日通用',
    descEn: 'Valid on holidays',
    slugZh: 'hot-spring',
    slugEn: 'hot-spring',
    price: 9900,
    collectionIds: ['7'],
    tags: ['温泉'],
    urlBase: 'https://www.youshop.cn/products',
};

describe('product-document.mapper 投影', () => {
    test('produces one doc per locale with stable id', () => {
        const docs = toProductDocuments(base, ['zh', 'en']);
        expect(docs.length).toBe(2);
        expect(docs[0].id).toBe('product-42');
        expect(docs[0].type).toBe('product');
        expect(docs[0].channelId).toBe('37');
        expect(docs[0].title).toBe('温泉门票');
        expect(docs[1].title).toBe('Hot Spring Ticket');
        expect(docs[1].slug).toBe('hot-spring');
    });

    test('en falls back to zh when translation missing', () => {
        const docs = toProductDocuments({ ...base, nameEn: '', descEn: '' }, ['zh', 'en']);
        expect(docs[1].title).toBe('温泉门票');
        expect(docs[1].body).toBe('节假日通用');
    });

    test('excludes draft products', () => {
        expect(toProductDocuments({ ...base, status: 'draft' }, ['zh'])).toEqual([]);
    });

    test('productDocId format', () => {
        expect(productDocId('9')).toBe('product-9');
    });
});
