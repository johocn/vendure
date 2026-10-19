"use strict";
/**
 * 代买单（委托单模式）共享类型。全部金额单位为「分」，费率为百分数整数（85 = 8.5 折）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BILLPAY_CONFIG = void 0;
exports.isQuoteRejected = isQuoteRejected;
function isQuoteRejected(r) {
    return r.reason != null;
}
/** 坏配置兜底的默认渠道配置（SSR 友好：解析失败逐字段回退；须含全部必填字段，否则 GraphQL 非空字段报 null） */
exports.DEFAULT_BILLPAY_CONFIG = {
    autoQuote: true,
    quoteExpireMinutes: 30,
    couponEnabled: false,
    tolerancePercent: 10,
    minAmount: 2000,
    maxAmount: 200000,
    dailyLimitAmount: 200000,
    memberDiscount: null,
    thresholds: [],
};
//# sourceMappingURL=types.js.map