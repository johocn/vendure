/**
 * 代买单（委托单模式）共享类型。全部金额单位为「分」，费率为百分数整数（85 = 8.5 折）。
 */

export type BillPayStatus =
    | 'PENDING_QUOTE'
    | 'QUOTED'
    | 'PAID'
    | 'IN_SERVICE'
    | 'COMPLETED'
    | 'SETTLED'
    | 'CANCELLED'
    | 'REFUNDED';

export type BillPaySettleMode = 'PER_ORDER' | 'MONTHLY';

/** 多语言文案（渠道配置内嵌 JSON 用，键为 nshop locale，如 zh-CN / en-US） */
export type LocalizedLabel = string | Record<string, string>;

/** 报价规则（设计文档 §4）。券抵扣位 P0 预留不实现。 */
export interface BillPayRule {
    /** 会员折扣：percent=90 即 9 折 */
    memberDiscount?: { percent: number; label?: LocalizedLabel } | null;
    /** 满减档：在会员折扣后的应付金额上取最优（reduce 最大）一档 */
    thresholds?: { minSpend: number; reduce: number; label?: LocalizedLabel }[] | null;
    /** 低于此金额不接单 */
    minAmount: number;
    /** 超出此金额转人工报价 */
    maxAmount: number;
}

/** 渠道级代买单配置（存 bill_pay_config 表 JSON 列，对齐设计文档 §4 样例 + §13 单日限额） */
export interface BillPayChannelConfig extends BillPayRule {
    autoQuote: boolean;
    quoteExpireMinutes: number;
    couponEnabled: boolean;
    /** 凭证回传容忍阈值：|actual - quote| / quote 超过该百分数需备注说明 */
    tolerancePercent: number;
    /** 单日累计限额（分，合规 §13：单笔限额即 min/max，单日限额在此） */
    dailyLimitAmount: number;
}

/** 报价结果 */
export interface QuoteDiscountItem {
    /** 规则标识：memberDiscount | threshold */
    rule: string;
    label?: LocalizedLabel;
    /** 优惠金额（分） */
    amount: number;
}

export interface QuoteResult {
    payable: number;
    discountDetail: QuoteDiscountItem[];
}

/** 报价失败（可配置原因驱动前端文案） */
export interface QuoteRejected {
    payable: null;
    discountDetail: [];
    reason: 'BELOW_MIN' | 'ABOVE_MAX' | 'INVALID_AMOUNT';
}

export type QuoteOutcome = QuoteResult | QuoteRejected;

export function isQuoteRejected(r: QuoteOutcome): r is QuoteRejected {
    return (r as QuoteRejected).reason != null;
}

/** 坏配置兜底的默认渠道配置（SSR 友好：解析失败逐字段回退） */
export const DEFAULT_BILLPAY_CONFIG: BillPayChannelConfig = {
    autoQuote: true,
    quoteExpireMinutes: 30,
    couponEnabled: false,
    tolerancePercent: 10,
    minAmount: 2000,
    maxAmount: 200000,
    dailyLimitAmount: 200000,
};
