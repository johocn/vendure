import { PromotionOrderAction } from '@vendure/core';
/**
 * 券折扣动作：依赖 coupon_applied 条件。条件已核算出 discountAmount 放在 state，
 * 此处直接取负值（PromotionAction 返回值必须为负数）。
 */
export declare const couponDiscountAction: PromotionOrderAction<any, []>;
