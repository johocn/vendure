import { LanguageCode, ShippingEligibilityChecker } from '@vendure/core';
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
export declare const tieredShippingEligibilityChecker: ShippingEligibilityChecker<{
    orderMinimum: {
        type: "int";
        defaultValue: number;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    excludedAreas: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
}>;
