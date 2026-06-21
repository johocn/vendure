# Vendure 中国本地化插件集 - 使用手册

基于 Vendure v3.6.x 的中国电商本地化插件集，包含 15 个独立插件包，覆盖支付、物流、认证、营销等核心场景。

## 插件列表

### 核心基础

| 插件 | 包名 | 说明 |
|------|------|------|
| [CJK 本地化](./cjk-plugin.md) | `@vendure/cjk-plugin` | 中日韩国际化、区域数据、货到付款、门店自提、优惠券叠加、多租户 |
| [手机认证](./phone-auth-plugin.md) | `@vendure/phone-auth-plugin` | 手机号+验证码登录，阿里云短信 |
| [微信认证](./wechat-auth-plugin.md) | `@vendure/wechat-auth-plugin` | 微信公众号/小程序 OAuth 登录 |

### 支付

| 插件 | 包名 | 说明 |
|------|------|------|
| [支付宝](./alipay-plugin.md) | `@vendure/alipay-plugin` | 支付宝 PC 页面支付、手机网站支付 |
| [微信支付](./wechatpay-plugin.md) | `@vendure/wechatpay-plugin` | 微信支付 JSAPI/NATIVE/APP/H5 |

### 基础设施

| 插件 | 包名 | 说明 |
|------|------|------|
| [OSS 存储](./oss-plugin.md) | `@vendure/oss-plugin` | 阿里云 OSS 资产存储 |
| [订单超时](./order-timeout-plugin.md) | `@vendure/order-timeout-plugin` | 超时未支付自动取消订单 |
| [Redis 库存](./redis-stock-plugin.md) | `@vendure/redis-stock-plugin` | Redis 原子操作库存预扣，防超卖 |

### 业务功能

| 插件 | 包名 | 说明 |
|------|------|------|
| [发票管理](./invoice-plugin.md) | `@vendure/invoice-plugin` | 订单发票需求标记 |
| [物流配送](./logistics-plugin.md) | `@vendure/logistics-plugin` | 多仓配送策略、库存分配 |
| [物流查询](./logistics-api-plugin.md) | `@vendure/logistics-api-plugin` | 快递100 物流轨迹查询 |
| [发票 PDF](./invoice-pdf-plugin.md) | `@vendure/invoice-pdf-plugin` | 生成中国税务发票 PDF |

### 营销

| 插件 | 包名 | 说明 |
|------|------|------|
| [团购](./group-buy-plugin.md) | `@vendure/group-buy-plugin` | 多人团购，团长奖励 |
| [秒杀](./flash-sale-plugin.md) | `@vendure/flash-sale-plugin` | 限时秒杀，高并发库存控制 |
| [分销](./distribution-plugin.md) | `@vendure/distribution-plugin` | 多级分销，佣金结算，提现管理 |

## 快速开始

### 1. 安装

所有插件位于 `packages/` 目录下，作为 monorepo 工作区包管理：

```bash
# 在 vendure 根目录
lerna bootstrap
```

### 2. 注册插件

在 `vendure-config.ts` 中注册所需插件：

