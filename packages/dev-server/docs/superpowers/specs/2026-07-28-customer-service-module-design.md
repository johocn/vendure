# Customer Service Module Design

> **For agentic workers:** This spec defines the customer-service module (售后/客服模块) for the Vendure mobile backend (vadmin). It is the 3rd module in the multi-tenant mobile workforce platform, following delivery and sales modules.

**Goal:** Enable customer-service staff to handle post-order operations (after-sales refunds, exception follow-ups) and query all orders from the mobile vadmin app, with proper permission isolation from sales/delivery staff.

**Architecture:** Independent `@vendure/customer-service-plugin` (backend) wrapping `OrderService` + `AfterSalesService` (from after-sales-plugin) + a new `pkg-customer-service` uni-app subpackage (frontend). No new entities — only Order customFields extension for csNotes and delegation to existing services.

**Tech Stack:** Vendure v3.6+ plugin system, NestJS DI, TypeORM QueryBuilder, GraphQL admin API extensions, uni-app (Vue 3) mobile frontend.

---

## 1. Background & Goals

### Background
vadmin has delivered delivery (送货) and sales (销售) modules. Orders flow: sales creates → customer pays → delivery ships. But after-sales and exception handling are missing: refunds require admin backend, delivery exceptions have no follow-up, customer-service staff cannot view all orders on mobile.

### Core Goals
1. **All-order query**: Customer-service staff view all orders (not limited to their own) on mobile, filterable by state/customer/time
2. **After-sales handling**: Wrap after-sales-plugin's admin API so CS staff can approve and execute refunds on mobile
3. **Exception follow-up**: View exception orders reported by delivery-staff, add CS follow-up notes (without changing delivery status)
4. **Permission isolation**: cs-staff role contains only CS permissions — cannot create orders, modify prices, or deliver

### Non-Goals (Phase 2)
- Exchange and reship: after-sales-plugin currently only has enum placeholders, needs extension
- Ticket dispatch system: exception follow-up is notes-only, no cross-department tickets
- Customer-initiated after-sales shop-api: already exists in after-sales-plugin, not duplicated here

---

## 2. Architecture

### Backend: `@vendure/customer-service-plugin`

Independent plugin, peer to delivery/sales-plugin, reuses the same pattern (PermissionDefinition + RoleSync + adminApiExtensions). **No new entities** — only wraps existing services.

```
vendure/packages/customer-service-plugin/src/
├── constants.ts                       # CustomerServicePermissions, ROLE_PERMISSIONS_MAP
├── customer-service.plugin.ts         # @VendurePlugin entry
├── customer-service.service.ts        # Wraps OrderService + AfterSalesService
├── customer-service-admin.resolver.ts # GraphQL resolvers
├── role-sync.ts                       # cs-staff role sync (same pattern)
└── index.ts
```

**Key dependencies**:
- `OrderService`: all-order query (no staffId filter)
- `AfterSalesService` (from after-sales-plugin): injected via NestJS DI (requires modifying after-sales-plugin to export the service — see "AfterSalesService Injection" in Section 5)
- `TransactionalConnection`: exception order query (filter by `customFields.deliveryStatus = 'exception'`)

### Frontend: `vadmin/src/pkg-cs/` (reuses existing placeholder subpackage)

**Naming decision**: Backend plugin uses full English name `customer-service-plugin` (per user requirement "补全用全英文命名插件"). Frontend subpackage keeps existing `pkg-cs` name (already registered as placeholder in pages.json + shortcuts.ts with `cs-` code prefix) to avoid unnecessary refactor. API client file uses full English name `customer-service.ts` to align with backend plugin.

```
vadmin/src/pkg-cs/
├── api/customer-service.ts   # GraphQL client (full English name, aligns with backend)
└── pages/
    ├── orders/index.vue        # All-order list (filter + search)
    ├── orders/detail.vue       # Order detail (with after-sales button)
    ├── aftersales/index.vue    # After-sales request list
    ├── aftersales/detail.vue   # After-sales detail (approve/execute refund)
    └── exceptions/index.vue    # Exception order list + notes
```

