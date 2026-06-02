# CJK Extended Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vendure 新增 6 个独立插件包：订单超时取消、发票、物流追踪、拼团、秒杀、分销/佣金，全部遵循 Channel 多租户架构。

**Architecture:** 6 个独立 `@vendure/*-plugin` 包，每个包遵循 Vendure 插件规范（VendurePlugin 装饰器、PluginCommonModule、configuration 函数）。实体实现 ChannelAware 接口，业务逻辑通过 EventBus + JobQueue 驱动。无外部依赖（仅 @vendure/core + @vendure/common）。

**Tech Stack:** TypeScript, NestJS, Vendure v3.6.x, TypeORM, GraphQL

---

## File Structure

```
packages/
├── order-timeout-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── order-timeout.job.ts
│   │   └── channel-custom-fields.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── invoice-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── order-custom-fields.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── logistics-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── fulfillment-custom-fields.ts
│   │   ├── channel-custom-fields.ts
│   │   └── channel-stock-allocation-strategy.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── group-buy-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── group-buy-activity.entity.ts
│   │   ├── group-buy-order.entity.ts
│   │   ├── group-buy.service.ts
│   │   ├── group-buy-admin.resolver.ts
│   │   ├── group-buy-shop.resolver.ts
│   │   ├── group-buy-promotion-condition.ts
│   │   ├── group-buy-leader-promotion.ts
│   │   └── group-buy.job.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── flash-sale-plugin/
│   ├── src/
│   │   ├── plugin.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── flash-sale-activity.entity.ts
│   │   ├── flash-sale.service.ts
│   │   ├── flash-sale-admin.resolver.ts
│   │   ├── flash-sale-shop.resolver.ts
│   │   ├── flash-sale-promotion-condition.ts
│   │   ├── flash-sale-eligibility-checker.ts
│   │   └── flash-sale.job.ts
│   ├── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
└── distribution-plugin/
    ├── src/
    │   ├── plugin.ts
    │   ├── constants.ts
    │   ├── types.ts
    │   ├── distributor.entity.ts
    │   ├── commission-record.entity.ts
    │   ├── withdrawal-request.entity.ts
    │   ├── channel-custom-fields.ts
    │   ├── customer-custom-fields.ts
    │   ├── distribution.service.ts
    │   ├── commission.service.ts
    │   ├── withdrawal.service.ts
    │   ├── distribution-admin.resolver.ts
    │   ├── distribution-shop.resolver.ts
    │   └── commission.job.ts
    ├── index.ts
    ├── package.json
    ├── tsconfig.json
    └── tsconfig.build.json
```

---

### Task 1: order-timeout-plugin 骨架 + Channel CustomFields

**Files:**
- Create: `packages/order-timeout-plugin/package.json`
- Create: `packages/order-timeout-plugin/tsconfig.json`
- Create: `packages/order-timeout-plugin/tsconfig.build.json`
- Create: `packages/order-timeout-plugin/index.ts`
- Create: `packages/order-timeout-plugin/src/constants.ts`
- Create: `packages/order-timeout-plugin/src/types.ts`
- Create: `packages/order-timeout-plugin/src/channel-custom-fields.ts`
- Create: `packages/order-timeout-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/order-timeout-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: 创建 tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./lib" },
  "files": ["./index.ts"]
}
```

- [ ] **Step 4: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'OrderTimeoutPlugin';
export const ORDER_TIMEOUT_PLUGIN_OPTIONS = Symbol('ORDER_TIMEOUT_PLUGIN_OPTIONS');
```

- [ ] **Step 5: 创建 src/types.ts**

```typescript
export interface OrderTimeoutPluginOptions {
    defaultTimeoutMinutes?: number;
}
```

- [ ] **Step 6: 创建 src/channel-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const orderTimeoutChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'orderTimeoutMinutes',
            type: 'int',
            defaultValue: 30,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '订单超时时间（分钟）' }],
        },
    ],
};
```

- [ ] **Step 7: 创建 src/plugin.ts**

```typescript
import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { JobQueueService, Logger, OrderService, ChannelService, PluginCommonModule, VendurePlugin, EventBus, OrderStateTransitionEvent, RequestContext } from '@vendure/core';

import { ORDER_TIMEOUT_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { OrderTimeoutPluginOptions } from './types';
import { orderTimeoutChannelCustomFields } from './channel-custom-fields';
import { OrderTimeoutJob } from './order-timeout.job';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: ORDER_TIMEOUT_PLUGIN_OPTIONS, useFactory: () => OrderTimeoutPlugin.options },
        OrderTimeoutJob,
    ],
    configuration: (config) => {
        config.customFields.Channel = [...(config.customFields.Channel ?? []), ...orderTimeoutChannelCustomFields.Channel];
        return config;
    },
    compatibility: '^3.0.0',
})
export class OrderTimeoutPlugin implements OnApplicationBootstrap {
    private static options: OrderTimeoutPluginOptions = {};

    constructor(
        @Inject(ORDER_TIMEOUT_PLUGIN_OPTIONS) private options: OrderTimeoutPluginOptions,
        private orderTimeoutJob: OrderTimeoutJob,
        private eventBus: EventBus,
    ) {}

    static init(options?: OrderTimeoutPluginOptions): Type<OrderTimeoutPlugin> {
        OrderTimeoutPlugin.options = options ?? {};
        return OrderTimeoutPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.orderTimeoutJob.init();

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            if (event.toState === 'ArrangingPayment') {
                const timeoutMinutes = (event.ctx.channel as any).customFields?.orderTimeoutMinutes
                    ?? this.options.defaultTimeoutMinutes
                    ?? 30;
                this.orderTimeoutJob.scheduleCancellation(
                    event.order.id as string,
                    event.ctx.channelId as string,
                    timeoutMinutes,
                );
                Logger.info(`Scheduled timeout for order ${event.order.id} in ${timeoutMinutes} minutes`, loggerCtx);
            }
        });
    }
}
```

- [ ] **Step 8: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
```

- [ ] **Step 9: 构建验证**

Run: `cd e:\code\vendure\packages\order-timeout-plugin && npx tsc --noEmit`

- [ ] **Step 10: 提交**

```bash
git add packages/order-timeout-plugin/
git commit -m "feat(order-timeout-plugin): scaffold plugin with channel custom fields"
```

---

### Task 2: order-timeout-plugin JobQueue 逻辑

**Files:**
- Create: `packages/order-timeout-plugin/src/order-timeout.job.ts`
- Modify: `packages/order-timeout-plugin/src/plugin.ts` (已在 Task 1 中引用，无需修改)

- [ ] **Step 1: 创建 src/order-timeout.job.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ChannelService, JobQueue, JobQueueService, Logger, OrderService, RequestContext } from '@vendure/core';

import { loggerCtx } from './constants';

@Injectable()
export class OrderTimeoutJob {
    private jobQueue: JobQueue<{ orderId: string; channelId: string }>;

    constructor(
        private jobQueueService: JobQueueService,
        private orderService: OrderService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'order-timeout',
            process: async (job) => {
                try {
                    const channel = await this.channelService.findOne(job.data.channelId as any);
                    if (!channel) {
                        Logger.warn(`Channel ${job.data.channelId} not found, skipping timeout job`, loggerCtx);
                        return;
                    }
                    const ctx = new RequestContext({
                        apiType: 'admin',
                        channel,
                        isAuthorized: true,
                        authorizedAsOwnerOnly: false,
                    });
                    const order = await this.orderService.findOne(ctx, job.data.orderId as any);
                    if (order && order.state === 'ArrangingPayment') {
                        await this.orderService.cancelOrder(ctx, job.data.orderId as any);
                        Logger.info(`Order ${job.data.orderId} cancelled due to timeout`, loggerCtx);
                    }
                } catch (e: any) {
                    Logger.error(`Failed to process timeout for order ${job.data.orderId}: ${e.message}`, loggerCtx);
                }
            },
        });
    }

    async scheduleCancellation(orderId: string, channelId: string, timeoutMinutes: number): Promise<void> {
        await this.jobQueue.add({ orderId, channelId }, { delay: timeoutMinutes * 60 * 1000 });
    }
}
```

