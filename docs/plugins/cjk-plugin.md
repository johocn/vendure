# CJK Plugin

`@vendure/cjk-plugin` 是面向中日韩（CJK）市场的 Vendure 本地化核心插件，提供一站式本地化能力，包括多语言翻译、区域数据填充、货到付款、门店自提、自提点配送、优惠券叠加策略及多租户增强。

## 概述

在 CJK 市场部署 Vendure 时，通常需要处理以下本地化需求：

- **多语言支持**：简体中文、繁体中文、日语、韩语的 UI 翻译
- **区域数据**：中国、日本、韩国的国家和省份/行政区数据
- **本地支付方式**：货到付款（COD）在东亚电商中非常普遍
- **本地配送方式**：门店自提、自提点配送（如便利店取件）
- **促销策略**：优惠券叠加使用，满足东亚市场的促销习惯
- **多租户增强**：为每个租户配置默认支付、配送和促销策略

CJK Plugin 将以上功能模块化，每个模块均可独立启用或禁用，按需引入。

## 安装

```bash
npm install @vendure/cjk-plugin
```

或

```bash
yarn add @vendure/cjk-plugin
```

**兼容性**：要求 `@vendure/core` ^3.0.0

## 配置说明

### 基本用法

```ts
import { CjkPlugin } from '@vendure/cjk-plugin';

const config: VendureConfig = {
  plugins: [
    CjkPlugin.init({
      i18n: { enabled: true, languages: ['zh_Hans'] },
      regions: { enabled: true, countries: ['CN'] },
      cod: { enabled: true },
      storePickup: { enabled: true },
      promotionPolicy: { enabled: true, defaultStackable: true, maxStackableCount: 3 },
    }),
  ],
};
```

### 配置接口

```ts
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
    defaultPromotionPolicies?: {
      couponStackable?: boolean;
      maxStackableCount?: number;
    };
  };
  promotionPolicy?: {
    enabled?: boolean;
    defaultStackable?: boolean;
    maxStackableCount?: number;
  };
}
```

### 配置项详解

#### `i18n` — 国际化

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 i18n 模块 |
| `languages` | `LanguageCode[]` | `['zh_Hans', 'zh_Hant', 'ja', 'ko']` | 要注册的语言列表 |

启用后，插件会自动将对应语言的翻译文件注册到 Vendure 的 i18n 系统中。支持的语言代码：

- `zh_Hans` — 简体中文
- `zh_Hant` — 繁体中文
- `ja` — 日语
- `ko` — 韩语

**示例**：仅启用简体中文和日语

```ts
i18n: {
  enabled: true,
  languages: ['zh_Hans', 'ja'],
}
```

#### `regions` — 区域数据

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用区域数据模块 |
| `countries` | `('CN' \| 'JP' \| 'KR')[]` | `['CN', 'JP', 'KR']` | 要填充的国家列表 |

启用后，插件会在初始化时自动填充所选国家的数据，包括：

- **CN（中国）**：国家信息 + 34 个省级行政区（省、自治区、直辖市、特别行政区）
- **JP（日本）**：国家信息 + 47 个都道府县
- **KR（韩国）**：国家信息 + 17 个广域自治体（特别市、广域市、道、特别自治道等）

**示例**：仅填充中国区域数据

```ts
regions: {
  enabled: true,
  countries: ['CN'],
}
```

#### `cod` — 货到付款

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用货到付款支付方式 |

启用后，插件会注册一个 `cod-payment-handler` 支付处理器，可在 Admin 后台的支付方式配置中选择使用。

货到付款的订单状态流转：

1. 顾客下单选择货到付款
2. 订单直接进入 `PaymentSettled` 状态（无需在线支付）
3. 配送完成后手动确认收款

**示例**：

```ts
cod: {
  enabled: true,
}
```

#### `storePickup` — 门店自提

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用门店自提配送方式 |

启用后，插件会注册一个 `store-pickup-fulfillment-handler` 配送处理器，顾客可以选择到门店自提商品，无需物流配送。

**示例**：

```ts
storePickup: {
  enabled: true,
}
```

#### `pickupPoint` — 自提点配送

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用自提点配送 |
| `shippingPrice` | `number` | `0` | 自提点配送的默认运费（单位与 Channel 货币一致） |

