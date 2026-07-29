# Sales 模块设计文档

- 日期：2026-07-28
- 模块：`pkg-sales`（前端）+ `@vendure/sales-plugin`（后端）
- 状态：设计完成，待实施

## 1. 背景与目标

vadmin 第一期已交付 delivery 模块（送货员管理）。第二期推进 sales 模块，覆盖门店导购、电销代客下单、B2B 地推三种销售场景。

### 核心目标

1. 销售员通过移动端快速代客下单
2. 订单归属到销售员本人，支持"我的销售单"查询
3. 客户档案管理（个人/企业）
4. 多维度业绩报表
5. 支持手动改价（含审计）
6. 与 delivery 模块解耦协同

### 非目标

- 不实现 B2B 合同价自动应用（Phase 2）
- 不实现会员价/促销组合（依赖 coupon-plugin 等已有插件）
- 不实现 B2B 账期模式（订单默认"待付款"）

## 2. 整体架构

### 后端：`@vendure/sales-plugin`

独立插件，与 `delivery-plugin` 平级，复用相同模式（PermissionDefinition + RoleSync + customFields + adminApiExtensions）。

```
vendure/packages/sales-plugin/src/
├── constants.ts                       # SalesPermissions, ROLE_PERMISSIONS_MAP, SalesChannel 枚举
├── config/
│   ├── order-custom-fields.ts         # salesStaffId, salesChannel, salesNote
│   ├── customer-custom-fields.ts      # customerType, companyInfo, salesStaffId, customerTags
│   └── order-line-custom-fields.ts    # overwrittenPrice, originalPrice, modifiedBy, modifiedAt
├── sales.plugin.ts                    # @VendurePlugin 入口
├── sales.service.ts                   # 核心：createOrder/findMySales/findSalesReport
├── sales-admin.resolver.ts            # GraphQL resolvers
├── price-calculation.ts               # OrderItemPriceCalculationStrategy 实现改价
├── role-sync.ts                       # sales-staff 角色同步（与 delivery 同模式）
└── index.ts
```

### 前端：`vadmin/src/pkg-sales/`

```
pages/
├── create/index.vue        # 开单页（核心交互）
├── list/index.vue          # 我的销售单
├── detail/index.vue        # 销售单详情
├── customer/
│   ├── list/index.vue      # 客户档案列表
│   └── detail/index.vue    # 客户详情（含历史订单）
└── report/index.vue        # 业绩报表
```

### 数据流

```
销售员在 vadmin 开单
  ↓ salesCreateOrder mutation（admin-api）
SalesService.createOrder()
  ↓ withTransaction
  ├─ 1. 建客户（如 newCustomer 提供）→ CustomerService.create
  │     - 注：CustomerService.create 强制 emailAddress，门店导购场景用手机号生成占位邮箱（见第 7 节）
  ├─ 2. 创建 Order → OrderService.create(ctx, customer.user.id)
  ├─ 3. 加商品行（含 overwrittenPrice）→ OrderService.addItemsToOrder(orderId, items[])
  │     - items[].customFields = { overwrittenPrice, originalPrice, modifiedBy, modifiedAt }
  │     - OrderItemPriceCalculationStrategy 在 addItemToOrder 内部触发，读取 customFields.overwrittenPrice
  ├─ 4. 设地址 → OrderService.setShippingAddress(orderId, input)
  ├─ 5. 设配送方式 → OrderService.setShippingMethod(ctx, orderId, [shippingMethodId])
  └─ 6. 写 Order customFields → OrderService.updateCustomFields(ctx, orderId, { salesStaffId, salesChannel, salesNote })
  ↓
返回 Order（状态：AddingItems）
  ↓ 客户付款（vshop 或线下收款链接）
PaymentSettled
  ↓ delivery-plugin 监听 OrderStateTransitionEvent
自动派单给送货员（若选配送方式 = 配送）
```

### MODULE_CONFIGS 重构（解决跨插件耦合）

**现状问题**：`delivery-plugin/constants.ts` 的 `MODULE_CONFIGS` 包含了所有模块（sales/inventory/cs/ops/admin）的配置。sales-plugin 启用时若修改 delivery-plugin 文件，违反插件独立性。

