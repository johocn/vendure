import { WechatAuthService } from './wechat-auth.service';
export declare class WechatAuthShopResolver {
    private wechatAuthService;
    constructor(wechatAuthService: WechatAuthService);
    wechatJsapiSignature(url: string): Promise<{
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
    }>;
}