- [ ] **Step 2: 构建验证**

Run: `cd e:\code\vendure\packages\order-timeout-plugin && npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add packages/order-timeout-plugin/
git commit -m "feat(order-timeout-plugin): add JobQueue timeout cancellation logic"
```

---

### Task 3: invoice-plugin

**Files:**
- Create: `packages/invoice-plugin/package.json`
- Create: `packages/invoice-plugin/tsconfig.json`
- Create: `packages/invoice-plugin/tsconfig.build.json`
- Create: `packages/invoice-plugin/index.ts`
- Create: `packages/invoice-plugin/src/constants.ts`
- Create: `packages/invoice-plugin/src/types.ts`
- Create: `packages/invoice-plugin/src/order-custom-fields.ts`
- Create: `packages/invoice-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/invoice-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json 和 tsconfig.build.json**

tsconfig.json:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

tsconfig.build.json:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./lib" },
  "files": ["./index.ts"]
}
```

- [ ] **Step 3: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'InvoicePlugin';
export const INVOICE_PLUGIN_OPTIONS = Symbol('INVOICE_PLUGIN_OPTIONS');
```

- [ ] **Step 4: 创建 src/types.ts**

```typescript
export interface InvoicePluginOptions {
    enabledTypes?: ('ordinary' | 'special' | 'electronic')[];
}
```

- [ ] **Step 5: 创建 src/order-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const invoiceOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'invoiceRequired',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '需要发票' }],
        },
        {
            name: 'invoiceType',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票类型' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'ordinary', label: [{ languageCode: LanguageCode.zh_Hans, value: '普通发票' }] },
                    { value: 'special', label: [{ languageCode: LanguageCode.zh_Hans, value: '增值税专用发票' }] },
                    { value: 'electronic', label: [{ languageCode: LanguageCode.zh_Hans, value: '电子发票' }] },
                ],
            },
        },
        {
            name: 'invoiceTitle',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发票抬头' }],
        },
        {
            name: 'invoiceTaxNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '纳税人识别号' }],
        },
        {
            name: 'invoiceEmail',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '接收邮箱' }],
        },
        {
            name: 'invoiceCompanyAddress',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '注册地址（专票）' }],
        },
        {
            name: 'invoiceCompanyPhone',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '注册电话（专票）' }],
        },
        {
            name: 'invoiceBankName',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '开户银行（专票）' }],
        },
        {
            name: 'invoiceBankAccount',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '银行账号（专票）' }],
        },
    ],
};
```

- [ ] **Step 6: 创建 src/plugin.ts**

```typescript
import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { INVOICE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { InvoicePluginOptions } from './types';
import { invoiceOrderCustomFields } from './order-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
    ],
    configuration: (config) => {
        config.customFields.Order = [...(config.customFields.Order ?? []), ...invoiceOrderCustomFields.Order];
        return config;
    },
    compatibility: '^3.0.0',
})
export class InvoicePlugin {
    private static options: InvoicePluginOptions = {};

    constructor(@Inject(INVOICE_PLUGIN_OPTIONS) private options: InvoicePluginOptions) {}

    static init(options?: InvoicePluginOptions): Type<InvoicePlugin> {
        InvoicePlugin.options = options ?? {};
        return InvoicePlugin;
    }
}
```

- [ ] **Step 7: 创建 src/order-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const groupBuyOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'groupBuyActivityId',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '拼团活动ID' }],
        },
        {
            name: 'groupBuyIsLeader',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '是否团长' }],
        },
    ],
};
```

- [ ] **Step 8: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
```

- [ ] **Step 8: 构建验证**

Run: `cd e:\code\vendure\packages\invoice-plugin && npx tsc --noEmit`

- [ ] **Step 9: 提交**

```bash
git add packages/invoice-plugin/
git commit -m "feat(invoice-plugin): add invoice data recording plugin"
```

---

### Task 4: logistics-plugin 骨架 + CustomFields

**Files:**
- Create: `packages/logistics-plugin/package.json`
- Create: `packages/logistics-plugin/tsconfig.json`
- Create: `packages/logistics-plugin/tsconfig.build.json`
- Create: `packages/logistics-plugin/index.ts`
- Create: `packages/logistics-plugin/src/constants.ts`
- Create: `packages/logistics-plugin/src/types.ts`
- Create: `packages/logistics-plugin/src/fulfillment-custom-fields.ts`
- Create: `packages/logistics-plugin/src/channel-custom-fields.ts`
- Create: `packages/logistics-plugin/src/channel-stock-allocation-strategy.ts`
- Create: `packages/logistics-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/logistics-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json 和 tsconfig.build.json**

同 Task 1 的模板。

- [ ] **Step 3: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'LogisticsPlugin';
export const LOGISTICS_PLUGIN_OPTIONS = Symbol('LOGISTICS_PLUGIN_OPTIONS');
```

- [ ] **Step 4: 创建 src/types.ts**

```typescript
export interface LogisticsPluginOptions {
    defaultShippingStrategy?: 'priority' | 'nearest' | 'stock-first';
}
```

- [ ] **Step 5: 创建 src/fulfillment-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsFulfillmentCustomFields: CustomFields = {
    Fulfillment: [
        {
            name: 'trackingNumber',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流单号' }],
        },
        {
            name: 'carrier',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流公司' }],
        },
        {
            name: 'carrierCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流公司编码' }],
        },
        {
            name: 'shippingNote',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '物流备注' }],
        },
    ],
};
```

- [ ] **Step 6: 创建 src/channel-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const logisticsChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'stockLocationPriority',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '仓库优先级配置（JSON）' }],
        },
        {
            name: 'shippingStrategy',
            type: 'string',
            defaultValue: 'priority',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '发货策略' }],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'priority', label: [{ languageCode: LanguageCode.zh_Hans, value: '按优先级' }] },
                    { value: 'nearest', label: [{ languageCode: LanguageCode.zh_Hans, value: '就近发货' }] },
                    { value: 'stock-first', label: [{ languageCode: LanguageCode.zh_Hans, value: '库存优先' }] },
                ],
            },
        },
    ],
};
```

- [ ] **Step 7: 创建 src/channel-stock-allocation-strategy.ts**

```typescript
import { RequestContext } from '@vendure/core';
import { StockAllocationStrategy } from '@vendure/core';

export class ChannelStockAllocationStrategy implements StockAllocationStrategy {
    async allocateFromStockLocation(
        ctx: RequestContext,
        stockLocations: Array<{ id: string; stockOnHand: number }>,
        _item: any,
    ): Promise<any> {
        if (stockLocations.length === 0) {
            return undefined;
        }

        const ccf = (ctx.channel as any).customFields;
        const strategy = ccf?.shippingStrategy ?? 'priority';

        switch (strategy) {
            case 'priority': {
                const priorityConfig = ccf?.stockLocationPriority
                    ? JSON.parse(ccf.stockLocationPriority)
                    : [];
                if (priorityConfig.length > 0) {
                    const sorted = [...stockLocations].sort((a, b) => {
                        const pa = priorityConfig.find((p: any) => p.locationId === a.id)?.priority ?? 999;
                        const pb = priorityConfig.find((p: any) => p.locationId === b.id)?.priority ?? 999;
                        return pa - pb;
                    });
                    return sorted[0];
                }
                return stockLocations[0];
            }
            case 'stock-first': {
                const sorted = [...stockLocations].sort((a, b) => b.stockOnHand - a.stockOnHand);
                return sorted[0];
            }
            case 'nearest':
            default:
                return stockLocations[0];
        }
    }
}
```

- [ ] **Step 8: 创建 src/plugin.ts**

