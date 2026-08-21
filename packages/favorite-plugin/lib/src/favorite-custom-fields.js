"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 阶段19自定义字段。
 * - Product.favoriteCount：商品收藏数快照（int, nullable, public），供列表卡片直接展示。
 *   由 service 在 toggle 后实时 count 写回（对齐 review 评分快照口径）。
 * - 店铺关注数为动态 count，不写 Shop 缓存列（避免跨插件实体联动）。
 */
exports.favoriteCustomFields = {
    Product: [
        {
            name: 'favoriteCount',
            type: 'int',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '收藏数' }],
        },
    ],
};
//# sourceMappingURL=favorite-custom-fields.js.map