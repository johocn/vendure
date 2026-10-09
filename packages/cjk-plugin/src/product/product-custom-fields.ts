import { CustomFields, LanguageCode } from '@vendure/core';

/** 商品类型：实体/虚拟/服务。首期纯标记（落库+表单+详情标签），不联动结算/运费/库存/外卖过滤。 */
export const productTypeCustomFields: CustomFields = {
    Product: [
        {
            name: 'productType',
            type: 'string',
            defaultValue: 'physical',
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '商品类型' },
                { languageCode: LanguageCode.en, value: 'Product Type' },
            ],
            description: [
                { languageCode: LanguageCode.zh_Hans, value: 'physical=实体商品（默认）；virtual=虚拟商品；service=服务商品。' },
            ],
            options: [
                { value: 'physical', label: [{ languageCode: LanguageCode.zh_Hans, value: '实体商品' }, { languageCode: LanguageCode.en, value: 'Physical' }] },
                { value: 'virtual', label: [{ languageCode: LanguageCode.zh_Hans, value: '虚拟商品' }, { languageCode: LanguageCode.en, value: 'Virtual' }] },
                { value: 'service', label: [{ languageCode: LanguageCode.zh_Hans, value: '服务商品' }, { languageCode: LanguageCode.en, value: 'Service' }] },
            ],
        },
    ],
};
