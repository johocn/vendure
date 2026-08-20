# 本地电商就近履约 · 阶段6设计：OrderPackage 状态机与状态回写

> 承接：阶段5（OrderPackage 实体持久化，追溯底座）边界项之「OrderPackage 状态机（pending→shipped→delivered）与状态回写（方案 B）」。
> 目标：为 `OrderPackage` 补齐包裹生命周期状态机，由履约/配送事件回写状态，使包裹成为可追溯、可运营的状态载体；本期先服务后台展示，C 端跟踪与业务规则门槛为后续阶段。

## 1. 背景与要解决的问题

阶段5 已把拆单包持久化为 `OrderPackage` 实体（code/orderId/stockLocationId/linesJson/shippingFee/deliveryMode/fulfillmentId/deliveryOrderId），但**包裹只有关联、没有生命周期**：

- 一个包裹当前处于什么阶段（待发货 / 已发货 / 已送达 / 取消）无从表达，admin 无法按状态运营。
- 下游已有两个状态源，但均未回写到包裹：
  - 履约：`batchCreateFulfillment` 创建 Fulfillment（挂钩点2 回填 `fulfillmentId` + 实际运费）。
  - 配送：`DeliveryOrder` 已有 `DeliveryStatus` 状态机（pending→accepted→pickup→delivered/cancelled/exception），由 `applyStatusEvent` 驱动（mock 事件 / 未来真实平台 webhook），挂钩点3 回填 `deliveryOrderId`。
- 阶段5 选方案 A（追溯底座）时已明确「本期无状态机消费方（YAGNI）」，将状态机列为边界项（方案 B）。

## 2. 方案对比与选型

| 方案 | 说明 | 权衡 |
|---|---|---|
| **A. 内联原子更新** | OrderPackage 加 status 列，在既有挂钩点内直接置状态 | 最小改动；状态校验散落各挂钩点，后续「售后门槛」等业务规则难复用 |
| **B. 显式状态机服务（推荐）** | `OrderPackageService.transition` + `TRANSITIONS` 映射表，所有状态变更收敛到该方法；非法流转告警忽略、幂等 | 与 `applyStatusEvent` 的 TRANSITIONS 风格一致（团队已有模式）；后续业务规则可复用 `canTransition`/状态查询；仍为轻量枚举+映射，不引状态机库 |
| C. 以 Fulfillment 状态为源 | 不自建状态机，直接以 Vendure Fulfillment 状态为唯一源，OrderPackage 存快照 | 与「整单发货一个 fulfillment 对应一个包」语义错位；city 模式无 fulfillment 直达配送；当前系统未使用 Fulfillment 状态流转 → 需先补，改动最大 |

**选型：方案 B（显式状态机服务）**。消费方采用「综合渐进」：本期做后台展示 + 状态机底座，C 端跟踪与业务规则门槛为后续阶段。

## 3. 设计详述

### 3.1 实体字段扩展

位置：`packages/logistics-plugin/src/order-package.entity.ts`。

```typescript
export type OrderPackageStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

@Column({ default: 'pending' }) status: OrderPackageStatus;
@Column({ type: 'timestamp', nullable: true }) shippedAt: Date | null;
@Column({ type: 'timestamp', nullable: true }) deliveredAt: Date | null;
@Column({ type: 'timestamp', nullable: true }) cancelledAt: Date | null;
```

- `pending`：拆单确认落库（`replaceForOrder` 先删后插时重置为 pending）。
- `shipped`：该包已发货（`batchCreateFulfillment` 挂钩点2 回填后置）。
- `delivered`：已送达（终态；city 包由配送事件、self 包由人工确认）。
- `cancelled`：配送取消（终态；仅配送单 cancelled 事件回写，订单级取消不回写）。
- 列类型遵循跨库兼容约定：`status` 用 varchar（default），时间戳用 `timestamp`，禁止 `datetime`。

### 3.2 状态机（`OrderPackageService.transition`）

位置：`packages/logistics-plugin/src/order-package.service.ts`，新增 `transition` 方法与 TRANSITIONS 映射。

