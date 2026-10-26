import { LocalizedLabel, QuoteDiscountItem, QuoteResult } from './types';

/**
 * 把券抵扣叠加到自动报价结果上（纯函数，便于单测）。
 * 券以「报价后应付」为上限：报价已含会员折扣/满减，券不能再把应付扣成负数；
 * 明细金额同步截断为实际抵扣额，保证「明细合计 = 原价 - 应付」仍成立，便于对账。
 */
export function applyCouponToQuote(
    quoteResult: QuoteResult,
    discount: number,
    label?: LocalizedLabel,
): QuoteResult {
    const requested = Math.round(Number(discount));
    const capped = Number.isFinite(requested)
        ? Math.min(Math.max(0, requested), quoteResult.payable)
        : 0;
    if (capped <= 0) {
        return { payable: quoteResult.payable, discountDetail: [...quoteResult.discountDetail] };
    }
    const couponItem: QuoteDiscountItem = { rule: 'coupon', label, amount: capped };
    return {
        payable: quoteResult.payable - capped,
        discountDetail: [...quoteResult.discountDetail, couponItem],
    };
}