```typescript
import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LogisticsPluginOptions } from './types';
import { logisticsFulfillmentCustomFields } from './fulfillment-custom-fields';
import { logisticsChannelCustomFields } from './channel-custom-fields';
import { ChannelStockAllocationStrategy } from './channel-stock-allocation-strategy';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
    ],
    configuration: (config) => {
        config.customFields.Fulfillment = [
            ...(config.customFields.Fulfillment ?? []),
            ...logisticsFulfillmentCustomFields.Fulfillment,
        ];
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...logisticsChannelCustomFields.Channel,
        ];
        config.stockAllocationStrategy = new ChannelStockAllocationStrategy();
        return config;
    },
    compatibility: '^3.0.0',
})
export class LogisticsPlugin {
    private static options: LogisticsPluginOptions = {};

    constructor(@Inject(LOGISTICS_PLUGIN_OPTIONS) private options: LogisticsPluginOptions) {}

    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin> {
        LogisticsPlugin.options = options ?? {};
        return LogisticsPlugin;
    }
}
```

- [ ] **Step 9: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
```

- [ ] **Step 10: 构建验证**

Run: `cd e:\code\vendure\packages\logistics-plugin && npx tsc --noEmit`

- [ ] **Step 11: 提交**

```bash
git add packages/logistics-plugin/
git commit -m "feat(logistics-plugin): add logistics tracking and multi-warehouse shipping strategy"
```

---

### Task 5: group-buy-plugin 骨架 + 实体

**Files:**
- Create: `packages/group-buy-plugin/package.json`
- Create: `packages/group-buy-plugin/tsconfig.json`
- Create: `packages/group-buy-plugin/tsconfig.build.json`
- Create: `packages/group-buy-plugin/index.ts`
- Create: `packages/group-buy-plugin/src/constants.ts`
- Create: `packages/group-buy-plugin/src/types.ts`
- Create: `packages/group-buy-plugin/src/group-buy-activity.entity.ts`
- Create: `packages/group-buy-plugin/src/group-buy-order.entity.ts`
- Create: `packages/group-buy-plugin/src/order-custom-fields.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/group-buy-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.build.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.build.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json 和 tsconfig.build.json**

同 Task 1 的模板。

- [ ] **Step 3: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'GroupBuyPlugin';
export const GROUP_BUY_PLUGIN_OPTIONS = Symbol('GROUP_BUY_PLUGIN_OPTIONS');
```

- [ ] **Step 4: 创建 src/types.ts**

```typescript
export interface RewardRule {
    excessCount: number;
    rewardType: 'discount' | 'cashback' | 'gift';
    rewardValue: number;
}

export interface GroupBuyPluginOptions {
    defaultTimeoutMinutes?: number;
}
```

- [ ] **Step 5: 创建 src/group-buy-activity.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, VendureEntity } from '@vendure/core';

@Entity()
export class GroupBuyActivity extends VendureEntity implements ChannelAware {
    @Column() name: string;

    @Column() description: string;

    @Column() targetCount: number;

    @Column({ default: 0 }) currentCount: number;

    @Column({ default: 0 }) maxCount: number;

    @Column() status: 'active' | 'completed' | 'expired';

    @Column() startAt: Date;

    @Column() endAt: Date;

    @Column() productId: number;

    @Column() variantId: number;

    @Column() groupPrice: number;

    @Column({ default: 0 }) leaderDiscount: number;

    @Column({ default: 'discount' }) leaderRewardType: 'discount' | 'cashback' | 'free';

    @Column('simple-json', { nullable: true }) rewardRules: RewardRule[];

    @Column({ default: true }) autoConfirm: boolean;

    @Column({ default: false }) allowJoinAfterComplete: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}

interface RewardRule {
    excessCount: number;
    rewardType: 'discount' | 'cashback' | 'gift';
    rewardValue: number;
}
```

- [ ] **Step 6: 创建 src/group-buy-order.entity.ts**

```typescript
import { Column, Entity } from 'typeorm';
import { VendureEntity } from '@vendure/core';

@Entity()
export class GroupBuyOrder extends VendureEntity {
    @Column() groupBuyActivityId: number;

    @Column() orderId: number;

    @Column() isLeader: boolean;

    @Column({ default: 'pending' }) status: 'pending' | 'success' | 'failed';
}
```

- [ ] **Step 7: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/group-buy-activity.entity';
export * from './src/group-buy-order.entity';
```

- [ ] **Step 8: 构建验证**

Run: `cd e:\code\vendure\packages\group-buy-plugin && npx tsc --noEmit`

- [ ] **Step 9: 提交**

```bash
git add packages/group-buy-plugin/
git commit -m "feat(group-buy-plugin): scaffold plugin with entities"
```

---

### Task 6: group-buy-plugin Service + Resolvers + JobQueue

**Files:**
- Create: `packages/group-buy-plugin/src/group-buy.service.ts`
- Create: `packages/group-buy-plugin/src/group-buy-admin.resolver.ts`
- Create: `packages/group-buy-plugin/src/group-buy-shop.resolver.ts`
- Create: `packages/group-buy-plugin/src/group-buy-promotion-condition.ts`
- Create: `packages/group-buy-plugin/src/group-buy-leader-promotion.ts`
- Create: `packages/group-buy-plugin/src/group-buy.job.ts`
- Create: `packages/group-buy-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 src/group-buy.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ChannelService, ListQueryBuilder, RequestContext, TransactionalConnection } from '@vendure/core';

import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';

@Injectable()
export class GroupBuyService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
    ) {}

    async findAll(ctx: RequestContext, options?: any): Promise<any> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        return this.listQueryBuilder.build(GroupBuyActivity, options, {
            ctx,
            repo,
            where: { channels: { id: ctx.channelId } },
        });
    }

    async findOne(ctx: RequestContext, id: number): Promise<GroupBuyActivity | undefined> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const result = await repo.findOne({
            where: { id, channels: { id: ctx.channelId } },
        });
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<GroupBuyActivity>): Promise<GroupBuyActivity> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const activity = new GroupBuyActivity(input);
        activity.channels = [ctx.channel];
        activity.currentCount = 0;
        activity.status = 'active';
        return repo.save(activity);
    }

    async update(ctx: RequestContext, id: number, input: Partial<GroupBuyActivity>): Promise<GroupBuyActivity> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const activity = await this.findOne(ctx, id);
        if (!activity) throw new Error(`GroupBuyActivity ${id} not found`);
        Object.assign(activity, input);
        return repo.save(activity);
    }

    async delete(ctx: RequestContext, id: number): Promise<void> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        await repo.delete(id);
    }

    async joinGroupBuy(ctx: RequestContext, activityId: number, isLeader: boolean): Promise<GroupBuyOrder> {
        const activity = await this.findOne(ctx, activityId);
        if (!activity) throw new Error(`GroupBuyActivity ${activityId} not found`);
        if (activity.status !== 'active') throw new Error('Activity is not active');
        if (activity.currentCount >= activity.maxCount && activity.maxCount > 0) {
            throw new Error('Activity is full');
        }

        const repo = this.connection.getRepository(ctx, GroupBuyOrder);
        const groupBuyOrder = new GroupBuyOrder({
            groupBuyActivityId: activityId,
            isLeader,
            status: 'pending',
        } as any);

        const saved = await repo.save(groupBuyOrder);

        activity.currentCount += 1;
        if (activity.currentCount >= activity.targetCount && activity.autoConfirm) {
            activity.status = 'completed';
        }
        await this.connection.getRepository(ctx, GroupBuyActivity).save(activity);

        return saved;
    }

    async findActiveByVariant(ctx: RequestContext, variantId: number): Promise<GroupBuyActivity | undefined> {
        const repo = this.connection.getRepository(ctx, GroupBuyActivity);
        const result = await repo.findOne({
            where: {
                variantId,
                status: 'active',
                channels: { id: ctx.channelId },
            },
        });
        return result ?? undefined;
    }
}
```

- [ ] **Step 2: 创建 src/group-buy-admin.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ListQueryOptions, RequestContext, Transaction } from '@vendure/core';

import { GroupBuyService } from './group-buy.service';
import { GroupBuyActivity } from './group-buy-activity.entity';

@Resolver()
export class GroupBuyAdminResolver {
    constructor(private groupBuyService: GroupBuyService) {}

    @Query()
    async groupBuyActivities(@Ctx() ctx: RequestContext, @Args() options: ListQueryOptions<GroupBuyActivity>) {
        return this.groupBuyService.findAll(ctx, options);
    }

    @Query()
    async groupBuyActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.groupBuyService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createGroupBuyActivity(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.groupBuyService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateGroupBuyActivity(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.groupBuyService.update(ctx, input.id, input);
    }

    @Mutation()
    @Transaction()
    async deleteGroupBuyActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        await this.groupBuyService.delete(ctx, id);
        return true;
    }
}
```

