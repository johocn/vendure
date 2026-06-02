import { CustomFields, LanguageCode } from '@vendure/core';

export const invoiceOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'invoiceRequired',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '需要发票' }],
        },
        {
            name: 'invoiceType',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票类型' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'ordinary', label: [{ languageCode: LanguageCode.zh_Hans, value: '普通发票' }] },
                    { value: 'special', label: [{ languageCode: LanguageCode.zh_Hans, value: '增值税专用发票' }] },
                    { value: 'electronic', label: [{ languageCode: LanguageCode.zh_Hans, value: '电子发票' }] },
                ],
            },
        },
        {
            name: 'invoiceTitle',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票抬头' }],
        },
        {
            name: 'invoiceTaxNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '纳税人识别号' }],
        },
        {
            name: 'invoiceEmail',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '接收邮箱' }],
        },
        {
            name: 'invoiceCompanyAddress',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '注册地址（专票）' }],
        },
        {
            name: 'invoiceCompanyPhone',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '注册电话（专票）' }],
        },
        {
            name: 'invoiceBankName',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '开户银行（专票）' }],
        },
        {
            name: 'invoiceBankAccount',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '银行账号（专票）' }],
        },
    ],
};
