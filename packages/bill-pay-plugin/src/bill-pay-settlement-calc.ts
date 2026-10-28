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

const clampInt = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
};

/** 承担方 + 比例 → 商户承担比例（PLATFORM=0 / MERCHANT=100 / SPLIT=0-100） */
export function resolveCouponCostRate(
    bearer: string | null | undefined,
    merchantCostRate: number | null | undefined,
): number {
    const normalized = String(bearer ?? '').trim().toUpperCase();
    if (normalized === 'MERCHANT') {
        return 100;
    }
    if (normalized === 'SPLIT') {
        return clampInt(Number(merchantCostRate ?? 0), 0, 100);
    }
    return 0;
}

/** 归一化承担方（非法值一律回退 PLATFORM，保持历史口径） */
export function normalizeCouponBearer(
    bearer: string | null | undefined,
): CouponCostBearer {
    const normalized = String(bearer ?? '').trim().toUpperCase();
    if (normalized === 'MERCHANT' || normalized === 'SPLIT') {
        return normalized;
    }
    return 'PLATFORM';
}

export function computeSettlementCost(input: SettlementCostInput): SettlementCostResult {
    const settleRate = Number.isFinite(Number(input.settleRate))
        ? Math.round(Number(input.settleRate))
        : 100;
    const actualAmount = Math.max(0, Math.round(Number(input.actualAmount) || 0));
    const quoteAmount = Math.round(Number(input.quoteAmount) || 0);
    const couponAmount = Math.max(0, Math.round(Number(input.couponAmount ?? 0) || 0));
    const couponBearer = normalizeCouponBearer(input.couponBearer);
    const couponCostRate = resolveCouponCostRate(couponBearer, input.merchantCostRate);

    const baseCost = Math.round((actualAmount * settleRate) / 100);
    // 商户承担的券成本不超过应付商户款，避免结算金额为负
    const requestedMerchantCost = Math.round((couponAmount * couponCostRate) / 100);
    const merchantCouponCost = Math.min(baseCost, Math.max(0, requestedMerchantCost));
    const platformCouponCost = Math.max(0, couponAmount - merchantCouponCost);
    const costAmount = Math.max(0, baseCost - merchantCouponCost);

    return {
        settleRate,
        baseCost,
        couponAmount,
        couponBearer,
        couponCostRate,
        merchantCouponCost,
        platformCouponCost,
        costAmount,
        grossAmount: quoteAmount - costAmount,
    };
}
