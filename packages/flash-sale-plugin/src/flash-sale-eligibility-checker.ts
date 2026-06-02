import { LanguageCode, PromotionCondition } from '@vendure/core';

export const flashSaleEligibilityCondition = new PromotionCondition({
    code: 'flash_sale_eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀资格检查' },
        { languageCode: LanguageCode.en, value: 'Flash Sale Eligibility' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        if (!ocf?.flashSaleActivityId) return true;
        const now = new Date();
        const startAt = ocf?.flashSaleStartAt;
        const endAt = ocf?.flashSaleEndAt;
        if (startAt && now < new Date(startAt)) return false;
        if (endAt && now > new Date(endAt)) return false;
        return true;
    },
    priorityValue: 960,
});
