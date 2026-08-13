import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    LanguageCode,
    Logger,
    PaymentMethodService,
    ChannelService,
    PluginCommonModule,
    RequestContext,
    RequestContextService,
    VendurePlugin,
} from '@vendure/core';

import { WECHATPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { createWechatpayHandler } from './wechatpay-handler';
import { WechatpayController } from './wechatpay.controller';
import { WechatpayPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [WechatpayController],
    providers: [{ provide: WECHATPAY_PLUGIN_OPTIONS, useFactory: () => WechatpayPlugin.options }],
    configuration: config => {
        const handler = createWechatpayHandler(WechatpayPlugin.options);
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            handler,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class WechatpayPlugin implements OnApplicationBootstrap {
    private static options: WechatpayPluginOptions;

    constructor(
        @Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions,
        private paymentMethodService: PaymentMethodService,
        private channelService: ChannelService,
        private requestContextService: RequestContextService,
    ) {}

    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin> {
        WechatpayPlugin.options = options;
        return WechatpayPlugin;
    }

    /**
     * Dev Bypass 模式下，启动时自动创建 wechatpay PaymentMethod（如果不存在）
     */
    async onApplicationBootstrap() {
        if (!this.options.devBypass) return;
        try {
            const channel = await this.channelService.getDefaultChannel();
            const ctx = new RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            const existing = await this.paymentMethodService.findAll(ctx);
            const hasWechatpay = existing.items.some(p => p.code === 'wechatpay');
            if (!hasWechatpay) {
                await this.paymentMethodService.create(ctx, {
                    code: 'wechatpay',
                    enabled: true,
                    handler: { code: 'wechatpay', arguments: [] },
                    translations: [
                        { languageCode: LanguageCode.zh_Hans, name: '微信支付' },
                        { languageCode: LanguageCode.en, name: 'WeChat Pay' },
                    ],
                });
                Logger.info(
                    '[WechatpayPlugin] Created wechatpay PaymentMethod (devBypass)',
                    loggerCtx,
                );
            }
        } catch (e: any) {
            Logger.error(
                `[WechatpayPlugin] Failed to auto-create PaymentMethod: ${e.message}`,
                loggerCtx,
            );
        }
    }
}