### Data Flow

```
CS staff queries orders in vadmin
  ↓ csAllOrders query (admin-api)
CustomerServiceService.findAllOrders()
  ↓ OrderService.findAll (no staffId filter)
  ↓ returns Order[]

CS staff initiates refund
  ↓ csProcessRefund mutation
CustomerServiceService.processRefund(orderId)
  ↓ AfterSalesService.processAfterSalesRefund(id)
  ↓ AfterSalesService internally calls OrderService.refundOrder

CS staff handles exception
  ↓ csExceptionOrders query
CustomerServiceService.findExceptionOrders()
  ↓ filter by customFields.deliveryStatus = 'exception'
  ↓ csAddExceptionNote mutation → OrderService.updateCustomFields(note)
```

### MODULE_CONFIGS

In `delivery-plugin/constants.ts`, change `cs` module `enabled` from `false` to `true` and update `entryPath` to `/pkg-cs/pages/orders/index` (reuse the same MVP centralized-config pattern as sales).

---

## 3. Permissions & Roles

### Permission Definitions

| Permission Name | Description | Roles |
|-----------------|-------------|-------|
| `ViewAllOrders` | View all orders | customer-service, manager, super-admin |
| `HandleAfterSales` | Handle after-sales (approve/refund) | customer-service, manager, super-admin |
| `HandleException` | Exception follow-up (view + note) | customer-service, manager, super-admin |
| `ManageCustomer` | Customer profile management | customer-service, manager, super-admin (already defined in sales) |

**Note**: `ViewAllOrders` / `HandleAfterSales` / `HandleException` are already defined in `delivery-plugin/constants.ts` `DeliveryPermissions` and registered to `customPermissions`. The customer-service-plugin **does not re-register** these permissions — it only references them in `ROLE_PERMISSIONS_MAP`.

### Role Sync

`customer-service-plugin`'s `ROLE_PERMISSIONS_MAP` only contains the `customer-service` role (already defined in delivery-plugin, here does incremental permission binding):

```typescript
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'customer-service': [
    'Authenticated',
    'ViewAllOrders',
    'HandleAfterSales',
    'HandleException',
    'ManageCustomer',
  ],
  'manager': ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer'],
  'super-admin': ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer', 'SuperAdmin'],
};
```

Reuses sales' incremental sync pattern: existing roles only get missing permissions bound.

### @Allow Decorators

- `csAllOrders` / `csOrderDetail`: `@Allow('ViewAllOrders' as Permission)`
- `csAfterSalesRequests` / `csProcessRefund` / `csApproveAfterSales`: `@Allow('HandleAfterSales' as Permission)`
- `csExceptionOrders` / `csAddExceptionNote`: `@Allow('HandleException' as Permission)`

---

## 4. GraphQL API Design

### Queries

```graphql
# All-order query (paginated + filterable)
csAllOrders(
  state: String
  customerEmail: String
  startDate: String
  endDate: String
  page: Int
  pageSize: Int
): CsOrderList!

# Order detail (with after-sales + exception info)
csOrderDetail(id: ID!): CsOrderDetail

# After-sales request list
csAfterSalesRequests(
  state: String
  page: Int
  pageSize: Int
): CsAfterSalesList!

# After-sales request detail
csAfterSalesRequestDetail(id: ID!): CsAfterSalesRequest

# Exception order list (deliveryStatus = exception)
csExceptionOrders(
  exceptionType: String
  page: Int
  pageSize: Int
): CsExceptionOrderList!
```

### Mutations

