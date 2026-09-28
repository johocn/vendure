import { CustomFields, LanguageCode } from '@vendure/core';

/**
 * 在线充值的渠道级金额约束（单位：分）。
 * 面额由服务端按此区间校验，避免金额完全由客户端决定（F-VS-06）。
 */
export const rechargeChannelCustomFields: CustomFields = {
    Channel: [
        { name: 'rechargeMinAmount', type: 'int', defaultValue: 100, label: [{ languageCode: LanguageCode.zh_Hans, value: '最低充值金额（分）' }] },
        { name: 'rechargeMaxAmount', type: 'int', defaultValue: 5000000, label: [{ languageCode: LanguageCode.zh_Hans, value: '最高充值金额（分）' }] },
    ],
};
