"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preSaleOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.preSaleOrderCustomFields = {
    Order: [
        { name: 'preSaleActivityId', type: 'int', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '预售活动ID' }] },
        {
            name: 'preSaleMode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '预售模式(deposit/full)' }],
        },
        { name: 'preSaleDepositTotal', type: 'int', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '定金总额' }] },
        { name: 'preSaleReleaseAt', type: 'datetime', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '预售到货时间' }] },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map