启用后，插件会：

1. 注册 `pickup-point-fulfillment-handler` 配送处理器
2. 添加 `PickupLocation` 实体及对应的 Admin GraphQL API
3. 顾客下单时可选择附近的自提点取件

**示例**：启用自提点并设置运费为 5 元

```ts
pickupPoint: {
  enabled: true,
  shippingPrice: 500, // 注意：Vendure 内部以最小货币单位存储，500 = ¥5.00
}
```

#### `promotionPolicy` — 优惠券叠加策略

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用优惠券叠加策略 |
| `defaultStackable` | `boolean` | `false` | 优惠券是否默认可叠加 |
| `maxStackableCount` | `number` | `1` | 单笔订单最多可叠加的优惠券数量 |

东亚电商市场中，多优惠券叠加是常见需求。启用此模块后，可以控制优惠券的叠加行为。

**示例**：允许最多叠加 3 张优惠券

```ts
promotionPolicy: {
  enabled: true,
  defaultStackable: true,
  maxStackableCount: 3,
}
```

#### `tenant` — 多租户增强

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用多租户增强 |
| `defaultPaymentMethods` | `string[]` | `[]` | 新租户创建时自动配置的支付方式 |
| `defaultShippingMethods` | `string[]` | `[]` | 新租户创建时自动配置的配送方式 |
| `defaultPromotionPolicies.couponStackable` | `boolean` | `false` | 新租户的优惠券默认是否可叠加 |
| `defaultPromotionPolicies.maxStackableCount` | `number` | `1` | 新租户的优惠券最大叠加数 |

启用后，创建新租户（Channel）时会自动按配置初始化支付方式、配送方式和促销策略。

**示例**：

```ts
tenant: {
  enabled: true,
  defaultPaymentMethods: ['cod-payment-handler', 'standard-payment'],
  defaultShippingMethods: ['store-pickup-fulfillment-handler', 'pickup-point-fulfillment-handler'],
  defaultPromotionPolicies: {
    couponStackable: true,
    maxStackableCount: 3,
  },
}
```

## GraphQL API 参考

启用 `pickupPoint` 模块后，插件会在 Admin API 中添加以下类型和操作。

### 类型定义

#### `PickupLocation`

自提点信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID!` | 自提点唯一标识 |
| `name` | `String!` | 自提点名称 |
| `type` | `String!` | 自提点类型（如 `store`、`locker`、`partner`） |
| `address` | `String!` | 自提点地址 |
| `phoneNumber` | `String` | 联系电话 |
| `businessHours` | `String` | 营业时间描述 |
| `coordinates` | `Coordinates` | 经纬度坐标 |
| `partner` | `String` | 合作方名称（如物流公司） |

#### `Coordinates`

| 字段 | 类型 | 说明 |
|------|------|------|
| `latitude` | `Float!` | 纬度 |
| `longitude` | `Float!` | 经度 |

### 查询（Query）

#### `pickupLocations` — 查询自提点列表

获取所有自提点，支持分页和筛选。

```graphql
query GetPickupLocations($options: PickupLocationListOptions) {
  pickupLocations(options: $options) {
    items {
      id
      name
      type
      address
      phoneNumber
      businessHours
      coordinates {
        latitude
        longitude
      }
      partner
    }
    totalItems
  }
}
```

#### `pickupLocation` — 查询单个自提点

根据 ID 获取指定自提点详情。

```graphql
query GetPickupLocation($id: ID!) {
  pickupLocation(id: $id) {
    id
    name
    type
    address
    phoneNumber
    businessHours
    coordinates {
      latitude
      longitude
    }
    partner
  }
}
```

### 变更（Mutation）

#### `createPickupLocation` — 创建自提点

```graphql
mutation CreatePickupLocation($input: CreatePickupLocationInput!) {
  createPickupLocation(input: $input) {
    id
    name
    type
    address
    phoneNumber
    businessHours
    coordinates {
      latitude
      longitude
    }
    partner
  }
}
```

变量示例：

```json
{
  "input": {
    "name": "朝阳便利店自提点",
    "type": "partner",
    "address": "北京市朝阳区建国路88号",
    "phoneNumber": "010-12345678",
    "businessHours": "周一至周日 08:00-22:00",
    "coordinates": {
      "latitude": 39.9042,
      "longitude": 116.4074
    },
    "partner": "顺丰速运"
  }
}
```

#### `updatePickupLocation` — 更新自提点

```graphql
mutation UpdatePickupLocation($input: UpdatePickupLocationInput!) {
  updatePickupLocation(input: $input) {
    id
    name
    type
    address
    phoneNumber
    businessHours
    coordinates {
      latitude
      longitude
    }
    partner
  }
}
```

变量示例：

```json
{
  "input": {
    "id": "1",
    "name": "朝阳便利店自提点（已更新）",
    "businessHours": "周一至周日 09:00-21:00"
  }
}
```

#### `deletePickupLocation` — 删除自提点

```graphql
mutation DeletePickupLocation($id: ID!) {
  deletePickupLocation(id: $id) {
    result
    message
  }
}
```

## 使用示例

### 最小配置（仅中文翻译 + 中国区域数据）

```ts
import { CjkPlugin } from '@vendure/cjk-plugin';

