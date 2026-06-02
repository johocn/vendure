import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export declare function createWechatpayHandler(options: WechatpayPluginOptions): PaymentMethodHandler<{
    appId: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    mchId: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    publicKey: {
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
    apiKey: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
    serialNo: {
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
