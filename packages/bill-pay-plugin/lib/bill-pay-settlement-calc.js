"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCouponCostRate = resolveCouponCostRate;
exports.normalizeCouponBearer = normalizeCouponBearer;
exports.computeSettlementCost = computeSettlementCost;
const clampInt = (value, min, max) => {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
};
/** 承担方 + 比例 → 商户承担比例（PLATFORM=0 / MERCHANT=100 / SPLIT=0-100） */
function resolveCouponCostRate(bearer, merchantCostRate) {
    const normalized = String(bearer !== null && bearer !== void 0 ? bearer : '').trim().toUpperCase();
    if (normalized === 'MERCHANT') {
        return 100;
    }
    if (normalized === 'SPLIT') {
        return clampInt(Number(merchantCostRate !== null && merchantCostRate !== void 0 ? merchantCostRate : 0), 0, 100);
    }
    return 0;
}
/** 归一化承担方（非法值一律回退 PLATFORM，保持历史口径） */
function normalizeCouponBearer(bearer) {
    const normalized = String(bearer !== null && bearer !== void 0 ? bearer : '').trim().toUpperCase();
    if (normalized === 'MERCHANT' || normalized === 'SPLIT') {
        return normalized;
    }
    return 'PLATFORM';
}
function computeSettlementCost(input) {
    var _a;
    const settleRate = Number.isFinite(Number(input.settleRate))
        ? Math.round(Number(input.settleRate))
        : 100;
    const actualAmount = Math.max(0, Math.round(Number(input.actualAmount) || 0));
    const quoteAmount = Math.round(Number(input.quoteAmount) || 0);
    const couponAmount = Math.max(0, Math.round(Number((_a = input.couponAmount) !== null && _a !== void 0 ? _a : 0) || 0));
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
//# sourceMappingURL=bill-pay-settlement-calc.js.map