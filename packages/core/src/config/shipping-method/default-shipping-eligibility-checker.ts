import { LanguageCode } from '@vendure/common/lib/generated-types';

import { ShippingEligibilityChecker } from './shipping-eligibility-checker';

export const defaultShippingEligibilityChecker = new ShippingEligibilityChecker({
    code: 'default-shipping-eligibility-checker',
    description: [{ languageCode: LanguageCode.en, value: 'Default Shipping Eligibility Checker' }],
    args: {
        orderMinimum: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [{ languageCode: LanguageCode.en, value: 'Minimum order value' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value: 'Order is eligible only if its total is greater or equal to this value',
                },
            ],
        },
    },
    check: (ctx, order, args) => {
        // args.orderMinimum 缺失（创建配送方式未填该参数）时按 0 处理，避免与 defaultValue 不一致导致恒不合格
        return order.subTotalWithTax >= (args.orderMinimum ?? 0);
    },
});
