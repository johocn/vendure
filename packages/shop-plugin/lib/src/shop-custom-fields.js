"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 阶段17自定义字段。
 * - Product.shopId：走 core 支持的 Product 自定义字段路径，显式记录商品归属店铺。
 * - Shop 缓存评分不放 customFields——Shop 是插件自研实体，缓存直接作为实体普通列（见 shop.entity.ts）。
 */
exports.shopCustomFields = {
    Product: [
        {
            name: 'shopId',
            type: 'int',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '所属店铺' }],
        },
    ],
};
//# sourceMappingURL=shop-custom-fields.js.map