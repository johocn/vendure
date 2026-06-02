# Vendure CJK Plugin 设计文档

## 概述

`@vendure/cjk-plugin` 是一个单体插件，为 Vendure 提供中国、日本、韩国（CJK）本地化支持。通过配置项控制启用哪些模块。

## 核心发现（基于 Vendure v3.x 源码扫描）

| 系统 | 机制 | 现状 |
|------|------|------|
| 核心 i18n | i18next + `packages/core/src/i18n/messages/*.json` | 有 en/de/es/fr/ru/uk，缺 zh/ja/ko |
| LanguageCode 枚举 | `packages/common/src/generated-types.ts` | 已含 `zh`/`zh_Hans`/`zh_Hant`/`ja`/`ko` |
| Dashboard i18n | @lingui/react + `.po` 文件 | 有 ar/bg/cs/de/en/es/fa/fr 等 25 种，缺 zh_Hans/ja/ko |
| PaymentMethodHandler | `createPayment`/`settlePayment`/`createRefund` | 标准扩展接口 |
| AssetStorageStrategy | `writeFileFromBuffer`/`readFileToBuffer`/`toAbsoluteUrl` | 标准扩展接口 |
| VendurePlugin 装饰器 | `configuration` 函数 + `shopApiExtensions`/`adminApiExtensions` | 标准插件模式 |

## 插件结构

```
packages/cjk-plugin/
├── src/
│   ├── plugin.ts                          # 主插件入口
│   ├── constants.ts                       # 常量
│   ├── types.ts                           # 类型定义
│   ├── i18n/                              # 核心 i18n 翻译
│   │   ├── zh_CN.json                     # 简体中文
│   │   ├── zh_TW.json                     # 繁体中文
│   │   ├── ja.json                        # 日语
│   │   └── ko.json                        # 韩语
│   ├── dashboard/                         # Dashboard 翻译
│   │   ├── zh_Hans.po                     # 简体中文
│   │   ├── zh_Hant.po                     # 繁体中文
│   │   ├── ja.po                          # 日语
│   │   └── ko.po                          # 韩语
│   ├── regions/                           # 地区数据
│   │   ├── china.ts                       # 中国省市区
│   │   ├── japan.ts                       # 日本都道府县
│   │   └── korea.ts                       # 韩国省市
│   ├── payment/                           # 支付集成
│   │   ├── alipay/
│   │   │   ├── alipay-handler.ts          # 支付宝 PaymentMethodHandler
│   │   │   ├── alipay.controller.ts       # 支付回调 Controller
│   │   │   └── types.ts
│   │   ├── wechatpay/
│   │   │   ├── wechatpay-handler.ts       # 微信支付 PaymentMethodHandler
│   │   │   ├── wechatpay.controller.ts    # 支付回调 Controller
│   │   │   └── types.ts
│   │   └── cod/
│   │       └── cod-handler.ts             # 货到付款 PaymentMethodHandler
│   ├── shipping/                          # 配送方式
│   │   ├── store-pickup/                  # 门店自提
│   │   │   ├── pickup-eligibility-checker.ts
│   │   │   ├── pickup-calculator.ts
│   │   │   └── pickup-fulfillment-handler.ts
│   │   └── pickup-point/                  # 自提点自提
│   │       ├── point-eligibility-checker.ts
│   │       ├── point-calculator.ts
│   │       └── point-fulfillment-handler.ts
│   ├── storage/                           # 云存储
│   │   └── oss-strategy.ts               # 阿里云 OSS AssetStorageStrategy
│   └── auth/                              # 认证扩展
│       └── phone-authentication-strategy.ts  # 手机号认证策略
├── index.ts
├── package.json
└── tsconfig.json
```

## 配置接口

