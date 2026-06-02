# CJK Plugin 实施计划（v2 - 评审修订版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vendure 创建分层 CJK 本地化插件体系：核心 `@vendure/cjk-plugin`（i18n + 地区 + 优惠券策略 + 多租户 + 门店实体 + 货到付款）+ 独立支付/存储/认证插件。

**Architecture:** 分层插件架构。cjk-plugin 包含无外部依赖的核心功能；alipay-plugin/wechatpay-plugin/oss-plugin/phone-auth-plugin 各自独立，按需安装。支付配置通过 PaymentMethodHandler.args 传入（符合 Vendure 规范）。优惠券叠加通过 PromotionCondition + CustomFields 实现（已验证时序可行）。门店数据通过 PickupLocation 自定义实体持久化。

**Tech Stack:** TypeScript, NestJS, Vendure v3.6.x, alipay-sdk, wechatpay-node-v3, ali-oss, @alicloud/dysmsapi20170525

---

## 文件结构

```
packages/
├── cjk-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── i18n/
│   │   │   ├── zh_CN.json
│   │   │   ├── zh_TW.json
│   │   │   ├── ja.json
│   │   │   └── ko.json
│   │   ├── regions/
│   │   │   ├── china.ts
│   │   │   ├── japan.ts
│   │   │   ├── korea.ts
│   │   │   └── region-populator.ts
│   │   ├── payment/
│   │   │   └── cod-handler.ts
│   │   ├── pickup/
│   │   │   ├── pickup-location.entity.ts
│   │   │   ├── pickup-location-custom-fields.ts
│   │   │   ├── pickup-eligibility-checker.ts
│   │   │   ├── pickup-calculator.ts
│   │   │   ├── pickup-fulfillment-handler.ts
│   │   │   └── pickup-admin.resolver.ts
│   │   ├── promotion/
│   │   │   ├── promotion-custom-fields.ts
│   │   │   └── coupon-stackable-condition.ts
│   │   └── tenant/
│   │       ├── tenant-channel-custom-fields.ts
│   │       └── tenant-setup.service.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── alipay-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── alipay-handler.ts
│   │   └── alipay.controller.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── wechatpay-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── wechatpay-handler.ts
│   │   └── wechatpay.controller.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── oss-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── oss-strategy.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
└── phone-auth-plugin/
    ├── src/
    │   ├── plugin.ts
    │   ├── constants.ts
    │   ├── types.ts
    │   ├── phone-authentication-strategy.ts
    │   ├── sms.service.ts
    │   └── auth.resolver.ts
    ├── index.ts
    ├── package.json
    ├── tsconfig.json
    └── tsconfig.build.json
```

---

### Task 1: cjk-plugin 骨架 + i18n 翻译

**Files:**
- Create: `packages/cjk-plugin/package.json`
- Create: `packages/cjk-plugin/tsconfig.json`
- Create: `packages/cjk-plugin/tsconfig.build.json`
- Create: `packages/cjk-plugin/index.ts`
- Create: `packages/cjk-plugin/src/constants.ts`
- Create: `packages/cjk-plugin/src/types.ts`
- Create: `packages/cjk-plugin/src/plugin.ts`
- Create: `packages/cjk-plugin/src/i18n/zh_CN.json`
- Create: `packages/cjk-plugin/src/i18n/zh_TW.json`
- Create: `packages/cjk-plugin/src/i18n/ja.json`
- Create: `packages/cjk-plugin/src/i18n/ko.json`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/cjk-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*", "src/i18n/**/*.json"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json 和 tsconfig.build.json**

tsconfig.json:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

tsconfig.build.json:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./lib" },
  "files": ["./index.ts"]
}
```

- [ ] **Step 3: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'CJKPlugin';
export const CJK_PLUGIN_OPTIONS = Symbol('CJK_PLUGIN_OPTIONS');
```

- [ ] **Step 4: 创建 src/types.ts**

