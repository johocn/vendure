import { Channel, CustomFields, LanguageCode } from '@vendure/core';
import { MARKETPLACE_STATUS_PENDING, SALE_SOURCE_OWN } from './constants';

export const marketplaceCustomFields: CustomFields = {
    Product: [
        {
            name: 'listedInMarketplace',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '是否在 marketplace 展示' }],
        },
        {
            name: 'marketplaceStatus',
            type: 'string',
            defaultValue: MARKETPLACE_STATUS_PENDING,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'marketplace 审批状态' }],
        },
        {
            name: 'rejectReason',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '驳回原因' }],
        },
        {
            name: 'merchantRef',
            type: 'relation',
            entity: Channel,
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '商家归属' }],
        },
        {
            name: 'barcode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '统一条形码' }],
        },
        {
            name: 'internalCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '内部编码' }],
        },
    ],
    Order: [
        {
            name: 'saleSource',
            type: 'string',
            defaultValue: SALE_SOURCE_OWN,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '销售来源' }],
        },
    ],
    Channel: [
        {
            name: 'settlementBasis',
            type: 'string',
            defaultValue: 'paid',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '对账口径' }],
        },
    ],
    Seller: [
        {
            name: 'marketplaceMerchant',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '是否 marketplace 商家' }],
        },
    ],
};