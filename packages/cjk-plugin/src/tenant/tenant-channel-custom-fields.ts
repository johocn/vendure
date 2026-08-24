import { CustomFields, LanguageCode } from '@vendure/core';

export const tenantChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'couponStackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '优惠券可叠加' }],
        },
        {
            name: 'maxStackableCount',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '最大叠加数量' }],
        },
        {
            name: 'employeePickupMode',
            type: 'string',
            defaultValue: 'disabled',
            options: [
                {
                    value: 'disabled',
                    label: [
                        { languageCode: LanguageCode.zh_Hans, value: '未开通' },
                        { languageCode: LanguageCode.en, value: 'Disabled' },
                        { languageCode: LanguageCode.ja, value: '未設定' },
                        { languageCode: LanguageCode.ko, value: '미사용' },
                    ],
                },
                {
                    value: 'loose',
                    label: [
                        { languageCode: LanguageCode.zh_Hans, value: '宽松' },
                        { languageCode: LanguageCode.en, value: 'Loose' },
                        { languageCode: LanguageCode.ja, value: 'ルーズ' },
                        { languageCode: LanguageCode.ko, value: '느슨함' },
                    ],
                },
                {
                    value: 'strict',
                    label: [
                        { languageCode: LanguageCode.zh_Hans, value: '强制' },
                        { languageCode: LanguageCode.en, value: 'Strict' },
                        { languageCode: LanguageCode.ja, value: '厳格' },
                        { languageCode: LanguageCode.ko, value: '엄격함' },
                    ],
                },
            ],
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '企业职工自提模式' },
                { languageCode: LanguageCode.en, value: 'Employee Pickup Mode' },
                { languageCode: LanguageCode.ja, value: '従業員受取モード' },
                { languageCode: LanguageCode.ko, value: '직원 수거 모드' },
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
                { languageCode: LanguageCode.zh_Hans, value: '租户默认位置（经纬度兜底）' },
                { languageCode: LanguageCode.en, value: 'Tenant Default Location (lat/lng fallback)' },
                { languageCode: LanguageCode.ja, value: 'テナントデフォルト位置（緯度経度フォールバック）' },
                { languageCode: LanguageCode.ko, value: '테넌트 기본 위치(위도/경도 폴백)' },
            ],
        },
        {
            name: 'authConfig',
            type: 'struct',
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户登录方式配置' }],
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
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户支付配置' }],
            fields: [
                { name: 'alipayJson', type: 'text' },
                { name: 'wechatpayJson', type: 'text' },
                { name: 'douyinpayJson', type: 'text' },
            ],
        },
        {
            name: 'customDomains',
            type: 'string',
            list: true,
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '自定义域名' }],
        },
        {
            name: 'mapConfig',
            type: 'struct',
            nullable: true,
            public: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '地图服务配置' }],
            fields: [
                { name: 'provider', type: 'string' },
                { name: 'apiKey', type: 'text' },
                { name: 'securityJsCode', type: 'text' },
            ],
        },
        {
            name: 'enabled',
            type: 'boolean',
            defaultValue: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户启停' }],
        },
        {
            name: 'tenantNo',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户序号' }],
        },
        {
            name: 'isOfficial',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '官方自营' }],
        },
        {
            name: 'shopName',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '店铺名' }],
        },
    ],
};
