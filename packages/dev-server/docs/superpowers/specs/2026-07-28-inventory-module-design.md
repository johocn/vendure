# Inventory Module Design

> **For agentic workers:** This spec defines the inventory module (调库模块) for the Vendure mobile backend (vadmin). It is the 4th module in the multi-tenant mobile workforce platform, following delivery, sales, and customer-service modules.

**Goal:** Enable inventory staff to manage stock across multiple warehouses via mobile — query stock levels, create stock-in/out/move orders, and run stocktakes with difference reconciliation. All operations produce auditable StockMovement flows tied to business documents.

**Architecture:** Independent `@vendure/inventory-plugin` (backend) wrapping Vendure's native `StockMovementService` + `StockLevelService` + 4 new business-order entities (StockInOrder / StockOutOrder / StockMoveOrder / StocktakeOrder). New `pkg-inventory` uni-app subpackage (frontend). No duplication of native StockLevel/StockMovement tables — all stock changes land in native tables via `adjustProductVariantStock`.

**Tech Stack:** Vendure v3.6+ plugin system, NestJS DI, TypeORM QueryBuilder, GraphQL admin API extensions (schema-first), PostgreSQL, uni-app (Vue 3) mobile frontend.

---

## 1. Background & Goals

### Background
vadmin has delivered delivery (送货), sales (销售), and customer-service (客服) modules. The order flow is: sales creates → customer pays → delivery ships → customer-service handles after-sales. But inventory management is missing: stock levels are only updated by the order state machine (ALLOCATION/SALE/RELEASE/CANCELLATION), with no manual stock-in/out/move/stocktake capability for warehouse staff.

Vendure provides native multi-warehouse support (StockLocation + StockLevel + StockMovement) but lacks:
- Business order entities (stock-in/out/move/stocktake orders with state machines)
- Independent stock adjustment mutations (only via `updateProductVariants`)
- Transfer workflow between warehouses
- Stocktake workflow with difference reconciliation

### Core Goals
1. **Stock query**: View stock levels by warehouse/variant, with available = onHand - allocated
2. **Stock-in order**: Record inbound stock (purchase return, initial, adjustment) with audit flow
3. **Stock-out order**: Record outbound stock (scrap, damage, adjustment) with audit flow
4. **Stock move order**: Transfer stock between warehouses with InTransit intermediate state and rollback capability
5. **Stocktake order**: Count stock, reconcile differences, apply adjustments
6. **Permission isolation**: inventory-staff role has only inventory permissions — cannot sell, deliver, or handle after-sales

### Non-Goals (Phase 2)
- Supplier management and purchase order integration
- Multi-location stock allocation strategy customization (use Vendure default `MultiChannelStockLocationStrategy`)
- Low-stock alerts and auto-replenishment
- Inventory cost accounting (unitPrice is recorded but not aggregated)
- Batch/lot tracking and expiry management

---

## 2. Architecture

### Backend: `@vendure/inventory-plugin`

Independent plugin, peer to delivery/sales/customer-service-plugin, reuses the same pattern (PermissionDefinition reference + RoleSync + adminApiExtensions). **4 new business entities** — no duplication of native StockLevel/StockMovement.

```
vendure/packages/inventory-plugin/src/
├── constants.ts                       # InventoryPermissions reference + ROLE_PERMISSIONS_MAP + state enums
├── inventory.plugin.ts                # @VendurePlugin entry
├── inventory.service.ts               # Core business logic (wraps StockMovementService)
├── inventory-admin.resolver.ts        # GraphQL resolvers (schema-first)
├── role-sync.ts                       # inventory-staff role sync (incremental permission binding)
├── entities/
│   ├── stock-in-order.entity.ts       # 入库单 + StockInOrderLine
│   ├── stock-out-order.entity.ts      # 出库单 + StockOutOrderLine
│   ├── stock-move-order.entity.ts     # 调拨单 + StockMoveOrderLine
│   └── stocktake-order.entity.ts      # 盘点单 + StocktakeOrderLine
├── index.ts
└── package.json
```

**Key dependencies** (all injected via NestJS DI):
- `StockMovementService.adjustProductVariantStock` — land StockAdjustment flows on order completion
- `StockLevelService.getStockLevel` / `getStockLevelsForVariant` — stock queries
- `StockLocationService` — warehouse list
- `TransactionalConnection` — direct entity queries + transactions

**Permission strategy** (same as customer-service-plugin):
- `ViewStock` / `ManageStockMove` / `ManageStocktake` / `ManageStockIn` / `ManageStockOut` are already defined in `delivery-plugin/constants.ts` `DeliveryPermissions` and registered to `customPermissions`
- inventory-plugin **does not re-register** these permissions — only references them as string constants in `ROLE_PERMISSIONS_MAP` and `@Allow` decorators
- `inventory-staff` role already declared in delivery-plugin's `ROLE_PERMISSIONS_MAP`; inventory-plugin's RoleSync does incremental permission binding

