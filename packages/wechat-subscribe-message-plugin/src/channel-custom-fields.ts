import { CustomFields, LanguageCode } from '@vendure/core';

export const subscribeMessageChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'orderPaidTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单付款通知模板 ID' }],
        },
        {
            name: 'orderShippedTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单发货通知模板 ID' }],
        },
        {
            name: 'orderDeliveredTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单签收通知模板 ID' }],
        },
        {
            name: 'orderRefundedTemplateId',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单退款通知模板 ID' }],
        },
        {
            name: 'subscribeMessagePage',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订阅消息跳转小程序页面' }],
        },
        {
            name: 'subscribeMessageMiniprogramState',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '小程序版本(developer/trial/formal)' }],
        },
    ],
};
