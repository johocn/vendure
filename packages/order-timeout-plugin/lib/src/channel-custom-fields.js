"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTimeoutChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.orderTimeoutChannelCustomFields = {
    Channel: [
        {
            name: 'orderTimeoutMinutes',
            type: 'int',
            defaultValue: 30,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订单超时时间（分钟）' }],
        },
    ],
};
//# sourceMappingURL=channel-custom-fields.js.map