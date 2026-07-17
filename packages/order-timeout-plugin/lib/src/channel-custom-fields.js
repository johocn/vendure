"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTimeoutChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.orderTimeoutChannelCustomFields = {
    Channel: [
        {
            name: 'orderPaymentTimeoutMinutes',
            type: 'int',
            defaultValue: 30,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '待付款超时时间（分钟）' }],
        },
        {
            name: 'orderFulfillmentTimeoutHours',
            type: 'int',
            defaultValue: 48,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '待发货超时时间（小时）' }],
        },
        {
            name: 'orderReceiptTimeoutDays',
            type: 'int',
            defaultValue: 15,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '自动确认收货时间（天）' }],
        },
        {
            name: 'orderReviewReminderDays',
            type: 'int',
            defaultValue: 7,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '评价提醒时间（天）' }],
        },
    ],
};
//# sourceMappingURL=channel-custom-fields.js.map