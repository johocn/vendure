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
