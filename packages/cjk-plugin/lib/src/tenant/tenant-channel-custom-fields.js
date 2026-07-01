"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantChannelCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.tenantChannelCustomFields = {
    Channel: [
        {
            name: 'couponStackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '优惠券可叠加' }],
        },
        {
            name: 'maxStackableCount',
            type: 'int',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '最大叠加数量' }],
        },
    ],
};
//# sourceMappingURL=tenant-channel-custom-fields.js.map