import { CustomFields } from '@vendure/core';
/**
 * 在线充值的渠道级金额约束（单位：分）。
 * 面额由服务端按此区间校验，避免金额完全由客户端决定（F-VS-06）。
 */
export declare const rechargeChannelCustomFields: CustomFields;
