import { describe, expect, it } from 'vitest';

import {
    computeSettlementCost,
    normalizeCouponBearer,
    resolveCouponCostRate,
} from './bill-pay-settlement-calc';

describe('computeSettlementCost', () => {
    it('未用券：与改造前一致（成本 = 原价 × 费率，毛利 = 报价 − 成本）', () => {
        const r = computeSettlementCost({ quoteAmount: 9000, actualAmount: 10000, settleRate: 90 });
        expect(r.baseCost).toBe(9000);
        expect(r.costAmount).toBe(9000);
        expect(r.grossAmount).toBe(0);
        expect(r.couponAmount).toBe(0);
        expect(r.merchantCouponCost).toBe(0);
        expect(r.platformCouponCost).toBe(0);
    });

    it('PLATFORM：平台承担全部券成本，应付商户款不变，毛利被券侵蚀', () => {
        const r = computeSettlementCost({
            quoteAmount: 8000,
            actualAmount: 10000,
            settleRate: 90,
            couponAmount: 2000,
            couponBearer: 'PLATFORM',
        });
        expect(r.couponCostRate).toBe(0);
        expect(r.merchantCouponCost).toBe(0);
        expect(r.platformCouponCost).toBe(2000);
        expect(r.costAmount).toBe(9000);
        expect(r.grossAmount).toBe(-1000);
    });

    it('MERCHANT：商户承担全部券成本，从应付商户款扣减，平台毛利被券补回', () => {
        const r = computeSettlementCost({
            quoteAmount: 8000,
            actualAmount: 10000,
            settleRate: 90,
            couponAmount: 2000,
            couponBearer: 'MERCHANT',
        });
        expect(r.couponCostRate).toBe(100);
        expect(r.merchantCouponCost).toBe(2000);
        expect(r.platformCouponCost).toBe(0);
        expect(r.costAmount).toBe(7000);
        expect(r.grossAmount).toBe(1000);
    });

    it('SPLIT：按比例四舍五入分摊（60% → 商户 1200 / 平台 800）', () => {
        const r = computeSettlementCost({
            quoteAmount: 8000,
            actualAmount: 10000,
            settleRate: 90,
            couponAmount: 2000,
            couponBearer: 'SPLIT',
            merchantCostRate: 60,
        });
        expect(r.couponCostRate).toBe(60);
        expect(r.merchantCouponCost).toBe(1200);
        expect(r.platformCouponCost).toBe(800);
        expect(r.costAmount).toBe(7800);
        expect(r.grossAmount).toBe(200);
    });

    it('SPLIT 比例越界/非法：clamp 到 0-100，非法值按 0 处理', () => {
        expect(resolveCouponCostRate('SPLIT', 150)).toBe(100);
        expect(resolveCouponCostRate('SPLIT', -20)).toBe(0);
        expect(resolveCouponCostRate('SPLIT', Number.NaN)).toBe(0);
        expect(resolveCouponCostRate('SPLIT', undefined)).toBe(0);
    });

    it('承担方非法/为空：回退 PLATFORM（历史口径）', () => {
        expect(normalizeCouponBearer(undefined)).toBe('PLATFORM');
        expect(normalizeCouponBearer('whatever')).toBe('PLATFORM');
        const r = computeSettlementCost({
            quoteAmount: 8000,
            actualAmount: 10000,
            settleRate: 90,
            couponAmount: 2000,
            couponBearer: 'unknown',
        });
        expect(r.couponBearer).toBe('PLATFORM');
        expect(r.merchantCouponCost).toBe(0);
    });

    it('商户承担额不超过应付商户款：券额大于成本时剩余由平台承担', () => {
        // 原价 1000 × 50% = 500 成本；券抵扣 800（商户全担）
        const r = computeSettlementCost({
            quoteAmount: 100,
            actualAmount: 1000,
            settleRate: 50,
            couponAmount: 800,
            couponBearer: 'MERCHANT',
        });
        expect(r.baseCost).toBe(500);
        expect(r.merchantCouponCost).toBe(500);
        expect(r.platformCouponCost).toBe(300);
        expect(r.costAmount).toBe(0);
        expect(r.grossAmount).toBe(100);
    });

    it('金额非法：取 0，费率缺省 100', () => {
        const r = computeSettlementCost({
            quoteAmount: Number.NaN,
            actualAmount: 5000,
            settleRate: Number.NaN,
            couponAmount: -100,
        });
        expect(r.settleRate).toBe(100);
        expect(r.baseCost).toBe(5000);
        expect(r.couponAmount).toBe(0);
        expect(r.grossAmount).toBe(-5000);
    });
});
