"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickupPointEligibilityChecker = exports.storePickupEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
exports.storePickupEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'store-pickup-eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '门店自提资格检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Store Pickup Eligibility Checker' },
    ],
    args: {},
    check: (ctx, order, args) => {
        return true;
    },
});
exports.pickupPointEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'pickup-point-eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点自提资格检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Eligibility Checker' },
    ],
    args: {},
    check: (ctx, order, args) => {
        return true;
    },
});
//# sourceMappingURL=pickup-eligibility-checker.js.map