```typescript
const TRANSITIONS: Record<OrderPackageStatus, OrderPackageStatus[]> = {
    pending: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],   // 终态
    cancelled: [],   // 终态
};

/** 状态流转：幂等（同状态返回 true）、非法流转告警忽略、未命中告警返回 false；不抛错不阻断主链路 */
async transition(ctx, orderId, code, toStatus): Promise<boolean> {
    const pkg = await repo.findOne({ orderId, code });
    if (!pkg) { Logger.warn(...); return false; }
    if (pkg.status === toStatus) return true;                       // 幂等
    if (!TRANSITIONS[pkg.status].includes(toStatus)) { Logger.warn(...); return false; }
    pkg.status = toStatus;
    if (toStatus === 'shipped') pkg.shippedAt = new Date();
    if (toStatus === 'delivered') pkg.deliveredAt = new Date();
    if (toStatus === 'cancelled') pkg.cancelledAt = new Date();
    await repo.save(pkg);
    return true;
}
```

设计要点：
- 所有状态变更收敛到 `transition`；`linkFulfillment`/`linkDeliveryOrder` 保持原职责（回填关联 ID），仅在自身成功后触发状态流转。
- 终态（delivered/cancelled）不在任何源态中，天然不可回退。
- 并发配送事件以最后事件为准：delivered 后再收到 cancelled 被非法校验拦截。

### 3.3 回写挂钩点（状态驱动源）

| 驱动事件 | 位置 | 回写 |
|---|---|---|
| 发货成功（挂钩点2） | `logistics.service.ts` `linkFulfillment` 成功后 | `pending→shipped`（self 包） |
| 同城配送单创建（挂钩点3） | `delivery-gateway.service.ts` `createDelivery` | `pending→shipped`（city 包；回填 deliveryOrderId 时同步，同城下单即视为发货） |
| 配送送达（`applyStatusEvent` → delivered） | `delivery-gateway.service.ts` | `shipped→delivered` |
| 配送取消（`applyStatusEvent` → cancelled） | `delivery-gateway.service.ts` | `shipped→cancelled` |
| self 包人工确认送达 | 新增 admin mutation `markPackageDelivered` | `shipped→delivered` |

设计要点：
- city 包与 self 包**统一走 `pending→shipped→delivered` 线性链路**：city 包在 `createDelivery`（同城下单）时即视为已发货置 `shipped`，再由配送事件送达/取消；否则 `applyStatusEvent(delivered)` 会因 `pending→delivered` 非法流转被拦截，city 包永远无法送达。
- 配送取消只发生在配送单创建之后（此时包已 shipped），故回写为 `shipped→cancelled`。
- self 包送达决策：本期用 `markPackageDelivered(orderId, packageId)` 人工确认（e2e 可控、mock 跟踪无签收能力）；「queryTrack 得 signedAt 自动回写」列为后续增强边界。

### 3.4 跨插件 OrderPackageLinker 扩展

`OrderPackageLinker` duck-typing 接口增加可选方法：

```typescript
{
    linkFulfillment(ctx, orderId, packageId, fulfillmentId, actualShippingFee): Promise<boolean>;
    linkDeliveryOrder(ctx, orderId, packageId, deliveryOrderId): Promise<boolean>;
    transition(ctx, orderId, packageId, toStatus): Promise<boolean>;  // 新增
}
```

- logistics-plugin 侧：token `'OrderPackageLinker'` 仍指向 `OrderPackageService`，`transition` 直接可用。
- delivery-gateway 侧，两处调用（均 try/catch 降级 + 未命中仅告警，不阻断配送主链路）：
  - `createDelivery` 回填 `deliveryOrderId` 后：`transition(ctx, orderId, packageId, 'shipped')`（同城下单即视为发货）。
  - `applyStatusEvent` 落库后、若 `delivery.packageId` 且事件为 `delivered`/`cancelled`：`transition(ctx, orderId, packageId, event.status)`。
- 保持零编译依赖：delivery-gateway 依旧不 import `@vendure/logistics-plugin`。

### 3.5 API 暴露（admin，本期）

- `orderPackages(orderId)` 查询扩展：`status: String!`、`shippedAt: DateTime`、`deliveredAt: DateTime`、`cancelledAt: DateTime`（resolver 同步映射）。
- 新增 mutation `markPackageDelivered(orderId: ID!, packageId: String!): Boolean!`（权限 `Permission.UpdateOrder`；内部 `transition(ctx, orderId, packageId, 'delivered')`；幂等返回 true）。

