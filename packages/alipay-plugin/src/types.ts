export interface AlipayPluginOptions {
    notifyUrl: string;
    returnUrl?: string;
    signType?: 'RSA2' | 'RSA';
    alipayPublicKey: string;
    auth?: {
        appId?: string;
        privateKey?: string;
        miniProgramAppId?: string;
        devBypass?: boolean;
        devBypassOpenid?: string;
    };
}
