import { describe, expect, it } from 'vitest';

import { expandBundleItems, filterSaleCatalogue, isSaleOrderRefundable } from './coupon-sale';

describe('isSaleOrderRefundable', () => {
    it('全部未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'UNUSED'])).toBe(true);
    });

    it('过期券视为未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'EXPIRED'])).toBe(true);
    });

    it('回退券（RETURNED）视为未使用 → 可退', () => {
        expect(isSaleOrderRefundable(['RETURNED'])).toBe(true);
    });

    it('存在一张 USED → 不可退', () => {
        expect(isSaleOrderRefundable(['UNUSED', 'USED', 'EXPIRED'])).toBe(false);
    });

    it('空数组（无券可回收）→ 不可退', () => {
        expect(isSaleOrderRefundable([])).toBe(false);
    });

    it('null/undefined 状态按未使用处理', () => {
        expect(isSaleOrderRefundable([null, undefined])).toBe(true);
    });
});

describe('expandBundleItems', () => {
    it('quantity 缺省按 1 张展开', () => {
        expect(expandBundleItems([{ templateId: 7 }, { templateId: 9 }])).toEqual([7, 9]);
    });

    it('quantity 为 3 时重复 3 次', () => {
        expect(expandBundleItems([{ templateId: 7, quantity: 3 }])).toEqual([7, 7, 7]);
    });

    it('quantity 为 0/负数/小数时下限为 1 并取整', () => {
        expect(expandBundleItems([{ templateId: 1, quantity: 0 }])).toEqual([1]);
        expect(expandBundleItems([{ templateId: 1, quantity: -5 }])).toEqual([1]);
        expect(expandBundleItems([{ templateId: 1, quantity: 2.9 }])).toEqual([1, 1]);
    });

    it('空列表返回空数组', () => {
        expect(expandBundleItems([])).toEqual([]);
    });
});

describe('filterSaleCatalogue', () => {
    it('仅保留 salePrice > 0 的模板', () => {
        const list = [
            { id: 1, salePrice: 990 },
            { id: 2, salePrice: 0 },
            { id: 3, salePrice: null },
            { id: 4, salePrice: 100 },
        ];
        expect(filterSaleCatalogue(list).map(t => t.id)).toEqual([1, 4]);
    });
});