```graphql
# Approve after-sales (proxy AfterSalesService.approveAfterSalesRequest)
csApproveAfterSales(id: ID!): CsAfterSalesRequest!

# Reject after-sales (proxy AfterSalesService.rejectAfterSalesRequest)
csRejectAfterSales(id: ID!, reason: String!): CsAfterSalesRequest!

# Confirm return received (proxy AfterSalesService.confirmReturnReceived)
csConfirmReturnReceived(id: ID!): CsAfterSalesRequest!

# Execute refund (proxy AfterSalesService.processAfterSalesRefund)
csProcessRefund(id: ID!): CsAfterSalesRequest!

# Add CS note to exception order
csAddExceptionNote(orderId: ID!, note: String!): CsExceptionOrder!
```

### Custom Return Types

```graphql
type CsOrderList {
  items: [Order!]!
  totalItems: Int!
}

type CsOrderDetail {
  order: Order!
  afterSalesRequests: [CsAfterSalesRequest!]!  # after-sales linked to this order
  exceptionInfo: CsExceptionInfo                # delivery exception info (null if no exception)
}

type CsExceptionInfo {
  deliveryStatus: String!
  exceptionType: String
  exceptionNote: String
  exceptionPhotos: [String!]
  deliveryStaffId: String
}

type CsAfterSalesList {
  items: [CsAfterSalesRequest!]!
  totalItems: Int!
}

type CsAfterSalesRequest {
  id: ID!
  type: String!          # return_refund | refund_only | exchange
  state: String!         # Pending | Approved | Returning | Received | Refunded | Rejected | Closed
  reason: String!
  description: String
  refundAmount: Int!
  createdAt: DateTime!
  order: Order
  orderLine: OrderLine
  customer: Customer
  returnTrackingNo: String
  returnCarrier: String
  rejectReason: String
}

type CsExceptionOrderList {
  items: [CsExceptionOrder!]!
  totalItems: Int!
}

type CsExceptionOrder {
  order: Order!
  exceptionInfo: CsExceptionInfo!
  csNotes: [CsNote!]!    # CS follow-up notes list
}

type CsNote {
  id: ID!
  content: String!
  createdBy: String!
  createdAt: DateTime!
}
```

### csNotes Implementation

CS notes stored on Order customFields as a struct list:

```typescript
{
  name: 'csNotes',
  type: 'struct',
  list: true,
  fields: [
    { name: 'content', type: 'string' },
    { name: 'createdBy', type: 'string' },
    { name: 'createdAt', type: 'datetime' },
  ],
}
```

Each `csAddExceptionNote` appends a struct element to the `csNotes` array; existing notes are not modified.

---

## 5. Service Layer Design

### CustomerServiceService Core Methods

