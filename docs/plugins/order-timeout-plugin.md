# OrderTimeoutPlugin

## 概述

`OrderTimeoutPlugin` 是一个订单超时自动取消插件。当订单进入 `ArrangingPayment`（待支付）状态后，如果在指定时间内未完成支付，订单将被自动取消并释放库存。

- **包名**：`@vendure/order-timeout-plugin`
- **类名**：`OrderTimeoutPlugin`

### 为什么需要这个插件？

在电商场景中，用户下单后不支付是常见问题。未支付的订单会占用库存，导致其他用户无法购买。手动取消订单既低效又容易遗漏，OrderTimeoutPlugin 通过自动化的超时取消机制解决这一问题：

- **释放库存**：超时订单自动取消，库存及时释放
- **渠道级配置**：不同渠道可设置不同的超时时间
- **可靠调度**：基于 Vendure JobQueue，确保任务不丢失

---

## 安装

```bash
npm install @vendure/order-timeout-plugin
```

---

## 配置说明

### 配置项

```ts
interface OrderTimeoutPluginOptions {
    defaultTimeoutMinutes?: number; // 默认超时分钟数，默认 30
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `defaultTimeoutMinutes` | `number` | 否 | `30` | 默认超时分钟数，订单进入待支付状态后超过此时间未支付将自动取消 |

### 基础配置

在 `vendure-config.ts` 中添加插件：

```ts
import { VendureConfig } from '@vendure/core';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';

export const config: VendureConfig = {
    // ...其他配置
    plugins: [
        OrderTimeoutPlugin.init({
            defaultTimeoutMinutes: 30,
        }),
    ],
};
```

### Channel 自定义字段

插件会为 Channel 添加一个自定义字段 `orderTimeoutMinutes`，允许在 Admin UI 中按渠道设置不同的超时时间。

- **字段名**：`orderTimeoutMinutes`
- **类型**：`int`
- **位置**：Channel 设置页面
- **作用**：覆盖全局 `defaultTimeoutMinutes` 配置，为特定渠道设置独立的超时时间

优先级：**Channel 自定义字段 > 插件配置的 defaultTimeoutMinutes**

---

## 工作原理

### 核心流程

```
订单进入 ArrangingPayment 状态
            ↓
触发 OrderStateTransitionEvent
            ↓
插件监听事件，创建延迟 Job
            ↓
JobQueue 延迟调度（延迟时间 = 超时分钟数）
            ↓
延迟时间到达，执行 Job
            ↓
检查订单当前状态
        ↓           ↓
  仍在待支付      已支付/已取消
      ↓               ↓
  取消订单         不做处理
```

### 详细说明

1. **事件监听**：插件监听 Vendure 的 `OrderStateTransitionEvent` 事件
2. **触发条件**：当订单状态转为 `ArrangingPayment` 时触发
3. **延迟调度**：通过 Vendure 的 `JobQueue` 创建一个延迟任务，延迟时间由超时配置决定
4. **执行取消**：延迟时间到达后，检查订单是否仍在 `ArrangingPayment` 状态：
   - 如果是，则将订单转为 `Cancelled` 状态
   - 如果不是（已支付或已通过其他方式取消），则不做处理

### 超时时间优先级

```
Channel.orderTimeoutMinutes（如果设置了有效值）
        ↓ 未设置时使用
OrderTimeoutPluginOptions.defaultTimeoutMinutes
        ↓ 未设置时使用
30（分钟）
```

---

## GraphQL API 参考

OrderTimeoutPlugin 不扩展 GraphQL API，它通过 Channel 自定义字段提供配置能力。

### 管理 Channel 超时配置

通过 Admin API 的 `updateChannel` mutation 设置渠道超时时间：

```graphql
mutation UpdateChannelTimeout {
    updateChannel(
        input: {
            id: "T_1"
            customFields: {
                orderTimeoutMinutes: 60
            }
        }
    ) {
        ... on Channel {
            id
            code
            customFields {
                orderTimeoutMinutes
            }
        }
    }
}
```

### 查询 Channel 超时配置

```graphql
query GetChannelTimeout {
    channel(id: "T_1") {
        id
        code
        customFields {
            orderTimeoutMinutes
        }
    }
}
```

---

## 使用示例

### 场景一：全局统一超时

所有渠道使用相同的 30 分钟超时：

```ts
import { VendureConfig } from '@vendure/core';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';