### Frontend: `vadmin/src/pkg-inventory/`

```
vadmin/src/pkg-inventory/
├── api/inventory.ts                   # GraphQL client
└── pages/
    ├── stock/index.vue                # Stock query (by warehouse/variant)
    ├── stock-move/
    │   ├── index.vue                  # Move order list + create entry
    │   └── detail.vue                 # Move order detail + state-driven actions
    ├── stock-in/
    │   ├── index.vue                  # Stock-in order list + create
    │   └── detail.vue                 # Stock-in order detail (complete/cancel)
    ├── stock-out/
    │   ├── index.vue                  # Stock-out order list + create
    │   └── detail.vue                 # Stock-out order detail (complete/cancel)
    └── stocktake/
        ├── index.vue                  # Stocktake order list + create
        └── detail.vue                 # Stocktake detail (startCount/submit/reconcile/complete)
```

### Data Flow

```
Inventory staff queries stock in vadmin
  ↓ stockLevels query (admin-api)
InventoryService.findStockLevels()
  ↓ StockLevelService.getStockLevelsForVariant
  ↓ returns StockLevel[]

Inventory staff creates + completes stock-in order
  ↓ createStockInOrder mutation → StockInOrder (Pending)
  ↓ completeStockInOrder mutation
InventoryService.completeStockInOrder()
  ↓ connection.withTransaction
  ↓ for each line: StockMovementService.adjustProductVariantStock(variantId, [{locationId, newOnHand}])
  ↓ StockLevel.stockOnHand updated + StockAdjustment flow recorded
  ↓ StockInOrder.state = Completed

Inventory staff transfers stock (move order)
  ↓ createStockMoveOrder → shipStockMoveOrder → receiveStockMoveOrder → completeStockMoveOrder
  ↓ ship: source location stockOnHand -= qty (with sufficient stock check)
  ↓ receive: target location stockOnHand += qty
  ↓ cancel at InTransit: source location stockOnHand += qty (rollback)
```

### MODULE_CONFIGS Update

In `delivery-plugin/constants.ts` line 120, change `inventory` module `enabled` from `false` to `true`. No other changes needed (entryPath `/pkg-inventory/pages/stock/index`, icon `📊`, sort 30, perms array already correct).

---

## 3. Permissions & Roles

### Permission Definitions (already registered in delivery-plugin)

| Permission Name | Description | Roles |
|-----------------|-------------|-------|
| `ViewStock` | View stock levels and movements | inventory-staff, manager, super-admin |
| `ManageStockIn` | Create/complete/cancel stock-in orders | inventory-staff, manager, super-admin |
| `ManageStockOut` | Create/complete/cancel stock-out orders | inventory-staff, manager, super-admin |
| `ManageStockMove` | Create/ship/receive/complete/cancel stock move orders | inventory-staff, manager, super-admin |
| `ManageStocktake` | Create/start/submit/reconcile/complete stocktake orders | inventory-staff, manager, super-admin |

### Role Sync

`inventory-plugin`'s `ROLE_PERMISSIONS_MAP`:

```typescript
export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  'inventory-staff': [
    'Authenticated',
    'ViewStock',
    'ManageStockIn',
    'ManageStockOut',
    'ManageStockMove',
    'ManageStocktake',
  ],
  'manager': [
    'Authenticated',
    'ViewStock',
    'ManageStockIn',
    'ManageStockOut',
    'ManageStockMove',
    'ManageStocktake',
  ],
  'super-admin': [
    'Authenticated',
    'ViewStock',
    'ManageStockIn',
    'ManageStockOut',
    'ManageStockMove',
    'ManageStocktake',
    'SuperAdmin',
  ],
};
```

Reuses customer-service-plugin's incremental sync pattern: existing roles only get missing permissions bound.

### @Allow Decorators

- `stockLevels` / `stockMovements` / `stockLocations` / `stockInOrders` / `stockOutOrders` / `stockMoveOrders` / `stocktakeOrders` (list/detail queries): `@Allow('ViewStock' as Permission)`
- StockInOrder mutations: `@Allow('ManageStockIn' as Permission)`
- StockOutOrder mutations: `@Allow('ManageStockOut' as Permission)`
- StockMoveOrder mutations: `@Allow('ManageStockMove' as Permission)`
- StocktakeOrder mutations: `@Allow('ManageStocktake' as Permission)`

---

## 4. Entity Design

4 business order entities, all extend `VendureEntity` and implement `ChannelAware`. Each entity has a lines sub-table. All entities use camelCase column names (consistent with after-sales-plugin convention).

### 4.1 StockInOrder (入库单)

