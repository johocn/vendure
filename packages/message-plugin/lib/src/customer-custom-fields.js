"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageCustomerCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.messageCustomerCustomFields = {
    Customer: [
        {
            name: 'pushCid',
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '个推客户端标识' }],
        },
    ],
};