```typescript
import { CjkPlugin } from '@vendure/cjk-plugin';
import { AlipayPlugin } from '@vendure/alipay-plugin';
import { WechatpayPlugin } from '@vendure/wechatpay-plugin';
import { OssPlugin } from '@vendure/oss-plugin';
import { PhoneAuthPlugin } from '@vendure/phone-auth-plugin';
import { WechatAuthPlugin } from '@vendure/wechat-auth-plugin';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';
import { InvoicePlugin } from '@vendure/invoice-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';
import { DistributionPlugin } from '@vendure/distribution-plugin';
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';

export const config = {
    // ...
    plugins: [
        // 核心
        CjkPlugin.init({
            i18n: { enabled: true, languages: ['zh_Hans'] },
            regions: { enabled: true, countries: ['CN'] },
            cod: { enabled: true },
            storePickup: { enabled: true },
            promotionPolicy: { enabled: true, defaultStackable: true, maxStackableCount: 3 },
        }),

        // 认证
        PhoneAuthPlugin.init({
            accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
            accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
            signName: '我的商城',
            templateCode: 'SMS_123456',
        }),
        WechatAuthPlugin.init({
            appId: process.env.WECHAT_APP_ID!,
            appSecret: process.env.WECHAT_APP_SECRET!,
        }),

        // 支付
        AlipayPlugin.init({
            notifyUrl: 'https://api.example.com/alipay/notify',
            alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
        }),
        WechatpayPlugin.init({
            notifyUrl: 'https://api.example.com/wechatpay/notify',
        }),

        // 基础设施
        OssPlugin.init({
            region: 'oss-cn-hangzhou',
            accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
            accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
            bucket: 'my-vendure-assets',
            customDomain: 'cdn.example.com',
        }),
        OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
        RedisStockPlugin.init({ redisUrl: 'redis://localhost:6379' }),

        // 业务功能
        InvoicePlugin.init({ enabledTypes: ['ordinary', 'electronic'] }),
        LogisticsPlugin.init({ defaultShippingStrategy: 'priority' }),
        LogisticsApiPlugin.init({
            customer: process.env.KUAIDI100_CUSTOMER!,
            key: process.env.KUAIDI100_KEY!,
        }),
        InvoicePdfPlugin.init({ storagePath: './invoices' }),

        // 营销
        GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
        FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
        DistributionPlugin.init({
            defaultDirectRate: 1000,
            defaultIndirectRate: 500,
            minWithdrawalAmount: 10000,
            settlementDays: 7,
        }),
    ],
};
```

### 3. 条件注册（推荐）

生产环境与开发环境可能需要不同的插件配置：

```typescript
plugins: [
    CjkPlugin.init({ /* ... */ }),
    // 仅在有 Redis 时启用
    ...(process.env.REDIS_URL ? [RedisStockPlugin.init({ redisUrl: process.env.REDIS_URL })] : []),
    // 仅在有阿里云配置时启用
    ...(process.env.OSS_ACCESS_KEY_ID ? [OssPlugin.init({ /* ... */ })] : []),
],
```

## 插件依赖关系

```
CjkPlugin (核心，推荐首先安装)
├── PhoneAuthPlugin (独立)
├── WechatAuthPlugin (独立)
├── AlipayPlugin (独立)
├── WechatpayPlugin (独立)
├── OssPlugin (独立)
├── OrderTimeoutPlugin (独立)
├── RedisStockPlugin (独立，被 FlashSale/GroupBuy 可选依赖)
├── InvoicePlugin (独立)
├── LogisticsPlugin (独立)
├── LogisticsApiPlugin (独立)
├── InvoicePdfPlugin (依赖 InvoicePlugin)
├── GroupBuyPlugin (可选依赖 RedisStockPlugin)
├── FlashSalePlugin (可选依赖 RedisStockPlugin)
└── DistributionPlugin (独立)
```

## 环境变量参考

| 变量 | 用途 | 必需插件 |
|------|------|----------|
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AK | PhoneAuthPlugin |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 SK | PhoneAuthPlugin |
| `WECHAT_APP_ID` | 微信 AppID | WechatAuthPlugin |
| `WECHAT_APP_SECRET` | 微信 AppSecret | WechatAuthPlugin |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥 | AlipayPlugin |
| `REDIS_URL` | Redis 连接 | RedisStockPlugin |
| `OSS_ACCESS_KEY_ID` | OSS AK | OssPlugin |
| `OSS_ACCESS_KEY_SECRET` | OSS SK | OssPlugin |
| `KUAIDI100_CUSTOMER` | 快递100 客户参数 | LogisticsApiPlugin |
| `KUAIDI100_KEY` | 快递100 密钥 | LogisticsApiPlugin |

## 兼容性

- Vendure: ^3.0.0（主要在 v3.6.x 上开发和测试）
- Node.js: >= 18
- 数据库: SQLite（开发）/ MySQL / PostgreSQL
