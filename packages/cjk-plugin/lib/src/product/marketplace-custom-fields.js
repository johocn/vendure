"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketplaceProductCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * Product 级 marketplace 上架审批自定义字段。
 * 命名遵循 Vendure 规范：DB 列名 = customFields + 首字母大写字段名，
 * 例如 listedInMarketplace → customFieldsListedinmarketplace。
 * merchantRef 用 string 存 Channel id。
 */
exports.marketplaceProductCustomFields = {
    Product: [
        {
            name: 'listedInMarketplace',
            type: 'boolean',
            nullable: true,
            defaultValue: false,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '在marketplace展示' },
                { languageCode: core_1.LanguageCode.en, value: 'Listed in marketplace' },
            ],
        },
        {
            name: 'marketplaceStatus',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '上架审批状态' },
                { languageCode: core_1.LanguageCode.en, value: 'Marketplace status' },
            ],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: 'pending/approved/rejected，null 表示从未提审' },
            ],
        },
        {
            name: 'merchantRef',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '归属商家' },
                { languageCode: core_1.LanguageCode.en, value: 'Merchant' },
            ],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '商品归属商家 Channel id（自营=default）' },
            ],
        },
        {
            name: 'rejectReason',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '驳回原因' },
                { languageCode: core_1.LanguageCode.en, value: 'Reject reason' },
            ],
        },
    ],
};
//# sourceMappingURL=marketplace-custom-fields.js.map