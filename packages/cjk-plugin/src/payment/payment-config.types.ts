export type PaymentMethodCode = 'alipay' | 'wechatpay';

export interface AlipayCredentials {
    appId: string;
    privateKey: string;
    tradeType?: 'QR' | 'WAP' | 'APP' | 'MINI';
}

export interface WechatpayCredentials {
    appId: string;
    mchId: string;
    publicKey: string;
    privateKey: string;
    apiKey: string;
    serialNo: string;
    tradeType?: 'JSAPI' | 'NATIVE' | 'APP' | 'H5';
}

export interface PayConfig {
    alipay?: AlipayCredentials;
    wechatpay?: WechatpayCredentials;
}

export interface PayConfigStruct {
    alipayJson: string;
    wechatpayJson: string;
}