```typescript
@Injectable()
export class CustomerServiceService {
  constructor(
    private connection: TransactionalConnection,
    private orderService: OrderService,
    private afterSalesService: AfterSalesService,  // injected from after-sales-plugin
  ) {}

  // ===== Order Query =====

  // All orders (no staffId filter, supports filter + pagination)
  async findAllOrders(ctx, options?): Promise<{ items: Order[]; totalItems: number }> {
    const qb = this.connection.getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.lines', 'lines')
      .leftJoinAndSelect('lines.productVariant', 'variant')
      .orderBy('order.createdAt', 'DESC');

    if (options?.state) qb.andWhere('order.state = :state', { state: options.state });
    if (options?.customerEmail) qb.andWhere('customer.emailAddress LIKE :email', { email: `%${options.customerEmail}%` });
    if (options?.startDate) qb.andWhere('order.createdAt >= :start', { start: new Date(options.startDate) });
    if (options?.endDate) qb.andWhere('order.createdAt <= :end', { end: new Date(options.endDate) });

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
  }

  // Order detail (aggregate order + after-sales + exception info)
  async findOrderDetail(ctx, orderId: ID): Promise<CsOrderDetail | null> {
    const order = await this.orderService.findOne(ctx, orderId, ['customer', 'lines', 'lines.productVariant', 'fulfillments']);
    if (!order) return null;

    // Query after-sales linked to this order (directly query AfterSalesRequest entity)
    const afterSalesRepo = this.connection.rawConnection.getRepository('AfterSalesRequest');
    const afterSalesRequests = await afterSalesRepo.find({
      where: { orderId } as any,
      relations: ['order', 'orderLine', 'customer'],
      order: { createdAt: 'DESC' },
    });

    // Exception info (from delivery customFields)
    const cf = (order.customFields ?? {}) as any;
    const exceptionInfo = cf.deliveryStatus === 'exception' ? {
      deliveryStatus: cf.deliveryStatus,
      exceptionType: cf.exceptionType,
      exceptionNote: cf.exceptionNote,
      exceptionPhotos: cf.exceptionPhotos ?? [],
      deliveryStaffId: cf.deliveryStaffId,
    } : null;

    return { order, afterSalesRequests, exceptionInfo };
  }

  // ===== After-sales Handling (proxy AfterSalesService) =====
  // Note: AfterSalesService uses short method names (not the GraphQL mutation names)
  // GraphQL mutation names: csApproveAfterSales / csRejectAfterSales / csConfirmReturnReceived / csProcessRefund
  // Service method names:   approveRequest / rejectRequest / confirmReceive / processRefund

  async approveAfterSales(ctx, id: ID) {
    return this.afterSalesService.approveRequest(ctx, id);
  }
  async rejectAfterSales(ctx, id: ID, reason: string) {
    return this.afterSalesService.rejectRequest(ctx, id, reason);
  }
  async confirmReturnReceived(ctx, id: ID) {
    return this.afterSalesService.confirmReceive(ctx, id);
  }
  async processRefund(ctx, id: ID) {
    return this.afterSalesService.processRefund(ctx, id);
  }

  // ===== Exception Follow-up =====

  async findExceptionOrders(ctx, options?): Promise<{ items: any[]; totalItems: number }> {
    const qb = this.connection.getRepository(ctx, Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.shippingAddress', 'shippingAddress')
      .where('order.customFields.deliveryStatus = :status', { status: 'exception' })
      .orderBy('order.createdAt', 'DESC');

    if (options?.exceptionType) {
      qb.andWhere('order.customFields.exceptionType = :type', { type: options.exceptionType });
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [orders, totalItems] = await qb.getManyAndCount();

    const items = orders.map(order => ({
      order,
      exceptionInfo: {
        deliveryStatus: (order.customFields as any)?.deliveryStatus,
        exceptionType: (order.customFields as any)?.exceptionType,
        exceptionNote: (order.customFields as any)?.exceptionNote,
        exceptionPhotos: (order.customFields as any)?.exceptionPhotos ?? [],
        deliveryStaffId: (order.customFields as any)?.deliveryStaffId,
      },
      csNotes: (order.customFields as any)?.csNotes ?? [],
    }));

    return { items, totalItems };
  }

  // Append CS note (does not modify existing notes)
  async addExceptionNote(ctx, orderId: ID, note: string): Promise<Order> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) throw new UserInputError(`Order ${orderId} not found`);

    const existingNotes = (order.customFields as any)?.csNotes ?? [];
    const newNote = {
      content: note,
      createdBy: String(ctx.activeUserId),
      createdAt: new Date(),
    };

    return this.orderService.updateCustomFields(ctx, orderId, {
      csNotes: [...existingNotes, newNote],
    });
  }
}
```

### AfterSalesService Injection

**Blocking point resolved during spec review**: `AfterSalesService` is currently NOT exported by after-sales-plugin (verified by reading source):
- `after-sales-plugin/src/plugin.ts` `@VendurePlugin` decorator has no `exports` array
- `after-sales-plugin/index.ts` does not export `AfterSalesService` type

**Required fix (2 lines, modifies after-sales-plugin)**:
1. In `after-sales-plugin/src/plugin.ts` `@VendurePlugin` decorator, add `exports: [AfterSalesService]` to the config object
2. In `after-sales-plugin/index.ts`, add `export * from './src/after-sales.service';`

After this fix, customer-service-plugin can inject `AfterSalesService` via standard NestJS DI:
- `customer-service.plugin.ts` `@VendurePlugin.imports: [AfterSalesPlugin]`
- `CustomerServiceService` constructor: `private afterSalesService: AfterSalesService`