```typescript
import { LanguageCode } from '@vendure/common/lib/generated-types';

export interface CjkPluginI18nOptions {
    enabled?: boolean;
    languages?: LanguageCode[];
}

export interface CjkPluginRegionsOptions {
    enabled?: boolean;
    countries?: ('CN' | 'JP' | 'KR')[];
}

export interface CjkPluginCodOptions {
    enabled?: boolean;
}

export interface CjkPluginStorePickupOptions {
    enabled?: boolean;
}

export interface CjkPluginPickupPointOptions {
    enabled?: boolean;
    shippingPrice?: number;
}

export interface TenantPromotionPolicy {
    couponStackable?: boolean;
    maxStackableCount?: number;
}

export interface CjkPluginTenantOptions {
    enabled?: boolean;
    defaultPaymentMethods?: string[];
    defaultShippingMethods?: string[];
    defaultPromotionPolicies?: TenantPromotionPolicy;
}

export interface CjkPluginPromotionPolicyOptions {
    enabled?: boolean;
    defaultStackable?: boolean;
    maxStackableCount?: number;
}

export interface CjkPluginOptions {
    i18n?: CjkPluginI18nOptions;
    regions?: CjkPluginRegionsOptions;
    cod?: CjkPluginCodOptions;
    storePickup?: CjkPluginStorePickupOptions;
    pickupPoint?: CjkPluginPickupPointOptions;
    tenant?: CjkPluginTenantOptions;
    promotionPolicy?: CjkPluginPromotionPolicyOptions;
}
```

- [ ] **Step 5: 创建 src/plugin.ts**

```typescript
import { Inject, MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { I18nService, LanguageCode, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';

import { CJK_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CjkPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options }],
    compatibility: '^3.0.0',
})
export class CjkPlugin implements OnApplicationBootstrap, NestModule {
    private static options: CjkPluginOptions;

    constructor(
        @Inject(CJK_PLUGIN_OPTIONS) private options: CjkPluginOptions,
        private moduleRef: ModuleRef,
    ) {}

    static init(options: CjkPluginOptions): Type<CjkPlugin> {
        CjkPlugin.options = options;
        return CjkPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        if (this.options.i18n?.enabled !== false) {
            const i18nService = this.moduleRef.get(I18nService);
            const languages = this.options.i18n?.languages || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
            const translations: Record<string, any> = {
                zh_Hans: await import('./i18n/zh_CN.json'),
                zh_Hant: await import('./i18n/zh_TW.json'),
                ja: await import('./i18n/ja.json'),
                ko: await import('./i18n/ko.json'),
            };
            for (const lang of languages) {
                if (translations[lang]) {
                    i18nService.addTranslation(lang, translations[lang]);
                    Logger.info(`Registered i18n translation for ${lang}`, loggerCtx);
                }
            }
        }
    }

    configure(consumer: MiddlewareConsumer): void {}
}
```

- [ ] **Step 6: 创建 i18n 翻译文件**

基于 `packages/core/src/i18n/messages/en.json` 完整翻译为 zh_CN.json / zh_TW.json / ja.json / ko.json。结构包含 `error`、`errorResult`、`message` 三个命名空间。

- [ ] **Step 7: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
```

- [ ] **Step 8: 安装依赖并构建**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install && npm run build`

- [ ] **Step 9: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): scaffold plugin with i18n translations"
```

---

### Task 2: cjk-plugin 地区数据 + 货到付款

**Files:**
- Create: `packages/cjk-plugin/src/regions/china.ts`
- Create: `packages/cjk-plugin/src/regions/japan.ts`
- Create: `packages/cjk-plugin/src/regions/korea.ts`
- Create: `packages/cjk-plugin/src/regions/region-populator.ts`
- Create: `packages/cjk-plugin/src/payment/cod-handler.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 china.ts（省/市/区三级）**

包含 34 个省级行政区数据。市级和区级数据量大，初始版本提供省级 + 主要城市，后续通过 API 补充。

```typescript
export const chinaProvinces = [
    { code: 'CN-BJ', name: '北京市' },
    { code: 'CN-TJ', name: '天津市' },
    { code: 'CN-HE', name: '河北省' },
    { code: 'CN-SX', name: '山西省' },
    { code: 'CN-NM', name: '内蒙古自治区' },
    { code: 'CN-LN', name: '辽宁省' },
    { code: 'CN-JL', name: '吉林省' },
    { code: 'CN-HL', name: '黑龙江省' },
    { code: 'CN-SH', name: '上海市' },
    { code: 'CN-JS', name: '江苏省' },
    { code: 'CN-ZJ', name: '浙江省' },
    { code: 'CN-AH', name: '安徽省' },
    { code: 'CN-FJ', name: '福建省' },
    { code: 'CN-JX', name: '江西省' },
    { code: 'CN-SD', name: '山东省' },
    { code: 'CN-HA', name: '河南省' },
    { code: 'CN-HB', name: '湖北省' },
    { code: 'CN-HN', name: '湖南省' },
    { code: 'CN-GD', name: '广东省' },
    { code: 'CN-GX', name: '广西壮族自治区' },
    { code: 'CN-HI', name: '海南省' },
    { code: 'CN-CQ', name: '重庆市' },
    { code: 'CN-SC', name: '四川省' },
    { code: 'CN-GZ', name: '贵州省' },
    { code: 'CN-YN', name: '云南省' },
    { code: 'CN-XZ', name: '西藏自治区' },
    { code: 'CN-SN', name: '陕西省' },
    { code: 'CN-GS', name: '甘肃省' },
    { code: 'CN-QH', name: '青海省' },
    { code: 'CN-NX', name: '宁夏回族自治区' },
    { code: 'CN-XJ', name: '新疆维吾尔自治区' },
    { code: 'CN-TW', name: '台湾省' },
    { code: 'CN-HK', name: '香港特别行政区' },
    { code: 'CN-MO', name: '澳门特别行政区' },
];
```

