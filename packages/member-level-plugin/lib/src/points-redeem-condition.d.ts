import { PromotionCondition } from '@vendure/core';
/**
 * 积分抵现条件：读 order.customFields.pointsToRedeem / pointsRedeemAmount，
 * 绑定即扣策略下金额已在 redeemPoints 时折算并写入订单字段，结算期直接读取（无需 DB）。
 *
 * 返回 state `{ pointsToRedeem, pointsRedeemAmount }` 供 points_redeem_discount 动作折让。
 */
export declare const pointsRedeemCondition: PromotionCondition<{}, "points_redeem", false | {
    pointsToRedeem: any;
    pointsRedeemAmount: any;
}>;
