import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { PaymentMethodService, ChannelService, RequestContextService } from '@vendure/core';
import { WechatpayService } from './wechatpay.service';
import { WechatpayPluginOptions } from './types';
export declare class WechatpayPlugin implements OnApplicationBootstrap {
    private options;
    private paymentMethodService;
    private channelService;
    private requestContextService;
    private wechatpayService;
    private static options;
    constructor(options: WechatpayPluginOptions, paymentMethodService: PaymentMethodService, channelService: ChannelService, requestContextService: RequestContextService, wechatpayService: WechatpayService);
    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin>;
    /**
     * Dev Bypass 模式下，启动时自动创建 wechatpay PaymentMethod（如果不存在）
     */
    onApplicationBootstrap(): Promise<void>;
}
