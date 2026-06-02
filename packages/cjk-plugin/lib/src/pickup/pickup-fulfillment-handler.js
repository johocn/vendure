"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickupPointFulfillmentHandler = exports.storePickupFulfillmentHandler = void 0;
const core_1 = require("@vendure/core");
exports.storePickupFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'store-pickup',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '门店自提' },
        { languageCode: core_1.LanguageCode.en, value: 'Store Pickup' },
    ],
    args: {
        storeId: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '门店编号' },
                { languageCode: core_1.LanguageCode.en, value: 'Store ID' },
            ],
        },
        storeName: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '门店名称' },
                { languageCode: core_1.LanguageCode.en, value: 'Store Name' },
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
exports.pickupPointFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'pickup-point',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点自提' },
        { languageCode: core_1.LanguageCode.en, value: 'Pickup Point' },
    ],
    args: {
        pointId: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点编号' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point ID' },
            ],
        },
        pointName: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点名称' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Name' },
            ],
        },
        pointAddress: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点地址' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Address' },
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
//# sourceMappingURL=pickup-fulfillment-handler.js.map