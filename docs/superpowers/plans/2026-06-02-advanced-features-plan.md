# 后续功能增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CJK 本地化插件体系增加 3 个生产级增强插件：Redis 库存预扣、快递100 物流查询、发票 PDF 生成

**Architecture:** 3 个独立插件包，各自通过 VendurePlugin 装饰器注册。RedisStockPlugin 作为可选依赖被 FlashSalePlugin/GroupBuyPlugin 集成；LogisticsApiPlugin 和 InvoicePdfPlugin 独立运行，通过 Dashboard 扩展增强现有 UI。

**Tech Stack:** ioredis（Redis 原子操作）、pdfkit（PDF 生成）、Node.js fetch（快递100 API）、Vendure PluginCommonModule

---

## 文件结构总览

### RedisStockPlugin
- Create: `packages/redis-stock-plugin/package.json`
- Create: `packages/redis-stock-plugin/tsconfig.json`
- Create: `packages/redis-stock-plugin/src/index.ts`
- Create: `packages/redis-stock-plugin/src/plugin.ts`
- Create: `packages/redis-stock-plugin/src/stock-reserve.service.ts`
- Create: `packages/redis-stock-plugin/src/stock-prewarm.service.ts`
- Create: `packages/redis-stock-plugin/src/channel-custom-fields.ts`
- Create: `packages/redis-stock-plugin/src/types.ts`
- Create: `packages/redis-stock-plugin/src/constants.ts`
- Create: `packages/redis-stock-plugin/dashboard/tsconfig.json`
- Create: `packages/redis-stock-plugin/dashboard/index.tsx`
- Create: `packages/redis-stock-plugin/dashboard/channel-detail-forms.tsx`
- Modify: `packages/flash-sale-plugin/src/flash-sale.service.ts` — 集成 Redis 预扣
- Modify: `packages/flash-sale-plugin/src/flash-sale.job.ts` — 活动开始时 prewarm
- Modify: `packages/flash-sale-plugin/src/plugin.ts` — 监听 OrderCancelledEvent
- Modify: `packages/group-buy-plugin/src/group-buy.service.ts` — 集成 Redis 预扣
- Modify: `packages/group-buy-plugin/src/group-buy.job.ts` — 活动开始时 prewarm
- Modify: `packages/group-buy-plugin/src/plugin.ts` — 监听 OrderCancelledEvent
- Modify: `packages/dev-server/dev-config.ts` — 注册 RedisStockPlugin

### LogisticsApiPlugin
- Create: `packages/logistics-api-plugin/package.json`
- Create: `packages/logistics-api-plugin/tsconfig.json`
- Create: `packages/logistics-api-plugin/src/index.ts`
- Create: `packages/logistics-api-plugin/src/plugin.ts`
- Create: `packages/logistics-api-plugin/src/logistics-query.service.ts`
- Create: `packages/logistics-api-plugin/src/logistics-api-admin.resolver.ts`
- Create: `packages/logistics-api-plugin/src/channel-custom-fields.ts`
- Create: `packages/logistics-api-plugin/src/types.ts`
- Create: `packages/logistics-api-plugin/src/constants.ts`
- Create: `packages/logistics-api-plugin/dashboard/tsconfig.json`
- Create: `packages/logistics-api-plugin/dashboard/index.tsx`
- Create: `packages/logistics-api-plugin/dashboard/logistics-tracking-dialog.tsx`
- Modify: `packages/dev-server/dev-config.ts` — 注册 LogisticsApiPlugin

### InvoicePdfPlugin
- Create: `packages/invoice-pdf-plugin/package.json`
- Create: `packages/invoice-pdf-plugin/tsconfig.json`
- Create: `packages/invoice-pdf-plugin/src/index.ts`
- Create: `packages/invoice-pdf-plugin/src/plugin.ts`
- Create: `packages/invoice-pdf-plugin/src/invoice-pdf.service.ts`
- Create: `packages/invoice-pdf-plugin/src/invoice-pdf-admin.resolver.ts`
- Create: `packages/invoice-pdf-plugin/src/templates/ordinary-invoice.ts`
- Create: `packages/invoice-pdf-plugin/src/templates/special-invoice.ts`
- Create: `packages/invoice-pdf-plugin/src/order-custom-fields.ts`
- Create: `packages/invoice-pdf-plugin/src/types.ts`
- Create: `packages/invoice-pdf-plugin/src/constants.ts`
- Create: `packages/invoice-pdf-plugin/dashboard/tsconfig.json`
- Create: `packages/invoice-pdf-plugin/dashboard/index.tsx`
- Create: `packages/invoice-pdf-plugin/dashboard/invoice-block-enhanced.tsx`
- Modify: `packages/dev-server/dev-config.ts` — 注册 InvoicePdfPlugin

---

### Task 1: RedisStockPlugin — 核心服务