```typescript
@Entity()
export class StockInOrder extends VendureEntity implements ChannelAware {
    @Column() code: string;                    // Business code: RKT + timestamp
    @Column({ default: 'Pending' }) state: StockInState;
    @Column({ nullable: true }) type: string;  // purchase_return / adjustment_in / initial
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;
    @ManyToOne(() => StockLocation) targetLocation: StockLocation;
    @Column() targetLocationId: ID;
    @OneToMany(() => StockInOrderLine, line => line.order) lines: StockInOrderLine[];
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;
    @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}

@Entity()
export class StockInOrderLine extends VendureEntity {
    @ManyToOne(() => StockInOrder) order: StockInOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() quantity: number;
    @Column({ nullable: true }) unitPrice: number | null;  // Inbound cost
}
```

**State machine**: `Pending → Completed` (adjustStock increase); `Pending → Cancelled`

### 4.2 StockOutOrder (出库单)

```typescript
@Entity()
export class StockOutOrder extends VendureEntity implements ChannelAware {
    @Column() code: string;                    // CKT + timestamp
    @Column({ default: 'Pending' }) state: StockOutState;
    @Column({ nullable: true }) type: string;  // scrap / adjustment_out / damage
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;
    @ManyToOne(() => StockLocation) sourceLocation: StockLocation;
    @Column() sourceLocationId: ID;
    @OneToMany(() => StockOutOrderLine, line => line.order) lines: StockOutOrderLine[];
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;
    @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}

@Entity()
export class StockOutOrderLine extends VendureEntity {
    @ManyToOne(() => StockOutOrder) order: StockOutOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() quantity: number;
    @Column({ nullable: true }) unitPrice: number | null;
}
```

**State machine**: `Pending → Completed` (adjustStock decrease with sufficient stock check); `Pending → Cancelled`

### 4.3 StockMoveOrder (调拨单) — Core Business

```typescript
@Entity()
export class StockMoveOrder extends VendureEntity implements ChannelAware {
    @Column() code: string;                    // DBT + timestamp
    @Column({ default: 'Pending' }) state: StockMoveState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;
    @ManyToOne(() => StockLocation) sourceLocation: StockLocation;
    @Column() sourceLocationId: ID;
    @ManyToOne(() => StockLocation) targetLocation: StockLocation;
    @Column() targetLocationId: ID;
    @OneToMany(() => StockMoveOrderLine, line => line.order) lines: StockMoveOrderLine[];
    @Column({ type: 'timestamp', nullable: true }) shippedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) receivedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;
    @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}

@Entity()
export class StockMoveOrderLine extends VendureEntity {
    @ManyToOne(() => StockMoveOrder) order: StockMoveOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() quantity: number;
}
```

**State machine**:
```
Pending ──ship──► InTransit ──receive──► Received ──complete──► Completed
   │                  │
   │ cancel           │ cancel (rollback: source += qty)
   ▼                  ▼
Cancelled         Cancelled
```

- `Pending → InTransit`: source location `stockOnHand -= qty` (with sufficient stock check)
- `InTransit → Received`: target location `stockOnHand += qty`
- `Received → Completed`: state change only, no stock operation
- `Pending → Cancelled`: no stock operation (nothing shipped yet)
- `InTransit → Cancelled`: source location `stockOnHand += qty` (rollback)

### 4.4 StocktakeOrder (盘点单)

```typescript
@Entity()
export class StocktakeOrder extends VendureEntity implements ChannelAware {
    @Column() code: string;                    // PDT + timestamp
    @Column({ default: 'Pending' }) state: StocktakeState;
    @Column({ nullable: true }) note: string;
    @Column({ nullable: true }) staffId: string;
    @ManyToOne(() => StockLocation) location: StockLocation;
    @Column() locationId: ID;
    @OneToMany(() => StocktakeOrderLine, line => line.order) lines: StocktakeOrderLine[];
    @Column({ type: 'timestamp', nullable: true }) countingStartedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) reconcilingStartedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;
    @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}

@Entity()
export class StocktakeOrderLine extends VendureEntity {
    @ManyToOne(() => StocktakeOrder) order: StocktakeOrder;
    @Column() orderId: ID;
    @Column() productVariantId: ID;
    @Column() systemQuantity: number;          // Snapshot at Counting start
    @Column({ default: 0 }) countedQuantity: number;
    @Column({ default: 0 }) difference: number;       // countedQuantity - systemQuantity
    @Column({ default: false }) reconciled: boolean;  // Difference reviewed
}
```

**State machine**:
- `Pending → Counting`: snapshot `systemQuantity` from current StockLevel for each line
- `Counting → Reconciling`: counted quantities submitted, differences calculated
- `Reconciling → Completed`: for each `reconciled=true` line, apply `adjustStock(delta = counted - system)`
- `Pending/Counting → Cancelled`: no stock operation

### 4.5 State Enums and Transitions

