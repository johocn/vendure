import { describe, expect, it } from 'vitest';

import { IN_STORE_REASON, computeInStoreBill } from './in-store-bill';

/** 构造最小模板（只取计算所需的三字段） */
function tpl(type: string, discountValue: number, minSpend = 0): any {
    return { type, discountValue, minSpend };
}

describe('computeInStoreBill 到店买单金额试算', () => {
    it('PERCENT：8 折券，原价 20000 分 → 优惠 4000，实付 16000', () => {
        expect(computeInStoreBill(tpl('PERCENT', 80), 20000)).toEqual({
            ok: true,
            originalAmount: 20000,
            discountAmount: 4000,
            finalAmount: 16000,
        });
    });

    it('PERCENT 边界：1 折 / 50 折 / 99 折', () => {
        expect(computeInStoreBill(tpl('PERCENT', 10), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 9000, finalAmount: 1000,
        });
        expect(computeInStoreBill(tpl('PERCENT', 50), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 5000, finalAmount: 5000,
        });
        expect(computeInStoreBill(tpl('PERCENT', 99), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 100, finalAmount: 9900,
        });
    });

    it('PERCENT：非整除金额四舍五入（13333 × 80% = 10666.4 → 10666）', () => {
        expect(computeInStoreBill(tpl('PERCENT', 80), 13333)).toEqual({
            ok: true, originalAmount: 13333, discountAmount: 2667, finalAmount: 10666,
        });
    });

    it('FIXED：直减 2000，原价 10000 → 实付 8000', () => {
        expect(computeInStoreBill(tpl('FIXED', 2000), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 2000, finalAmount: 8000,
        });
    });

    it('FULL：无门槛直减，语义同 FIXED', () => {
        expect(computeInStoreBill(tpl('FULL', 500), 3000)).toEqual({
            ok: true, originalAmount: 3000, discountAmount: 500, finalAmount: 2500,
        });
    });

    it('直减超过原价：优惠额封顶为原价，实付不为负', () => {
        expect(computeInStoreBill(tpl('FIXED', 5000), 3000)).toEqual({
            ok: true, originalAmount: 3000, discountAmount: 3000, finalAmount: 0,
        });
    });

    it('minSpend 门槛：未达标拒绝，刚好达标放行', () => {
        expect(computeInStoreBill(tpl('FIXED', 2000, 10000), 9999)).toEqual({
            ok: false, reason: IN_STORE_REASON.MIN_SPEND_NOT_MET,
        });
        expect(computeInStoreBill(tpl('FIXED', 2000, 10000), 10000)).toEqual({
            ok: true, originalAmount: 10000, discountAmount: 2000, finalAmount: 8000,
        });
    });

    it('FREE_SHIPPING 不支持到店买单', () => {
        expect(computeInStoreBill(tpl('FREE_SHIPPING', 0), 10000)).toEqual({
            ok: false, reason: IN_STORE_REASON.TYPE_NOT_SUPPORTED,
        });
    });

    it('非法原价（0 / 负数 / 小数 / NaN）一律拒绝', () => {
        for (const bad of [0, -1, 12.5, Number.NaN]) {
            expect(computeInStoreBill(tpl('FIXED', 100), bad as number)).toEqual({
                ok: false, reason: IN_STORE_REASON.INVALID_AMOUNT,
            });
        }
    });
});
