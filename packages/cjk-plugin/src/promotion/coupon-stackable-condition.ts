import { LanguageCode, PromotionCondition } from '@vendure/core';

export const couponStackableCondition = new PromotionCondition({
    code: 'coupon_stackable_check',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '优惠券叠加检查' },
        { languageCode: LanguageCode.en, value: 'Coupon Stackable Check' },
    ],
    args: {},
    check(ctx, order, args, promotion) {
        const pcf = (promotion as any).customFields;
        const ccf = (ctx.channel as any).customFields;

        const globalDefault = ccf?.couponStackable ?? false;
        const globalMax = ccf?.maxStackableCount;

        const stackable = pcf?.stackable ?? globalDefault;
        const stackableGroup = pcf?.stackableGroup;
        const effectiveMax = pcf?.maxStackableWith ?? globalMax;

        if (!stackable && order.promotions && order.promotions.length > 0) {
            return false;
        }

        if (stackableGroup) {
            const sameGroup = order.promotions?.filter(
                (p: any) => (p as any).customFields?.stackableGroup === stackableGroup,
            );
            if (sameGroup && sameGroup.length > 0) {
                return false;
            }
        }

        if (effectiveMax != null && order.promotions && order.promotions.length >= effectiveMax) {
            return false;
        }

        return true;
    },
    priorityValue: 1000,
});