- [ ] **Step 3: 创建 src/group-buy-shop.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { GroupBuyService } from './group-buy.service';

@Resolver()
export class GroupBuyShopResolver {
    constructor(private groupBuyService: GroupBuyService) {}

    @Query()
    async activeGroupBuyActivities(@Ctx() ctx: RequestContext) {
        return this.groupBuyService.findAll(ctx, { filter: { status: { eq: 'active' } } });
    }

    @Query()
    async groupBuyActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.groupBuyService.findOne(ctx, id);
    }

    @Mutation()
    async joinGroupBuy(
        @Ctx() ctx: RequestContext,
        @Args('activityId') activityId: number,
        @Args('isLeader') isLeader: boolean,
    ) {
        return this.groupBuyService.joinGroupBuy(ctx, activityId, isLeader);
    }
}
```

- [ ] **Step 4: 创建 src/group-buy-promotion-condition.ts**

```typescript
import { LanguageCode, PromotionCondition } from '@vendure/core';

export const groupBuyDiscountCondition = new PromotionCondition({
    code: 'group_buy_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团优惠' },
        { languageCode: LanguageCode.en, value: 'Group Buy Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.groupBuyActivityId != null;
    },
    priorityValue: 900,
});
```

- [ ] **Step 5: 创建 src/group-buy-leader-promotion.ts**

```typescript
import { LanguageCode, PromotionCondition } from '@vendure/core';

export const groupBuyLeaderRewardCondition = new PromotionCondition({
    code: 'group_buy_leader_reward',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '拼团团长奖励' },
        { languageCode: LanguageCode.en, value: 'Group Buy Leader Reward' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.groupBuyIsLeader === true && ocf?.groupBuyActivityId != null;
    },
    priorityValue: 890,
});
```

- [ ] **Step 6: 创建 src/group-buy.job.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { JobQueue, JobQueueService, Logger, OrderService, RequestContext, ChannelService } from '@vendure/core';

import { loggerCtx } from './constants';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { TransactionalConnection } from '@vendure/core';

@Injectable()
export class GroupBuyJob {
    private jobQueue: JobQueue<{}>;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'group-buy-check',
            process: async (job) => {
                await this.checkExpiredActivities();
            },
        });
    }

    async scheduleCheck(): Promise<void> {
        await this.jobQueue.add({}, { delay: 60 * 1000 });
    }

    private async checkExpiredActivities(): Promise<void> {
        const repo = this.connection.getRepository(GroupBuyActivity) as any;
        const now = new Date();
        const expiredActivities = await repo.find({
            where: { status: 'active', endAt: { $lt: now } },
        });

        for (const activity of expiredActivities) {
            try {
                if (activity.currentCount >= activity.targetCount) {
                    activity.status = 'completed';
                } else {
                    activity.status = 'expired';
                    await this.cancelActivityOrders(activity);
                }
                await repo.save(activity);
                Logger.info(`GroupBuyActivity ${activity.id} status changed to ${activity.status}`, loggerCtx);
            } catch (e: any) {
                Logger.error(`Failed to process GroupBuyActivity ${activity.id}: ${e.message}`, loggerCtx);
            }
        }

        await this.scheduleCheck();
    }

    private async cancelActivityOrders(activity: GroupBuyActivity): Promise<void> {
        const gbOrderRepo = this.connection.getRepository(GroupBuyOrder) as any;
        const gbOrders = await gbOrderRepo.find({ where: { groupBuyActivityId: activity.id } });

        const channel = await this.channelService.findOne(activity.channels?.[0]?.id as any);
        if (!channel) return;

        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        for (const gbOrder of gbOrders) {
            try {
                if (gbOrder.status === 'pending') {
                    await this.orderService.cancelOrder(ctx, gbOrder.orderId);
                    gbOrder.status = 'failed';
                    await gbOrderRepo.save(gbOrder);
                }
            } catch (e: any) {
                Logger.error(`Failed to cancel order ${gbOrder.orderId}: ${e.message}`, loggerCtx);
            }
        }
    }
}
```

- [ ] **Step 7: 创建 src/plugin.ts**

```typescript
import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { GROUP_BUY_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { GroupBuyPluginOptions } from './types';
import { GroupBuyActivity } from './group-buy-activity.entity';
import { GroupBuyOrder } from './group-buy-order.entity';
import { GroupBuyService } from './group-buy.service';
import { GroupBuyAdminResolver } from './group-buy-admin.resolver';
import { GroupBuyShopResolver } from './group-buy-shop.resolver';
import { groupBuyDiscountCondition } from './group-buy-promotion-condition';
import { groupBuyLeaderRewardCondition } from './group-buy-leader-promotion';
import { GroupBuyJob } from './group-buy.job';
import { groupBuyOrderCustomFields } from './order-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [GroupBuyActivity, GroupBuyOrder],
    providers: [
        { provide: GROUP_BUY_PLUGIN_OPTIONS, useFactory: () => GroupBuyPlugin.options },
        GroupBuyService,
        GroupBuyJob,
    ],
    adminApiExtensions: {
        resolvers: [GroupBuyAdminResolver],
    },
    shopApiExtensions: {
        resolvers: [GroupBuyShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...groupBuyOrderCustomFields.Order,
        ];
        config.promotionConditions = [
            ...(config.promotionConditions ?? []),
            groupBuyDiscountCondition,
            groupBuyLeaderRewardCondition,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class GroupBuyPlugin implements OnApplicationBootstrap {
    private static options: GroupBuyPluginOptions = {};

    constructor(
        @Inject(GROUP_BUY_PLUGIN_OPTIONS) private options: GroupBuyPluginOptions,
        private groupBuyJob: GroupBuyJob,
    ) {}

    static init(options?: GroupBuyPluginOptions): Type<GroupBuyPlugin> {
        GroupBuyPlugin.options = options ?? {};
        return GroupBuyPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.groupBuyJob.init();
        await this.groupBuyJob.scheduleCheck();
    }
}
```

- [ ] **Step 8: 构建验证**

Run: `cd e:\code\vendure\packages\group-buy-plugin && npx tsc --noEmit`

- [ ] **Step 9: 提交**

```bash
git add packages/group-buy-plugin/
git commit -m "feat(group-buy-plugin): add service, resolvers, promotion conditions and job queue"
```

---

### Task 7: flash-sale-plugin

**Files:**
- Create: `packages/flash-sale-plugin/` 完整骨架（package.json, tsconfig, index.ts, constants.ts, types.ts）
- Create: `packages/flash-sale-plugin/src/flash-sale-activity.entity.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale.service.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale-admin.resolver.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale-shop.resolver.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale-promotion-condition.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale-eligibility-checker.ts`
- Create: `packages/flash-sale-plugin/src/flash-sale.job.ts`
- Create: `packages/flash-sale-plugin/src/order-custom-fields.ts`
- Create: `packages/flash-sale-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 package.json, tsconfig.json, tsconfig.build.json**

package.json 同 Task 5 模板，name 改为 `@vendure/flash-sale-plugin`。

- [ ] **Step 2: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'FlashSalePlugin';
export const FLASH_SALE_PLUGIN_OPTIONS = Symbol('FLASH_SALE_PLUGIN_OPTIONS');
```

- [ ] **Step 3: 创建 src/types.ts**

```typescript
export interface FlashSalePluginOptions {
    defaultTimeoutMinutes?: number;
}
```

- [ ] **Step 4: 创建 src/flash-sale-activity.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, VendureEntity } from '@vendure/core';

@Entity()
export class FlashSaleActivity extends VendureEntity implements ChannelAware {
    @Column() name: string;

    @Column() startAt: Date;

