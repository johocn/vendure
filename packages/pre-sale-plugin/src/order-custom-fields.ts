import { CustomFields, LanguageCode } from '@vendure/core';

export const preSaleOrderCustomFields: CustomFields = {
    Order: [
        { name: 'preSaleActivityId', type: 'int', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '预售活动ID' }] },
        {
            name: 'preSaleMode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '预售模式(deposit/full)' }],
        },
        { name: 'preSaleDepositTotal', type: 'int', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '定金总额' }] },
        { name: 'preSaleReleaseAt', type: 'datetime', nullable: true, label: [{ languageCode: LanguageCode.zh_Hans, value: '预售到货时间' }] },
    ],
};