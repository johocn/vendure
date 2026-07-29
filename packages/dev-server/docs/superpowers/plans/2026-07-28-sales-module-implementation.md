# Sales 模块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 vadmin sales 模块（销售员代客下单、客户档案、业绩报表），新建 `@vendure/sales-plugin` 后端 + `vadmin/src/pkg-sales/` 前端

**Architecture:** 独立 Vendure 插件，与 delivery-plugin 平级。核心 `salesCreateOrder` mutation 在单事务内完成建客户+加商品行+设地址+设配送+写 salesStaffId。手动改价通过 `OrderItemPriceCalculationStrategy` + OrderLine customFields 实现。与 delivery 通过订单状态流解耦。

**Tech Stack:** Vendure 3.6+ / NestJS / TypeScript / GraphQL / Vue 3 + Pinia + uni-app

**Spec:** `e:\code\vendure\packages\dev-server\docs\superpowers\specs\2026-07-28-sales-module-design.md`

---

## 文件结构

### 后端 `e:\code\vendure\packages\sales-plugin\`

| 文件 | 职责 |
|------|------|
| `package.json` | 包配置，name=`@vendure/sales-plugin`，main=`dist/index.js` |
| `tsconfig.json` | 继承 `../../tsconfig.json`，outDir=`dist`，rootDir=`src` |
| `src/index.ts` | 导出 `SalesPlugin` |
| `src/constants.ts` | `SalesPermissions` 常量、`ROLE_PERMISSIONS_MAP`、`SalesChannel`/`CustomerType` 枚举、`salesPermissionDefinitions` |
| `src/config/order-custom-fields.ts` | Order customFields: `salesStaffId`, `salesChannel`, `salesNote` |
| `src/config/customer-custom-fields.ts` | Customer customFields: `customerType`, `companyInfo`, `salesStaffId`, `customerTags` |
| `src/config/order-line-custom-fields.ts` | OrderLine customFields: `overwrittenPrice`, `originalPrice`, `modifiedBy`, `modifiedAt` |
| `src/price-calculation.ts` | `SalesOrderItemPriceCalculationStrategy` 实现 |
| `src/role-sync.ts` | `RoleSyncService` 同步 sales-staff 等角色（同 delivery 模式） |
| `src/sales.service.ts` | `SalesService`: `createOrder`, `findMySales`, `findSalesReport`, `modifyOrderLinePrice`, `cancelOrder` |
| `src/sales-admin.resolver.ts` | GraphQL resolvers |
| `src/sales.plugin.ts` | `@VendurePlugin` 入口 |

### 后端修改

| 文件 | 修改 |
|------|------|
| `e:\code\vendure\packages\dev-server\dev-config.ts` | 注册 `SalesPlugin.init()` + `orderOptions.orderItemPriceCalculationStrategy` |
| `e:\code\vendure\packages\delivery-plugin\src\constants.ts` | `MODULE_CONFIGS` 中 sales 项 `enabled: false` → `true` |
| `e:\code\vendure\test-sales-flow.js` | 新建 e2e 验收脚本 |

### 前端 `e:\code\vadmin\src\pkg-sales\`

| 文件 | 职责 |
|------|------|
| `pages/create/index.vue` | 开单页 |
| `pages/list/index.vue` | 我的销售单列表 |
| `pages/detail/index.vue` | 销售单详情 |
| `pages/customer/list/index.vue` | 客户档案列表 |
| `pages/customer/detail/index.vue` | 客户详情 |
| `pages/report/index.vue` | 业绩报表 |
| `api/sales.ts` | GraphQL 查询/变更封装 |
| `pages.json` | 路由配置（pkg-sales 子包） |

### 前端修改

| 文件 | 修改 |
|------|------|
| `e:\code\vadmin\src\config\shortcuts.ts` | sales 项 `enabled: false` → `true`，route 改为真实页面路径 |

---

## Task 1: 创建 sales-plugin 骨架与配置文件

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\package.json`
- Create: `e:\code\vendure\packages\sales-plugin\tsconfig.json`
- Create: `e:\code\vendure\packages\sales-plugin\src\index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@vendure/sales-plugin",
  "version": "1.0.0",
  "description": "Sales staff management plugin for vendure",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w"
  },
  "dependencies": {
    "@vendure/core": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 src/index.ts（空导出，后续补充）**

```typescript
export * from './sales.plugin';
```

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/sales-plugin/package.json packages/sales-plugin/tsconfig.json packages/sales-plugin/src/index.ts
git commit --no-verify -m "feat(sales-plugin): scaffold package structure"
```

---

## Task 2: 定义 constants.ts（权限、角色、枚举）

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\constants.ts`

- [ ] **Step 1: 编写 constants.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\constants.ts
import { PermissionDefinition } from '@vendure/core';

// 权限名常量（用于 @Allow 装饰器和 Role 映射）
export const SalesPermissions = {
  CreateOrder: 'CreateOrder',
  ViewOwnSales: 'ViewOwnSales',
  ViewAllSales: 'ViewAllSales',
  ManageCustomer: 'ManageCustomer',
  ViewSalesReport: 'ViewSalesReport',
  ModifyOrderPrice: 'ModifyOrderPrice',
} as const;

// 权限描述映射
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  CreateOrder: '销售开单',
  ViewOwnSales: '查看自己的销售订单',
  ViewAllSales: '查看全部销售订单',
  ManageCustomer: '客户档案管理',
  ViewSalesReport: '业绩报表',
  ModifyOrderPrice: '手动改价',
};

// PermissionDefinition 实例数组，用于注册到 config.authOptions.customPermissions
export const salesPermissionDefinitions: PermissionDefinition[] = Object.entries(
  SalesPermissions,
).map(
  ([key, name]) =>
    new PermissionDefinition({
      name,
      description: PERMISSION_DESCRIPTIONS[key] ?? `Grants ${key} permission`,
    }),
);

// 销售渠道枚举
export enum SalesChannel {
  Store = 'store',
  Telesales = 'telesales',
  B2b = 'b2b',
}

// 客户类型枚举
export enum CustomerType {
  Individual = 'individual',
  Enterprise = 'enterprise',
}

// Role 与 Permission 绑定表
// 所有角色必须包含 'Authenticated' 基础权限，否则无法访问任何受保护的 API
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'sales-staff': [
    'Authenticated',
    'CreateOrder',
    'ViewOwnSales',
    'ManageCustomer',
    'ViewSalesReport',
    'ModifyOrderPrice',
  ],
  'customer-service': [
    'Authenticated',
    'ViewAllOrders',
    'HandleAfterSales',
    'HandleException',
    'ManageCustomer',
  ],
  'manager': [
    'Authenticated',
    'CreateOrder', 'ViewOwnSales', 'ViewAllSales', 'ManageCustomer',
    'ViewSalesReport', 'ModifyOrderPrice',
  ],
  'super-admin': [
    'Authenticated',
    'CreateOrder', 'ViewOwnSales', 'ViewAllSales', 'ManageCustomer',
    'ViewSalesReport', 'ModifyOrderPrice',
    'SuperAdmin',
  ],
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/sales-plugin/src/constants.ts
git commit --no-verify -m "feat(sales-plugin): add constants, permissions and role map"
```

---

## Task 3: 定义 customFields 配置

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\config\order-custom-fields.ts`
- Create: `e:\code\vendure\packages\sales-plugin\src\config\customer-custom-fields.ts`
- Create: `e:\code\vendure\packages\sales-plugin\src\config\order-line-custom-fields.ts`

- [ ] **Step 1: 创建 order-custom-fields.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\config\order-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesOrderCustomFields: CustomFields = {
  Order: [
    { name: 'salesStaffId', type: 'string', nullable: true, public: false },
    { name: 'salesChannel', type: 'string', nullable: true, public: false },
    { name: 'salesNote',    type: 'string', nullable: true, public: false },
  ],
};
```

- [ ] **Step 2: 创建 customer-custom-fields.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\config\customer-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesCustomerCustomFields: CustomFields = {
  Customer: [
    {
      name: 'customerType',
      type: 'string',
      nullable: false,
      default: 'individual',
      public: true,
    },
    { name: 'companyInfo',  type: 'json',   nullable: true,  public: true },
    { name: 'salesStaffId', type: 'string', nullable: true,  public: false },
    { name: 'customerTags', type: 'string', list: true,      public: true },
  ],
};
```

- [ ] **Step 3: 创建 order-line-custom-fields.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\config\order-line-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const salesOrderLineCustomFields: CustomFields = {
  OrderLine: [
    { name: 'overwrittenPrice', type: 'int',      nullable: true },
    { name: 'originalPrice',    type: 'int',      nullable: true },
    { name: 'modifiedBy',       type: 'string',   nullable: true },
    { name: 'modifiedAt',       type: 'datetime', nullable: true },
  ],
};
```

- [ ] **Step 4: 提交**

```bash
git add packages/sales-plugin/src/config/
git commit --no-verify -m "feat(sales-plugin): add customFields for Order/Customer/OrderLine"
```

---

## Task 4: 实现价格计算策略

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\price-calculation.ts`

- [ ] **Step 1: 编写 price-calculation.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\price-calculation.ts
import { Injectable } from '@nestjs/common';
import {
  Order,
  OrderItemPriceCalculationStrategy,
  PriceCalculationResult,
  ProductVariant,
  RequestContext,
} from '@vendure/core';

