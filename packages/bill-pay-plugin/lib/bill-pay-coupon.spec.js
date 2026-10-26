"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const vitest_1 = require("vitest");
const bill_pay_coupon_1 = require("./bill-pay-coupon");
const quote_engine_1 = require("./quote-engine");
(0, vitest_1.describe)('applyCouponToQuote', () => {
    (0, vitest_1.it)('正常抵扣：追加 coupon 明细，应付按券面额减少', () => {
        const quote = {
            payable: 9000,
            discountDetail: [{ rule: 'memberDiscount', label: undefined, amount: 1000 }],
        };
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, 2000, '满100减20');
        (0, vitest_1.expect)(r.payable).toBe(7000);
        (0, vitest_1.expect)(r.discountDetail).toEqual([
            { rule: 'memberDiscount', label: undefined, amount: 1000 },
            { rule: 'coupon', label: '满100减20', amount: 2000 },
        ]);
    });
    (0, vitest_1.it)('券额大于应付：应付截断为 0，明细金额同步截断（保证明细合计仍可对账）', () => {
        const quote = { payable: 3000, discountDetail: [] };
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, 5000, '无条件直减');
        (0, vitest_1.expect)(r.payable).toBe(0);
        (0, vitest_1.expect)(r.discountDetail).toEqual([{ rule: 'coupon', label: '无条件直减', amount: 3000 }]);
    });
    (0, vitest_1.it)('券额非正/非法：不追加明细，应付保持原样', () => {
        const quote = { payable: 9000, discountDetail: [] };
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, 0, 'x')).toEqual(quote);
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, NaN, 'x')).toEqual(quote);
    });
    (0, vitest_1.it)('券额等于应付：应付归零，明细金额等于原应付', () => {
        const quote = { payable: 3000, discountDetail: [] };
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, 3000, '刚好抵完');
        (0, vitest_1.expect)(r.payable).toBe(0);
        (0, vitest_1.expect)(r.discountDetail).toEqual([{ rule: 'coupon', label: '刚好抵完', amount: 3000 }]);
    });
    (0, vitest_1.it)('应付已为 0：不追加负向抵扣明细（避免明细合计大于原价）', () => {
        const quote = { payable: 0, discountDetail: [] };
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, 500, 'x')).toEqual({ payable: 0, discountDetail: [] });
    });
    (0, vitest_1.it)('负值 / Infinity 券额：视为无效，不追加明细', () => {
        const quote = { payable: 9000, discountDetail: [] };
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, -500, 'x')).toEqual(quote);
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, Infinity, 'x')).toEqual(quote);
    });
    (0, vitest_1.it)('非整数券额四舍五入到分', () => {
        const quote = { payable: 9000, discountDetail: [] };
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, 1999.6, 'x').payable).toBe(7000);
        (0, vitest_1.expect)((0, bill_pay_coupon_1.applyCouponToQuote)(quote, 1999.4, 'x').payable).toBe(7001);
    });
    (0, vitest_1.it)('返回新对象与新明细数组，不修改入参', () => {
        const quote = {
            payable: 9000,
            discountDetail: [{ rule: 'memberDiscount', label: undefined, amount: 1000 }],
        };
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, 2000, '满减券');
        (0, vitest_1.expect)(r).not.toBe(quote);
        (0, vitest_1.expect)(r.discountDetail).not.toBe(quote.discountDetail);
        // 入参保持原值，便于调用方复用报价结果做其他判断
        (0, vitest_1.expect)(quote.payable).toBe(9000);
        (0, vitest_1.expect)(quote.discountDetail).toHaveLength(1);
    });
    (0, vitest_1.it)('label 支持多语言对象（原样透传，供 C 端按 locale 取词）', () => {
        const quote = { payable: 9000, discountDetail: [] };
        const label = { 'zh-CN': '满100减20', 'en-US': '20 off 100' };
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, 2000, label);
        (0, vitest_1.expect)(r.discountDetail[0]).toEqual({ rule: 'coupon', label, amount: 2000 });
    });
});
(0, vitest_1.describe)('computeInStoreBill 在代买单场景（门槛按原价，券抵报价后应付）', () => {
    // 会员 9 折 + 满 5000 减 1000：原价 10000 → 报价 8000，原有明细两项
    const rule = {
        minAmount: 2000,
        maxAmount: 200000,
        memberDiscount: { percent: 90 },
        thresholds: [{ minSpend: 5000, reduce: 1000 }],
    };
    const originalAmount = 10000;
    const quote = (0, quote_engine_1.quoteBill)(originalAmount, rule);
    (0, vitest_1.it)('报价基线：会员折扣 + 满减共减 2000，应付 8000', () => {
        (0, vitest_1.expect)(quote.payable).toBe(8000);
        (0, vitest_1.expect)(quote.discountDetail).toEqual([
            { rule: 'memberDiscount', label: undefined, amount: 1000 },
            { rule: 'threshold', label: undefined, amount: 1000 },
        ]);
    });
    (0, vitest_1.it)('FIXED 直减 2000：券抵扣 2000，最终应付 6000', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 2000, minSpend: 0 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: true, originalAmount, discountAmount: 2000, finalAmount: 8000 });
        if (!computed.ok)
            throw new Error('compute failed');
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, computed.discountAmount, '满减券');
        (0, vitest_1.expect)(r.payable).toBe(6000);
        (0, vitest_1.expect)(r.discountDetail[r.discountDetail.length - 1]).toEqual({
            rule: 'coupon',
            label: '满减券',
            amount: 2000,
        });
    });
    (0, vitest_1.it)('PERCENT 8 折：券抵扣 2000（按原价计），最终应付 6000', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'PERCENT', discountValue: 80, minSpend: 0 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: true, originalAmount, discountAmount: 2000, finalAmount: 8000 });
        if (!computed.ok)
            throw new Error('compute failed');
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, computed.discountAmount, '8 折券');
        (0, vitest_1.expect)(r.payable).toBe(6000);
    });
    (0, vitest_1.it)('FULL 无门槛直减 500：券抵扣 500，最终应付 7500', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FULL', discountValue: 500, minSpend: 0 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: true, originalAmount, discountAmount: 500, finalAmount: 9500 });
        if (!computed.ok)
            throw new Error('compute failed');
        const r = (0, bill_pay_coupon_1.applyCouponToQuote)(quote, computed.discountAmount, '无门槛券');
        (0, vitest_1.expect)(r.payable).toBe(7500);
    });
    (0, vitest_1.it)('门槛按原价判定：原价未达标即拒绝（即使报价后更低）', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 2000, minSpend: 12000 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: false, reason: 'MIN_SPEND_NOT_MET' });
    });
    (0, vitest_1.it)('门槛边界：原价恰好等于 minSpend 时可用', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 2000, minSpend: 10000 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: true, originalAmount, discountAmount: 2000, finalAmount: 8000 });
    });
    (0, vitest_1.it)('FULL 券面额高于原价：抵扣截断为原价、最终应付 0', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FULL', discountValue: 20000, minSpend: 0 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: true, originalAmount, discountAmount: 10000, finalAmount: 0 });
    });
    (0, vitest_1.it)('运费券不支持代买单：FREE_SHIPPING → TYPE_NOT_SUPPORTED', () => {
        const computed = (0, coupon_plugin_1.computeInStoreBill)({ type: 'FREE_SHIPPING', discountValue: 0, minSpend: 0 }, originalAmount);
        (0, vitest_1.expect)(computed).toEqual({ ok: false, reason: 'TYPE_NOT_SUPPORTED' });
    });
    (0, vitest_1.it)('原价非法（0 / 负数 / 非整数）→ INVALID_AMOUNT', () => {
        (0, vitest_1.expect)((0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 1000, minSpend: 0 }, 0)).toEqual({
            ok: false,
            reason: 'INVALID_AMOUNT',
        });
        (0, vitest_1.expect)((0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 1000, minSpend: 0 }, -100)).toEqual({
            ok: false,
            reason: 'INVALID_AMOUNT',
        });
        (0, vitest_1.expect)((0, coupon_plugin_1.computeInStoreBill)({ type: 'FIXED', discountValue: 1000, minSpend: 0 }, 100.5)).toEqual({
            ok: false,
            reason: 'INVALID_AMOUNT',
        });
    });
});
//# sourceMappingURL=bill-pay-coupon.spec.js.map