import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { WECHAT_AUTH_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { wechatCustomerCustomFields } from './customer-custom-fields';
import { WechatAuthenticationStrategy } from './wechat-auth-strategy';
import { WechatAuthController } from './wechat-auth.controller';
import { WechatAuthPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [WechatAuthController],
    providers: [
        { provide: WECHAT_AUTH_PLUGIN_OPTIONS, useFactory: () => WechatAuthPlugin.options },
    ],
    configuration: config => {
        const strategy = new WechatAuthenticationStrategy(WechatAuthPlugin.options);
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            strategy,
        ];

        config.customFields = {
            ...config.customFields,
            Customer: [
                ...(config.customFields?.Customer || []),
                ...wechatCustomerCustomFields.Customer!,
            ],
        };

        return config;
    },
    compatibility: '^3.0.0',
})
export class WechatAuthPlugin {
    private static options: WechatAuthPluginOptions;

    constructor(@Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions) {}

    static init(options: WechatAuthPluginOptions): Type<WechatAuthPlugin> {
        WechatAuthPlugin.options = options;
        return WechatAuthPlugin;
    }
}