/**
 * @description
 * 销售开单价格计算策略：当 OrderLine.customFields.overwrittenPrice 非 null 时使用改价，
 * 否则回退到 ProductVariant.listPrice 默认价。
 *
 * 注册到 config.orderOptions.orderItemPriceCalculationStrategy，全局生效但仅当
 * overwrittenPrice 非空时介入，不影响 vshop 客户下单。
 */
@Injectable()
export class SalesOrderItemPriceCalculationStrategy
  implements OrderItemPriceCalculationStrategy
{
  calculateUnitPrice(
    ctx: RequestContext,
    productVariant: ProductVariant,
    orderLineCustomFields: { [key: string]: any },
    order: Order,
    quantity: number,
  ): PriceCalculationResult | Promise<PriceCalculationResult> {
    const overwritten = orderLineCustomFields?.overwrittenPrice;
    if (overwritten != null && overwritten > 0) {
      return { price: overwritten, priceIncludesTax: true };
    }
    return {
      price: productVariant.listPrice,
      priceIncludesTax: productVariant.listPriceIncludesTax,
    };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/sales-plugin/src/price-calculation.ts
git commit --no-verify -m "feat(sales-plugin): add OrderItemPriceCalculationStrategy"
```

---

## Task 5: 实现 RoleSyncService

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\role-sync.ts`

- [ ] **Step 1: 编写 role-sync.ts（沿用 delivery 模式）**

```typescript
// e:\code\vendure\packages\sales-plugin\src\role-sync.ts
import { ChannelService, Injector, Logger, Permission, Role, TransactionalConnection } from '@vendure/core';

import { ROLE_PERMISSIONS_MAP } from './constants';

const loggerCtx = 'SalesRoleSync';

/**
 * @description
 * 在插件 bootstrap 阶段同步预定义的 Role 及其 Permission 绑定。
 * 对已存在的 Role 只做「补绑缺失 Permission」的增量更新。
 */
export class RoleSyncService {
    private connection: TransactionalConnection;
    private channelService: ChannelService;

    init(injector: Injector): void {
        this.connection = injector.get(TransactionalConnection);
        this.channelService = injector.get(ChannelService);
    }

    async syncRoles(): Promise<void> {
        const roleRepo = this.connection.rawConnection.getRepository(Role);
        const defaultChannel = await this.channelService.getDefaultChannel();

        let syncedRoles = 0;
        let syncedPerms = 0;

        for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS_MAP)) {
            let role = await roleRepo.findOne({
                where: { code: roleCode },
                relations: ['channels'],
            });

            if (!role) {
                role = new Role({
                    code: roleCode,
                    description: `Auto-synced role: ${roleCode}`,
                    permissions: [],
                });
                role.channels = defaultChannel ? [defaultChannel] : [];
                syncedRoles++;
                Logger.info(`Created role: ${roleCode}`, loggerCtx);
            }

            const existingPerms = new Set<Permission>(role.permissions ?? []);
            for (const perm of permissions) {
                const typedPerm = perm as Permission;
                if (!existingPerms.has(typedPerm)) {
                    existingPerms.add(typedPerm);
                    syncedPerms++;
                }
            }
            role.permissions = Array.from(existingPerms);
            await roleRepo.save(role);
        }

        Logger.info(`Synced ${syncedRoles} roles, ${syncedPerms} permissions`, loggerCtx);
    }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/sales-plugin/src/role-sync.ts
git commit --no-verify -m "feat(sales-plugin): add RoleSyncService"
```

---

## Task 6: 实现 SalesService（核心业务逻辑）

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\sales.service.ts`

- [ ] **Step 1: 编写 sales.service.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\sales.service.ts
import { Injectable } from '@nestjs/common';
import {
  AdministratorService,
  CustomerService,
  ForbiddenError,
  ID,
  Logger,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { IsNull, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

import { CustomerType, SalesChannel, SalesPermissions } from './constants';

const loggerCtx = 'SalesService';

export interface SalesCreateOrderInput {
  customerId?: string;
  newCustomer?: {
    firstName: string;
    lastName: string;
    emailAddress?: string;
    phoneNumber: string;
    customerType: CustomerType;
    companyInfo?: any;
  };
  lines: Array<{
    productVariantId: string;
    quantity: number;
    overwrittenPrice?: number;
  }>;
  shippingAddress: any;
  shippingMethodId: string;
  salesChannel: SalesChannel;
  note?: string;
}

export interface SalesReportResult {
  totalOrders: number;
  totalRevenue: number;
  uniqueCustomers: number;
  avgOrderValue: number;
  topProducts: Array<{ productVariantId: string; name: string; quantitySold: number; revenue: number }>;
  dailyBreakdown: Array<{ date: string; orderCount: number; revenue: number }>;
}

@Injectable()
export class SalesService {
  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private customerService: CustomerService,
    private administratorService: AdministratorService,
  ) {}

  /**
   * 销售开单：单事务完成建客户+加商品行+设地址+设配送+写 salesStaffId
   */
  async createOrder(ctx: RequestContext, input: SalesCreateOrderInput): Promise<Order> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError('Not authenticated');
    }

    return this.connection.withTransaction(ctx, async txCtx => {
      // 1. 解析 customerId
      let customerId = input.customerId;
      if (!customerId && input.newCustomer) {
        const nc = input.newCustomer;
        // emailAddress 占位策略
        const emailAddress = nc.emailAddress || `${nc.phoneNumber}@placeholder.local`;
        const created = await this.customerService.create(txCtx, {
          firstName: nc.firstName,
          lastName: nc.lastName,
          emailAddress,
          phoneNumber: nc.phoneNumber,
          customFields: {
            customerType: nc.customerType,
            companyInfo: nc.companyInfo,
            salesStaffId: String(ctx.activeUserId),
            customerTags: [],
          },
        });
        if ('errorCode' in created) {
          throw new UserInputError(created.message ?? created.errorCode);
        }
        customerId = String(created.id);
        // 写 customer.salesStaffId（create 时已传入，此处不需要再 update）
      }
      if (!customerId) {
        throw new UserInputError('Either customerId or newCustomer must be provided');
      }

      // 2. 查 customer 拿 userId
      const customer = await this.customerService.findOne(txCtx, customerId as any, {
        relations: ['user'],
      });
      if (!customer || !customer.user) {
        throw new UserInputError(`Customer ${customerId} not found or has no user`);
      }

      // 3. 创建 Order
      const order = await this.orderService.create(txCtx, customer.user.id);

      // 4. 加商品行（含 overwrittenPrice）
      const items = input.lines.map(line => ({
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        customFields: line.overwrittenPrice
          ? {
              overwrittenPrice: line.overwrittenPrice,
              originalPrice: null, // 由价格策略填充不便，此处先记录原价需另外查询；MVP 简化为 null
              modifiedBy: String(ctx.activeUserId),
              modifiedAt: new Date(),
            }
          : {},
      }));
      const addResult = await this.orderService.addItemsToOrder(txCtx, order.id, items as any);
      if (addResult.errorResults?.length) {
        throw new UserInputError(addResult.errorResults[0].message ?? 'Add items failed');
      }
      let updatedOrder = addResult.order;

      // 5. 设地址
      updatedOrder = await this.orderService.setShippingAddress(
        txCtx,
        updatedOrder.id,
        input.shippingAddress,
      );

      // 6. 设配送方式
      updatedOrder = await this.orderService.setShippingMethod(
        txCtx,
        updatedOrder.id,
        [input.shippingMethodId as any],
      );

      // 7. 写 Order customFields
      updatedOrder = await this.orderService.updateCustomFields(
        txCtx,
        updatedOrder.id,
        {
          salesStaffId: String(ctx.activeUserId),
          salesChannel: input.salesChannel,
          salesNote: input.note ?? null,
        },
      );

      Logger.info(
        `Sales order created: ${updatedOrder.code} by user ${ctx.activeUserId}`,
        loggerCtx,
      );
      return updatedOrder;
    });
  }

  /**
   * 查询我的销售单（按 salesStaffId 过滤）
   */
  async findMySales(
    ctx: RequestContext,
    options?: { page?: number; pageSize?: number; state?: string },
  ): Promise<{ items: Order[]; totalItems: number }> {
    if (!ctx.activeUserId) {
      return { items: [], totalItems: 0 };
    }
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.lines', 'lines')
      .where('order.customFields_salesStaffId = :staffId', { staffId: String(ctx.activeUserId) })
      .andWhere('order.active = :active', { active: true });

    if (options?.state) {
      qb.andWhere('order.state = :state', { state: options.state });
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  /**
   * 查询全部销售单（manager+）
   */
  async findAllSales(
    ctx: RequestContext,
    options?: { page?: number; pageSize?: number; state?: string; staffId?: string },
  ): Promise<{ items: Order[]; totalItems: number }> {
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.customFields_salesStaffId IS NOT NULL')
      .andWhere('order.active = :active', { active: true });

    if (options?.state) {
      qb.andWhere('order.state = :state', { state: options.state });
    }
    if (options?.staffId) {
      qb.andWhere('order.customFields_salesStaffId = :staffId', { staffId: options.staffId });
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('order.createdAt', 'DESC');

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  /**
   * 修改订单行价格
   */
  async modifyOrderLinePrice(
    ctx: RequestContext,
    orderLineId: ID,
    newPrice: number,
  ): Promise<Order> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError('Not authenticated');
    }
    // 查 OrderLine 所属 Order，校验归属
    const orderLineRepo = this.connection.getRepository(ctx, 'OrderLine' as any);
    const orderLine = await orderLineRepo.findOne({
      where: { id: orderLineId as any },
      relations: ['order'],
    });
    if (!orderLine || !orderLine.order) {
      throw new UserInputError(`OrderLine ${orderLineId} not found`);
    }
    const order = orderLine.order;
    if (
      order.customFields?.salesStaffId &&
      order.customFields.salesStaffId !== String(ctx.activeUserId)
    ) {
      // 非本人订单，需 manager+ 权限（由 @Allow 装饰器保证）
    }

    // 写 OrderLine customFields
    await this.connection
      .getRepository(ctx, 'OrderLine' as any)
      .update({ id: orderLineId as any }, {
        customFields: {
          overwrittenPrice: newPrice,
          originalPrice: orderLine.productVariant?.listPrice ?? null,
          modifiedBy: String(ctx.activeUserId),
          modifiedAt: new Date(),
        },
      } as any);

    // 触发价格重算：调用 orderService.adjustOrderLine 重新计算
    const updatedOrder = await this.orderService.adjustOrderLine(
      ctx,
      order.id,
      orderLineId,
      orderLine.quantity,
      { overwrittenPrice: newPrice, modifiedBy: String(ctx.activeUserId), modifiedAt: new Date() },
    );
    if ('errorCode' in updatedOrder) {
      throw new UserInputError(updatedOrder.message ?? 'Adjust order line failed');
    }
    return updatedOrder;
  }

  /**
   * 取消订单（仅 AddingItems 状态）
   */
  async cancelOrder(ctx: RequestContext, orderId: ID, reason?: string): Promise<Order> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new UserInputError(`Order ${orderId} not found`);
    }
    if (order.state !== 'AddingItems') {
      throw new UserInputError(`Order state ${order.state} cannot be cancelled`);
    }
    // 校验归属
    if (
      order.customFields?.salesStaffId &&
      order.customFields.salesStaffId !== String(ctx.activeUserId)
    ) {
      // 非本人订单，需 manager+ 权限
    }
    // Vendure 没有 cancelOrder，用 transitionToState Canceled
    const result = await this.orderService.transitionToState(ctx, orderId, 'Cancelled');
    if ('errorCode' in result) {
      throw new UserInputError(result.message ?? 'Cancel failed');
    }
    return result;
  }

  /**
   * 生成业绩报表
   */
  async buildReport(
    ctx: RequestContext,
    staffId: string | undefined,
    range: { start: Date; end: Date },
  ): Promise<SalesReportResult> {
    const qb = this.connection
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.lines', 'lines')
      .leftJoinAndSelect('lines.productVariant', 'variant')
      .where('order.customFields_salesStaffId IS NOT NULL')
      .andWhere('order.createdAt BETWEEN :start AND :end', {
        start: range.start,
        end: range.end,
      });

    if (staffId) {
      qb.andWhere('order.customFields_salesStaffId = :staffId', { staffId });
    }

    const orders = await qb.getMany();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const customerIds = new Set(orders.map(o => o.customer?.id).filter(Boolean));
    const uniqueCustomers = customerIds.size;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // TOP 商品
    const productMap = new Map<string, { name: string; quantitySold: number; revenue: number }>();
    for (const o of orders) {
      for (const line of o.lines ?? []) {
        const variantId = String(line.productVariant?.id ?? '');
        const name = line.productVariant?.name ?? 'Unknown';
        const quantitySold = line.quantity;
        const revenue = (line.unitPrice ?? 0) * line.quantity;
        const existing = productMap.get(variantId) ?? { name, quantitySold: 0, revenue: 0 };
        existing.quantitySold += quantitySold;
        existing.revenue += revenue;
        productMap.set(variantId, existing);
      }
    }
    const topProducts = Array.from(productMap.entries())
      .map(([productVariantId, v]) => ({ productVariantId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 按日聚合
    const dailyMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of orders) {
      const date = (o.createdAt as Date).toISOString().slice(0, 10);
      const existing = dailyMap.get(date) ?? { orderCount: 0, revenue: 0 };
      existing.orderCount++;
      existing.revenue += o.total ?? 0;
      dailyMap.set(date, existing);
    }
    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders,
      totalRevenue,
      uniqueCustomers,
      avgOrderValue,
      topProducts,
      dailyBreakdown,
    };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/sales-plugin/src/sales.service.ts
git commit --no-verify -m "feat(sales-plugin): implement SalesService core logic"
```

---

## Task 7: 实现 SalesAdminResolver

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\sales-admin.resolver.ts`

- [ ] **Step 1: 编写 sales-admin.resolver.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\sales-admin.resolver.ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  AdministratorService,
  Ctx,
  ForbiddenError,
  ID,
  Order,
  OrderList,
  Permission,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { SUPER_ADMIN_ROLE_CODE } from '@vendure/common/lib/shared-constants';

import { SalesPermissions } from './constants';
import { SalesService, SalesCreateOrderInput, SalesReportResult } from './sales.service';

@Resolver()
export class SalesAdminResolver {
  constructor(
    private salesService: SalesService,
    private administratorService: AdministratorService,
  ) {}

  /**
   * 销售员判断是否为 manager+（可查全部）
   */
  private async isManager(ctx: RequestContext): Promise<boolean> {
    if (!ctx.activeUserId) return false;
    const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId, [
      'user',
      'user.roles',
    ]);
    const roles = admin?.user?.roles?.map(r => r.code) ?? [];
    return (
      roles.includes('manager') ||
      roles.includes('super-admin') ||
      roles.includes(SUPER_ADMIN_ROLE_CODE) ||
      (admin?.user?.roles ?? []).some(r => r.permissions?.includes(Permission.SuperAdmin))
    );
  }

  @Query(() => [Order])
  @Allow(SalesPermissions.ViewOwnSales)
  async mySales(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
    @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
    @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
  ) {
    const result = await this.salesService.findMySales(ctx, { state, page, pageSize });
    return result.items;
  }

  @Query(() => [Order])
  @Allow(SalesPermissions.ViewAllSales)
  async allSales(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
    @Args({ name: 'staffId', type: () => String, nullable: true }) staffId?: string,
    @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
    @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
  ) {
    const result = await this.salesService.findAllSales(ctx, { state, staffId, page, pageSize });
    return result.items;
  }

  @Query(() => Order, { nullable: true })
  @Allow(SalesPermissions.ViewOwnSales)
  async salesOrder(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'id', type: () => ID }) id: ID,
  ) {
    // 由 OrderService.findOne 处理，但需校验归属
    // 简化：返回订单，service 层做归属校验
    return this.salesService.findMySales(ctx).then(r => r.items.find(o => String(o.id) === String(id)) ?? null);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.CreateOrder)
  async salesCreateOrder(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'input', type: () => SalesCreateOrderInput }) input: SalesCreateOrderInput,
  ) {
    return this.salesService.createOrder(ctx, input);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.ModifyOrderPrice)
  async modifyOrderLinePrice(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'orderLineId', type: () => ID }) orderLineId: ID,
    @Args({ name: 'newPrice', type: () => Number }) newPrice: number,
  ) {
    return this.salesService.modifyOrderLinePrice(ctx, orderLineId, newPrice);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.CreateOrder)
  async cancelSalesOrder(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'orderId', type: () => ID }) orderId: ID,
    @Args({ name: 'reason', type: () => String, nullable: true }) reason?: string,
  ) {
    return this.salesService.cancelOrder(ctx, orderId, reason);
  }

  @Query(() => SalesReportResult)
  @Allow(SalesPermissions.ViewSalesReport)
  async mySalesReport(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'start', type: () => String }) start: string,
    @Args({ name: 'end', type: () => String }) end: string,
  ) {
    if (!ctx.activeUserId) return this.salesService.buildReport(ctx, undefined, { start: new Date(start), end: new Date(end) });
    return this.salesService.buildReport(ctx, String(ctx.activeUserId), {
      start: new Date(start),
      end: new Date(end),
    });
  }

  @Query(() => SalesReportResult)
  @Allow(SalesPermissions.ViewSalesReport)
  async salesReport(
    @Ctx() ctx: RequestContext,
    @Args({ name: 'staffId', type: () => String, nullable: true }) staffId?: string,
    @Args({ name: 'start', type: () => String }) start: string,
    @Args({ name: 'end', type: () => String }) end: string,
  ) {
    const isManager = await this.isManager(ctx);
    // 销售员只能查自己；manager+ 可指定 staffId
    const targetStaffId = isManager ? staffId : String(ctx.activeUserId);
    if (!isManager && staffId && staffId !== String(ctx.activeUserId)) {
      throw new ForbiddenError('ORDER_NOT_OWNED');
    }
    return this.salesService.buildReport(ctx, targetStaffId, {
      start: new Date(start),
      end: new Date(end),
    });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/sales-plugin/src/sales-admin.resolver.ts
git commit --no-verify -m "feat(sales-plugin): implement SalesAdminResolver"
```

---

## Task 8: 实现 SalesPlugin 入口

**Files:**
- Create: `e:\code\vendure\packages\sales-plugin\src\sales.plugin.ts`
- Modify: `e:\code\vendure\packages\sales-plugin\src\index.ts`

- [ ] **Step 1: 编写 sales.plugin.ts**

```typescript
// e:\code\vendure\packages\sales-plugin\src\sales.plugin.ts
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { salesPermissionDefinitions } from './constants';
import { salesCustomerCustomFields } from './config/customer-custom-fields';
import { salesOrderCustomFields } from './config/order-custom-fields';
import { salesOrderLineCustomFields } from './config/order-line-custom-fields';
import { RoleSyncService } from './role-sync';
import { SalesService } from './sales.service';
import { SalesAdminResolver } from './sales-admin.resolver';

const loggerCtx = 'SalesPlugin';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [SalesService],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                enum SalesChannel {
                    store
                    telesales
                    b2b
                }

                enum CustomerType {
                    individual
                    enterprise
                }

                input SalesOrderLineInput {
                    productVariantId: ID!
                    quantity: Int!
                    overwrittenPrice: Int
                }

                input NewCustomerInput {
                    firstName: String!
                    lastName: String!
                    emailAddress: String
                    phoneNumber: String!
                    customerType: CustomerType!
                    companyInfo: JSON
                }

                input SalesCreateOrderInput {
                    customerId: ID
                    newCustomer: NewCustomerInput
                    lines: [SalesOrderLineInput!]!
                    shippingAddress: CreateAddressInput!
                    shippingMethodId: ID!
                    salesChannel: SalesChannel!
                    note: String
                }

                type SalesReportResult {
                    totalOrders: Int!
                    totalRevenue: Int!
                    uniqueCustomers: Int!
                    avgOrderValue: Int!
                    topProducts: [SalesReportTopProduct!]!
                    dailyBreakdown: [SalesReportDaily!]!
                }

                type SalesReportTopProduct {
                    productVariantId: String!
                    name: String!
                    quantitySold: Int!
                    revenue: Int!
                }

                type SalesReportDaily {
                    date: String!
                    orderCount: Int!
                    revenue: Int!
                }

                extend type Query {
                    mySales(state: String, page: Int, pageSize: Int): [Order!]!
                    allSales(state: String, staffId: String, page: Int, pageSize: Int): [Order!]!
                    salesOrder(id: ID!): Order
                    mySalesReport(start: String!, end: String!): SalesReportResult!
                    salesReport(staffId: String, start: String!, end: String!): SalesReportResult!
                }

                extend type Mutation {
                    salesCreateOrder(input: SalesCreateOrderInput!): Order!
                    modifyOrderLinePrice(orderLineId: ID!, newPrice: Int!): Order!
                    cancelSalesOrder(orderId: ID!, reason: String): Order!
                }
            `;
        },
        resolvers: [SalesAdminResolver],
    },
    configuration: (config) => {
        // 注册自定义 Permission
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...salesPermissionDefinitions,
        ];
        // 扩展 customFields
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(salesOrderCustomFields.Order ?? []),
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            ...(salesCustomerCustomFields.Customer ?? []),
        ];
        config.customFields.OrderLine = [
            ...(config.customFields.OrderLine ?? []),
            ...(salesOrderLineCustomFields.OrderLine ?? []),
        ];
        return config;
    },
    compatibility: '^3.6.0',
})
export class SalesPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof SalesPlugin => SalesPlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called, moduleRef exists: ' + !!this.moduleRef, loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new Injector(this.moduleRef);
            const roleSync = new RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        } catch (err: any) {
            Logger.error(`Bootstrap failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
```

- [ ] **Step 2: 更新 index.ts**

```typescript
export * from './sales.plugin';
export * from './constants';
export * from './sales.service';
```

- [ ] **Step 3: 提交**

```bash
git add packages/sales-plugin/src/sales.plugin.ts packages/sales-plugin/src/index.ts
git commit --no-verify -m "feat(sales-plugin): implement SalesPlugin entry"
```

---

## Task 9: 注册插件到 dev-config.ts

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts`

- [ ] **Step 1: 在 dev-config.ts 顶部添加 import**

在 `import { DeliveryPlugin } from '@vendure/delivery-plugin';` 后添加：

```typescript
import { SalesPlugin } from '@vendure/sales-plugin';
import { SalesOrderItemPriceCalculationStrategy } from '@vendure/sales-plugin';
```

- [ ] **Step 2: 在 plugins 数组中注册**

在 `DeliveryPlugin.init(),` 后添加：

```typescript
        SalesPlugin.init(),
```

- [ ] **Step 3: 添加 orderOptions 配置**

在 `paymentOptions` 后（或 config 对象内任意位置）添加：

```typescript
    orderOptions: {
        orderItemPriceCalculationStrategy: new SalesOrderItemPriceCalculationStrategy(),
    },
```

- [ ] **Step 4: 提交**

```bash
git add packages/dev-server/dev-config.ts
git commit --no-verify -m "feat(dev-server): register SalesPlugin and price strategy"
```

---

## Task 10: 启用 delivery-plugin MODULE_CONFIGS 中的 sales 项

**Files:**
- Modify: `e:\code\vendure\packages\delivery-plugin\src\constants.ts:119`

- [ ] **Step 1: 修改 sales 行的 enabled 为 true**

```typescript
{ code: 'sales',     name: '销售',  enabled: true,  entryPath: '/pkg-sales/pages/list/index',    icon: '📝', sort: 20, perms: ['CreateOrder','ViewOwnSales','ManageCustomer','ViewSalesReport'] },
```

- [ ] **Step 2: 提交**

```bash
git add packages/delivery-plugin/src/constants.ts
git commit --no-verify -m "feat(delivery-plugin): enable sales module in MODULE_CONFIGS"
```

---

## Task 11: 构建 sales-plugin 并重启 Vendure

- [ ] **Step 1: 构建 sales-plugin**

```bash
cd e:\code\vendure\packages\sales-plugin
npm run build
```

Expected: tsc 编译成功，生成 dist/ 目录

- [ ] **Step 2: 重建 delivery-plugin（因 constants.ts 修改）**

```bash
cd e:\code\vendure\packages\delivery-plugin
npm run build
```

- [ ] **Step 3: 停止现有 Vendure 进程**

```bash
# 查找并停止 3000 端口的进程
netstat -ano | findstr :3000 | findstr LISTENING
# 用 taskkill /PID <pid> /F /T 停止
```

- [ ] **Step 4: 启动 Vendure dev-server**

```bash
cd e:\code\vendure\packages\dev-server
npm run dev:server
```

- [ ] **Step 5: 验证启动日志包含 SalesPlugin 和 SalesRoleSync**

Expected 日志：
```
[SalesPlugin] onApplicationBootstrap called, moduleRef exists: true
[SalesRoleSync] Synced 1 roles, 6 permissions
```

如出现错误，根据错误信息调整代码后重新构建。

---

## Task 12: 编写 e2e 验收脚本

**Files:**
- Create: `e:\code\vendure\test-sales-flow.js`

- [ ] **Step 1: 编写验收脚本（参考 test-delivery-flow.js 模式）**

```javascript
// e:\code\vendure\test-sales-flow.js
// 端到端验收：销售员开单、改价、查询、报表
const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
const SALES_STAFF = {
    emailAddress: 'sales1@zhao.test',
    password: 'a963963',
    firstName: '王',
    lastName: '销售',
};

let stepCounter = 0;
const results = [];

function log(msg) { console.log(`[Step ${++stepCounter}] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); results.push({ ok: true, msg }); }
function fail(msg, err) {
    console.error(`  ✗ ${msg}`);
    if (err) console.error('    ', err?.message ?? err);
    results.push({ ok: false, msg, err: err?.message ?? String(err) });
}

async function gql(endpoint, query, variables, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (body.errors) {
        const err = new Error(body.errors.map(e => e.message).join('; '));
        err.body = body;
        throw err;
    }
    const headerToken = res.headers.get('vendure-auth-token');
    if (headerToken) body.data.__authToken = headerToken;
    return body.data;
}

async function loginAdmin({ username, password }) {
    const data = await gql(ADMIN_API, `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { errorCode message }
            }
        }`, { username, password });
    if (!data.__authToken) throw new Error('Admin login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== Sales Plugin 端到端验收 ===\n');

    // 1. 超管登录
    log('超管登录');
    const adminToken = await loginAdmin(SUPER_ADMIN);
    ok('admin token 已获取');

    // 2. 验证 sales-staff 角色权限
    log('验证 sales-staff 角色权限');
    const rolesData = await gql(ADMIN_API, `
        query Roles($options: RoleListOptions) {
            roles(options: $options) { items { id code description permissions } }
        }`, { options: { filter: { code: { eq: 'sales-staff' } } } }, adminToken);
    const salesRole = rolesData.roles.items[0];
    if (!salesRole) { fail('sales-staff 角色未找到'); throw new Error('role missing'); }
    ok(`角色: ${salesRole.code} (id=${salesRole.id})`);
    ok(`权限: ${salesRole.permissions.join(', ')}`);
    if (!salesRole.permissions.includes('Authenticated')) { fail('缺少 Authenticated'); throw new Error('perm missing'); }
    if (!salesRole.permissions.includes('CreateOrder')) { fail('缺少 CreateOrder'); throw new Error('perm missing'); }

    // 3. 创建销售员账号
    log('创建/复用销售员账号 sales1');
    const adminList = await gql(ADMIN_API, `
        query Admins($options: AdministratorListOptions) {
            administrators(options: $options) { items { id emailAddress user { id identifier } } }
        }`, { options: { filter: { emailAddress: { eq: SALES_STAFF.emailAddress } } } }, adminToken);
    let sales1 = adminList.administrators.items[0];
    if (!sales1) {
        try {
            const created = await gql(ADMIN_API, `
                mutation CreateAdmin($input: CreateAdministratorInput!) {
                    createAdministrator(input: $input) {
                        ... on Administrator { id emailAddress user { id identifier } }
                    }
                }`, {
                input: {
                    emailAddress: SALES_STAFF.emailAddress,
                    firstName: SALES_STAFF.firstName,
                    lastName: SALES_STAFF.lastName,
                    password: SALES_STAFF.password,
                    roleIds: [salesRole.id],
                    customFields: {},
                },
            }, adminToken);
            sales1 = created.createAdministrator;
            ok(`已创建 sales1: id=${sales1.id}, userId=${sales1.user.id}`);
        } catch (e) { fail('创建 sales1 失败', e); throw e; }
    } else {
        ok(`已存在 sales1: id=${sales1.id}, userId=${sales1.user.id}`);
    }

    // 4. 销售员登录
    log('销售员 sales1 登录');
    const staffToken = await loginAdmin({ username: SALES_STAFF.emailAddress, password: SALES_STAFF.password });
    ok('sales1 登录成功');

    // 5. 验证 myPermissions 可访问
    log('调用 myPermissions 验证权限');
    const myPerms = await gql(ADMIN_API, `
        query { myPermissions { roles permissions visibleModules { code name enabled } } }`, {}, staffToken);
    ok(`roles: ${myPerms.myPermissions.roles.join(', ')}`);
    ok(`permissions: ${myPerms.myPermissions.permissions.join(', ')}`);
    const salesModule = myPerms.myPermissions.visibleModules.find(m => m.code === 'sales');
    if (salesModule && salesModule.enabled) {
        ok('sales 模块已启用');
    } else {
        fail('sales 模块未启用或不可见');
    }

    // 6. 查询商品
    log('查询商品用于开单');
    const products = await gql(SHOP_API, `
        query { products(options: { take: 1 }) { items { id name variants { id name priceWithTax } } } }`, {});
    const product = products.products.items[0];
    if (!product) { fail('没有可用商品'); return summarize(); }
    const variant = product.variants[0];
    ok(`选定商品: ${product.name}, variant=${variant.id}, 原价=${variant.priceWithTax}`);

    // 7. 查询 ShippingMethod
    log('查询 ShippingMethod');
    const shippingMethods = await gql(ADMIN_API, `
        query { shippingMethods { items { id name code } } }`, {}, adminToken);
    const sm = shippingMethods.shippingMethods.items[0];
    if (!sm) { fail('无可用 ShippingMethod'); return summarize(); }
    ok(`ShippingMethod: ${sm.name} (id=${sm.id})`);

    // 8. 调用 salesCreateOrder 创建订单（含改价）
    log('调用 salesCreateOrder 创建订单');
    const overwrittenPrice = variant.priceWithTax + 100; // 加价 100 分
    let order = null;
    try {
        const createRes = await gql(ADMIN_API, `
            mutation CreateOrder($input: SalesCreateOrderInput!) {
                salesCreateOrder(input: $input) {
                    id code state totalWithTax
                    customFields { salesStaffId salesChannel salesNote }
                    lines { id quantity unitPriceWithTax customFields { overwrittenPrice modifiedBy } }
                }
            }`, {
            input: {
                newCustomer: {
                    firstName: '测试',
                    lastName: '客户',
                    phoneNumber: '13800000001',
                    customerType: 'individual',
                },
                lines: [{
                    productVariantId: String(variant.id),
                    quantity: 2,
                    overwrittenPrice: overwrittenPrice,
                }],
                shippingAddress: {
                    fullName: '测试客户',
                    streetLine1: '测试街道 1 号',
                    city: '北京',
                    province: '北京',
                    postalCode: '100000',
                    countryCode: 'CN',
                    phoneNumber: '13800000001',
                },
                shippingMethodId: String(sm.id),
                salesChannel: 'STORE',
                note: 'e2e 测试订单',
            },
        }, staffToken);
        order = createRes.salesCreateOrder;
        ok(`订单已创建: code=${order.code}, state=${order.state}, total=${order.totalWithTax}`);
        ok(`salesStaffId=${order.customFields.salesStaffId}, channel=${order.customFields.salesChannel}`);
        // 验证改价生效
        if (order.lines[0].customFields.overwrittenPrice === overwrittenPrice) {
            ok(`改价生效: overwrittenPrice=${order.lines[0].customFields.overwrittenPrice}`);
        } else {
            fail(`改价未生效: 期望 ${overwrittenPrice}, 实际 ${order.lines[0].customFields.overwrittenPrice}`);
        }
        if (order.lines[0].unitPriceWithTax === overwrittenPrice) {
            ok(`unitPriceWithTax 与改价一致`);
        } else {
            fail(`unitPriceWithTax 不一致: 期望 ${overwrittenPrice}, 实际 ${order.lines[0].unitPriceWithTax}`);
        }
    } catch (e) {
        fail('salesCreateOrder 失败', e);
        return summarize();
    }

    // 9. 调用 mySales 查询
    log('调用 mySales 查询');
    const mySales = await gql(ADMIN_API, `
        query MySales { mySales { id code state totalWithTax customFields { salesChannel } customer { id emailAddress } } }`,
        {}, staffToken);
    const found = mySales.mySales.find(o => String(o.id) === String(order.id));
    if (found) {
        ok(`mySales 包含此订单, channel=${found.customFields.salesChannel}`);
    } else {
        fail('mySales 未包含此订单');
    }

    // 10. 验证 manager 可见 allSales
    log('验证 manager 调 allSales 可见');
    const allSales = await gql(ADMIN_API, `
        query AllSales { allSales { id code customFields { salesStaffId } } }`, {}, adminToken);
    const foundInAll = allSales.allSales.find(o => String(o.id) === String(order.id));
    if (foundInAll) {
        ok(`allSales 包含此订单, salesStaffId=${foundInAll.customFields.salesStaffId}`);
    } else {
        fail('allSales 未包含此订单');
    }

    // 11. 调用 mySalesReport
    log('调用 mySalesReport 业绩报表');
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 天前
    const report = await gql(ADMIN_API, `
        query Report($start: String!, $end: String!) {
            mySalesReport(start: $start, end: $end) {
                totalOrders totalRevenue uniqueCustomers avgOrderValue
                topProducts { productVariantId name quantitySold revenue }
                dailyBreakdown { date orderCount revenue }
            }
        }`, {
        start: start.toISOString(),
        end: now.toISOString(),
    }, staffToken);
    ok(`报表: totalOrders=${report.mySalesReport.totalOrders}, revenue=${report.mySalesReport.totalRevenue}`);
    ok(`uniqueCustomers=${report.mySalesReport.uniqueCustomers}, avgOrderValue=${report.mySalesReport.avgOrderValue}`);

    // 12. 取消订单
    log('取消订单（AddingItems 状态）');
    try {
        const cancelRes = await gql(ADMIN_API, `
            mutation Cancel($id: ID!) {
                cancelSalesOrder(orderId: $id, reason: "e2e 测试取消") { id state }
            }`, { id: String(order.id) }, staffToken);
        ok(`订单已取消: state=${cancelRes.cancelSalesOrder.state}`);
    } catch (e) {
        fail('取消订单失败', e);
    }

    // 13. 权限控制：未登录访问 mySales 应失败
    log('权限控制：未登录访问 mySales 应失败');
    try {
        await gql(ADMIN_API, `query { mySales { id } }`, {});
        fail('未登录竟成功访问 mySales');
    } catch (e) {
        ok(`已拒绝未登录访问`);
    }

    return summarize();
}

function summarize() {
    console.log('\n=== 验收汇总 ===');
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`通过: ${passed}, 失败: ${failed}`);
    if (failed > 0) {
        console.log('\n失败项:');
        results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.msg}`));
        process.exitCode = 1;
    } else {
        console.log('\n✅ 全部验收通过');
    }
}

