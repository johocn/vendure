import { CustomFields, LanguageCode } from '@vendure/core';

export const paymentScheduleOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'paymentScheduleId',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '支付计划ID' }],
        },
    ],
};
