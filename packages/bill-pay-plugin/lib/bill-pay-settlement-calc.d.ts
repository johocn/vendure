/**
 * 买单结算成本计算（纯函数，便于单测）。
 *
 * 差价模型：平台按协议费率向商户结算成本 `baseCost = round(actualAmount × settleRate / 100)`。
 * 券抵扣的成本按券模板配置分摊：
 * - PLATFORM：平台承担，商户成本不变；
 * - MERCHANT：商户承担 100%，从应付商户款中扣减券抵扣额；
 * - SPLIT：按 merchantCostRate（0-100）分摊，四舍五入。
 * 商户承担额不超过 `baseCost`（应付商户款不出现负数），超出部分仍由平台承担。
 */
export type CouponCostBearer = 'PLATFORM' | 'MERCHANT' | 'SPLIT';
export interface SettlementCostInput {
    /** 平台报价（客户应付，已扣券） */
    quoteAmount: number;
    /** 实际账单原价 */
    actualAmount: number;
    /** 协议结算费率（百分数整数） */
    settleRate: number;
    /** 本单实际券抵扣额（分） */
    couponAmount?: number | null;
    /** 券模板成本承担方 */
    couponBearer?: string | null;
    /** SPLIT 下商户承担比例（0-100） */
    merchantCostRate?: number | null;
}
export interface SettlementCostResult {
    settleRate: number;
    /** 协议成本（未扣券） */
    baseCost: number;
    couponAmount: number;
    couponBearer: CouponCostBearer;
    couponCostRate: number;
    merchantCouponCost: number;
    platformCouponCost: number;
    /** 应付商户款 = baseCost − merchantCouponCost */
    costAmount: number;
    /** 毛利 = quoteAmount − costAmount */
    grossAmount: number;
}
/** 承担方 + 比例 → 商户承担比例（PLATFORM=0 / MERCHANT=100 / SPLIT=0-100） */
export declare function resolveCouponCostRate(bearer: string | null | undefined, merchantCostRate: number | null | undefined): number;
/** 归一化承担方（非法值一律回退 PLATFORM，保持历史口径） */
export declare function normalizeCouponBearer(bearer: string | null | undefined): CouponCostBearer;
export declare function computeSettlementCost(input: SettlementCostInput): SettlementCostResult;