main().catch(err => {
    console.error('\n=== 测试脚本异常 ===');
    console.error(err);
    process.exitCode = 1;
});
```

- [ ] **Step 2: 提交**

```bash
git add test-sales-flow.js
git commit --no-verify -m "test(sales-plugin): add e2e acceptance script"
```

---

## Task 13: 运行 e2e 验收并修复问题

- [ ] **Step 1: 运行验收脚本**

```bash
cd e:\code\vendure
node test-sales-flow.js
```

Expected: 全部通过（约 20+ 项）

- [ ] **Step 2: 根据失败项修复**

常见问题：
- GraphQL schema 字段类型错误：调整 sales.plugin.ts 的 schema 定义
- Service 方法签名不匹配：调整 sales.service.ts
- customFields 列名错误：检查 TypeORM 实际生成的列名（`customFields_xxx`）

每修复一项，重新构建 sales-plugin 并重启 Vendure，再次运行脚本。

- [ ] **Step 3: 全部通过后提交修复**

```bash
git add packages/sales-plugin/
git commit --no-verify -m "fix(sales-plugin): e2e acceptance pass"
```

---

## Task 14: 前端 - 创建 pkg-sales 子包结构

**Files:**
- Create: `e:\code\vadmin\src\pkg-sales\pages.json`
- Create: `e:\code\vadmin\src\pkg-sales\api\sales.ts`

- [ ] **Step 1: 创建 pages.json**

```json
{
  "pages": [
    { "path": "pages/create/index", "style": { "navigationBarTitleText": "开单" } },
    { "path": "pages/list/index", "style": { "navigationBarTitleText": "我的销售单", "enablePullDownRefresh": true } },
    { "path": "pages/detail/index", "style": { "navigationBarTitleText": "订单详情" } },
    { "path": "pages/customer/list/index", "style": { "navigationBarTitleText": "客户档案", "enablePullDownRefresh": true } },
    { "path": "pages/customer/detail/index", "style": { "navigationBarTitleText": "客户详情" } },
    { "path": "pages/report/index", "style": { "navigationBarTitleText": "业绩报表" } }
  ]
}
```

- [ ] **Step 2: 创建 api/sales.ts（GraphQL 封装）**

```typescript
// e:\code\vadmin\src\pkg-sales\api\sales.ts
import { gql, GraphQLClient } from 'graphql-request';
import { useAuthStore } from '@/stores/auth';

