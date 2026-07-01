export interface AlipayPluginOptions {
    notifyUrl: string;
    returnUrl?: string;
    signType?: 'RSA2' | 'RSA';
    alipayPublicKey: string;
}