**重构方案**：
- 每个 plugin 只定义自己的模块配置常量（如 `SALES_MODULE_CONFIGS`）
- `delivery-plugin` 的 `PermissionAdminResolver` 改为聚合模式：通过 `@vendure/core` 的 `PluginCommonModule` 注入所有插件提供的模块配置
- 简化方案（推荐 MVP）：保留 `MODULE_CONFIGS` 在 delivery-plugin，sales-plugin 启用时通过 PR 修改 sales 的 `enabled: true`。MVP 阶段不引入插件间通信机制，避免过度设计
- Phase 2 再考虑用 `PluginLifecycle` 或全局 `ModuleConfigService` 解耦

**MVP 决策**：采用简化方案。在 `delivery-plugin/constants.ts` 中将 sales 的 `enabled` 改为 `true`，作为 sales 模块启用的开关。这种集中式配置在模块数量 < 10 时可接受。

## 3. 数据模型

### Order customFields

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `salesStaffId` | string (nullable) | null | 销售员 User ID（与 deliveryStaffId 同机制） |
| `salesChannel` | string (nullable) | null | `store` / `telesales` / `b2b` |
| `salesNote` | string (nullable) | null | 销售备注 |

仅 sales-plugin 创建的订单才有值，不影响 vshop 客户自主下单。

### Customer customFields

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `customerType` | string | `individual` | `individual` / `enterprise` |
| `companyInfo` | json (nullable) | null | `{name, taxId, contactName, contactPhone, billingAddress}` |
| `salesStaffId` | string (nullable) | null | 首次开单销售员（客户归属） |
| `customerTags` | string[] | [] | `['vip','wholesale','store-regular']` |

`customer.salesStaffId` 与 `order.salesStaffId` 解耦：客户换销售员后历史订单仍归属原销售。

### OrderLine customFields

| 字段 | 类型 | 说明 |
|------|------|------|
| `overwrittenPrice` | int (nullable) | 改价后单价（含税，分） |
| `originalPrice` | int (nullable) | 改价时记录的原价（审计） |
| `modifiedBy` | string (nullable) | 改价操作人 User ID |
| `modifiedAt` | datetime (nullable) | 改价时间 |

`overwrittenPrice` 为 `null` 时用默认价；非 `null` 时由价格计算策略使用。

### 价格计算策略

```typescript
@Injectable()
export class SalesOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
  calculateUnitPrice(
    ctx: RequestContext,
    productVariant: ProductVariant,
    orderLineCustomFields: { [key: string]: any },
    order: Order,
    quantity: number,
  ): PriceCalculationResult {
    const overwritten = orderLineCustomFields?.overwrittenPrice;
    if (overwritten != null && overwritten > 0) {
      return { price: overwritten, priceIncludesTax: true };
    }
    // 默认使用 ProductVariant.listPrice（Vendure 标准字段）
    return {
      price: productVariant.listPrice,
      priceIncludesTax: productVariant.listPriceIncludesTax,
    };
  }
}
```

注册到 `config.orderOptions.orderItemPriceCalculationStrategy`，全局生效但仅当 `overwrittenPrice` 非空时介入，不影响 vshop 客户下单。

**写入时机验证**：`OrderService.addItemToOrder(orderId, variantId, quantity, customFields)` 会将 `customFields` 透传给 `orderModifier.getOrCreateOrderLine`，策略在 `updateOrderLineQuantity` 内部调用时能读到已持久化的 `overwrittenPrice`。

## 4. 权限模型

| 权限 | 描述 | 拥有角色 |
|------|------|---------|
| `CreateOrder` | 销售开单 | sales-staff, manager, super-admin |
| `ViewOwnSales` | 查看自己的销售单 | sales-staff, manager, super-admin |
| `ViewAllSales` | 查看全部销售单 | manager, super-admin |
| `ManageCustomer` | 客户档案管理 | sales-staff, customer-service, manager, super-admin |
| `ViewSalesReport` | 业绩报表（销售员仅自己，manager+ 全部） | sales-staff, manager, super-admin |
| `ModifyOrderPrice` | 手动改价 | sales-staff, manager, super-admin |

