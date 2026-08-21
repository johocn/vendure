import { CustomFields, LanguageCode } from '@vendure/core';

const intField = (name: string, defaultValue: number): any => ({
    name,
    type: 'int',
    defaultValue,
    label: [{ languageCode: LanguageCode.zh_Hans, value: name }],
});

export const checkinChannelCustomFields: CustomFields = {
    Channel: [
        intField('checkinPoints', 10),
        intField('checkinGrowth', 10),
        intField('checkinStreakThreshold', 7),
        intField('checkinStreakBonusPoints', 50),
        intField('checkinStreakBonusGrowth', 50),
        intField('taskSharePoints', 20),
        intField('taskShareGrowth', 20),
        intField('taskLoginPoints', 5),
        intField('taskLoginGrowth', 5),
        intField('taskProfilePoints', 30),
        intField('taskProfileGrowth', 30),
        intField('taskBindPhonePoints', 50),
        intField('taskBindPhoneGrowth', 50),
        intField('taskReachLevelThreshold', 3),
        intField('taskReachLevelPoints', 100),
        intField('taskReachLevelGrowth', 100),
        intField('taskFirstOrderPoints', 200),
        intField('taskFirstOrderGrowth', 200),
        intField('taskOrderCountThreshold', 5),
        intField('taskOrderCountPoints', 500),
        intField('taskOrderCountGrowth', 500),
        intField('taskOrderAmountThreshold', 50000),
        intField('taskOrderAmountPoints', 1000),
        intField('taskOrderAmountGrowth', 1000),
    ],
};