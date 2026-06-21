# LogisticsApiPlugin

快递100物流查询插件，对接快递100 API 实现物流轨迹查询和快递公司自动识别。

## 概述

`LogisticsApiPlugin` 集成快递100（kuaidi100）API，为 Vendure 管理后台提供物流轨迹查询和快递公司自动识别功能。管理员可以在履约单详情页直接查看物流追踪信息，无需切换到第三方平台。

## 安装

```bash
yarn add @vendure/logistics-api-plugin
```

或

```bash
npm install @vendure/logistics-api-plugin
```

## 前置准备

1. 注册 [快递100](https://www.kuaidi100.com/) 账号
2. 开通 API 服务，获取 `customer` 和 `key` 参数
3. 确认 API 调用额度满足业务需求

## 配置

在 `vendure-config.ts` 中注册插件：

```ts
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';

const config: VendureConfig = {
  plugins: [
    LogisticsApiPlugin.init({
      customer: 'your-kuaidi100-customer',
      key: 'your-kuaidi100-key',
      cacheTtlMinutes: 30,
    }),
  ],
};
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `customer` | `string` | — | 快递100 customer 参数，从快递100 控制台获取 |
| `key` | `string` | — | 快递100 key 参数，从快递100 控制台获取 |
| `cacheTtlMinutes` | `number` | `30` | 物流查询结果缓存时间（分钟），减少 API 调用次数 |

> **安全提示**：`customer` 和 `key` 属于敏感信息，建议通过环境变量注入，不要硬编码在配置文件中：
> ```ts
> LogisticsApiPlugin.init({
>   customer: process.env.KUAIDI100_CUSTOMER,
>   key: process.env.KUAIDI100_KEY,
>   cacheTtlMinutes: 30,
> }),
> ```

## 自定义字段

### Channel 自定义字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `kuaidi100Customer` | `String` | 渠道级别的快递100 customer，覆盖全局配置 |
| `kuaidi100Key` | `String` | 渠道级别的快递100 key，覆盖全局配置 |

> 通过 Channel 自定义字段，可以为不同渠道配置不同的快递100 账号，实现多租户场景下的隔离。

## GraphQL API 参考

### Query: logisticsTracking

查询物流轨迹信息。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `carrierCode` | `String!` | 是 | 快递公司编码，如 `shunfeng`、`zhongtong`、`yunda` |
| `trackingNumber` | `String!` | 是 | 物流追踪号 |

**返回类型：** `TrackingResult`

| 字段 | 类型 | 说明 |
|------|------|------|
| `carrierCode` | `String` | 快递公司编码 |
| `trackingNumber` | `String` | 物流追踪号 |
| `traces` | `[TraceItem]` | 物流轨迹列表 |

**TraceItem 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `time` | `String` | 时间，如 `2024-01-15 14:30:00` |
| `status` | `String` | 状态描述 |
| `description` | `String` | 详细描述 |

**示例查询：**

```graphql
query TrackLogistics {
  logisticsTracking(
    carrierCode: "shunfeng"
    trackingNumber: "SF1234567890"
  ) {
    carrierCode
    trackingNumber
    traces {
      time
      status
      description
    }
  }
}
```

**示例响应：**

```json
{
  "data": {
    "logisticsTracking": {
      "carrierCode": "shunfeng",
      "trackingNumber": "SF1234567890",
      "traces": [
        {
          "time": "2024-01-15 16:00:00",
          "status": "已签收",
          "description": "快件已签收，签收人：本人"
        },
        {
          "time": "2024-01-15 10:30:00",
          "status": "派送中",
          "description": "快件正在派送中，快递员：张师傅，电话：13800138000"
        },
        {
          "time": "2024-01-14 22:00:00",
          "status": "运输中",
          "description": "快件已到达【北京转运中心】"
        }
      ]
    }
  }
}
```

### Query: detectCarrier

根据物流单号自动识别快递公司。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `trackingNumber` | `String!` | 是 | 物流追踪号 |

**返回类型：** `[CarrierDetectResult]`

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `String` | 快递公司编码 |
| `name` | `String` | 快递公司名称 |

**示例查询：**

```graphql
query DetectCarrier {
  detectCarrier(trackingNumber: "SF1234567890") {
    code
    name
  }
}
```

**示例响应：**

```json
{
  "data": {
    "detectCarrier": [
      {
        "code": "shunfeng",
        "name": "顺丰速运"
      }
    ]
  }
}
```

> 当单号可能对应多家快递公司时，`detectCarrier` 会返回多个结果，需要用户确认。

## 使用示例

### 1. 基本使用

```ts
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';

const config: VendureConfig = {
  plugins: [
    LogisticsApiPlugin.init({
      customer: process.env.KUAIDI100_CUSTOMER!,
      key: process.env.KUAIDI100_KEY!,
      cacheTtlMinutes: 30,
    }),
  ],
};
```

### 2. 多渠道配置

为不同渠道使用不同的快递100 账号：

```graphql
mutation SetChannelKuaidiConfig {
  updateChannelA: updateChannel(
    input: {
      id: "1"
      customFields: {
        kuaidi100Customer: "channel-a-customer"
        kuaidi100Key: "channel-a-key"
      }
    }
  ) {
    id
  }

  updateChannelB: updateChannel(
    input: {
      id: "2"
      customFields: {
        kuaidi100Customer: "channel-b-customer"
        kuaidi100Key: "channel-b-key"
      }
    }
  ) {
    id
  }
}
```

当 Channel 配置了专属的 `kuaidi100Customer` 和 `kuaidi100Key` 时，插件优先使用渠道级别的凭证。

### 3. 配合 LogisticsPlugin 使用

`LogisticsPlugin` 在 Fulfillment 上存储 `carrierCode` 和 `trackingNumber`，可直接用于 `LogisticsApiPlugin` 的查询：

```graphql
query GetFulfillmentTracking {
  fulfillment(id: "1") {
    id
    customFields {
      carrierCode
      trackingNumber
    }
  }
}

# 然后使用返回的 carrierCode 和 trackingNumber 查询物流轨迹
query TrackFulfillment {
  logisticsTracking(
    carrierCode: "shunfeng"
    trackingNumber: "SF1234567890"
  ) {
    traces {
      time
      status
      description
    }
  }
}
```

## Dashboard UI 扩展

插件在 Admin Dashboard 的 **Fulfillment 详情页** 添加物流追踪展示区域：

- 物流轨迹时间线（按时间倒序排列）
- 快递公司信息
- 自动刷新按钮（绕过缓存重新查询）

## 注意事项

1. **API 调用限制**：快递100 API 有调用频率限制，请根据业务量选择合适的套餐。`cacheTtlMinutes` 配置可以有效减少重复查询。
2. **缓存机制**：物流查询结果会在服务端缓存，默认 30 分钟。签收状态的物流信息缓存时间可能更长，因为状态不会再变化。
3. **快递公司编码**：`carrierCode` 使用快递100 定义的标准编码，完整编码列表请参考 [快递100 编码表](https://www.kuaidi100.com/download/api_kuaidi100_hangye_bianma.pdf)。
4. **单号识别**：`detectCarrier` 基于单号规则匹配，部分单号可能对应多家快递公司，需要人工确认。
5. **数据库迁移**：插件注册后需要运行数据库迁移：
   ```bash
   npx vendure migrate
   ```
6. **网络访问**：确保服务器可以访问快递100 API 域名 `poll.kuaidi100.com`，如有防火墙需要放行。
