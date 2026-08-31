"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tieredShippingEligibilityChecker = void 0;
const core_1 = require("@vendure/core");
/**
 * 阶梯计费资格检查器
 *
 * 支持以下条件：
 * - 最低订单金额门槛
 * - 最低重量门槛（可选）
 * - 区域限制（可选，排除偏远地区或仅限特定省份）
 *
 * 与 tiered-weight-shipping-calculator 配合使用
 */
exports.tieredShippingEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'tiered-shipping-eligibility-checker',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '阶梯配送资格检查' },
        { languageCode: core_1.LanguageCode.en, value: 'Tiered Shipping Eligibility Checker' },
    ],
    args: {
        orderMinimum: {
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '最低订单金额(分, 0=不限)' }],
        },
        excludedAreas: {
            type: 'string',
            defaultValue: '',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '排除地区(省份逗号分隔, 留空=不排除)' }],
        },
    },
    check: (ctx, order, args) => {
        var _a;
        // 1. 金额门槛检查（缺参按 0 处理，避免与默认无门槛期望不一致）
        const orderMinimum = (_a = args.orderMinimum) !== null && _a !== void 0 ? _a : 0;
        if (orderMinimum > 0 && order.subTotalWithTax < orderMinimum) {
            return false;
        }
        // 2. 区域排除检查
        if (args.excludedAreas) {
            const shippingAddress = order.shippingAddress;
            if (!shippingAddress)
                return true; // 未设置地址时允许
            const province = shippingAddress.province || '';
            if (!province)
                return true;
            const excludedList = String(args.excludedAreas).split(',').map(s => s.trim()).filter(Boolean);
            const isExcluded = excludedList.some(area => province.includes(area));
            if (isExcluded)
                return false;
        }
        return true;
    },
});
//# sourceMappingURL=tiered-shipping-eligibility-checker.js.map