```typescript
export enum StockInState { Pending = 'Pending', Completed = 'Completed', Cancelled = 'Cancelled' }
export enum StockOutState { Pending = 'Pending', Completed = 'Completed', Cancelled = 'Cancelled' }
export enum StockMoveState {
    Pending = 'Pending', InTransit = 'InTransit',
    Received = 'Received', Completed = 'Completed', Cancelled = 'Cancelled',
}
export enum StocktakeState {
    Pending = 'Pending', Counting = 'Counting',
    Reconciling = 'Reconciling', Completed = 'Completed', Cancelled = 'Cancelled',
}

export const STOCK_IN_TRANSITIONS: Record<StockInState, StockInState[]> = {
    Pending: ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
};
// STOCK_OUT_TRANSITIONS identical pattern
export const STOCK_MOVE_TRANSITIONS: Record<StockMoveState, StockMoveState[]> = {
    Pending: ['InTransit', 'Cancelled'],
    InTransit: ['Received', 'Cancelled'],
    Received: ['Completed'],
    Completed: [],
    Cancelled: [],
};
export const STOCKTAKE_TRANSITIONS: Record<StocktakeState, StocktakeState[]> = {
    Pending: ['Counting', 'Cancelled'],
    Counting: ['Reconciling', 'Cancelled'],
    Reconciling: ['Completed'],
    Completed: [],
    Cancelled: [],
};
```

---

## 5. GraphQL API Design

### 5.1 Queries

```graphql
stockLevels(
  locationId: ID
  productVariantId: ID
  page: Int
  pageSize: Int
): StockLevelList!

stockLocations(page: Int, pageSize: Int): [StockLocation!]!

stockMovements(
  productVariantId: ID
  locationId: ID
  type: StockMovementType
  page: Int
  pageSize: Int
): StockMovementList!

stockInOrders(state: String, page: Int, pageSize: Int): StockInOrderList!
stockInOrder(id: ID!): StockInOrder

stockOutOrders(state: String, page: Int, pageSize: Int): StockOutOrderList!
stockOutOrder(id: ID!): StockOutOrder

stockMoveOrders(state: String, page: Int, pageSize: Int): StockMoveOrderList!
stockMoveOrder(id: ID!): StockMoveOrder

stocktakeOrders(state: String, page: Int, pageSize: Int): StocktakeOrderList!
stocktakeOrder(id: ID!): StocktakeOrder
```

### 5.2 Mutations

```graphql
# Stock-in
createStockInOrder(input: CreateStockInOrderInput!): StockInOrder!
completeStockInOrder(id: ID!): StockInOrder!
cancelStockInOrder(id: ID!): StockInOrder!

# Stock-out
createStockOutOrder(input: CreateStockOutOrderInput!): StockOutOrder!
completeStockOutOrder(id: ID!): StockOutOrder!
cancelStockOutOrder(id: ID!): StockOutOrder!

# Stock move
createStockMoveOrder(input: CreateStockMoveOrderInput!): StockMoveOrder!
shipStockMoveOrder(id: ID!): StockMoveOrder!
receiveStockMoveOrder(id: ID!): StockMoveOrder!
completeStockMoveOrder(id: ID!): StockMoveOrder!
cancelStockMoveOrder(id: ID!): StockMoveOrder!

# Stocktake
createStocktakeOrder(input: CreateStocktakeOrderInput!): StocktakeOrder!
startCountingStocktake(id: ID!): StocktakeOrder!
submitStocktakeCount(id: ID!, counts: [StocktakeCountInput!]!): StocktakeOrder!
reconcileStocktakeLine(orderId: ID!, lineId: ID!): StocktakeOrder!  # Mark line as reconciled (no qty change)
completeStocktakeOrder(id: ID!): StocktakeOrder!
cancelStocktakeOrder(id: ID!): StocktakeOrder!
```

### 5.3 Input Types

```graphql
input CreateStockInOrderInput {
  type: String
  note: String
  targetLocationId: ID!
  lines: [StockInLineInput!]!
}
input StockInLineInput {
  productVariantId: ID!
  quantity: Int!
  unitPrice: Int
}

input CreateStockOutOrderInput {
  type: String
  note: String
  sourceLocationId: ID!
  lines: [StockOutLineInput!]!
}
input StockOutLineInput {
  productVariantId: ID!
  quantity: Int!
  unitPrice: Int
}

input CreateStockMoveOrderInput {
  note: String
  sourceLocationId: ID!
  targetLocationId: ID!
  lines: [StockMoveLineInput!]!
}
input StockMoveLineInput {
  productVariantId: ID!
  quantity: Int!
}

input CreateStocktakeOrderInput {
  note: String
  locationId: ID!
  productVariantIds: [ID!]!
}

input StocktakeCountInput {
  lineId: ID!
  countedQuantity: Int!
}
```

