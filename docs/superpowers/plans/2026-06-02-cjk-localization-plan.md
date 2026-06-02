# CJK Plugin 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vendure 创建 `@vendure/cjk-plugin` 单体插件，提供中日韩本地化支持（i18n、地区数据、支付宝/微信支付、阿里云 OSS、手机号认证）。

**Architecture:** 基于 VendurePlugin 装饰器的标准插件模式，通过 `configuration` 函数注入 i18n 翻译和自定义配置，通过 `PaymentMethodHandler` 实现支付集成，通过 `AssetStorageStrategy` 实现 OSS 存储，通过 `AuthenticationStrategy` 实现手机号认证。

**Tech Stack:** TypeScript, NestJS, Vendure v3.6.x, alipay-sdk, wechatpay-node-v3, ali-oss, @alicloud/dysmsapi20170525

---

## 文件结构

```
packages/cjk-plugin/
├── src/
│   ├── plugin.ts                              # 主插件入口，VendurePlugin 装饰器
│   ├── constants.ts                           # 插件常量
│   ├── types.ts                               # CjkPluginOptions 类型定义
│   ├── i18n/
│   │   ├── zh_CN.json                         # 简体中文核心翻译
│   │   ├── zh_TW.json                         # 繁体中文核心翻译
│   │   ├── ja.json                            # 日语核心翻译
│   │   └── ko.json                            # 韩语核心翻译
│   ├── dashboard/
│   │   ├── zh_Hans.po                         # Dashboard 简体中文
│   │   ├── zh_Hant.po                         # Dashboard 繁体中文
│   │   ├── ja.po                              # Dashboard 日语
│   │   └── ko.po                              # Dashboard 韩语
│   ├── regions/
│   │   ├── china.ts                           # 中国省市区数据
│   │   ├── japan.ts                           # 日本都道府县数据
│   │   ├── korea.ts                           # 韩国省市数据
│   │   └── region-populator.ts                # 地区数据导入服务
│   ├── payment/
│   │   ├── alipay/
│   │   │   ├── alipay-handler.ts              # PaymentMethodHandler
│   │   │   ├── alipay.controller.ts           # 异步通知 Controller
│   │   │   └── types.ts                       # 支付宝类型
│   │   └── wechatpay/
│   │       ├── wechatpay-handler.ts           # PaymentMethodHandler
│   │       ├── wechatpay.controller.ts        # 异步通知 Controller
│   │       └── types.ts                       # 微信支付类型
│   ├── storage/
│   │   └── oss-strategy.ts                    # AssetStorageStrategy 实现
│   └── auth/
│       ├── phone-authentication-strategy.ts   # AuthenticationStrategy 实现
│       ├── sms.service.ts                     # 短信发送服务
│       └── auth.resolver.ts                   # GraphQL resolver
├── index.ts                                   # 导出入口
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

### Task 1: 创建插件骨架

**Files:**
- Create: `packages/cjk-plugin/package.json`
- Create: `packages/cjk-plugin/tsconfig.json`
- Create: `packages/cjk-plugin/tsconfig.build.json`
- Create: `packages/cjk-plugin/index.ts`
- Create: `packages/cjk-plugin/src/constants.ts`
- Create: `packages/cjk-plugin/src/types.ts`
- Create: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/cjk-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": [
        "lib/**/*",
        "src/i18n/**/*.json",
        "src/dashboard/**/*.po"
    ],
    "repository": {
        "type": "git",
        "url": "https://github.com/johocn/vendure"
    },
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "publishConfig": {
        "access": "public"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "peerDependenciesMeta": {
        "alipay-sdk": {
            "optional": true
        },
        "wechatpay-node-v3": {
            "optional": true
        },
        "ali-oss": {
            "optional": true
        },
        "@alicloud/dysmsapi20170525": {
            "optional": true
        }
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

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

- [ ] **Step 3: 创建 tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./lib"
  },
  "files": [
    "./index.ts"
  ]
}
```

- [ ] **Step 4: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'CJKPlugin';
export const CJK_PLUGIN_OPTIONS = Symbol('CJK_PLUGIN_OPTIONS');
export const CJK_PLUGIN_ROUTE = 'cjk';
```

- [ ] **Step 5: 创建 src/types.ts**

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

export interface CjkPluginAlipayOptions {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    gateway?: string;
    notifyUrl?: string;
    returnUrl?: string;
    signType?: 'RSA2';
}

export interface CjkPluginWechatPayOptions {
    appId: string;
    mchId: string;
    apiKey: string;
    certPath?: string;
    notifyUrl?: string;
    tradeType?: 'JSAPI' | 'NATIVE' | 'APP';
}

export interface CjkPluginOssOptions {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region: string;
    endpoint?: string;
    publicPath?: string;
}

export interface CjkPluginPhoneAuthOptions {
    enabled?: boolean;
    smsProvider?: 'aliyun';
    smsConfig?: {
        accessKeyId: string;
        accessKeySecret: string;
        signName: string;
        templateCode: string;
    };
}

export interface CjkPluginOptions {
    i18n?: CjkPluginI18nOptions;
    regions?: CjkPluginRegionsOptions;
    alipay?: CjkPluginAlipayOptions;
    wechatpay?: CjkPluginWechatPayOptions;
    oss?: CjkPluginOssOptions;
    phoneAuth?: CjkPluginPhoneAuthOptions;
}
```

- [ ] **Step 6: 创建 src/plugin.ts**

```typescript
import { Inject, MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { LanguageCode, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { CJK_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CjkPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options }],
    compatibility: '^3.0.0',
})
export class CjkPlugin implements OnApplicationBootstrap, NestModule {
    private static options: CjkPluginOptions;

    constructor(@Inject(CJK_PLUGIN_OPTIONS) private options: CjkPluginOptions) {}

    static init(options: CjkPluginOptions): Type<CjkPlugin> {
        CjkPlugin.options = options;
        return CjkPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        if (this.options.i18n?.enabled !== false) {
            Logger.info('CJK i18n module enabled', loggerCtx);
        }
        if (this.options.regions?.enabled !== false) {
            Logger.info('CJK regions module enabled', loggerCtx);
        }
        if (this.options.alipay) {
            Logger.info('Alipay payment module enabled', loggerCtx);
        }
        if (this.options.wechatpay) {
            Logger.info('WeChat Pay module enabled', loggerCtx);
        }
        if (this.options.oss) {
            Logger.info('Aliyun OSS storage module enabled', loggerCtx);
        }
        if (this.options.phoneAuth?.enabled) {
            Logger.info('Phone auth module enabled', loggerCtx);
        }
    }

    configure(consumer: MiddlewareConsumer): void {}
}
```

