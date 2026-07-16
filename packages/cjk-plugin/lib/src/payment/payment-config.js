"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readChannelPayConfig = readChannelPayConfig;
exports.getPaymentOverride = getPaymentOverride;
function readChannelPayConfig(ctx) {
    var _a, _b;
    const raw = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.payConfig;
    if (!raw)
        return null;
    const result = {};
    if (raw.alipayJson) {
        try {
            result.alipay = JSON.parse(raw.alipayJson);
        }
        catch (_c) { }
    }
    if (raw.wechatpayJson) {
        try {
            result.wechatpay = JSON.parse(raw.wechatpayJson);
        }
        catch (_d) { }
    }
    return Object.keys(result).length > 0 ? result : null;
}
function getPaymentOverride(ctx, method) {
    try {
        const config = readChannelPayConfig(ctx);
        if (!config)
            return null;
        return config[method] || null;
    }
    catch (_a) {
        return null;
    }
}
//# sourceMappingURL=payment-config.js.map