`ROLE_PERMISSIONS_MAP` 中所有角色补充 `Authenticated` 基础权限（沿用 delivery 模块经验）。

## 5. GraphQL API

### Mutations

```graphql
# 销售开单（核心）
mutation salesCreateOrder($input: SalesCreateOrderInput!) {
  salesCreateOrder(input: $input) {
    ... on Order { id code state totalWithTax customFields { salesStaffId salesChannel } }
    ... on SalesError { errorCode message }
  }
}

input SalesCreateOrderInput {
  customerId: ID                         # 已有客户 ID（与 newCustomer 二选一）
  newCustomer: NewCustomerInput          # 新建客户
  lines: [SalesOrderLineInput!]!
  shippingAddress: CreateAddressInput!
  shippingMethodId: ID!
  salesChannel: SalesChannel!            # store|telesales|b2b
  note: String
}

input SalesOrderLineInput {
  productVariantId: ID!
  quantity: Int!
  overwrittenPrice: Int                  # 手动改价（含税，分），null=默认价
}

input NewCustomerInput {
  firstName: String!
  lastName: String!
  emailAddress: String                   # 可选；未提供时用 phoneNumber 生成占位邮箱（见下文）
  phoneNumber: String!
  customerType: CustomerType!            # individual|enterprise
  companyInfo: CompanyInfoInput          # customerType=enterprise 时必填
}

input CompanyInfoInput {
  name: String!
  taxId: String
  contactName: String
  contactPhone: String
  billingAddress: String
}

# 客户档案管理
mutation createCustomerProfile($input: SalesCustomerInput!) { ... }
mutation updateCustomerProfile($id: ID!, $input: UpdateSalesCustomerInput!) { ... }

# 改价（独立 mutation，便于审计）
mutation modifyOrderLinePrice($orderLineId: ID!, $newPrice: Int!) {
  modifyOrderLinePrice(orderLineId: $orderLineId, newPrice: $newPrice) {
    id customFields { overwrittenPrice originalPrice modifiedBy modifiedAt }
  }
}

# 取消订单（仅 AddingItems 状态可取消）
mutation cancelSalesOrder($orderId: ID!, $reason: String) {
  cancelSalesOrder(orderId: $orderId, reason: $reason) {
    ... on Order { id state }
    ... on SalesError { errorCode message }
  }
}

# 枚举定义（需在 schema 中声明）
enum SalesChannel {
  store
  telesales
  b2b
}

enum CustomerType {
  individual
  enterprise
}

type SalesError {
  errorCode: String!
  message: String!
}
```

### emailAddress 占位策略

`CustomerService.create` 强制 emailAddress 非空。门店导购场景客户可能只有手机号，处理策略：

```typescript
// SalesService.createOrder 内部
const emailAddress = input.newCustomer.emailAddress || `${input.newCustomer.phoneNumber}@placeholder.local`;
```

- 占位邮箱使用 `@placeholder.local` 后缀，避免与真实邮箱冲突
- 客户后续注册真实账号时，通过 `CustomerService.update` 更新 emailAddress
- 报表查询时过滤 `@placeholder.local` 邮箱，避免污染客户统计

### Queries