- [ ] **Step 7: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
```

- [ ] **Step 8: 安装依赖并验证构建**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 9: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): scaffold plugin structure"
```

---

### Task 2: 核心 i18n 翻译（zh_CN / zh_TW / ja / ko）

**Files:**
- Create: `packages/cjk-plugin/src/i18n/zh_CN.json`
- Create: `packages/cjk-plugin/src/i18n/zh_TW.json`
- Create: `packages/cjk-plugin/src/i18n/ja.json`
- Create: `packages/cjk-plugin/src/i18n/ko.json`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 zh_CN.json**

基于 `packages/core/src/i18n/messages/en.json` 的完整翻译，包含 `error`、`errorResult`、`message` 三个命名空间。翻译所有条目为简体中文。

```json
{
  "error": {
    "active-user-does-not-have-sufficient-permissions": "当前用户没有足够的权限",
    "available-currency-codes-must-include-default": "可用货币代码必须包含默认货币代码（{ defaultCurrencyCode }）",
    "cannot-delete-role": "角色 \"{ roleCode }\" 无法删除",
    "cannot-delete-sole-superadmin": "唯一的超级管理员无法删除",
    "email-address-already-exists-for-administrator": "该邮箱地址已存在管理员账户",
    "cannot-delete-default-channel": "默认渠道无法删除",
    "cannot-locate-customer-for-user": "无法找到该用户对应的客户",
    "cannot-modify-role": "角色 \"{ roleCode }\" 无法修改",
    "cannot-move-collection-into-self": "无法将集合移动到自身内部",
    "cannot-transition-payment-from-to": "支付无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "cannot-transition-refund-from-to": "退款无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "cannot-transition-fulfillment-from-to": "履约无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "channel-not-found": "找不到令牌为 \"{ token }\" 的渠道",
    "collection-id-or-slug-must-be-provided": "必须提供集合 ID 或 slug",
    "collection-id-slug-mismatch": "提供的 ID 和 slug 指向不同的集合",
    "conditions-required-for-action": "促销操作 \"{ action }\" 需要以下条件：{ conditions }",
    "configurable-argument-is-required": "参数 \"{ name }\" 是必填的",
    "country-code-not-valid": "国家代码 \"{ countryCode }\" 无法识别",
    "currency-not-available-in-channel": "货币 \"{ currencyCode }\" 在当前渠道中不可用",
    "customer-does-not-belong-to-customer-group": "客户不属于此客户组",
    "default-channel-not-found": "未找到默认渠道",
    "entity-has-no-translation-in-language": "可翻译实体 \"{ entityName }\" 尚未翻译为请求的语言（{ languageCode }）",
    "entity-with-id-not-found": "找不到 ID 为 \"{ id }\" 的 { entityName }",
    "items-cannot-be-removed-from-default-channel": "无法从默认渠道中移除项目",
    "facetfilterinput-invalid-input": "FacetValueFilterInput 对象不能同时指定 'and' 和 'or' 字段",
    "field-invalid-datetime-range-max": "自定义字段 \"{ name }\" 的值 [{ value }] 大于最大值 [{ max }]",
    "field-invalid-datetime-range-min": "自定义字段 \"{ name }\" 的值 [{ value }] 小于最小值 [{ min }]",
    "field-invalid-non-nullable": "自定义字段 \"{ name }\" 的值不能设为 null",
    "field-invalid-no-permission": "您没有更新 \"{ name }\" 字段所需的权限",
    "field-invalid-number-range-max": "自定义字段 \"{ name }\" 的值 [{ value }] 大于最大值 [{ max }]",
    "field-invalid-number-range-min": "自定义字段 \"{ name }\" 的值 [{ value }] 小于最小值 [{ min }]",
    "field-invalid-readonly": "自定义字段 \"{ name }\" 是只读的",
    "field-invalid-string-option": "自定义字段 \"{ name }\" 的值 [\"{ value }\"] 无效。有效选项为 [{ validOptions }]",
    "field-invalid-string-pattern": "自定义字段 \"{ name }\" 的值 [\"{ value }\"] 不匹配模式 [{ pattern }]",
    "forbidden": "您当前无权执行此操作",
    "invalid-sort-field": "排序字段 \"{ fieldName }\" 无效。有效字段为：{ validFields }",
    "list-query-limit-exceeded": "列表查询返回结果不能超过 { limit } 条",
    "no-active-tax-zone": "无法确定活跃税率区域。请确保为当前渠道设置了默认税率区域。",
    "no-configurable-operation-def-with-code-found": "找不到代码为 \"{ code }\" 的 { type }",
    "no-price-found-for-channel": "未找到渠道 \"{ channel }\" 中 ProductVariant ID \"{ variantId }\" 的价格信息",
    "no-search-plugin-configured": "未配置搜索插件",
    "order-could-not-be-determined-or-created": "无法确定或创建活跃订单",
    "order-does-not-contain-line-with-id": "此订单不包含 ID 为 { id } 的订单行",
    "pending-identifier-missing": "找不到待更新的邮箱地址",
    "permission-invalid": "权限 \"{ permission }\" 不可分配",
    "product-id-or-slug-must-be-provided": "必须提供商品 ID 或 slug",
    "product-id-slug-mismatch": "提供的 ID 和 slug 指向不同的商品",
    "product-option-group-already-assigned": "选项组 \"{ groupCode }\" 已分配给商品 \"{ productName }\"",
    "product-variant-option-ids-not-compatible": "ProductVariant optionIds 必须包含以下每个组的一个 optionId：{groupNames}",
    "product-variant-options-combination-already-exists": "所选选项的 ProductVariant 已存在：{variantName}",
    "promotion-channels-can-only-be-changed-from-default-channel": "促销渠道只能从默认渠道更改",
    "stockonhand-cannot-be-negative": "库存数量不能为负值",
    "superadmin-must-have-superadmin-role": "不能从唯一的超级管理员移除超级管理员角色",
    "target-customer-not-assigned-to-order-channels": "目标客户未分配到与订单相同的渠道。缺少渠道 ID：{ missingChannelIds }",
    "unauthorized": "凭据不匹配，请检查后重试"
  },
  "errorResult": {
    "ALREADY_LOGGED_IN_ERROR": "已登录时无法为客户设置订单",
    "ALREADY_REFUNDED_ERROR": "无法退款已退款的订单项",
    "CANCEL_ACTIVE_ORDER_ERROR": "无法从 \"{ orderState }\" 状态的订单中取消订单行",
    "CANCEL_PAYMENT_ERROR": "取消支付失败",
    "CHANNEL_DEFAULT_LANGUAGE_ERROR": "无法使语言 \"{ language }\" 不可用，因为它被渠道 \"{ channelCode }\" 用作默认语言",
    "COUPON_CODE_EXPIRED_ERROR": "优惠券代码 \"{ couponCode }\" 已过期",
    "COUPON_CODE_INVALID_ERROR": "优惠券代码 \"{ couponCode }\" 无效",
    "COUPON_CODE_LIMIT_ERROR": "优惠券代码每位顾客最多使用 {limit, plural, one {1次} other {#次}}",
    "CREATE_FULFILLMENT_ERROR": "创建履约时发生错误",
    "DUPLICATE_ENTITY_ERROR": "实体无法复制",
    "EMAIL_ADDRESS_CONFLICT_ERROR": "该邮箱地址不可用",
    "EMPTY_ORDER_LINE_SELECTION_ERROR": "必须至少指定一个订单行",
    "FACET_IN_USE_ERROR": "方面 \"{ facetCode }\" 包含已分配给 {productCount, plural, =0 {} one {1个商品} other {#个商品}} {variantCount, plural, =0 {} one {1个商品变体} other {#个商品变体}} 的方面值",
    "IDENTIFIER_CHANGE_TOKEN_INVALID_ERROR": "标识符更改令牌无法识别",
    "INELIGIBLE_SHIPPING_METHOD_ERROR": "此订单不符合所选配送方式的要求",
    "INSUFFICIENT_STOCK_ERROR": "{quantityAvailable, plural, =0 {没有商品被} other {仅有 # 件商品被}}添加到订单，库存不足",
    "INSUFFICIENT_STOCK_ON_HAND_ERROR": "无法创建履约，\"{productVariantName}\" 库存不足（{stockOnHand}）",
    "INVALID_CREDENTIALS_ERROR": "提供的凭据无效",
    "ITEMS_ALREADY_FULFILLED_ERROR": "一个或多个订单项已在履约中",
    "LANGUAGE_NOT_AVAILABLE_ERROR": "语言 \"{languageCode}\" 不可用。请先通过全局设置启用后重试",
    "MANUAL_PAYMENT_STATE_ERROR": "手动支付只能在 \"ArrangingPayment\" 或 \"ArrangingAdditionalPayment\" 状态下添加",
    "MIME_TYPE_ERROR": "不允许的 MIME 类型 \"{ mimeType }\"",
    "MISSING_CONDITIONS_ERROR": "促销必须至少有一个条件或设置优惠券代码",
    "MISSING_PASSWORD_ERROR": "必须提供密码",
    "NEGATIVE_QUANTITY_ERROR": "订单项的数量不能为负数",
    "NO_ACTIVE_ORDER_ERROR": "当前会话没有关联的活跃订单",
    "NOTHING_TO_REFUND_ERROR": "没有可退款的内容",
    "NOT_VERIFIED_ERROR": "请先验证此邮箱地址后再登录",
    "ORDER_INTERCEPTOR_ERROR": "尝试修改订单时发生错误",
    "ORDER_LIMIT_ERROR": "无法添加商品。订单最多可包含 { maxItems } 个商品",
    "ORDER_MODIFICATION_ERROR": "订单内容只能在 \"AddingItems\" 状态下修改",
    "ORDER_PAYMENT_STATE_ERROR": "只能在订单处于 \"ArrangingPayment\" 状态时添加支付",
    "ORDER_STATE_TRANSITION_ERROR": "订单无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "PASSWORD_ALREADY_SET_ERROR": "注册时已设置密码",
    "PASSWORD_RESET_TOKEN_EXPIRED_ERROR": "密码重置令牌已过期",
    "PASSWORD_RESET_TOKEN_INVALID_ERROR": "密码重置令牌无法识别",
    "PASSWORD_VALIDATION_ERROR": "密码无效",
    "PAYMENT_DECLINED_ERROR": "支付被拒绝",
    "PAYMENT_FAILED_ERROR": "支付失败",
    "PAYMENT_ORDER_MISMATCH_ERROR": "支付和订单行不属于同一订单",
    "PAYMENT_STATE_TRANSITION_ERROR": "支付无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "PRODUCT_OPTION_GROUP_IN_USE_ERROR": "无法从渠道中移除选项组 \"{ optionGroupCode }\"，因为它被 {productCount, plural, one {1个商品} other {#个商品}} 和 {variantCount, plural, one {1个商品变体} other {#个商品变体}} 使用",
    "PRODUCT_OPTION_IN_USE_ERROR": "无法移除选项组 \"{ optionGroupCode }\"，因为它被 {productVariantCount, plural, one {1个商品变体} other {#个商品变体}} 使用。使用 force 参数强制移除",
    "QUANTITY_TOO_GREAT_ERROR": "指定数量大于可用的订单项数量",
    "REFUND_AMOUNT_ERROR": "指定金额超过此支付的可退款金额",
    "REFUND_ORDER_STATE_ERROR": "无法在 \"{ orderState }\" 状态下退款订单",
    "SETTLE_PAYMENT_ERROR": "结算支付失败",
    "VERIFICATION_TOKEN_EXPIRED_ERROR": "验证令牌已过期。使用 refreshCustomerVerification 发送新令牌。",
    "VERIFICATION_TOKEN_INVALID_ERROR": "验证令牌无法识别"
  },
  "message": {
    "asset-to-be-deleted-is-featured": "所选{assetCount, plural, one {资产} other {资产}}被 {products, plural, =0 {} one {1个商品} other {#个商品}} {variants, plural, =0 {} one {1个商品变体} other {#个商品变体}} {collections, plural, =0 {} one {1个集合} other {#个集合}}推荐使用",
    "cannot-delete-last-stock-location": "最后一个库存位置无法删除",
    "cannot-remove-tax-category-due-to-tax-rates": "无法移除税率类别 \"{ name }\"，因为它被 {count, plural, one {1个税率} other {#个税率}} 引用",
    "cannot-transition-order-contains-products-which-are-unavailable": "无法转换为 \"{ toState }\"，因为订单包含不再可用的商品变体",
    "cannot-transition-from-arranging-additional-payment": "除非订单总额被支付覆盖，否则无法从 \"ArrangingAdditionalPayment\" 转换",
    "cannot-transition-order-from-to": "订单无法从 \"{ fromState }\" 转换为 \"{ toState }\"",
    "cannot-transition-no-additional-payments-needed": "无需额外支付，订单无法转换为 \"ArrangingAdditionalPayment\" 状态",
    "cannot-transition-to-shipping-when-order-is-empty": "订单为空时无法转换为 \"ArrangingShipping\" 状态",
    "cannot-transition-to-payment-due-to-insufficient-stock": "由于 { productVariantNames } 库存不足，订单无法转换为 \"ArrangingPayment\" 状态",
    "cannot-transition-to-payment-without-customer": "没有客户信息时订单无法转换为 \"ArrangingPayment\" 状态",
    "cannot-transition-to-payment-without-shipping-method": "没有配送方式时订单无法转换为 \"ArrangingPayment\" 状态",
    "cannot-transition-unless-all-cancelled": "所有订单项取消后订单才能转换为 \"Cancelled\" 状态",
    "cannot-transition-unless-all-order-items-delivered": "所有订单项送达后订单才能转换为 \"Delivered\" 状态",
    "cannot-transition-unless-some-order-items-delivered": "部分订单项送达后订单才能转换为 \"PartiallyDelivered\" 状态",
    "cannot-transition-unless-some-order-items-shipped": "部分订单项发货后订单才能转换为 \"PartiallyShipped\" 状态",
    "cannot-transition-unless-all-order-items-shipped": "所有订单项发货后订单才能转换为 \"Shipped\" 状态",
    "cannot-transition-without-authorized-payments": "授权支付未覆盖总额时订单无法转换为 \"PaymentAuthorized\" 状态",
    "cannot-transition-without-modification-payment": "只能转换为 \"ArrangingAdditionalPayment\" 状态",
    "cannot-transition-without-settled-payments": "结算支付未覆盖总额时订单无法转换为 \"PaymentSettled\" 状态",
    "country-used-in-addresses": "所选国家无法删除，因为它被 {count, plural, one {1个地址} other {#个地址}} 使用",
    "entity-duplication-no-permission": "您没有复制此实体的所需权限",
    "entity-duplication-no-strategy-found": "未找到实体类型 \"{ entityName }\" 的复制策略 \"{ code }\"",
    "facet-force-deleted": "方面已删除，其方面值已从 {products, plural, =0 {} one {1个商品} other {#个商品}}{both, select, both {、} single {} other {}}{variants, plural, =0 {} one {1个商品变体} other {#个商品变体}} 中移除",
    "facet-used": "方面 \"{ facetCode }\" 包含已分配给 {products, plural, =0 {} one {1个商品} other {#个商品}}{both, select, both {、} single {} other {}}{variants, plural, =0 {} one {1个商品变体} other {#个商品变体}} 的方面值",
    "facet-value-force-deleted": "所选方面值已从 {products, plural, =0 {} one {1个商品} other {#个商品}}{both, select, both {、} single {} other {}}{variants, plural, =0 {} one {1个商品变体} other {#个商品变体}} 中移除并删除",
    "facet-value-used": "方面值 \"{ facetValueCode }\" 已分配给 {products, plural, =0 {} one {1个商品} other {#个商品}}{both, select, both {、} single {} other {}}{variants, plural, =0 {} one {1个商品变体} other {#个商品变体}}",
    "payment-method-used-in-channels": "所选支付方式已分配给以下渠道：{ channelCodes }。设置 \"force: true\" 从所有渠道中删除。",
    "product-option-group-used": "无法删除选项组 \"{code}\"，因为它被 {count, plural, one {1个商品} other {#个商品}} 使用",
    "product-option-used": "无法删除选项 \"{code}\"，因为它被 {count, plural, =0 {} one {1个商品变体} other {#个商品变体}} 使用",
    "zone-used-in-channels": "所选区域无法删除，因为它被以下渠道用作默认区域：{ channelCodes }",
    "zone-used-in-tax-rates": "所选区域无法删除，因为它被以下税率使用：{ taxRateNames }"
  }
}
```