```typescript
interface CjkPluginOptions {
  // i18n 模块
  i18n?: {
    enabled?: boolean;                    // 默认 true
    languages?: LanguageCode[];           // 启用的语言，默认 ['zh_Hans', 'zh_Hant', 'ja', 'ko']
  };

  // 地区数据模块
  regions?: {
    enabled?: boolean;                    // 默认 true
    countries?: ('CN' | 'JP' | 'KR')[];   // 启用的国家，默认全部
  };

  // 支付宝模块
  alipay?: {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    gateway?: 'https://openapi.alipay.com/gateway.do';  // 默认正式网关
    notifyUrl?: string;                   // 异步通知地址
    returnUrl?: string;                   // 同步跳转地址
    signType?: 'RSA2';                    // 默认 RSA2
  };

  // 微信支付模块
  wechatpay?: {
    appId: string;
    mchId: string;
    apiKey: string;
    certPath?: string;                    // 证书路径（退款需要）
    notifyUrl?: string;                   // 支付回调地址
    tradeType?: 'JSAPI' | 'NATIVE' | 'APP';  // 默认 NATIVE
  };

  // 货到付款
  cod?: {
    enabled?: boolean;                    // 默认 false
  };

  // 门店自提
  storePickup?: {
    enabled?: boolean;                    // 默认 false
    stores?: PickupStore[];               // 门店列表
  };

  // 自提点自提
  pickupPoint?: {
    enabled?: boolean;                    // 默认 false
    points?: PickupPoint[];               // 自提点列表
  };

  // 阿里云 OSS 存储
  oss?: {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region: string;                       // 如 'oss-cn-hangzhou'
    endpoint?: string;
    publicPath?: string;                  // CDN 域名
  };

  // 手机号认证
  phoneAuth?: {
    enabled?: boolean;                    // 默认 false
    smsProvider?: 'aliyun' | 'tencent';   // 短信服务商
    smsConfig?: {
      accessKeyId: string;
      accessKeySecret: string;
      signName: string;
      templateCode: string;
    };
  };
}
```

## 使用方式

```typescript
import { CjkPlugin } from '@vendure/cjk-plugin';

const config: VendureConfig = {
  defaultLanguageCode: LanguageCode.zh_Hans,
  plugins: [
    CjkPlugin.init({
      i18n: { enabled: true },
      regions: { enabled: true },
      alipay: {
        appId: process.env.ALIPAY_APP_ID!,
        privateKey: process.env.ALIPAY_PRIVATE_KEY!,
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
        notifyUrl: 'https://your-domain.com/cjk/alipay/notify',
      },
      wechatpay: {
        appId: process.env.WECHAT_APP_ID!,
        mchId: process.env.WECHAT_MCH_ID!,
        apiKey: process.env.WECHAT_API_KEY!,
        notifyUrl: 'https://your-domain.com/cjk/wechatpay/notify',
      },
      oss: {
        accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
        bucket: 'your-bucket',
        region: 'oss-cn-hangzhou',
      },
    }),
  ],
};
```

## 模块详细设计

### 1. i18n 模块

**核心翻译（服务端）**：基于 i18next，翻译文件结构与现有 en.json 一致，包含 `error`/`errorResult`/`message` 三个命名空间。

实现方式：在插件 `configuration` 函数中调用 `I18nService.addTranslation()` 注册翻译资源。

```typescript
// plugin.ts configuration 函数
configuration: (config) => {
  if (options.i18n?.enabled !== false) {
    config.plugins = config.plugins || [];
    // 通过 onApplicationBootstrap 注入翻译
  }
  return config;
}

// onApplicationBootstrap 中注入
async onApplicationBootstrap() {
  if (options.i18n?.enabled !== false) {
    const i18nService = this.injector.get(I18nService);
    i18nService.addTranslation('zh_Hans', zhCNTranslations);
    i18nService.addTranslation('zh_Hant', zhTWTranslations);
    i18nService.addTranslation('ja', jaTranslations);
    i18nService.addTranslation('ko', koTranslations);
  }
}
```

**Dashboard 翻译**：`.po` 文件通过 DashboardPlugin 的翻译机制加载。需在插件 `configuration` 中配置 DashboardPlugin 的 `translations` 选项。

### 2. 地区数据模块

在插件 `configuration` 函数中，通过 `config.customFields` 为 `Address` 添加中国省市区字段，并在 `onApplicationBootstrap` 中自动导入中国/日本/韩国的 Country 数据。

