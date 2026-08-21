"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkinChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
const intField = (name, defaultValue) => ({
    name,
    type: 'int',
    defaultValue,
    label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: name }],
});
exports.checkinChannelCustomFields = {
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
//# sourceMappingURL=channel-custom-fields.js.map