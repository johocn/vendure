import { LanguageCode, ShippingCalculator } from '@vendure/core';
export declare const storePickupCalculator: ShippingCalculator<{}>;
export declare const pickupPointCalculator: ShippingCalculator<{
    shippingPrice: {
        type: "int";
        defaultValue: number;
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
}>;
/**
 * 同城快递固定运费计算器
 * 与自提一样归属「租户级配送方式固定运费」计费：运费在配送方式实例的
 * shippingPrice（分）中配置（0=免费），整单统一收取。
 */
export declare const localDeliveryCalculator: ShippingCalculator<{
    shippingPrice: {
        type: "int";
        defaultValue: number;
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
}>;
export declare const employeePickupCalculator: ShippingCalculator<{
    shippingPrice: {
        type: "int";
        defaultValue: number;
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        } | {
            languageCode: LanguageCode.ja;
            value: string;
        } | {
            languageCode: LanguageCode.ko;
            value: string;
        })[];
    };
}>;
