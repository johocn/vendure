# Vendure CJK Plugin 设计文档（v2 - 评审修订版）

## 概述

为 Vendure 提供中国、日本、韩国（CJK）本地化支持。采用**分层插件架构**，核心本地化功能在 `@vendure/cjk-plugin`，支付/存储/认证各自独立插件。支持基于 Channel 的多租户架构，每个租户可独立配置支付方式、配送方式和优惠券叠加策略。

## 评审修订记录

| # | 原方案问题 | 修订 |
|---|-----------|------|
| 1 | 支付配置从 `method.customFields` 读取 | 改为通过 `PaymentMethodHandler.args` 传入 |
| 2 | 支付宝 `pageExec` 返回 HTML 表单 | 区分 `payForm`/`payUrl`，metadata 标记类型 |
| 3 | 优惠券叠加 `order.promotions` 时序 | 已验证可行：`addPromotion` 在 `test` 之后立即调用 |
| 4 | Dashboard i18n 重复创建 | 上游已有 ja/ko/zh_Hans/zh_Hant，删除此 Task |
| 5 | 所有功能耦合在一个插件 | 拆分为 5 个独立包 |
| 6 | Channel CustomFields 冗余 | 删除 `enabledPaymentMethods`/`enabledShippingMethods` |
| 7 | 门店数据仅通过配置注入 | 创建 `PickupLocation` 自定义实体持久化 |
| 8 | 省市区只有省级数据 | 补充完整三级联动数据 |

## 插件架构

```
packages/
├── cjk-plugin/                  # 核心：i18n + 地区 + 优惠券策略 + 多租户 + 门店实体
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       ├── i18n/
│       │   ├── zh_CN.json
│       │   ├── zh_TW.json
│       │   ├── ja.json
│       │   └── ko.json
│       ├── regions/
│       │   ├── china.ts         # 省/市/区三级
│       │   ├── japan.ts
│       │   ├── korea.ts
│       │   └── region-populator.ts
│       ├── promotion/
│       │   ├── promotion-custom-fields.ts
│       │   └── coupon-stackable-condition.ts
│       ├── tenant/
│       │   ├── tenant-channel-custom-fields.ts
│       │   └── tenant-setup.service.ts
│       ├── pickup/
│       │   ├── pickup-location.entity.ts
│       │   ├── pickup-eligibility-checker.ts
│       │   ├── pickup-calculator.ts
│       │   ├── pickup-fulfillment-handler.ts
│       │   └── pickup-admin.resolver.ts
│       └── payment/
│           └── cod-handler.ts   # 货到付款（无外部依赖）
│
├── alipay-plugin/               # 支付宝独立插件
│   └── src/
│       ├── plugin.ts
│       ├── alipay-handler.ts
│       ├── alipay.controller.ts
│       └── types.ts
│
├── wechatpay-plugin/            # 微信支付独立插件
│   └── src/
│       ├── plugin.ts
│       ├── wechatpay-handler.ts
│       ├── wechatpay.controller.ts
│       └── types.ts
│
├── oss-plugin/                  # 阿里云 OSS 独立插件
│   └── src/
│       ├── plugin.ts
│       └── oss-strategy.ts
│
└── phone-auth-plugin/           # 手机号认证独立插件
    └── src/
        ├── plugin.ts
        ├── phone-authentication-strategy.ts
        ├── sms.service.ts
        └── auth.resolver.ts
│
└── wechat-auth-plugin/          # 微信登录独立插件
    └── src/
        ├── plugin.ts
        ├── wechat-auth-strategy.ts
        ├── wechat-auth.controller.ts
        └── types.ts
```

## 配置接口

### cjk-plugin

```typescript
interface CjkPluginOptions {
  i18n?: {
    enabled?: boolean;
    languages?: LanguageCode[];
  };
  regions?: {
    enabled?: boolean;
    countries?: ('CN' | 'JP' | 'KR')[];
  };
  cod?: {
    enabled?: boolean;
  };
  storePickup?: {
    enabled?: boolean;
  };
  pickupPoint?: {
    enabled?: boolean;
    shippingPrice?: number;
  };
  tenant?: {
    enabled?: boolean;
    defaultPaymentMethods?: string[];
    defaultShippingMethods?: string[];
    defaultPromotionPolicies?: TenantPromotionPolicy;
  };
  promotionPolicy?: {
    enabled?: boolean;
    defaultStackable?: boolean;
    maxStackableCount?: number;
  };
}
```

