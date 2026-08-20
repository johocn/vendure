import { CustomFields, LanguageCode } from '@vendure/core';

export const memberLevelOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'pointsToRedeem',
            type: 'int',
            defaultValue: 0,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '拟抵扣积分' }],
        },
        {
            name: 'pointsRedeemAmount',
            type: 'int',
            defaultValue: 0,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '积分抵扣金额(分)' }],
        },
    ],
};