### 5.4 Custom SDL Types

```graphql
type StockLevelList {
    items: [StockLevel!]!
    totalItems: Int!
}
type StockMovementList {
    items: [StockMovementItem!]!
    totalItems: Int!
}
type StockInOrderList {
    items: [StockInOrder!]!
    totalItems: Int!
}
# StockOutOrderList / StockMoveOrderList / StocktakeOrderList: same pattern
```

**Note on entity SDL types**: `StockInOrder` / `StockOutOrder` / `StockMoveOrder` / `StocktakeOrder` and their Line types must be fully defined in the plugin's `gql` template (in `inventory.plugin.ts`). Each type exposes all entity fields (id/code/state/note/staffId/locationId/lines/timestamps) and `lines` is a `[XxxOrderLine!]!` list. Line types expose `id/productVariantId/quantity` plus type-specific fields (e.g., `unitPrice` for in/out, `systemQuantity`/`countedQuantity`/`difference`/`reconciled` for stocktake). Use schema-first mode (same as customer-service-plugin) — no `@ObjectType` decorators on entities.

`StockLevel` and `StockMovementItem` are Vendure native types, referenced directly without redefinition.

### 5.5 Error Handling

- Illegal state transition: throw `UserInputError` (same as sales-plugin pattern)
- Insufficient stock (stock-out / stock-move ship): throw `UserInputError` with current stock details
- Order not found: throw `EntityNotFoundError` (Vendure native)
- All mutations wrapped in `connection.withTransaction` for atomicity (order state + stock changes)

---

## 6. Service Layer Design

### 6.1 InventoryService Core Methods

```typescript
@Injectable()
export class InventoryService {
    constructor(
        private connection: TransactionalConnection,
        private stockMovementService: StockMovementService,
        private stockLevelService: StockLevelService,
        private stockLocationService: StockLocationService,
    ) {}

    // Stock queries
    async findStockLevels(ctx, options): Promise<{items, totalItems}>
    async findStockMovements(ctx, options): Promise<{items, totalItems}>

    // Stock-in
    async createStockInOrder(ctx, input): Promise<StockInOrder>
    async completeStockInOrder(ctx, id): Promise<StockInOrder>
    async cancelStockInOrder(ctx, id): Promise<StockInOrder>

    // Stock-out
    async createStockOutOrder(ctx, input): Promise<StockOutOrder>
    async completeStockOutOrder(ctx, id): Promise<StockOutOrder>
    async cancelStockOutOrder(ctx, id): Promise<StockOutOrder>

    // Stock move
    async createStockMoveOrder(ctx, input): Promise<StockMoveOrder>
    async shipStockMoveOrder(ctx, id): Promise<StockMoveOrder>
    async receiveStockMoveOrder(ctx, id): Promise<StockMoveOrder>
    async completeStockMoveOrder(ctx, id): Promise<StockMoveOrder>
    async cancelStockMoveOrder(ctx, id): Promise<StockMoveOrder>

    // Stocktake
    async createStocktakeOrder(ctx, input): Promise<StocktakeOrder>
    async startCountingStocktake(ctx, id): Promise<StocktakeOrder>
    async submitStocktakeCount(ctx, id, counts): Promise<StocktakeOrder>
    async reconcileStocktakeLine(ctx, orderId, lineId, countedQty): Promise<StocktakeOrder>
    async completeStocktakeOrder(ctx, id): Promise<StocktakeOrder>
    async cancelStocktakeOrder(ctx, id): Promise<StocktakeOrder>

    // Internal helpers
    private async adjustStockForLocation(ctx, variantId, locationId, delta, reason): Promise<void>
    private async assertSufficientStock(ctx, variantId, locationId, requiredQty): Promise<void>
    private async assertTransition(order, fromState, toState, transitions): Promise<void>
}
```

### 6.2 Stock Adjustment Helper (Core Wrapper)

```typescript
private async adjustStockForLocation(
    ctx: RequestContext,
    variantId: ID,
    locationId: ID,
    delta: number,        // positive = increase, negative = decrease
    reason: string,
): Promise<void> {
    // 1. Read current stockOnHand
    const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
    const newOnHand = current.stockOnHand + delta;

    // 2. Write via adjustProductVariantStock (produces StockAdjustment flow)
    await this.stockMovementService.adjustProductVariantStock(ctx, variantId, [
        { stockLocationId: locationId, stockOnHand: newOnHand },
    ]);

    // 3. Write businessReason to StockMovement customFields for audit
    // (requires extending StockMovement customFields — see Section 6.4)
}
```

### 6.3 Sufficient Stock Check

