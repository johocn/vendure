"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 「本地电商就近服务」所需的四类自定义字段：
 * - Product ：归属城市 + 服务城市列表（前端按当前选城过滤/超区提示）
 * - StockLocation ：仓库/门店经纬度 + 服务城市列表（就近算法 + 超区门禁输入）
 * - Order ：下单时锁定的定位经纬度 + 服务城市 + 履约方式（就近分配输入）
 */
exports.catalogCustomFields = {
    Product: [
        {
            name: 'belongCity',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '归属城市' }],
        },
        {
            name: 'serviceCities',
            type: 'string',
            list: true,
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '服务城市列表' }],
        },
    ],
    StockLocation: [
        {
            name: 'lat',
            type: 'float',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '门店/仓库纬度' }],
        },
        {
            name: 'lng',
            type: 'float',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '门店/仓库经度' }],
        },
        {
            name: 'serviceCities',
            type: 'string',
            list: true,
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '服务城市列表' }],
        },
    ],
    Order: [
        {
            name: 'lat',
            type: 'float',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '下单定位纬度' }],
        },
        {
            name: 'lng',
            type: 'float',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '下单定位经度' }],
        },
        {
            name: 'city',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '服务城市' }],
        },
        {
            name: 'deliveryType',
            type: 'string',
            nullable: true,
            defaultValue: 'delivery',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '履约方式' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'delivery', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '就近配送' }] },
                    { value: 'pickup', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '到店自提' }] },
                ],
            },
        },
    ],
};
//# sourceMappingURL=catalog-custom-fields.js.map