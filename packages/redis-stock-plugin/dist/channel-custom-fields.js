"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisStockChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.redisStockChannelCustomFields = {
    Channel: [
        {
            name: 'redisStockEnabled',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '启用Redis库存预扣' }],
        },
        {
            name: 'redisUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: 'Redis连接地址' }],
        },
    ],
};
