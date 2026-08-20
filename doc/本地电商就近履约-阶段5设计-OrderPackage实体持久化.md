# 本地电商就近履约 · 阶段5设计：OrderPackage 实体持久化（追溯底座）

> 承接：阶段3（拆单履约工作流）与阶段4（售后多仓按包回补）的边界项之一。
> 目标：把当前仅存在于内存的「拆单包」（SplitPackage）持久化为 `OrderPackage` 实体，
> 提供订单级包裹查询与按包追溯，为后续「真实配送平台对接」提供数据底座。

## 1. 背景与要解决的问题

当前「包裹」概念**只存在于内存**，未落库：

- `SplitPackage` 契约（`packages/logistics-plugin/src/order-split-plan.ts`）由
  `AutoSplitPlanService.buildAutoPlan`（自动拆单）与 `ManualSplitAdjustService.applyAdjustment`（管理员调单确认）推导，
  接口注释已明确「现阶段内存推导，未来可替换为 OrderPackage 实体持久化实现」。
- 拆分明细散落在各实体 JSON 字段中，无法统一查询与追溯：
  - `OrderLine.customFields.stockLocationsJson` = `[{ locationId, quantity }]`（每行拆分明细）
  - `Order.customFields.packageShippingJson`（每包运费明细）
  - `DeliveryOrder.packageId`（配送单上的包号，`delivery-gateway-plugin`）
  - `Fulfillment.customFields.packageId` / `shippingFee`（发货记录上的包号与本包运费）
- 缺少：
  - 订单级包裹查询（该订单拆成几个包、每包发哪个仓、含哪些行/多少件）
  - 按包追溯（一个包关联的配送单、发货记录、实际运费）
  - 真实配送平台对接所需的「拆单后、发货前」的包裹数据（需在配送单创建前拿到包级数据）

## 2. 方案对比与选型

| 方案 | 说明 | 权衡 |
|---|---|---|
| **A. 追溯底座（推荐）** | 拆单确认时把 SplitPackage 落库为 OrderPackage 实体，提供订单级包裹查询与按包追溯 | 最小侵入，不改现有拆单/计费/发货逻辑；为真实配送对接打地基 |
| B. 完整生命周期 | OrderPackage 携带状态机（pending→shipped→delivered）并回写配送/履约状态，成为包裹 source of truth | 改动面大，本期无状态机消费方（YAGNI） |
| C. 仅配送侧补充 | 只在 createDelivery 时顺带落一条包裹记录 | 未发货/未配送的包裹缺失，追溯价值低 |

**选型：方案 A（追溯底座）**。本期只做「把拆单包持久化 + 订单级查询 + 与履约/配送关联」，不做状态机、不做回填历史数据。

## 3. 设计详述

### 3.1 新实体 `OrderPackage`

位置：`packages/logistics-plugin/src/order-package.entity.ts`，表名 `order_package`。

```
@Entity()
class OrderPackage extends VendureEntity {
    code: string                     // 包号，沿用现有命名 P1/P2
    orderId: ID                      // @EntityId() 所属订单
    stockLocationId: ID              // @EntityId() 出货仓（一个包 = 一个出货仓的履约单元）
    linesJson: text, nullable        // [{ orderLineId, quantity }]（结构复用 SplitLine）
    shippingFee: int, nullable       // 本包运费（分）：确认时=估算值，发货后回填实际值
    deliveryMode: string             // 'self' | 'city'（自有司机 / 同城配送）
    fulfillmentId: ID, nullable      // @EntityId({nullable}) 关联发货记录
    deliveryOrderId: ID, nullable    // @EntityId({nullable}) 关联配送单（DeliveryOrder）
    createdAt / updatedAt            // 继承 VendureEntity
}
```

设计要点：
- 一个包 = 一个出货仓的履约单元（与 `SplitPackage` 语义一致）。
- `linesJson` 沿用 `SplitLine` 结构，不建 `OrderPackageLine` 子实体（YAGNI，本期无需按包内行粒度做关系查询）。
- `deliveryMode` 与 `SplitPackage.deliveryMode` 对齐（当前 `applyAdjustment` 与自动计划产出的包均固定 `'self'`，`'city'` 为同城配送扩展预留）。

