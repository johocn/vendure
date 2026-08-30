import { LanguageCode, type CustomFieldConfig } from '@vendure/core';

// Asset 自定义字段：记录上传者（当前登录 admin 用户），供图库按用户过滤（普通用户只看自己上传的）
export const assetCustomFields: Record<'Asset', CustomFieldConfig[]> = {
    Asset: [
        {
            name: 'uploadedBy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '上传人' }],
            description: [{ languageCode: LanguageCode.zh_Hans, value: '资产上传者的 admin 用户 id' }],
        },
    ],
};