- [ ] **Step 2: 创建 zh_TW.json**

基于 zh_CN.json，将简体中文转换为繁体中文。关键差异示例：
- "权限" → "權限"
- "渠道" → "管道"
- "订单" → "訂單"
- "支付" → "付款"
- "商品" → "商品"
- "客户" → "客戶"
- "促销" → "促銷"

（完整内容与 zh_CN.json 结构一致，所有值替换为繁体中文）

- [ ] **Step 3: 创建 ja.json**

基于 en.json，翻译为日语。关键示例：
- "Active user does not have sufficient permissions" → "アクティブなユーザーには十分な権限がありません"
- "The sole SuperAdmin cannot be deleted" → "唯一のスーパー管理者は削除できません"
- "Cannot transition Payment from" → "支払いを「{ fromState }」から「{ toState }」に遷移できません"

（完整内容与 en.json 结构一致，所有值替换为日语）

- [ ] **Step 4: 创建 ko.json**

基于 en.json，翻译为韩语。关键示例：
- "Active user does not have sufficient permissions" → "활성 사용자에게 충분한 권한이 없습니다"
- "The sole SuperAdmin cannot be deleted" → "유일한 슈퍼 관리자는 삭제할 수 없습니다"
- "Cannot transition Payment from" → "결제를 \"{ fromState }\"에서 \"{ toState }\"(으)로 전환할 수 없습니다"

