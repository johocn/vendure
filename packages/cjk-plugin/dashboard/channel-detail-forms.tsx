import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

import { AuthConfigInput } from './auth-config-widget';
import { PaymentConfigInput } from './payment-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
        extendDetailDocument: `
            query ExtendChannelAuthConfig {
                channel {
                    customFields {
                        authConfig {
                            enabledMethods
                            overridesJson
                            ssoProvidersJson
                        }
                    }
                }
            }
        `,
        inputs: [
            {
                blockId: 'custom-fields',
                field: 'authConfig',
                component: AuthConfigInput,
            },
        ],
    },
    {
        pageId: 'channel-detail',
        extendDetailDocument: `
            query ExtendChannelPayConfig {
                channel {
                    customFields {
                        payConfig {
                            alipayJson
                            wechatpayJson
                        }
                    }
                }
            }
        `,
        inputs: [
            {
                blockId: 'custom-fields',
                field: 'payConfig',
                component: PaymentConfigInput,
            },
        ],
    },
];
