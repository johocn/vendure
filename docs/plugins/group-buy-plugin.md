# GroupBuyPlugin 团购插件

## 概述

`GroupBuyPlugin` 是 Vendure 的多人团购插件，支持用户发起或参与团购活动，达到目标人数后自动成团。插件内置团长奖励机制，可配置团长折扣与奖励类型，适用于社交电商、社区团购等场景。

**核心特性：**
- 多人团购，达到目标人数自动成团
- 团长奖励机制（折扣/返佣）
- 团购超时自动失效
- 与 RedisStockPlugin 集成，高并发库存预扣
- Dashboard UI 扩展，管理端可视化操作

**包名：** `@vendure/group-buy-plugin`

**类名：** `GroupBuyPlugin`

---

## 安装

```bash
npm install @vendure/group-buy-plugin
```

---

## 配置说明

在 `vendure-config.ts` 中注册插件：

```ts
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';

export const config = {
  // ...
  plugins: [
    GroupBuyPlugin.init({
      defaultTimeoutMinutes: 1440, // 团购超时分钟数，默认 1440（24小时）
    }),
  ],
};
```

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultTimeoutMinutes` | `number` | `1440` | 团购超时分钟数，超时后未成团的订单自动取消 |

---

## 数据模型

### GroupBuyActivity（团购活动）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 活动唯一标识 |
| `name` | `String` | 活动名称 |
| `description` | `String` | 活动描述 |
| `targetCount` | `Int` | 成团目标人数 |
| `currentCount` | `Int` | 当前参团人数 |
| `maxCount` | `Int` | 最大参团人数（可选，限制成团后继续加入） |
| `status` | `GroupBuyStatus` | 活动状态：`active` / `completed` / `expired` |
| `startAt` | `DateTime` | 活动开始时间 |
| `endAt` | `DateTime` | 活动结束时间 |
| `groupPrice` | `Int` | 团购价（分） |
| `leaderDiscount` | `Int` | 团长额外折扣（分） |
| `leaderRewardType` | `String` | 团长奖励类型 |
| `autoConfirm` | `Boolean` | 成团后是否自动确认订单 |
| `allowJoinAfterComplete` | `Boolean` | 成团后是否允许继续加入 |
| `productId` | `ID` | 关联商品 ID |
| `variantId` | `ID` | 关联商品变体 ID |
| `channels` | `Channel[]` | 所属渠道 |

### GroupBuyOrder（团购订单关联）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 记录唯一标识 |
| `groupBuyActivityId` | `ID` | 关联团购活动 ID |
| `orderId` | `ID` | 关联订单 ID |
| `isLeader` | `Boolean` | 是否为团长 |
| `status` | `String` | 参团状态 |

### Order 自定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `groupBuyActivityId` | `ID` | 关联的团购活动 ID |
| `groupBuyOrderId` | `ID` | 关联的团购订单记录 ID |
| `isGroupBuyLeader` | `Boolean` | 当前订单是否为团长订单 |

### 枚举

**GroupBuyStatus：**

| 值 | 说明 |
|----|------|
| `active` | 进行中 |
| `completed` | 已成团 |
| `expired` | 已过期 |

### PromotionCondition

| 条件名 | 说明 |
|--------|------|
| `groupBuyDiscount` | 团购折扣条件，参团用户享受团购价 |
| `groupBuyLeaderReward` | 团长奖励条件，团长享受额外折扣或奖励 |

---

## GraphQL API 参考

### Admin API

#### Query

**查询团购活动列表**

```graphql
query GetGroupBuyActivities($options: GroupBuyActivityListOptions) {
  groupBuyActivities(options: $options) {
    items {
      id
      name
      description
      targetCount
      currentCount
      maxCount
      status
      startAt
      endAt
      groupPrice
      leaderDiscount
      leaderRewardType
      autoConfirm
      allowJoinAfterComplete
      productId
      variantId
    }
    totalItems
  }
}
```

**查询单个团购活动**

```graphql
query GetGroupBuyActivity($id: ID!) {
  groupBuyActivity(id: $id) {
    id
    name
    description
    targetCount
    currentCount
    maxCount
    status
    startAt
    endAt
    groupPrice
    leaderDiscount
    leaderRewardType
    autoConfirm
    allowJoinAfterComplete
    productId
    variantId
  }
}
```

#### Mutation

**创建团购活动**

```graphql
mutation CreateGroupBuyActivity($input: CreateGroupBuyActivityInput!) {
  createGroupBuyActivity(input: $input) {
    id
    name
    status
    targetCount
    groupPrice
  }
}
```

变量示例：

```json
{
  "input": {
    "name": "周末水果团购",
    "description": "新鲜水果5人成团",
    "targetCount": 5,
    "maxCount": 10,
    "startAt": "2026-06-01T00:00:00.000Z",
    "endAt": "2026-06-07T23:59:59.000Z",
    "groupPrice": 2990,
    "leaderDiscount": 500,
    "leaderRewardType": "discount",
    "autoConfirm": true,
    "allowJoinAfterComplete": false,
    "productId": "1",
    "variantId": "1"
  }
}
```

**CreateGroupBuyActivityInput 字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `String!` | 是 | 活动名称 |
| `description` | `String!` | 是 | 活动描述 |
| `targetCount` | `Int!` | 是 | 成团目标人数 |
| `maxCount` | `Int` | 否 | 最大参团人数 |
| `startAt` | `DateTime!` | 是 | 活动开始时间 |
| `endAt` | `DateTime!` | 是 | 活动结束时间 |
| `groupPrice` | `Int!` | 是 | 团购价（分） |
| `leaderDiscount` | `Int` | 否 | 团长额外折扣（分） |
| `leaderRewardType` | `String` | 否 | 团长奖励类型 |
| `autoConfirm` | `Boolean` | 否 | 成团后自动确认 |
| `allowJoinAfterComplete` | `Boolean` | 否 | 成团后是否允许继续加入 |
| `productId` | `ID!` | 是 | 关联商品 ID |
| `variantId` | `ID!` | 是 | 关联商品变体 ID |

**更新团购活动**

```graphql
mutation UpdateGroupBuyActivity($input: UpdateGroupBuyActivityInput!) {
  updateGroupBuyActivity(input: $input) {
    id
    name
    status
  }
}
```

**删除团购活动**

```graphql
mutation DeleteGroupBuyActivity($id: ID!) {
  deleteGroupBuyActivity(id: $id) {
    result
  }
}
```

### Shop API

#### Query

**查询进行中的团购活动**

```graphql
query GetActiveGroupBuyActivities {
  activeGroupBuyActivities {
    id
    name
    description
    targetCount
    currentCount
    groupPrice
    startAt
    endAt
    productId
    variantId
  }
}
```

**查询单个团购活动详情**

```graphql
query GetGroupBuyActivityDetail($id: ID!) {
  groupBuyActivity(id: $id) {
    id
    name
    description
    targetCount
    currentCount
    maxCount
    status
    groupPrice
    leaderDiscount
    startAt
    endAt
    allowJoinAfterComplete
  }
}
```

#### Mutation

**参与团购**

```graphql
mutation JoinGroupBuy($activityId: ID!, $isLeader: Boolean!) {
  joinGroupBuy(activityId: $activityId, isLeader: $isLeader) {
    groupBuyActivityId
    orderId
    isLeader
    status
  }
}
```

变量示例（开团）：

```json
{
  "activityId": "1",
  "isLeader": true
}
```

变量示例（参团）：

```json
{
  "activityId": "1",
  "isLeader": false
}
```

**GroupBuyOrderResult 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `groupBuyActivityId` | `ID` | 关联的团购活动 ID |
| `orderId` | `ID` | 创建的订单 ID |
| `isLeader` | `Boolean` | 是否为团长 |
| `status` | `String` | 参团状态 |

---

## 业务流程详解

### 开团流程

1. **管理员创建团购活动**：通过 Admin API 创建 `GroupBuyActivity`，设置目标人数、团购价、团长奖励等参数
2. **用户开团**：用户调用 `joinGroupBuy(activityId, isLeader: true)`，系统创建订单并标记为团长
3. **分享传播**：团长将团购链接分享给其他用户
4. **其他用户参团**：其他用户调用 `joinGroupBuy(activityId, isLeader: false)` 加入团购
5. **成团判断**：当 `currentCount >= targetCount` 时，团购状态变为 `completed`
6. **订单处理**：
   - 若 `autoConfirm = true`：自动确认所有参团订单
   - 若 `autoConfirm = false`：等待用户手动确认
7. **团长奖励**：根据 `leaderRewardType` 对团长订单应用额外折扣或奖励

### 超时处理

- 团购活动到达 `endAt` 时间后，若 `currentCount < targetCount`，状态变为 `expired`
- 超时未成团的订单自动取消，库存回滚

### 库存控制

- 参团时预扣库存，成团后确认扣减
- 未成团或超时取消时释放预扣库存
- 与 `RedisStockPlugin` 集成时，使用 Redis 进行高并发库存预扣

---

## 与其他插件集成

### RedisStockPlugin 集成

`GroupBuyPlugin` 与 `RedisStockPlugin` 自动集成，在用户参团时使用 Redis 预扣库存，确保高并发场景下库存安全：

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';

export const config = {
  plugins: [
    RedisStockPlugin.init({
      host: 'localhost',
      port: 6379,
    }),
    GroupBuyPlugin.init({
      defaultTimeoutMinutes: 1440,
    }),
  ],
};
```

