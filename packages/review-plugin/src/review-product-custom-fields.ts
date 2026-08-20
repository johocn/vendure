import { CustomFields, LanguageCode } from '@vendure/core';

/** 评星驱动的商品评分聚合结果，写入 Product 自定义字段并公开暴露，供列表卡片直接展示。 */
export const reviewProductCustomFields: CustomFields = {
    Product: [
        {
            name: 'reviewRating',
            type: 'float',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '评价平均分' }],
        },
        {
            name: 'reviewCount',
            type: 'int',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '评价数量' }],
        },
    ],
};