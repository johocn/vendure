import { LanguageCode, PromotionCondition } from '@vendure/core';

export const groupBuyDiscountCondition = new PromotionCondition({
    code: 'group_buy_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团优惠' },
        { languageCode: LanguageCode.en, value: 'Group Buy Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.groupBuyActivityId != null;
    },
    priorityValue: 900,
});
