import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { PaymentMethodService, ChannelService, RequestContextService } from '@vendure/core';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayPlugin implements OnApplicationBootstrap {
    private options;
    private paymentMethodService;
    private channelService;
    private requestContextService;
    private static options;
    constructor(options: WechatpayPluginOptions, paymentMethodService: PaymentMethodService, channelService: ChannelService, requestContextService: RequestContextService);
    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin>;
    /**
     * Dev Bypass 模式下，启动时自动创建 wechatpay PaymentMethod（如果不存在）
     */
    onApplicationBootstrap(): Promise<void>;
}