```typescript
private async assertSufficientStock(
    ctx: RequestContext,
    variantId: ID,
    locationId: ID,
    requiredQty: number,
): Promise<void> {
    const level = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
    const available = level.stockOnHand - level.stockAllocated;
    if (available < requiredQty) {
        throw new UserInputError(
            `Insufficient stock for variant ${variantId} at location ${locationId}: ` +
            `required ${requiredQty}, available ${available}`
        );
    }
}
```

### 6.4 StockMovement customFields Extension

Vendure native `StockAdjustment` has no `reason` field. Extend via plugin configuration:

```typescript
configuration: (config) => {
    config.customFields.StockMovement = [
        ...(config.customFields.StockMovement ?? []),
        { name: 'businessReason', type: 'string', nullable: true },
    ];
    return config;
}
```

After `adjustProductVariantStock`, update the returned StockAdjustment's `businessReason` customField directly (no need to re-query latest StockMovement):

```typescript
// In adjustStockForLocation:
const adjustments = await this.stockMovementService.adjustProductVariantStock(
    ctx, variantId, [{ stockLocationId: locationId, stockOnHand: newOnHand }],
);
// adjustments is StockAdjustment[] — directly update customFields
const adjustmentRepo = this.connection.getRepository(ctx, StockAdjustment);
for (const adj of adjustments) {
    adj.customFields = { ...(adj.customFields ?? {}), businessReason: reason };
    await adjustmentRepo.save(adj);
}
```

**Note**: `adjustProductVariantStock` returns `StockAdjustment[]` directly, so we can write `businessReason` without re-querying. This avoids the race condition mentioned in the original design.

**businessReason format**: `<OrderType>#<orderCode>:<operation>`
- `StockInOrder#RKT123:inbound`
- `StockOutOrder#CKT456:outbound`
- `StockMoveOrder#DBT789:source-out` / `:target-in` / `:rollback-source`
- `StocktakeOrder#PDT012:reconcile`

### 6.5 Transaction Boundary

All stock-affecting mutations wrapped in `connection.withTransaction`:

```typescript
async completeStockInOrder(ctx, id) {
    return this.connection.withTransaction(ctx, async txCtx => {
        const order = await this.findOne(txCtx, id, ['lines']);
        await this.assertTransition(order, StockInState.Pending, StockInState.Completed, STOCK_IN_TRANSITIONS);
        for (const line of order.lines) {
            await this.adjustStockForLocation(
                txCtx, line.productVariantId, order.targetLocationId,
                line.quantity, `StockInOrder#${order.code}:inbound`,
            );
        }
        order.state = StockInState.Completed;
        order.completedAt = new Date();
        return this.save(txCtx, order);
    });
}
```

### 6.6 Concurrency Strategy

**MVP**: Rely on `connection.withTransaction` (PostgreSQL READ COMMITTED). Same as sales/delivery modules — no pessimistic locking.

**Upgrade path**: If production encounters lost-update issues, switch `adjustStockForLocation` to use `SELECT ... FOR UPDATE`:

```typescript
const level = await repo.createQueryBuilder('level')
    .setLock('pessimistic_write')
    .where('level.productVariantId = :variantId', { variantId })
    .andWhere('level.stockLocationId = :locationId', { locationId })
    .getOne();
```

This is consistent with existing project patterns (sales/delivery also don't use pessimistic locks) and avoids over-engineering for MVP.

---

## 7. Frontend vadmin Integration

### 7.1 Package Structure

```
vadmin/src/pkg-inventory/
├── api/inventory.ts                   # GraphQL client (graphql-request + useAuthStore)
└── pages/
    ├── stock/index.vue                # Stock query (filter by warehouse/variant)
    ├── stock-move/
    │   ├── index.vue                  # Move order list + create entry
    │   └── detail.vue                 # Move order detail + state-driven actions
    ├── stock-in/
    │   ├── index.vue                  # Stock-in list + create
    │   └── detail.vue                 # Stock-in detail (complete/cancel)
    ├── stock-out/
    │   ├── index.vue                  # Stock-out list + create
    │   └── detail.vue                 # Stock-out detail (complete/cancel)
    └── stocktake/
        ├── index.vue                  # Stocktake list + create
        └── detail.vue                 # Stocktake detail (startCount/submit/reconcile/complete)
