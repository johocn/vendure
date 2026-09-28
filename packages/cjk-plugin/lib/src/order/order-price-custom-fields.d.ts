import { CustomFields } from '@vendure/core';
/**
 * 后台改价的渠道级上限（F-WA-08）。
 * 允许的改价幅度 = min(订单总额 × 比例上限, 绝对金额上限)，
 * 避免「后台改价」被当作无上限让价入口。
 */
export declare const orderPriceChannelCustomFields: CustomFields;