```graphql
# 我的销售单
query mySales($options: OrderListOptions) {
  mySales(options: $options) {
    items { id code state totalWithTax createdAt customFields { salesChannel salesNote } customer { id emailAddress } }
    totalItems
  }
}

# 全部销售单（manager+）
query allSales($options: OrderListOptions) { ... }

# 销售单详情
query salesOrder($id: ID!) {
  salesOrder(id: $id) {
    id code state totalWithTax
    lines { id quantity unitPriceWithTax customFields { overwrittenPrice originalPrice modifiedBy } }
    customer { id emailAddress customFields { customerType companyInfo } }
    shippingAddress { fullName streetLine1 city phoneNumber }
    customFields { salesStaffId salesChannel salesNote }
  }
}

# 客户档案
query myCustomers($options: CustomerListOptions) { ... }      # 销售员查归属自己的客户
query allCustomers($options: CustomerListOptions) { ... }      # manager+ 查全部
query customerDetail($id: ID!) {
  customerDetail(id: $id) {
    id emailAddress customFields { customerType companyInfo salesStaffId customerTags }
    orders { id code state totalWithTax createdAt }
  }
}

# 业绩报表
query mySalesReport($range: DateRangeInput!) {
  mySalesReport(range: $range) {
    totalOrders
    totalRevenue
    uniqueCustomers
    avgOrderValue
    topProducts { productVariantId name quantitySold revenue }
    dailyBreakdown { date orderCount revenue }
  }
}

query salesReport($staffId: ID, $range: DateRangeInput!) {
  salesReport(staffId: $staffId, range: $range) { ... }   # manager+ 可指定 staffId
}

input DateRangeInput { start: DateTime! end: DateTime! }
```

**时区处理**：`DateRangeInput` 使用 ISO 8601 字符串（含时区偏移），后端 `SalesService.buildReport` 用 `ctx.channel.defaultTaxZone` 无关，直接按 UTC 查询数据库 `createdAt` 字段。前端传参时使用本地时区的开始/结束时刻（如 `2026-07-28T00:00:00+08:00` 至 `2026-07-28T23:59:59+08:00`）。

### 业绩报表权限分级

`mySalesReport` 和 `salesReport` 都用 `ViewSalesReport` 权限，但行为按角色区分：

```typescript
@Query(() => SalesReport)
@Allow(SalesPermissions.ViewSalesReport)
async salesReport(@Ctx() ctx, @Args() args: { staffId?: ID; range: DateRangeInput }) {
  const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId, ['user', 'user.roles']);
  const roles = admin?.user?.roles?.map(r => r.code) ?? [];
  const isManager = roles.includes('manager') || roles.includes('super-admin') || roles.includes('__super_admin_role__');

  // 销售员只能查自己；manager+ 可指定 staffId，未指定时查全部
  const targetStaffId = isManager ? args.staffId : String(ctx.activeUserId);
  if (!isManager && args.staffId && args.staffId !== String(ctx.activeUserId)) {
    throw new ForbiddenError('ORDER_NOT_OWNED');
  }
  return this.salesService.buildReport(ctx, targetStaffId, args.range);
}
```

`mySalesReport` 简化版：直接用 `ctx.activeUserId`，权限装饰器 `ViewOwnSales`。

### Resolver 装饰器

```typescript
@Resolver()
export class SalesAdminResolver {
  @Query(() => OrderList)
  @Allow(SalesPermissions.ViewOwnSales)
  async mySales(@Ctx() ctx: RequestContext, @Args() args: any) {
    return this.salesService.findMySales(ctx, args.options);
  }

  @Query(() => OrderList)
  @Allow(SalesPermissions.ViewAllSales)
  async allSales(@Ctx() ctx, @Args() args) { ... }

  @Mutation(() => SalesCreateOrderResult)
  @Allow(SalesPermissions.CreateOrder)
  async salesCreateOrder(@Ctx() ctx, @Args() args) {
    return this.salesService.createOrder(ctx, args.input);
  }

  @Mutation(() => Order)
  @Allow(SalesPermissions.ModifyOrderPrice)
  async modifyOrderLinePrice(@Ctx() ctx, @Args() args) {
    return this.salesService.modifyOrderLinePrice(ctx, args.orderLineId, args.newPrice);
  }
}
```

## 6. 配送协同

- 销售员开单时选 ShippingMethod：`门店自提`（不走 delivery）或 `门店配送`（走 delivery）
- 选配送 → 客户付款 PaymentSettled → delivery-plugin 自动派单，sales-plugin 不介入
- 选自提 → 订单状态流转到 `Shipped`（自提已完成），不触发 delivery 事件订阅
- sales-plugin 不直接依赖 delivery-plugin，仅通过订单状态流协同

## 7. 前端页面

### 7.1 开单页 `pkg-sales/pages/create/index.vue`（核心）

布局：顶部客户区 + 中部商品行 + 底部结算栏