（完整内容与 en.json 结构一致，所有值替换为韩语）

- [ ] **Step 5: 修改 plugin.ts 注入 i18n 翻译**

在 `onApplicationBootstrap` 中注入翻译资源：

```typescript
import { I18nService, Injector, ModuleRef } from '@vendure/core';

// 在类中添加
constructor(
    @Inject(CJK_PLUGIN_OPTIONS) private options: CjkPluginOptions,
    private moduleRef: ModuleRef,
) {}

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
```

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add core i18n translations for zh_CN, zh_TW, ja, ko"
```

---

### Task 3: Dashboard i18n 翻译

**Files:**
- Create: `packages/cjk-plugin/src/dashboard/zh_Hans.po`
- Create: `packages/cjk-plugin/src/dashboard/zh_Hant.po`
- Create: `packages/cjk-plugin/src/dashboard/ja.po`
- Create: `packages/cjk-plugin/src/dashboard/ko.po`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 复制 en.po 作为基础**

Run: `cp e:\code\vendure\packages\dashboard\src\i18n\locales\en.po e:\code\vendure\packages\cjk-plugin\src\dashboard\zh_Hans.po`

- [ ] **Step 2: 翻译 zh_Hans.po**

修改 `.po` 文件头部 `Language: zh_Hans`，将所有 `msgstr` 翻译为简体中文。关键条目示例：

```po
msgid "Full Name"
msgstr "姓名"

msgid "Select items"
msgstr "选择项目"

msgid "Tracking code"
msgstr "物流单号"

msgid "New Tax Rate"
msgstr "新建税率"

