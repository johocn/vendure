"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeMessageChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.subscribeMessageChannelCustomFields = {
    Channel: [
        {
            name: 'orderPaidTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订单付款通知模板 ID' }],
        },
        {
            name: 'orderShippedTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订单发货通知模板 ID' }],
        },
        {
            name: 'orderDeliveredTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订单签收通知模板 ID' }],
        },
        {
            name: 'orderRefundedTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订单退款通知模板 ID' }],
        },
        {
            name: 'subscribeMessagePage',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '订阅消息跳转小程序页面' }],
        },
        {
            name: 'subscribeMessageMiniprogramState',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '小程序版本(developer/trial/formal)' }],
        },
    ],
};
//# sourceMappingURL=channel-custom-fields.js.map