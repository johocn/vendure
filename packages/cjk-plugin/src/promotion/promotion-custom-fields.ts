import { CustomFields, LanguageCode } from '@vendure/core';

export const promotionCustomFields: CustomFields = {
    Promotion: [
        {
            name: 'stackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '可与其他优惠券叠加' }],
        },
        {
            name: 'stackableGroup',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '叠加分组（同组不可叠加）' }],
        },
        {
            name: 'maxStackableWith',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '最多叠加优惠券数量' }],
        },
    ],
};
