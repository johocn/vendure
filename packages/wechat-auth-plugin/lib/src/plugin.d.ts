import { Type } from '@nestjs/common';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';
export declare class WechatAuthPlugin {
    private options;
    private wechatAuthService;
    private static options;
    constructor(options: WechatAuthPluginOptions, wechatAuthService: WechatAuthService);
    static init(options: WechatAuthPluginOptions): Type<WechatAuthPlugin>;
}
