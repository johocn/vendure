export interface WechatpayPluginOptions {
    notifyUrl?: string;
    certPath?: string;
    certBuffer?: Buffer;
    devBypass?: boolean;
    devBypassOpenid?: string;
    /** 额外注册的支付方法 code（handler 逻辑同 wechatpay，仅 code 不同），
     *  用于分端分支付方案：如 ['wechatpay-yourbao-h5', 'wechatpay-youshop-jsapi'] */
    extraHandlerCodes?: string[];
    /**
     * 回调验签凭证路由：回调 Host → PaymentMethod code。
     * 微信 v3 回调报文用商户 APIv3 密钥加密，解密前拿不到单号，
     * 只能按回调 Host 选凭证集；未命中回退 渠道 override + 'wechatpay'。
     * 例：{ "www.yourbao.cn": "wechatpay", "www.youshop.cn": "wechatpay-youshop-jsapi" }
     */
    callbackMethodMap?: Record<string, string>;
}
