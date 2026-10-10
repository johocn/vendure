"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productTypeCustomFields = void 0;
const core_1 = require("@vendure/core");
/** 商品类型：实体/虚拟/服务。首期纯标记（落库+表单+详情标签），不联动结算/运费/库存/外卖过滤。 */
exports.productTypeCustomFields = {
    Product: [
        {
            name: 'productType',
            type: 'string',
            defaultValue: 'physical',
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '商品类型' },
                { languageCode: core_1.LanguageCode.en, value: 'Product Type' },
            ],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: 'physical=实体商品（默认）；virtual=虚拟商品；service=服务商品。' },
            ],
            options: [
                { value: 'physical', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '实体商品' }, { languageCode: core_1.LanguageCode.en, value: 'Physical' }] },
                { value: 'virtual', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '虚拟商品' }, { languageCode: core_1.LanguageCode.en, value: 'Virtual' }] },
                { value: 'service', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '服务商品' }, { languageCode: core_1.LanguageCode.en, value: 'Service' }] },
            ],
        },
    ],
};
//# sourceMappingURL=product-custom-fields.js.map