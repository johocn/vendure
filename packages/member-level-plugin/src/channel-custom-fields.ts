import { CustomFields, LanguageCode } from '@vendure/core';

export const memberLevelChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'level1Threshold',
            type: 'int',
            defaultValue: 0,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV1 成长值阈值' }],
        },
        {
            name: 'level1Name',
            type: 'string',
            defaultValue: '普通会员',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV1 名称' }],
        },
        {
            name: 'level2Threshold',
            type: 'int',
            defaultValue: 1000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV2 成长值阈值' }],
        },
        {
            name: 'level2Name',
            type: 'string',
            defaultValue: '银卡会员',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV2 名称' }],
        },
        {
            name: 'level3Threshold',
            type: 'int',
            defaultValue: 5000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV3 成长值阈值' }],
        },
        {
            name: 'level3Name',
            type: 'string',
            defaultValue: '金卡会员',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV3 名称' }],
        },
        {
            name: 'level4Threshold',
            type: 'int',
            defaultValue: 20000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV4 成长值阈值' }],
        },
        {
            name: 'level4Name',
            type: 'string',
            defaultValue: '白金会员',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV4 名称' }],
        },
        {
            name: 'level5Threshold',
            type: 'int',
            defaultValue: 100000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV5 成长值阈值' }],
        },
        {
            name: 'level5Name',
            type: 'string',
            defaultValue: '钻石会员',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'LV5 名称' }],
        },
        {
            name: 'pointsEarnRatio',
            type: 'float',
            defaultValue: 1,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '积分获取比例（每元）' }],
        },
        {
            name: 'pointsEarnOnShipping',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '运费是否产生积分' }],
        },
    ],
};