    @Column() endAt: Date;

    @Column() flashPrice: number;

    @Column() totalStock: number;

    @Column({ default: 0 }) soldCount: number;

    @Column({ default: 1 }) limitPerUser: number;

    @Column() productId: number;

    @Column() variantId: number;

    @Column({ default: 'upcoming' }) status: 'upcoming' | 'active' | 'ended';

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 5: 创建 src/flash-sale.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ListQueryBuilder, RequestContext, TransactionalConnection, OrderService } from '@vendure/core';

import { FlashSaleActivity } from './flash-sale-activity.entity';

@Injectable()
export class FlashSaleService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private orderService: OrderService,
    ) {}

    async findAll(ctx: RequestContext, options?: any): Promise<any> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        return this.listQueryBuilder.build(FlashSaleActivity, options, {
            ctx,
            repo,
            where: { channels: { id: ctx.channelId } },
        });
    }

    async findOne(ctx: RequestContext, id: number): Promise<FlashSaleActivity | undefined> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const result = await repo.findOne({
            where: { id, channels: { id: ctx.channelId } },
        });
        return result ?? undefined;
    }

    async create(ctx: RequestContext, input: Partial<FlashSaleActivity>): Promise<FlashSaleActivity> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const activity = new FlashSaleActivity(input);
        activity.channels = [ctx.channel];
        activity.soldCount = 0;
        const now = new Date();
        activity.status = input.startAt && input.startAt <= now ? 'active' : 'upcoming';
        return repo.save(activity);
    }

    async update(ctx: RequestContext, id: number, input: Partial<FlashSaleActivity>): Promise<FlashSaleActivity> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const activity = await this.findOne(ctx, id);
        if (!activity) throw new Error(`FlashSaleActivity ${id} not found`);
        Object.assign(activity, input);
        return repo.save(activity);
    }

    async delete(ctx: RequestContext, id: number): Promise<void> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        await repo.delete(id);
    }

    async checkEligibility(ctx: RequestContext, activityId: number, customerId: number): Promise<boolean> {
        const activity = await this.findOne(ctx, activityId);
        if (!activity || activity.status !== 'active') return false;

        const now = new Date();
        if (now < activity.startAt || now > activity.endAt) return false;
        if (activity.soldCount >= activity.totalStock) return false;

        if (activity.limitPerUser > 0 && customerId) {
            const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
            const flashSaleOrders = existingOrders.items.filter(
                (o: any) => o.customFields?.flashSaleActivityId === activityId && o.state !== 'Cancelled',
            );
            if (flashSaleOrders.length >= activity.limitPerUser) return false;
        }

        return true;
    }

    async findActiveByVariant(ctx: RequestContext, variantId: number): Promise<FlashSaleActivity | undefined> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const now = new Date();
        const result = await repo.findOne({
            where: {
                variantId,
                status: 'active',
                channels: { id: ctx.channelId },
            },
        });
        return result ?? undefined;
    }

    async incrementSoldCount(ctx: RequestContext, activityId: number): Promise<void> {
        const repo = this.connection.getRepository(ctx, FlashSaleActivity);
        const activity = await this.findOne(ctx, activityId);
        if (!activity) return;
        activity.soldCount += 1;
        if (activity.soldCount >= activity.totalStock) {
            activity.status = 'ended';
        }
        await repo.save(activity);
    }
}
```

- [ ] **Step 6: 创建 src/flash-sale-admin.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ListQueryOptions, RequestContext, Transaction } from '@vendure/core';

import { FlashSaleService } from './flash-sale.service';
import { FlashSaleActivity } from './flash-sale-activity.entity';

@Resolver()
export class FlashSaleAdminResolver {
    constructor(private flashSaleService: FlashSaleService) {}

    @Query()
    async flashSaleActivities(@Ctx() ctx: RequestContext, @Args() options: ListQueryOptions<FlashSaleActivity>) {
        return this.flashSaleService.findAll(ctx, options);
    }

    @Query()
    async flashSaleActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.flashSaleService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    async createFlashSaleActivity(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.flashSaleService.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    async updateFlashSaleActivity(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.flashSaleService.update(ctx, input.id, input);
    }

    @Mutation()
    @Transaction()
    async deleteFlashSaleActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        await this.flashSaleService.delete(ctx, id);
        return true;
    }
}
```

- [ ] **Step 7: 创建 src/flash-sale-shop.resolver.ts**

```typescript
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { FlashSaleService } from './flash-sale.service';

@Resolver()
export class FlashSaleShopResolver {
    constructor(private flashSaleService: FlashSaleService) {}

    @Query()
    async activeFlashSaleActivities(@Ctx() ctx: RequestContext) {
        return this.flashSaleService.findAll(ctx, { filter: { status: { eq: 'active' } } });
    }

    @Query()
    async flashSaleActivity(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.flashSaleService.findOne(ctx, id);
    }
}
```

- [ ] **Step 8: 创建 src/flash-sale-promotion-condition.ts**

```typescript
import { LanguageCode, PromotionCondition } from '@vendure/core';

export const flashSaleDiscountCondition = new PromotionCondition({
    code: 'flash_sale_discount',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀优惠' },
        { languageCode: LanguageCode.en, value: 'Flash Sale Discount' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        return ocf?.flashSaleActivityId != null;
    },
    priorityValue: 950,
});
```

- [ ] **Step 9: 创建 src/flash-sale-eligibility-checker.ts**

```typescript
import { LanguageCode, PromotionCondition } from '@vendure/core';

export const flashSaleEligibilityCondition = new PromotionCondition({
    code: 'flash_sale_eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '秒杀资格检查' },
        { languageCode: LanguageCode.en, value: 'Flash Sale Eligibility' },
    ],
    args: {},
    check: (ctx, order, args) => {
        const ocf = (order as any).customFields;
        if (!ocf?.flashSaleActivityId) return true;

        const now = new Date();
        const startAt = ocf?.flashSaleStartAt;
        const endAt = ocf?.flashSaleEndAt;
        if (startAt && now < new Date(startAt)) return false;
        if (endAt && now > new Date(endAt)) return false;

        return true;
    },
    priorityValue: 960,
});
```

- [ ] **Step 10: 创建 src/order-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const flashSaleOrderCustomFields: CustomFields = {
    Order: [
        {
            name: 'flashSaleActivityId',
            type: 'int',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀活动ID' }],
        },
        {
            name: 'flashSaleStartAt',
            type: 'datetime',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀开始时间' }],
        },
        {
            name: 'flashSaleEndAt',
            type: 'datetime',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '秒杀结束时间' }],
        },
    ],
};
```

- [ ] **Step 11: 创建 src/flash-sale.job.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { JobQueue, JobQueueService, Logger, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { FlashSaleActivity } from './flash-sale-activity.entity';

@Injectable()
export class FlashSaleJob {
    private jobQueue: JobQueue<{}>;

    constructor(
        private jobQueueService: JobQueueService,
        private connection: TransactionalConnection,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'flash-sale-status',
            process: async (job) => {
                await this.updateActivityStatuses();
            },
        });
    }

    async scheduleCheck(): Promise<void> {
        await this.jobQueue.add({}, { delay: 60 * 1000 });
    }

    private async updateActivityStatuses(): Promise<void> {
        const repo = this.connection.getRepository(FlashSaleActivity) as any;
        const now = new Date();

        const upcomingActivities = await repo.find({ where: { status: 'upcoming' } });
        for (const activity of upcomingActivities) {
            if (activity.startAt <= now) {
                activity.status = 'active';
                await repo.save(activity);
                Logger.info(`FlashSaleActivity ${activity.id} activated`, loggerCtx);
            }
        }

        const activeActivities = await repo.find({ where: { status: 'active' } });
        for (const activity of activeActivities) {
            if (activity.endAt <= now || activity.soldCount >= activity.totalStock) {
                activity.status = 'ended';
                await repo.save(activity);
                Logger.info(`FlashSaleActivity ${activity.id} ended`, loggerCtx);
            }
        }

        await this.scheduleCheck();
    }
}
```

- [ ] **Step 11: 创建 src/plugin.ts**

