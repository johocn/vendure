import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'stockLocationPriority',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '仓库优先级配置（JSON）' }],
        },
        {
            name: 'shippingStrategy',
            type: 'string',
            defaultValue: 'priority',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发货策略' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'priority', label: [{ languageCode: LanguageCode.zh_Hans, value: '按优先级' }] },
                    { value: 'nearest', label: [{ languageCode: LanguageCode.zh_Hans, value: '就近发货' }] },
                    { value: 'stock-first', label: [{ languageCode: LanguageCode.zh_Hans, value: '库存优先' }] },
                    { value: 'member', label: [{ languageCode: LanguageCode.zh_Hans, value: '会员等级专属' }] },
                ],
            },
        },
        {
            name: 'memberStockStrategy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '会员等级专属发货策略（JSON）' }],
        },
        {
            name: 'packageShippingRule',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '每包运费规则（JSON: [{locationId,baseFee,perKmFee,freeThreshold}]）' }],
        },
        {
            name: 'orderCompleteDays',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '自动交易完成天数（送达后 N 天，覆盖默认值）' }],
        },
    ],
};
