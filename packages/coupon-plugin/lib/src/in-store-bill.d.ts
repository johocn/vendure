/**
 * 到店买单：金额试算（纯函数）与失败原因码。
 * 金额单位统一为「分」（int）。本文件不依赖 DB / Nest，可直接单测。
 */
import { CouponTemplate } from './coupon-template.entity';
/** 核销失败原因码（quote 原样返回，redeem 转 UserInputError 文案） */
export declare const IN_STORE_REASON: {
    readonly COUPON_NOT_FOUND: "COUPON_NOT_FOUND";
    readonly TEMPLATE_DISABLED: "TEMPLATE_DISABLED";
    readonly COUPON_NOT_UNUSED: "COUPON_NOT_UNUSED";
    readonly COUPON_EXPIRED: "COUPON_EXPIRED";
    readonly SCENE_MISMATCH: "SCENE_MISMATCH";
    readonly TENANT_MISMATCH: "TENANT_MISMATCH";
    readonly TYPE_NOT_SUPPORTED: "TYPE_NOT_SUPPORTED";
    readonly MIN_SPEND_NOT_MET: "MIN_SPEND_NOT_MET";
    readonly INVALID_AMOUNT: "INVALID_AMOUNT";
};
export type InStoreReason = (typeof IN_STORE_REASON)[keyof typeof IN_STORE_REASON];
/** 原因码 → 中文文案（admin 端 UserInputError 消息） */
export declare const IN_STORE_REASON_MESSAGES: Record<InStoreReason, string>;
export type InStoreComputeResult = {
    ok: true;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
} | {
    ok: false;
    reason: InStoreReason;
};
/**
 * 按券规则计算到店买单金额。
 * - PERCENT：finalAmount = round(originalAmount * discountValue / 100)
 * - FIXED / FULL：discountAmount = min(discountValue, originalAmount)
 * - FREE_SHIPPING：到店买单不支持
 */
export declare function computeInStoreBill(template: Pick<CouponTemplate, 'type' | 'discountValue' | 'minSpend'>, originalAmount: number): InStoreComputeResult;
