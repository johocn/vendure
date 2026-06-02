import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsFulfillmentCustomFields: CustomFields = {
    Fulfillment: [
        {
            name: 'trackingNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流单号' }],
        },
        {
            name: 'carrier',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流公司' }],
        },
        {
            name: 'carrierCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流公司编码' }],
        },
        {
            name: 'shippingNote',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流备注' }],
        },
    ],
};
