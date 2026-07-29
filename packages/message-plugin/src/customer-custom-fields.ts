import { CustomFields, LanguageCode } from '@vendure/core';

export const messageCustomerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'pushCid',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '个推客户端标识' }],
        },
    ],
};