```
┌─────────────────────────────┐
│ [客户] 张三 138****0001 ▼    │  ← 选已有客户 or 新建
├─────────────────────────────┤
│ 商品行 1                     │
│ 农夫山泉 550ml  ×2  ¥4.00    │
│ [改价] ¥4.50                 │  ← 点击改价，输入新价
│                              │
│ 商品行 2                     │
│ 康师傅泡面  ×1  ¥3.50        │
├─────────────────────────────┤
│ [+] 添加商品（扫码/搜索）     │
├─────────────────────────────┤
│ 收货地址：北京海淀区... ▼     │
│ 配送方式：门店配送 ▼          │
│ 销售备注：[输入]              │
├─────────────────────────────┤
│ 合计: ¥11.50                 │
│         [提交订单]            │
└─────────────────────────────┘
```

交互流程：
1. 选客户 → 自动带出地址、历史订单
2. 扫码/搜索加商品 → 默认价 + 库存提示
3. 点击改价 → 弹窗输入新价 + 改价原因（写入 modifiedBy）
4. 选配送方式 → 影响合计金额
5. 提交 → 调用 `salesCreateOrder` → 跳转详情页

### 7.2 我的销售单列表 `pkg-sales/pages/list/index.vue`

- 顶部筛选：状态（全部/待付款/已付款/已发货/已完成）+ 时间范围
- 列表项：订单号、客户、金额、状态、时间
- 下拉刷新 + 上拉加载
- 权限：`ViewOwnSales`

### 7.3 销售单详情 `pkg-sales/pages/detail/index.vue`

- 订单基本信息 + 商品行（标注改价行）+ 客户信息 + 配送追踪
- 操作按钮：[改价] [取消订单] [复制开单]
- 若订单已派送，显示 delivery 状态

### 7.4 客户档案 `pkg-sales/pages/customer/`

- **list**: 我的客户（按 salesStaffId 归属）+ 搜索（姓名/手机号）
- **detail**: 客户基本信息 + 标签 + 历史订单 + 累计消费

### 7.5 业绩报表 `pkg-sales/pages/report/index.vue`

- 时间范围切换（今日/本周/本月/自定义）
- KPI 卡片：订单数、销售额、客单价、新增客户数
- 销售额趋势图（折线，按日聚合）
- TOP 商品排行（横向柱状图）
- 权限：销售员看自己，manager+ 可切换查看全员

### 7.6 shortcuts.ts 更新

```typescript
// 销售模块（第二期实现）
{ code: 'sales-create', name: '开单', icon: '📝', perm: 'CreateOrder', route: '/pkg-sales/pages/create/index', enabled: true },
{ code: 'sales-list', name: '订单', icon: '📋', perm: 'ViewOwnSales', route: '/pkg-sales/pages/list/index', enabled: true },
{ code: 'sales-customer', name: '客户', icon: '👤', perm: 'ManageCustomer', route: '/pkg-sales/pages/customer/list/index', enabled: true },
{ code: 'sales-report', name: '业绩', icon: '📈', perm: 'ViewSalesReport', route: '/pkg-sales/pages/report/index', enabled: true },
```

## 8. 错误处理与边界

### 错误码

```typescript
export const SalesErrorCode = {
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_CUSTOMER: 'INVALID_CUSTOMER',
  INVALID_SHIPPING_METHOD: 'INVALID_SHIPPING_METHOD',
  PRICE_BELOW_COST: 'PRICE_BELOW_COST',
  PRICE_MODIFICATION_FORBIDDEN: 'PRICE_MODIFICATION_FORBIDDEN',
  ORDER_NOT_OWNED: 'ORDER_NOT_OWNED',
  ORDER_NOT_CANCELLABLE: 'ORDER_NOT_CANCELLABLE',   // 非 AddingItems 状态不可取消
  EMAIL_ADDRESS_CONFLICT: 'EMAIL_ADDRESS_CONFLICT', // 创建客户时邮箱冲突
};
```

### 边界场景

