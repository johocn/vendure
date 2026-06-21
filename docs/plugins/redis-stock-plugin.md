# RedisStockPlugin

## 概述

`RedisStockPlugin` 是一个基于 Redis 的库存预扣插件，使用 Redis 原子操作（`DECRBY`/`INCRBY`）实现高并发场景下的库存预扣，防止超卖。

- **包名**：`@vendure/redis-stock-plugin`
- **类名**：`RedisStockPlugin`

### 为什么需要这个插件？

Vendure 默认的库存管理基于数据库，在高并发场景下存在以下问题：

- **超卖风险**：数据库层面的库存扣减在高并发下可能发生竞态条件，导致超卖
- **性能瓶颈**：数据库行锁在高并发读写时成为性能瓶颈
- **响应延迟**：数据库操作延迟较高，无法满足秒杀等场景的极速响应需求

RedisStockPlugin 利用 Redis 的原子操作特性，在内存中完成库存预扣，解决以上问题：

- **原子性**：`DECRBY`/`INCRBY` 是原子操作，天然防止超卖
- **高性能**：Redis 内存操作，响应时间在毫秒级
- **可集成**：与 FlashSalePlugin、GroupBuyPlugin 等秒杀/团购插件无缝集成

---

## 安装

```bash
npm install @vendure/redis-stock-plugin
```

### 前置条件

1. 已安装并运行 Redis 服务（版本 >= 5.0）
2. Redis 服务可从 Vendure 服务器访问

---

## 配置说明

### 配置项

```ts
interface RedisStockPluginOptions {
    redisUrl?: string;     // Redis 连接地址，默认 'redis://localhost:6379'
    keyPrefix?: string;    // Redis 键前缀，默认 'vendure:stock:'
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `redisUrl` | `string` | 否 | `'redis://localhost:6379'` | Redis 连接地址，支持认证：`redis://:password@host:port/db` |
| `keyPrefix` | `string` | 否 | `'vendure:stock:'` | Redis 键前缀，用于隔离不同环境的库存数据 |

### 基础配置

在 `vendure-config.ts` 中添加插件：

```ts
import { VendureConfig } from '@vendure/core';
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';

export const config: VendureConfig = {
    // ...其他配置
    plugins: [
        RedisStockPlugin.init({
            redisUrl: 'redis://localhost:6379',
            keyPrefix: 'vendure:stock:',
        }),
    ],
};
```

### 带认证的 Redis 配置

```ts
RedisStockPlugin.init({
    redisUrl: 'redis://:mypassword@redis.example.com:6379/0',
    keyPrefix: 'prod:stock:',
}),
```

### Channel 自定义字段

插件会为 Channel 添加一个自定义字段 `redisStockEnabled`，允许在 Admin UI 中按渠道启用或禁用 Redis 库存预扣。

- **字段名**：`redisStockEnabled`
- **类型**：`boolean`
- **位置**：Channel 设置页面
- **作用**：控制该渠道是否启用 Redis 库存预扣。未启用时，使用 Vendure 默认的数据库库存管理

---

## 工作原理

### 核心架构

```
用户下单请求
      ↓
检查 Channel.redisStockEnabled
      ↓              ↓
   已启用          未启用
      ↓              ↓
Redis 预扣库存    数据库扣减库存
      ↓
DECRBY 原子操作
      ↓           ↓
  结果 >= 0     结果 < 0（库存不足）
      ↓              ↓
  预扣成功      INCRBY 回滚 → 拒绝下单
      ↓
订单创建成功
      ↓
支付完成 → 确认扣减
超时取消 → INCRBY 释放库存
```

### Redis 键设计

```
{keyPrefix}{variantId}
```

例如，`keyPrefix` 为 `vendure:stock:`，商品变体 ID 为 `123`，则 Redis 键为：

```
vendure:stock:123
```

### 核心服务

#### StockReserveService

库存预扣服务，提供预扣和释放库存的核心能力。

```ts
class StockReserveService {
    /**
     * 预扣库存
     * 使用 Redis DECRBY 原子操作扣减库存
     * 如果扣减后库存 < 0，自动回滚（INCRBY）并返回 false
     *
     * @param key - 库存键（通常是商品变体 ID）
     * @param quantity - 预扣数量
     * @returns 预扣是否成功
     */
    async reserveStock(key: string, quantity: number): Promise<boolean>;

    /**
     * 释放库存
     * 使用 Redis INCRBY 原子操作恢复库存
     * 用于订单取消、超时等场景
     *
     * @param key - 库存键
     * @param quantity - 释放数量
     */
    async releaseStock(key: string, quantity: number): Promise<void>;
}
```

**预扣流程详解**：

1. 执行 `DECRBY key quantity`
2. 检查返回值：
   - `>= 0`：预扣成功，返回 `true`
   - `< 0`：库存不足，执行 `INCRBY key quantity` 回滚，返回 `false`

#### StockPrewarmService

库存预热服务，将数据库中的库存数据同步到 Redis。

```ts
class StockPrewarmService {
    /**
     * 预热库存到 Redis
     * 将指定商品变体的库存数量写入 Redis
     * 通常在活动开始前调用
     *
     * @param key - 库存键（通常是商品变体 ID）
     * @param quantity - 库存数量
     */
    async prewarm(key: string, quantity: number): Promise<void>;
}
```

**预热流程详解**：

1. 从数据库读取商品变体的当前库存
2. 使用 `SET key quantity` 将库存写入 Redis
3. 活动期间，所有库存操作走 Redis

---

## GraphQL API 参考

