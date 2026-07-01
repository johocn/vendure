"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promotionCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.promotionCustomFields = {
    Promotion: [
        {
            name: 'stackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '可与其他优惠券叠加' }],
        },
        {
            name: 'stackableGroup',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '叠加分组（同组不可叠加）' }],
        },
        {
            name: 'maxStackableWith',
            type: 'int',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '最多叠加优惠券数量' }],
        },
    ],
};
//# sourceMappingURL=promotion-custom-fields.js.map