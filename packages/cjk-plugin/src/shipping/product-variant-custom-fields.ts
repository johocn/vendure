import { CustomFields, LanguageCode } from '@vendure/core';

export const productVariantCustomFields: CustomFields = {
    ProductVariant: [
        {
            name: 'weight',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '重量(kg)' },
                { languageCode: LanguageCode.en, value: 'Weight (kg)' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: '商品实际重量，用于计算运费' },
            ],
        },
        {
            name: 'length',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '长度(cm)' },
                { languageCode: LanguageCode.en, value: 'Length (cm)' },
            ],
        },
        {
            name: 'width',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '宽度(cm)' },
                { languageCode: LanguageCode.en, value: 'Width (cm)' },
            ],
        },
        {
            name: 'height',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '高度(cm)' },
                { languageCode: LanguageCode.en, value: 'Height (cm)' },
            ],
        },
        {
            name: 'shippingProfileId',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '配送档案 ID' },
            ],
        },
        {
            name: 'paymentProfileId',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '支付档案 ID' },
            ],
        },
    ],
};
