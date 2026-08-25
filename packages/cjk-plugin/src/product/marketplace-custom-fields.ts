import { CustomFields, LanguageCode } from '@vendure/core';

/**
 * Product 级 marketplace 上架审批自定义字段。
 * 命名遵循 Vendure 规范：DB 列名 = customFields + 首字母大写字段名，
 * 例如 listedInMarketplace → customFieldsListedinmarketplace。
 * merchantRef 用 string 存 Channel id。
 */
export const marketplaceProductCustomFields: CustomFields = {
    Product: [
        {
            name: 'listedInMarketplace',
            type: 'boolean',
            nullable: true,
            defaultValue: false,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '在marketplace展示' },
                { languageCode: LanguageCode.en, value: 'Listed in marketplace' },
            ],
        },
        {
            name: 'marketplaceStatus',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '上架审批状态' },
                { languageCode: LanguageCode.en, value: 'Marketplace status' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: 'pending/approved/rejected，null 表示从未提审' },
            ],
        },
        {
            name: 'merchantRef',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '归属商家' },
                { languageCode: LanguageCode.en, value: 'Merchant' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: '商品归属商家 Channel id（自营=default）' },
            ],
        },
        {
            name: 'rejectReason',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '驳回原因' },
                { languageCode: LanguageCode.en, value: 'Reject reason' },
            ],
        },
    ],
};