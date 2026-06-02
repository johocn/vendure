import { LanguageCode, ShippingCalculator } from '@vendure/core';

export const storePickupCalculator = new ShippingCalculator({
    code: 'store-pickup-calculator',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '门店自提运费计算（免费）' },
        { languageCode: LanguageCode.en, value: 'Store Pickup Shipping Calculator (Free)' },
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

export const pickupPointCalculator = new ShippingCalculator({
    code: 'pickup-point-calculator',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '自提点运费计算' },
        { languageCode: LanguageCode.en, value: 'Pickup Point Shipping Calculator' },
    ],
    args: {
        shippingPrice: {
            type: 'int',
            defaultValue: 0,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '运费（分）' },
                { languageCode: LanguageCode.en, value: 'Shipping Price (cents)' },
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
