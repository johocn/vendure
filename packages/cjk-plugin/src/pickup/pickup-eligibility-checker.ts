import { Injector, LanguageCode, ShippingEligibilityChecker } from '@vendure/core';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';

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

let employeeCustomerService: EmployeeCustomerService;

export const employeePickupEligibilityChecker = new ShippingEligibilityChecker({
    code: 'employee-pickup-eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提资格检查' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup Eligibility Checker' },
        { languageCode: LanguageCode.ja, value: '従業員受取資格チェック' },
        { languageCode: LanguageCode.ko, value: '직원 수거 자격 확인' },
    ],
    args: {},
    init: (injector: Injector) => {
        employeeCustomerService = injector.get(EmployeeCustomerService);
    },
    check: async (ctx, order) => {
        const mode = (ctx.channel as any).customFields.employeePickupMode;
        if (mode === 'disabled') return false;
        if (mode === 'loose') return true;
        if (mode === 'strict') {
            if (!ctx.activeUserId) return false;
            const bindings = await employeeCustomerService.findByCustomer(ctx, ctx.activeUserId as any);
            return bindings.length > 0;
        }
        return false;
    },
});