**Files:**
- Create: `packages/redis-stock-plugin/package.json`
- Create: `packages/redis-stock-plugin/tsconfig.json`
- Create: `packages/redis-stock-plugin/src/index.ts`
- Create: `packages/redis-stock-plugin/src/constants.ts`
- Create: `packages/redis-stock-plugin/src/types.ts`
- Create: `packages/redis-stock-plugin/src/stock-reserve.service.ts`
- Create: `packages/redis-stock-plugin/src/stock-prewarm.service.ts`
- Create: `packages/redis-stock-plugin/src/channel-custom-fields.ts`
- Create: `packages/redis-stock-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json**

Create `packages/redis-stock-plugin/package.json`:

```json
{
  "name": "@vendure/redis-stock-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "ioredis": "^5.4.1"
  },
  "peerDependencies": {
    "@vendure/core": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

Create `packages/redis-stock-plugin/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 constants.ts**

Create `packages/redis-stock-plugin/src/constants.ts`:

```ts
export const loggerCtx = 'RedisStockPlugin';
export const REDIS_STOCK_PLUGIN_OPTIONS = 'REDIS_STOCK_PLUGIN_OPTIONS';
export const STOCK_KEY_PREFIX = 'stock:';
```

- [ ] **Step 4: 创建 types.ts**

Create `packages/redis-stock-plugin/src/types.ts`:

```ts
export interface RedisStockPluginOptions {
    redisUrl?: string;
    keyPrefix?: string;
}
```

- [ ] **Step 5: 创建 stock-reserve.service.ts**

Create `packages/redis-stock-plugin/src/stock-reserve.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from '@vendure/core';
import Redis from 'ioredis';

import { loggerCtx, STOCK_KEY_PREFIX } from './constants';
import { RedisStockPluginOptions } from './types';

@Injectable()
export class StockReserveService implements OnModuleDestroy {
    private redis: Redis | null = null;
    private keyPrefix: string = STOCK_KEY_PREFIX;

    async init(options: RedisStockPluginOptions): Promise<void> {
        if (!options.redisUrl) {
            Logger.warn('No redisUrl configured, Redis stock reservation disabled', loggerCtx);
            return;
        }
        this.keyPrefix = options.keyPrefix ?? STOCK_KEY_PREFIX;
        this.redis = new Redis(options.redisUrl);
        this.redis.on('error', (err) => {
            Logger.error(`Redis connection error: ${err.message}`, loggerCtx);
        });
        await this.redis.ping();
        Logger.info('RedisStockPlugin connected to Redis', loggerCtx);
    }

    get isAvailable(): boolean {
        return this.redis !== null;
    }

    async reserveStock(key: string, quantity: number): Promise<number> {
        if (!this.redis) return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        const remaining = await this.redis.decrby(fullKey, quantity);
        if (remaining < 0) {
            await this.redis.incrby(fullKey, quantity);
            return remaining;
        }
        return remaining;
    }

    async releaseStock(key: string, quantity: number): Promise<number> {
        if (!this.redis) return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        return this.redis.incrby(fullKey, quantity);
    }

    async getStock(key: string): Promise<number | null> {
        if (!this.redis) return null;
        const fullKey = `${this.keyPrefix}${key}`;
        const val = await this.redis.get(fullKey);
        return val !== null ? parseInt(val, 10) : null;
    }

    onModuleDestroy() {
        if (this.redis) {
            this.redis.disconnect();
        }
    }
}
```

- [ ] **Step 6: 创建 stock-prewarm.service.ts**

Create `packages/redis-stock-plugin/src/stock-prewarm.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import { loggerCtx, STOCK_KEY_PREFIX } from './constants';
import { StockReserveService } from './stock-reserve.service';

@Injectable()
export class StockPrewarmService {
    constructor(private stockReserveService: StockReserveService) {}

    async prewarm(key: string, stock: number): Promise<void> {
        if (!this.stockReserveService.isAvailable) return;
        const fullKey = `${STOCK_KEY_PREFIX}${key}`;
        const { default: Redis } = await import('ioredis');
        const redis = (this.stockReserveService as any).redis;
        if (!redis) return;
        await redis.set(fullKey, stock);
        Logger.info(`Prewarmed stock key ${fullKey} with ${stock}`, loggerCtx);
    }

    async removePrewarm(key: string): Promise<void> {
        if (!this.stockReserveService.isAvailable) return;
        const fullKey = `${STOCK_KEY_PREFIX}${key}`;
        const redis = (this.stockReserveService as any).redis;
        if (!redis) return;
        await redis.del(fullKey);
        Logger.info(`Removed stock key ${fullKey}`, loggerCtx);
    }
}
```

- [ ] **Step 7: 创建 channel-custom-fields.ts**

Create `packages/redis-stock-plugin/src/channel-custom-fields.ts`:

```ts
import { CustomFields, LanguageCode } from '@vendure/core';

export const redisStockChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'redisStockEnabled',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '启用Redis库存预扣' }],
        },
        {
            name: 'redisUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'Redis连接地址' }],
        },
    ],
};
```

- [ ] **Step 8: 创建 plugin.ts**

Create `packages/redis-stock-plugin/src/plugin.ts`:

```ts
import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, REDIS_STOCK_PLUGIN_OPTIONS } from './constants';
import { redisStockChannelCustomFields } from './channel-custom-fields';
import { StockPrewarmService } from './stock-prewarm.service';
import { StockReserveService } from './stock-reserve.service';
import { RedisStockPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: REDIS_STOCK_PLUGIN_OPTIONS, useFactory: () => RedisStockPlugin.options },
        StockReserveService,
        StockPrewarmService,
    ],
    configuration: (config) => {
        const existingChannelFields = config.customFields.Channel ?? [];
        const newChannelFields = redisStockChannelCustomFields.Channel ?? [];
        config.customFields.Channel = [...existingChannelFields, ...newChannelFields];
        return config;
    },
    compatibility: '^3.0.0',
})
export class RedisStockPlugin implements OnApplicationBootstrap {
    private static options: RedisStockPluginOptions = {};

    constructor(
        @Inject(REDIS_STOCK_PLUGIN_OPTIONS) private options: RedisStockPluginOptions,
        private stockReserveService: StockReserveService,
    ) {}

    static init(options?: RedisStockPluginOptions): Type<RedisStockPlugin> {
        RedisStockPlugin.options = options ?? {};
        return RedisStockPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.stockReserveService.init(this.options);
        Logger.info('RedisStockPlugin initialized', loggerCtx);
    }
}
```

- [ ] **Step 9: 创建 index.ts**

Create `packages/redis-stock-plugin/src/index.ts`:

```ts
export * from './plugin';
export * from './stock-reserve.service';
export * from './stock-prewarm.service';
export * from './types';
```

- [ ] **Step 10: 提交**

```bash
cd e:\code\vendure
git add packages/redis-stock-plugin/
git commit -m "feat(redis-stock-plugin): add Redis stock reservation plugin with prewarm support"
```

---

### Task 2: RedisStockPlugin — Dashboard 扩展

**Files:**
- Create: `packages/redis-stock-plugin/dashboard/tsconfig.json`
- Create: `packages/redis-stock-plugin/dashboard/channel-detail-forms.tsx`
- Create: `packages/redis-stock-plugin/dashboard/index.tsx`
- Modify: `packages/redis-stock-plugin/src/plugin.ts` — 添加 dashboard 属性

- [ ] **Step 1: 创建 dashboard/tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

- [ ] **Step 2: 创建 dashboard/channel-detail-forms.tsx**

Create `packages/redis-stock-plugin/dashboard/channel-detail-forms.tsx`:

```tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

