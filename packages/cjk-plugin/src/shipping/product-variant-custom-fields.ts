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
        {
            name: 'listPrice',
            type: 'int',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '划线价/原价（分）' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: '前台划线展示，为 null 不显示；仅展示层，实付仍取 price' },
            ],
        },
        {
            name: 'saleStart',
            type: 'datetime',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '限时促销开始' },
            ],
        },
        {
            name: 'saleEnd',
            type: 'datetime',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '限时促销结束' },
            ],
        },
        {
            name: 'costPrice',
            type: 'int',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '成本价（分）' },
                { languageCode: LanguageCode.en, value: 'Cost price (cents)' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: '进货成本，仅后台可见，用于利润核算；为 null 表示未填写' },
            ],
        },
        {
            name: 'barcode',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '条形码' },
                { languageCode: LanguageCode.en, value: 'Barcode' },
            ],
        },
        {
            name: 'internalCode',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '内部编码' },
                { languageCode: LanguageCode.en, value: 'Internal code' },
            ],
        },
    ],
};