### 3.2 服务 `OrderPackageService`

位置：`packages/logistics-plugin/src/order-package.service.ts`，注册进 logistics-plugin providers。

```typescript
export class OrderPackageService {
    constructor(private connection: TransactionalConnection) {}

    /** 拆单确认：先删后插（幂等，重复确认干净替换），返回落库后的包裹列表 */
    async replaceForOrder(
        ctx: RequestContext,
        orderId: ID,
        packages: Array<{ packageId: string; stockLocationId: ID; lines: SplitLine[];
                          estimatedShippingFee: number; deliveryMode: string }>,
    ): Promise<OrderPackage[]>;

    /** 发货回填：按 orderId + code 匹配包裹，补 fulfillmentId 与实际运费，返回是否命中 */
    async linkFulfillment(
        ctx: RequestContext,
        orderId: ID,
        packageId: string,
        fulfillmentId: ID,
        actualShippingFee: number | null,
    ): Promise<boolean>;

    /** 配送关联：按 orderId + code 匹配包裹，回填 deliveryOrderId */
    async linkDeliveryOrder(
        ctx: RequestContext,
        orderId: ID,
        packageId: string,
        deliveryOrderId: ID,
    ): Promise<boolean>;

    /** 订单级包裹查询（按包号排序） */
    findByOrder(ctx: RequestContext, orderId: ID): Promise<OrderPackage[]>;
}
```

幂等约定：
- `replaceForOrder`：删除该订单全部 OrderPackage 后按新计划插入 —— 管理员多次调单确认不会产生残留或翻倍。
- `linkFulfillment` / `linkDeliveryOrder`：按 `orderId + code` 唯一匹配；未命中仅告警不报错（发货/配送不依赖包裹记录存在，保持现状主链路不回退）。

### 3.3 挂钩点（两处，最小侵入）

**挂钩点 1 —— 拆单确认落库**：`split-admin.resolver.ts` 的 `confirmSplitPlan`
（`d:\zhao\vendure\packages\logistics-plugin\src\split-admin.resolver.ts`）

```
confirmSplitPlan 成功后 → orderPackageService.replaceForOrder(ctx, orderId, plan.packages)
```

- `applyAdjustment` 已返回最终 `OrderSplitPlan`（含 `packageId`/`stockLocationId`/`lines`/`deliveryMode`），
  此处直接持久化，捕获「planned」包裹。
- 仅当确认成功（数量守恒 + 每仓可售校验通过）才落库；校验失败抛错则不上库。

**挂钩点 2 —— 发货回填**：`logistics.service.ts` 的 `batchCreateFulfillment`
（`d:\zhao\vendure\packages\logistics-plugin\src\logistics.service.ts` 约 L154-L161）

```
updateFulfillmentCustomFields 之后 → orderPackageService.linkFulfillment(
    ctx, item.orderId, item.packageId, fulfillment.id, item.shippingFee ?? null)
```

- 复用已有入参 `packageId`/`shippingFee`，仅补一条关联更新，不改发货主链路。
- 说明：当前 `batchCreateFulfillment` 为整单发货（lines 覆盖订单全部行），发货一次对应传入的一个 `packageId`；
  回填按 `orderId + code` 精确匹配，未发货的其他包保持估算值不被误回填。「每包独立 fulfillment（按包行过滤发货）」属后续边界项。

**挂钩点 3（可选，同城配送关联）**：`delivery-gateway.service.ts` 的 `createDelivery`
在 `DeliveryOrder` 创建后，按 `orderId + packageId` 回填 `deliveryOrderId`。
（阶段3的 `DeliveryOrder.packageId` 已存在，关联回填是顺手补齐，纳入本期。）

### 3.4 Admin GraphQL API

在 logistics-plugin `adminSchema`（`plugin.ts`）新增：

```graphql
type OrderPackage implements Node {
    id: ID!
    code: String!
    orderId: ID!
    stockLocationId: ID!
    lines: [SplitLine!]!
    shippingFee: Int
    deliveryMode: String!
    fulfillmentId: ID
    deliveryOrderId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
}

extend type Query {
    orderPackages(orderId: ID!): [OrderPackage!]!
}
```

