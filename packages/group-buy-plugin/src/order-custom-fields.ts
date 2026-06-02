import { CustomFields, LanguageCode } from '@vendure/core';

export const groupBuyOrderCustomFields: CustomFields = {
    Order: [
        { name: 'groupBuyActivityId', type: 'int', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '拼团活动ID' }] },
        { name: 'groupBuyIsLeader', type: 'boolean', defaultValue: false, label: [{ languageCode: LanguageCode.zh_Hans, value: '是否团长' }] },
    ],
};
