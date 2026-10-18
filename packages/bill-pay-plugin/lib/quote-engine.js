"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQuoteRejected = void 0;
exports.quoteBill = quoteBill;
exports.parseBillPayConfig = parseBillPayConfig;
const types_1 = require("./types");
Object.defineProperty(exports, "isQuoteRejected", { enumerable: true, get: function () { return types_1.isQuoteRejected; } });
/**
 * 报价引擎（纯函数，不走 Vendure 促销引擎）：对齐设计文档 §4。
 * 全程分单位整数运算；叠加顺序：会员折扣 → 最优满减档（reduce 最大）。
 */
function roundDiv(amount, divisor) {
    return Math.round(amount / divisor);
}
/**
 * 按规则报价。
 * - 金额非法（<=0）→ INVALID_AMOUNT；
 * - 低于 minAmount → BELOW_MIN（不接单）；
 * - 高于 maxAmount → ABOVE_MAX（转人工）；
 * - 会员折扣先按 percent 折算（四舍五入到分），满减档再对折扣后金额取最优档。
 */
function quoteBill(expectedAmount, rule) {
    const amount = Math.round(Number(expectedAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { payable: null, discountDetail: [], reason: 'INVALID_AMOUNT' };
    }
    if (amount < rule.minAmount) {
        return { payable: null, discountDetail: [], reason: 'BELOW_MIN' };
    }
    if (amount > rule.maxAmount) {
        return { payable: null, discountDetail: [], reason: 'ABOVE_MAX' };
    }
    const discountDetail = [];
    let payable = amount;
    const md = rule.memberDiscount;
    if (md && Number(md.percent) > 0 && Number(md.percent) < 100) {
        const afterDiscount = roundDiv(amount * Number(md.percent), 100);
        if (afterDiscount < payable) {
            discountDetail.push({
                rule: 'memberDiscount',
                label: md.label,
                amount: payable - afterDiscount,
            });
            payable = afterDiscount;
        }
    }
    const thresholds = Array.isArray(rule.thresholds) ? rule.thresholds : [];
    let best = null;
    for (const t of thresholds) {
        const minSpend = Math.round(Number(t === null || t === void 0 ? void 0 : t.minSpend));
        const reduce = Math.round(Number(t === null || t === void 0 ? void 0 : t.reduce));
        if (!Number.isFinite(minSpend) || !Number.isFinite(reduce) || reduce <= 0) {
            continue;
        }
        if (payable >= minSpend && (!best || reduce > best.reduce)) {
            best = { minSpend, reduce, label: t.label };
        }
    }
    if (best && best.reduce < payable) {
        discountDetail.push({ rule: 'threshold', label: best.label, amount: best.reduce });
        payable -= best.reduce;
    }
    return { payable, discountDetail };
}
function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
/**
 * 渠道配置解析（SSR 友好纯函数）：坏 JSON / 缺字段逐字段回退默认值，
 * 对齐项目 detail-config 的「坏配置返回默认、不抛错」模式。
 */
function parseBillPayConfig(raw) {
    var _a;
    if (raw == null) {
        return Object.assign({}, types_1.DEFAULT_BILLPAY_CONFIG);
    }
    let obj = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) {
            return Object.assign({}, types_1.DEFAULT_BILLPAY_CONFIG);
        }
        try {
            obj = JSON.parse(trimmed);
        }
        catch (_b) {
            return Object.assign({}, types_1.DEFAULT_BILLPAY_CONFIG);
        }
    }
    if (typeof obj !== 'object' || obj == null) {
        return Object.assign({}, types_1.DEFAULT_BILLPAY_CONFIG);
    }
    const config = {
        autoQuote: typeof obj.autoQuote === 'boolean' ? obj.autoQuote : types_1.DEFAULT_BILLPAY_CONFIG.autoQuote,
        quoteExpireMinutes: num(obj.quoteExpireMinutes, types_1.DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes) > 0
            ? num(obj.quoteExpireMinutes, types_1.DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes)
            : types_1.DEFAULT_BILLPAY_CONFIG.quoteExpireMinutes,
        couponEnabled: typeof obj.couponEnabled === 'boolean' ? obj.couponEnabled : false,
        tolerancePercent: num(obj.tolerancePercent, types_1.DEFAULT_BILLPAY_CONFIG.tolerancePercent),
        dailyLimitAmount: num(obj.dailyLimitAmount, types_1.DEFAULT_BILLPAY_CONFIG.dailyLimitAmount),
        minAmount: num(obj.minAmount, types_1.DEFAULT_BILLPAY_CONFIG.minAmount),
        maxAmount: num(obj.maxAmount, types_1.DEFAULT_BILLPAY_CONFIG.maxAmount),
        memberDiscount: null,
        thresholds: [],
    };
    if (obj.memberDiscount && typeof obj.memberDiscount === 'object') {
        const percent = num(obj.memberDiscount.percent, 0);
        if (percent > 0 && percent < 100) {
            config.memberDiscount = {
                percent,
                label: (_a = obj.memberDiscount.label) !== null && _a !== void 0 ? _a : undefined,
            };
        }
    }
    if (Array.isArray(obj.thresholds)) {
        config.thresholds = obj.thresholds
            .map((t) => {
            var _a;
            return ({
                minSpend: Math.round(num(t === null || t === void 0 ? void 0 : t.minSpend, 0)),
                reduce: Math.round(num(t === null || t === void 0 ? void 0 : t.reduce, 0)),
                label: (_a = t === null || t === void 0 ? void 0 : t.label) !== null && _a !== void 0 ? _a : undefined,
            });
        })
            .filter((t) => t.minSpend > 0 && t.reduce > 0);
    }
    if (config.minAmount <= 0) {
        config.minAmount = types_1.DEFAULT_BILLPAY_CONFIG.minAmount;
    }
    if (config.maxAmount < config.minAmount) {
        config.maxAmount = types_1.DEFAULT_BILLPAY_CONFIG.maxAmount;
    }
    if (config.dailyLimitAmount < config.minAmount) {
        config.dailyLimitAmount = types_1.DEFAULT_BILLPAY_CONFIG.dailyLimitAmount;
    }
    return config;
}
//# sourceMappingURL=quote-engine.js.map