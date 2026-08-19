"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.logisticsChannelCustomFields = {
    Channel: [
        {
            name: 'stockLocationPriority',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '仓库优先级配置（JSON）' }],
        },
        {
            name: 'shippingStrategy',
            type: 'string',
            defaultValue: 'priority',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '发货策略' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'priority', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '按优先级' }] },
                    { value: 'nearest', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '就近发货' }] },
                    { value: 'stock-first', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '库存优先' }] },
                    { value: 'member', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级专属' }] },
                ],
            },
        },
        {
            name: 'memberStockStrategy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '会员等级专属发货策略（JSON）' }],
        },
        {
            name: 'packageShippingRule',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '每包运费规则（JSON: [{locationId,baseFee,perKmFee,freeThreshold}]）' }],
        },
    ],
};
//# sourceMappingURL=channel-custom-fields.js.map