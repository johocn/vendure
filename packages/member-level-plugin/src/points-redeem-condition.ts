import { LanguageCode, PromotionCondition, RequestContext } from '@vendure/core';

/**
 * 积分抵现条件：读 order.customFields.pointsToRedeem / pointsRedeemAmount，
 * 绑定即扣策略下金额已在 redeemPoints 时折算并写入订单字段，结算期直接读取（无需 DB）。
 *
 * 返回 state `{ pointsToRedeem, pointsRedeemAmount }` 供 points_redeem_discount 动作折让。
 */
export const pointsRedeemCondition = new PromotionCondition({
    code: 'points_redeem',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '积分抵现' },
        { languageCode: LanguageCode.en, value: 'Points Redemption' },
    ],
    args: {},
    async check(ctx: RequestContext, order: any) {
        const pointsToRedeem = order?.customFields?.pointsToRedeem ?? 0;
        if (pointsToRedeem <= 0) return false;
        const pointsRedeemAmount = order?.customFields?.pointsRedeemAmount ?? 0;
        if (pointsRedeemAmount <= 0) return false;
        return { pointsToRedeem, pointsRedeemAmount };
    },
    priorityValue: 900,
});
