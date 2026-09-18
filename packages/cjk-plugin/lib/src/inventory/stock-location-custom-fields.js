"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockLocationCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 仓库性质与编码：
 * - kind: virtual=虚拟仓（网络销售可售源），physical=物理仓（真实库存）
 * - code: 租户内唯一标识。虚拟仓={tenantCode}-virtual；默认物理仓={tenantCode}；附加物理仓={tenantCode}-{alias}
 */
exports.stockLocationCustomFields = {
    StockLocation: [
        {
            name: 'kind',
            type: 'string',
            defaultValue: 'virtual',
            options: [
                { value: 'virtual', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '虚拟仓' }] },
                { value: 'physical', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '物理仓' }] },
            ],
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '仓库性质' }],
        },
        {
            name: 'code',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '仓库编码' }],
        },
        {
            name: 'channelCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '归属租户编码' }],
        },
        {
            name: 'deliveryMethods',
            type: 'string',
            list: true,
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '配送方式（空=邮寄与自提都支持）' }],
            ui: {
                component: 'multiple-select-form-input',
                options: [
                    { value: 'MAIL', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '邮寄' }] },
                    { value: 'SELF_PICKUP', label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '自提' }] },
                ],
            },
        },
    ],
};
//# sourceMappingURL=stock-location-custom-fields.js.map