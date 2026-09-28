import { CustomFields, LanguageCode } from '@vendure/core';

/**
 * 后台改价的渠道级上限（F-WA-08）。
 * 允许的改价幅度 = min(订单总额 × 比例上限, 绝对金额上限)，
 * 避免「后台改价」被当作无上限让价入口。
 */
export const orderPriceChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'orderAdjustMaxRateBp',
            type: 'int',
            defaultValue: 2000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '改价幅度上限（万分比，2000 = 20%）' }],
        },
        {
            name: 'orderAdjustMaxAmount',
            type: 'int',
            defaultValue: 500000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '改价绝对上限（分）' }],
        },
    ],
};