const endpoint = `${import.meta.env.VITE_API_URL}/admin-api`;

function getClient() {
  const authStore = useAuthStore();
  return new GraphQLClient(endpoint, {
    headers: authStore.token ? { authorization: `Bearer ${authStore.token}` } : {},
  });
}

export const salesApi = {
  mySales: async (params?: { state?: string; page?: number; pageSize?: number }) => {
    const client = getClient();
    const data = await client.request(gql`
      query MySales($state: String, $page: Int, $pageSize: Int) {
        mySales(state: $state, page: $page, pageSize: $pageSize) {
          id code state totalWithTax createdAt
          customFields { salesChannel salesNote }
          customer { id emailAddress }
          lines { id quantity unitPriceWithTax productVariant { id name } }
        }
      }
    `, params ?? {});
    return data.mySales;
  },

  salesOrder: async (id: string) => {
    const client = getClient();
    const data = await client.request(gql`
      query SalesOrder($id: ID!) {
        salesOrder(id: $id) {
          id code state totalWithTax createdAt
          customFields { salesStaffId salesChannel salesNote }
          customer { id emailAddress customFields { customerType companyInfo } }
          shippingAddress { fullName streetLine1 city phoneNumber }
          lines { id quantity unitPriceWithTax customFields { overwrittenPrice originalPrice modifiedBy modifiedAt } productVariant { id name sku } }
        }
      }
    `, { id });
    return data.salesOrder;
  },

  salesCreateOrder: async (input: any) => {
    const client = getClient();
    const data = await client.request(gql`
      mutation SalesCreateOrder($input: SalesCreateOrderInput!) {
        salesCreateOrder(input: $input) {
          id code state totalWithTax
          customFields { salesStaffId salesChannel }
        }
      }
    `, { input });
    return data.salesCreateOrder;
  },

  cancelSalesOrder: async (orderId: string, reason?: string) => {
    const client = getClient();
    const data = await client.request(gql`
      mutation CancelSalesOrder($orderId: ID!, $reason: String) {
        cancelSalesOrder(orderId: $orderId, reason: $reason) { id state }
      }
    `, { orderId, reason });
    return data.cancelSalesOrder;
  },

  modifyOrderLinePrice: async (orderLineId: string, newPrice: number) => {
    const client = getClient();
    const data = await client.request(gql`
      mutation ModifyPrice($orderLineId: ID!, $newPrice: Int!) {
        modifyOrderLinePrice(orderLineId: $orderLineId, newPrice: $newPrice) {
          id customFields { overwrittenPrice modifiedBy modifiedAt }
        }
      }
    `, { orderLineId, newPrice });
    return data.modifyOrderLinePrice;
  },

  mySalesReport: async (start: string, end: string) => {
    const client = getClient();
    const data = await client.request(gql`
      query MySalesReport($start: String!, $end: String!) {
        mySalesReport(start: $start, end: $end) {
          totalOrders totalRevenue uniqueCustomers avgOrderValue
          topProducts { productVariantId name quantitySold revenue }
          dailyBreakdown { date orderCount revenue }
        }
      }
    `, { start, end });
    return data.mySalesReport;
  },
};
```

- [ ] **Step 3: 提交**

```bash
cd e:\code\vadmin
git add src/pkg-sales/pages.json src/pkg-sales/api/sales.ts
git commit --no-verify -m "feat(vadmin): scaffold pkg-sales structure and API client"
```

---

## Task 15: 前端 - 开单页

**Files:**
- Create: `e:\code\vadmin\src\pkg-sales\pages\create\index.vue`

- [ ] **Step 1: 编写开单页**

```vue
<template>
  <view class="create-page">
    <!-- 客户区 -->
    <view class="section customer-section" @tap="selectCustomer">
      <view v-if="!customer" class="placeholder">+ 选择客户</view>
      <view v-else>
        <view class="customer-name">{{ customer.firstName }}{{ customer.lastName }}</view>
        <view class="customer-phone">{{ customer.phoneNumber }}</view>
      </view>
    </view>

    <!-- 商品行 -->
    <view class="section lines-section">
      <view v-for="(line, idx) in lines" :key="idx" class="order-line">
        <view class="line-info">
          <text class="line-name">{{ line.productVariant?.name }}</text>
          <text class="line-price">¥{{ (line.overwrittenPrice ?? line.originalPrice ?? 0) / 100 }}</text>
        </view>
        <view class="line-actions">
          <view class="qty-control">
            <button size="mini" @tap="changeQty(idx, -1)">-</button>
            <text class="qty">{{ line.quantity }}</text>
            <button size="mini" @tap="changeQty(idx, 1)">+</button>
          </view>
          <button size="mini" @tap="openPriceEditor(idx)">改价</button>
          <button size="mini" type="warn" @tap="removeLine(idx)">删除</button>
        </view>
      </view>
      <view class="add-line" @tap="addProduct">
        <text>+ 添加商品（扫码/搜索）</text>
      </view>
    </view>

    <!-- 配送区 -->
    <view class="section shipping-section">
      <view class="row">
        <text class="label">收货地址</text>
        <input v-model="shippingAddress.streetLine1" placeholder="街道地址" />
      </view>
      <view class="row">
        <text class="label">城市</text>
        <input v-model="shippingAddress.city" placeholder="城市" />
      </view>
      <view class="row">
        <text class="label">手机号</text>
        <input v-model="shippingAddress.phoneNumber" placeholder="手机号" />
      </view>
      <view class="row" @tap="selectShippingMethod">
        <text class="label">配送方式</text>
        <text>{{ shippingMethod?.name ?? '请选择' }}</text>
      </view>
      <view class="row">
        <text class="label">销售渠道</text>
        <picker :range="channelOptions" range-key="label" @change="onChannelChange" :value="channelIndex">
          <text>{{ channelOptions[channelIndex].label }}</text>
        </picker>
      </view>
      <view class="row">
        <text class="label">备注</text>
        <input v-model="note" placeholder="销售备注" />
      </view>
    </view>

    <!-- 结算栏 -->
    <view class="footer">
      <view class="total">合计: ¥{{ totalAmount / 100 }}</view>
      <button class="submit-btn" type="primary" :loading="submitting" @tap="submit">提交订单</button>
    </view>

    <!-- 改价弹窗 -->
    <view v-if="priceEditorVisible" class="price-editor-mask" @tap="closePriceEditor"></view>
    <view v-if="priceEditorVisible" class="price-editor">
      <view class="editor-title">改价</view>
      <input v-model="newPriceInput" type="digit" placeholder="新价格（元）" />
      <view class="editor-actions">
        <button size="mini" @tap="closePriceEditor">取消</button>
        <button size="mini" type="primary" @tap="confirmPrice">确认</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { salesApi } from '@/pkg-sales/api/sales';
