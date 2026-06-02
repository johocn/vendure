import { LanguageCode, FulfillmentHandler } from '@vendure/core';

export const storePickupFulfillmentHandler = new FulfillmentHandler({
    code: 'store-pickup',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '门店自提' },
        { languageCode: LanguageCode.en, value: 'Store Pickup' },
    ],
    args: {
        storeId: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '门店编号' },
                { languageCode: LanguageCode.en, value: 'Store ID' },
            ],
        },
        storeName: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '门店名称' },
                { languageCode: LanguageCode.en, value: 'Store Name' },
            ],
        },
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        return {
            method: `门店自提 - ${args.storeName || args.storeId}`,
            trackingCode: `PICKUP-STORE-${args.storeId}`,
        };
    },
});

export const pickupPointFulfillmentHandler = new FulfillmentHandler({
    code: 'pickup-point',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '自提点自提' },
        { languageCode: LanguageCode.en, value: 'Pickup Point' },
    ],
    args: {
        pointId: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点编号' },
                { languageCode: LanguageCode.en, value: 'Pickup Point ID' },
            ],
        },
        pointName: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点名称' },
                { languageCode: LanguageCode.en, value: 'Pickup Point Name' },
            ],
        },
        pointAddress: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点地址' },
                { languageCode: LanguageCode.en, value: 'Pickup Point Address' },
            ],
        },
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        return {
            method: `自提点自提 - ${args.pointName || args.pointId}`,
            trackingCode: `PICKUP-POINT-${args.pointId}`,
        };
    },
});
