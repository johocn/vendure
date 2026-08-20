import { PromotionCondition } from '@vendure/core';
/**
 * 券结算条件：读取 order.customFields.couponCode，
 * 校验券仍有效（UNUSED/模板 enabled/未过期/门槛满足）后，
 * 计算出一个正的 discountAmount（作为 state 传给配套 action）。
 *
 * 返回 state `{ discountAmount }` 表示条件成立，并让 action 直接复用折扣额。
 */
export declare const couponAppliedCondition: PromotionCondition<{}, "coupon_applied", false | {
    discountAmount: number;
}>;