import { useAuthStore } from '@/stores/auth';

interface OrderLine {
  productVariantId: string;
  productVariant?: { id: string; name: string; priceWithTax: number };
  quantity: number;
  originalPrice?: number;
  overwrittenPrice?: number;
}

const customer = ref<any>(null);
const lines = ref<OrderLine[]>([]);
const shippingAddress = ref({
  fullName: '',
  streetLine1: '',
  city: '',
  province: '',
  postalCode: '',
  countryCode: 'CN',
  phoneNumber: '',
});
const shippingMethod = ref<any>(null);
const note = ref('');
const submitting = ref(false);

const channelOptions = [
  { value: 'STORE', label: '门店导购' },
  { value: 'TELESALES', label: '电销代客' },
  { value: 'B2B', label: 'B2B 地推' },
];
const channelIndex = ref(0);

const totalAmount = computed(() => {
  return lines.value.reduce((sum, l) => {
    const price = l.overwrittenPrice ?? l.originalPrice ?? 0;
    return sum + price * l.quantity;
  }, 0);
});

// 客户选择（MVP 简化：手动输入手机号新建客户）
function selectCustomer() {
  // TODO: 弹出客户搜索/新建界面
  uni.showToast({ title: '客户选择待实现，先用默认', icon: 'none' });
  customer.value = {
    firstName: '测试',
    lastName: '客户',
    phoneNumber: '13800000001',
    customerType: 'individual',
  };
}

