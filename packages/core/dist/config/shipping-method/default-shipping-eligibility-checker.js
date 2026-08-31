"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultShippingEligibilityChecker = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const shipping_eligibility_checker_1 = require("./shipping-eligibility-checker");
exports.defaultShippingEligibilityChecker = new shipping_eligibility_checker_1.ShippingEligibilityChecker({
    code: 'default-shipping-eligibility-checker',
    description: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Default Shipping Eligibility Checker' }],
    args: {
        orderMinimum: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Minimum order value' }],
            description: [
                {
                    languageCode: generated_types_1.LanguageCode.en,
                    value: 'Order is eligible only if its total is greater or equal to this value',
                },
            ],
        },
    },
    check: (ctx, order, args) => {
        var _a;
        // args.orderMinimum 缺失（创建配送方式未填该参数）时按 0 处理，避免与 defaultValue 不一致导致恒不合格
        return order.subTotalWithTax >= ((_a = args.orderMinimum) !== null && _a !== void 0 ? _a : 0);
    },
});
//# sourceMappingURL=default-shipping-eligibility-checker.js.map