- `lines` 由 `linesJson` 解析后返回（结构复用现有 `SplitLine` 类型）。
- 权限沿用 `@Allow(Permission.ReadOrder)`。

### 3.5 数据流

```
1. admin 打开拆单 UI        → splitPlanPreview(orderId)         （auto 计划，内存推导，不落库）
2. admin 调单并确认          → confirmSplitPlan(orderId, packages) → applyAdjustment 校验
                              → 通过后 replaceForOrder 落库 OrderPackage（P1/P2…）
3. admin 按包批量发货         → batchCreateFulfillment(items)      → 回填 fulfillmentId + 实际 shippingFee
4. 同城配送（可选）          → createDelivery                      → DeliveryOrder.packageId + 回填 deliveryOrderId
5. admin 订单级包裹查询       → orderPackages(orderId)             → 按包追溯 仓/行/运费/履约/配送
```

旧订单不回填（从确认时点起记录）。

### 3.6 错误处理

- 落库失败：`confirmSplitPlan` 抛错 → 事务回滚（包裹不入库，计划不生效），前端可重试。
- 回填失败：仅 `Logger.warn`，不阻断发货/配送主流程（保持现状行为不回退）。
- `replaceForOrder` 的「先删后插」与调单校验在同一事务内（由 resolver 侧事务边界保证，参照 `applyAdjustment` 现有事务风格）。

### 3.7 数据库变更

- 本地 dev：`synchronize: true` 自动建表 `order_package`。
- 生产 PostgreSQL：沿用 `restock_json` 的处理方式 —— 用 `node tools/dbtool.mjs run <sql>` 执行 CREATE TABLE 建表，
  表结构与 3.1 实体对齐，`createdAt/updatedAt` 用 `timestamp`（跨库兼容类型）。
- 不引入插件级 migration 机制（现有插件均无；生产 DDL 以 dbtool 脚本为准）。

## 4. 成功标准

以拆单示例（订单 8 件，发货 B5/A3）验证：

- 调单确认后 `orderPackages(orderId)` 返回 **2 个包裹**：
  - P1：stockLocationId=B，lines=[{orderLineId, 5}]，shippingFee=估算值，deliveryMode='self'
  - P2：stockLocationId=A，lines=[{orderLineId, 3}]，shippingFee=估算值，deliveryMode='self'
- 按包发货后：**传入 packageId 对应的包**（如 P1）`fulfillmentId` 已回填、`shippingFee` 更新为实际运费（如 1000 分）；
  未发货的其他包（如 P2）保持估算值、不被误回填（按包精确匹配，不串包）。
- 再次调单确认（重复确认）后包裹行数**不翻倍**（幂等，仍为 2 条）。
- 同城配送场景：`deliveryOrderId` 正确关联到对应 `DeliveryOrder`。
- 原有 4 套 e2e（phase2/split/matrix/city）+ 阶段4 e2e 全部回归通过，不破坏现有链路。

## 5. 测试方案

扩展 `tools/e2e-phase3-split.mjs`（或新增 `tools/e2e-phase5-order-package.mjs`）新增断言：

1. 拆单确认后查询 `orderPackages`：2 包、B5/A3、行明细与数量正确、deliveryMode 正确。
2. 发货后查询：`packageId` 对应包的 `fulfillmentId` 已回填、`shippingFee` = 实际运费；未发货包不被误回填。
3. 重复确认幂等：包裹数仍为 2，不翻倍。
4. 回归：4 套既有 e2e 全绿（phase2 54 / split 23 / matrix 14 / city 8 / phase4 9）。

## 6. 本期不做（边界项，留待后续）

- OrderPackage 状态机（pending→shipped→delivered）与状态回写（方案 B）。
- 历史订单包裹数据回填。
- 真实配送平台对接（接入达达/蜂鸟等真实 provider）——本设计为其提供数据底座。
- 每包独立 fulfillment：`batchCreateFulfillment` 按包行过滤发货（当前为整单发货，一次发货回填一个包）。
- 前端订单详情展示「按包裹」拆分明细。