```

### 7.2 Route Registration

Add to `pages.json` (following pkg-cs pattern):

```json
{
    "root": "pkg-inventory/pages",
    "pages": [
        { "path": "stock/index", "style": { "navigationBarTitleText": "库存查询" } },
        { "path": "stock-move/index", "style": { "navigationBarTitleText": "调拨单" } },
        { "path": "stock-move/detail", "style": { "navigationBarTitleText": "调拨单详情" } },
        { "path": "stock-in/index", "style": { "navigationBarTitleText": "入库单" } },
        { "path": "stock-in/detail", "style": { "navigationBarTitleText": "入库单详情" } },
        { "path": "stock-out/index", "style": { "navigationBarTitleText": "出库单" } },
        { "path": "stock-out/detail", "style": { "navigationBarTitleText": "出库单详情" } },
        { "path": "stocktake/index", "style": { "navigationBarTitleText": "盘点单" } },
        { "path": "stocktake/detail", "style": { "navigationBarTitleText": "盘点单详情" } }
    ]
}
```

### 7.3 API Client

`api/inventory.ts` follows [pkg-cs/api/customer-service.ts](file:///e:/code/vadmin/src/pkg-cs/api/customer-service.ts) pattern using `graphql-request` + `useAuthStore`. Exposes `inventoryApi` object with methods for all queries and mutations.

### 7.4 Key Page Interactions

**Stock query page (stock/index.vue)**:
- Top filter: warehouse picker + variant name search
- List columns: variant name / warehouse / onHand / allocated / available (= onHand - allocated)

**Move order detail (stock-move/detail.vue)** — state-driven buttons:

| State | Buttons |
|---|---|
| Pending | `[发货]` `[取消]` |
| InTransit | `[确认收货]` `[取消（回滚）]` |
| Received | `[完成]` |
| Completed | (read-only) |
| Cancelled | (read-only + cancel reason) |

Cancelling at InTransit requires confirmation dialog: "取消将把已出库库存加回源仓，确认操作？"

**Stocktake detail (stocktake/detail.vue)**:
- `Counting` state: each line shows `systemQuantity` + editable `countedQuantity` input, `[提交盘点]` button
- `Reconciling` state: each line shows difference (counted - system), non-zero difference lines have `[审核]` button, `[完成盘点]` enabled when all reconciled
- `Completed` state: read-only, shows final adjustments

### 7.5 MODULE_CONFIGS Update

Modify [delivery-plugin/src/constants.ts](file:///e:/code/vendure/packages/delivery-plugin/src/constants.ts#L120) line 120: change `enabled: false` to `enabled: true`. No other changes needed.

### 7.6 shortcuts.ts Update

Update [vadmin/src/config/shortcuts.ts](file:///e:/code/vadmin/src/config/shortcuts.ts) lines 21-23:

```typescript
// Before
{ code: 'inv-stock', name: '库存', icon: '📊', perm: 'ViewStock', route: '/pkg-inventory/pages/placeholder', enabled: false },
{ code: 'inv-move', name: '调拨', icon: '🔄', perm: 'ManageStockMove', route: '/pkg-inventory/pages/placeholder', enabled: false },
{ code: 'inv-stocktake', name: '盘点', icon: '📋', perm: 'ManageStocktake', route: '/pkg-inventory/pages/placeholder', enabled: false },

// After
{ code: 'inv-stock', name: '库存', icon: '📊', perm: 'ViewStock', route: '/pkg-inventory/pages/stock/index', enabled: true },
{ code: 'inv-move', name: '调拨', icon: '🔄', perm: 'ManageStockMove', route: '/pkg-inventory/pages/stock-move/index', enabled: true },
{ code: 'inv-stocktake', name: '盘点', icon: '📋', perm: 'ManageStocktake', route: '/pkg-inventory/pages/stocktake/index', enabled: true },
```

### 7.7 Plugin imports

`inventory.plugin.ts` `@VendurePlugin` decorator must include `imports: [PluginCommonModule]` (same as customer-service-plugin). No cross-plugin imports needed (inventory-plugin does not depend on after-sales/delivery/sales plugins at runtime — only references their permission strings as constants).

---

## 8. Testing Strategy

### 8.1 Test Layers

Following the established customer-service module pattern:

**Layer 1: Backend e2e test** (primary acceptance)
- Script: `test-inventory-flow.js`
- Calls admin-api GraphQL, verifies complete business flows
- Uses superadmin + inventory-staff accounts, covers permission isolation

**Layer 2: Frontend integration** (manual)
- vadmin dev server: stock query → move order create → ship → receive → complete
- Verify state-driven buttons, confirmation dialogs, reconciliation UX

### 8.2 Backend e2e Test Cases

```
[1] Super admin login + inventory-staff role permission sync verification
    - Check inventory-staff role has 5 permissions

[2] Stock query
    - stockLevels returns data
    - stockLocations returns at least 1 (Default Stock Location)

[3] Stock-in order flow
    - createStockInOrder (Pending)
    - completeStockInOrder (Pending → Completed, verify stock increase)
    - second complete should fail (state machine check)

[4] Stock-out order flow
    - createStockOutOrder (Pending)
    - complete with insufficient stock should fail
    - complete with sufficient stock (Pending → Completed, verify stock decrease)
    - cancelStockOutOrder (Pending → Cancelled, no stock change)

[5] Stock move order flow (core)
    - createStockMoveOrder (Pending)
    - shipStockMoveOrder (Pending → InTransit, source decreases)
    - receiveStockMoveOrder (InTransit → Received, target increases)
    - completeStockMoveOrder (Received → Completed)
    - illegal transition check (Pending → Received should fail)

