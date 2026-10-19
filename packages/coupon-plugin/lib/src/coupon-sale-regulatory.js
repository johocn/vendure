"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBillpayLimits = extractBillpayLimits;
exports.templateFaceValue = templateFaceValue;
exports.assertTemplateWithinRegulatoryLimits = assertTemplateWithinRegulatoryLimits;
exports.assertBundleWithinRegulatoryLimits = assertBundleWithinRegulatoryLimits;
const core_1 = require("@vendure/core");
const toPositiveInt = (v) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
};
/** 从 Channel 实体读监管参数（customFields 未配置 → 全 null = 宽松） */
function extractBillpayLimits(channel) {
    var _a;
    const cf = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) !== null && _a !== void 0 ? _a : {};
    return {
        maxSalePrice: toPositiveInt(cf.billpayMaxSalePrice),
        maxFaceValue: toPositiveInt(cf.billpayMaxFaceValue),
        maxBundleTotal: toPositiveInt(cf.billpayMaxBundleTotal),
        minValidDays: toPositiveInt(cf.billpayMinValidDays),
    };
}
/**
 * 静态面额折算：FIXED/FULL/FREE_SHIPPING 面额 = discountValue（分）；
 * PERCENT 的 discountValue 是折数（80 = 8 折），面额随消费金额浮动无法静态折算 → null（跳过面额校验，
 * 其资金上限由 maxSalePrice 兜底）。
 */
function templateFaceValue(tpl) {
    if (!tpl || tpl.type === 'PERCENT')
        return null;
    const v = Math.floor(Number(tpl.discountValue));
    return Number.isFinite(v) && v > 0 ? v : null;
}
function assertSalePriceWithinLimits(salePrice, limits) {
    if (limits.maxSalePrice != null && salePrice > limits.maxSalePrice) {
        throw new core_1.UserInputError(`Sale price ${salePrice} exceeds channel limit ${limits.maxSalePrice} (billpayMaxSalePrice)`);
    }
}
/** 单券监管校验：售价 / 静态面额 / 最短有效天数（P0 expireRefundPolicy 仅存档展示，不强制） */
function assertTemplateWithinRegulatoryLimits(tpl, limits) {
    var _a;
    assertSalePriceWithinLimits(Number((_a = tpl.salePrice) !== null && _a !== void 0 ? _a : 0), limits);
    const face = templateFaceValue(tpl);
    if (face != null && limits.maxFaceValue != null && face > limits.maxFaceValue) {
        throw new core_1.UserInputError(`Coupon face value ${face} exceeds channel limit ${limits.maxFaceValue} (billpayMaxFaceValue)`);
    }
    if (limits.minValidDays != null && tpl.validDays != null && Number(tpl.validDays) < limits.minValidDays) {
        throw new core_1.UserInputError(`Coupon validity ${tpl.validDays} days is shorter than channel minimum ${limits.minValidDays} (billpayMinValidDays)`);
    }
}
/** 券包监管校验：整包售价 / 包内静态面额合计（模板缺失时按 0 计，由 assertBundleStock 另行拦截） */
function assertBundleWithinRegulatoryLimits(bundleSalePrice, templates, quantities, limits) {
    assertSalePriceWithinLimits(bundleSalePrice, limits);
    if (limits.maxBundleTotal == null)
        return;
    let total = 0;
    templates.forEach((tpl, i) => {
        var _a;
        const face = tpl ? templateFaceValue(tpl) : null;
        if (face != null)
            total += face * Math.max(1, Math.floor((_a = quantities[i]) !== null && _a !== void 0 ? _a : 1));
    });
    if (total > limits.maxBundleTotal) {
        throw new core_1.UserInputError(`Bundle total face value ${total} exceeds channel limit ${limits.maxBundleTotal} (billpayMaxBundleTotal)`);
    }
}
//# sourceMappingURL=coupon-sale-regulatory.js.map