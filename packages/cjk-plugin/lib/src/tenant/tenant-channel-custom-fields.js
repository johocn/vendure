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
        {
            name: 'employeePickupMode',
            type: 'string',
            defaultValue: 'disabled',
            options: [
                {
                    value: 'disabled',
                    label: [
                        { languageCode: core_1.LanguageCode.zh_Hans, value: '未开通' },
                        { languageCode: core_1.LanguageCode.en, value: 'Disabled' },
                        { languageCode: core_1.LanguageCode.ja, value: '未設定' },
                        { languageCode: core_1.LanguageCode.ko, value: '미사용' },
                    ],
                },
                {
                    value: 'loose',
                    label: [
                        { languageCode: core_1.LanguageCode.zh_Hans, value: '宽松' },
                        { languageCode: core_1.LanguageCode.en, value: 'Loose' },
                        { languageCode: core_1.LanguageCode.ja, value: 'ルーズ' },
                        { languageCode: core_1.LanguageCode.ko, value: '느슨함' },
                    ],
                },
                {
                    value: 'strict',
                    label: [
                        { languageCode: core_1.LanguageCode.zh_Hans, value: '强制' },
                        { languageCode: core_1.LanguageCode.en, value: 'Strict' },
                        { languageCode: core_1.LanguageCode.ja, value: '厳格' },
                        { languageCode: core_1.LanguageCode.ko, value: '엄격함' },
                    ],
                },
            ],
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '企业职工自提模式' },
                { languageCode: core_1.LanguageCode.en, value: 'Employee Pickup Mode' },
                { languageCode: core_1.LanguageCode.ja, value: '従業員受取モード' },
                { languageCode: core_1.LanguageCode.ko, value: '직원 수거 모드' },
            ],
        },
        {
            name: 'defaultLocation',
            type: 'struct',
            nullable: true,
            fields: [
                { name: 'lat', type: 'float' },
                { name: 'lng', type: 'float' },
            ],
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '租户默认位置（经纬度兜底）' },
                { languageCode: core_1.LanguageCode.en, value: 'Tenant Default Location (lat/lng fallback)' },
                { languageCode: core_1.LanguageCode.ja, value: 'テナントデフォルト位置（緯度経度フォールバック）' },
                { languageCode: core_1.LanguageCode.ko, value: '테넌트 기본 위치(위도/경도 폴백)' },
            ],
        },
        {
            name: 'authConfig',
            type: 'struct',
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '租户登录方式配置' }],
            fields: [
                { name: 'enabledMethods', type: 'string', list: true },
                { name: 'overridesJson', type: 'text' },
                { name: 'ssoProvidersJson', type: 'text' },
            ],
        },
        {
            name: 'payConfig',
            type: 'struct',
            nullable: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '租户支付配置' }],
            fields: [
                { name: 'alipayJson', type: 'text' },
                { name: 'wechatpayJson', type: 'text' },
            ],
        },
        {
            name: 'customDomains',
            type: 'string',
            list: true,
            nullable: true,
            public: true,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '自定义域名' }],
        },
        {
            name: 'mapConfig',
            type: 'struct',
            nullable: true,
            public: false,
            label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '地图服务配置' }],
            fields: [
                { name: 'provider', type: 'string' },
                { name: 'apiKey', type: 'text' },
                { name: 'securityJsCode', type: 'text' },
            ],
        },
    ],
};
//# sourceMappingURL=tenant-channel-custom-fields.js.map