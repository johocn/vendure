import { Inject, Type } from '@nestjs/common';
import { Logger, PaymentService, PluginCommonModule, VendurePlugin, ChannelService } from '@vendure/core';

import { ALIPAY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { alipayPaymentHandler } from './alipay-handler';
import { AlipayController } from './alipay.controller';
import { AlipayPluginOptions } from './types';
import { alipayCustomerCustomFields } from './customer-custom-fields';
import { AlipayAuthenticationStrategy } from './alipay-auth-strategy';
import { AlipayAuthController } from './alipay-auth.controller';
import { AlipayAuthShopResolver } from './alipay-auth-shop.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [AlipayController, AlipayAuthController],
    providers: [{ provide: ALIPAY_PLUGIN_OPTIONS, useFactory: () => AlipayPlugin.options }],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers || []),
            alipayPaymentHandler,
        ];

        const strategy = new AlipayAuthenticationStrategy(AlipayPlugin.options);
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            strategy,
        ];

        config.customFields = {
            ...config.customFields,
            Customer: [
                ...(config.customFields?.Customer || []),
                ...(alipayCustomerCustomFields.Customer ?? []),
            ],
        };

        return config;
    },
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                input AlipayAuthInput {
                    authCode: String!
                    type: String!
                }
            `;
        },
        resolvers: [AlipayAuthShopResolver],
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
