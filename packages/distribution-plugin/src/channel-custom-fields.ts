import { CustomFields, LanguageCode } from '@vendure/core';

export const distributionChannelCustomFields: CustomFields = {
    Channel: [
        { name: 'directCommissionRate', type: 'int', defaultValue: 1000, label: [{ languageCode: LanguageCode.zh_Hans, value: '直推佣金比例（万分之几）' }] },
        { name: 'indirectCommissionRate', type: 'int', defaultValue: 500, label: [{ languageCode: LanguageCode.zh_Hans, value: '间推佣金比例（万分之几）' }] },
        { name: 'minWithdrawalAmount', type: 'int', defaultValue: 10000, label: [{ languageCode: LanguageCode.zh_Hans, value: '最低提现金额（分）' }] },
        { name: 'commissionSettlementDays', type: 'int', defaultValue: 7, label: [{ languageCode: LanguageCode.zh_Hans, value: '佣金结算周期（天）' }] },
        { name: 'distributionEnabled', type: 'boolean', defaultValue: false, label: [{ languageCode: LanguageCode.zh_Hans, value: '启用分销' }] },
    ],
};