### alipay-plugin

```typescript
interface AlipayPluginOptions {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway?: string;
  notifyUrl?: string;
  returnUrl?: string;
  signType?: 'RSA2';
}
```

### wechatpay-plugin

```typescript
interface WechatPayPluginOptions {
  appId: string;
  mchId: string;
  apiKey: string;
  certPath?: string;
  notifyUrl?: string;
  tradeType?: 'JSAPI' | 'NATIVE' | 'APP';
}
```

### oss-plugin

```typescript
interface OssPluginOptions {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint?: string;
  publicPath?: string;
}
```

### phone-auth-plugin

```typescript
interface PhoneAuthPluginOptions {
  smsProvider?: 'aliyun';
  smsConfig?: {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
  };
}
```

## 使用方式

```typescript
import { CjkPlugin } from '@vendure/cjk-plugin';
import { AlipayPlugin } from '@vendure/alipay-plugin';
import { WechatPayPlugin } from '@vendure/wechatpay-plugin';
import { OssPlugin } from '@vendure/oss-plugin';
import { PhoneAuthPlugin } from '@vendure/phone-auth-plugin';

const config: VendureConfig = {
  defaultLanguageCode: LanguageCode.zh_Hans,
  plugins: [
    CjkPlugin.init({
      i18n: { enabled: true },
      regions: { enabled: true },
      cod: { enabled: true },
      storePickup: { enabled: true },
      tenant: { enabled: true },
      promotionPolicy: { enabled: true },
    }),
    AlipayPlugin.init({
      appId: process.env.ALIPAY_APP_ID!,
      privateKey: process.env.ALIPAY_PRIVATE_KEY!,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
      notifyUrl: 'https://your-domain.com/alipay/notify',
    }),
    WechatPayPlugin.init({
      appId: process.env.WECHAT_APP_ID!,
      mchId: process.env.WECHAT_MCH_ID!,
      apiKey: process.env.WECHAT_API_KEY!,
      notifyUrl: 'https://your-domain.com/wechatpay/notify',
    }),
    OssPlugin.init({
      accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
      bucket: 'your-bucket',
      region: 'oss-cn-hangzhou',
    }),
    PhoneAuthPlugin.init({
      smsProvider: 'aliyun',
      smsConfig: {
        accessKeyId: process.env.SMS_ACCESS_KEY_ID!,
        accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET!,
        signName: 'your-sign',
        templateCode: 'SMS_123456',
      },
    }),
  ],
};
```

## 模块详细设计

### 1. i18n 模块（cjk-plugin）

基于 i18next，翻译文件结构与 en.json 一致。在 `onApplicationBootstrap` 中通过 `I18nService.addTranslation()` 注册。

Dashboard 翻译已存在于上游 `packages/dashboard/src/i18n/locales/`，无需重复创建。

### 2. 地区数据模块（cjk-plugin）

中国省市区三级联动数据。通过 `RegionPopulator` 在 `onApplicationBootstrap` 中导入 Country + Zone。

### 3. 货到付款（cjk-plugin）

`PaymentMethodHandler`，createPayment 返回 `Authorized`，无外部依赖。

### 4. 门店自提/自提点自提（cjk-plugin）

**PickupLocation 自定义实体**：

```typescript
@Entity()
class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
  @Column() name: string;
  @Column() type: 'store' | 'point';
  @Column() address: string;
  @Column({ nullable: true }) phoneNumber: string;
  @Column({ nullable: true }) businessHours: string;
  @Column({ type: 'simple-json', nullable: true }) coordinates: { lat: number; lng: number } | null;
  @Column({ nullable: true }) partner: string;
  @ManyToMany(type => Channel) @JoinTable() channels: Channel[];
  @Column(type => CustomPickupLocationFields) customFields: CustomPickupLocationFields;
}
```

通过 Admin API 管理，支持按 Channel 过滤。

ShippingCalculator/EligibilityChecker/FulfillmentHandler 标准实现。

### 5. 支付宝模块（alipay-plugin）

**关键修正**：配置通过 `PaymentMethodHandler.args` 传入。

