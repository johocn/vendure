/**
 * 到店买单：金额试算（纯函数）与失败原因码。
 * 金额单位统一为「分」（int）。本文件不依赖 DB / Nest，可直接单测。
 */
import { CouponTemplate } from './coupon-template.entity';

/** 核销失败原因码（quote 原样返回，redeem 转 UserInputError 文案） */
export const IN_STORE_REASON = {
    COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
    TEMPLATE_DISABLED: 'TEMPLATE_DISABLED',
    COUPON_NOT_UNUSED: 'COUPON_NOT_UNUSED',
    COUPON_EXPIRED: 'COUPON_EXPIRED',
    SCENE_MISMATCH: 'SCENE_MISMATCH',
    TENANT_MISMATCH: 'TENANT_MISMATCH',
    SCOPE_MISMATCH: 'SCOPE_MISMATCH',
    TYPE_NOT_SUPPORTED: 'TYPE_NOT_SUPPORTED',
    MIN_SPEND_NOT_MET: 'MIN_SPEND_NOT_MET',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const;

export type InStoreReason = (typeof IN_STORE_REASON)[keyof typeof IN_STORE_REASON];

/** 原因码 → 中文文案（admin 端 UserInputError 消息） */
export const IN_STORE_REASON_MESSAGES: Record<InStoreReason, string> = {
    COUPON_NOT_FOUND: '优惠券不存在',
    TEMPLATE_DISABLED: '该优惠券已下架',
    COUPON_NOT_UNUSED: '该优惠券已使用或当前不可用',
    COUPON_EXPIRED: '该优惠券已过期',
    SCENE_MISMATCH: '该券不支持到店买单',
    TENANT_MISMATCH: '该券不属于当前门店',
    SCOPE_MISMATCH: '该券不在你的核销范围内，请联系店主配置可核销配送档案',
    TYPE_NOT_SUPPORTED: '该券类型不支持到店买单',
    MIN_SPEND_NOT_MET: '未达到该券使用门槛',
    INVALID_AMOUNT: '请输入有效的消费金额',
};

export type InStoreComputeResult =
    | { ok: true; originalAmount: number; discountAmount: number; finalAmount: number }
    | { ok: false; reason: InStoreReason };

/**
 * 按券规则计算到店买单金额。
 * - PERCENT：finalAmount = round(originalAmount * discountValue / 100)
 * - FIXED / FULL：discountAmount = min(discountValue, originalAmount)
 * - FREE_SHIPPING：到店买单不支持
 */
export function computeInStoreBill(
    template: Pick<CouponTemplate, 'type' | 'discountValue' | 'minSpend'>,
    originalAmount: number,
): InStoreComputeResult {
    if (!Number.isInteger(originalAmount) || originalAmount <= 0) {
        return { ok: false, reason: IN_STORE_REASON.INVALID_AMOUNT };
    }
    if (template.type === 'FREE_SHIPPING') {
        return { ok: false, reason: IN_STORE_REASON.TYPE_NOT_SUPPORTED };
    }
    const minSpend = template.minSpend ?? 0;
    if (minSpend > 0 && originalAmount < minSpend) {
        return { ok: false, reason: IN_STORE_REASON.MIN_SPEND_NOT_MET };
    }
    let discountAmount: number;
    if (template.type === 'PERCENT') {
        const finalAmount = Math.round((originalAmount * template.discountValue) / 100);
        discountAmount = originalAmount - finalAmount;
    } else {
        discountAmount = Math.min(template.discountValue, originalAmount);
    }
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    return { ok: true, originalAmount, discountAmount, finalAmount };
}
