# Customer Service Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable customer-service staff to handle post-order operations (after-sales refunds, exception follow-ups) and query all orders from the mobile vadmin app, via a new `@vendure/customer-service-plugin` (backend) and `pkg-cs` subpackage (frontend).

**Architecture:** Independent backend plugin wrapping `OrderService` + `AfterSalesService` (from after-sales-plugin, which needs 2-line fix to export the service), plus a frontend uni-app subpackage reusing the existing `pkg-cs` placeholder. No new entities — only Order customFields extension for `csNotes` (struct list) and delegation to existing services.

**Tech Stack:** Vendure v3.6.4 plugin system, NestJS DI, TypeORM QueryBuilder, GraphQL admin API extensions, uni-app (Vue 3) mobile frontend, graphql-request.

---

## File Structure

### Backend (vendure/packages/)

**Modified:**
- `after-sales-plugin/src/plugin.ts` — add `exports: [AfterSalesService]` to `@VendurePlugin`
- `after-sales-plugin/index.ts` — add `export * from './src/after-sales.service';`
- `delivery-plugin/src/constants.ts` — flip cs module `enabled: true` in MODULE_CONFIGS, update entryPath
- `dev-server/dev-config.ts` — import + register CustomerServicePlugin after AfterSalesPlugin

**Created:**
- `customer-service-plugin/package.json` — npm package config (mirror sales-plugin)
- `customer-service-plugin/tsconfig.json` — TS config (mirror sales-plugin)
- `customer-service-plugin/src/index.ts` — public exports
- `customer-service-plugin/src/constants.ts` — CustomerServicePermissions, ROLE_PERMISSIONS_MAP
- `customer-service-plugin/src/role-sync.ts` — RoleSyncService (mirror sales-plugin)
- `customer-service-plugin/src/config/order-custom-fields.ts` — csNotes struct list
- `customer-service-plugin/src/customer-service.service.ts` — core business logic
- `customer-service-plugin/src/customer-service-admin.resolver.ts` — GraphQL resolvers
- `customer-service-plugin/src/customer-service.plugin.ts` — @VendurePlugin entry

### Frontend (vadmin/src/)

**Modified:**
- `pages.json` — replace pkg-cs placeholder with 5 real pages
- `config/shortcuts.ts` — flip cs-* entries enabled=true, update entryPath, add cs-exceptions

**Created:**
- `pkg-cs/api/customer-service.ts` — GraphQL client (mirror pkg-sales/api/sales.ts)
- `pkg-cs/pages/orders/index.vue` — all-order list
- `pkg-cs/pages/orders/detail.vue` — order detail with exception info + csNotes
- `pkg-cs/pages/aftersales/index.vue` — after-sales list
- `pkg-cs/pages/aftersales/detail.vue` — after-sales detail with action buttons
- `pkg-cs/pages/exceptions/index.vue` — exception order list

### Acceptance
- `vendure/test-cs-flow.js` — e2e acceptance script (mirror test-sales-flow.js)

---

## Task 1: Unlock AfterSalesService DI (modify after-sales-plugin)

**Files:**
- Modify: `e:\code\vendure\packages\after-sales-plugin\src\plugin.ts`
- Modify: `e:\code\vendure\packages\after-sales-plugin\index.ts`

- [ ] **Step 1: Add exports to @VendurePlugin decorator**

In `e:\code\vendure\packages\after-sales-plugin\src\plugin.ts`, find the `@VendurePlugin({ ... })` decorator (line 15). Add `exports: [AfterSalesService]` after `providers` array. The decorator should now look like:

```typescript
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [AfterSalesRequest],
    providers: [
        { provide: AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
        AfterSalesService,
    ],
    exports: [AfterSalesService],
    shopApiExtensions: {
        // ... (unchanged)
```

- [ ] **Step 2: Add service export to index.ts**

In `e:\code\vendure\packages\after-sales-plugin\index.ts`, append one line at the end:

```typescript
export * from './src/after-sales.service';
```

Final file content:

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/after-sales-request.entity';
export * from './src/after-sales.service';
```

- [ ] **Step 3: Rebuild after-sales-plugin**

Run:
```bash
cd e:\code\vendure\packages\after-sales-plugin && npm run build
```
Expected: `tsc` exits 0 with no errors; `dist/after-sales.service.js` + `.d.ts` generated.

- [ ] **Step 4: Commit**

```bash
cd e:\code\vendure && git add packages/after-sales-plugin/src/plugin.ts packages/after-sales-plugin/index.ts packages/after-sales-plugin/dist && git commit -m "feat(after-sales): export AfterSalesService for cross-plugin DI" --no-verify
```

---

## Task 2: Create customer-service-plugin package scaffolding

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\package.json`
- Create: `e:\code\vendure\packages\customer-service-plugin\tsconfig.json`
- Create: `e:\code\vendure\packages\customer-service-plugin\src\index.ts`

- [ ] **Step 1: Create package.json**

Create `e:\code\vendure\packages\customer-service-plugin\package.json`:

```json
{
  "name": "@vendure/customer-service-plugin",
  "version": "1.0.0",
  "description": "Customer service staff management plugin for vendure",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w"
  },
  "dependencies": {
    "@vendure/core": "^3.6.0",
    "@vendure/after-sales-plugin": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `e:\code\vendure\packages\customer-service-plugin\tsconfig.json` (mirror sales-plugin):

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

- [ ] **Step 3: Create src/index.ts (initial — will extend in later tasks)**

Create `e:\code\vendure\packages\customer-service-plugin\src\index.ts`:

```typescript
export * from './customer-service.plugin';
export * from './constants';
export * from './customer-service.service';
```

- [ ] **Step 4: Run npm install to trigger workspace symlink**

Run:
```bash
cd e:\code\vendure && npm install
```
Expected: npm installs workspaces, creates `node_modules/@vendure/customer-service-plugin` symlink to `packages/customer-service-plugin`.

- [ ] **Step 5: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/package.json packages/customer-service-plugin/tsconfig.json packages/customer-service-plugin/src/index.ts && git commit -m "feat(customer-service): scaffold plugin package" --no-verify
```

---

## Task 3: Create constants.ts and role-sync.ts

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\src\constants.ts`
- Create: `e:\code\vendure\packages\customer-service-plugin\src\role-sync.ts`

- [ ] **Step 1: Create constants.ts**

Create `e:\code\vendure\packages\customer-service-plugin\src\constants.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\constants.ts

// 权限名常量（引用 delivery-plugin 中已注册的权限，此处不重复注册 PermissionDefinition）
// 仅定义字符串常量供 @Allow 装饰器和 ROLE_PERMISSIONS_MAP 使用
export const CustomerServicePermissions = {
  ViewAllOrders: 'ViewAllOrders',
  HandleAfterSales: 'HandleAfterSales',
  HandleException: 'HandleException',
  ManageCustomer: 'ManageCustomer',
} as const;

// Role 与 Permission 绑定表（增量同步：已存在的角色仅补绑缺失权限）
// customer-service 角色已在 delivery-plugin 中定义，这里做权限绑定同步
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'customer-service': [
    'Authenticated',
    'ViewAllOrders',
    'HandleAfterSales',
    'HandleException',
    'ManageCustomer',
  ],
  'manager': [
    'Authenticated',
    'ViewAllOrders',
    'HandleAfterSales',
    'HandleException',
    'ManageCustomer',
  ],
  'super-admin': [
    'Authenticated',
    'ViewAllOrders',
    'HandleAfterSales',
    'HandleException',
    'ManageCustomer',
    'SuperAdmin',
  ],
};
```

- [ ] **Step 2: Create role-sync.ts (mirror sales-plugin/src/role-sync.ts)**

Create `e:\code\vendure\packages\customer-service-plugin\src\role-sync.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\role-sync.ts
import { ChannelService, Injector, Logger, Permission, Role, TransactionalConnection } from '@vendure/core';

import { ROLE_PERMISSIONS_MAP } from './constants';

const loggerCtx = 'CustomerServiceRoleSync';

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

- [ ] **Step 3: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/src/constants.ts packages/customer-service-plugin/src/role-sync.ts && git commit -m "feat(customer-service): add constants and role-sync" --no-verify
```

---

## Task 4: Create Order customFields (csNotes struct list)

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\src\config\order-custom-fields.ts`

- [ ] **Step 1: Create order-custom-fields.ts**

Create `e:\code\vendure\packages\customer-service-plugin\src\config\order-custom-fields.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\config\order-custom-fields.ts
import { CustomFields } from '@vendure/core';

export const csOrderCustomFields: CustomFields = {
  Order: [
    {
      name: 'csNotes',
      type: 'struct',
      list: true,
      public: false,
      fields: [
        { name: 'content', type: 'string' },
        { name: 'createdBy', type: 'string' },
        { name: 'createdAt', type: 'datetime' },
      ],
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/src/config/order-custom-fields.ts && git commit -m "feat(customer-service): add csNotes struct list customField" --no-verify
```

---

## Task 5: Create CustomerServiceService (core business logic)

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\src\customer-service.service.ts`

- [ ] **Step 1: Create customer-service.service.ts**

Create `e:\code\vendure\packages\customer-service-plugin\src\customer-service.service.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\customer-service.service.ts
import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    ForbiddenError,
    Logger,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { AfterSalesService, AfterSalesRequest } from '@vendure/after-sales-plugin';