export const redisStockChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
    },
];
```

- [ ] **Step 3: 创建 dashboard/index.tsx**

Create `packages/redis-stock-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { redisStockChannelDetailForms } from './channel-detail-forms';

defineDashboardExtension({
    detailForms: redisStockChannelDetailForms,
});
```

- [ ] **Step 4: 修改 plugin.ts 添加 dashboard 属性**

在 `packages/redis-stock-plugin/src/plugin.ts` 的 `@VendurePlugin` 装饰器中，在 `compatibility: '^3.0.0',` 行之前添加：

```ts
dashboard: './dashboard/index.tsx',
```

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure
git add packages/redis-stock-plugin/dashboard/ packages/redis-stock-plugin/src/plugin.ts
git commit -m "feat(redis-stock-plugin): add dashboard UI extension for channel config"
```

---

### Task 3: FlashSalePlugin — 集成 Redis 库存预扣

**Files:**
- Modify: `packages/flash-sale-plugin/src/flash-sale.service.ts`
- Modify: `packages/flash-sale-plugin/src/flash-sale.job.ts`
- Modify: `packages/flash-sale-plugin/src/plugin.ts`

- [ ] **Step 1: 修改 flash-sale.service.ts 集成 Redis 预扣**

在 `FlashSaleService` 中添加可选的 `StockReserveService` 依赖。修改 `checkEligibility` 方法，在库存检查时优先使用 Redis 预扣：

在文件顶部添加导入：

```ts
import { Injector } from '@vendure/core';
```

在 `FlashSaleService` 类中添加 `init` 方法和修改 `checkEligibility`：

在构造函数后添加：

```ts
private stockReserveService: any = null;

init(injector: Injector): void {
    try {
        const { StockReserveService } = require('@vendure/redis-stock-plugin');
        this.stockReserveService = injector.get(StockReserveService);
    } catch {
        // RedisStockPlugin not installed, use DB fallback
    }
}
```

修改 `checkEligibility` 方法，在 `activity.soldCount >= activity.totalStock` 检查之前添加 Redis 预扣：

```ts
async checkEligibility(
    ctx: RequestContext,
    activityId: ID,
    customerId: ID,
): Promise<{ eligible: boolean; reason?: string }> {
    const activity = await this.findOne(ctx, activityId);
    if (!activity) {
        return { eligible: false, reason: 'Activity not found' };
    }

    const now = new Date();
    if (now < activity.startAt) {
        return { eligible: false, reason: 'Activity has not started' };
    }
    if (now > activity.endAt) {
        return { eligible: false, reason: 'Activity has ended' };
    }

    if (this.stockReserveService?.isAvailable) {
        const remaining = await this.stockReserveService.reserveStock(
            `flash-sale:${activityId}`,
            1,
        );
        if (remaining < 0) {
            return { eligible: false, reason: 'Stock sold out' };
        }
    } else {
        if (activity.soldCount >= activity.totalStock) {
            return { eligible: false, reason: 'Stock sold out' };
        }
    }

    const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
    const flashSaleOrders = existingOrders.items.filter(
        (o: any) => o.customFields?.flashSaleActivityId === activityId && o.state !== 'Cancelled',
    );
    if (flashSaleOrders.length >= activity.limitPerUser) {
        if (this.stockReserveService?.isAvailable) {
            await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
        }
        return { eligible: false, reason: 'Purchase limit exceeded' };
    }

    return { eligible: true };
}
```

- [ ] **Step 2: 修改 flash-sale.job.ts 添加 prewarm**

在 `FlashSaleJob` 类中添加 `StockPrewarmService` 可选依赖。

在文件顶部添加导入：

```ts
import { Injector } from '@vendure/core';
```

在构造函数后添加：

```ts
private stockPrewarmService: any = null;

initStock(injector: Injector): void {
    try {
        const { StockPrewarmService } = require('@vendure/redis-stock-plugin');
        this.stockPrewarmService = injector.get(StockPrewarmService);
    } catch {
        // RedisStockPlugin not installed
    }
}
```

在 `processStatusTransitions` 方法中，`toActivate` 循环内添加 prewarm：

在 `activity.status = 'active';` 之后、`await repo.save(activity);` 之前添加：

```ts
if (this.stockPrewarmService) {
    await this.stockPrewarmService.prewarm(`flash-sale:${activity.id}`, activity.totalStock - activity.soldCount);
}
```

在 `toEnd` 循环内添加清理：

在 `activity.status = 'ended';` 之后、`await repo.save(activity);` 之前添加：

```ts
if (this.stockPrewarmService) {
    await this.stockPrewarmService.removePrewarm(`flash-sale:${activity.id}`);
}
```

- [ ] **Step 3: 修改 plugin.ts 添加 OrderCancelledEvent 监听**

在 `packages/flash-sale-plugin/src/plugin.ts` 中：

1. 添加导入：

```ts
import { Injector, OrderCancelledEvent, EventBus } from '@vendure/core';
```

2. 在 `FlashSalePlugin` 类中添加 `init` 方法和事件监听：

在 `constructor` 之后添加：

```ts
private static injector: Injector;

static init(options?: FlashSalePluginOptions): Type<FlashSalePlugin> {
    FlashSalePlugin.options = options ?? {};
    return FlashSalePlugin;
}

init(injector: Injector): void {
    FlashSalePlugin.injector = injector;
    const flashSaleService = injector.get(FlashSaleService);
    flashSaleService.init(injector);
    const flashSaleJob = injector.get(FlashSaleJob);
    flashSaleJob.initStock(injector);

    const eventBus = injector.get(EventBus);
    eventBus.ofType(OrderCancelledEvent).subscribe(async (event) => {
        const order = event.entity as any;
        const activityId = order?.customFields?.flashSaleActivityId;
        if (!activityId) return;
        try {
            const { StockReserveService } = require('@vendure/redis-stock-plugin');
            const stockReserveService = injector.get(StockReserveService);
            if (stockReserveService?.isAvailable) {
                await stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
            }
        } catch {
            // RedisStockPlugin not installed
        }
    });
}
```

