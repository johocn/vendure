import { Type } from '@nestjs/common';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayPlugin {
    private options;
    private static options;
    constructor(options: WechatpayPluginOptions);
    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin>;
}