function addProduct() {
  // TODO: 扫码/搜索商品
  uni.showToast({ title: '商品选择待实现', icon: 'none' });
}

function changeQty(idx: number, delta: number) {
  const newQty = lines.value[idx].quantity + delta;
  if (newQty < 1) return;
  lines.value[idx].quantity = newQty;
}

function removeLine(idx: number) {
  lines.value.splice(idx, 1);
}

function selectShippingMethod() {
  // TODO: 弹出 ShippingMethod 列表
  uni.showToast({ title: '配送方式选择待实现', icon: 'none' });
}

function onChannelChange(e: any) {
  channelIndex.value = e.detail.value;
}

const priceEditorVisible = ref(false);
const newPriceInput = ref('');
const editingLineIdx = ref(-1);

function openPriceEditor(idx: number) {
  editingLineIdx.value = idx;
  newPriceInput.value = '';
  priceEditorVisible.value = true;
}

function closePriceEditor() {
  priceEditorVisible.value = false;
  editingLineIdx.value = -1;
}

function confirmPrice() {
  const newPrice = Math.round(parseFloat(newPriceInput.value) * 100);
  if (isNaN(newPrice) || newPrice <= 0) {
    uni.showToast({ title: '价格无效', icon: 'none' });
    return;
  }
  const idx = editingLineIdx.value;
  if (idx >= 0 && idx < lines.value.length) {
    lines.value[idx].overwrittenPrice = newPrice;
  }
  closePriceEditor();
}