3. 删除原来的 `static init` 方法（已被上面的新版本替代）

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/flash-sale-plugin/src/
git commit -m "feat(flash-sale-plugin): integrate Redis stock reservation with DB fallback"
```

---

### Task 4: GroupBuyPlugin — 集成 Redis 库存预扣

**Files:**
- Modify: `packages/group-buy-plugin/src/group-buy.service.ts`
- Modify: `packages/group-buy-plugin/src/group-buy.job.ts`
- Modify: `packages/group-buy-plugin/src/plugin.ts`

- [ ] **Step 1: 修改 group-buy.service.ts 集成 Redis 预扣**

在文件顶部添加导入：

```ts
import { Injector } from '@vendure/core';
```

在 `GroupBuyService` 类中添加：

```ts
private stockReserveService: any = null;

init(injector: Injector): void {
    try {
        const { StockReserveService } = require('@vendure/redis-stock-plugin');
        this.stockReserveService = injector.get(StockReserveService);
    } catch {
        // RedisStockPlugin not installed, use DB fallback
    }
}
```

修改 `joinGroupBuy` 方法，在 `activity.currentCount >= activity.targetCount` 检查之前添加 Redis 预扣：

在 `if (activity.status !== 'active')` 检查之后添加：

```ts
if (this.stockReserveService?.isAvailable) {
    const remaining = await this.stockReserveService.reserveStock(
        `group-buy:${activityId}`,
        1,
    );
    if (remaining < 0) {
        throw new Error('Activity is already full');
    }
} else {
    if (activity.currentCount >= activity.targetCount && !activity.allowJoinAfterComplete) {
        throw new Error('Activity is already full');
    }
}
```

删除原来的 `if (activity.currentCount >= activity.targetCount && !activity.allowJoinAfterComplete)` 检查（已被上面的条件分支替代）。

- [ ] **Step 2: 修改 group-buy.job.ts 添加 prewarm**

读取当前文件内容，在 `GroupBuyJob` 类中添加 `StockPrewarmService` 可选依赖：

在文件顶部添加导入：

```ts
import { Injector } from '@vendure/core';
```

在构造函数后添加：

```ts
private stockPrewarmService: any = null;

initStock(injector: Injector): void {
    try {
        const { StockPrewarmService } = require('@vendure/redis-stock-plugin');
        this.stockPrewarmService = injector.get(StockPrewarmService);
    } catch {
        // RedisStockPlugin not installed
    }
}
```

在活动状态变为 active 时添加 prewarm，在活动状态变为 expired/completed 时添加清理。

- [ ] **Step 3: 修改 plugin.ts 添加 OrderCancelledEvent 监听**

在 `packages/group-buy-plugin/src/plugin.ts` 中：

1. 添加导入：

```ts
import { Injector, OrderCancelledEvent, EventBus } from '@vendure/core';
```

2. 在 `GroupBuyPlugin` 类中添加 `init` 方法：

```ts
private static injector: Injector;

init(injector: Injector): void {
    GroupBuyPlugin.injector = injector;
    const groupBuyService = injector.get(GroupBuyService);
    groupBuyService.init(injector);
    const groupBuyJob = injector.get(GroupBuyJob);
    groupBuyJob.initStock(injector);

    const eventBus = injector.get(EventBus);
    eventBus.ofType(OrderCancelledEvent).subscribe(async (event) => {
        const order = event.entity as any;
        const activityId = order?.customFields?.groupBuyActivityId;
        if (!activityId) return;
        try {
            const { StockReserveService } = require('@vendure/redis-stock-plugin');
            const stockReserveService = injector.get(StockReserveService);
            if (stockReserveService?.isAvailable) {
                await stockReserveService.releaseStock(`group-buy:${activityId}`, 1);
            }
        } catch {
            // RedisStockPlugin not installed
        }
    });
}
```

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/group-buy-plugin/src/
git commit -m "feat(group-buy-plugin): integrate Redis stock reservation with DB fallback"
```

---

### Task 5: LogisticsApiPlugin — 快递100 物流查询

**Files:**
- Create: `packages/logistics-api-plugin/package.json`
- Create: `packages/logistics-api-plugin/tsconfig.json`
- Create: `packages/logistics-api-plugin/src/index.ts`
- Create: `packages/logistics-api-plugin/src/constants.ts`
- Create: `packages/logistics-api-plugin/src/types.ts`
- Create: `packages/logistics-api-plugin/src/channel-custom-fields.ts`
- Create: `packages/logistics-api-plugin/src/logistics-query.service.ts`
- Create: `packages/logistics-api-plugin/src/logistics-api-admin.resolver.ts`
- Create: `packages/logistics-api-plugin/src/plugin.ts`
- Create: `packages/logistics-api-plugin/dashboard/tsconfig.json`
- Create: `packages/logistics-api-plugin/dashboard/logistics-tracking-dialog.tsx`
- Create: `packages/logistics-api-plugin/dashboard/index.tsx`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 创建 package.json**

Create `packages/logistics-api-plugin/package.json`:

```json
{
  "name": "@vendure/logistics-api-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "peerDependencies": {
    "@vendure/core": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 constants.ts**

Create `packages/logistics-api-plugin/src/constants.ts`:

```ts
export const loggerCtx = 'LogisticsApiPlugin';
export const LOGISTICS_API_PLUGIN_OPTIONS = 'LOGISTICS_API_PLUGIN_OPTIONS';
```

- [ ] **Step 4: 创建 types.ts**

Create `packages/logistics-api-plugin/src/types.ts`:

```ts
export interface LogisticsApiPluginOptions {
    customer?: string;
    key?: string;
    cacheTtlMinutes?: number;
}

