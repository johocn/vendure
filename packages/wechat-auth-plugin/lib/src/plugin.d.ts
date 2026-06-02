import { Type } from '@nestjs/common';
import { WechatAuthPluginOptions } from './types';
export declare class WechatAuthPlugin {
    private options;
    private static options;
    constructor(options: WechatAuthPluginOptions);
    static init(options: WechatAuthPluginOptions): Type<WechatAuthPlugin>;
}
