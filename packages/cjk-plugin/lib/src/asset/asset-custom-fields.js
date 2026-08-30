"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetCustomFields = void 0;
const core_1 = require("@vendure/core");
// Asset 自定义字段：记录上传者（当前登录 admin 用户），供图库按用户过滤（普通用户只看自己上传的）
exports.assetCustomFields = {
    Asset: [
        {
            name: 'uploadedBy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '上传人' }],
            description: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '资产上传者的 admin 用户 id' }],
        },
    ],
};
//# sourceMappingURL=asset-custom-fields.js.map