RedisStockPlugin 不直接扩展 GraphQL API，它通过 Channel 自定义字段和内部服务提供功能。

### 管理 Channel Redis 库存配置

```graphql
mutation EnableRedisStock {
    updateChannel(
        input: {
            id: "T_1"
            customFields: {
                redisStockEnabled: true
            }
        }
    ) {
        ... on Channel {
            id
            code
            customFields {
                redisStockEnabled
            }
        }
    }
}
```

### 查询 Channel 配置

```graphql
query GetChannelStockConfig {
    channel(id: "T_1") {
        id
        code
        customFields {
            redisStockEnabled
        }
    }
}
```

---

## 使用示例

### 场景一：基础秒杀活动

```ts
import { VendureConfig } from '@vendure/core';
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';

export const config: VendureConfig = {
    plugins: [
        RedisStockPlugin.init({
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            keyPrefix: 'vendure:stock:',
        }),
    ],
};
```

在秒杀活动开始前，通过 `StockPrewarmService` 预热库存：

```ts
import { StockPrewarmService } from '@vendure/redis-stock-plugin';

// 在活动开始前调用
async function prewarmFlashSaleStock(variantId: string, stock: number) {
    const prewarmService = app.get(StockPrewarmService);
    await prewarmService.prewarm(variantId, stock);
}

// 例如：商品变体 123 有 100 件库存
await prewarmFlashSaleStock('123', 100);
```

### 场景二：多环境隔离

开发环境和生产环境使用不同的 Redis 键前缀：

```ts
// 开发环境
RedisStockPlugin.init({
    redisUrl: 'redis://localhost:6379',
    keyPrefix: 'dev:stock:',
}),

// 生产环境
RedisStockPlugin.init({
    redisUrl: process.env.REDIS_URL!,
    keyPrefix: 'prod:stock:',
}),
```

### 场景三：手动预扣和释放

在自定义业务逻辑中使用 `StockReserveService`：

```ts
import { StockReserveService } from '@vendure/redis-stock-plugin';

async function handleCustomOrder(variantId: string, quantity: number) {
    const reserveService = app.get(StockReserveService);

    // 预扣库存
    const success = await reserveService.reserveStock(variantId, quantity);
    if (!success) {
        throw new Error('库存不足');
    }

    try {
        // 执行业务逻辑...
        await processOrder();
    } catch (error) {
        // 业务失败，释放库存
        await reserveService.releaseStock(variantId, quantity);
        throw error;
    }
}
```

---

## 与其他插件集成

### 与 FlashSalePlugin 集成

秒杀活动自动使用 Redis 库存预扣。当 `RedisStockPlugin` 和 `FlashSalePlugin` 同时启用时：

1. 秒杀活动开始前，`FlashSalePlugin` 自动调用 `StockPrewarmService.prewarm()` 预热库存
2. 秒杀下单时，自动通过 `StockReserveService.reserveStock()` 预扣库存
3. 秒杀订单取消/超时时，自动通过 `StockReserveService.releaseStock()` 释放库存

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';

export const config: VendureConfig = {
    plugins: [
        RedisStockPlugin.init({
            redisUrl: 'redis://localhost:6379',
        }),
        FlashSalePlugin.init(),
    ],
};
```

### 与 GroupBuyPlugin 集成

团购活动同样自动使用 Redis 库存预扣，集成方式与秒杀类似：

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';

export const config: VendureConfig = {
    plugins: [
        RedisStockPlugin.init({
            redisUrl: 'redis://localhost:6379',
        }),
        GroupBuyPlugin.init(),
    ],
};
```

### 与 OrderTimeoutPlugin 集成

当订单超时取消时，`OrderTimeoutPlugin` 触发订单取消流程，Vendure 自动释放库存。如果启用了 `RedisStockPlugin`，库存释放会同步到 Redis：

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';

export const config: VendureConfig = {
    plugins: [
        RedisStockPlugin.init({ redisUrl: 'redis://localhost:6379' }),
        OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
    ],
};
```

---

## 注意事项

1. **库存预热**：使用 Redis 库存预扣前，必须先通过 `StockPrewarmService.prewarm()` 将库存数据预热到 Redis。如果 Redis 中没有对应的键，`reserveStock()` 会将不存在的键视为 0，预扣将失败。

2. **数据一致性**：Redis 中的库存数据是预扣层面的，最终库存以数据库为准。建议定期同步 Redis 和数据库的库存数据，避免长期运行后出现偏差。

3. **Redis 持久化**：建议开启 Redis 的 RDB 或 AOF 持久化，避免 Redis 重启后库存数据丢失。如果 Redis 重启，需要重新执行库存预热。

4. **键过期策略**：建议为库存键设置合理的过期时间（如活动结束后过期），避免无用数据长期占用 Redis 内存。

5. **Channel 级别控制**：通过 `redisStockEnabled` 自定义字段，可以在渠道级别灵活控制是否启用 Redis 库存预扣。建议仅在需要高并发库存操作的场景（如秒杀、团购）中启用。

6. **并发安全**：Redis 的 `DECRBY` 是原子操作，天然防止并发超卖。但预扣后的回滚检查（`INCRBY`）也是原子操作，整体流程是安全的。

7. **Dashboard UI 扩展**：插件在 Channel 设置页面显示 `redisStockEnabled` 配置项，方便运营人员按渠道启用/禁用 Redis 库存预扣。

8. **Redis 连接**：确保 Vendure 服务器与 Redis 之间的网络连接稳定。生产环境建议使用 Redis 集群或哨兵模式，保证高可用性。
