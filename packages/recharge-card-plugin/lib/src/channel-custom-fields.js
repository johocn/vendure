"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rechargeChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
/**
 * 在线充值的渠道级金额约束（单位：分）。
 * 面额由服务端按此区间校验，避免金额完全由客户端决定（F-VS-06）。
 */
exports.rechargeChannelCustomFields = {
    Channel: [
        { name: 'rechargeMinAmount', type: 'int', defaultValue: 100, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '最低充值金额（分）' }] },
        { name: 'rechargeMaxAmount', type: 'int', defaultValue: 5000000, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '最高充值金额（分）' }] },
    ],
};
//# sourceMappingURL=channel-custom-fields.js.map