import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
export declare const alipayPaymentHandler: PaymentMethodHandler<{
    appId: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    privateKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    tradeType: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
}>;