msgid "Product options"
msgstr "商品选项"
```

- [ ] **Step 3: 创建 zh_Hant.po / ja.po / ko.po**

同样基于 en.po，分别翻译为繁体中文、日语、韩语。

- [ ] **Step 4: 修改 plugin.ts 注入 Dashboard 翻译**

在 `configuration` 函数中注入 Dashboard 翻译：

```typescript
configuration: (config) => {
    if (CjkPlugin.options.i18n?.enabled !== false) {
        const dashboardTranslations: Record<string, string> = {};
        // Dashboard 翻译通过 DashboardPlugin 的 translations 配置加载
        // 需要在使用时由用户在 DashboardPlugin 配置中引用
    }
    return config;
}
```

注意：Dashboard 翻译文件需要用户在 DashboardPlugin 配置中手动引用路径，因为 DashboardPlugin 的翻译加载机制与核心 i18n 不同。

- [ ] **Step 5: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 6: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add Dashboard i18n translations for zh_Hans, zh_Hant, ja, ko"
```

---

### Task 4: 地区数据模块

**Files:**
- Create: `packages/cjk-plugin/src/regions/china.ts`
- Create: `packages/cjk-plugin/src/regions/japan.ts`
- Create: `packages/cjk-plugin/src/regions/korea.ts`
- Create: `packages/cjk-plugin/src/regions/region-populator.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 china.ts**

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

- [ ] **Step 2: 创建 japan.ts**

```typescript
export const japanPrefectures = [
    { code: 'JP-01', name: '北海道' },
    { code: 'JP-02', name: '青森県' },
    { code: 'JP-03', name: '岩手県' },
    { code: 'JP-04', name: '宮城県' },
    { code: 'JP-05', name: '秋田県' },
    { code: 'JP-06', name: '山形県' },
    { code: 'JP-07', name: '福島県' },
    { code: 'JP-08', name: '茨城県' },
    { code: 'JP-09', name: '栃木県' },
    { code: 'JP-10', name: '群馬県' },
    { code: 'JP-11', name: '埼玉県' },
    { code: 'JP-12', name: '千葉県' },
    { code: 'JP-13', name: '東京都' },
    { code: 'JP-14', name: '神奈川県' },
    { code: 'JP-15', name: '新潟県' },
    { code: 'JP-16', name: '富山県' },
    { code: 'JP-17', name: '石川県' },
    { code: 'JP-18', name: '福井県' },
    { code: 'JP-19', name: '山梨県' },
    { code: 'JP-20', name: '長野県' },
    { code: 'JP-21', name: '岐阜県' },
    { code: 'JP-22', name: '静岡県' },
    { code: 'JP-23', name: '愛知県' },
    { code: 'JP-24', name: '三重県' },
    { code: 'JP-25', name: '滋賀県' },
    { code: 'JP-26', name: '京都府' },
    { code: 'JP-27', name: '大阪府' },
    { code: 'JP-28', name: '兵庫県' },
    { code: 'JP-29', name: '奈良県' },
    { code: 'JP-30', name: '和歌山県' },
    { code: 'JP-31', name: '鳥取県' },
    { code: 'JP-32', name: '島根県' },
    { code: 'JP-33', name: '岡山県' },
    { code: 'JP-34', name: '広島県' },
    { code: 'JP-35', name: '山口県' },
    { code: 'JP-36', name: '徳島県' },
    { code: 'JP-37', name: '香川県' },
    { code: 'JP-38', name: '愛媛県' },
    { code: 'JP-39', name: '高知県' },
    { code: 'JP-40', name: '福岡県' },
    { code: 'JP-41', name: '佐賀県' },
    { code: 'JP-42', name: '長崎県' },
    { code: 'JP-43', name: '熊本県' },
    { code: 'JP-44', name: '大分県' },
    { code: 'JP-45', name: '宮崎県' },
    { code: 'JP-46', name: '鹿児島県' },
    { code: 'JP-47', name: '沖縄県' },
];
```

- [ ] **Step 3: 创建 korea.ts**

```typescript
export const koreaProvinces = [
    { code: 'KR-11', name: '서울특별시' },
    { code: 'KR-26', name: '부산광역시' },
    { code: 'KR-27', name: '대구광역시' },
    { code: 'KR-28', name: '인천광역시' },
    { code: 'KR-29', name: '광주광역시' },
    { code: 'KR-30', name: '대전광역시' },
    { code: 'KR-31', name: '울산광역시' },
    { code: 'KR-41', name: '경기도' },
    { code: 'KR-42', name: '강원도' },
    { code: 'KR-43', name: '충청북도' },
    { code: 'KR-44', name: '충청남도' },
    { code: 'KR-45', name: '전라북도' },
    { code: 'KR-46', name: '전라남도' },
    { code: 'KR-47', name: '경상북도' },
    { code: 'KR-48', name: '경상남도' },
    { code: 'KR-50', name: '제주특별자치도' },
    { code: 'KR-49', name: '세종특별자치시' },
];
```

- [ ] **Step 4: 创建 region-populator.ts**

```typescript
import { Injector, Logger, CountryService, ZoneService } from '@vendure/core';
import { LanguageCode } from '@vendure/common/lib/generated-types';

import { loggerCtx } from '../constants';
import { chinaProvinces } from './china';
import { japanPrefectures } from './japan';
import { koreaProvinces } from './korea';

export class RegionPopulator {
    async populate(injector: Injector, countries: ('CN' | 'JP' | 'KR')[]): Promise<void> {
        const countryService = injector.get(CountryService);
        const zoneService = injector.get(ZoneService);

        if (countries.includes('CN')) {
            await this.populateChina(countryService, zoneService);
        }
        if (countries.includes('JP')) {
            await this.populateJapan(countryService, zoneService);
        }
        if (countries.includes('KR')) {
            await this.populateKorea(countryService, zoneService);
        }
    }

    private async populateChina(countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create({
                name: '中国',
            });
            await countryService.create({
                code: 'CN',
                name: '中国',
                translations: [{ languageCode: LanguageCode.zh_Hans, name: '中国' }],
                zoneId: zone.id,
            });
            Logger.info('Created China country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create China: ${e.message}`, loggerCtx);
        }
    }

    private async populateJapan(countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create({
                name: '日本',
            });
            await countryService.create({
                code: 'JP',
                name: '日本',
                translations: [{ languageCode: LanguageCode.ja, name: '日本' }],
                zoneId: zone.id,
            });
            Logger.info('Created Japan country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create Japan: ${e.message}`, loggerCtx);
        }
    }

