import { LanguageCode, PromotionOrderAction } from '@vendure/core';

import { CouponAppliedConditionState } from './types';
import { couponAppliedCondition } from './coupon-promotion-condition';

/**
 * 券折扣动作：依赖 coupon_applied 条件。条件已核算出 discountAmount 放在 state，
 * 此处直接取负值（PromotionAction 返回值必须为负数）。
 */
export const couponDiscountAction = new PromotionOrderAction<any>({
    code: 'coupon_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '优惠券折扣金额' },
        { languageCode: LanguageCode.en, value: 'Coupon discount amount' },
    ],
    args: {},
    conditions: [couponAppliedCondition] as any,
    execute(_ctx, _order, _args, state) {
        // Vendure 会把每条 condition 的返回值按 condition.code 归入 state：
        // state = { coupon_applied: { discountAmount } }。必须嵌套取，否则始终为 0。
        const s = (state as any) as { coupon_applied?: CouponAppliedConditionState };
        const amount = s?.coupon_applied?.discountAmount ?? 0;
        return -amount;
    },
});