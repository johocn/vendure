"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afterSalesOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.afterSalesOrderCustomFields = {
    Order: [
        {
            name: 'afterSalesStatus',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '售后状态' }],
        },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map