import { LanguageCode, PromotionOrderAction, RequestContext } from '@vendure/core';

import { tierEligibleCondition } from './tier-discount-condition';

/**
 * 会员等级专属折扣动作（订单级）：配套 tierEligibleCondition，
 * 从 state 读当前档位 specialDiscountRate（千分比），按 subTotalWithTax 折让，
 * 并 clamp 到 subTotalWithTax。execute 返回负数折扣，促销框架应用。
 */
export const tierDiscountAction = new PromotionOrderAction({
    code: 'tier_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '会员等级专属折扣（订单级）' },
        { languageCode: LanguageCode.en, value: 'Member tier special discount' },
    ],
    args: {},
    conditions: [tierEligibleCondition] as any,
    async execute(ctx: RequestContext, order: any, _args, state): Promise<number> {
        const s = (state as any)?.tier_eligible as
            | { tierLevel: number; specialDiscountRate: number }
            | undefined;
        const rate = s?.specialDiscountRate ?? 0;
        if (rate <= 0) return 0;
        const subTotal = order?.subTotalWithTax ?? 0;
        if (subTotal <= 0) return 0;
        const discount = Math.floor((subTotal * rate) / 1000);
        if (discount <= 0) return 0;
        return -discount;
    },
});