- [ ] **Step 2: 创建 japan.ts 和 korea.ts**

（同 v1 计划中的数据）

- [ ] **Step 3: 创建 region-populator.ts**

（同 v1 计划，通过 CountryService/ZoneService 导入）

- [ ] **Step 4: 创建 cod-handler.ts**

```typescript
import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

export const codPaymentHandler = new PaymentMethodHandler({
    code: 'cash-on-delivery',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '货到付款' },
        { languageCode: LanguageCode.zh_Hant, value: '貨到付款' },
        { languageCode: LanguageCode.ja, value: '代金引換' },
        { languageCode: LanguageCode.ko, value: '착불 결제' },
        { languageCode: LanguageCode.en, value: 'Cash on Delivery' },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: 'Authorized' as const,
            transactionId: `COD-${order.code}`,
            metadata: { method: 'cash-on-delivery' },
        };
    },
    settlePayment: async (ctx, order, payment, args) => {
        return { success: true };
    },
});
```

- [ ] **Step 5: 修改 plugin.ts 集成地区数据和货到付款**

在 `configuration` 中注册 codPaymentHandler，在 `onApplicationBootstrap` 中调用 RegionPopulator。

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add region data and COD payment handler"
```

---

### Task 3: cjk-plugin 门店自提 + 自提点（PickupLocation 实体）

**Files:**
- Create: `packages/cjk-plugin/src/pickup/pickup-location.entity.ts`
- Create: `packages/cjk-plugin/src/pickup/pickup-location-custom-fields.ts`
- Create: `packages/cjk-plugin/src/pickup/pickup-eligibility-checker.ts`
- Create: `packages/cjk-plugin/src/pickup/pickup-calculator.ts`
- Create: `packages/cjk-plugin/src/pickup/pickup-fulfillment-handler.ts`
- Create: `packages/cjk-plugin/src/pickup/pickup-admin.resolver.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 pickup-location.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ChannelAware, HasCustomFields, VendureEntity } from '@vendure/core';
import { Channel } from '@vendure/core';
import { CustomPickupLocationFields } from './pickup-location-custom-fields';

@Entity()
export class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    @Column() name: string;

    @Column() type: 'store' | 'point';

    @Column() address: string;

    @Column({ nullable: true }) phoneNumber: string;

    @Column({ nullable: true }) businessHours: string;

    @Column({ type: 'simple-json', nullable: true })
    coordinates: { lat: number; lng: number } | null;

    @Column({ nullable: true }) partner: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomPickupLocationFields)
    customFields: CustomPickupLocationFields;
}
```

- [ ] **Step 2: 创建 pickup-location-custom-fields.ts**

```typescript
import { CustomFields } from '@vendure/core';

export const pickupLocationCustomFields: CustomFields = {
    PickupLocation: [],
};
```

- [ ] **Step 3: 创建 pickup-eligibility-checker.ts / pickup-calculator.ts / pickup-fulfillment-handler.ts**

（同 v1 计划，但 FulfillmentHandler 的 args 中使用 pickupLocationId）

- [ ] **Step 4: 创建 pickup-admin.resolver.ts**

提供 Admin API 查询/创建/更新 PickupLocation 的 resolver。

- [ ] **Step 5: 修改 plugin.ts**

在 `VendurePlugin` 装饰器中注册实体、adminApiExtensions、providers。

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add PickupLocation entity and store/pickup-point shipping"
```

---

### Task 4: cjk-plugin 优惠券叠加 + 多租户

**Files:**
- Create: `packages/cjk-plugin/src/promotion/promotion-custom-fields.ts`
- Create: `packages/cjk-plugin/src/promotion/coupon-stackable-condition.ts`
- Create: `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts`
- Create: `packages/cjk-plugin/src/tenant/tenant-setup.service.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 promotion-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const promotionCustomFields: CustomFields = {
    Promotion: [
        {
            name: 'stackable',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '可与其他优惠券叠加' }],
        },
        {
            name: 'stackableGroup',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '叠加分组（同组不可叠加）' }],
        },
        {
            name: 'maxStackableWith',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '最多叠加优惠券数量' }],
        },
    ],
};
```