**Verified AfterSalesService public methods** (for reference):
- `approveRequest(ctx, id)` → `AfterSalesRequest`
- `rejectRequest(ctx, id, reason)` → `AfterSalesRequest`
- `confirmReceive(ctx, id)` → `AfterSalesRequest`
- `processRefund(ctx, id)` → `AfterSalesRequest` (internally calls `OrderService.refundOrder` + updates state)
- `findOne(ctx, id)` / `findAll(ctx, options)` / `findMyRequests(ctx, options)` — query helpers
- `createRequest(ctx, input)` / `cancelRequest(ctx, id)` / `updateReturnTracking(ctx, id, trackingNo, carrier)` — not used by CS plugin (customer-side operations)

---

## 6. Frontend Page Design

### Page Routes (registered in pages.json, reuses existing pkg-cs subpackage)

```
/pkg-cs/pages/orders/index        # All orders
/pkg-cs/pages/orders/detail       # Order detail
/pkg-cs/pages/aftersales/index    # After-sales list
/pkg-cs/pages/aftersales/detail   # After-sales detail
/pkg-cs/pages/exceptions/index    # Exception orders
```

**pages.json change**: Remove existing `pkg-cs/pages/placeholder` entry, add the 5 real pages above. Set `enablePullDownRefresh: true` for list pages (orders/index, aftersales/index, exceptions/index).

### Page 1: All-Order List (orders/index.vue)

**Core features**: Paginated loading + filter + search

**Layout**:
- Top: Search bar (by customer email) + filter bar (order state dropdown: All/AddingItems/ArrangingPayment/PaymentAuthorized/PaymentSettled/PartiallyShipped/Shipped/PartiallyDelivered/Delivered/Cancelled)
- List item: Order code, customer name, amount, state tag (colored), placed-at time
- Bottom: Pull-up load more
- Each item tap → `/pkg-cs/pages/orders/detail?id=xxx`

**Data**: Calls `csAllOrders` query, paginated page/pageSize=20

### Page 2: Order Detail (orders/detail.vue)

**Core features**: Display order overview + after-sales entry + exception info

**Layout**:
- Basic info card: Order code, state, placed-at, customer info (name/email/phone)
- Shipping address card: Name, phone, full address
- Product list: Each row product name, quantity, unit price, subtotal
- Exception info card (conditional render): Only shown when `exceptionInfo` is non-null — exception type, note, photo thumbnails, delivery staff ID
- CS notes area: Lists `csNotes`, each with content, creator, time; bottom input box + submit button (calls `csAddExceptionNote`)
- After-sales block: Lists `afterSalesRequests` linked to this order; each item → after-sales detail
- Bottom action bar: MVP does not display "Apply for After-sales" creation button on this page (CS staff only handle existing customer-initiated requests; CS-initiated after-sales is Phase 2)

### Page 3: After-Sales List (aftersales/index.vue)

**Core features**: View all after-sales requests + state filter

**Layout**:
- Top filter bar: State dropdown (Pending/Approved/Returning/Received/Refunded/Rejected/Closed)
- List item: After-sales code, linked order code, type tag (refund/return-refund/exchange), state tag, refund amount, request time
- Each item tap → `/pkg-cs/pages/aftersales/detail?id=xxx`

**Data**: Calls `csAfterSalesRequests` query

### Page 4: After-Sales Detail (aftersales/detail.vue)

**Core features**: Display after-sales detail + CS operations

**Layout**:
- After-sales info card: Code, type, state, reason, description, refund amount, created-at
- Linked order card: Order code, customer, products (tap → order detail)
- Return logistics card (conditional render): Return tracking no, carrier
- Reject reason card (conditional render): Only shown in Rejected state
- Bottom action bar (dynamic by state):
  - Pending: [Approve] [Reject] (reject requires reason input via popup)
  - Approved: Awaiting buyer return (no button)
  - Returning: Awaiting return logistics (no button)
  - Received: [Execute Refund]
  - Refunded/Rejected/Closed: No button

