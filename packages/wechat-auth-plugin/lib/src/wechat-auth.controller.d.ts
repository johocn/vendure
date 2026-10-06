import { Request, Response } from 'express';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';
export declare class WechatAuthController {
    private options;
    private wechatAuthService;
    constructor(options: WechatAuthPluginOptions, wechatAuthService: WechatAuthService);
    /**
     * JS-SDK 签名接口（公开只读）：GET /wechat-auth/jssdk-signature?url=<当前页面URL>
     * 返回 wx.config 所需的 appId/timestamp/nonceStr/signature
     */
    jssdkSignature(url: string, res: Response): Promise<void>;
    callback(req: Request, res: Response, code: string): Promise<void>;
}
