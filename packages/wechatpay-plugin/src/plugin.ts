import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

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
export class WechatpayPlugin {
    private static options: WechatpayPluginOptions;

    constructor(@Inject(WECHATPAY_PLUGIN_OPTIONS) private options: WechatpayPluginOptions) {}

    static init(options: WechatpayPluginOptions): Type<WechatpayPlugin> {
        WechatpayPlugin.options = options;
        return WechatpayPlugin;
    }
}
