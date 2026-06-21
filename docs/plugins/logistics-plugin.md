# LogisticsPlugin

物流配送增强插件，为中国电商场景提供多仓库存分配和配送策略支持。

## 概述

`LogisticsPlugin` 针对 Vendure 默认的库存分配和配送机制进行增强，支持按渠道（Channel）配置不同的配送策略，包括优先级配送、最近仓库配送和库存优先配送。插件替换了 Vendure 默认的 `StockAllocationStrategy`，改为按渠道策略分配库存。

## 安装

```bash
yarn add @vendure/logistics-plugin
```

或

```bash
npm install @vendure/logistics-plugin
```

## 配置

在 `vendure-config.ts` 中注册插件：

```ts
import { LogisticsPlugin } from '@vendure/logistics-plugin';

const config: VendureConfig = {
  plugins: [
    LogisticsPlugin.init({
      defaultShippingStrategy: 'nearest',
    }),
  ],
};
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultShippingStrategy` | `'priority' \| 'nearest' \| 'stock-first'` | `'priority'` | 默认配送策略 |

### 配送策略说明

| 策略 | 值 | 说明 |
|------|-----|------|
| 优先级配送 | `priority` | 按 Channel 配置的仓库优先级顺序分配库存 |
| 最近仓库配送 | `nearest` | 根据收货地址选择最近的仓库发货 |
| 库存优先配送 | `stock-first` | 优先从库存最充足的仓库发货 |

## 自定义字段

### Channel 自定义字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `shippingStrategy` | `String` | 该渠道的配送策略，覆盖全局默认值 |
| `stockLocationPriority` | `String` | 仓库优先级配置（JSON 格式），如 `["warehouse-1", "warehouse-2"]` |

### Fulfillment 自定义字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `carrierCode` | `String` | 承运商编码，如 `shunfeng`、`yunda`、`zhongtong` |
| `trackingNumber` | `String` | 物流追踪号 |

## 库存分配策略

插件使用 `ChannelStockAllocationStrategy` 替换 Vendure 默认的 `StockAllocationStrategy`：

- 读取当前 Channel 的 `shippingStrategy` 自定义字段，如未设置则使用插件配置的 `defaultShippingStrategy`
- 根据策略从对应的 StockLocation 分配库存
- 如果当前策略所需仓库库存不足，会尝试降级到其他仓库

### 策略执行流程

```
1. 获取当前 Channel 的 shippingStrategy
2. 根据策略选择仓库：
   - priority: 按 stockLocationPriority 顺序
   - nearest: 按收货地址距离排序
   - stock-first: 按库存量降序排序
3. 从选定仓库分配库存
4. 库存不足时尝试降级
```

## GraphQL API 参考

### Admin API

#### 设置渠道配送策略

```graphql
mutation UpdateChannelShippingStrategy {
  updateChannel(
    input: {
      id: "1"
      customFields: {
        shippingStrategy: "nearest"
        stockLocationPriority: "[\"warehouse-bj\",\"warehouse-sh\",\"warehouse-gz\"]"
      }
    }
  ) {
    id
    customFields {
      shippingStrategy
      stockLocationPriority
    }
  }
}
```

#### 查询渠道配送配置

```graphql
query GetChannelLogisticsConfig {
  channel(id: "1") {
    id
    code
    customFields {
      shippingStrategy
      stockLocationPriority
    }
  }
}
```

#### 为履约单设置物流信息

```graphql
mutation SetFulfillmentTracking {
  updateFulfillment(
    input: {
      id: "1"
      customFields: {
        carrierCode: "shunfeng"
        trackingNumber: "SF1234567890"
      }
    }
  ) {
    id
    customFields {
      carrierCode
      trackingNumber
    }
  }
}
```

## 使用示例

### 1. 多渠道不同策略

为不同渠道配置不同的配送策略：

```ts
// 渠道 A：一线城市用最近仓库
// 通过 Admin API 设置 channel A 的 shippingStrategy = "nearest"

// 渠道 B：按固定优先级发货
// 通过 Admin API 设置 channel B 的 shippingStrategy = "priority"
// 并设置 stockLocationPriority = ["warehouse-bj", "warehouse-sh"]
```

### 2. 配合 LogisticsApiPlugin 使用

`LogisticsPlugin` 管理配送策略和物流信息存储，`LogisticsApiPlugin` 提供物流轨迹查询能力。两者可以组合使用：

```ts
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';

const config: VendureConfig = {
  plugins: [
    LogisticsPlugin.init({
      defaultShippingStrategy: 'nearest',
    }),
    LogisticsApiPlugin.init({
      customer: 'your-kuaidi100-customer',
      key: 'your-kuaidi100-key',
    }),
  ],
};
```

### 3. 仓库优先级配置示例

```json
{
  "stockLocationPriority": "[\"warehouse-bj\", \"warehouse-sh\", \"warehouse-gz\", \"warehouse-cd\"]"
}
```

优先从北京仓发货，北京仓无库存时依次尝试上海、广州、成都仓库。

## Dashboard UI 扩展

插件在 Admin Dashboard 的 **Channel 设置页面** 添加配送策略配置区域，包括：

- 配送策略选择（下拉菜单）
- 仓库优先级排序（拖拽列表）

## 注意事项

1. **替换默认策略**：本插件会替换 Vendure 默认的 `StockAllocationStrategy`，如果你已有自定义的库存分配策略，需要评估是否兼容。
2. **最近仓库策略**：`nearest` 策略需要收货地址信息，如果订单没有配送地址，会降级为 `priority` 策略。
3. **仓库优先级格式**：`stockLocationPriority` 字段存储的是 JSON 字符串，值为仓库 ID 数组。确保仓库 ID 与系统中的 StockLocation ID 一致。
4. **数据库迁移**：插件注册后需要运行数据库迁移：
   ```bash
   npx vendure migrate
   ```
5. **多库存位置**：使用本插件前，请确保已在 Vendure 中配置了多个 StockLocation（库存位置），否则策略配置无实际效果。
