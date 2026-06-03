"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsFulfillmentCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.logisticsFulfillmentCustomFields = {
    Fulfillment: [
        {
            name: 'trackingNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '物流单号' }],
        },
        {
            name: 'carrier',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '物流公司' }],
        },
        {
            name: 'carrierCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '物流公司编码' }],
        },
        {
            name: 'shippingNote',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '物流备注' }],
        },
    ],
};
//# sourceMappingURL=fulfillment-custom-fields.js.map