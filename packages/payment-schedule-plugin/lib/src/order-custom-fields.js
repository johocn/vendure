"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentScheduleOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.paymentScheduleOrderCustomFields = {
    Order: [
        {
            name: 'paymentScheduleId',
            type: 'int',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '支付计划ID' }],
        },
    ],
};
