"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketplaceCustomFields = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
exports.marketplaceCustomFields = {
    Product: [
        {
            name: 'listedInMarketplace',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '是否在 marketplace 展示' }],
        },
        {
            name: 'marketplaceStatus',
            type: 'string',
            defaultValue: constants_1.MARKETPLACE_STATUS_PENDING,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: 'marketplace 审批状态' }],
        },
        {
            name: 'rejectReason',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '驳回原因' }],
        },
        {
            name: 'merchantRef',
            type: 'relation',
            entity: core_1.Channel,
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '商家归属' }],
        },
        {
            name: 'barcode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '统一条形码' }],
        },
        {
            name: 'internalCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '内部编码' }],
        },
        {
            name: 'marketingTags',
            type: 'text',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '营销标签（JSON 数组）' }],
            description: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '存 JSON 字符串数组，如 ["new","hot"]；仅存 code，前端按语言映射 label' }],
        },
        {
            name: 'sellingPoint',
            type: 'localeString',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '卖点/促销语' }],
            description: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '多语言卖点，本期仅维护 zh_Hans，其余语言槽位预留' }],
        },
        {
            name: 'tenantCategoryRef',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '商品所属租户分类名（归位依据）' }],
        },
        {
            name: 'platformCategoryId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '已归位的平台分类' }],
        },
        {
            name: 'needsCategorization',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '待归类' }],
        },
    ],
    Order: [
        {
            name: 'saleSource',
            type: 'string',
            defaultValue: constants_1.SALE_SOURCE_OWN,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '销售来源' }],
        },
    ],
    Channel: [
        {
            name: 'settlementBasis',
            type: 'string',
            defaultValue: 'paid',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '对账口径' }],
        },
    ],
    Seller: [
        {
            name: 'marketplaceMerchant',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '是否 marketplace 商家' }],
        },
    ],
};
