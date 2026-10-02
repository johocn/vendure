"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_sale_1 = require("./coupon-sale");
(0, vitest_1.describe)('isSaleOrderRefundable', () => {
    (0, vitest_1.it)('全部未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'UNUSED'])).toBe(true);
    });
    (0, vitest_1.it)('过期券视为未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'EXPIRED'])).toBe(true);
    });
    (0, vitest_1.it)('回退券（RETURNED）视为未使用 → 可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['RETURNED'])).toBe(true);
    });
    (0, vitest_1.it)('存在一张 USED → 不可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)(['UNUSED', 'USED', 'EXPIRED'])).toBe(false);
    });
    (0, vitest_1.it)('空数组（无券可回收）→ 不可退', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)([])).toBe(false);
    });
    (0, vitest_1.it)('null/undefined 状态按未使用处理', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.isSaleOrderRefundable)([null, undefined])).toBe(true);
    });
});
(0, vitest_1.describe)('expandBundleItems', () => {
    (0, vitest_1.it)('quantity 缺省按 1 张展开', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 7 }, { templateId: 9 }])).toEqual([7, 9]);
    });
    (0, vitest_1.it)('quantity 为 3 时重复 3 次', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 7, quantity: 3 }])).toEqual([7, 7, 7]);
    });
    (0, vitest_1.it)('quantity 为 0/负数/小数时下限为 1 并取整', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: 0 }])).toEqual([1]);
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: -5 }])).toEqual([1]);
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([{ templateId: 1, quantity: 2.9 }])).toEqual([1, 1]);
    });
    (0, vitest_1.it)('空列表返回空数组', () => {
        (0, vitest_1.expect)((0, coupon_sale_1.expandBundleItems)([])).toEqual([]);
    });
});
(0, vitest_1.describe)('filterSaleCatalogue', () => {
    (0, vitest_1.it)('仅保留 salePrice > 0 的模板', () => {
        const list = [
            { id: 1, salePrice: 990 },
            { id: 2, salePrice: 0 },
            { id: 3, salePrice: null },
            { id: 4, salePrice: 100 },
        ];
        (0, vitest_1.expect)((0, coupon_sale_1.filterSaleCatalogue)(list).map(t => t.id)).toEqual([1, 4]);
    });
});
//# sourceMappingURL=coupon-sale.spec.js.map