import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

// 旧 widget 文件保留 import 不删(避免破坏可能的其他引用),但不再注册到 channel-detail
// import { AuthConfigInput } from './auth-config-widget';
// import { PaymentConfigInput } from './payment-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
        extendDetailDocument: `
            query ExtendChannelCustomDomains {
                channel {
                    customFields {
                        customDomains
                    }
                }
            }
        `,
    },
];
