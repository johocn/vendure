import { CustomFields, LanguageCode } from '@vendure/core';

export const invoicePdfOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'invoicePdfUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票PDF地址' }],
        },
        {
            name: 'invoiceNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票编号' }],
        },
    ],
};
