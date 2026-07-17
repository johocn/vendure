export type PaymentMethodCode = 'alipay' | 'wechatpay' | 'douyinpay';

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

export interface DouyinpayCredentials {
    appId: string;
    appSecret: string;
    mchId: string;
    privateKey: string;
    salt?: string;
    tradeType?: 'QR' | 'WAP' | 'APP' | 'MINI';
}

export interface PayConfig {
    alipay?: AlipayCredentials;
    wechatpay?: WechatpayCredentials;
    douyinpay?: DouyinpayCredentials;
}

export interface PayConfigStruct {
    alipayJson: string;
    wechatpayJson: string;
    douyinpayJson: string;
}
