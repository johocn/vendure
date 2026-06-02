import { LanguageCode, PromotionCondition } from '@vendure/core';

export const flashSaleDiscountCondition = new PromotionCondition({
    code: 'flash_sale_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀优惠' },
        { languageCode: LanguageCode.en, value: 'Flash Sale Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.flashSaleActivityId != null;
    },
    priorityValue: 950,
});
