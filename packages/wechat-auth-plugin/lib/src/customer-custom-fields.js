"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wechatCustomerCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.wechatCustomerCustomFields = {
    Customer: [
        {
            name: 'wechatOpenid',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '微信 OpenID' }],
        },
        {
            name: 'wechatMiniOpenid',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '微信小程序 OpenID' }],
        },
    ],
};
//# sourceMappingURL=customer-custom-fields.js.map