```typescript
import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { FLASH_SALE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { FlashSalePluginOptions } from './types';
import { FlashSaleActivity } from './flash-sale-activity.entity';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleAdminResolver } from './flash-sale-admin.resolver';
import { FlashSaleShopResolver } from './flash-sale-shop.resolver';
import { flashSaleDiscountCondition } from './flash-sale-promotion-condition';
import { flashSaleEligibilityCondition } from './flash-sale-eligibility-checker';
import { FlashSaleJob } from './flash-sale.job';
import { flashSaleOrderCustomFields } from './order-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [FlashSaleActivity],
    providers: [
        { provide: FLASH_SALE_PLUGIN_OPTIONS, useFactory: () => FlashSalePlugin.options },
        FlashSaleService,
        FlashSaleJob,
    ],
    adminApiExtensions: {
        resolvers: [FlashSaleAdminResolver],
    },
    shopApiExtensions: {
        resolvers: [FlashSaleShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...flashSaleOrderCustomFields.Order,
        ];
        config.promotionConditions = [
            ...(config.promotionConditions ?? []),
            flashSaleEligibilityCondition,
            flashSaleDiscountCondition,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class FlashSalePlugin implements OnApplicationBootstrap {
    private static options: FlashSalePluginOptions = {};

    constructor(
        @Inject(FLASH_SALE_PLUGIN_OPTIONS) private options: FlashSalePluginOptions,
        private flashSaleJob: FlashSaleJob,
    ) {}

    static init(options?: FlashSalePluginOptions): Type<FlashSalePlugin> {
        FlashSalePlugin.options = options ?? {};
        return FlashSalePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.flashSaleJob.init();
        await this.flashSaleJob.scheduleCheck();
    }
}
```

- [ ] **Step 12: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/flash-sale-activity.entity';
```

- [ ] **Step 13: 构建验证**

Run: `cd e:\code\vendure\packages\flash-sale-plugin && npx tsc --noEmit`

- [ ] **Step 14: 提交**

```bash
git add packages/flash-sale-plugin/
git commit -m "feat(flash-sale-plugin): add flash sale plugin with time window and stock control"
```

---

### Task 8: distribution-plugin 骨架 + 实体

**Files:**
- Create: `packages/distribution-plugin/` 完整骨架
- Create: `packages/distribution-plugin/src/distributor.entity.ts`
- Create: `packages/distribution-plugin/src/commission-record.entity.ts`
- Create: `packages/distribution-plugin/src/withdrawal-request.entity.ts`
- Create: `packages/distribution-plugin/src/channel-custom-fields.ts`
- Create: `packages/distribution-plugin/src/customer-custom-fields.ts`

- [ ] **Step 1: 创建 package.json, tsconfig.json, tsconfig.build.json**

package.json 同模板，name 改为 `@vendure/distribution-plugin`。

- [ ] **Step 2: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'DistributionPlugin';
export const DISTRIBUTION_PLUGIN_OPTIONS = Symbol('DISTRIBUTION_PLUGIN_OPTIONS');
```

- [ ] **Step 3: 创建 src/types.ts**

```typescript
export interface DistributionPluginOptions {
    defaultDirectRate?: number;
    defaultIndirectRate?: number;
    minWithdrawalAmount?: number;
    settlementDays?: number;
}
```

- [ ] **Step 4: 创建 src/distributor.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, VendureEntity } from '@vendure/core';

@Entity()
export class Distributor extends VendureEntity implements ChannelAware {
    @Column() customerId: number;

    @Column({ nullable: true }) parentId: number;

    @Column({ default: 1 }) level: number;

    @Column({ default: 'pending' }) status: 'active' | 'frozen' | 'pending';

    @Column({ default: 0 }) totalEarnings: number;

    @Column({ default: 0 }) availableBalance: number;

    @Column({ default: 0 }) frozenBalance: number;

    @Column({ unique: true }) referralCode: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 5: 创建 src/commission-record.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, VendureEntity } from '@vendure/core';

@Entity()
export class CommissionRecord extends VendureEntity implements ChannelAware {
    @Column() distributorId: number;

    @Column() orderId: number;

    @Column({ nullable: true }) orderLineId: number;

    @Column({ nullable: true }) fromDistributorId: number;

    @Column() commissionType: 'direct' | 'indirect';

    @Column() commissionRate: number;

    @Column() orderAmount: number;

    @Column() commissionAmount: number;

    @Column({ default: 'pending' }) status: 'pending' | 'confirmed' | 'paid' | 'cancelled';

    @Column({ type: 'datetime', nullable: true }) settledAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 6: 创建 src/withdrawal-request.entity.ts**

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, VendureEntity } from '@vendure/core';

@Entity()
export class WithdrawalRequest extends VendureEntity implements ChannelAware {
    @Column() distributorId: number;

    @Column() amount: number;

    @Column() method: 'bank' | 'alipay' | 'wechat';

    @Column() accountInfo: string;

    @Column({ default: 'pending' }) status: 'pending' | 'approved' | 'rejected' | 'paid';

    @Column({ type: 'datetime', nullable: true }) reviewedAt: Date;

    @Column({ type: 'datetime', nullable: true }) paidAt: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 7: 创建 src/channel-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const distributionChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'directCommissionRate',
            type: 'int',
            defaultValue: 1000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '直推佣金比例（万分之几）' }],
        },
        {
            name: 'indirectCommissionRate',
            type: 'int',
            defaultValue: 500,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '间推佣金比例（万分之几）' }],
        },
        {
            name: 'minWithdrawalAmount',
            type: 'int',
            defaultValue: 10000,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '最低提现金额（分）' }],
        },
        {
            name: 'commissionSettlementDays',
            type: 'int',
            defaultValue: 7,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '佣金结算周期（天）' }],
        },
        {
            name: 'distributionEnabled',
            type: 'boolean',
            defaultValue: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '启用分销' }],
        },
    ],
};
```

- [ ] **Step 8: 创建 src/customer-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const distributionCustomerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'referralCode',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '推荐码' }],
        },
        {
            name: 'referredBy',
            type: 'string',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '推荐人推荐码' }],
        },
    ],
};
```

- [ ] **Step 9: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/distributor.entity';
export * from './src/commission-record.entity';
export * from './src/withdrawal-request.entity';
```

- [ ] **Step 10: 构建验证**

Run: `cd e:\code\vendure\packages\distribution-plugin && npx tsc --noEmit`

- [ ] **Step 11: 提交**

```bash
git add packages/distribution-plugin/
git commit -m "feat(distribution-plugin): scaffold plugin with entities and custom fields"
```

---

### Task 9: distribution-plugin Services + Resolvers + JobQueue

**Files:**
- Create: `packages/distribution-plugin/src/distribution.service.ts`
- Create: `packages/distribution-plugin/src/commission.service.ts`
- Create: `packages/distribution-plugin/src/withdrawal.service.ts`
- Create: `packages/distribution-plugin/src/distribution-admin.resolver.ts`
- Create: `packages/distribution-plugin/src/distribution-shop.resolver.ts`
- Create: `packages/distribution-plugin/src/commission.job.ts`
- Create: `packages/distribution-plugin/src/plugin.ts`

- [ ] **Step 1: 创建 src/distribution.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ListQueryBuilder, RequestContext, TransactionalConnection } from '@vendure/core';

import { Distributor } from './distributor.entity';

@Injectable()
export class DistributionService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    async findAll(ctx: RequestContext, options?: any): Promise<any> {
        const repo = this.connection.getRepository(ctx, Distributor);
        return this.listQueryBuilder.build(Distributor, options, {
            ctx,
            repo,
            where: { channels: { id: ctx.channelId } },
        });
    }

    async findOne(ctx: RequestContext, id: number): Promise<Distributor | undefined> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const result = await repo.findOne({
            where: { id, channels: { id: ctx.channelId } },
        });
        return result ?? undefined;
    }

    async findByReferralCode(ctx: RequestContext, referralCode: string): Promise<Distributor | undefined> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const result = await repo.findOne({
            where: { referralCode, channels: { id: ctx.channelId } },
        });
        return result ?? undefined;
    }

    async findByCustomerId(ctx: RequestContext, customerId: number): Promise<Distributor | undefined> {
        const repo = this.connection.getRepository(ctx, Distributor);
        const result = await repo.findOne({
            where: { customerId, channels: { id: ctx.channelId } },
        });
        return result ?? undefined;
    }

    async apply(ctx: RequestContext, customerId: number): Promise<Distributor> {
        const existing = await this.findByCustomerId(ctx, customerId);
        if (existing) throw new Error('Already a distributor');

        const referralCode = this.generateReferralCode();
        const distributor = new Distributor({
            customerId,
            status: 'pending',
            referralCode,
            level: 1,
            totalEarnings: 0,
            availableBalance: 0,
            frozenBalance: 0,
        } as any);
        distributor.channels = [ctx.channel];

        return this.connection.getRepository(ctx, Distributor).save(distributor);
    }

    async approve(ctx: RequestContext, id: number): Promise<Distributor> {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) throw new Error(`Distributor ${id} not found`);
        distributor.status = 'active';
        return this.connection.getRepository(ctx, Distributor).save(distributor);
    }

    async freeze(ctx: RequestContext, id: number): Promise<Distributor> {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) throw new Error(`Distributor ${id} not found`);
        distributor.status = 'frozen';
        return this.connection.getRepository(ctx, Distributor).save(distributor);
    }

    private generateReferralCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}
```