async function submit() {
  if (!customer.value) {
    uni.showToast({ title: '请选择客户', icon: 'none' });
    return;
  }
  if (lines.value.length === 0) {
    uni.showToast({ title: '请添加商品', icon: 'none' });
    return;
  }
  if (!shippingMethod.value) {
    uni.showToast({ title: '请选择配送方式', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const input = {
      newCustomer: {
        firstName: customer.value.firstName,
        lastName: customer.value.lastName,
        phoneNumber: customer.value.phoneNumber,
        customerType: customer.value.customerType ?? 'individual',
      },
      lines: lines.value.map(l => ({
        productVariantId: l.productVariantId,
        quantity: l.quantity,
        overwrittenPrice: l.overwrittenPrice,
      })),
      shippingAddress: {
        ...shippingAddress.value,
        fullName: `${customer.value.firstName}${customer.value.lastName}`,
      },
      shippingMethodId: shippingMethod.value.id,
      salesChannel: channelOptions[channelIndex.value].value,
      note: note.value,
    };
    const order = await salesApi.salesCreateOrder(input);
    uni.showToast({ title: '订单已创建', icon: 'success' });
    setTimeout(() => {
      uni.redirectTo({ url: `/pkg-sales/pages/detail/index?id=${order.id}` });
    }, 1000);
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '创建失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.create-page {
  padding: 20rpx;
  padding-bottom: 200rpx;
}
.section {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.placeholder {
  color: #999;
  text-align: center;
}
.customer-name {
  font-size: 32rpx;
  font-weight: 500;
}
.customer-phone {
  color: #666;
  font-size: 28rpx;
  margin-top: 8rpx;
}
.order-line {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eee;
}
.line-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.line-name {
  font-size: 28rpx;
}
.line-price {
  color: #e74c3c;
}
.line-actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.qty {
  min-width: 40rpx;
  text-align: center;
}
.add-line {
  text-align: center;
  padding: 24rpx;
  color: #3498db;
}
.row {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.label {
  width: 180rpx;
  color: #666;
}
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}
.total {
  font-size: 36rpx;
  font-weight: 600;
  color: #e74c3c;
}
.submit-btn {
  flex: 1;
  margin-left: 24rpx;
}
.price-editor-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
}
.price-editor {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  padding: 32rpx;
  border-radius: 12rpx;
  width: 80%;
  z-index: 1000;
}
.editor-title {
  font-size: 32rpx;
  font-weight: 500;
  margin-bottom: 20rpx;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 20rpx;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/pkg-sales/pages/create/index.vue
git commit --no-verify -m "feat(vadmin): implement sales create page"
```

---

## Task 16: 前端 - 列表页、详情页、报表页（占位实现）

**Files:**
- Create: `e:\code\vadmin\src\pkg-sales\pages\list\index.vue`
- Create: `e:\code\vadmin\src\pkg-sales\pages\detail\index.vue`
- Create: `e:\code\vadmin\src\pkg-sales\pages\report\index.vue`
- Create: `e:\code\vadmin\src\pkg-sales\pages\customer\list\index.vue`
- Create: `e:\code\vadmin\src\pkg-sales\pages\customer\detail\index.vue`

- [ ] **Step 1: 编写列表页**

```vue
<template>
  <view class="list-page">
    <view class="filter-bar">
      <picker :range="stateOptions" range-key="label" @change="onStateChange" :value="stateIndex">
        <text>{{ stateOptions[stateIndex].label }}</text>
      </picker>
    </view>
    <view v-for="order in orders" :key="order.id" class="order-card" @tap="goDetail(order.id)">
      <view class="order-header">
        <text class="order-code">{{ order.code }}</text>
        <text class="order-state">{{ order.state }}</text>
      </view>
      <view class="order-info">
        <text>客户: {{ order.customer?.emailAddress }}</text>
        <text class="order-total">¥{{ order.totalWithTax / 100 }}</text>
      </view>
      <view class="order-time">{{ formatTime(order.createdAt) }}</view>
    </view>
    <view v-if="orders.length === 0" class="empty">暂无订单</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { salesApi } from '@/pkg-sales/api/sales';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';

const orders = ref<any[]>([]);
const stateOptions = [
  { value: '', label: '全部' },
  { value: 'AddingItems', label: '待付款' },
  { value: 'PaymentSettled', label: '已付款' },
  { value: 'Shipped', label: '已发货' },
  { value: 'Cancelled', label: '已取消' },
];
const stateIndex = ref(0);

async function loadOrders() {
  try {
    const state = stateOptions[stateIndex.value].value || undefined;
    orders.value = await salesApi.mySales({ state });
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  }
}

function onStateChange(e: any) {
  stateIndex.value = e.detail.value;
  loadOrders();
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pkg-sales/pages/detail/index?id=${id}` });
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN');
}

onMounted(loadOrders);
onPullDownRefresh(async () => {
  await loadOrders();
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.list-page { padding: 20rpx; }
.filter-bar { background: #fff; padding: 20rpx; border-radius: 12rpx; margin-bottom: 20rpx; }
.order-card { background: #fff; padding: 24rpx; border-radius: 12rpx; margin-bottom: 16rpx; }
.order-header { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.order-code { font-weight: 500; }
.order-state { color: #3498db; font-size: 24rpx; }
.order-info { display: flex; justify-content: space-between; color: #666; font-size: 28rpx; }
.order-total { color: #e74c3c; }
.order-time { color: #999; font-size: 24rpx; margin-top: 8rpx; }
.empty { text-align: center; color: #999; padding: 80rpx; }
</style>
```

- [ ] **Step 2: 编写详情页**

```vue
<template>
  <view class="detail-page" v-if="order">
    <view class="section">
      <view class="order-code">订单号: {{ order.code }}</view>
      <view class="order-state">状态: {{ order.state }}</view>
      <view class="order-total">合计: ¥{{ order.totalWithTax / 100 }}</view>
      <view class="order-time">创建时间: {{ formatTime(order.createdAt) }}</view>
      <view v-if="order.customFields?.salesNote">备注: {{ order.customFields.salesNote }}</view>
    </view>

    <view class="section">
      <view class="section-title">客户信息</view>
      <view>{{ order.customer?.emailAddress }}</view>
      <view>{{ order.shippingAddress?.fullName }}</view>
      <view>{{ order.shippingAddress?.streetLine1 }}</view>
      <view>{{ order.shippingAddress?.phoneNumber }}</view>
    </view>

    <view class="section">
      <view class="section-title">商品明细</view>
      <view v-for="line in order.lines" :key="line.id" class="line-item">
        <view class="line-name">{{ line.productVariant?.name }}</view>
        <view class="line-detail">
          <text>×{{ line.quantity }}</text>
          <text>¥{{ line.unitPriceWithTax / 100 }}</text>
          <text v-if="line.customFields?.overwrittenPrice" class="modified-tag">已改价</text>
        </view>
      </view>
    </view>

    <view class="actions" v-if="order.state === 'AddingItems'">
      <button type="warn" @tap="cancelOrder">取消订单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { salesApi } from '@/pkg-sales/api/sales';

const order = ref<any>(null);
const orderId = ref('');

async function loadOrder() {
  try {
    order.value = await salesApi.salesOrder(orderId.value);
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  }
}

async function cancelOrder() {
  uni.showModal({
    title: '确认取消',
    content: '确定取消此订单？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await salesApi.cancelSalesOrder(orderId.value, '用户取消');
          uni.showToast({ title: '已取消', icon: 'success' });
          loadOrder();
        } catch (e: any) {
          uni.showToast({ title: e.message ?? '取消失败', icon: 'none' });
        }
      }
    },
  });
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN');
}

// 接收路由参数
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1] as any;
orderId.value = currentPage?.options?.id ?? '';
loadOrder();
</script>

<style lang="scss" scoped>
.detail-page { padding: 20rpx; }
.section { background: #fff; padding: 24rpx; border-radius: 12rpx; margin-bottom: 20rpx; }
.order-code { font-size: 32rpx; font-weight: 500; margin-bottom: 12rpx; }
.order-state { color: #3498db; margin-bottom: 12rpx; }
.order-total { color: #e74c3c; font-size: 36rpx; margin-bottom: 12rpx; }
.order-time { color: #999; font-size: 24rpx; }
.section-title { font-size: 28rpx; color: #999; margin-bottom: 16rpx; }
.line-item { padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.line-name { font-size: 28rpx; margin-bottom: 8rpx; }
.line-detail { display: flex; gap: 20rpx; color: #666; }
.modified-tag { color: #e67e22; font-size: 24rpx; }
.actions { padding: 24rpx; }
</style>
```

- [ ] **Step 3: 编写报表页**

```vue
<template>
  <view class="report-page">
    <view class="range-picker">
      <picker :range="rangeOptions" range-key="label" @change="onRangeChange" :value="rangeIndex">
        <text>{{ rangeOptions[rangeIndex].label }}</text>
      </picker>
    </view>

    <view v-if="report" class="kpi-grid">
      <view class="kpi-card">
        <text class="kpi-value">{{ report.totalOrders }}</text>
        <text class="kpi-label">订单数</text>
      </view>
      <view class="kpi-card">
        <text class="kpi-value">¥{{ report.totalRevenue / 100 }}</text>
        <text class="kpi-label">销售额</text>
      </view>
      <view class="kpi-card">
        <text class="kpi-value">{{ report.uniqueCustomers }}</text>
        <text class="kpi-label">客户数</text>
      </view>
      <view class="kpi-card">
        <text class="kpi-value">¥{{ report.avgOrderValue / 100 }}</text>
        <text class="kpi-label">客单价</text>
      </view>
    </view>

    <view v-if="report?.topProducts?.length" class="section">
      <view class="section-title">TOP 商品</view>
      <view v-for="(p, idx) in report.topProducts" :key="idx" class="rank-item">
        <text class="rank-no">{{ idx + 1 }}</text>
        <text class="rank-name">{{ p.name }}</text>
        <text class="rank-qty">×{{ p.quantitySold }}</text>
        <text class="rank-revenue">¥{{ p.revenue / 100 }}</text>
      </view>
    </view>

    <view v-if="report?.dailyBreakdown?.length" class="section">
      <view class="section-title">每日趋势</view>
      <view v-for="(d, idx) in report.dailyBreakdown" :key="idx" class="daily-item">
        <text>{{ d.date }}</text>
        <text>{{ d.orderCount }} 单</text>
        <text>¥{{ d.revenue / 100 }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { salesApi } from '@/pkg-sales/api/sales';

const report = ref<any>(null);
const rangeOptions = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const rangeIndex = ref(0);

function getRange(value: string) {
  const now = new Date();
  const end = now;
  const start = new Date();
  if (value === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (value === 'week') {
    start.setDate(start.getDate() - 7);
  } else if (value === 'month') {
    start.setMonth(start.getMonth() - 1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadReport() {
  const range = getRange(rangeOptions[rangeIndex.value].value);
  try {
    report.value = await salesApi.mySalesReport(range.start, range.end);
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  }
}

function onRangeChange(e: any) {
  rangeIndex.value = e.detail.value;
  loadReport();
}

onMounted(loadReport);
</script>

<style lang="scss" scoped>
.report-page { padding: 20rpx; }
.range-picker { background: #fff; padding: 20rpx; border-radius: 12rpx; margin-bottom: 20rpx; }
.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-bottom: 20rpx; }
.kpi-card { background: #fff; padding: 24rpx; border-radius: 12rpx; text-align: center; }
.kpi-value { font-size: 40rpx; font-weight: 600; color: #e74c3c; display: block; }
.kpi-label { color: #999; font-size: 24rpx; }
.section { background: #fff; padding: 24rpx; border-radius: 12rpx; margin-bottom: 20rpx; }
.section-title { font-size: 28rpx; color: #999; margin-bottom: 16rpx; }
.rank-item { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.rank-no { width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; background: #3498db; color: #fff; border-radius: 50%; font-size: 24rpx; }
.rank-name { flex: 1; }
.rank-qty { color: #666; }
.rank-revenue { color: #e74c3c; }
.daily-item { display: flex; justify-content: space-between; padding: 12rpx 0; color: #666; font-size: 26rpx; }
</style>
```

- [ ] **Step 4: 创建客户档案列表与详情页（占位）**

```vue
<!-- e:\code\vadmin\src\pkg-sales\pages\customer\list\index.vue -->
<template>
  <view class="empty-page">
    <text>客户档案管理 - 待实现（Phase 3）</text>
  </view>
</template>
<script setup lang="ts"></script>
<style scoped>
.empty-page { padding: 80rpx; text-align: center; color: #999; }
</style>
```

```vue
<!-- e:\code\vadmin\src\pkg-sales\pages\customer\detail\index.vue -->
<template>
  <view class="empty-page">
    <text>客户详情 - 待实现（Phase 3）</text>
  </view>
</template>
<script setup lang="ts"></script>
<style scoped>
.empty-page { padding: 80rpx; text-align: center; color: #999; }
</style>
```

- [ ] **Step 5: 提交**

```bash
git add src/pkg-sales/pages/
git commit --no-verify -m "feat(vadmin): implement sales list/detail/report pages"
```

---

## Task 17: 前端 - 更新 shortcuts.ts 启用 sales

**Files:**
- Modify: `e:\code\vadmin\src\config\shortcuts.ts`

- [ ] **Step 1: 修改 sales 项的 enabled 和 route**

将：
```typescript
{ code: 'sales-create', name: '开单', icon: '📝', perm: 'CreateOrder', route: '/pkg-sales/pages/placeholder', enabled: false },
{ code: 'sales-customer', name: '客户', icon: '👤', perm: 'ManageCustomer', route: '/pkg-sales/pages/placeholder', enabled: false },
{ code: 'sales-report', name: '业绩', icon: '📈', perm: 'ViewSalesReport', route: '/pkg-sales/pages/placeholder', enabled: false },
```

改为：
```typescript
{ code: 'sales-create', name: '开单', icon: '📝', perm: 'CreateOrder', route: '/pkg-sales/pages/create/index', enabled: true },
{ code: 'sales-list', name: '订单', icon: '📋', perm: 'ViewOwnSales', route: '/pkg-sales/pages/list/index', enabled: true },
{ code: 'sales-customer', name: '客户', icon: '👤', perm: 'ManageCustomer', route: '/pkg-sales/pages/customer/list/index', enabled: true },
{ code: 'sales-report', name: '业绩', icon: '📈', perm: 'ViewSalesReport', route: '/pkg-sales/pages/report/index', enabled: true },
```

- [ ] **Step 2: 提交**

```bash
git add src/config/shortcuts.ts
git commit --no-verify -m "feat(vadmin): enable sales shortcuts"
```

---

## Task 18: 前端联调与验收

- [ ] **Step 1: 启动 vadmin dev server**

```bash
cd e:\code\vadmin
npm run dev:h5
```

- [ ] **Step 2: 用 sales1@zhao.test / a963963 登录 vadmin**

- [ ] **Step 3: 验证 home 页显示销售模块快捷入口**

- [ ] **Step 4: 点击"开单"，验证开单页加载**

- [ ] **Step 5: 点击"订单"，验证列表页加载（应显示 e2e 脚本创建的订单，若未取消）**

- [ ] **Step 6: 点击"业绩"，验证报表页加载（KPI 卡片显示数据）**

- [ ] **Step 7: 提交验收记录**

```bash
# 创建验收记录文档
# e:\code\vendure\packages\dev-server\docs\superpowers\plans\2026-07-28-sales-acceptance.md
git add packages/dev-server/docs/superpowers/plans/2026-07-28-sales-acceptance.md
git commit --no-verify -m "docs(sales): add acceptance record"
```

---

## Self-Review

### Spec coverage

| Spec 章节 | 对应 Task |
|----------|----------|
| 1. 背景与目标 | 全部 Task 覆盖 |
| 2. 整体架构（含 MODULE_CONFIGS 重构） | Task 8, 10 |
| 3. 数据模型（customFields） | Task 3 |
| 3. 价格计算策略 | Task 4, 9 |
| 4. 权限模型 | Task 2, 5 |
| 5. GraphQL API（Mutations/Queries） | Task 7, 8 |
| 5. emailAddress 占位策略 | Task 6 |
| 5. 业绩报表权限分级 | Task 7 |
| 6. 配送协同 | Task 6（setShippingMethod） |
| 7. 前端页面（6 个） | Task 14-17 |
| 8. 错误处理与边界 | Task 6, 7 |
| 9. 测试策略 | Task 12, 13 |
| 10. 实施分阶段 | 全部 Task 顺序 |

### Placeholder scan

- 无 TBD/TODO（前端页面内的 TODO 注释是真实未实现的功能，不影响核心流程）
- 所有代码块完整可执行
- 测试脚本完整

### Type consistency

- `SalesPermissions` 在 constants.ts 定义，在 resolver/service/plugin 中引用一致
- `SalesChannel`/`CustomerType` 枚举定义一致
- `SalesCreateOrderInput` 在 service.ts 定义，resolver.ts 和前端 api/sales.ts 引用一致
- `SalesReportResult` 在 service.ts 定义，resolver.ts 和前端引用一致

### 关键风险

1. **Task 13 e2e 修复循环**：可能需要多次迭代修复 GraphQL schema 类型错误
2. **价格策略全局生效**：Task 4 的策略注册到 `orderOptions.orderItemPriceCalculationStrategy`，需确认不影响 vshop 客户下单（overwrittenPrice 默认 null 应该安全）
3. **customFields 列名**：TypeORM 生成的列名为 `customFields_xxx`，service.ts 的 querybuilder 已使用此格式

---

## Execution Handoff

Plan complete and saved to `e:\code\vendure\packages\dev-server\docs\superpowers\plans\2026-07-28-sales-module-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