CjkPlugin.init({
  i18n: { enabled: true, languages: ['zh_Hans'] },
  regions: { enabled: true, countries: ['CN'] },
})
```

### 完整配置（面向中国市场）

```ts
import { CjkPlugin } from '@vendure/cjk-plugin';

CjkPlugin.init({
  i18n: { enabled: true, languages: ['zh_Hans'] },
  regions: { enabled: true, countries: ['CN'] },
  cod: { enabled: true },
  storePickup: { enabled: true },
  pickupPoint: { enabled: true, shippingPrice: 500 },
  promotionPolicy: { enabled: true, defaultStackable: true, maxStackableCount: 3 },
  tenant: {
    enabled: true,
    defaultPaymentMethods: ['cod-payment-handler'],
    defaultShippingMethods: ['store-pickup-fulfillment-handler', 'pickup-point-fulfillment-handler'],
    defaultPromotionPolicies: {
      couponStackable: true,
      maxStackableCount: 3,
    },
  },
})
```

### 多国市场配置（中日韩）

```ts
import { CjkPlugin } from '@vendure/cjk-plugin';

CjkPlugin.init({
  i18n: { enabled: true, languages: ['zh_Hans', 'zh_Hant', 'ja', 'ko'] },
  regions: { enabled: true, countries: ['CN', 'JP', 'KR'] },
  cod: { enabled: true },
  storePickup: { enabled: true },
  pickupPoint: { enabled: true, shippingPrice: 0 },
  promotionPolicy: { enabled: true, defaultStackable: true, maxStackableCount: 5 },
})
```

## 注意事项

1. **模块独立性**：各功能模块相互独立，可按需启用。未启用的模块不会注册任何实体、处理器或 API，对性能无影响。

2. **区域数据填充时机**：`regions` 模块在插件初始化时填充数据。如果数据库中已存在对应国家/省份，不会重复创建。但若已有同名但内容不同的数据，需手动处理冲突。

3. **运费单位**：`pickupPoint.shippingPrice` 使用 Vendure 内部的最小货币单位。例如人民币场景下 `500` 表示 ¥5.00，日元场景下 `500` 表示 ¥500。

4. **货到付款风险**：COD 支付方式将订单直接标记为已支付状态，实际收款需在配送环节完成。建议配合订单流程自定义，在配送确认后再进行财务结算。

5. **优惠券叠加**：`promotionPolicy` 模块修改了促销计算逻辑。启用后需验证现有促销规则是否符合预期，特别是已存在的订单级促销与优惠券叠加时的计算顺序。

6. **多租户增强**：`tenant` 模块的 `defaultPaymentMethods` 和 `defaultShippingMethods` 中的值为处理器代码（handler code），需确保对应的支付/配送方式已在系统中注册。

7. **数据库迁移**：启用 `pickupPoint` 模块后会新增 `pickup_location` 表，需运行数据库迁移：

   ```bash
   npx vendure migrate
   ```

8. **语言代码**：`i18n.languages` 中的 `LanguageCode` 需与 Vendure 配置中的 `languageCode` 一致。如果使用了自定义语言代码，需确保翻译文件中包含对应的键值。