export const config: VendureConfig = {
    plugins: [
        OrderTimeoutPlugin.init({
            defaultTimeoutMinutes: 30,
        }),
    ],
};
```

### 场景二：不同渠道不同超时

主站渠道 30 分钟超时，限时抢购渠道 5 分钟超时：

```ts
// 插件配置设置默认超时
OrderTimeoutPlugin.init({
    defaultTimeoutMinutes: 30,
}),
```

然后在 Admin UI 中，为限时抢购渠道设置 `orderTimeoutMinutes: 5`。

### 场景三：生产环境配置

```ts
import { VendureConfig } from '@vendure/core';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';
import { DefaultJobQueuePlugin } from '@vendure/default-job-queue-plugin';

export const config: VendureConfig = {
    plugins: [
        // OrderTimeoutPlugin 依赖 JobQueue，确保已配置 JobQueue 插件
        DefaultJobQueuePlugin.init(),
        OrderTimeoutPlugin.init({
            defaultTimeoutMinutes: Number(process.env.ORDER_TIMEOUT_MINUTES) || 30,
        }),
    ],
};
```

---

## 与其他插件集成

### 与 JobQueue 插件

OrderTimeoutPlugin 依赖 Vendure 的 `JobQueue` 进行延迟任务调度。确保你的项目中配置了 JobQueue 插件：

```ts
// 开发环境
DefaultJobQueuePlugin.init()

// 生产环境（推荐使用 Redis 或 SQL JobQueue）
SqlJobQueuePlugin.init()
// 或
BullMQJobQueuePlugin.init({ connection: redisConnection })
```

> **重要**：使用基于内存的 `DefaultJobQueuePlugin` 时，服务器重启会导致未执行的延迟任务丢失。生产环境建议使用持久化的 JobQueue 实现。

### 与 RedisStockPlugin 集成

当订单超时取消时，Vendure 会自动触发库存释放逻辑。如果同时使用了 `RedisStockPlugin`，取消订单后 Redis 中的预扣库存也会被释放。

### 与 EmailPlugin 集成

如果需要通知用户订单已超时取消，可以配合 `EmailPlugin` 监听订单取消事件发送邮件：

```ts
EmailPlugin.init({
    handlers: [
        // 在邮件处理器中监听 OrderStateTransitionEvent
        // 当订单从 ArrangingPayment 转为 Cancelled 时发送通知
    ],
}),
```

---

## 注意事项

1. **JobQueue 持久化**：生产环境务必使用持久化的 JobQueue（如 SQL、BullMQ），避免服务器重启导致超时任务丢失。

2. **超时时间设置**：超时时间不宜过短（用户可能正在支付中），也不宜过长（库存被占用影响销售）。建议根据业务场景设置：
   - 普通商品：30 分钟
   - 限时抢购：5-10 分钟
   - 大额订单：60 分钟

3. **并发支付**：在超时取消执行时，如果用户正在支付，可能产生竞态条件。建议在支付流程中增加状态检查，确保订单仍处于待支付状态。

4. **Channel 自定义字段**：`orderTimeoutMinutes` 设置为 `0` 或负数时将被忽略，使用全局默认值。

5. **Dashboard UI 扩展**：插件在 Channel 设置页面显示 `orderTimeoutMinutes` 配置项，方便运营人员按渠道调整超时时间，无需修改代码。

6. **订单状态流转**：插件仅在订单处于 `ArrangingPayment` 状态时触发超时取消。如果订单已流转到其他状态（如 `PaymentSettled`、`Cancelled`），不会重复处理。