export interface TrackingResult {
    carrierCode: string;
    trackingNumber: string;
    traces: TrackingTrace[];
}

export interface TrackingTrace {
    time: string;
    status: string;
    description: string;
}

export interface CarrierDetectResult {
    code: string;
    name: string;
}
```

- [ ] **Step 5: 创建 channel-custom-fields.ts**

Create `packages/logistics-api-plugin/src/channel-custom-fields.ts`:

```ts
import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsApiChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'kuaidi100Customer',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '快递100授权码' }],
        },
        {
            name: 'kuaidi100Key',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '快递100 API Key' }],
        },
    ],
};
```

- [ ] **Step 6: 创建 logistics-query.service.ts**

Create `packages/logistics-api-plugin/src/logistics-query.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import crypto from 'crypto';

import { loggerCtx } from './constants';
import { CarrierDetectResult, TrackingResult, TrackingTrace } from './types';

@Injectable()
export class LogisticsQueryService {
    private cache = new Map<string, { data: any; expires: number }>();

    constructor(private channelService: ChannelService) {}

    async queryTracking(
        ctx: RequestContext,
        carrierCode: string,
        trackingNumber: string,
    ): Promise<TrackingResult> {
        const { customer, key } = await this.getApiConfig(ctx);

        const cacheKey = `${carrierCode}:${trackingNumber}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const param = JSON.stringify({
            com: carrierCode,
            num: trackingNumber,
        });
        const sign = crypto
            .createHash('md5')
            .update(param + key + customer)
            .digest('hex')
            .toUpperCase();

        const response = await fetch('https://poll.kuaidi100.com/poll/query.do', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `customer=${customer}&sign=${sign}&param=${encodeURIComponent(param)}`,
        });

        const data = await response.json() as any;

        const traces: TrackingTrace[] = (data.data ?? []).map((item: any) => ({
            time: item.ftime || item.time,
            status: item.status || '',
            description: item.context || '',
        }));

        const result: TrackingResult = {
            carrierCode: data.com || carrierCode,
            trackingNumber: data.nu || trackingNumber,
            traces,
        };

        this.setToCache(cacheKey, result);
        return result;
    }

    async detectCarrier(
        ctx: RequestContext,
        trackingNumber: string,
    ): Promise<CarrierDetectResult[]> {
        const { key } = await this.getApiConfig(ctx);

        const response = await fetch(
            `https://auto.kuaidi100.com/autonumber/auto?num=${trackingNumber}&key=${key}`,
        );
        const data = await response.json() as any[];
        return (data ?? []).map((item: any) => ({
            code: item.comCode,
            name: item.comCode,
        }));
    }

    private async getApiConfig(ctx: RequestContext): Promise<{ customer: string; key: string }> {
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const ccf = (channel as any)?.customFields;
        return {
            customer: ccf?.kuaidi100Customer || '',
            key: ccf?.kuaidi100Key || '',
        };
    }

    private getFromCache(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private setToCache(key: string, data: any, ttlMinutes: number = 30): void {
        this.cache.set(key, {
            data,
            expires: Date.now() + ttlMinutes * 60 * 1000,
        });
    }
}
```

- [ ] **Step 7: 创建 logistics-api-admin.resolver.ts**

Create `packages/logistics-api-plugin/src/logistics-api-admin.resolver.ts`:

```ts
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { LogisticsQueryService } from './logistics-query.service';

@Resolver()
export class LogisticsApiAdminResolver {
    constructor(private logisticsQueryService: LogisticsQueryService) {}

    @Query()
    async logisticsTracking(
        @Ctx() ctx: RequestContext,
        @Args('carrierCode') carrierCode: string,
        @Args('trackingNumber') trackingNumber: string,
    ) {
        const result = await this.logisticsQueryService.queryTracking(ctx, carrierCode, trackingNumber);
        return result;
    }

