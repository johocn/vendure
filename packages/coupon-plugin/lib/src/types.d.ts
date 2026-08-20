/**
 * 券类型：
 * - FIXED ：满 minSpend 减 discountValue（满减）
 * - PERCENT ：满 minSpend 打 discountValue 折（1-99 整数，如 8.5折 → 85）
 * - FULL ：无门槛直减 discountValue（minSpend 强制 0）
 */
export type CouponType = 'FIXED' | 'PERCENT' | 'FULL';
/**
 * 用户券状态：
 * - UNUSED  ：已领取未使用（可结算选券）
 * - USED    ：支付成功已核销（usedOrderId 落单）
 * - RETURNED：取消订单后回退（可再次使用）
 * - EXPIRED ：已过期
 * - INVALID ：admin 撤销作废（未用券）
 */
export type CouponStatus = 'UNUSED' | 'USED' | 'RETURNED' | 'EXPIRED' | 'INVALID';
/** 发券来源 */
export type CouponIssuedBy = 'CENTRE' | 'ADMIN';
/** 券适用范围 */
export type CouponScope = 'ALL' | 'CATEGORY' | 'SKU';
export interface CouponPluginOptions {
    /** 券码展示前缀，默认 'C' */
    codePrefix?: string;
}
/** coupon_applied 条件返回给 coupon_discount 动作的 state 形状 */
export interface CouponAppliedConditionState {
    discountAmount: number;
}