### 3.6 幂等 / 并发 / 边界

| 场景 | 行为 |
|---|---|
| 同状态重复事件（如两次 delivered） | `transition` 幂等返回 true，不重复写时间戳 |
| 非法流转（如 delivered→shipped） | `Logger.warn` + 返回 false，不抛错不阻断主链路 |
| 包裹未命中（orderId+code 无记录） | `Logger.warn` + 返回 false，发货/配送主流程不受影响 |
| 终态不回退 | delivered/cancelled 不在 TRANSITIONS 源态中，天然不可回退 |
| 并发配送事件 | 以最后事件为准（终态后事件被非法校验拦截） |
| 订单级取消回写包裹 | 不做（订单状态已表达取消；已发货/已送达包取消走退货/售后，强行回写会造成状态矛盾） |
| 历史订单包裹数据回填 | 不做 |
| queryTrack 签收自动回写 self 包 | 不做（本期用 markPackageDelivered） |

## 4. 数据流示例

```
下单拆两仓(B5/A3) → confirmSplitPlan
  → OrderPackage P1(pending, B5/self) / P2(pending, A3/self)

P1 发货 → batchCreateFulfillment(packageId=P1, fee=1000)
  → P1.shippedAt 置位, P1.status=shipped, P1.fulfillmentId/fee 回填

P2 转同城 → createDelivery(packageId=P2) → 配送单 pending
  → P2.status=shipped, P2.deliveryOrderId 回填（同城下单即视为发货）
  → 配送商接单/取货/送达 → applyStatusEvent(delivered)
  → P2.status=delivered, P2.deliveredAt 置位

P1 自有司机送达 → 运营确认 → markPackageDelivered(orderId, P1)
  → P1.status=delivered, P1.deliveredAt 置位
```

## 5. 测试方案

新增 `tools/e2e-phase6-order-package-state.mjs`（复用 e2e-phase5 辅助函数模式）：

| 用例 | 场景 | 断言 |
|---|---|---|
| t1 | 下单拆两仓 → confirmSplitPlan | 两包 `status=pending`，shippedAt/deliveredAt 为空 |
| t2 | `batchCreateFulfillment(P1)`（self 发货） | P1 `shipped` + shippedAt 非空；P2 仍 `pending` |
| t3 | `createDelivery(P2)` → P2 `shipped` + deliveryOrderId 回填；再 `mockDeliveryEvent(delivered)` | P2 `delivered` + deliveredAt 非空 |
| t4 | `markPackageDelivered(P1)` | P1 `delivered` |
| t5 | 对已 delivered 的 P1 再 `markPackageDelivered` | 幂等返回 true，状态不变、deliveredAt 不重置 |
| t6 | 另建订单：`createDelivery(P3)` → `mockDeliveryEvent(cancelled)` | P3 `cancelled` + cancelledAt 非空 |
| t7 | 对 cancelled 的 P3 调 `markPackageDelivered` | 返回 false（忽略），状态仍 cancelled |
| t8 | 回归阶段5场景 | phase5 t1-t5 原断言不破坏 |

全量回归（全部 0 FAIL）：phase2 61 / split 23 / matrix 14 / city 8 / phase4 9 / phase5 8。

## 6. 本期不做（边界项，留待后续）

- C 端订单跟踪 shop API（综合渐进第二步；状态机底座已预留 status 字段）。
- 业务规则门槛（如「仅已送达包裹可发起售后/回补」，综合渐进第三步）。
- queryTrack 签收自动回写 self 包（tracking provider 返回 delivered/signedAt 时自动回写）。
- 订单级取消回写包裹、历史订单包裹数据回填。
- 真实配送平台对接（达达/蜂鸟等，状态回写接口已就绪）。

## 7. 成功标准

1. 拆单确认后 `orderPackages` 返回 `status=pending`。
2. 按包发货后对应包 `status=shipped`、`shippedAt` 非空；未发货包仍 pending。
3. city 包配送 `delivered`/`cancelled` 事件回写 `status` 与时间戳。
4. `markPackageDelivered` 使 self 包 `delivered`；重复调用幂等。
5. 非法流转/未命中仅告警不阻断主链路；终态不回退。
6. 全量回归 6 套 e2e 全绿（含阶段5）。