    private async populateKorea(countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create({
                name: '韩国',
            });
            await countryService.create({
                code: 'KR',
                name: '韩国',
                translations: [{ languageCode: LanguageCode.ko, name: '한국' }],
                zoneId: zone.id,
            });
            Logger.info('Created Korea country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create Korea: ${e.message}`, loggerCtx);
        }
    }
}
```

- [ ] **Step 5: 修改 plugin.ts 集成地区数据**

在 `onApplicationBootstrap` 中调用 RegionPopulator：

```typescript
async onApplicationBootstrap(): Promise<void> {
    // ... i18n 代码 ...

    if (this.options.regions?.enabled !== false) {
        const countries = this.options.regions?.countries || ['CN', 'JP', 'KR'];
        const injector = new Injector(this.moduleRef);
        const populator = new RegionPopulator();
        await populator.populate(injector, countries);
    }
}
```

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add region data for China, Japan, Korea"
```

---

### Task 5: 支付宝支付模块

**Files:**
- Create: `packages/cjk-plugin/src/payment/alipay/types.ts`
- Create: `packages/cjk-plugin/src/payment/alipay/alipay-handler.ts`
- Create: `packages/cjk-plugin/src/payment/alipay/alipay.controller.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`
- Modify: `packages/cjk-plugin/package.json`

- [ ] **Step 1: 添加 alipay-sdk 依赖**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install alipay-sdk --save`

- [ ] **Step 2: 创建 types.ts**

```typescript
export interface AlipayConfig {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    gateway?: string;
    notifyUrl?: string;
    returnUrl?: string;
    signType?: 'RSA2';
}
```

- [ ] **Step 3: 创建 alipay-handler.ts**

```typescript
import { ConfigArgs, LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

import { loggerCtx } from '../../constants';
import { AlipayConfig } from './types';

export const alipayPaymentHandler = new PaymentMethodHandler({
    code: 'alipay',
    description: [{ languageCode: LanguageCode.zh_Hans, value: '支付宝支付' }],
    args: {
        tradeType: {
            type: 'string',
            defaultValue: 'PAGE',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '交易类型' }],
        },
    },
    createPayment: async (ctx, order, amount, args, metadata, method) => {
        try {
            const AlipaySdk = await import('alipay-sdk');
            const config: AlipayConfig = method.customFields?.alipayConfig || {};
            const alipaySdk = new AlipaySdk.default({
                appId: config.appId,
                privateKey: config.privateKey,
                alipayPublicKey: config.alipayPublicKey,
                gateway: config.gateway || 'https://openapi.alipay.com/gateway.do',
                signType: config.signType || 'RSA2',
            });

            const tradeType = args.tradeType || 'PAGE';
            const result = await alipaySdk.pageExec(
                'alipay.trade.page.pay',
                {
                    bizContent: {
                        out_trade_no: order.code,
                        total_amount: (amount / 100).toFixed(2),
                        subject: `订单 ${order.code}`,
                        product_code: tradeType === 'WAP' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
                    },
                    notify_url: config.notifyUrl,
                    return_url: config.returnUrl,
                },
            );

            return {
                amount,
                state: 'Authorized' as const,
                transactionId: order.code,
                metadata: {
                    payUrl: result,
                    tradeType,
                },
            };
        } catch (e: any) {
            Logger.error(`Alipay createPayment failed: ${e.message}`, loggerCtx);
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: e.message,
                metadata: {},
            };
        }
    },
    settlePayment: async (ctx, order, payment, args, method) => {
        return { success: true };
    },
    createRefund: async (ctx, input, amount, order, payment, args, method) => {
        try {
            const AlipaySdk = await import('alipay-sdk');
            const config: AlipayConfig = method.customFields?.alipayConfig || {};
            const alipaySdk = new AlipaySdk.default({
                appId: config.appId,
                privateKey: config.privateKey,
                alipayPublicKey: config.alipayPublicKey,
                gateway: config.gateway || 'https://openapi.alipay.com/gateway.do',
                signType: config.signType || 'RSA2',
            });

            const result = await alipaySdk.exec('alipay.trade.refund', {
                bizContent: {
                    out_trade_no: order.code,
                    refund_amount: (amount / 100).toFixed(2),
                },
            });

            return {
                state: 'Settled' as const,
                transactionId: payment.transactionId,
                metadata: result,
            };
        } catch (e: any) {
            Logger.error(`Alipay refund failed: ${e.message}`, loggerCtx);
            return {
                state: 'Failed' as const,
                metadata: { error: e.message },
            };
        }
    },
});
```

- [ ] **Step 4: 创建 alipay.controller.ts**

```typescript
import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Logger, PaymentService } from '@vendure/core';
import { Request, Response } from 'express';

import { loggerCtx } from '../../constants';

@Controller('cjk/alipay')
export class AlipayController {
    constructor(private paymentService: PaymentService) {}

    @Post('notify')
    async notify(@Body() body: any, @Req() req: Request, @Res() res: Response): Promise<void> {
        try {
            const AlipaySdk = await import('alipay-sdk');
            const signVerified = AlipaySdk.default.checkNotifySign(body);
            if (!signVerified) {
                Logger.warn('Alipay notify sign verification failed', loggerCtx);
                res.send('fail');
                return;
            }

            const tradeStatus = body.trade_status;
            const outTradeNo = body.out_trade_no;

            if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
                Logger.info(`Alipay payment settled: ${outTradeNo}`, loggerCtx);
            }

            res.send('success');
        } catch (e: any) {
            Logger.error(`Alipay notify error: ${e.message}`, loggerCtx);
            res.send('fail');
        }
    }
}
```

- [ ] **Step 5: 修改 plugin.ts 集成支付宝**

在 `VendurePlugin` 装饰器中添加 `controllers` 和 `configuration`：

```typescript
@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [], // 动态添加
    providers: [{ provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options }],
    configuration: (config) => {
        if (CjkPlugin.options.alipay) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                alipayPaymentHandler,
            ];
        }
        if (CjkPlugin.options.wechatpay) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                wechatpayPaymentHandler,
            ];
        }
        return config;
    },
    compatibility: '^3.0.0',
})
```

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add Alipay payment integration"
```

---

### Task 6: 微信支付模块

**Files:**
- Create: `packages/cjk-plugin/src/payment/wechatpay/types.ts`
- Create: `packages/cjk-plugin/src/payment/wechatpay/wechatpay-handler.ts`
- Create: `packages/cjk-plugin/src/payment/wechatpay/wechatpay.controller.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`
- Modify: `packages/cjk-plugin/package.json`

