import { LanguageCode, ShippingEligibilityChecker } from '@vendure/core';

export const storePickupEligibilityChecker = new ShippingEligibilityChecker({
    code: 'store-pickup-eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '门店自提资格检查' },
        { languageCode: LanguageCode.en, value: 'Store Pickup Eligibility Checker' },
    ],
    args: {},
    check: (ctx, order, args) => {
        return true;
    },
});

export const pickupPointEligibilityChecker = new ShippingEligibilityChecker({
    code: 'pickup-point-eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '自提点自提资格检查' },
        { languageCode: LanguageCode.en, value: 'Pickup Point Eligibility Checker' },
    ],
    args: {},
    check: (ctx, order, args) => {
        return true;
    },
});
