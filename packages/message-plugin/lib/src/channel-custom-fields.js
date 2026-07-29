"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.messageChannelCustomFields = {
    Channel: [
        {
            name: 'uniPushAppKey',
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: 'uniPush AppKey' }],
        },
        {
            name: 'uniPushMasterSecret',
            type: 'string',
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: 'uniPush MasterSecret' }],
        },
    ],
};
