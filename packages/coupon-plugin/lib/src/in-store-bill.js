"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IN_STORE_REASON_MESSAGES = exports.IN_STORE_REASON = void 0;
exports.computeInStoreBill = computeInStoreBill;
/** 核销失败原因码（quote 原样返回，redeem 转 UserInputError 文案） */
exports.IN_STORE_REASON = {
    COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
    TEMPLATE_DISABLED: 'TEMPLATE_DISABLED',
    COUPON_NOT_UNUSED: 'COUPON_NOT_UNUSED',
    COUPON_EXPIRED: 'COUPON_EXPIRED',
    SCENE_MISMATCH: 'SCENE_MISMATCH',
    TENANT_MISMATCH: 'TENANT_MISMATCH',
    TYPE_NOT_SUPPORTED: 'TYPE_NOT_SUPPORTED',
    MIN_SPEND_NOT_MET: 'MIN_SPEND_NOT_MET',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
};
/** 原因码 → 中文文案（admin 端 UserInputError 消息） */
exports.IN_STORE_REASON_MESSAGES = {
    COUPON_NOT_FOUND: '优惠券不存在',
    TEMPLATE_DISABLED: '该优惠券已下架',
    COUPON_NOT_UNUSED: '该优惠券已使用或当前不可用',
    COUPON_EXPIRED: '该优惠券已过期',
    SCENE_MISMATCH: '该券不支持到店买单',
    TENANT_MISMATCH: '该券不属于当前门店',
    TYPE_NOT_SUPPORTED: '该券类型不支持到店买单',
    MIN_SPEND_NOT_MET: '未达到该券使用门槛',
    INVALID_AMOUNT: '请输入有效的消费金额',
};
/**
 * 按券规则计算到店买单金额。
 * - PERCENT：finalAmount = round(originalAmount * discountValue / 100)
 * - FIXED / FULL：discountAmount = min(discountValue, originalAmount)
 * - FREE_SHIPPING：到店买单不支持
 */
function computeInStoreBill(template, originalAmount) {
    var _a;
    if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
        return { ok: false, reason: exports.IN_STORE_REASON.INVALID_AMOUNT };
    }
    if (template.type === 'FREE_SHIPPING') {
        return { ok: false, reason: exports.IN_STORE_REASON.TYPE_NOT_SUPPORTED };
    }
    const minSpend = (_a = template.minSpend) !== null && _a !== void 0 ? _a : 0;
    if (minSpend > 0 && originalAmount < minSpend) {
        return { ok: false, reason: exports.IN_STORE_REASON.MIN_SPEND_NOT_MET };
    }
    let discountAmount;
    if (template.type === 'PERCENT') {
        const finalAmount = Math.round((originalAmount * template.discountValue) / 100);
        discountAmount = originalAmount - finalAmount;
    }
    else {
        discountAmount = Math.min(template.discountValue, originalAmount);
    }
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    return { ok: true, originalAmount, discountAmount, finalAmount };
}
//# sourceMappingURL=in-store-bill.js.map