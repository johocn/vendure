import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsApiChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'kuaidi100Customer',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '快递100授权码' }],
        },
        {
            name: 'kuaidi100Key',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '快递100 API Key' }],
        },
    ],
};
