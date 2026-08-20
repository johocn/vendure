import { CustomFields, LanguageCode } from '@vendure/core';

export const couponOrderCustomFields: CustomFields = {
    Order: [
        { name: 'couponCode', type: 'string', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '优惠券码' }] },
        { name: 'couponId', type: 'int', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '用户优惠券ID' }] },
    ],
};