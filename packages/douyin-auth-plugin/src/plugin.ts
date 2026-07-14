import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { DOUYIN_AUTH_PLUGIN_OPTIONS } from './constants';
import { douyinCustomerCustomFields } from './customer-custom-fields';
import { DouyinAuthenticationStrategy } from './douyin-auth-strategy';
import { DouyinAuthController } from './douyin-auth.controller';
import { DouyinAuthPluginOptions } from './types';
import { DouyinAuthShopResolver } from './douyin-auth-shop.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [DouyinAuthController],
    providers: [
        { provide: DOUYIN_AUTH_PLUGIN_OPTIONS, useFactory: () => DouyinAuthPlugin.options },
    ],
    configuration: config => {
        const strategy = new DouyinAuthenticationStrategy(DouyinAuthPlugin.options);
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            strategy,
        ];

        config.customFields = {
            ...config.customFields,
            Customer: [
                ...(config.customFields?.Customer || []),
                ...(douyinCustomerCustomFields.Customer ?? []),
            ],
        };

        return config;
    },
    shopApiExtensions: {
        resolvers: [DouyinAuthShopResolver],
    },
    compatibility: '^3.0.0',
})
export class DouyinAuthPlugin {
    private static options: DouyinAuthPluginOptions;

    constructor(
        @Inject(DOUYIN_AUTH_PLUGIN_OPTIONS) private options: DouyinAuthPluginOptions,
    ) {}

    static init(options: DouyinAuthPluginOptions): Type<DouyinAuthPlugin> {
        DouyinAuthPlugin.options = options;
        return DouyinAuthPlugin;
    }
}