中国地区数据结构：
```typescript
interface ChinaRegion {
  code: string;          // 如 'CN-BJ'
  name: string;          // 如 '北京市'
  level: 'province' | 'city' | 'district';
  parent?: string;       // 上级编码
}
```

### 3. 支付宝模块

实现 `PaymentMethodHandler`，支持以下支付场景：

- **电脑网站支付**（Page Pay）：`trade_type = PAGE`
- **手机网站支付**（WAP Pay）：`trade_type = WAP`
- **APP 支付**：`trade_type = APP`

支付流程：
1. 前端调用 `addPaymentToOrder` mutation
2. `createPayment` 调用支付宝 `trade.pay` 接口获取支付表单/URL
3. 返回 `{ state: 'Authorized', metadata: { payUrl } }` 给前端跳转
4. 支付宝异步通知 `/cjk/alipay/notify`，验证签名后调用 `PaymentService.settlePayment()`
5. `settlePayment` 返回 `{ success: true }`

退款流程：
1. Admin 调用 `refundOrder` mutation
2. `createRefund` 调用支付宝 `trade.refund` 接口

依赖：`alipay-sdk`（官方 SDK）

### 4. 微信支付模块

实现 `PaymentMethodHandler`，支持以下支付场景：

- **Native 支付**（扫码支付）：`tradeType = NATIVE`
- **JSAPI 支付**（公众号支付）：`tradeType = JSAPI`
- **APP 支付**：`tradeType = APP`
- **H5 支付**：`tradeType = MWEB`

支付流程：
1. 前端调用 `addPaymentToOrder` mutation
2. `createPayment` 调用微信统一下单接口获取 `code_url`/`prepay_id`
3. 返回 `{ state: 'Authorized', metadata: { codeUrl / prepayId } }` 给前端
4. 微信异步通知 `/cjk/wechatpay/notify`，验证签名后 settle
5. `settlePayment` 返回 `{ success: true }`

依赖：`wechatpay-node-v3`（社区维护 V3 API SDK）

### 5. 阿里云 OSS 模块

实现 `AssetStorageStrategy` 接口：

```typescript
class OssAssetStorageStrategy implements AssetStorageStrategy {
  constructor(private client: OSS, private bucket: string, private publicPath?: string) {}

  async writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
    await this.client.put(fileName, data);
    return fileName;
  }

  toAbsoluteUrl(request: any, identifier: string): string {
    if (this.publicPath) {
      return `${this.publicPath}/${identifier}`;
    }
    return `https://${this.bucket}.${this.client.options.region}.aliyuncs.com/${identifier}`;
  }
  // ... 其他方法
}
```

在插件 `configuration` 中替换 `config.assetOptions.assetStorageStrategy`。

依赖：`ali-oss`

### 6. 手机号认证模块

实现 `AuthenticationStrategy` 接口，支持手机号 + 短信验证码登录/注册。

```typescript
class PhoneAuthenticationStrategy implements AuthenticationStrategy {
  readonly name = 'phone';

