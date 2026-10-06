import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
/**
 * 微信支付 PaymentMethodHandler 工厂。
 * code 参数化：同一套 args/逻辑可注册多个支付方法
 * （如 wechatpay=小程序、wechatpay-yourbao-h5=公众号JSAPI、wechatpay-youshop-jsapi 等），
 * 每个方法各自持有 appId/商户凭证/notifyUrl，实现分端分支付方案。
 */
export declare function createWechatpayHandler(options: WechatpayPluginOptions, code?: string): PaymentMethodHandler<{
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
    notifyUrl: {
        type: "string";
        label: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
        description: {
            languageCode: LanguageCode.zh_Hans;
            value: string;
        }[];
    };
}>;