**Operations**:
- Approve → `csApproveAfterSales`
- Reject → `csRejectAfterSales` (reason from popup)
- Execute refund → `csProcessRefund`
- Return receipt confirm → `csConfirmReturnReceived` (shown in Returning state, before Received)

### Page 5: Exception Order List (exceptions/index.vue)

**Core features**: View exception orders reported by delivery + type filter

**Layout**:
- Top filter bar: Exception type dropdown (All/rejected/wrong_address/no_recipient/damaged/other)
- List item: Order code, customer name, exception type tag, exception note, reported-at time
- Each item tap → order detail page (reuses orders/detail, shows exception info card + CS notes area)

**Data**: Calls `csExceptionOrders` query

### Frontend API Client (pkg-cs/api/customer-service.ts)

Centralizes all GraphQL calls, consistent with sales/delivery api patterns (reference: `pkg-sales/api/sales.ts`):
- Use `graphql-request` lib's `gql` tag + `GraphQLClient`
- Endpoint: `${VITE_API_URL}/admin-api`
- Auth: read token from `useAuthStore()`, inject `Authorization: Bearer xxx` header
- Export pattern: `export const csApi = { method1, method2, ... }` object literal with async methods
- Each method: `getClient()` → `client.request(gql\`...\`, vars)` → `return data.xxx`

```typescript
export const csApi = {
  allOrders: (params) => graphql(`
    query CsAllOrders($state: String, $customerEmail: String, $startDate: String, $endDate: String, $page: Int, $pageSize: Int) {
      csAllOrders(state: $state, customerEmail: $customerEmail, startDate: $startDate, endDate: $endDate, page: $page, pageSize: $pageSize) {
        items { id code state total createdAt customer { firstName lastName emailAddress } }
        totalItems
      }
    }
  `, params),
  // ... csOrderDetail, csAfterSalesRequests, csApproveAfterSales, csRejectAfterSales, csConfirmReturnReceived, csProcessRefund, csExceptionOrders, csAddExceptionNote
};
```

### Dashboard Entries

Update existing placeholder entries in `vadmin/src/config/shortcuts.ts` (already registered with `cs-` prefix, just flip `enabled: true` and update `entryPath`):
- `cs-orders` → `enabled: true`, `entryPath: /pkg-cs/pages/orders/index` (orders list)
- `cs-after-sales` → `enabled: true`, `entryPath: /pkg-cs/pages/aftersales/index` (after-sales list)
- Add new entry `cs-exceptions` → `enabled: true`, `entryPath: /pkg-cs/pages/exceptions/index` (exception orders)
- Customer profile: reuse sales' `sales-customer` entry (no duplicate entry; CS staff with `ManageCustomer` permission will see it via permission filtering)

---

## 7. Risks & Open Items

### Identified Risks

1. **AfterSalesService DI reachability** (high — **RESOLVED during spec review**)
   - Risk: after-sales-plugin does not export `AfterSalesService` via `@VendurePlugin.exports`, and index.ts does not export the service type
   - Resolution: Modify after-sales-plugin (2 lines): add `exports: [AfterSalesService]` to `@VendurePlugin` decorator in `plugin.ts`, add `export * from './src/after-sales.service';` to `index.ts`. Verified that after-sales-plugin has no other consumers that would be affected by this export.

2. **csNotes struct list serialization** (medium)
   - Risk: Vendure customFields `struct` + `list: true` serialization behavior on SQLite/SQL.js needs verification; TypeORM may handle nested struct arrays inconsistently
   - Mitigation: At implementation, write a minimal test case for csNotes read/write before expanding business logic. If struct list is unstable, fallback to JSON string field with manual parse/stringify.

