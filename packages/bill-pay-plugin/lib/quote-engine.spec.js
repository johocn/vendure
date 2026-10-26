"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const quote_engine_1 = require("./quote-engine");
const types_1 = require("./types");
(0, vitest_1.describe)('quoteBill', () => {
    const baseRule = { minAmount: 2000, maxAmount: 200000 };
    (0, vitest_1.it)('无规则时原价通过', () => {
        const r = (0, quote_engine_1.quoteBill)(10000, baseRule);
        (0, vitest_1.expect)(r).toEqual({ payable: 10000, discountDetail: [] });
    });
    (0, vitest_1.it)('金额非法（0/负数/非数）拒绝', () => {
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(0, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(-100, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(NaN, baseRule)).toMatchObject({ reason: 'INVALID_AMOUNT' });
    });
    (0, vitest_1.it)('低于 minAmount 拒绝（不接单）', () => {
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(1999, baseRule)).toMatchObject({ reason: 'BELOW_MIN' });
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(2000, baseRule)).toMatchObject({ payable: 2000 });
    });
    (0, vitest_1.it)('高于 maxAmount 拒绝（转人工）', () => {
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(200001, baseRule)).toMatchObject({ reason: 'ABOVE_MAX' });
        (0, vitest_1.expect)((0, quote_engine_1.quoteBill)(200000, baseRule)).toMatchObject({ payable: 200000 });
    });
    (0, vitest_1.it)('会员折扣：90 = 9 折，四舍五入到分', () => {
        const r = (0, quote_engine_1.quoteBill)(10000, Object.assign(Object.assign({}, baseRule), { memberDiscount: { percent: 90 } }));
        (0, vitest_1.expect)(r).toEqual({
            payable: 9000,
            discountDetail: [{ rule: 'memberDiscount', label: undefined, amount: 1000 }],
        });
    });
    (0, vitest_1.it)('会员折扣非整数金额四舍五入（3333 分 × 85% = 2833.05 → 2833）', () => {
        const r = (0, quote_engine_1.quoteBill)(3333, Object.assign(Object.assign({}, baseRule), { memberDiscount: { percent: 85 } }));
        (0, vitest_1.expect)(r.payable).toBe(2833);
    });
    (0, vitest_1.it)('满减取最优档（reduce 最大）', () => {
        const r = (0, quote_engine_1.quoteBill)(20000, Object.assign(Object.assign({}, baseRule), { thresholds: [
                { minSpend: 10000, reduce: 500 },
                { minSpend: 20000, reduce: 2000 },
                { minSpend: 5000, reduce: 100 },
            ] }));
        (0, vitest_1.expect)(r).toEqual({
            payable: 18000,
            discountDetail: [{ rule: 'threshold', label: undefined, amount: 2000 }],
        });
    });
    (0, vitest_1.it)('叠加顺序：会员折扣 → 最优满减档（满减按折扣后金额判定）', () => {
        const r = (0, quote_engine_1.quoteBill)(10000, Object.assign(Object.assign({}, baseRule), { memberDiscount: { percent: 90 }, thresholds: [
                { minSpend: 9500, reduce: 500 }, // 折后 9000 不可达
                { minSpend: 8000, reduce: 300 }, // 折后 9000 命中
            ] }));
        (0, vitest_1.expect)(r.payable).toBe(8700);
        (0, vitest_1.expect)(r.discountDetail).toEqual([
            { rule: 'memberDiscount', label: undefined, amount: 1000 },
            { rule: 'threshold', label: undefined, amount: 300 },
        ]);
    });
    (0, vitest_1.it)('满减不小于应付（reduce >= payable 时不生效，避免负数）', () => {
        const r = (0, quote_engine_1.quoteBill)(2000, Object.assign(Object.assign({}, baseRule), { thresholds: [{ minSpend: 2000, reduce: 5000 }] }));
        (0, vitest_1.expect)(r.payable).toBe(2000);
        (0, vitest_1.expect)(r.discountDetail).toEqual([]);
    });
    (0, vitest_1.it)('坏档位（0/负值/缺字段）被忽略', () => {
        const r = (0, quote_engine_1.quoteBill)(20000, Object.assign(Object.assign({}, baseRule), { thresholds: [
                { minSpend: 0, reduce: 100 },
                { minSpend: 10000, reduce: 0 },
                { minSpend: -5, reduce: -100 },
                { minSpend: 15000, reduce: 200 },
            ] }));
        (0, vitest_1.expect)(r.payable).toBe(19800);
    });
});
(0, vitest_1.describe)('parseBillPayConfig', () => {
    (0, vitest_1.it)('null / 空串 / 坏 JSON 回退默认配置', () => {
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)(null)).toEqual(types_1.DEFAULT_BILLPAY_CONFIG);
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)('')).toEqual(types_1.DEFAULT_BILLPAY_CONFIG);
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)('{bad json')).toEqual(types_1.DEFAULT_BILLPAY_CONFIG);
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)(42)).toEqual(types_1.DEFAULT_BILLPAY_CONFIG);
    });
    (0, vitest_1.it)('完整配置解析 + 分单位保留', () => {
        var _a;
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
        const c = (0, quote_engine_1.parseBillPayConfig)(raw);
        (0, vitest_1.expect)(c.autoQuote).toBe(false);
        (0, vitest_1.expect)(c.quoteExpireMinutes).toBe(15);
        (0, vitest_1.expect)((_a = c.memberDiscount) === null || _a === void 0 ? void 0 : _a.percent).toBe(95);
        (0, vitest_1.expect)(c.thresholds).toHaveLength(1);
        (0, vitest_1.expect)(c.tolerancePercent).toBe(5);
        (0, vitest_1.expect)(c.dailyLimitAmount).toBe(300000);
    });
    (0, vitest_1.it)('缺字段逐字段回退；坏档位/非法折扣剔除', () => {
        const c = (0, quote_engine_1.parseBillPayConfig)({
            quoteExpireMinutes: 0,
            memberDiscount: { percent: 120 },
            thresholds: [{ minSpend: 100, reduce: 0 }],
            minAmount: -1,
        });
        (0, vitest_1.expect)(c.quoteExpireMinutes).toBe(types_1.DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes);
        (0, vitest_1.expect)(c.memberDiscount).toBeNull();
        (0, vitest_1.expect)(c.thresholds).toEqual([]);
        (0, vitest_1.expect)(c.minAmount).toBe(types_1.DEFAULT_BILLPAY_CONFIG.minAmount);
        (0, vitest_1.expect)(c.maxAmount).toBe(types_1.DEFAULT_BILLPAY_CONFIG.maxAmount);
        (0, vitest_1.expect)(c.dailyLimitAmount).toBe(types_1.DEFAULT_BILLPAY_CONFIG.dailyLimitAmount);
    });
    (0, vitest_1.it)('maxAmount < minAmount 时回退 maxAmount', () => {
        const c = (0, quote_engine_1.parseBillPayConfig)({ minAmount: 5000, maxAmount: 1000 });
        (0, vitest_1.expect)(c.maxAmount).toBe(types_1.DEFAULT_BILLPAY_CONFIG.maxAmount);
    });
    (0, vitest_1.it)('接受已解析对象（非字符串）', () => {
        const c = (0, quote_engine_1.parseBillPayConfig)({ autoQuote: false });
        (0, vitest_1.expect)(c.autoQuote).toBe(false);
    });
    (0, vitest_1.it)('couponEnabled：仅布尔 true 开启，缺省/非布尔一律关闭（默认关闭）', () => {
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)({ couponEnabled: true }).couponEnabled).toBe(true);
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)({}).couponEnabled).toBe(false);
        (0, vitest_1.expect)((0, quote_engine_1.parseBillPayConfig)({ couponEnabled: 'true' }).couponEnabled).toBe(false);
        (0, vitest_1.expect)(types_1.DEFAULT_BILLPAY_CONFIG.couponEnabled).toBe(false);
    });
});
//# sourceMappingURL=quote-engine.spec.js.map