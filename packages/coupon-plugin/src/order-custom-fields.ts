import { CustomFields, LanguageCode } from '@vendure/core';

export const couponOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'appliedCouponCode',
            type: 'string',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '已使用优惠券码' }],
        },
    ],
};