- [ ] **Step 2: 创建 src/commission.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { EventBus, Logger, ListQueryBuilder, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { Distributor } from './distributor.entity';
import { CommissionRecord } from './commission-record.entity';
import { DistributionService } from './distribution.service';

@Injectable()
export class CommissionService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private distributionService: DistributionService,
        private eventBus: EventBus,
    ) {}

    async init(): Promise<void> {
        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === 'Settled') {
                try {
                    await this.calculateCommission(event.ctx, event.order);
                } catch (e: any) {
                    Logger.error(`Failed to calculate commission for order ${event.order.id}: ${e.message}`, loggerCtx);
                }
            }
        });
    }

    async calculateCommission(ctx: RequestContext, order: any): Promise<void> {
        const customer = order.customer;
        if (!customer) return;

        const referralCode = customer.customFields?.referralCode;
        if (!referralCode) return;

        const directDistributor = await this.distributionService.findByReferralCode(ctx, referralCode);
        if (!directDistributor || directDistributor.status !== 'active') return;

        const ccf = (ctx.channel as any).customFields;
        const directRate = ccf?.directCommissionRate ?? 1000;
        const indirectRate = ccf?.indirectCommissionRate ?? 500;
        const orderTotal = order.total;

        await this.createRecord(ctx, {
            distributorId: directDistributor.id,
            orderId: order.id,
            commissionType: 'direct',
            commissionRate: directRate,
            orderAmount: orderTotal,
            commissionAmount: Math.floor(orderTotal * directRate / 10000),
        });

        if (directDistributor.parentId) {
            const parentDistributor = await this.distributionService.findOne(ctx, directDistributor.parentId);
            if (parentDistributor && parentDistributor.status === 'active') {
                await this.createRecord(ctx, {
                    distributorId: parentDistributor.id,
                    orderId: order.id,
                    fromDistributorId: directDistributor.id,
                    commissionType: 'indirect',
                    commissionRate: indirectRate,
                    orderAmount: orderTotal,
                    commissionAmount: Math.floor(orderTotal * indirectRate / 10000),
                });
            }
        }
    }

    private async createRecord(ctx: RequestContext, data: Partial<CommissionRecord>): Promise<CommissionRecord> {
        const repo = this.connection.getRepository(ctx, CommissionRecord);
        const record = new CommissionRecord(data as any);
        record.channels = [ctx.channel];
        return repo.save(record);
    }

    async findAll(ctx: RequestContext, options?: any): Promise<any> {
        const repo = this.connection.getRepository(ctx, CommissionRecord);
        return this.listQueryBuilder.build(CommissionRecord, options, {
            ctx,
            repo,
            where: { channels: { id: ctx.channelId } },
        });
    }

    async findByDistributor(ctx: RequestContext, distributorId: number): Promise<CommissionRecord[]> {
        const repo = this.connection.getRepository(ctx, CommissionRecord);
        return repo.find({
            where: { distributorId, channels: { id: ctx.channelId } },
        });
    }

    async settlePendingCommissions(): Promise<void> {
        const repo = this.connection.getRepository(CommissionRecord) as any;
        const ccf = (await this.connection.getRepository(CommissionRecord).manager?.query?.('SELECT 1')) as any;

        const pendingRecords = await repo.find({ where: { status: 'pending' } });
        const now = new Date();

        for (const record of pendingRecords) {
            const ccf2 = (record.channels?.[0] as any)?.customFields;
            const settlementDays = ccf2?.commissionSettlementDays ?? 7;
            const settledAt = new Date(record.createdAt);
            settledAt.setDate(settledAt.getDate() + settlementDays);

            if (now >= settledAt) {
                record.status = 'confirmed';
                record.settledAt = now;
                await repo.save(record);

                const distributorRepo = this.connection.getRepository(Distributor) as any;
                const distributor = await distributorRepo.findOne({ where: { id: record.distributorId } });
                if (distributor) {
                    distributor.availableBalance += record.commissionAmount;
                    distributor.totalEarnings += record.commissionAmount;
                    distributor.frozenBalance = Math.max(0, distributor.frozenBalance - record.commissionAmount);
                    await distributorRepo.save(distributor);
                }
            }
        }
    }
}
```

- [ ] **Step 3: 创建 src/withdrawal.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ListQueryBuilder, RequestContext, TransactionalConnection } from '@vendure/core';

import { WithdrawalRequest } from './withdrawal-request.entity';
import { Distributor } from './distributor.entity';
import { DistributionService } from './distribution.service';

@Injectable()
export class WithdrawalService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private distributionService: DistributionService,
    ) {}

    async findAll(ctx: RequestContext, options?: any): Promise<any> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        return this.listQueryBuilder.build(WithdrawalRequest, options, {
            ctx,
            repo,
            where: { channels: { id: ctx.channelId } },
        });
    }

    async findByDistributor(ctx: RequestContext, distributorId: number): Promise<WithdrawalRequest[]> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        return repo.find({
            where: { distributorId, channels: { id: ctx.channelId } },
        });
    }

    async request(ctx: RequestContext, distributorId: number, amount: number, method: 'bank' | 'alipay' | 'wechat', accountInfo: string): Promise<WithdrawalRequest> {
        const distributor = await this.distributionService.findOne(ctx, distributorId);
        if (!distributor) throw new Error('Distributor not found');

        const ccf = (ctx.channel as any).customFields;
        const minAmount = ccf?.minWithdrawalAmount ?? 10000;
        if (amount < minAmount) throw new Error(`Minimum withdrawal amount is ${minAmount}`);
        if (amount > distributor.availableBalance) throw new Error('Insufficient balance');

        distributor.availableBalance -= amount;
        distributor.frozenBalance += amount;
        await this.connection.getRepository(ctx, Distributor).save(distributor);

        const request = new WithdrawalRequest({
            distributorId,
            amount,
            method,
            accountInfo,
            status: 'pending',
        } as any);
        request.channels = [ctx.channel];

        return this.connection.getRepository(ctx, WithdrawalRequest).save(request);
    }

    async approve(ctx: RequestContext, id: number): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id, channels: { id: ctx.channelId } } });
        if (!request) throw new Error('Withdrawal request not found');
        request.status = 'approved';
        request.reviewedAt = new Date();
        return repo.save(request);
    }

    async reject(ctx: RequestContext, id: number): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id, channels: { id: ctx.channelId } } });
        if (!request) throw new Error('Withdrawal request not found');
        request.status = 'rejected';
        request.reviewedAt = new Date();

        const distributor = await this.distributionService.findOne(ctx, request.distributorId);
        if (distributor) {
            distributor.frozenBalance -= request.amount;
            distributor.availableBalance += request.amount;
            await this.connection.getRepository(ctx, Distributor).save(distributor);
        }

        return repo.save(request);
    }

    async markPaid(ctx: RequestContext, id: number): Promise<WithdrawalRequest> {
        const repo = this.connection.getRepository(ctx, WithdrawalRequest);
        const request = await repo.findOne({ where: { id, channels: { id: ctx.channelId } } });
        if (!request) throw new Error('Withdrawal request not found');
        request.status = 'paid';
        request.paidAt = new Date();

        const distributor = await this.distributionService.findOne(ctx, request.distributorId);
        if (distributor) {
            distributor.frozenBalance -= request.amount;
            await this.connection.getRepository(ctx, Distributor).save(distributor);
        }

        return repo.save(request);
    }
}
```