    @Query()
    async detectCarrier(
        @Ctx() ctx: RequestContext,
        @Args('trackingNumber') trackingNumber: string,
    ) {
        return this.logisticsQueryService.detectCarrier(ctx, trackingNumber);
    }
}
```

- [ ] **Step 8: 创建 plugin.ts**

Create `packages/logistics-api-plugin/src/plugin.ts`:

```ts
import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, LOGISTICS_API_PLUGIN_OPTIONS } from './constants';
import { logisticsApiChannelCustomFields } from './channel-custom-fields';
import { LogisticsApiAdminResolver } from './logistics-api-admin.resolver';
import { LogisticsQueryService } from './logistics-query.service';
import { LogisticsApiPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: LOGISTICS_API_PLUGIN_OPTIONS, useFactory: () => LogisticsApiPlugin.options },
        LogisticsQueryService,
    ],
    adminApiExtensions: {
        schema: () => gql`
            type TrackingTrace {
                time: String!
                status: String!
                description: String!
            }

            type TrackingResult {
                carrierCode: String!
                trackingNumber: String!
                traces: [TrackingTrace!]!
            }

            type CarrierDetectResult {
                code: String!
                name: String!
            }

            extend type Query {
                logisticsTracking(carrierCode: String!, trackingNumber: String!): TrackingResult!
                detectCarrier(trackingNumber: String!): [CarrierDetectResult!]!
            }
        `,
        resolvers: [LogisticsApiAdminResolver],
    },
    configuration: (config) => {
        const existingChannelFields = config.customFields.Channel ?? [];
        const newChannelFields = logisticsApiChannelCustomFields.Channel ?? [];
        config.customFields.Channel = [...existingChannelFields, ...newChannelFields];
        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class LogisticsApiPlugin {
    private static options: LogisticsApiPluginOptions = {};

    constructor(@Inject(LOGISTICS_API_PLUGIN_OPTIONS) private options: LogisticsApiPluginOptions) {}

    static init(options?: LogisticsApiPluginOptions): Type<LogisticsApiPlugin> {
        LogisticsApiPlugin.options = options ?? {};
        return LogisticsApiPlugin;
    }
}
```

- [ ] **Step 9: 创建 index.ts**

Create `packages/logistics-api-plugin/src/index.ts`:

```ts
export * from './plugin';
export * from './logistics-query.service';
export * from './types';
```

- [ ] **Step 10: 创建 dashboard 扩展**

Create `packages/logistics-api-plugin/dashboard/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

Create `packages/logistics-api-plugin/dashboard/logistics-tracking-dialog.tsx`:

```tsx
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { useState } from 'react';

const getLogisticsTracking = graphql(`
    query GetLogisticsTracking($carrierCode: String!, $trackingNumber: String!) {
        logisticsTracking(carrierCode: $carrierCode, trackingNumber: $trackingNumber) {
            carrierCode
            trackingNumber
            traces {
                time
                status
                description
            }
        }
    }
`);

interface LogisticsTrackingDialogProps {
    carrierCode: string;
    trackingNumber: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LogisticsTrackingDialog({
    carrierCode,
    trackingNumber,
    open,
    onOpenChange,
}: LogisticsTrackingDialogProps) {
    const [traces, setTraces] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleQuery = async () => {
        setLoading(true);
        try {
            const result = await getLogisticsTracking({
                carrierCode,
                trackingNumber,
            });
            setTraces(result?.logisticsTracking?.traces ?? []);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>Logistics Tracking</Trans> - {trackingNumber}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Button onClick={handleQuery} disabled={loading}>
                        {loading ? 'Loading...' : 'Query Tracking'}
                    </Button>
                    {traces.length > 0 && (
                        <div className="space-y-1">
                            {traces.map((trace, i) => (
                                <div key={i} className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground whitespace-nowrap">{trace.time}</span>
                                    <span>{trace.description}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

Create `packages/logistics-api-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({});
```

- [ ] **Step 11: 提交**

```bash
cd e:\code\vendure
git add packages/logistics-api-plugin/
git commit -m "feat(logistics-api-plugin): add Kuaidi100 logistics tracking query plugin"
```

---

### Task 6: InvoicePdfPlugin — 发票 PDF 生成

**Files:**
- Create: `packages/invoice-pdf-plugin/package.json`
- Create: `packages/invoice-pdf-plugin/tsconfig.json`
- Create: `packages/invoice-pdf-plugin/src/index.ts`
- Create: `packages/invoice-pdf-plugin/src/constants.ts`
- Create: `packages/invoice-pdf-plugin/src/types.ts`
- Create: `packages/invoice-pdf-plugin/src/order-custom-fields.ts`
- Create: `packages/invoice-pdf-plugin/src/templates/ordinary-invoice.ts`
- Create: `packages/invoice-pdf-plugin/src/templates/special-invoice.ts`
- Create: `packages/invoice-pdf-plugin/src/invoice-pdf.service.ts`
- Create: `packages/invoice-pdf-plugin/src/invoice-pdf-admin.resolver.ts`
- Create: `packages/invoice-pdf-plugin/src/plugin.ts`
- Create: `packages/invoice-pdf-plugin/dashboard/tsconfig.json`
- Create: `packages/invoice-pdf-plugin/dashboard/invoice-block-enhanced.tsx`
- Create: `packages/invoice-pdf-plugin/dashboard/index.tsx`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 创建 package.json**

Create `packages/invoice-pdf-plugin/package.json`:

```json
{
  "name": "@vendure/invoice-pdf-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "pdfkit": "^0.15.0"
  },
  "peerDependencies": {
    "@vendure/core": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 constants.ts**

Create `packages/invoice-pdf-plugin/src/constants.ts`:

```ts
export const loggerCtx = 'InvoicePdfPlugin';
export const INVOICE_PDF_PLUGIN_OPTIONS = 'INVOICE_PDF_PLUGIN_OPTIONS';
```

- [ ] **Step 4: 创建 types.ts**

Create `packages/invoice-pdf-plugin/src/types.ts`:

```ts
export interface InvoicePdfPluginOptions {
    storagePath?: string;
}
```

- [ ] **Step 5: 创建 order-custom-fields.ts**

Create `packages/invoice-pdf-plugin/src/order-custom-fields.ts`:

```ts
import { CustomFields, LanguageCode } from '@vendure/core';

export const invoicePdfOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'invoicePdfUrl',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票PDF地址' }],
        },
        {
            name: 'invoiceNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票编号' }],
        },
    ],
};
```

- [ ] **Step 6: 创建 templates/ordinary-invoice.ts**

Create `packages/invoice-pdf-plugin/src/templates/ordinary-invoice.ts`:

```ts
import PDFDocument from 'pdfkit';

interface InvoiceData {
    invoiceNumber: string;
    invoiceType: string;
    invoiceTitle: string;
    invoiceTaxNumber: string;
    invoiceEmail: string;
    orderCode: string;
    orderTotal: number;
    currencyCode: string;
    orderDate: string;
    lines: Array<{ name: string; quantity: number; price: number }>;
}

export function generateOrdinaryInvoice(data: InvoiceData): Buffer {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`No: ${data.invoiceNumber}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text(`Type: ${data.invoiceType}`);
    doc.text(`Title: ${data.invoiceTitle}`);
    doc.text(`Tax Number: ${data.invoiceTaxNumber}`);
    doc.text(`Email: ${data.invoiceEmail}`);
    doc.moveDown(0.5);
    doc.text(`Order: ${data.orderCode}`);
    doc.text(`Date: ${data.orderDate}`);
    doc.moveDown(1);

    doc.text('Items:', { underline: true });
    doc.moveDown(0.3);
    for (const line of data.lines) {
        doc.text(`${line.name}  x${line.quantity}  ${line.price}`);
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${data.currencyCode} ${(data.orderTotal / 100).toFixed(2)}`, { align: 'right' });

    doc.end();
    return Buffer.concat(chunks);
}
```

- [ ] **Step 7: 创建 templates/special-invoice.ts**

Create `packages/invoice-pdf-plugin/src/templates/special-invoice.ts`:

```ts
import PDFDocument from 'pdfkit';

interface SpecialInvoiceData {
    invoiceNumber: string;
    invoiceTitle: string;
    invoiceTaxNumber: string;
    invoiceEmail: string;
    invoiceCompanyAddress: string;
    invoiceCompanyPhone: string;
    invoiceBankName: string;
    invoiceBankAccount: string;
    orderCode: string;
    orderTotal: number;
    currencyCode: string;
    orderDate: string;
    lines: Array<{ name: string; quantity: number; price: number }>;
}

export function generateSpecialInvoice(data: SpecialInvoiceData): Buffer {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(20).text('VAT SPECIAL INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`No: ${data.invoiceNumber}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text(`Title: ${data.invoiceTitle}`);
    doc.text(`Tax Number: ${data.invoiceTaxNumber}`);
    doc.text(`Email: ${data.invoiceEmail}`);
    doc.moveDown(0.5);
    doc.text(`Company Address: ${data.invoiceCompanyAddress}`);
    doc.text(`Company Phone: ${data.invoiceCompanyPhone}`);
    doc.text(`Bank: ${data.invoiceBankName}`);
    doc.text(`Bank Account: ${data.invoiceBankAccount}`);
    doc.moveDown(0.5);
    doc.text(`Order: ${data.orderCode}`);
    doc.text(`Date: ${data.orderDate}`);
    doc.moveDown(1);

    doc.text('Items:', { underline: true });
    doc.moveDown(0.3);
    for (const line of data.lines) {
        doc.text(`${line.name}  x${line.quantity}  ${line.price}`);
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${data.currencyCode} ${(data.orderTotal / 100).toFixed(2)}`, { align: 'right' });

    doc.end();
    return Buffer.concat(chunks);
}
```

- [ ] **Step 8: 创建 invoice-pdf.service.ts**

Create `packages/invoice-pdf-plugin/src/invoice-pdf.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AssetStorageStrategy, Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { generateOrdinaryInvoice } from './templates/ordinary-invoice';
import { generateSpecialInvoice } from './templates/special-invoice';

@Injectable()
export class InvoicePdfService {
    constructor(private connection: TransactionalConnection) {}

    async generatePdf(ctx: RequestContext, order: Order): Promise<Buffer> {
        const cf = (order as any).customFields;
        const invoiceNumber = cf?.invoiceNumber || `INV-${order.id}-${Date.now()}`;

        const lines = (order.lines ?? []).map((line: any) => ({
            name: line.productVariant?.name || 'Item',
            quantity: line.quantity,
            price: (line.proratedLinePriceWithTax ?? 0) / 100,
        }));

        if (cf?.invoiceType === 'special') {
            return generateSpecialInvoice({
                invoiceNumber,
                invoiceTitle: cf.invoiceTitle || '',
                invoiceTaxNumber: cf.invoiceTaxNumber || '',
                invoiceEmail: cf.invoiceEmail || '',
                invoiceCompanyAddress: cf.invoiceCompanyAddress || '',
                invoiceCompanyPhone: cf.invoiceCompanyPhone || '',
                invoiceBankName: cf.invoiceBankName || '',
                invoiceBankAccount: cf.invoiceBankAccount || '',
                orderCode: order.code,
                orderTotal: order.totalWithTax ?? 0,
                currencyCode: order.currencyCode ?? 'CNY',
                orderDate: order.orderPlacedAt?.toISOString() ?? '',
                lines,
            });
        }

        return generateOrdinaryInvoice({
            invoiceNumber,
            invoiceType: cf?.invoiceType || 'ordinary',
            invoiceTitle: cf?.invoiceTitle || '',
            invoiceTaxNumber: cf?.invoiceTaxNumber || '',
            invoiceEmail: cf?.invoiceEmail || '',
            orderCode: order.code,
            orderTotal: order.totalWithTax ?? 0,
            currencyCode: order.currencyCode ?? 'CNY',
            orderDate: order.orderPlacedAt?.toISOString() ?? '',
            lines,
        });
    }

    async generateAndStore(
        ctx: RequestContext,
        order: Order,
        assetStorageStrategy: AssetStorageStrategy,
    ): Promise<string> {
        const pdfBuffer = await this.generatePdf(ctx, order);
        const cf = (order as any).customFields;
        const invoiceNumber = cf?.invoiceNumber || `INV-${order.id}-${Date.now()}`;
        const fileName = `invoices/${ctx.channelId}/${order.id}/${invoiceNumber}.pdf`;

        await assetStorageStrategy.writeFileFromBuffer(fileName, pdfBuffer, 'application/pdf');
        const url = await assetStorageStrategy.readFileToBuffer(fileName).then(() => fileName);

        Logger.info(`Invoice PDF generated: ${fileName}`, loggerCtx);
        return url;
    }
}
```

- [ ] **Step 9: 创建 invoice-pdf-admin.resolver.ts**

Create `packages/invoice-pdf-plugin/src/invoice-pdf-admin.resolver.ts`:

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AssetStorageStrategy, Ctx, ID, OrderService, RequestContext } from '@vendure/core';

import { InvoicePdfService } from './invoice-pdf.service';

@Resolver()
export class InvoicePdfAdminResolver {
    constructor(
        private invoicePdfService: InvoicePdfService,
        private orderService: OrderService,
    ) {}

    @Mutation()
    async generateInvoicePdf(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
    ) {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new Error(`Order with id ${orderId} not found`);
        }

        const assetStorageStrategy = (ctx as any).assetStorageStrategy as AssetStorageStrategy;
        if (!assetStorageStrategy) {
            throw new Error('AssetStorageStrategy not available');
        }

        const pdfUrl = await this.invoicePdfService.generateAndStore(ctx, order, assetStorageStrategy);

        const cf = (order as any).customFields;
        (order as any).customFields = {
            ...cf,
            invoicePdfUrl: pdfUrl,
            invoiceNumber: cf?.invoiceNumber || `INV-${orderId}-${Date.now()}`,
        };
        await this.orderService.updateCustomFields(ctx, orderId, (order as any).customFields);

        return { url: pdfUrl, invoiceNumber: (order as any).customFields.invoiceNumber };
    }
}
```

- [ ] **Step 10: 创建 plugin.ts**

Create `packages/invoice-pdf-plugin/src/plugin.ts`:

```ts
import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, INVOICE_PDF_PLUGIN_OPTIONS } from './constants';
import { InvoicePdfAdminResolver } from './invoice-pdf-admin.resolver';
import { InvoicePdfService } from './invoice-pdf.service';
import { invoicePdfOrderCustomFields } from './order-custom-fields';
import { InvoicePdfPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: INVOICE_PDF_PLUGIN_OPTIONS, useFactory: () => InvoicePdfPlugin.options },
        InvoicePdfService,
    ],
    adminApiExtensions: {
        schema: () => gql`
            type InvoicePdfResult {
                url: String!
                invoiceNumber: String!
            }

            extend type Mutation {
                generateInvoicePdf(orderId: ID!): InvoicePdfResult!
            }
        `,
        resolvers: [InvoicePdfAdminResolver],
    },
    configuration: (config) => {
        const existingOrderFields = config.customFields.Order ?? [];
        const newOrderFields = invoicePdfOrderCustomFields.Order ?? [];
        config.customFields.Order = [...existingOrderFields, ...newOrderFields];
        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class InvoicePdfPlugin {
    private static options: InvoicePdfPluginOptions = {};

    constructor(@Inject(INVOICE_PDF_PLUGIN_OPTIONS) private options: InvoicePdfPluginOptions) {}

    static init(options?: InvoicePdfPluginOptions): Type<InvoicePdfPlugin> {
        InvoicePdfPlugin.options = options ?? {};
        return InvoicePdfPlugin;
    }
}
```

- [ ] **Step 11: 创建 index.ts**

Create `packages/invoice-pdf-plugin/src/index.ts`:

```ts
export * from './plugin';
export * from './invoice-pdf.service';
export * from './types';
```

- [ ] **Step 12: 创建 dashboard 扩展**

Create `packages/invoice-pdf-plugin/dashboard/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "jsx": "react-jsx",
    "paths": {
      "@/vdb/*": ["../../../dashboard/src/lib/*"],
      "@/graphql/*": ["../../../dashboard/src/app/graphql/*"]
    }
  }
}
```

Create `packages/invoice-pdf-plugin/dashboard/invoice-block-enhanced.tsx`:

```tsx
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, DashboardPageBlockDefinition } from '@vendure/dashboard';
import { useState } from 'react';