[6] Stock move rollback scenario
    - create → ship → cancel (InTransit → Cancelled)
    - Verify source stock restored

[7] Stocktake order flow
    - createStocktakeOrder (Pending, auto-snapshot systemQuantity)
    - startCountingStocktake (Pending → Counting)
    - submitStocktakeCount (Counting → Reconciling, enter countedQuantity)
    - reconcileStocktakeLine (review single line)
    - completeStocktakeOrder (Reconciling → Completed, differences applied)
    - Verify stock adjusted by difference

[8] Permission isolation
    - inventory-staff cannot call salesCreateOrder
    - inventory-staff cannot call delivery reportException
    - sales-staff cannot call createStockInOrder
```

### 8.3 Test Data Setup

Following `test-cs-flow-supplement.js` pattern:
- Connect to PostgreSQL (127.0.0.1:5432/vendure) via `pg` client
- Query existing ProductVariant and StockLocation as test data
- Backup current `stockOnHand` for affected StockLevel records
- After tests: restore `stockOnHand` to original values
- Created business orders can be kept (no side effects) or cleaned up

### 8.3.1 Test Account Setup

Create `reset-inventory-pwd.js` (reference `reset-cs-pwd.js` pattern):
- Query `inventory-staff` role ID via admin-api
- Create `inv1@zhao.test` administrator with `roleIds: [inventoryRoleId]` and password `a963963`
- If already exists, update password and role binding

### 8.3.2 Test Script Structure

```javascript
// test-inventory-flow.js
const fetch = require('node-fetch');
const { Client } = require('pg');

// 1. setupTestData: query variant + location, backup stockOnHand
// 2. login: superadmin + inventory-staff (inv1@zhao.test)
// 3. test cases [1]-[8]
// 4. cleanupTestData: restore stockOnHand
```

### 8.4 Acceptance Criteria

| Item | Standard |
|---|---|
| Backend e2e | All test cases pass (estimated 25+ assertions) |
| Permission isolation | inventory-staff cannot call other modules' mutations |
| State machine | Illegal transitions correctly throw errors |
| Stock consistency | After order completion, StockLevel.stockOnHand matches expected |
| Flow audit | StockMovement table has corresponding ADJUSTMENT records with businessReason containing order code |

---

## 9. Implementation Notes

### 9.1 Plugin Registration

In `dev-config.ts`, add `InventoryPlugin.init()` to `plugins` array (after `CustomerServicePlugin.init()`).

### 9.2 Build & Deployment

- Plugin uses TypeScript, compiles to `dist/` (same as customer-service-plugin)
- `npm run build` in plugin directory before dev server restart
- For production: `build-prod.bat` pre-compiles all plugins (existing pattern)

### 9.3 Migration Safety

- New entities use `synchronize: true` (dev mode) — auto-creates tables
- For production: run migrations (Vendure CLI) before deploying
- No breaking changes to existing tables (StockLevel/StockMovement untouched except customFields extension)

### 9.4 StockMovement customFields Migration

Extending `StockMovement.customFields` with `businessReason` field:
- Dev mode: `synchronize: true` auto-adds column `customFieldsBusinessreason`
- Production: migration required (Vendure auto-generates migration for customFields changes)
- Existing StockMovement records: `businessReason = null` (no impact)

### 9.5 Code Generation

After completing backend plugin:
1. Build plugin: `cd packages/inventory-plugin && npm run build`
2. Restart dev server to load plugin
3. Verify GraphQL schema via admin-api introspection
4. Generate frontend API client types (if using codegen) or hand-write as in pkg-cs

---

## 10. Open Questions & Risks

### 10.1 Resolved

- **Plugin location**: Independent inventory-plugin (not extending delivery-plugin) — decided
- **Permission registration**: Reference delivery-plugin's already-registered permissions — decided
- **StockMovement audit**: Extend customFields.businessReason — decided
- **Concurrency**: MVP uses transaction-only, upgrade to pessimistic lock if needed — decided
- **StockMove rollback**: InTransit → Cancelled restores source stock — decided

### 10.2 Risks

- **adjustProductVariantStock API stability**: This is an internal Vendure service method. If Vendure upgrades change its signature, inventory-plugin needs adjustment. Mitigation: pin Vendure version, write integration tests.
- **StockMovement customFields query**: Querying the latest StockMovement after `adjustProductVariantStock` to write `businessReason` has a small race window. Mitigation: do it inside the same transaction (txCtx).
- **Multi-channel stock location strategy**: Default `MultiChannelStockLocationStrategy` filters stock by channel. If inventory-staff queries stock across channels, results may be incomplete. Mitigation: use superadmin context for cross-channel queries, or document this as expected behavior.
