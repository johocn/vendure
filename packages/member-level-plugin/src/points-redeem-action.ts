import { LanguageCode, PromotionOrderAction, RequestContext } from '@vendure/core';

import { pointsRedeemCondition } from './points-redeem-condition';

/**
 * 积分抵现动作：配套 pointsRedeemCondition，读 state 中的 pointsRedeemAmount
 * 对订单整体折让（订单级折扣），并 clamp 到当前 subTotalWithTax，防止订单内容
 * 变更后抵扣金额超出实际商品总额。
 *
 * execute 返回负数折扣金额，由 PromotionOrderAction 框架应用到 Order。
 */
export const pointsRedeemAction = new PromotionOrderAction({
    code: 'points_redeem_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '积分抵现金额（订单级折扣）' },
        { languageCode: LanguageCode.en, value: 'Points redemption discount (order level)' },
    ],
    args: {},
    conditions: [pointsRedeemCondition] as any,
    async execute(
        ctx: RequestContext,
        order: any,
        _args,
        state,
    ): Promise<number> {
        const s = (state as any)?.points_redeem as
            | { pointsToRedeem: number; pointsRedeemAmount: number }
            | undefined;
        if (!s?.pointsRedeemAmount) return 0;

        const subTotal = order?.subTotalWithTax ?? 0;
        if (subTotal <= 0) return 0;
        const discount = Math.min(s.pointsRedeemAmount, subTotal);
        if (discount <= 0) return 0;
        return -discount;
    },
});