3. **Cross-plugin permission name reuse** (low)
   - Risk: `ViewAllOrders` / `HandleAfterSales` / `HandleException` are registered in delivery-plugin; if customer-service-plugin loads first, it fails
   - Mitigation: customer-service-plugin **does not re-register** these permissions, only references them; in `customer-service.plugin.ts` use `@Allow(Permission)` decorators referencing string literals (e.g., `'ViewAllOrders' as Permission`). Vendure plugin loading order is determined by dev-config.ts plugins array — ensure customer-service-plugin is registered AFTER delivery-plugin.

4. **Cancelled/Completed order visibility** (low)
   - Risk: Vendure default `OrderService.findAll` only returns `active=true` orders; Cancelled orders are invisible, affecting CS history view
   - Mitigation: `findAllOrders` uses TypeORM QueryBuilder directly, does not filter `active` field (consistent with sales-plugin fix)

5. **After-sales state machine assumptions** (low — **VERIFIED during spec review**)
   - Risk: GraphQL state transitions (Pending→Approved→Returning→Received→Refunded) were based on assumptions about after-sales-plugin
   - Resolution: Read `after-sales-plugin/src/types.ts`, confirmed state machine: `Pending→[Approved,Rejected]`, `Approved→[Returning,Closed]`, `Returning→[Received,Closed]`, `Received→[Refunded]`. spec's UI state transitions are correct.

6. **Exception order query performance** (low)
   - Risk: `customFields.deliveryStatus = 'exception'` is a JSON field query without index
   - Mitigation: MVP order volume is small, acceptable; optimize later if performance issues arise

### Verified During Spec Review (was Open Items)

1. **after-sales-plugin's actual API** — VERIFIED:
   - `AfterSalesService` public methods: `approveRequest` / `rejectRequest(ctx, id, reason)` / `confirmReceive` / `processRefund` (short names, not GraphQL mutation names)
   - `AfterSalesRequest` entity fields: `returnTrackingNo` / `returnCarrier` / `rejectReason` / `orderId` + `order` / `orderLineId` + `orderLine` / `customerId` + `customer` — all confirmed
   - State enum: `Pending` / `Approved` / `Returning` / `Received` / `Refunded` / `Rejected` / `Closed` — 7 values match spec exactly
   - State transitions: `Pending→[Approved,Rejected]`, `Approved→[Returning,Closed]`, `Returning→[Received,Closed]`, `Received→[Refunded]` — spec's UI button visibility logic is correct

2. **dev-config.ts current state** — VERIFIED:
   - `AfterSalesPlugin.init()` already registered (line 339)
   - `DeliveryPlugin.init()` + `SalesPlugin.init()` already registered (line 344-345)
   - No customer-service-plugin reference yet — needs to be added AFTER AfterSalesPlugin (for DI dependency)
   - `orderItemPriceCalculationStrategy: new SalesOrderItemPriceCalculationStrategy()` already configured

3. **vadmin frontend current state** — VERIFIED:
   - `pkg-cs` subpackage already registered in pages.json with 1 placeholder page
   - shortcuts.ts has `cs-orders` + `cs-after-sales` entries with `enabled: false` (need to flip to true + update entryPath)
   - Need to add `cs-exceptions` entry (not yet in shortcuts.ts)
   - Reference impl: `pkg-sales/api/sales.ts` uses `graphql-request` + `useAuthStore()` pattern
   - Reference page: `pkg-sales/pages/list/index.vue` uses Composition API + `onPullDownRefresh` + picker filter

### Remaining Open Items (low priority)

1. **After-sales creation entry**: MVP CS staff do not create new after-sales requests; they only handle customer-initiated requests. If CS-initiated after-sales is needed, Phase 2 extends.

2. **Whether exception notes need to notify delivery-staff**: MVP does not notify; CS internal notes only. If linkage notification is needed, Phase 2 adds WebSocket/polling.

### Scope Confirmation

- ✅ Phase 1 (this spec): All-order query, after-sales approve/refund execution, exception notes
- ⏸ Phase 2: Exchange/reship, CS-initiated after-sales, exception notification linkage, customer-initiated after-sales shop-api (already in after-sales-plugin)
