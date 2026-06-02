import { CustomFields, LanguageCode } from '@vendure/core';

export const orderTimeoutChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'orderTimeoutMinutes',
            type: 'int',
            defaultValue: 30,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单超时时间（分钟）' }],
        },
    ],
};