- [ ] **Step 1: 添加 wechatpay-node-v3 依赖**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install wechatpay-node-v3 --save`

- [ ] **Step 2: 创建 types.ts**

```typescript
export interface WechatPayConfig {
    appId: string;
    mchId: string;
    apiKey: string;
    certPath?: string;
    notifyUrl?: string;
    tradeType?: 'JSAPI' | 'NATIVE' | 'APP';
}
```

- [ ] **Step 3: 创建 wechatpay-handler.ts**

```typescript
import { ConfigArgs, LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';

import { loggerCtx } from '../../constants';
import { WechatPayConfig } from './types';

export const wechatpayPaymentHandler = new PaymentMethodHandler({
    code: 'wechatpay',
    description: [{ languageCode: LanguageCode.zh_Hans, value: '微信支付' }],
    args: {
        tradeType: {
            type: 'string',
            defaultValue: 'NATIVE',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '交易类型' }],
        },
    },
    createPayment: async (ctx, order, amount, args, metadata, method) => {
        try {
            const WxPay = await import('wechatpay-node-v3');
            const config: WechatPayConfig = method.customFields?.wechatpayConfig || {};
            const pay = new WxPay.default({
                appid: config.appId,
                mchid: config.mchId,
                publicKey: Buffer.from(''),
                privateKey: config.apiKey,
            });

            const tradeType = args.tradeType || config.tradeType || 'NATIVE';
            const result = await pay.transactions_native({
                description: `订单 ${order.code}`,
                out_trade_no: order.code,
                notify_url: config.notifyUrl,
                amount: {
                    total: Math.round(amount / 100),
                    currency: 'CNY',
                },
            });

            return {
                amount,
                state: 'Authorized' as const,
                transactionId: order.code,
                metadata: {
                    codeUrl: result.code_url,
                    tradeType,
                },
            };
        } catch (e: any) {
            Logger.error(`WeChat Pay createPayment failed: ${e.message}`, loggerCtx);
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: e.message,
                metadata: {},
            };
        }
    },
    settlePayment: async (ctx, order, payment, args, method) => {
        return { success: true };
    },
    createRefund: async (ctx, input, amount, order, payment, args, method) => {
        try {
            const WxPay = await import('wechatpay-node-v3');
            const config: WechatPayConfig = method.customFields?.wechatpayConfig || {};
            const pay = new WxPay.default({
                appid: config.appId,
                mchid: config.mchId,
                publicKey: Buffer.from(''),
                privateKey: config.apiKey,
            });

            const result = await pay.refunds({
                out_trade_no: order.code,
                out_refund_no: `refund_${order.code}`,
                amount: {
                    refund: Math.round(amount / 100),
                    total: Math.round(payment.amount / 100),
                    currency: 'CNY',
                },
            });

            return {
                state: 'Settled' as const,
                transactionId: payment.transactionId,
                metadata: result,
            };
        } catch (e: any) {
            Logger.error(`WeChat Pay refund failed: ${e.message}`, loggerCtx);
            return {
                state: 'Failed' as const,
                metadata: { error: e.message },
            };
        }
    },
});
```

- [ ] **Step 4: 创建 wechatpay.controller.ts**

```typescript
import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Request, Response } from 'express';

import { loggerCtx } from '../../constants';

@Controller('cjk/wechatpay')
export class WechatpayController {
    constructor() {}

