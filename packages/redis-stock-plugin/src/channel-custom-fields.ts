import { CustomFields, LanguageCode } from '@vendure/core';

export const redisStockChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'redisStockEnabled',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '启用Redis库存预扣' }],
        },
        {
            name: 'redisUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'Redis连接地址' }],
        },
    ],
};
