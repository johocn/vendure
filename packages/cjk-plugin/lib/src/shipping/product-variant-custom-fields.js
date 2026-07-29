"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productVariantCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.productVariantCustomFields = {
    ProductVariant: [
        {
            name: 'weight',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '重量(kg)' },
                { languageCode: core_1.LanguageCode.en, value: 'Weight (kg)' },
            ],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '商品实际重量，用于计算运费' },
            ],
        },
        {
            name: 'length',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '长度(cm)' },
                { languageCode: core_1.LanguageCode.en, value: 'Length (cm)' },
            ],
        },
        {
            name: 'width',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '宽度(cm)' },
                { languageCode: core_1.LanguageCode.en, value: 'Width (cm)' },
            ],
        },
        {
            name: 'height',
            type: 'float',
            nullable: true,
            public: true,
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '高度(cm)' },
                { languageCode: core_1.LanguageCode.en, value: 'Height (cm)' },
            ],
        },
    ],
};
//# sourceMappingURL=product-variant-custom-fields.js.map