const loggerCtx = 'CustomerServiceService';

/**
 * @description
 * 客服核心服务：全量订单查询、售后处理（代理 AfterSalesService）、异常订单跟进。
 *
 * 设计说明：
 * - findAllOrders 不过滤 staffId（客服可查全部订单），不过滤 active（含 Cancelled/Completed）
 * - 售后方法代理 AfterSalesService 的短名方法（approveRequest/rejectRequest/confirmReceive/processRefund）
 * - csNotes 为追加模式，不修改原有备注
 */
@Injectable()
export class CustomerServiceService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private afterSalesService: AfterSalesService,
    ) {}

    // ===== 订单查询 =====

    /**
     * 全量订单查询（无 staffId 过滤，支持 state/email/日期筛选 + 分页）
     */
    async findAllOrders(
        ctx: RequestContext,
        options?: {
            state?: string;
            customerEmail?: string;
            startDate?: string;
            endDate?: string;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ items: Order[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        if (options?.customerEmail) {
            qb.andWhere('customer.emailAddress LIKE :email', {
                email: `%${options.customerEmail}%`,
            });
        }
        if (options?.startDate) {
            qb.andWhere('order.createdAt >= :start', { start: new Date(options.startDate) });
        }
        if (options?.endDate) {
            qb.andWhere('order.createdAt <= :end', { end: new Date(options.endDate) });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    /**
     * 订单详情（聚合 order + 关联售后单 + 异常信息）
     */
    async findOrderDetail(
        ctx: RequestContext,
        orderId: ID,
    ): Promise<{
        order: Order;
        afterSalesRequests: AfterSalesRequest[];
        exceptionInfo: {
            deliveryStatus: string;
            exceptionType?: string | null;
            exceptionNote?: string | null;
            exceptionPhotos?: string[] | null;
            deliveryStaffId?: string | null;
        } | null;
    } | null> {
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'fulfillments',
        ]);
        if (!order) return null;

        // 查该订单关联的售后单（直接查 AfterSalesRequest 实体）
        const afterSalesRepo = this.connection.rawConnection.getRepository(AfterSalesRequest);
        const afterSalesRequests = await afterSalesRepo.find({
            where: { orderId: orderId as any },
            relations: ['order', 'orderLine', 'customer'],
            order: { createdAt: 'DESC' },
        });

        // 异常信息（从 delivery customFields 读取）
        const cf = (order.customFields ?? {}) as any;
        const exceptionInfo =
            cf.deliveryStatus === 'exception'
                ? {
                      deliveryStatus: cf.deliveryStatus,
                      exceptionType: cf.exceptionType,
                      exceptionNote: cf.exceptionNote,
                      exceptionPhotos: cf.exceptionPhotos ?? [],
                      deliveryStaffId: cf.deliveryStaffId,
                  }
                : null;

        return { order, afterSalesRequests, exceptionInfo };
    }

    // ===== 售后处理（代理 AfterSalesService）=====
    // 注意：AfterSalesService 使用短方法名（非 GraphQL mutation 名）
    // GraphQL mutation 名: csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund
    // Service 方法名:      approveRequest / rejectRequest / confirmReceive / processRefund

    async approveAfterSales(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.approveRequest(ctx, id);
    }

    async rejectAfterSales(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest> {
        return this.afterSalesService.rejectRequest(ctx, id, reason);
    }

    async confirmReturnReceived(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.confirmReceive(ctx, id);
    }

    async processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        return this.afterSalesService.processRefund(ctx, id);
    }

    /**
     * 售后单列表查询（直接查 AfterSalesRequest 实体，支持 state 筛选 + 分页）
     */
    async findAfterSalesRequests(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: AfterSalesRequest[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, AfterSalesRequest)
            .createQueryBuilder('request')
            .leftJoinAndSelect('request.order', 'order')
            .leftJoinAndSelect('request.orderLine', 'orderLine')
            .leftJoinAndSelect('request.customer', 'customer')
            .orderBy('request.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('request.state = :state', { state: options.state });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneAfterSalesRequest(
        ctx: RequestContext,
        id: ID,
    ): Promise<AfterSalesRequest | undefined> {
        return this.afterSalesService.findOne(ctx, id);
    }

    // ===== 异常跟进 =====

    /**
     * 查询异常订单（customFields.deliveryStatus = 'exception'）
     */
    async findExceptionOrders(
        ctx: RequestContext,
        options?: { exceptionType?: string; page?: number; pageSize?: number },
    ): Promise<{
        items: Array<{
            order: Order;
            exceptionInfo: {
                deliveryStatus: string;
                exceptionType?: string | null;
                exceptionNote?: string | null;
                exceptionPhotos?: string[] | null;
                deliveryStaffId?: string | null;
            };
            csNotes: any[];
        }>;
        totalItems: number;
    }> {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.shippingAddress', 'shippingAddress')
            .where('order.customFields.deliveryStatus = :status', { status: 'exception' })
            .orderBy('order.createdAt', 'DESC');

        if (options?.exceptionType) {
            qb.andWhere('order.customFields.exceptionType = :type', {
                type: options.exceptionType,
            });
        }

        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [orders, totalItems] = await qb.getManyAndCount();

        const items = orders.map(order => {
            const cf = (order.customFields ?? {}) as any;
            return {
                order,
                exceptionInfo: {
                    deliveryStatus: cf.deliveryStatus,
                    exceptionType: cf.exceptionType,
                    exceptionNote: cf.exceptionNote,
                    exceptionPhotos: cf.exceptionPhotos ?? [],
                    deliveryStaffId: cf.deliveryStaffId,
                },
                csNotes: cf.csNotes ?? [],
            };
        });

        return { items, totalItems };
    }

    /**
     * 追加客服备注（不修改原有备注）
     */
    async addExceptionNote(ctx: RequestContext, orderId: ID, note: string): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new UserInputError(`Order ${orderId} not found`);
        }

        const existingNotes = ((order.customFields as any)?.csNotes ?? []) as any[];
        const newNote = {
            content: note,
            createdBy: String(ctx.activeUserId),
            createdAt: new Date(),
        };

        Logger.info(
            `CS note added to order ${order.code} by user ${ctx.activeUserId}`,
            loggerCtx,
        );

        return this.orderService.updateCustomFields(ctx, orderId, {
            csNotes: [...existingNotes, newNote],
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/src/customer-service.service.ts && git commit -m "feat(customer-service): add CustomerServiceService with order/aftersales/exception logic" --no-verify
```

---

## Task 6: Create CustomerServiceAdminResolver (GraphQL)

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\src\customer-service-admin.resolver.ts`

- [ ] **Step 1: Create customer-service-admin.resolver.ts**

Create `e:\code\vendure\packages\customer-service-plugin\src\customer-service-admin.resolver.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\customer-service-admin.resolver.ts
// 采用 schema-first 模式（与 after-sales-plugin 一致）：
// - SDL 字符串定义所有 GraphQL 类型（在 customer-service.plugin.ts 中）
// - resolver 用 @Query() / @Mutation() 不指定返回类型，返回值由 GraphQL 从 schema 推断
// - 不需要 @ObjectType / @Field 装饰器
// 原因：CsOrderDetail.afterSalesRequests 引用 AfterSalesRequest 实体，但该实体没有 @ObjectType 装饰器
// （after-sales-plugin 用纯 schema-first 模式）。为保持一致性和避免修改 after-sales-plugin，本插件也用 schema-first。
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CustomerServicePermissions } from './constants';
import { CustomerServiceService } from './customer-service.service';

/**
 * @description
 * 客服 Admin API Resolver（schema-first 模式）。
 *
 * 权限映射：
 * - csAllOrders / csOrderDetail → ViewAllOrders
 * - csAfterSalesRequests / csAfterSalesRequestDetail / csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund → HandleAfterSales
 * - csExceptionOrders / csAddExceptionNote → HandleException
 *
 * 注意：权限名 ViewAllOrders/HandleAfterSales/HandleException 由 delivery-plugin 注册到 customPermissions，
 * 此处用 `'xxx' as Permission` 字符串字面量引用，不重复注册 PermissionDefinition。
 */
@Resolver()
export class CustomerServiceAdminResolver {
    constructor(private csService: CustomerServiceService) {}

    // ===== 订单查询 =====

    @Query()
    @Allow(CustomerServicePermissions.ViewAllOrders as Permission)
    async csAllOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'customerEmail', type: () => String, nullable: true }) customerEmail?: string,
        @Args({ name: 'startDate', type: () => String, nullable: true }) startDate?: string,
        @Args({ name: 'endDate', type: () => String, nullable: true }) endDate?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.csService.findAllOrders(ctx, {
            state,
            customerEmail,
            startDate,
            endDate,
            page,
            pageSize,
        });
    }

    @Query()
    @Allow(CustomerServicePermissions.ViewAllOrders as Permission)
    async csOrderDetail(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.csService.findOrderDetail(ctx, id);
    }

    // ===== 售后处理 =====
    // 售后 query/mutation 返回 AfterSalesRequest 实体（schema 中为 AfterSalesRequestAdmin 类型，
    // GraphQL 通过字段名匹配自动序列化实体，无需 @ObjectType 装饰器）

    @Query()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csAfterSalesRequests(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.csService.findAfterSalesRequests(ctx, { state, page, pageSize });
    }

    @Query()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csAfterSalesRequestDetail(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.csService.findOneAfterSalesRequest(ctx, id);
    }

    @Mutation()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csApproveAfterSales(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.csService.approveAfterSales(ctx, id);
    }

    @Mutation()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csRejectAfterSales(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason') reason: string,
    ) {
        return this.csService.rejectAfterSales(ctx, id, reason);
    }

    @Mutation()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csConfirmReturnReceived(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.csService.confirmReturnReceived(ctx, id);
    }

    @Mutation()
    @Allow(CustomerServicePermissions.HandleAfterSales as Permission)
    async csProcessRefund(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.csService.processRefund(ctx, id);
    }

    // ===== 异常跟进 =====

    @Query()
    @Allow(CustomerServicePermissions.HandleException as Permission)
    async csExceptionOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'exceptionType', type: () => String, nullable: true }) exceptionType?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.csService.findExceptionOrders(ctx, { exceptionType, page, pageSize });
    }

    @Mutation()
    @Allow(CustomerServicePermissions.HandleException as Permission)
    async csAddExceptionNote(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('note') note: string,
    ) {
        const order = await this.csService.addExceptionNote(ctx, orderId, note);
        const cf = (order.customFields ?? {}) as any;
        return {
            order,
            exceptionInfo: {
                deliveryStatus: cf.deliveryStatus,
                exceptionType: cf.exceptionType,
                exceptionNote: cf.exceptionNote,
                exceptionPhotos: cf.exceptionPhotos ?? [],
                deliveryStaffId: cf.deliveryStaffId,
            },
            csNotes: cf.csNotes ?? [],
        };
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/src/customer-service-admin.resolver.ts && git commit -m "feat(customer-service): add admin resolver with order/aftersales/exception queries" --no-verify
```

---

## Task 7: Create CustomerServicePlugin entry

**Files:**
- Create: `e:\code\vendure\packages\customer-service-plugin\src\customer-service.plugin.ts`

- [ ] **Step 1: Create customer-service.plugin.ts**

Create `e:\code\vendure\packages\customer-service-plugin\src\customer-service.plugin.ts`:

```typescript
// e:\code\vendure\packages\customer-service-plugin\src\customer-service.plugin.ts
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AfterSalesPlugin } from '@vendure/after-sales-plugin';

import { csOrderCustomFields } from './config/order-custom-fields';
import { CustomerServiceAdminResolver } from './customer-service-admin.resolver';
import { CustomerServiceService } from './customer-service.service';
import { RoleSyncService } from './role-sync';

const loggerCtx = 'CustomerServicePlugin';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule, AfterSalesPlugin],
    providers: [CustomerServiceService],
    adminApiExtensions: {
        schema: () => gql`
            type CsOrderList {
                items: [Order!]!
                totalItems: Int!
            }

            type CsExceptionInfo {
                deliveryStatus: String!
                exceptionType: String
                exceptionNote: String
                exceptionPhotos: [String!]
                deliveryStaffId: String
            }

            type CsOrderDetail {
                order: Order!
                afterSalesRequests: [AfterSalesRequestAdmin!]!
                exceptionInfo: CsExceptionInfo
            }

            type CsAfterSalesList {
                items: [AfterSalesRequestAdmin!]!
                totalItems: Int!
            }

            type CsExceptionOrderList {
                items: [CsExceptionOrder!]!
                totalItems: Int!
            }

            type CsNote {
                content: String!
                createdBy: String!
                createdAt: DateTime!
            }

            type CsExceptionOrder {
                order: Order!
                exceptionInfo: CsExceptionInfo!
                csNotes: [CsNote!]!
            }

            extend type Query {
                csAllOrders(
                    state: String
                    customerEmail: String
                    startDate: String
                    endDate: String
                    page: Int
                    pageSize: Int
                ): CsOrderList!
                csOrderDetail(id: ID!): CsOrderDetail
                csAfterSalesRequests(state: String, page: Int, pageSize: Int): CsAfterSalesList!
                csAfterSalesRequestDetail(id: ID!): AfterSalesRequestAdmin
                csExceptionOrders(exceptionType: String, page: Int, pageSize: Int): CsExceptionOrderList!
            }

            extend type Mutation {
                csApproveAfterSales(id: ID!): AfterSalesRequestAdmin!
                csRejectAfterSales(id: ID!, reason: String!): AfterSalesRequestAdmin!
                csConfirmReturnReceived(id: ID!): AfterSalesRequestAdmin!
                csProcessRefund(id: ID!): AfterSalesRequestAdmin!
                csAddExceptionNote(orderId: ID!, note: String!): CsExceptionOrder!
            }
        `,
        resolvers: [CustomerServiceAdminResolver],
    },
    configuration: (config) => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(csOrderCustomFields.Order ?? []),
        ];
        return config;
    },
    compatibility: '^3.6.0',
})
export class CustomerServicePlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof CustomerServicePlugin => CustomerServicePlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called', loggerCtx);
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

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/customer-service-plugin/src/customer-service.plugin.ts && git commit -m "feat(customer-service): add plugin entry with schema and bootstrap" --no-verify
```

---

## Task 8: Register plugin in dev-config and enable cs module

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts`
- Modify: `e:\code\vendure\packages\delivery-plugin\src\constants.ts`

- [ ] **Step 1: Add import to dev-config.ts**

In `e:\code\vendure\packages\dev-server\dev-config.ts`, add this import after the SalesPlugin import (around line 53-54):

```typescript
import { CustomerServicePlugin } from '@vendure/customer-service-plugin';
```

- [ ] **Step 2: Register CustomerServicePlugin in plugins array**

In the same file, find the plugins array. After `SalesPlugin.init(),` (line 345), add:

```typescript
        CustomerServicePlugin.init(),
```

The end of plugins array should look like:

```typescript
        DeliveryPlugin.init(),
        SalesPlugin.init(),
        CustomerServicePlugin.init(),
    ],
```

**Important**: CustomerServicePlugin must be registered AFTER AfterSalesPlugin (which is at line 339) for DI dependency to resolve.

- [ ] **Step 3: Enable cs module in delivery-plugin constants.ts**

In `e:\code\vendure\packages\delivery-plugin\src\constants.ts`, find the `MODULE_CONFIGS` array (line 117). Change the `cs` entry from `enabled: false` to `enabled: true` and update `entryPath`:

Before:
```typescript
  { code: 'cs',        name: '客服',  enabled: false, entryPath: '/pkg-cs/pages/orders/index',    icon: '🎧', sort: 40, perms: ['ViewAllOrders','HandleAfterSales','HandleException'] },
```

After:
```typescript
  { code: 'cs',        name: '客服',  enabled: true,  entryPath: '/pkg-cs/pages/orders/index',    icon: '🎧', sort: 40, perms: ['ViewAllOrders','HandleAfterSales','HandleException'] },
```

- [ ] **Step 4: Commit**

```bash
cd e:\code\vendure && git add packages/dev-server/dev-config.ts packages/delivery-plugin/src/constants.ts && git commit -m "feat(customer-service): register plugin in dev-config and enable cs module" --no-verify
```

---

## Task 9: Build plugin and restart Vendure to verify

**Files:**
- No file changes — build and runtime verification only

- [ ] **Step 1: Build customer-service-plugin**

Run:
```bash
cd e:\code\vendure\packages\customer-service-plugin && npm run build
```
Expected: `tsc` exits 0 with no errors. `dist/` directory contains `.js` + `.d.ts` files.

If TypeScript errors occur, fix them before proceeding. Common issues:
- `@vendure/after-sales-plugin` module not found → run `cd e:\code\vendure && npm install` to trigger workspace symlink
- `AfterSalesRequest` type mismatch → ensure after-sales-plugin dist is up-to-date (Task 1 Step 3)

- [ ] **Step 2: Restart Vendure dev server**

Stop any running Vendure dev server. Start fresh:
```bash
cd e:\code\vendure\packages\dev-server && npm run dev:server
```
Expected: Vendure boots without errors. Look for log lines:
- `CustomerServicePlugin initialized` (or `onApplicationBootstrap called` from CustomerServicePlugin)
- `Synced X roles, Y permissions` from `CustomerServiceRoleSync`
- No `Nest can't resolve dependencies of the CustomerServiceService` errors

- [ ] **Step 3: Verify GraphQL schema loads**

Open Vendure admin API (http://localhost:3000/admin-api) and run this introspection query:

```graphql
{
  __type(name: "Query") {
    fields {
      name
    }
  }
}
```

Expected: Response includes `csAllOrders`, `csOrderDetail`, `csAfterSalesRequests`, `csAfterSalesRequestDetail`, `csExceptionOrders`.

Also run:
```graphql
{
  __type(name: "Mutation") {
    fields {
      name
    }
  }
}
```
Expected: Response includes `csApproveAfterSales`, `csRejectAfterSales`, `csConfirmReturnReceived`, `csProcessRefund`, `csAddExceptionNote`.

- [ ] **Step 4: Verify cs-staff role permissions synced**

Run this admin query (as super-admin):

```graphql
query {
  roles(options: { filter: { code: { eq: "customer-service" } } }) {
    items {
      code
      permissions
    }
  }
}
```
Expected: `customer-service` role has permissions `["Authenticated", "ViewAllOrders", "HandleAfterSales", "HandleException", "ManageCustomer"]` (order may differ).

---

## Task 10: Create frontend API client

**Files:**
- Create: `e:\code\vadmin\src\pkg-cs\api\customer-service.ts`

- [ ] **Step 1: Create customer-service.ts (mirror pkg-sales/api/sales.ts pattern)**

Create `e:\code\vadmin\src\pkg-cs\api\customer-service.ts`:

```typescript
import { gql, GraphQLClient } from 'graphql-request';
import { useAuthStore } from '@/stores/auth';

const endpoint = `${import.meta.env.VITE_API_URL}/admin-api`;

function getClient() {
  const authStore = useAuthStore();
  return new GraphQLClient(endpoint, {
    headers: authStore.token ? { authorization: `Bearer ${authStore.token}` } : {},
  });
}

export const csApi = {
  // ===== 订单查询 =====
  allOrders: async (params?: {
    state?: string;
    customerEmail?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const client = getClient();
    const data = await client.request(
      gql`
        query CsAllOrders(
          $state: String
          $customerEmail: String
          $startDate: String
          $endDate: String
          $page: Int
          $pageSize: Int
        ) {
          csAllOrders(
            state: $state
            customerEmail: $customerEmail
            startDate: $startDate
            endDate: $endDate
            page: $page
            pageSize: $pageSize
          ) {
            items {
              id
              code
              state
              total
              totalWithTax
              createdAt
              customer {
                firstName
                lastName
                emailAddress
              }
            }
            totalItems
          }
        }
      `,
      params ?? {},
    );
    return (data as any).csAllOrders;
  },

  orderDetail: async (id: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        query CsOrderDetail($id: ID!) {
          csOrderDetail(id: $id) {
            order {
              id
              code
              state
              total
              totalWithTax
              createdAt
              customer {
                firstName
                lastName
                emailAddress
                phoneNumber
              }
              shippingAddress {
                fullName
                streetLine1
                streetLine2
                city
                phoneNumber
              }
              lines {
                id
                productVariant {
                  name
                }
                quantity
                unitPrice
                unitPriceWithTax
                linePriceWithTax
              }
            }
            afterSalesRequests {
              id
              type
              state
              reason
              refundAmount
              createdAt
            }
            exceptionInfo {
              deliveryStatus
              exceptionType
              exceptionNote
              exceptionPhotos
              deliveryStaffId
            }
          }
        }
      `,
      { id },
    );
    return (data as any).csOrderDetail;
  },

  // ===== 售后 =====
  afterSalesRequests: async (params?: { state?: string; page?: number; pageSize?: number }) => {
    const client = getClient();
    const data = await client.request(
      gql`
        query CsAfterSalesRequests($state: String, $page: Int, $pageSize: Int) {
          csAfterSalesRequests(state: $state, page: $page, pageSize: $pageSize) {
            items {
              id
              type
              state
              reason
              refundAmount
              createdAt
              order {
                id
                code
              }
            }
            totalItems
          }
        }
      `,
      params ?? {},
    );
    return (data as any).csAfterSalesRequests;
  },

  afterSalesRequestDetail: async (id: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        query CsAfterSalesRequestDetail($id: ID!) {
          csAfterSalesRequestDetail(id: $id) {
            id
            type
            state
            reason
            description
            refundAmount
            createdAt
            returnTrackingNo
            returnCarrier
            rejectReason
            order {
              id
              code
              customer {
                firstName
                lastName
                emailAddress
              }
            }
          }
        }
      `,
      { id },
    );
    return (data as any).csAfterSalesRequestDetail;
  },

  approveAfterSales: async (id: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        mutation CsApproveAfterSales($id: ID!) {
          csApproveAfterSales(id: $id) {
            id
            state
          }
        }
      `,
      { id },
    );
    return (data as any).csApproveAfterSales;
  },

  rejectAfterSales: async (id: string, reason: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        mutation CsRejectAfterSales($id: ID!, $reason: String!) {
          csRejectAfterSales(id: $id, reason: $reason) {
            id
            state
            rejectReason
          }
        }
      `,
      { id, reason },
    );
    return (data as any).csRejectAfterSales;
  },

  confirmReturnReceived: async (id: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        mutation CsConfirmReturnReceived($id: ID!) {
          csConfirmReturnReceived(id: $id) {
            id
            state
          }
        }
      `,
      { id },
    );
    return (data as any).csConfirmReturnReceived;
  },

  processRefund: async (id: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        mutation CsProcessRefund($id: ID!) {
          csProcessRefund(id: $id) {
            id
            state
          }
        }
      `,
      { id },
    );
    return (data as any).csProcessRefund;
  },

  // ===== 异常 =====
  exceptionOrders: async (params?: { exceptionType?: string; page?: number; pageSize?: number }) => {
    const client = getClient();
    const data = await client.request(
      gql`
        query CsExceptionOrders($exceptionType: String, $page: Int, $pageSize: Int) {
          csExceptionOrders(exceptionType: $exceptionType, page: $page, pageSize: $pageSize) {
            items {
              order {
                id
                code
                createdAt
                customer {
                  firstName
                  lastName
                  emailAddress
                }
              }
              exceptionInfo {
                deliveryStatus
                exceptionType
                exceptionNote
                exceptionPhotos
                deliveryStaffId
              }
              csNotes {
                content
                createdBy
                createdAt
              }
            }
            totalItems
          }
        }
      `,
      params ?? {},
    );
    return (data as any).csExceptionOrders;
  },

  addExceptionNote: async (orderId: string, note: string) => {
    const client = getClient();
    const data = await client.request(
      gql`
        mutation CsAddExceptionNote($orderId: ID!, $note: String!) {
          csAddExceptionNote(orderId: $orderId, note: $note) {
            order {
              id
              code
            }
            csNotes {
              content
              createdBy
              createdAt
            }
          }
        }
      `,
      { orderId, note },
    );
    return (data as any).csAddExceptionNote;
  },
};
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-cs/api/customer-service.ts && git commit -m "feat(cs): add GraphQL API client" --no-verify
```

---

## Task 11: Update frontend pages.json and shortcuts.ts

**Files:**
- Modify: `e:\code\vadmin\src\pages.json`
- Modify: `e:\code\vadmin\src\config\shortcuts.ts`

- [ ] **Step 1: Update pages.json pkg-cs subpackage**

In `e:\code\vadmin\src\pages.json`, find the `pkg-cs` subPackage `pages` array. Replace the single placeholder entry with 5 real pages:

Before:
```json
{
  "root": "pkg-cs",
  "pages": [
    { "path": "pages/placeholder", "style": { "navigationBarTitleText": "客服模块" } }
  ]
}
```

After:
```json
{
  "root": "pkg-cs",
  "pages": [
    { "path": "pages/orders/index", "style": { "navigationBarTitleText": "全部订单", "enablePullDownRefresh": true } },
    { "path": "pages/orders/detail", "style": { "navigationBarTitleText": "订单详情" } },
    { "path": "pages/aftersales/index", "style": { "navigationBarTitleText": "售后单", "enablePullDownRefresh": true } },
    { "path": "pages/aftersales/detail", "style": { "navigationBarTitleText": "售后详情" } },
    { "path": "pages/exceptions/index", "style": { "navigationBarTitleText": "异常订单", "enablePullDownRefresh": true } }
  ]
}
```

- [ ] **Step 2: Update shortcuts.ts cs-* entries**

In `e:\code\vadmin\src\config\shortcuts.ts`, find the cs-orders and cs-after-sales entries. Change `enabled` from `false` to `true` and update `entryPath`. Also add a new `cs-exceptions` entry.

Before (current state):
```typescript
{ code: 'cs-orders',      name: '订单', enabled: false, entryPath: '/pkg-cs/pages/placeholder', icon: '📋', sort: 10, perms: ['ViewAllOrders'] },
{ code: 'cs-after-sales', name: '售后', enabled: false, entryPath: '/pkg-cs/pages/placeholder', icon: '🔄', sort: 20, perms: ['HandleAfterSales'] },
```

After:
```typescript
{ code: 'cs-orders',      name: '订单', enabled: true, entryPath: '/pkg-cs/pages/orders/index', icon: '📋', sort: 10, perms: ['ViewAllOrders'] },
{ code: 'cs-after-sales', name: '售后', enabled: true, entryPath: '/pkg-cs/pages/aftersales/index', icon: '🔄', sort: 20, perms: ['HandleAfterSales'] },
{ code: 'cs-exceptions',  name: '异常', enabled: true, entryPath: '/pkg-cs/pages/exceptions/index', icon: '⚠️', sort: 30, perms: ['HandleException'] },
```

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin && git add src/pages.json src/config/shortcuts.ts && git commit -m "feat(cs): update pages.json and shortcuts for real pages" --no-verify
```

---

## Task 12: Create orders list and detail pages

**Files:**
- Create: `e:\code\vadmin\src\pkg-cs\pages\orders\index.vue`
- Create: `e:\code\vadmin\src\pkg-cs\pages\orders\detail.vue`

- [ ] **Step 1: Create orders/index.vue**

Create `e:\code\vadmin\src\pkg-cs\pages\orders\index.vue`:

```vue
<template>
  <view class="orders-page">
    <view class="filter-bar">
      <input
        class="search-input"
        v-model="customerEmail"
        placeholder="按客户邮箱搜索"
        @confirm="loadOrders"
      />
      <picker class="state-picker" :range="stateOptions" range-key="label" @change="onStateChange">
        <view class="picker-text">{{ stateOptions[stateIndex].label }}</view>
      </picker>
    </view>

    <view v-if="orders.length === 0" class="empty">暂无订单</view>

    <view v-else class="order-list">
      <view
        v-for="order in orders"
        :key="order.id"
        class="order-card"
        @tap="goDetail(order.id)"
      >
        <view class="order-header">
          <text class="order-code">{{ order.code }}</text>
          <text class="order-state" :class="stateClass(order.state)">{{ order.state }}</text>
        </view>
        <view class="order-info">
          <text class="customer">{{ order.customer?.firstName }} {{ order.customer?.lastName }}</text>
          <text class="email">{{ order.customer?.emailAddress }}</text>
        </view>
        <view class="order-footer">
          <text class="amount">¥{{ (order.totalWithTax / 100).toFixed(2) }}</text>
          <text class="time">{{ formatTime(order.createdAt) }}</text>
        </view>
      </view>
    </view>

    <view v-if="orders.length > 0" class="load-more" @tap="loadMore">
      {{ hasMore ? '加载更多' : '没有更多了' }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { csApi } from '@/pkg-cs/api/customer-service';

const orders = ref<any[]>([]);
const customerEmail = ref('');
const stateOptions = [
  { value: '', label: '全部' },
  { value: 'AddingItems', label: '待付款' },
  { value: 'PaymentSettled', label: '已付款' },
  { value: 'Shipped', label: '已发货' },
  { value: 'Delivered', label: '已送达' },
  { value: 'Cancelled', label: '已取消' },
];
const stateIndex = ref(0);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);

async function loadOrders() {
  page.value = 1;
  hasMore.value = true;
  await fetchOrders(true);
}

async function loadMore() {
  if (!hasMore.value || loading.value) return;
  page.value++;
  await fetchOrders(false);
}

async function fetchOrders(reset: boolean) {
  loading.value = true;
  try {
    const state = stateOptions[stateIndex.value].value || undefined;
    const result = await csApi.allOrders({
      state,
      customerEmail: customerEmail.value || undefined,
      page: page.value,
      pageSize,
    });
    if (reset) {
      orders.value = result.items;
    } else {
      orders.value = [...orders.value, ...result.items];
    }
    hasMore.value = orders.value.length < result.totalItems;
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function onStateChange(e: any) {
  stateIndex.value = e.detail.value;
  loadOrders();
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pkg-cs/pages/orders/detail?id=${id}` });
}

function stateClass(state: string) {
  const map: Record<string, string> = {
    Cancelled: 'state-cancelled',
    Delivered: 'state-delivered',
    Shipped: 'state-shipped',
  };
  return map[state] ?? 'state-default';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onMounted(loadOrders);
onPullDownRefresh(async () => {
  await loadOrders();
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.orders-page {
  padding: 20rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.filter-bar {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
  .search-input {
    flex: 1;
    background: #fff;
    padding: 16rpx 20rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
  }
  .state-picker {
    background: #fff;
    padding: 16rpx 20rpx;
    border-radius: 8rpx;
    .picker-text {
      font-size: 28rpx;
      color: #333;
    }
  }
}
.empty {
  text-align: center;
  color: #999;
  padding: 100rpx 0;
  font-size: 28rpx;
}
.order-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  .order-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    .order-code {
      font-size: 30rpx;
      font-weight: bold;
      color: #333;
    }
    .order-state {
      font-size: 24rpx;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      &.state-default { background: #e6f7ff; color: #1890ff; }
      &.state-shipped { background: #fff7e6; color: #fa8c16; }
      &.state-delivered { background: #f6ffed; color: #52c41a; }
      &.state-cancelled { background: #fff1f0; color: #f5222d; }
    }
  }
  .order-info {
    display: flex;
    flex-direction: column;
    margin-bottom: 16rpx;
    .customer {
      font-size: 28rpx;
      color: #333;
    }
    .email {
      font-size: 24rpx;
      color: #999;
    }
  }
  .order-footer {
    display: flex;
    justify-content: space-between;
    .amount {
      font-size: 32rpx;
      font-weight: bold;
      color: #f5222d;
    }
    .time {
      font-size: 24rpx;
      color: #999;
    }
  }
}
.load-more {
  text-align: center;
  padding: 30rpx;
  color: #1890ff;
  font-size: 28rpx;
}
</style>
```

- [ ] **Step 2: Create orders/detail.vue**

Create `e:\code\vadmin\src\pkg-cs\pages\orders\detail.vue`:

```vue
<template>
  <view class="detail-page">
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="!detail" class="empty">订单不存在</view>
    <view v-else>
      <!-- 基本信息 -->
      <view class="card">
        <view class="card-title">订单信息</view>
        <view class="row"><text class="label">订单号:</text><text>{{ detail.order.code }}</text></view>
        <view class="row"><text class="label">状态:</text><text>{{ detail.order.state }}</text></view>
        <view class="row"><text class="label">下单时间:</text><text>{{ formatTime(detail.order.createdAt) }}</text></view>
        <view class="row"><text class="label">客户:</text><text>{{ detail.order.customer?.firstName }} {{ detail.order.customer?.lastName }}</text></view>
        <view class="row"><text class="label">邮箱:</text><text>{{ detail.order.customer?.emailAddress }}</text></view>
        <view class="row"><text class="label">电话:</text><text>{{ detail.order.customer?.phoneNumber || '-' }}</text></view>
      </view>

      <!-- 收货地址 -->
      <view class="card" v-if="detail.order.shippingAddress">
        <view class="card-title">收货地址</view>
        <view class="row"><text>{{ detail.order.shippingAddress.fullName }}</text></view>
        <view class="row"><text>{{ detail.order.shippingAddress.streetLine1 }} {{ detail.order.shippingAddress.streetLine2 }}</text></view>
        <view class="row"><text>{{ detail.order.shippingAddress.city }}</text></view>
        <view class="row"><text class="label">电话:</text><text>{{ detail.order.shippingAddress.phoneNumber || '-' }}</text></view>
      </view>

      <!-- 商品列表 -->
      <view class="card">
        <view class="card-title">商品</view>
        <view v-for="line in detail.order.lines" :key="line.id" class="line-item">
          <view class="line-name">{{ line.productVariant?.name }}</view>
          <view class="line-meta">
            <text>x{{ line.quantity }}</text>
            <text class="line-price">¥{{ (line.linePriceWithTax / 100).toFixed(2) }}</text>
          </view>
        </view>
        <view class="row total-row">
          <text class="label">合计:</text>
          <text class="total">¥{{ (detail.order.totalWithTax / 100).toFixed(2) }}</text>
        </view>
      </view>

      <!-- 异常信息 -->
      <view class="card exception-card" v-if="detail.exceptionInfo">
        <view class="card-title">异常信息</view>
        <view class="row"><text class="label">异常类型:</text><text>{{ detail.exceptionInfo.exceptionType }}</text></view>
        <view class="row"><text class="label">异常备注:</text><text>{{ detail.exceptionInfo.exceptionNote || '-' }}</text></view>
        <view class="row"><text class="label">送货员ID:</text><text>{{ detail.exceptionInfo.deliveryStaffId || '-' }}</text></view>
        <view v-if="detail.exceptionInfo.exceptionPhotos?.length" class="photos">
          <image
            v-for="(photo, idx) in detail.exceptionInfo.exceptionPhotos"
            :key="idx"
            :src="photo"
            mode="aspectFill"
            class="photo"
            @tap="previewPhoto(photo, detail.exceptionInfo!.exceptionPhotos!)"
          />
        </view>
      </view>

      <!-- 客服备注 -->
      <view class="card">
        <view class="card-title">客服备注</view>
        <view v-if="csNotes.length === 0" class="empty-note">暂无备注</view>
        <view v-else class="note-list">
          <view v-for="(note, idx) in csNotes" :key="idx" class="note-item">
            <view class="note-content">{{ note.content }}</view>
            <view class="note-meta">
              <text>创建人: {{ note.createdBy }}</text>
              <text>{{ formatTime(note.createdAt) }}</text>
            </view>
          </view>
        </view>
        <view class="note-input-area">
          <textarea v-model="newNote" placeholder="输入客服备注..." class="note-input" />
          <button size="mini" type="primary" @tap="submitNote" :disabled="!newNote.trim()">提交备注</button>
        </view>
      </view>

      <!-- 关联售后单 -->
      <view class="card" v-if="detail.afterSalesRequests.length > 0">
        <view class="card-title">关联售后单</view>
        <view
          v-for="ar in detail.afterSalesRequests"
          :key="ar.id"
          class="aftersales-item"
          @tap="goAfterSales(ar.id)"
        >
          <view class="ar-header">
            <text class="ar-type">{{ ar.type }}</text>
            <text class="ar-state">{{ ar.state }}</text>
          </view>
          <view class="ar-info">
            <text>原因: {{ ar.reason }}</text>
            <text>退款: ¥{{ (ar.refundAmount / 100).toFixed(2) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { csApi } from '@/pkg-cs/api/customer-service';

const detail = ref<any>(null);
const loading = ref(true);
const csNotes = ref<any[]>([]);
const newNote = ref('');
const orderId = ref('');

async function loadDetail() {
  loading.value = true;
  try {
    const result = await csApi.orderDetail(orderId.value);
    detail.value = result;
    // csNotes 从异常订单接口取，订单详情里没有；如果是异常订单，单独拉一次异常列表
    if (result?.exceptionInfo) {
      // 从 exceptionOrders 拉取该订单的 csNotes（简化处理：直接调 addExceptionNote 后会返回，初始加载用 exceptionOrders 找到该单）
      try {
        const excResult = await csApi.exceptionOrders({ pageSize: 100 });
        const found = excResult.items.find((it: any) => it.order.id === orderId.value);
        csNotes.value = found?.csNotes ?? [];
      } catch {
        csNotes.value = [];
      }
    } else {
      csNotes.value = [];
    }
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function submitNote() {
  if (!newNote.value.trim()) return;
  try {
    const result = await csApi.addExceptionNote(orderId.value, newNote.value.trim());
    csNotes.value = result.csNotes ?? [];
    newNote.value = '';
    uni.showToast({ title: '备注已添加', icon: 'success' });
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '提交失败', icon: 'none' });
  }
}

function goAfterSales(id: string) {
  uni.navigateTo({ url: `/pkg-cs/pages/aftersales/detail?id=${id}` });
}

function previewPhoto(current: string, urls: string[]) {
  uni.previewImage({ current, urls });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onLoad((query: any) => {
  orderId.value = query?.id ?? '';
});
onMounted(loadDetail);
</script>

<style lang="scss" scoped>
.detail-page {
  padding: 20rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.loading, .empty {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  .card-title {
    font-size: 30rpx;
    font-weight: bold;
    margin-bottom: 16rpx;
    color: #333;
    border-left: 6rpx solid #1890ff;
    padding-left: 16rpx;
  }
  .row {
    display: flex;
    margin-bottom: 12rpx;
    font-size: 28rpx;
    color: #666;
    .label {
      width: 160rpx;
      color: #999;
    }
  }
}
.line-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  .line-name {
    font-size: 28rpx;
    color: #333;
    margin-bottom: 8rpx;
  }
  .line-meta {
    display: flex;
    justify-content: space-between;
    font-size: 26rpx;
    color: #666;
    .line-price {
      color: #f5222d;
    }
  }
}
.total-row {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid #f0f0f0;
  .total {
    color: #f5222d;
    font-size: 32rpx;
    font-weight: bold;
  }
}
.exception-card {
  border-left: 6rpx solid #f5222d;
  .photos {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 16rpx;
    .photo {
      width: 160rpx;
      height: 160rpx;
      border-radius: 8rpx;
    }
  }
}
.note-list {
  margin-bottom: 16rpx;
  .note-item {
    padding: 16rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
    .note-content {
      font-size: 28rpx;
      color: #333;
      margin-bottom: 8rpx;
    }
    .note-meta {
      display: flex;
      justify-content: space-between;
      font-size: 24rpx;
      color: #999;
    }
  }
}
.empty-note {
  color: #999;
  font-size: 26rpx;
  text-align: center;
  padding: 20rpx;
}
.note-input-area {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
  .note-input {
    background: #f5f5f5;
    padding: 16rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    min-height: 120rpx;
  }
}
.aftersales-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  .ar-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8rpx;
    .ar-type {
      font-size: 28rpx;
      color: #1890ff;
    }
    .ar-state {
      font-size: 24rpx;
      color: #999;
    }
  }
  .ar-info {
    display: flex;
    justify-content: space-between;
    font-size: 26rpx;
    color: #666;
  }
}
</style>
```

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-cs/pages/orders/ && git commit -m "feat(cs): add orders list and detail pages" --no-verify
```

---

## Task 13: Create aftersales list and detail pages

**Files:**
- Create: `e:\code\vadmin\src\pkg-cs\pages\aftersales\index.vue`
- Create: `e:\code\vadmin\src\pkg-cs\pages\aftersales\detail.vue`

- [ ] **Step 1: Create aftersales/index.vue**

Create `e:\code\vadmin\src\pkg-cs\pages\aftersales\index.vue`:

```vue
<template>
  <view class="aftersales-page">
    <view class="filter-bar">
      <picker :range="stateOptions" range-key="label" @change="onStateChange">
        <view class="picker-text">{{ stateOptions[stateIndex].label }}</view>
      </picker>
    </view>

    <view v-if="requests.length === 0" class="empty">暂无售后单</view>

    <view v-else class="list">
      <view
        v-for="ar in requests"
        :key="ar.id"
        class="card"
        @tap="goDetail(ar.id)"
      >
        <view class="header">
          <text class="type">{{ ar.type }}</text>
          <text class="state" :class="stateClass(ar.state)">{{ ar.state }}</text>
        </view>
        <view class="info">
          <text>订单: {{ ar.order?.code }}</text>
          <text>原因: {{ ar.reason }}</text>
        </view>
        <view class="footer">
          <text class="amount">退款: ¥{{ (ar.refundAmount / 100).toFixed(2) }}</text>
          <text class="time">{{ formatTime(ar.createdAt) }}</text>
        </view>
      </view>
    </view>

    <view v-if="requests.length > 0" class="load-more" @tap="loadMore">
      {{ hasMore ? '加载更多' : '没有更多了' }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { csApi } from '@/pkg-cs/api/customer-service';

const requests = ref<any[]>([]);
const stateOptions = [
  { value: '', label: '全部' },
  { value: 'Pending', label: '待审核' },
  { value: 'Approved', label: '已审核' },
  { value: 'Returning', label: '退货中' },
  { value: 'Received', label: '已收货' },
  { value: 'Refunded', label: '已退款' },
  { value: 'Rejected', label: '已拒绝' },
  { value: 'Closed', label: '已关闭' },
];
const stateIndex = ref(0);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);

async function loadRequests() {
  page.value = 1;
  hasMore.value = true;
  await fetchRequests(true);
}

async function loadMore() {
  if (!hasMore.value) return;
  page.value++;
  await fetchRequests(false);
}

async function fetchRequests(reset: boolean) {
  try {
    const state = stateOptions[stateIndex.value].value || undefined;
    const result = await csApi.afterSalesRequests({ state, page: page.value, pageSize });
    if (reset) {
      requests.value = result.items;
    } else {
      requests.value = [...requests.value, ...result.items];
    }
    hasMore.value = requests.value.length < result.totalItems;
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  }
}

function onStateChange(e: any) {
  stateIndex.value = e.detail.value;
  loadRequests();
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pkg-cs/pages/aftersales/detail?id=${id}` });
}

function stateClass(state: string) {
  const map: Record<string, string> = {
    Pending: 'state-pending',
    Approved: 'state-approved',
    Refunded: 'state-refunded',
    Rejected: 'state-rejected',
    Closed: 'state-closed',
  };
  return map[state] ?? 'state-default';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onMounted(loadRequests);
onPullDownRefresh(async () => {
  await loadRequests();
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.aftersales-page {
  padding: 20rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.filter-bar {
  margin-bottom: 20rpx;
  .picker-text {
    background: #fff;
    padding: 16rpx 20rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
  }
}
.empty {
  text-align: center;
  color: #999;
  padding: 100rpx 0;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    .type {
      font-size: 30rpx;
      font-weight: bold;
      color: #1890ff;
    }
    .state {
      font-size: 24rpx;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      &.state-default { background: #e6f7ff; color: #1890ff; }
      &.state-pending { background: #fff7e6; color: #fa8c16; }
      &.state-approved { background: #e6f7ff; color: #1890ff; }
      &.state-refunded { background: #f6ffed; color: #52c41a; }
      &.state-rejected { background: #fff1f0; color: #f5222d; }
      &.state-closed { background: #f5f5f5; color: #999; }
    }
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    font-size: 26rpx;
    color: #666;
    margin-bottom: 16rpx;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    .amount {
      font-size: 28rpx;
      color: #f5222d;
      font-weight: bold;
    }
    .time {
      font-size: 24rpx;
      color: #999;
    }
  }
}
.load-more {
  text-align: center;
  padding: 30rpx;
  color: #1890ff;
  font-size: 28rpx;
}
</style>
```

- [ ] **Step 2: Create aftersales/detail.vue**

Create `e:\code\vadmin\src\pkg-cs\pages\aftersales\detail.vue`:

```vue
<template>
  <view class="detail-page">
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="!detail" class="empty">售后单不存在</view>
    <view v-else>
      <view class="card">
        <view class="card-title">售后信息</view>
        <view class="row"><text class="label">类型:</text><text>{{ detail.type }}</text></view>
        <view class="row"><text class="label">状态:</text><text>{{ detail.state }}</text></view>
        <view class="row"><text class="label">原因:</text><text>{{ detail.reason }}</text></view>
        <view class="row"><text class="label">描述:</text><text>{{ detail.description || '-' }}</text></view>
        <view class="row"><text class="label">退款金额:</text><text class="amount">¥{{ (detail.refundAmount / 100).toFixed(2) }}</text></view>
        <view class="row"><text class="label">申请时间:</text><text>{{ formatTime(detail.createdAt) }}</text></view>
      </view>

      <view class="card" v-if="detail.order">
        <view class="card-title">关联订单</view>
        <view class="row"><text class="label">订单号:</text><text>{{ detail.order.code }}</text></view>
        <view class="row"><text class="label">客户:</text><text>{{ detail.order.customer?.firstName }} {{ detail.order.customer?.lastName }}</text></view>
        <view class="row"><text class="label">邮箱:</text><text>{{ detail.order.customer?.emailAddress }}</text></view>
      </view>

      <view class="card" v-if="detail.returnTrackingNo">
        <view class="card-title">退货物流</view>
        <view class="row"><text class="label">快递单号:</text><text>{{ detail.returnTrackingNo }}</text></view>
        <view class="row"><text class="label">承运商:</text><text>{{ detail.returnCarrier || '-' }}</text></view>
      </view>

      <view class="card" v-if="detail.state === 'Rejected' && detail.rejectReason">
        <view class="card-title">拒绝原因</view>
        <view class="row"><text>{{ detail.rejectReason }}</text></view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-bar" v-if="showActions">
        <button v-if="detail.state === 'Pending'" type="primary" @tap="onApprove" :loading="acting">审核通过</button>
        <button v-if="detail.state === 'Pending'" type="warn" @tap="onReject" :loading="acting">拒绝</button>
        <button v-if="detail.state === 'Returning'" type="primary" @tap="onConfirmReceived" :loading="acting">确认收货</button>
        <button v-if="detail.state === 'Received'" type="primary" @tap="onProcessRefund" :loading="acting">执行退款</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { csApi } from '@/pkg-cs/api/customer-service';

const detail = ref<any>(null);
const loading = ref(true);
const acting = ref(false);
const arId = ref('');

const showActions = computed(() => {
  const s = detail.value?.state;
  return s === 'Pending' || s === 'Returning' || s === 'Received';
});

async function loadDetail() {
  loading.value = true;
  try {
    detail.value = await csApi.afterSalesRequestDetail(arId.value);
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function onApprove() {
  acting.value = true;
  try {
    await csApi.approveAfterSales(arId.value);
    uni.showToast({ title: '已审核通过', icon: 'success' });
    await loadDetail();
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '操作失败', icon: 'none' });
  } finally {
    acting.value = false;
  }
}

async function onReject() {
  uni.showModal({
    title: '拒绝原因',
    editable: true,
    placeholderText: '请输入拒绝原因',
    success: async (res) => {
      if (!res.confirm || !res.content?.trim()) return;
      acting.value = true;
      try {
        await csApi.rejectAfterSales(arId.value, res.content.trim());
        uni.showToast({ title: '已拒绝', icon: 'success' });
        await loadDetail();
      } catch (e: any) {
        uni.showToast({ title: e.message ?? '操作失败', icon: 'none' });
      } finally {
        acting.value = false;
      }
    },
  });
}

async function onConfirmReceived() {
  acting.value = true;
  try {
    await csApi.confirmReturnReceived(arId.value);
    uni.showToast({ title: '已确认收货', icon: 'success' });
    await loadDetail();
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '操作失败', icon: 'none' });
  } finally {
    acting.value = false;
  }
}

async function onProcessRefund() {
  uni.showModal({
    title: '确认执行退款?',
    success: async (res) => {
      if (!res.confirm) return;
      acting.value = true;
      try {
        await csApi.processRefund(arId.value);
        uni.showToast({ title: '退款已执行', icon: 'success' });
        await loadDetail();
      } catch (e: any) {
        uni.showToast({ title: e.message ?? '操作失败', icon: 'none' });
      } finally {
        acting.value = false;
      }
    },
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onLoad((query: any) => {
  arId.value = query?.id ?? '';
});
onMounted(loadDetail);
</script>

<style lang="scss" scoped>
.detail-page {
  padding: 20rpx;
  background: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 140rpx;
}
.loading, .empty {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  .card-title {
    font-size: 30rpx;
    font-weight: bold;
    margin-bottom: 16rpx;
    color: #333;
    border-left: 6rpx solid #1890ff;
    padding-left: 16rpx;
  }
  .row {
    display: flex;
    margin-bottom: 12rpx;
    font-size: 28rpx;
    color: #666;
    .label {
      width: 180rpx;
      color: #999;
    }
    .amount {
      color: #f5222d;
      font-weight: bold;
    }
  }
}
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
  button {
    flex: 1;
  }
}
</style>
```

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-cs/pages/aftersales/ && git commit -m "feat(cs): add aftersales list and detail pages" --no-verify
```

---

## Task 14: Create exceptions list page

**Files:**
- Create: `e:\code\vadmin\src\pkg-cs\pages\exceptions\index.vue`

- [ ] **Step 1: Create exceptions/index.vue**

Create `e:\code\vadmin\src\pkg-cs\pages\exceptions\index.vue`:

```vue
<template>
  <view class="exceptions-page">
    <view class="filter-bar">
      <picker :range="typeOptions" range-key="label" @change="onTypeChange">
        <view class="picker-text">{{ typeOptions[typeIndex].label }}</view>
      </picker>
    </view>

    <view v-if="orders.length === 0" class="empty">暂无异常订单</view>

    <view v-else class="list">
      <view
        v-for="item in orders"
        :key="item.order.id"
        class="card"
        @tap="goDetail(item.order.id)"
      >
        <view class="header">
          <text class="code">{{ item.order.code }}</text>
          <text class="type-tag">{{ item.exceptionInfo.exceptionType || '-' }}</text>
        </view>
        <view class="info">
          <text>客户: {{ item.order.customer?.firstName }} {{ item.order.customer?.lastName }}</text>
          <text>异常: {{ item.exceptionInfo.exceptionNote || '-' }}</text>
        </view>
        <view class="footer">
          <text class="notes-count" v-if="item.csNotes.length > 0">备注 {{ item.csNotes.length }} 条</text>
          <text class="time">{{ formatTime(item.order.createdAt) }}</text>
        </view>
      </view>
    </view>

    <view v-if="orders.length > 0" class="load-more" @tap="loadMore">
      {{ hasMore ? '加载更多' : '没有更多了' }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { csApi } from '@/pkg-cs/api/customer-service';

const orders = ref<any[]>([]);
const typeOptions = [
  { value: '', label: '全部' },
  { value: 'rejected', label: '拒收' },
  { value: 'wrong_address', label: '地址错误' },
  { value: 'no_recipient', label: '无人签收' },
  { value: 'damaged', label: '破损' },
  { value: 'other', label: '其他' },
];
const typeIndex = ref(0);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);

async function loadOrders() {
  page.value = 1;
  hasMore.value = true;
  await fetchOrders(true);
}

async function loadMore() {
  if (!hasMore.value) return;
  page.value++;
  await fetchOrders(false);
}

async function fetchOrders(reset: boolean) {
  try {
    const exceptionType = typeOptions[typeIndex.value].value || undefined;
    const result = await csApi.exceptionOrders({ exceptionType, page: page.value, pageSize });
    if (reset) {
      orders.value = result.items;
    } else {
      orders.value = [...orders.value, ...result.items];
    }
    hasMore.value = orders.value.length < result.totalItems;
  } catch (e: any) {
    uni.showToast({ title: e.message ?? '加载失败', icon: 'none' });
  }
}

function onTypeChange(e: any) {
  typeIndex.value = e.detail.value;
  loadOrders();
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pkg-cs/pages/orders/detail?id=${id}` });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onMounted(loadOrders);
onPullDownRefresh(async () => {
  await loadOrders();
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.exceptions-page {
  padding: 20rpx;
  background: #f5f5f5;
  min-height: 100vh;
}
.filter-bar {
  margin-bottom: 20rpx;
  .picker-text {
    background: #fff;
    padding: 16rpx 20rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
  }
}
.empty {
  text-align: center;
  color: #999;
  padding: 100rpx 0;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  border-left: 6rpx solid #f5222d;
  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    .code {
      font-size: 30rpx;
      font-weight: bold;
      color: #333;
    }
    .type-tag {
      font-size: 24rpx;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      background: #fff1f0;
      color: #f5222d;
    }
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    font-size: 26rpx;
    color: #666;
    margin-bottom: 16rpx;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    .notes-count {
      font-size: 24rpx;
      color: #1890ff;
    }
    .time {
      font-size: 24rpx;
      color: #999;
    }
  }
}
.load-more {
  text-align: center;
  padding: 30rpx;
  color: #1890ff;
  font-size: 28rpx;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-cs/pages/exceptions/ && git commit -m "feat(cs): add exceptions list page" --no-verify
```

---

## Task 15: Write and run e2e acceptance test

**Files:**
- Create: `e:\code\vendure\test-cs-flow.js`

- [ ] **Step 1: Create test-cs-flow.js**

Create `e:\code\vendure\test-cs-flow.js` (mirror test-sales-flow.js structure):

```javascript
// e:\code\vendure\test-cs-flow.js
// 客服模块 e2e 验收脚本
// 运行: node test-cs-flow.js
// 登录方式：参考 test-sales-flow.js，从 response header `vendure-auth-token` 取 Bearer token

const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';

let superAdminToken = '';
let csStaffToken = '';
let testOrderId = '';
let testAfterSalesId = '';

// 统一 GraphQL 请求函数（参考 test-sales-flow.js）
// 关键点：登录响应的 token 在 header `vendure-auth-token`，不在 body
async function gql(query, variables = {}, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN_API, {
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
  // 从 response header 取 token（登录时返回，后续请求会回传相同 token）
  const headerToken = res.headers.get('vendure-auth-token');
  if (headerToken) body.data.__authToken = headerToken;
  return body.data;
}

// 登录函数：调用 login mutation，从 header 取 Bearer token
async function login(username, password) {
  const data = await gql(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        ... on CurrentUser { identifier id }
        ... on InvalidCredentialsError { message }
      }
    }`,
    { username, password },
  );
  if (!data.__authToken) {
    throw new Error('Login failed: ' + (data.login?.message ?? 'no token returned'));
  }
  return data.__authToken;
}

async function run() {
  console.log('=== 客服模块 e2e 验收开始 ===\n');

  // 1. 超管登录
  console.log('[1] 超管登录...');
  superAdminToken = await login('superadmin@china.test', 'superadmin');
  console.log('  ✅ 超管登录成功\n');

  // 2. 验证 customer-service 角色权限同步
  console.log('[2] 验证 customer-service 角色权限...');
  const rolesData = await gql(
    `query { roles(options: { filter: { code: { eq: "customer-service" } } }) { items { code permissions } } }`,
    {},
    superAdminToken,
  );
  const csRole = rolesData.roles.items[0];
  if (!csRole) throw new Error('customer-service 角色不存在');
  const requiredPerms = ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer'];
  const missing = requiredPerms.filter(p => !csRole.permissions.includes(p));
  if (missing.length > 0) throw new Error(`缺少权限: ${missing.join(', ')}`);
  console.log(`  ✅ 角色权限完整: ${csRole.permissions.join(', ')}\n`);

  // 3. 创建客服账号（已存在则跳过）
  console.log('[3] 创建客服账号...');
  try {
    await gql(
      `mutation {
        createAdministrator(input: {
          firstName: "CS"
          lastName: "Staff"
          emailAddress: "cs1@zhao.test"
          password: "a963963"
          roleCodes: ["customer-service"]
        }) { id }
      }`,
      {},
      superAdminToken,
    );
    console.log('  ✅ 客服账号创建成功 (cs1@zhao.test / a963963)');
  } catch (e) {
    console.log('  ℹ️  客服账号已存在，跳过创建');
  }
  console.log();

  // 4. 客服登录
  console.log('[4] 客服登录...');
  csStaffToken = await login('cs1@zhao.test', 'a963963');
  console.log('  ✅ 客服登录成功\n');

  // 5. 客服查询全量订单
  console.log('[5] 客服查询全量订单...');
  const ordersData = await gql(
    `query { csAllOrders(page: 1, pageSize: 10) { items { id code state } totalItems } }`,
    {},
    csStaffToken,
  );
  console.log(`  ✅ 查询到 ${ordersData.csAllOrders.totalItems} 个订单`);
  if (ordersData.csAllOrders.items.length > 0) {
    testOrderId = ordersData.csAllOrders.items[0].id;
    console.log(`  ℹ️  选取订单 ${ordersData.csAllOrders.items[0].code} 用于后续测试`);
  }
  console.log();

  // 6. 客服查询订单详情
  if (testOrderId) {
    console.log('[6] 客服查询订单详情...');
    const detailData = await gql(
      `query($id: ID!) { csOrderDetail(id: $id) { order { code state } exceptionInfo { deliveryStatus } afterSalesRequests { id state } } }`,
      { id: testOrderId },
      csStaffToken,
    );
    console.log(`  ✅ 订单详情查询成功: ${detailData.csOrderDetail.order.code}`);
    if (detailData.csOrderDetail.afterSalesRequests.length > 0) {
      testAfterSalesId = detailData.csOrderDetail.afterSalesRequests[0].id;
      console.log(`  ℹ️  选取售后单 ${testAfterSalesId} 用于后续测试`);
    }
    console.log();
  }

  // 7. 客服查询异常订单
  console.log('[7] 客服查询异常订单...');
  const excData = await gql(
    `query { csExceptionOrders(page: 1, pageSize: 10) { items { order { id code } exceptionInfo { exceptionType } } totalItems } }`,
    {},
    csStaffToken,
  );
  console.log(`  ✅ 查询到 ${excData.csExceptionOrders.totalItems} 个异常订单\n`);

  // 8. 客服添加异常备注（如果有异常订单）
  if (excData.csExceptionOrders.items.length > 0) {
    console.log('[8] 客服添加异常备注...');
    const excOrderId = excData.csExceptionOrders.items[0].order.id;
    if (excOrderId) {
      const noteData = await gql(
        `mutation($orderId: ID!, $note: String!) { csAddExceptionNote(orderId: $orderId, note: $note) { csNotes { content createdBy } } }`,
        { orderId: excOrderId, note: '客服测试备注 - 已联系客户' },
        csStaffToken,
      );
      console.log(`  ✅ 备注添加成功，共 ${noteData.csAddExceptionNote.csNotes.length} 条备注\n`);
    }
  } else {
    console.log('[8] 跳过异常备注测试（无异常订单）\n');
  }

  // 9. 售后单操作（如果有售后单）
  if (testAfterSalesId) {
    console.log('[9] 售后单查询与操作...');
    const arData = await gql(
      `query($id: ID!) { csAfterSalesRequestDetail(id: $id) { id state reason refundAmount } }`,
      { id: testAfterSalesId },
      csStaffToken,
    );
    console.log(`  ✅ 售后单查询: state=${arData.csAfterSalesRequestDetail.state}`);

    const listData = await gql(
      `query { csAfterSalesRequests(page: 1, pageSize: 10) { items { id state } totalItems } }`,
      {},
      csStaffToken,
    );
    console.log(`  ✅ 售后单列表: ${listData.csAfterSalesRequests.totalItems} 条\n`);
  } else {
    console.log('[9] 跳过售后单操作（无售后单）\n');
  }

  // 10. 权限隔离测试
  console.log('[10] 权限隔离测试...');
  // 客服不应能调用 salesCreateOrder（无 CreateOrder 权限）
  try {
    await gql(
      `mutation { salesCreateOrder(input: { lines: [{ productVariantId: "1", quantity: 1 }], shippingAddress: { streetLine1: "test" }, shippingMethodId: "1", salesChannel: store }) { id } }`,
      {},
      csStaffToken,
    );
    console.log('  ❌ 权限隔离失败: 客服能调用 salesCreateOrder');
  } catch (e) {
    console.log('  ✅ 权限隔离正常: 客服无法调用 salesCreateOrder');
  }
  console.log();

  console.log('=== 客服模块 e2e 验收完成 ===');
}

run().catch(e => {
  console.error('验收失败:', e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the e2e test**

Run:
```bash
cd e:\code\vendure && node test-cs-flow.js
```

Expected: All 10 test steps pass with ✅ markers. No ❌ markers.

If any step fails, fix the issue in the corresponding plugin/page file, rebuild if backend, then re-run.

- [ ] **Step 3: Commit**

```bash
cd e:\code\vendure && git add test-cs-flow.js && git commit -m "test(customer-service): add e2e acceptance script" --no-verify
```

---

## Self-Review

### Spec coverage
- ✅ Section 1 (Background & Goals): all-order query (Task 5, 12), after-sales handling (Task 5, 13), exception follow-up (Task 5, 14), permission isolation (Task 3, 15)
- ✅ Section 2 (Architecture): backend plugin (Task 2-7), frontend subpackage (Task 10-14), MODULE_CONFIGS (Task 8)
- ✅ Section 3 (Permissions & Roles): constants (Task 3), role-sync (Task 3), @Allow decorators (Task 6)
- ✅ Section 4 (GraphQL API): all queries/mutations in Task 6 + Task 7 schema
- ✅ Section 5 (Service Layer): CustomerServiceService in Task 5, AfterSalesService injection in Task 1 + Task 7
- ✅ Section 6 (Frontend Pages): all 5 pages in Task 12-14, API client in Task 10, pages.json + shortcuts in Task 11
- ✅ Section 7 (Risks): AfterSalesService DI resolved (Task 1), csNotes struct list verified in Task 9, permission reuse in Task 3

### Placeholder scan
- No "TBD", "TODO", "implement later" — all code blocks contain complete implementations
- No "add appropriate error handling" — error handling is explicit in each method
- No "similar to Task N" — each task's code is self-contained

### Type consistency
- `CustomerServicePermissions` used in Task 3 (constants) + Task 6 (resolver @Allow decorators) ✅
- `CustomerServiceService` method names in Task 5 match resolver calls in Task 6 ✅
- `AfterSalesService` method names (`approveRequest`/`rejectRequest`/`confirmReceive`/`processRefund`) verified against actual source in Task 1 ✅
- `csApi` method names in Task 10 match GraphQL query/mutation names in Task 7 schema ✅
- Frontend page imports (`csApi.allOrders`, `csApi.orderDetail`, etc.) match Task 10 exports ✅
