import { CustomFields, LanguageCode } from '@vendure/core';

export const distributionCustomerCustomFields: CustomFields = {
    Customer: [
        { name: 'referralCode', type: 'string', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '推荐码' }] },
        { name: 'referredBy', type: 'string', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '推荐人推荐码' }] },
    ],
};