1. **库存校验**：开单时调用 `ProductVariantService.getStockLevel`，库存不足返回 `INSUFFICIENT_STOCK`，但仍允许提交（走 backorder）
2. **客户归属**：销售员只能查看 `customer.customFields.salesStaffId === ctx.activeUserId` 的客户；manager+ 可查全部
3. **改价权限**：每次改价记录 `modifiedBy`，manager 可查看改价历史
4. **重复提交**：前端按钮 loading + 后端基于订单 code 生成（时间戳+随机）天然防重
5. **取消订单**：仅 AddingItems 状态可取消，已付款订单走售后流程（cs 模块）

### 与其他模块边界

| 模块 | 关系 |
|------|------|
| delivery | sales 不直接调用 delivery，通过订单状态流协同 |
| cs 客服 | cs 模块的 `ViewAllOrders` 可查看 sales 创建的订单 |
| inventory | sales 不直接查库存，开单时通过 `ProductVariantService` 间接查询 |
| admin | manager/super-admin 通过 `allSales` 查全部销售单 |

## 9. 测试策略

### 后端单元测试

- `SalesService.createOrder`：覆盖新建客户/已有客户/库存不足/改价/无效配送方式
- `SalesService.findMySales`：覆盖按 salesStaffId 过滤、分页、状态筛选
- `OrderItemPriceCalculationStrategy`：覆盖默认价/改价/null 三种情况
- `RoleSyncService`：覆盖角色权限同步

### 后端 e2e 测试

参考 `test-delivery-flow.js`，新建 `test-sales-flow.js`：
1. 创建 sales-staff 账号
2. 验证 `myPermissions` 含销售权限
3. 调用 `salesCreateOrder` 创建订单（含改价）
4. 验证 `mySales` 包含此订单
5. 验证改价生效（`unitPriceWithTax === overwrittenPrice`）
6. 验证 manager 调 `allSales` 可见
7. 验证未登录访问被拒绝

### 前端验证

- 开单页端到端：选客户 → 加商品 → 改价 → 提交 → 跳转详情
- 列表页：分页/筛选/下拉刷新
- 业绩报表：数据正确性（与后端 mySalesReport 对账）

## 10. 实施分阶段

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| Phase 1 | 后端 sales-plugin 骨架：constants/customFields/role-sync/price-calculation/sales.plugin.ts；SalesService.createOrder + mySales + salesOrder；dev-config 注册插件；delivery-plugin MODULE_CONFIGS 中 sales.enabled=true | 高 |
| Phase 2 | 前端开单页（create）+ 列表页（list）+ 详情页（detail）+ shortcuts 启用 sales 项 | 高 |
| Phase 3 | 客户档案管理（customer/list + customer/detail + create/update mutation） | 中 |
| Phase 4 | 业绩报表（report 页面 + mySalesReport/salesReport query + 权限分级） | 中 |
| Phase 5 | 取消订单 mutation + 改价 mutation + e2e 测试脚本 + 验收 | 高 |

**Phase 间依赖**：Phase 1 是所有后续 Phase 的基础；Phase 2-4 可并行；Phase 5 依赖 Phase 1-4 完成。

## 11. 复盘要点（预登记）

- **风险 1**：手动改价通过 `OrderItemPriceCalculationStrategy` 全局生效，需确保不影响 vshop 客户下单（`overwrittenPrice` 默认 null）
- **风险 2**：sales-plugin 与 delivery-plugin 都监听订单状态，需确保事件订阅不冲突（sales 不订阅状态事件，仅 delivery 订阅 PaymentSettled）
- **风险 3**：插件 `@VendurePlugin` 装饰器必须包含 `compatibility: '^3.6.0'` 元数据，否则 Vendure 不会加载该插件（delivery-plugin 已踩坑）
- **改进点**：`RoleSyncService` 应在 `syncRoles()` 中自动为所有角色补齐 `Authenticated` 权限（沿用 delivery 经验）

## 12. 测试账号规划

| 角色 | emailAddress | password | 用途 |
|------|-------------|----------|------|
| super-admin | superadmin@china.test | superadmin | 管理员 |
| sales-staff | sales1@zhao.test | a963963 | 销售员 |
| customer | zhangsan@test.cn | test | 下单客户（已存在） |