const generateInvoicePdfMutation = graphql(`
    mutation GenerateInvoicePdf($orderId: ID!) {
        generateInvoicePdf(orderId: $orderId) {
            url
            invoiceNumber
        }
    }
`);

export const invoicePdfBlock: DashboardPageBlockDefinition = {
    id: 'invoice-pdf-info',
    title: <Trans>Invoice</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'main-form', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.invoiceRequired;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        const [generating, setGenerating] = useState(false);

        if (!cf) return null;

        const handleGenerate = async () => {
            setGenerating(true);
            try {
                await generateInvoicePdfMutation({ orderId: String(order.id) });
                window.location.reload();
            } finally {
                setGenerating(false);
            }
        };

        return (
            <div className="space-y-2">
                <LabeledData label="Invoice Type">{cf.invoiceType || '-'}</LabeledData>
                <LabeledData label="Invoice Title">{cf.invoiceTitle || '-'}</LabeledData>
                <LabeledData label="Tax Number">{cf.invoiceTaxNumber || '-'}</LabeledData>
                <LabeledData label="Email">{cf.invoiceEmail || '-'}</LabeledData>
                {cf.invoiceType === 'special' && (
                    <>
                        <LabeledData label="Company Address">{cf.invoiceCompanyAddress || '-'}</LabeledData>
                        <LabeledData label="Company Phone">{cf.invoiceCompanyPhone || '-'}</LabeledData>
                        <LabeledData label="Bank Name">{cf.invoiceBankName || '-'}</LabeledData>
                        <LabeledData label="Bank Account">{cf.invoiceBankAccount || '-'}</LabeledData>
                    </>
                )}
                <div className="flex gap-2 pt-2">
                    {!cf.invoicePdfUrl && (
                        <Button size="sm" onClick={handleGenerate} disabled={generating}>
                            {generating ? 'Generating...' : 'Generate PDF'}
                        </Button>
                    )}
                    {cf.invoicePdfUrl && (
                        <a href={cf.invoicePdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">Download PDF</Button>
                        </a>
                    )}
                </div>
            </div>
        );
    },
};
```

Create `packages/invoice-pdf-plugin/dashboard/index.tsx`:

```tsx
import { defineDashboardExtension } from '@vendure/dashboard';

