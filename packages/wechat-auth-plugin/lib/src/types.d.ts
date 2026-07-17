export interface WechatAuthPluginOptions {
    appId: string;
    appSecret: string;
    miniProgramAppId?: string;
    miniProgramAppSecret?: string;
    /** 公众号消息校验 token */
    token?: string;
    /** 公众号通信加密密钥（EncodingAESKey，43 位） */
    encodingAESKey?: string;
    devBypass?: boolean;
    devBypassOpenid?: string;
}
