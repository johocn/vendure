import { Inject, Type } from '@nestjs/common';
import { Logger, PaymentService, PluginCommonModule, VendurePlugin, ChannelService } from '@vendure/core';

import { ALIPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { alipayPaymentHandler } from './alipay-handler';
import { AlipayController } from './alipay.controller';
import { AlipayPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [AlipayController],
    providers: [{ provide: ALIPAY_PLUGIN_OPTIONS, useFactory: () => AlipayPlugin.options }],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            alipayPaymentHandler,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class AlipayPlugin {
    private static options: AlipayPluginOptions;

    constructor(@Inject(ALIPAY_PLUGIN_OPTIONS) private options: AlipayPluginOptions) {}

    static init(options: AlipayPluginOptions): Type<AlipayPlugin> {
        AlipayPlugin.options = options;
        return AlipayPlugin;
    }
}