```typescript
export const alipayPaymentHandler = new PaymentMethodHandler({
  code: 'alipay',
  description: [{ languageCode: LanguageCode.zh_Hans, value: '支付宝支付' }],
  args: {
    appId: { type: 'string', label: [{ languageCode: LanguageCode.en, value: 'App ID' }] },
    privateKey: { type: 'string', label: [{ languageCode: LanguageCode.en, value: 'Private Key' }] },
    alipayPublicKey: { type: 'string', label: [{ languageCode: LanguageCode.en, value: 'Alipay Public Key' }] },
    tradeType: {
      type: 'string',
      defaultValue: 'PAGE',
      label: [{ languageCode: LanguageCode.en, value: 'Trade Type' }],
      ui: { component: 'select-form-input', options: [{ value: 'PAGE' }, { value: 'WAP' }, { value: 'APP' }] },
    },
  },
  createPayment: async (ctx, order, amount, args, metadata, method) => {
    const AlipaySdk = await import('alipay-sdk');
    const alipaySdk = new AlipaySdk.default({
      appId: args.appId,
      privateKey: args.privateKey,
      alipayPublicKey: args.alipayPublicKey,
      signType: 'RSA2',
    });

    const result = await alipaySdk.pageExec('alipay.trade.page.pay', {
      bizContent: {
        out_trade_no: order.code,
        total_amount: (amount / 100).toFixed(2),
        subject: `订单 ${order.code}`,
        product_code: args.tradeType === 'WAP' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY',
      },
      notify_url: metadata.notifyUrl,
      return_url: metadata.returnUrl,
    });

    return {
      amount,
      state: 'Authorized' as const,
      transactionId: order.code,
      metadata: {
        payForm: result,
        payType: args.tradeType === 'WAP' ? 'wap' : 'page',
      },
    };
  },
  settlePayment: async (ctx, order, payment, args) => {
    return { success: true };
  },
});
```

### 6. 微信支付模块（wechatpay-plugin）

同支付宝，配置通过 `args` 传入。

### 7. 多租户模块（cjk-plugin）

Channel CustomFields 仅保留策略字段（删除冗余的 enabledPaymentMethods/enabledShippingMethods）：

```typescript
export const tenantChannelCustomFields: CustomFields = {
  Channel: [
    { name: 'couponStackable', type: 'boolean', defaultValue: false },
    { name: 'maxStackableCount', type: 'int', nullable: true },
  ],
};
```

支付/配送方式通过 Vendure 内置的 Channel ↔ PaymentMethod/ShippingMethod ManyToMany 关联管理。

TenantSetupService 在创建 Channel 时：
1. 创建 PaymentMethod 实例并关联到 Channel
2. 创建 ShippingMethod 实例并关联到 Channel
3. 创建 Zone（默认税率/配送区域）
4. 设置 Channel CustomFields

### 8. 优惠券叠加策略（cjk-plugin）

**时序验证结果**：`OrderCalculator.applyPromotions` 中，`order.promotions = []` 在开始时清空，但 `addPromotion(order, promotion)` 在每个 Promotion 通过 test 后立即调用。因此后续 Promotion 的 `test` 方法中 `order.promotions` 包含之前已应用的 Promotion。**方案可行**。

Promotion CustomFields：

```typescript
export const promotionCustomFields: CustomFields = {
  Promotion: [
    { name: 'stackable', type: 'boolean', defaultValue: false },
    { name: 'stackableGroup', type: 'string', nullable: true },
    { name: 'maxStackableWith', type: 'int', nullable: true },
  ],
};
```

CouponStackableCondition 读取 `promotion.customFields` 和 `ctx.channel.customFields` 实现三级优先级：

```
优惠券级 > 渠道级 > 全局默认
```

### 9. 阿里云 OSS（oss-plugin）

标准 `AssetStorageStrategy` 实现，独立插件。

### 10. 手机号认证（phone-auth-plugin）

`AuthenticationStrategy` + GraphQL resolver，独立插件。

### 11. 微信登录（wechat-auth-plugin）

支持两种场景：
- **公众号扫码登录**：PC 端，用户扫码后通过 `code` 换取 `access_token` + `openid`
- **小程序授权登录**：移动端，用户授权后通过 `code` 换取 `openid` + `session_key`

```typescript
interface WechatAuthPluginOptions {
  appId: string;
  appSecret: string;
  miniProgramAppId?: string;
  miniProgramAppSecret?: string;
}
```

实现 `AuthenticationStrategy`，name 为 `wechat`：

```typescript
class WechatAuthenticationStrategy implements AuthenticationStrategy {
  readonly name = 'wechat';

  async authenticate(ctx, data: { code: string; type: 'mp' | 'mini' }): Promise<User | false> {
    // 1. 通过 code 换取 access_token + openid
    // 2. 查找或创建 Customer（通过 openid 关联）
    // 3. 返回 User
  }
}
```

