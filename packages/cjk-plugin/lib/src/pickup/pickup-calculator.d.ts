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
