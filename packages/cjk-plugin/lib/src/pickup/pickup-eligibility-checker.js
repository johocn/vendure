"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeePickupEligibilityChecker = exports.pickupPointEligibilityChecker = exports.storePickupEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
const enterprise_customer_service_1 = require("./enterprise-customer/enterprise-customer.service");
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
let employeeCustomerService;
exports.employeePickupEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'employee-pickup-eligibility',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '企业职工自提资格检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Employee Pickup Eligibility Checker' },
        { languageCode: core_1.LanguageCode.ja, value: '従業員受取資格チェック' },
        { languageCode: core_1.LanguageCode.ko, value: '직원 수거 자격 확인' },
    ],
    args: {},
    init: (injector) => {
        employeeCustomerService = injector.get(enterprise_customer_service_1.EmployeeCustomerService);
    },
    check: async (ctx, order) => {
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'disabled')
            return false;
        if (mode === 'loose')
            return true;
        if (mode === 'strict') {
            if (!ctx.activeUserId)
                return false;
            const bindings = await employeeCustomerService.findByCustomer(ctx, ctx.activeUserId);
            return bindings.length > 0;
        }
        return false;
    },
});
//# sourceMappingURL=pickup-eligibility-checker.js.map