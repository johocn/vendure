import { RequestContext } from '@vendure/core';
import { WechatAuthService } from './wechat-auth.service';
import { WxacodeService } from './wxacode.service';
export declare class WechatAuthShopResolver {
    private wechatAuthService;
    private wxacodeService;
    constructor(wechatAuthService: WechatAuthService, wxacodeService: WxacodeService);
    wechatJsapiSignature(url: string): Promise<{
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
    }>;
    wechatWxacode(ctx: RequestContext, scene: string, path?: string, width?: number): Promise<{
        contentType: string;
        base64: string;
    }>;
}
