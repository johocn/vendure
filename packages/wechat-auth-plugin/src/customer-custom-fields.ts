import { CustomFields, LanguageCode } from '@vendure/core';

export const wechatCustomerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'wechatOpenid',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '微信 OpenID' }],
        },
        {
            name: 'wechatMiniOpenid',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '微信小程序 OpenID' }],
        },
    ],
};