**集成行为：**
- 参团时通过 Redis 原子操作预扣库存
- 成团后确认库存扣减
- 取消/超时后自动回滚预扣库存
- 无需额外配置，检测到 `RedisStockPlugin` 后自动启用

### Dashboard UI 扩展

插件自动在 Dashboard 中添加团购管理页面，支持：
- 团购活动列表查看与筛选
- 创建/编辑/删除团购活动
- 查看参团详情与团长信息
- 活动状态监控

---

## 注意事项

1. **库存安全**：高并发场景下务必配合 `RedisStockPlugin` 使用，避免超卖
2. **超时设置**：`defaultTimeoutMinutes` 应根据业务场景合理设置，过短影响成团率，过长占用库存
3. **团长奖励**：`leaderRewardType` 需配合 `PromotionCondition` 使用，确保促销规则正确配置
4. **渠道隔离**：团购活动支持多渠道，不同渠道可独立管理活动
5. **订单关联**：团购订单通过 Order 自定义字段关联，查询订单时可据此筛选团购订单
6. **并发参团**：当 `currentCount` 接近 `targetCount` 时，需注意并发参团可能导致超出目标人数，建议设置 `maxCount` 限制
7. **数据迁移**：安装插件后需运行数据库迁移以创建相关表和自定义字段
