"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetCustomFields = void 0;
const core_1 = require("@vendure/core");
// Asset 自定义字段：记录上传者 + 图片分类标签（分类码，按租户隔离——标签存在该租户自己的资产上）
exports.assetCustomFields = {
    Asset: [
        {
            name: 'uploadedBy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '上传人' }],
            description: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '资产上传者的 admin 用户 id' }],
        },
        {
            name: 'assetTags',
            type: 'string',
            list: true,
            nullable: true,
            defaultValue: [],
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '分类标签' }],
            description: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '图片的分类码/标签（同图可多个），按当前租户区分' },
            ],
        },
    ],
};
//# sourceMappingURL=asset-custom-fields.js.map