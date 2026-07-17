import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

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
