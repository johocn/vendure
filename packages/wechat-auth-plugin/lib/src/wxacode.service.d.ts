import { RequestContext } from '@vendure/core';
import { WechatAuthService } from './wechat-auth.service';
import { WechatAuthPluginOptions } from './types';
export declare class WxacodeService {
    private wechatAuthService;
    private options;
    private userCallCount;
    private readonly MAX_CALLS_PER_MINUTE;
    constructor(wechatAuthService: WechatAuthService, options: WechatAuthPluginOptions);
    generateWxacode(ctx: RequestContext, args: {
        scene: string;
        path?: string;
        width?: number;
    }): Promise<{
        contentType: string;
        base64: string;
    }>;
    private checkRateLimit;
}
