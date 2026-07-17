import { CustomFields, LanguageCode } from '@vendure/core';

export const memberLevelCustomerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'growthValue',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '成长值' }],
        },
        {
            name: 'points',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '积分余额' }],
        },
        {
            name: 'memberLevel',
            type: 'int',
            defaultValue: 1,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '会员等级(1-5)' }],
        },
    ],
};
