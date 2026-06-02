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
    ],
};
