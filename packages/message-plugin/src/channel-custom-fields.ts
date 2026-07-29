import { CustomFields, LanguageCode } from '@vendure/core';

export const messageChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'uniPushAppKey',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'uniPush AppKey' }],
        },
        {
            name: 'uniPushMasterSecret',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'uniPush MasterSecret' }],
        },
    ],
};
