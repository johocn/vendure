"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsApiChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.logisticsApiChannelCustomFields = {
    Channel: [
        {
            name: 'kuaidi100Customer',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '快递100授权码' }],
        },
        {
            name: 'kuaidi100Key',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '快递100 API Key' }],
        },
    ],
};
