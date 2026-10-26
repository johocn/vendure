"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCouponToQuote = applyCouponToQuote;
/**
 * 把券抵扣叠加到自动报价结果上（纯函数，便于单测）。
 * 券以「报价后应付」为上限：报价已含会员折扣/满减，券不能再把应付扣成负数；
 * 明细金额同步截断为实际抵扣额，保证「明细合计 = 原价 - 应付」仍成立，便于对账。
 */
function applyCouponToQuote(quoteResult, discount, label) {
    const requested = Math.round(Number(discount));
    const capped = Number.isFinite(requested)
        ? Math.min(Math.max(0, requested), quoteResult.payable)
        : 0;
    if (capped <= 0) {
        return { payable: quoteResult.payable, discountDetail: [...quoteResult.discountDetail] };
    }
    const couponItem = { rule: 'coupon', label, amount: capped };
    return {
        payable: quoteResult.payable - capped,
        discountDetail: [...quoteResult.discountDetail, couponItem],
    };
}
//# sourceMappingURL=bill-pay-coupon.js.map