- [ ] **Step 4: 创建 src/distribution-admin.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ListQueryOptions, RequestContext, Transaction } from '@vendure/core';

import { DistributionService } from './distribution.service';
import { CommissionService } from './commission.service';
import { WithdrawalService } from './withdrawal.service';

@Resolver()
export class DistributionAdminResolver {
    constructor(
        private distributionService: DistributionService,
        private commissionService: CommissionService,
        private withdrawalService: WithdrawalService,
    ) {}

    @Query()
    async distributors(@Ctx() ctx: RequestContext, @Args() options: ListQueryOptions<any>) {
        return this.distributionService.findAll(ctx, options);
    }

    @Query()
    async commissionRecords(@Ctx() ctx: RequestContext, @Args() options: ListQueryOptions<any>) {
        return this.commissionService.findAll(ctx, options);
    }

    @Query()
    async withdrawalRequests(@Ctx() ctx: RequestContext, @Args() options: ListQueryOptions<any>) {
        return this.withdrawalService.findAll(ctx, options);
    }

    @Mutation()
    @Transaction()
    async approveDistributor(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.distributionService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    async freezeDistributor(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.distributionService.freeze(ctx, id);
    }

    @Mutation()
    @Transaction()
    async approveWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.withdrawalService.approve(ctx, id);
    }

    @Mutation()
    @Transaction()
    async rejectWithdrawal(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.withdrawalService.reject(ctx, id);
    }

    @Mutation()
    @Transaction()
    async markWithdrawalPaid(@Ctx() ctx: RequestContext, @Args('id') id: number) {
        return this.withdrawalService.markPaid(ctx, id);
    }
}
```

- [ ] **Step 5: 创建 src/distribution-shop.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { DistributionService } from './distribution.service';
import { CommissionService } from './commission.service';
import { WithdrawalService } from './withdrawal.service';

@Resolver()
export class DistributionShopResolver {
    constructor(
        private distributionService: DistributionService,
        private commissionService: CommissionService,
        private withdrawalService: WithdrawalService,
    ) {}

    @Query()
    async myDistributorProfile(@Ctx() ctx: RequestContext) {
        if (!ctx.activeUserId) return null;
        const customer = (ctx as any).customer;
        if (!customer) return null;
        return this.distributionService.findByCustomerId(ctx, customer.id);
    }

    @Query()
    async myCommissionRecords(@Ctx() ctx: RequestContext) {
        if (!ctx.activeUserId) return [];
        const customer = (ctx as any).customer;
        if (!customer) return [];
        const distributor = await this.distributionService.findByCustomerId(ctx, customer.id);
        if (!distributor) return [];
        return this.commissionService.findByDistributor(ctx, distributor.id);
    }

    @Query()
    async myWithdrawalRequests(@Ctx() ctx: RequestContext) {
        if (!ctx.activeUserId) return [];
        const customer = (ctx as any).customer;
        if (!customer) return [];
        const distributor = await this.distributionService.findByCustomerId(ctx, customer.id);
        if (!distributor) return [];
        return this.withdrawalService.findByDistributor(ctx, distributor.id);
    }

    @Mutation()
    async applyDistributor(@Ctx() ctx: RequestContext) {
        if (!ctx.activeUserId) throw new Error('Not authenticated');
        const customer = (ctx as any).customer;
        if (!customer) throw new Error('Customer not found');
        return this.distributionService.apply(ctx, customer.id);
    }

    @Mutation()
    async requestWithdrawal(
        @Ctx() ctx: RequestContext,
        @Args('amount') amount: number,
        @Args('method') method: 'bank' | 'alipay' | 'wechat',
        @Args('accountInfo') accountInfo: string,
    ) {
        if (!ctx.activeUserId) throw new Error('Not authenticated');
        const customer = (ctx as any).customer;
        if (!customer) throw new Error('Customer not found');
        const distributor = await this.distributionService.findByCustomerId(ctx, customer.id);
        if (!distributor) throw new Error('Not a distributor');
        return this.withdrawalService.request(ctx, distributor.id, amount, method, accountInfo);
    }
}
```

- [ ] **Step 6: 创建 src/commission.job.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { JobQueue, JobQueueService, Logger } from '@vendure/core';

import { loggerCtx } from './constants';
import { CommissionService } from './commission.service';

@Injectable()
export class CommissionJob {
    private jobQueue: JobQueue<{}>;

    constructor(
        private jobQueueService: JobQueueService,
        private commissionService: CommissionService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'commission-settlement',
            process: async (job) => {
                await this.commissionService.settlePendingCommissions();
            },
        });
    }

    async scheduleSettlement(): Promise<void> {
        await this.jobQueue.add({}, { delay: 24 * 60 * 60 * 1000 });
    }
}
```

- [ ] **Step 7: 创建 src/plugin.ts**

```typescript
import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { DISTRIBUTION_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { DistributionPluginOptions } from './types';
import { Distributor } from './distributor.entity';
import { CommissionRecord } from './commission-record.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { distributionChannelCustomFields } from './channel-custom-fields';
import { distributionCustomerCustomFields } from './customer-custom-fields';
import { DistributionService } from './distribution.service';
import { CommissionService } from './commission.service';
import { WithdrawalService } from './withdrawal.service';
import { DistributionAdminResolver } from './distribution-admin.resolver';
import { DistributionShopResolver } from './distribution-shop.resolver';
import { CommissionJob } from './commission.job';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Distributor, CommissionRecord, WithdrawalRequest],
    providers: [
        { provide: DISTRIBUTION_PLUGIN_OPTIONS, useFactory: () => DistributionPlugin.options },
        DistributionService,
        CommissionService,
        WithdrawalService,
        CommissionJob,
    ],
    adminApiExtensions: {
        resolvers: [DistributionAdminResolver],
    },
    shopApiExtensions: {
        resolvers: [DistributionShopResolver],
    },
    configuration: (config) => {
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...distributionChannelCustomFields.Channel,
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            ...distributionCustomerCustomFields.Customer,
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class DistributionPlugin implements OnApplicationBootstrap {
    private static options: DistributionPluginOptions = {};

    constructor(
        @Inject(DISTRIBUTION_PLUGIN_OPTIONS) private options: DistributionPluginOptions,
        private commissionService: CommissionService,
        private commissionJob: CommissionJob,
    ) {}

    static init(options?: DistributionPluginOptions): Type<DistributionPlugin> {
        DistributionPlugin.options = options ?? {};
        return DistributionPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.commissionService.init();
        await this.commissionJob.init();
        await this.commissionJob.scheduleSettlement();
    }
}
```

- [ ] **Step 8: 构建验证**

Run: `cd e:\code\vendure\packages\distribution-plugin && npx tsc --noEmit`

- [ ] **Step 9: 提交**

```bash
git add packages/distribution-plugin/
git commit -m "feat(distribution-plugin): add two-level distribution with commission and withdrawal"
```

---

### Task 10: 全量构建验证

- [ ] **Step 1: 构建所有 6 个新插件**

Run: 对每个插件目录执行 `npx tsc --noEmit`

- [ ] **Step 2: 验证与已有 6 个插件的 CustomFields 不冲突**

检查所有插件的 Channel/Order/Fulfillment/Customer CustomFields 字段名是否唯一。

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: complete extended features plugin suite v1"
```