import { invoicePdfBlock } from './invoice-block-enhanced';

defineDashboardExtension({
    pageBlocks: [invoicePdfBlock],
});
```

- [ ] **Step 13: 提交**

```bash
cd e:\code\vendure
git add packages/invoice-pdf-plugin/
git commit -m "feat(invoice-pdf-plugin): add invoice PDF generation plugin with pdfkit"
```

---

### Task 7: Dev-server 集成 + 编译验证

**Files:**
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 注册 3 个新插件到 dev-config.ts**

在 `packages/dev-server/dev-config.ts` 中添加导入：

```ts
import { RedisStockPlugin } from '@vendure/redis-stock-plugin';
import { LogisticsApiPlugin } from '@vendure/logistics-api-plugin';
import { InvoicePdfPlugin } from '@vendure/invoice-pdf-plugin';
```

在 plugins 数组中添加：

```ts
RedisStockPlugin.init({
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
}),
LogisticsApiPlugin.init({
    customer: process.env.KUAIDI100_CUSTOMER ?? '',
    key: process.env.KUAIDI100_KEY ?? '',
}),
InvoicePdfPlugin.init(),
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/dev-server/dev-config.ts
git commit -m "feat(dev-server): register RedisStockPlugin, LogisticsApiPlugin and InvoicePdfPlugin"
```