需扩展 GraphQL API：
- `wechatAuth(code: String!, type: String!): LoginResult!` — 微信登录
- `wechatMiniProgramLogin(code: String!): LoginResult!` — 小程序登录

**与微信支付联动**：登录时获取的 `openid` 可直接用于 `wechatpay-plugin` 的 JSAPI 支付，通过 Customer CustomFields 存储 openid。

依赖：无（使用 HTTP 请求调用微信 API）

## 国内电商场景覆盖

| 场景 | 覆盖 | 插件 |
|------|------|------|
| 中文/日文/韩文界面 | ✅ | cjk-plugin |
| 支付宝 | ✅ | alipay-plugin |
| 微信支付 | ✅ | wechatpay-plugin |
| 货到付款 | ✅ | cjk-plugin |
| 门店自提 | ✅ | cjk-plugin |
| 自提点自提 | ✅ | cjk-plugin |
| 手机号登录 | ✅ | phone-auth-plugin |
| 省市区三级联动 | ✅ | cjk-plugin |
| 优惠券叠加控制 | ✅ | cjk-plugin |
| 多租户 | ✅ | cjk-plugin |
| 阿里云 OSS | ✅ | oss-plugin |
| 微信登录（OAuth/小程序） | ✅ | wechat-auth-plugin |
| 发票 | ❌ 后续 | - |
| 物流追踪 | ❌ 后续 | - |
| 订单超时自动取消 | ❌ 后续 | - |
| 拼团 | ❌ 后续 | - |
| 秒杀 | ❌ 后续 | - |
| 分销/佣金 | ❌ 后续 | - |

## 后续规划功能（独立子系统）

以下功能与 CJK 本地化正交，各自是独立子系统，后续独立规划为独立插件包：

| 功能 | 复杂度 | 依赖 | 建议包名 |
|------|--------|------|----------|
| 拼团 | 高 | OrderProcess + Promotion + 自定义实体 | `@vendure/group-buy-plugin` |
| 秒杀 | 高 | 库存锁定 + 时间窗口 + 高并发 | `@vendure/flash-sale-plugin` |
| 物流追踪 | 中 | FulfillmentHandler + 第三方 API | `@vendure/logistics-plugin` |
| 分销/佣金 | 高 | 自定义实体 + 结算系统 | `@vendure/distribution-plugin` |
| 发票 | 中 | Order CustomFields + PDF 生成 | `@vendure/invoice-plugin` |
| 订单超时自动取消 | 低 | JobQueue + OrderProcess | `@vendure/order-timeout-plugin` |

**架构预留**：当前 cjk-plugin 的插件架构（分层独立包 + Channel 多租户 + CustomFields 扩展）已为后续功能提供良好的扩展基础，无需额外预留接口。

**多租户约束**：所有后续功能插件必须遵循 Channel 即租户的多租户方案设计，即：
- 实体必须实现 `ChannelAware` 接口，通过 `channels` ManyToMany 关联实现数据隔离
- 业务逻辑通过 `ctx.channelId` 过滤数据，确保租户间不泄露
- 配置通过 Channel CustomFields 或 PaymentMethodHandler.args 传入，支持渠道级覆盖
- Admin API 按 Channel 权限控制访问

## 实施优先级

| 优先级 | 模块 | 插件 |
|--------|------|------|
| P0 | 核心 i18n + 地区数据 | cjk-plugin |
| P1 | 货到付款 + 门店自提 + 自提点 | cjk-plugin |
| P1 | 支付宝 | alipay-plugin |
| P1 | 微信支付 | wechatpay-plugin |
| P1 | 优惠券叠加 + 多租户 | cjk-plugin |
| P2 | 阿里云 OSS | oss-plugin |
| P2 | 手机号认证 | phone-auth-plugin |
| P2 | 微信登录 | wechat-auth-plugin |

## 风险点

1. **上游 i18n 同步**：核心翻译需跟随 Vendure 版本更新
2. **支付回调安全**：严格验证签名
3. **优惠券叠加时序**：已验证可行，但 `order.promotions` 在每次 `applyPriceAdjustments` 开始时清空，叠加检查仅对当前计算轮次有效
4. **PickupLocation 实体**：自定义实体需正确实现 ChannelAware 接口
5. **微信支付证书**：退款需商户证书
6. **OSS CORS**：需在阿里云控制台配置
