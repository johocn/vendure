# FlashSalePlugin 秒杀插件

## 概述

`FlashSalePlugin` 是 Vendure 的限时秒杀插件，支持高并发场景下的库存控制与每人限购，适用于限时抢购、秒杀活动等电商场景。插件内置 Redis 库存预扣机制，确保高并发下不超卖。

**核心特性：**
- 限时秒杀活动管理
- 高并发库存控制，Redis 预扣库存
- 每人限购数量控制
- 秒杀资格校验
- 与 RedisStockPlugin 自动集成
- Dashboard UI 扩展，管理端可视化操作

**包名：** `@vendure/flash-sale-plugin`

**类名：** `FlashSalePlugin`

---

## 安装

```bash
npm install @vendure/flash-sale-plugin
```

---

## 配置说明

在 `vendure-config.ts` 中注册插件：

```ts
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';

export const config = {
  // ...
  plugins: [
    FlashSalePlugin.init({
      defaultTimeoutMinutes: 30, // 秒杀活动默认超时分钟数
    }),
  ],
};
```

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultTimeoutMinutes` | `number` | `30` | 秒杀活动默认超时分钟数，超时未支付的订单自动取消并释放库存 |

---

## 数据模型

### FlashSaleActivity（秒杀活动）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 活动唯一标识 |
| `name` | `String` | 活动名称 |
| `startAt` | `DateTime` | 活动开始时间 |
| `endAt` | `DateTime` | 活动结束时间 |
| `flashPrice` | `Int` | 秒杀价（分） |
| `totalStock` | `Int` | 秒杀总库存 |
| `soldCount` | `Int` | 已售数量 |
| `limitPerUser` | `Int` | 每人限购数量 |
| `status` | `FlashSaleStatus` | 活动状态：`upcoming` / `active` / `ended` |
| `productId` | `ID` | 关联商品 ID |
| `variantId` | `ID` | 关联商品变体 ID |
| `channels` | `Channel[]` | 所属渠道 |

### Order 自定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `flashSaleActivityId` | `ID` | 关联的秒杀活动 ID |

### 枚举

**FlashSaleStatus：**

| 值 | 说明 |
|----|------|
| `upcoming` | 未开始 |
| `active` | 进行中 |
| `ended` | 已结束 |

### PromotionCondition

| 条件名 | 说明 |
|--------|------|
| `flashSaleDiscount` | 秒杀折扣条件，参与秒杀的用户享受秒杀价 |
| `flashSaleEligibility` | 秒杀资格条件，校验用户是否有限购资格（未超限购数量、活动进行中、有剩余库存） |

---

## GraphQL API 参考

### Admin API

#### Query

**查询秒杀活动列表**

```graphql
query GetFlashSaleActivities($options: FlashSaleActivityListOptions) {
  flashSaleActivities(options: $options) {
    items {
      id
      name
      startAt
      endAt
      flashPrice
      totalStock
      soldCount
      limitPerUser
      status
      productId
      variantId
    }
    totalItems
  }
}
```

**查询单个秒杀活动**

```graphql
query GetFlashSaleActivity($id: ID!) {
  flashSaleActivity(id: $id) {
    id
    name
    startAt
    endAt
    flashPrice
    totalStock
    soldCount
    limitPerUser
    status
    productId
    variantId
  }
}
```

#### Mutation

**创建秒杀活动**

```graphql
mutation CreateFlashSaleActivity($input: CreateFlashSaleActivityInput!) {
  createFlashSaleActivity(input: $input) {
    id
    name
    status
    flashPrice
    totalStock
  }
}
```

变量示例：

```json
{
  "input": {
    "name": "618限时秒杀",
    "startAt": "2026-06-18T00:00:00.000Z",
    "endAt": "2026-06-18T23:59:59.000Z",
    "flashPrice": 990,
    "totalStock": 100,
    "limitPerUser": 1,
    "productId": "1",
    "variantId": "1"
  }
}
```

**CreateFlashSaleActivityInput 字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `String!` | 是 | 活动名称 |
| `startAt` | `DateTime!` | 是 | 活动开始时间 |
| `endAt` | `DateTime!` | 是 | 活动结束时间 |
| `flashPrice` | `Int!` | 是 | 秒杀价（分） |
| `totalStock` | `Int!` | 是 | 秒杀总库存 |
| `limitPerUser` | `Int` | 否 | 每人限购数量 |
| `productId` | `ID!` | 是 | 关联商品 ID |
| `variantId` | `ID!` | 是 | 关联商品变体 ID |

**更新秒杀活动**

```graphql
mutation UpdateFlashSaleActivity($input: UpdateFlashSaleActivityInput!) {
  updateFlashSaleActivity(input: $input) {
    id
    name
    status
  }
}
```

**删除秒杀活动**

```graphql
mutation DeleteFlashSaleActivity($id: ID!) {
  deleteFlashSaleActivity(id: $id) {
    result
  }
}
```

### Shop API

#### Query

**查询进行中的秒杀活动**

```graphql
query GetActiveFlashSaleActivities {
  activeFlashSaleActivities {
    id
    name
    startAt
    endAt
    flashPrice
    totalStock
    soldCount
    limitPerUser
    status
    productId
    variantId
  }
}
```

---

## 业务流程详解

### 秒杀活动创建流程

1. **管理员创建活动**：通过 Admin API 创建 `FlashSaleActivity`，设置秒杀价、库存、限购数量等
2. **活动预热**：活动状态为 `upcoming`，前端可展示预告信息
3. **活动开始**：到达 `startAt` 时间后，状态变为 `active`，用户可参与秒杀

### 秒杀下单流程

1. **用户请求秒杀**：用户在前端点击秒杀按钮
2. **资格校验**：
   - 活动是否在进行中（`status = active`）
   - 是否有剩余库存（`soldCount < totalStock`）
   - 用户是否超过限购数量（`limitPerUser`）
3. **库存预扣**：通过 Redis 原子操作预扣库存，确保高并发下不超卖
4. **创建订单**：生成秒杀订单，标记 `flashSaleActivityId`
5. **支付倒计时**：用户需在 `defaultTimeoutMinutes` 内完成支付
6. **支付成功**：确认库存扣减，订单完成
7. **超时未支付**：自动取消订单，释放预扣库存

### 库存回滚机制

- **订单取消**：用户主动取消订单，释放预扣库存
- **支付超时**：超时未支付自动取消，释放预扣库存
- **活动结束**：活动结束后未售出的预扣库存释放回商品库存

### 限购控制

- `limitPerUser` 限制每个用户可购买的秒杀商品数量
- 通过 `flashSaleEligibility` PromotionCondition 在下单时校验
- 校验逻辑查询该用户在当前活动下的历史订单数量

---

## 与其他插件集成

### RedisStockPlugin 集成

`FlashSalePlugin` 与 `RedisStockPlugin` 自动集成，在秒杀下单时使用 Redis 预扣库存，是高并发秒杀场景的核心保障：

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';

export const config = {
  plugins: [
    RedisStockPlugin.init({
      host: 'localhost',
      port: 6379,
    }),
    FlashSalePlugin.init({
      defaultTimeoutMinutes: 30,
    }),
  ],
};
```

