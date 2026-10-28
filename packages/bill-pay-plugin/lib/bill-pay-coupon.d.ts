import { LocalizedLabel, QuoteResult } from './types';
/**
 * 把券抵扣叠加到自动报价结果上（纯函数，便于单测）。
 * 券以「报价后应付」为上限：报价已含会员折扣/满减，券不能再把应付扣成负数；
 * 同时至少保留 1 分应付：0 元单无法走微信网关（最小 1 分）与余额扣款（金额须 > 0），会卡单。
 * 明细金额同步截断为实际抵扣额，保证「明细合计 = 原价 - 应付」仍成立，便于对账。
 */
export declare function applyCouponToQuote(quoteResult: QuoteResult, discount: number, label?: LocalizedLabel): QuoteResult;