  async authenticate(ctx: RequestContext, data: any): Promise<User | false> {
    // 1. 验证手机号和验证码
    // 2. 查找或创建 Customer
    // 3. 返回 User
  }
}
```

需扩展 GraphQL API：
- `sendVerificationCode(phoneNumber: String!): Success!` — 发送验证码
- `authenticate(phoneNumber: String!, code: String!): LoginResult!` — 手机号登录

依赖：`@alicloud/dysmsapi20170525`（阿里云短信 SDK）

### 7. 货到付款模块

实现 `PaymentMethodHandler`，无需对接第三方支付，订单创建时直接标记为已授权，配送完成后手动结算。

```typescript
const codPaymentHandler = new PaymentMethodHandler({
  code: 'cash-on-delivery',
  description: [{ languageCode: LanguageCode.zh_Hans, value: '货到付款' }],
  args: {},
  createPayment: async (ctx, order, amount, args, metadata) => {
    return {
      amount,
      state: 'Authorized',
      transactionId: `COD-${order.code}`,
      metadata: { method: 'cash-on-delivery' },
    };
  },
  settlePayment: async (ctx, order, payment, args) => {
    return { success: true };
  },
});
```

无外部依赖。

### 8. 门店自提模块

实现三个标准扩展：`ShippingEligibilityChecker` + `ShippingCalculator` + `FulfillmentHandler`。

**数据模型**：门店信息通过配置注入，也可通过自定义实体持久化。

```typescript
interface PickupStore {
  id: string;
  name: string;              // 如 '北京朝阳门店'
  address: string;           // 详细地址
  phoneNumber?: string;      // 联系电话
  businessHours?: string;    // 营业时间
  coordinates?: { lat: number; lng: number };
}
```

**ShippingEligibilityChecker**：始终返回 true（任何订单都可自提），或根据门店区域限制。

**ShippingCalculator**：返回 `{ price: 0, taxRate: 0, priceIncludesTax: true }`（免费自提）。

**FulfillmentHandler**：创建履约时记录门店信息，trackingCode 设为门店编号。

```typescript
const storePickupFulfillmentHandler = new FulfillmentHandler({
  code: 'store-pickup',
  description: [{ languageCode: LanguageCode.zh_Hans, value: '门店自提' }],
  args: {
    storeId: { type: 'string', label: [{ languageCode: LanguageCode.zh_Hans, value: '门店编号' }] },
  },
  createFulfillment: async (ctx, orders, lines, args) => {
    return {
      method: '门店自提',
      trackingCode: `PICKUP-${args.storeId}`,
      customFields: { storeId: args.storeId },
    };
  },
});
```

无外部依赖。

### 9. 自提点自提模块

与门店自提结构类似，区别在于自提点通常是第三方物流网点（如菜鸟驿站、丰巢等）。

```typescript
interface PickupPoint {
  id: string;
  name: string;              // 如 '朝阳区菜鸟驿站'
  address: string;
  partner?: string;          // 合作方，如 'cainiao' | 'fengchao'
  phoneNumber?: string;
  businessHours?: string;
  coordinates?: { lat: number; lng: number };
}
```

**ShippingCalculator**：可配置固定费用或免费。

**FulfillmentHandler**：创建履约时记录自提点信息，trackingCode 设为自提点编号。

无外部依赖。

## GraphQL API 扩展

```graphql
# Shop API 扩展
extend type Mutation {
  sendVerificationCode(phoneNumber: String!): Success!
}

# 支付相关（通过 PaymentMethodHandler 的 metadata 传递，无需额外扩展）
```

## 依赖清单

| 依赖 | 用途 | 大小 |
|------|------|------|
| `alipay-sdk` | 支付宝支付 | ~200KB |
| `wechatpay-node-v3` | 微信支付 V3 | ~150KB |
| `ali-oss` | 阿里云 OSS | ~300KB |
| `@alicloud/dysmsapi20170525` | 阿里云短信 | ~100KB |

所有支付和存储依赖为可选（peerDependencies），仅启用对应模块时才需安装。

## 实施优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | 核心 i18n（zh_Hans/zh_Hant/ja/ko） | 基础设施，无依赖 |
| P0 | Dashboard i18n（zh_Hans/ja/ko） | 管理界面必需 |
| P1 | 地区数据（中国省市区） | 地址填写必需 |
| P1 | 支付宝支付 | 中国市场核心 |
| P1 | 微信支付 | 中国市场核心 |
| P1 | 货到付款 | 中国市场常见支付方式 |
| P1 | 门店自提 | O2O 场景必需 |
| P1 | 自提点自提 | 电商标配 |
| P2 | 阿里云 OSS | 生产部署需要 |
| P2 | 手机号认证 | 用户体验优化 |

## 风险点

1. **上游 i18n 同步**：核心翻译文件需跟随 Vendure 版本更新，新增错误码需及时翻译
2. **支付回调安全**：必须严格验证回调签名，防止伪造通知
3. **Dashboard 翻译维护**：.po 文件需跟随 Dashboard 版本更新
4. **微信支付证书**：退款接口需要商户证书，部署时需配置证书路径
5. **OSS 跨域配置**：需在阿里云控制台配置 CORS 规则
6. **货到付款风控**：需配合订单风控策略，避免恶意下单
7. **自提点数据**：门店/自提点信息需通过 API 或配置动态提供，初始版本通过配置注入
