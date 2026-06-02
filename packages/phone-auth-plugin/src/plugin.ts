import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { PHONE_AUTH_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { PhoneAuthResolver } from './auth.resolver';
import { PhoneAuthenticationStrategy } from './phone-authentication-strategy';
import { SmsService } from './sms.service';
import { PhoneAuthPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: PHONE_AUTH_PLUGIN_OPTIONS, useFactory: () => PhoneAuthPlugin.options },
        {
            provide: SmsService,
            useFactory: () => new SmsService(PhoneAuthPlugin.options),
        },
        PhoneAuthenticationStrategy,
        PhoneAuthResolver,
    ],
    shopApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                extend type Mutation {
                    sendPhoneVerificationCode(phoneNumber: String!): Boolean!
                }
            `;
        },
        resolvers: [PhoneAuthResolver],
    },
    configuration: config => {
        const smsService = new SmsService(PhoneAuthPlugin.options);
        const strategy = new PhoneAuthenticationStrategy(smsService, null as any);
        config.authOptions.shopAuthenticationStrategy = [
            ...(config.authOptions.shopAuthenticationStrategy || []),
            strategy,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class PhoneAuthPlugin {
    private static options: PhoneAuthPluginOptions;

    constructor(@Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions) {}

    static init(options: PhoneAuthPluginOptions): Type<PhoneAuthPlugin> {
        PhoneAuthPlugin.options = options;
        return PhoneAuthPlugin;
    }
}
