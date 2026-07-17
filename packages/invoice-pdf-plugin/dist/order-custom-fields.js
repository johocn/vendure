"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicePdfOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.invoicePdfOrderCustomFields = {
    Order: [
        {
            name: 'invoicePdfUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '发票PDF地址' }],
        },
        {
            name: 'invoiceNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '发票编号' }],
        },
    ],
};
