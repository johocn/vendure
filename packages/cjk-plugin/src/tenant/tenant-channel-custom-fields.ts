import { CustomFields, LanguageCode } from '@vendure/core';

export const tenantChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'couponStackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '优惠券可叠加' }],
        },
        {
            name: 'maxStackableCount',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '最大叠加数量' }],
        },
        {
            name: 'authConfig',
            type: 'struct',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户登录方式配置' }],
            fields: [
                { name: 'enabledMethods', type: 'string', list: true },
                { name: 'overridesJson', type: 'text' },
                { name: 'ssoProvidersJson', type: 'text' },
            ],
        },
    ],
};