**集成行为：**
- 秒杀下单时通过 Redis 原子操作（DECR）预扣库存
- 支付成功后确认库存扣减
- 取消/超时后自动回滚预扣库存（INCR）
- 无需额外配置，检测到 `RedisStockPlugin` 后自动启用
- 未集成 `RedisStockPlugin` 时回退到数据库级别库存控制，高并发下可能超卖

### Dashboard UI 扩展

插件自动在 Dashboard 中添加秒杀管理页面，支持：
- 秒杀活动列表查看与状态筛选
- 创建/编辑/删除秒杀活动
- 实时库存与销量监控
- 活动状态切换

---

## 注意事项

1. **必须集成 RedisStockPlugin**：秒杀场景高并发特征明显，务必配合 `RedisStockPlugin` 使用，否则数据库级别库存控制无法应对高并发
2. **库存预热**：秒杀活动开始前，建议提前将库存数据加载到 Redis，避免活动开始瞬间的缓存穿透
3. **限购设置**：`limitPerUser` 建议设置为较小值（通常为 1），防止黄牛囤货
4. **活动时间**：秒杀活动时间不宜过长，建议控制在几小时内，避免库存长时间被预扣
5. **超时设置**：`defaultTimeoutMinutes` 建议设置较短（5-30分钟），超时未支付及时释放库存
6. **前端防刷**：建议前端配合按钮防抖、验证码等机制，防止恶意刷单
7. **渠道隔离**：秒杀活动支持多渠道，不同渠道可独立管理活动
8. **数据迁移**：安装插件后需运行数据库迁移以创建相关表和自定义字段
9. **库存同步**：活动结束后需确保 Redis 与数据库库存数据一致，插件会自动处理
