"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeePickupCalculator = exports.pickupPointCalculator = exports.storePickupCalculator = void 0;
const core_1 = require("@vendure/core");
exports.storePickupCalculator = new core_1.ShippingCalculator({
    code: 'store-pickup-calculator',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '门店自提运费计算（免费）' },
        { languageCode: core_1.LanguageCode.en, value: 'Store Pickup Shipping Calculator (Free)' },
    ],
    args: {},
    calculate: (ctx, order, args) => {
        return {
            price: 0,
            taxRate: 0,
            priceIncludesTax: true,
            metadata: { pickupType: 'store' },
        };
    },
});
exports.pickupPointCalculator = new core_1.ShippingCalculator({
    code: 'pickup-point-calculator',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点运费计算' },
        { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Shipping Calculator' },
    ],
    args: {
        shippingPrice: {
            type: 'int',
            defaultValue: 0,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '运费（分）' },
                { languageCode: core_1.LanguageCode.en, value: 'Shipping Price (cents)' },
            ],
        },
    },
    calculate: (ctx, order, args) => {
        return {
            price: args.shippingPrice || 0,
            taxRate: 0,
            priceIncludesTax: true,
            metadata: { pickupType: 'point' },
        };
    },
});
exports.employeePickupCalculator = new core_1.ShippingCalculator({
    code: 'employee-pickup-calculator',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '企业职工自提运费计算' },
        { languageCode: core_1.LanguageCode.en, value: 'Employee Pickup Shipping Calculator' },
        { languageCode: core_1.LanguageCode.ja, value: '従業員受取送料計算' },
        { languageCode: core_1.LanguageCode.ko, value: '직원 수거 배송비 계산' },
    ],
    args: {
        shippingPrice: {
            type: 'int',
            defaultValue: 0,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '运费（分）' },
                { languageCode: core_1.LanguageCode.en, value: 'Shipping Price (cents)' },
                { languageCode: core_1.LanguageCode.ja, value: '送料（分）' },
                { languageCode: core_1.LanguageCode.ko, value: '배송비(분)' },
            ],
        },
    },
    calculate: (ctx, order, args) => {
        return {
            price: args.shippingPrice || 0,
            taxRate: 0,
            priceIncludesTax: true,
            metadata: { pickupType: 'employee' },
        };
    },
});
//# sourceMappingURL=pickup-calculator.js.map