- [ ] **Step 2: 创建 coupon-stackable-condition.ts**

```typescript
import { LanguageCode, PromotionCondition } from '@vendure/core';

export const couponStackableCondition = new PromotionCondition({
    code: 'coupon_stackable_check',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '优惠券叠加检查' },
        { languageCode: LanguageCode.en, value: 'Coupon Stackable Check' },
    ],
    args: {},
    check: (ctx, order, args, promotion) => {
        const pcf = (promotion as any).customFields;
        const ccf = (ctx.channel as any).customFields;

        const globalDefault = ccf?.couponStackable ?? false;
        const globalMax = ccf?.maxStackableCount;

        const stackable = pcf?.stackable ?? globalDefault;
        const stackableGroup = pcf?.stackableGroup;
        const effectiveMax = pcf?.maxStackableWith ?? globalMax;

        if (!stackable && order.promotions && order.promotions.length > 0) {
            return false;
        }

        if (stackableGroup) {
            const sameGroup = order.promotions?.filter(
                (p: any) => (p as any).customFields?.stackableGroup === stackableGroup,
            );
            if (sameGroup && sameGroup.length > 0) {
                return false;
            }
        }

        if (effectiveMax != null && order.promotions && order.promotions.length >= effectiveMax) {
            return false;
        }

        return true;
    },
    priorityValue: 1000,
});
```

- [ ] **Step 3: 创建 tenant-channel-custom-fields.ts**

```typescript
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
    ],
};
```

- [ ] **Step 4: 创建 tenant-setup.service.ts**

（同 v1 计划，但删除冗余的 enabledPaymentMethods/enabledShippingMethods）

- [ ] **Step 5: 修改 plugin.ts 集成**

在 `configuration` 中注册 CustomFields 和 PromotionCondition。

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add coupon stacking condition and tenant channel custom fields"
```

---

### Task 5: alipay-plugin

**Files:**
- Create: `packages/alipay-plugin/` 完整骨架
- 关键：alipay-handler.ts 中配置通过 `args` 传入

- [ ] **Step 1: 创建插件骨架**

package.json / tsconfig / index.ts / constants.ts / types.ts / plugin.ts

- [ ] **Step 2: 创建 alipay-handler.ts**

配置通过 `PaymentMethodHandler.args` 传入（appId/privateKey/alipayPublicKey/tradeType），不使用 method.customFields。

createPayment 返回 `metadata: { payForm: result, payType: 'page' | 'wap' }`。

- [ ] **Step 3: 创建 alipay.controller.ts**

异步通知 Controller，验证签名。

- [ ] **Step 4: 构建验证**

Run: `cd e:\code\vendure\packages\alipay-plugin && npm install && npm run build`

- [ ] **Step 5: 提交**

```bash
git add packages/alipay-plugin/
git commit -m "feat(alipay-plugin): add Alipay payment plugin"
```

---

### Task 6: wechatpay-plugin

**Files:**
- Create: `packages/wechatpay-plugin/` 完整骨架
- 关键：wechatpay-handler.ts 中配置通过 `args` 传入

- [ ] **Step 1-5: 同 Task 5 结构**

wechatpay-handler.ts 配置通过 args 传入（appId/mchId/apiKey/tradeType）。

- [ ] **提交**

```bash
git add packages/wechatpay-plugin/
git commit -m "feat(wechatpay-plugin): add WeChat Pay plugin"
```

---

### Task 7: oss-plugin

**Files:**
- Create: `packages/oss-plugin/` 完整骨架

- [ ] **Step 1-5: 创建插件骨架 + oss-strategy.ts**

标准 AssetStorageStrategy 实现。

- [ ] **提交**

```bash
git add packages/oss-plugin/
git commit -m "feat(oss-plugin): add Aliyun OSS storage plugin"
```

---

### Task 8: phone-auth-plugin

**Files:**
- Create: `packages/phone-auth-plugin/` 完整骨架

- [ ] **Step 1-5: 创建插件骨架 + PhoneAuthenticationStrategy + SmsService + AuthResolver**

- [ ] **提交**

```bash
git add packages/phone-auth-plugin/
git commit -m "feat(phone-auth-plugin): add phone authentication plugin"
```

---

### Task 9: 最终集成验证

- [ ] **Step 1: 全量构建**

Run: `cd e:\code\vendure && npm run build`

- [ ] **Step 2: 验证所有插件导出**

确认每个插件的 index.ts 正确导出所有公共 API。

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: complete CJK plugin suite v2"
```
