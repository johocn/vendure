import { describe, expect, it } from 'vitest';

import { parseBillPayConfig, quoteBill } from './quote-engine';
import { DEFAULT_BILLPAY_CONFIG } from './types';

describe('quoteBill', () => {
    const baseRule = { minAmount: 2000, maxAmount: 200000 };

    it('无规则时原价通过', () => {
        const r = quoteBill(10000, baseRule);
        expect(r).toEqual({ payable: 10000, discountDetail: [] });
    });

    it('金额非法（0/负数/非数）拒绝', () => {
        expect(quoteBill(0, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
        expect(quoteBill(-100, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
        expect(quoteBill(NaN, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
    });

    it('低于 minAmount 拒绝（不接单）', () => {
        expect(quoteBill(1999, baseRule)).toMatchObject({ reason: 'BELOW_MIN' });
        expect(quoteBill(2000, baseRule)).toMatchObject({ payable: 2000 });
    });

    it('高于 maxAmount 拒绝（转人工）', () => {
        expect(quoteBill(200001, baseRule)).toMatchObject({ reason: 'ABOVE_MAX' });
        expect(quoteBill(200000, baseRule)).toMatchObject({ payable: 200000 });
    });

    it('会员折扣：90 = 9 折，四舍五入到分', () => {
        const r = quoteBill(10000, { ...baseRule, memberDiscount: { percent: 90 } });
        expect(r).toEqual({
            payable: 9000,
            discountDetail: [{ rule: 'memberDiscount', label: undefined, amount: 1000 }],
        });
    });

    it('会员折扣非整数金额四舍五入（3333 分 × 85% = 2833.05 → 2833）', () => {
        const r = quoteBill(3333, { ...baseRule, memberDiscount: { percent: 85 } });
        expect(r.payable).toBe(2833);
    });

    it('满减取最优档（reduce 最大）', () => {
        const r = quoteBill(20000, {
            ...baseRule,
            thresholds: [
                { minSpend: 10000, reduce: 500 },
                { minSpend: 20000, reduce: 2000 },
                { minSpend: 5000, reduce: 100 },
            ],
        });
        expect(r).toEqual({
            payable: 18000,
            discountDetail: [{ rule: 'threshold', label: undefined, amount: 2000 }],
        });
    });

    it('叠加顺序：会员折扣 → 最优满减档（满减按折扣后金额判定）', () => {
        const r = quoteBill(10000, {
            ...baseRule,
            memberDiscount: { percent: 90 },
            thresholds: [
                { minSpend: 9500, reduce: 500 }, // 折后 9000 不可达
                { minSpend: 8000, reduce: 300 }, // 折后 9000 命中
            ],
        });
        expect(r.payable).toBe(8700);
        expect(r.discountDetail).toEqual([
            { rule: 'memberDiscount', label: undefined, amount: 1000 },
            { rule: 'threshold', label: undefined, amount: 300 },
        ]);
    });

    it('满减不小于应付（reduce >= payable 时不生效，避免负数）', () => {
        const r = quoteBill(2000, { ...baseRule, thresholds: [{ minSpend: 2000, reduce: 5000 }] });
        expect(r.payable).toBe(2000);
        expect(r.discountDetail).toEqual([]);
    });

    it('坏档位（0/负值/缺字段）被忽略', () => {
        const r = quoteBill(20000, {
            ...baseRule,
            thresholds: [
                { minSpend: 0, reduce: 100 },
                { minSpend: 10000, reduce: 0 },
                { minSpend: -5, reduce: -100 },
                { minSpend: 15000, reduce: 200 },
            ] as any,
        });
        expect(r.payable).toBe(19800);
    });
});

describe('parseBillPayConfig', () => {
    it('null / 空串 / 坏 JSON 回退默认配置', () => {
        expect(parseBillPayConfig(null)).toEqual(DEFAULT_BILLPAY_CONFIG);
        expect(parseBillPayConfig('')).toEqual(DEFAULT_BILLPAY_CONFIG);
        expect(parseBillPayConfig('{bad json')).toEqual(DEFAULT_BILLPAY_CONFIG);
        expect(parseBillPayConfig(42 as any)).toEqual(DEFAULT_BILLPAY_CONFIG);
    });

    it('完整配置解析 + 分单位保留', () => {
        const raw = {
            autoQuote: false,
            quoteExpireMinutes: 15,
            memberDiscount: { percent: 95, label: { 'zh-CN': '会员95折' } },
            thresholds: [{ minSpend: 10000, reduce: 500, label: { 'zh-CN': '满100减5' } }],
            couponEnabled: false,
            tolerancePercent: 5,
            minAmount: 1000,
            maxAmount: 100000,
            dailyLimitAmount: 300000,
        };
        const c = parseBillPayConfig(raw);
        expect(c.autoQuote).toBe(false);
        expect(c.quoteExpireMinutes).toBe(15);
        expect(c.memberDiscount?.percent).toBe(95);
        expect(c.thresholds).toHaveLength(1);
        expect(c.tolerancePercent).toBe(5);
        expect(c.dailyLimitAmount).toBe(300000);
    });

    it('缺字段逐字段回退；坏档位/非法折扣剔除', () => {
        const c = parseBillPayConfig({
            quoteExpireMinutes: 0,
            memberDiscount: { percent: 120 },
            thresholds: [{ minSpend: 100, reduce: 0 }],
            minAmount: -1,
        });
        expect(c.quoteExpireMinutes).toBe(DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes);
        expect(c.memberDiscount).toBeNull();
        expect(c.thresholds).toEqual([]);
        expect(c.minAmount).toBe(DEFAULT_BILLPAY_CONFIG.minAmount);
        expect(c.maxAmount).toBe(DEFAULT_BILLPAY_CONFIG.maxAmount);
        expect(c.dailyLimitAmount).toBe(DEFAULT_BILLPAY_CONFIG.dailyLimitAmount);
    });

    it('maxAmount < minAmount 时回退 maxAmount', () => {
        const c = parseBillPayConfig({ minAmount: 5000, maxAmount: 1000 });
        expect(c.maxAmount).toBe(DEFAULT_BILLPAY_CONFIG.maxAmount);
    });

    it('接受已解析对象（非字符串）', () => {
        const c = parseBillPayConfig({ autoQuote: false });
        expect(c.autoQuote).toBe(false);
    });

    it('couponEnabled：仅布尔 true 开启，缺省/非布尔一律关闭（默认关闭）', () => {
        expect(parseBillPayConfig({ couponEnabled: true }).couponEnabled).toBe(true);
        expect(parseBillPayConfig({}).couponEnabled).toBe(false);
        expect(parseBillPayConfig({ couponEnabled: 'true' }).couponEnabled).toBe(false);
        expect(DEFAULT_BILLPAY_CONFIG.couponEnabled).toBe(false);
    });
});
