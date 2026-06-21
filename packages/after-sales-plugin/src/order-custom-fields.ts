import { LanguageCode } from '@vendure/core';

export const afterSalesOrderCustomFields = {
    Order: [
        {
            name: 'afterSalesStatus',
            type: 'string' as const,
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '售后状态' }],
        },
    ],
};