    @Post('notify')
    async notify(@Body() body: any, @Req() req: Request, @Res() res: Response): Promise<void> {
        try {
            const { event_type, resource } = body;
            if (event_type === 'TRANSACTION.SUCCESS') {
                const outTradeNo = resource?.ciphertext?.out_trade_no;
                Logger.info(`WeChat Pay payment settled: ${outTradeNo}`, loggerCtx);
            }
            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        } catch (e: any) {
            Logger.error(`WeChat Pay notify error: ${e.message}`, loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
}
```

- [ ] **Step 5: 修改 plugin.ts 集成微信支付**

在 `VendurePlugin` 装饰器中添加 WechatpayController，在 `configuration` 中注册 handler。

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add WeChat Pay integration"
```

---

### Task 7: 阿里云 OSS 存储模块

**Files:**
- Create: `packages/cjk-plugin/src/storage/oss-strategy.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`
- Modify: `packages/cjk-plugin/package.json`

- [ ] **Step 1: 添加 ali-oss 依赖**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install ali-oss --save && npm install @types/ali-oss --save-dev`

- [ ] **Step 2: 创建 oss-strategy.ts**

```typescript
import { AssetStorageStrategy, Logger } from '@vendure/core';
import { Stream } from 'stream';

import { loggerCtx } from '../constants';
import { CjkPluginOssOptions } from '../types';

export class OssAssetStorageStrategy implements AssetStorageStrategy {
    private client: any;
    private bucket: string;
    private publicPath?: string;

    constructor(options: CjkPluginOssOptions) {
        this.bucket = options.bucket;
        this.publicPath = options.publicPath;
    }

    async init(options: CjkPluginOssOptions): Promise<void> {
        const OSS = (await import('ali-oss')).default;
        this.client = new OSS({
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            bucket: options.bucket,
            region: options.region,
            endpoint: options.endpoint,
        });
        Logger.info(`Aliyun OSS initialized: bucket=${this.bucket}`, loggerCtx);
    }

    async writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
        const result = await this.client.put(fileName, data);
        return fileName;
    }

    async writeFileFromStream(fileName: string, data: Stream, encoding?: BufferEncoding | null): Promise<string> {
        const result = await this.client.putStream(fileName, data);
        return fileName;
    }

    async readFileToBuffer(identifier: string): Promise<Buffer> {
        const result = await this.client.get(identifier);
        return result.content as Buffer;
    }

    async readFileToStream(identifier: string, encoding?: BufferEncoding | null): Promise<Stream> {
        const result = await this.client.getStream(identifier);
        return result.stream as Stream;
    }

    async deleteFile(identifier: string): Promise<void> {
        await this.client.delete(identifier);
    }

    async fileExists(fileName: string): Promise<boolean> {
        try {
            await this.client.head(fileName);
            return true;
        } catch {
            return false;
        }
    }

    toAbsoluteUrl(request: any, identifier: string): string {
        if (this.publicPath) {
            return `${this.publicPath.replace(/\/$/, '')}/${identifier}`;
        }
        return `https://${this.bucket}.${this.client.options.region}.aliyuncs.com/${identifier}`;
    }
}
```

- [ ] **Step 3: 修改 plugin.ts 集成 OSS**

在 `configuration` 函数中替换 assetStorageStrategy：

```typescript
configuration: async (config) => {
    // ... 支付配置 ...

    if (CjkPlugin.options.oss) {
        const strategy = new OssAssetStorageStrategy(CjkPlugin.options.oss);
        await strategy.init(CjkPlugin.options.oss);
        config.assetOptions.assetStorageStrategy = strategy;
    }

    return config;
},
```

- [ ] **Step 4: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 5: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add Aliyun OSS storage strategy"
```

---

### Task 8: 手机号认证模块

**Files:**
- Create: `packages/cjk-plugin/src/auth/phone-authentication-strategy.ts`
- Create: `packages/cjk-plugin/src/auth/sms.service.ts`
- Create: `packages/cjk-plugin/src/auth/auth.resolver.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`
- Modify: `packages/cjk-plugin/package.json`

- [ ] **Step 1: 添加阿里云短信依赖**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm install @alicloud/dysmsapi20170525 @alicloud/openapi @alicloud/tea-util --save`

- [ ] **Step 2: 创建 sms.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import { loggerCtx } from '../constants';
import { CjkPluginPhoneAuthOptions } from '../types';

@Injectable()
export class SmsService {
    private client: any;
    private signName: string;
    private templateCode: string;
    private codeStore = new Map<string, { code: string; expiresAt: number }>();

    async init(options: CjkPluginPhoneAuthOptions['smsConfig']): Promise<void> {
        if (!options) return;
        const Dysmsapi = await import('@alicloud/dysmsapi20170525');
        const OpenApi = await import('@alicloud/openapi');
        const Util = await import('@alicloud/tea-util');

        const config = new OpenApi.Config({
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            endpoint: 'dysmsapi.aliyuncs.com',
        });
        this.client = new Dysmsapi.default(config);
        this.signName = options.signName;
        this.templateCode = options.templateCode;
    }

    async sendVerificationCode(phoneNumber: string): Promise<boolean> {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        this.codeStore.set(phoneNumber, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });

        if (this.client) {
            try {
                const Dysmsapi = await import('@alicloud/dysmsapi20170525');
                const Util = await import('@alicloud/tea-util');
                const request = new Dysmsapi.SendSmsRequest({
                    phoneNumbers: phoneNumber,
                    signName: this.signName,
                    templateCode: this.templateCode,
                    templateParam: JSON.stringify({ code }),
                });
                const runtime = new Util.RuntimeOptions({});
                await this.client.sendSmsWithOptions(request, runtime);
                Logger.info(`Verification code sent to ${phoneNumber}`, loggerCtx);
            } catch (e: any) {
                Logger.error(`Failed to send SMS: ${e.message}`, loggerCtx);
                return false;
            }
        } else {
            Logger.warn(`SMS client not initialized, code for ${phoneNumber}: ${code}`, loggerCtx);
        }
        return true;
    }

    verifyCode(phoneNumber: string, code: string): boolean {
        const stored = this.codeStore.get(phoneNumber);
        if (!stored) return false;
        if (Date.now() > stored.expiresAt) {
            this.codeStore.delete(phoneNumber);
            return false;
        }
        if (stored.code === code) {
            this.codeStore.delete(phoneNumber);
            return true;
        }
        return false;
    }
}
```

- [ ] **Step 3: 创建 phone-authentication-strategy.ts**

```typescript
import { AuthenticationStrategy, Injector, Logger, User, UserService } from '@vendure/core';
import { Request } from 'express';

import { loggerCtx } from '../constants';
import { SmsService } from './sms.service';

export class PhoneAuthenticationStrategy implements AuthenticationStrategy {
    readonly name = 'phone';
    private smsService: SmsService;

    constructor() {
        this.smsService = new SmsService();
    }

    async init(smsConfig: any): Promise<void> {
        await this.smsService.init(smsConfig);
    }

    defineSecurityHeaders(): string[] {
        return [];
    }

    async authenticate(ctx: any, data: { phoneNumber: string; code: string }): Promise<User | false> {
        const { phoneNumber, code } = data;

        if (!this.smsService.verifyCode(phoneNumber, code)) {
            return false;
        }

        const userService = ctx.injector.get(UserService);
        const users = await userService.findByNativeAuthenticationMethod(phoneNumber);
        if (users.length > 0) {
            return users[0];
        }

        Logger.info(`No existing user for phone ${phoneNumber}, registration required`, loggerCtx);
        return false;
    }
}
```

- [ ] **Step 4: 创建 auth.resolver.ts**

```typescript
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { SmsService } from './sms.service';

@Resolver()
export class PhoneAuthResolver {
    constructor(private smsService: SmsService) {}

    @Mutation()
    async sendVerificationCode(
        @Ctx() ctx: RequestContext,
        @Args('phoneNumber') phoneNumber: string,
    ): Promise<boolean> {
        return this.smsService.sendVerificationCode(phoneNumber);
    }
}
```

- [ ] **Step 5: 修改 plugin.ts 集成手机号认证**

在 `VendurePlugin` 中添加 `shopApiExtensions`、`providers`，在 `configuration` 中注册 `AuthenticationStrategy`：

```typescript
import gql from 'graphql-tag';

// 在 VendurePlugin 装饰器中添加
shopApiExtensions: {
    schema: gql`
        extend type Mutation {
            sendVerificationCode(phoneNumber: String!): Boolean!
        }
    `,
    resolvers: [PhoneAuthResolver],
},
providers: [SmsService],
```

在 `configuration` 中：

```typescript
if (CjkPlugin.options.phoneAuth?.enabled) {
    const phoneStrategy = new PhoneAuthenticationStrategy();
    config.authOptions.shopAuthenticationStrategy = [
        ...(config.authOptions.shopAuthenticationStrategy || []),
        phoneStrategy,
    ];
}
```

在 `onApplicationBootstrap` 中初始化：

```typescript
if (this.options.phoneAuth?.enabled) {
    const phoneStrategy = new PhoneAuthenticationStrategy();
    await phoneStrategy.init(this.options.phoneAuth.smsConfig);
}
```

- [ ] **Step 6: 构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 7: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): add phone authentication with SMS verification"
```

---

### Task 9: 更新 index.ts 导出

**Files:**
- Modify: `packages/cjk-plugin/index.ts`

- [ ] **Step 1: 更新导出**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export { alipayPaymentHandler } from './src/payment/alipay/alipay-handler';
export { wechatpayPaymentHandler } from './src/payment/wechatpay/wechatpay-handler';
export { OssAssetStorageStrategy } from './src/storage/oss-strategy';
export { PhoneAuthenticationStrategy } from './src/auth/phone-authentication-strategy';
export { SmsService } from './src/auth/sms.service';
```

- [ ] **Step 2: 最终构建验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 构建成功，无错误

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/
git commit -m "feat(cjk-plugin): finalize exports and build"
```
