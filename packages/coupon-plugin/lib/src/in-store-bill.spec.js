"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const in_store_bill_1 = require("./in-store-bill");
/** 构造最小模板（只取计算所需的三字段） */
function tpl(type, discountValue, minSpend = 0) {
    return { type, discountValue, minSpend };
}
(0, vitest_1.describe)('computeInStoreBill 到店买单金额试算', () => {
    (0, vitest_1.it)('PERCENT：8 折券，原价 20000 分 → 优惠 4000，实付 16000', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('PERCENT', 80), 20000)).toEqual({
            ok: true,
            originalAmount: 20000,
            discountAmount: 4000,
            finalAmount: 16000,
        });
    });
    (0, vitest_1.it)('PERCENT 边界：1 折 / 50 折 / 99 折', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('PERCENT', 10), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 9000, finalAmount: 1000,
        });
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('PERCENT', 50), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 5000, finalAmount: 5000,
        });
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('PERCENT', 99), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 100, finalAmount: 9900,
        });
    });
    (0, vitest_1.it)('PERCENT：非整除金额四舍五入（13333 × 80% = 10666.4 → 10666）', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('PERCENT', 80), 13333)).toEqual({
            ok: true, originalAmount: 13333, discountAmount: 2667, finalAmount: 10666,
        });
    });
    (0, vitest_1.it)('FIXED：直减 2000，原价 10000 → 实付 8000', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FIXED', 2000), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 2000, finalAmount: 8000,
        });
    });
    (0, vitest_1.it)('FULL：无门槛直减，语义同 FIXED', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FULL', 500), 3000)).toEqual({
            ok: true, originalAmount: 3000, discountAmount: 500, finalAmount: 2500,
        });
    });
    (0, vitest_1.it)('直减超过原价：优惠额封顶为原价，实付不为负', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FIXED', 5000), 3000)).toEqual({
            ok: true, originalAmount: 3000, discountAmount: 3000, finalAmount: 0,
        });
    });
    (0, vitest_1.it)('minSpend 门槛：未达标拒绝，刚好达标放行', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FIXED', 2000, 10000), 9999)).toEqual({
            ok: false, reason: in_store_bill_1.IN_STORE_REASON.MIN_SPEND_NOT_MET,
        });
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FIXED', 2000, 10000), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 2000, finalAmount: 8000,
        });
    });
    (0, vitest_1.it)('FREE_SHIPPING 不支持到店买单', () => {
        (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FREE_SHIPPING', 0), 10000)).toEqual({
            ok: false, reason: in_store_bill_1.IN_STORE_REASON.TYPE_NOT_SUPPORTED,
        });
    });
    (0, vitest_1.it)('非法原价（0 / 负数 / 小数 / NaN）一律拒绝', () => {
        for (const bad of [0, -1, 12.5, Number.NaN]) {
            (0, vitest_1.expect)((0, in_store_bill_1.computeInStoreBill)(tpl('FIXED', 100), bad)).toEqual({
                ok: false, reason: in_store_bill_1.IN_STORE_REASON.INVALID_AMOUNT,
            });
        }
    });
});
//# sourceMappingURL=in-store-bill.spec.js.map