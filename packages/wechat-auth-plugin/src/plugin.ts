import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { WECHAT_AUTH_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { wechatCustomerCustomFields } from './customer-custom-fields';
import { WechatAuthenticationStrategy } from './wechat-auth-strategy';
import { WechatAuthController } from './wechat-auth.controller';
import { WechatMessageController } from './wechat-message.controller';
import { WechatAuthPluginOptions } from './types';
import { WechatAuthService } from './wechat-auth.service';
import { WxacodeService } from './wxacode.service';
import { WechatAuthShopResolver } from './wechat-auth-shop.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [WechatAuthController, WechatMessageController],
    providers: [
        { provide: WECHAT_AUTH_PLUGIN_OPTIONS, useFactory: () => WechatAuthPlugin.options },
        WechatAuthService,
        WxacodeService,
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
                ...(wechatCustomerCustomFields.Customer ?? []),
            ],
        };

        return config;
    },
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                type JsapiSignature {
                    appId: String!
                    timestamp: Int!
                    nonceStr: String!
                    signature: String!
                }
                type WxacodeResult {
                    contentType: String!
                    base64: String!
                }
                extend type Query {
                    wechatJsapiSignature(url: String!): JsapiSignature!
                    wechatWxacode(scene: String!, path: String, width: Int): WxacodeResult!
                }
            `;
        },
        resolvers: [WechatAuthShopResolver],
    },
    compatibility: '^3.0.0',
})
export class WechatAuthPlugin {
    static options: WechatAuthPluginOptions;

    constructor(
        @Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions,
        private wechatAuthService: WechatAuthService,
    ) {}

    static init(options: WechatAuthPluginOptions): Type<WechatAuthPlugin> {
        WechatAuthPlugin.options = options;
        return WechatAuthPlugin;
    }
}
