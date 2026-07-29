"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalShippingEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
exports.digitalShippingEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'digital-shipping-eligibility-checker',
    description: [
        {
            languageCode: core_1.LanguageCode.en,
            value: 'Allows only orders that contain at least 1 digital product',
        },
    ],
    args: {},
    check: (ctx, order, args) => {
        const digitalOrderLines = order.lines.filter(l => l.productVariant.customFields.isDigital);
        return digitalOrderLines.length > 0;
    },
});
//# sourceMappingURL=digital-shipping-eligibility-checker.js.map