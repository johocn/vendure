# 本地电商就近履约 · 阶段7设计：C端订单跟踪（Shop API）

> 承接：阶段6（OrderPackage 状态机与状态回写）遗留边界项之「C 端订单跟踪（shop API）」——「综合渐进」第二步。
> 目标：向 C 端（nshop 前端）开放订单包裹跟踪查询 `myOrderPackages(orderId)`，按包返回状态/时间线/行明细（后端富化商品信息）/self 物流信息/city 骑手信息；本期只做后端 Shop API + e2e，前端对接另开任务。

## 1. 背景与要解决的问题

阶段5/6 已把拆单包持久化为 `OrderPackage` 实体并补齐生命周期状态机（pending→shipped→delivered/cancelled，含时间戳），但 **C 端用户无法查询自己订单的包裹履约进度**：

- 现有 shop API 只有 `myOrderTracks(orderId)`（返回 `LogisticsTrackShop`，self 包物流轨迹）与 `myAfterSalesRequests`（售后单），**无按包聚合的订单跟踪视图**。
- `OrderPackage` 的 status/shippedAt/deliveredAt/cancelledAt 是后台字段（admin API），未暴露给 shop；`DeliveryOrder` 的骑手信息（courierName/courierPhone/thirdPartyNo/etaMinutes）亦只在 admin。
- C 端「订单跟踪页」需要：每包的阶段进度 + 行明细（商品名/SKU/数量）+ self 的物流单/承运商 + city 的骑手电话/配送单号/ETA。

## 2. 方案对比与选型

| 方案 | 说明 | 权衡 |
|---|---|---|
| **A. logistics 主导，delivery-gateway 供数据（推荐）** | `OrderPackage` 数据与状态机归 logistics-plugin，shop 组装逻辑放 `OrderPackageService`/新 `OrderPackageShopResolver`；delivery-gateway 只暴露 `'DeliveryOrderShopLinker'` 字符串 token 供注入器 duck-typing 取骑手信息 | 数据归属清晰、复用既有 `findByOrder`/状态机、跨插件模式（阶段4/5）已成熟，零编译依赖；logistics 需多一次注入器获取（已有先例，风险低） |
| B. delivery-gateway 组装（反向） | shop resolver 放 delivery-gateway（骑手信息所在侧），logistics 反向暴露 linker | 职责颠倒（OrderPackage 是 logistics 的实体），lines 富化仍要碰 OrderLine；不推荐 |
| C. 独立聚合服务 | 新建独立插件/services 聚合两侧数据 | 为单一查询引入新插件，过度设计；YAGNI |

**选型：方案 A**。范围沿用「综合渐进」：本期仅后端 Shop API + e2e，nshop 前端对接另开任务。

## 3. 设计详述

### 3.1 Shop GraphQL API 契约

位置：`packages/logistics-plugin/src/plugin.ts`（shopSchema），新增类型与查询；与 admin `OrderPackage` 分离（不暴露内部 stockLocationId/fulfillmentId/deliveryOrderId）。

```graphql
type OrderPackageLineShop {
    orderLineId: ID!
    quantity: Int!
    productName: String!      # 后端富化（按 ctx 语言取商品译名）
    sku: String!
}

type OrderPackageShop {
    code: String!
    deliveryMode: String!     # 'self' | 'city'
    status: String!           # pending/shipped/delivered/cancelled
    shippedAt: DateTime
    deliveredAt: DateTime
    cancelledAt: DateTime
    shippingFee: Int
    lines: [OrderPackageLineShop!]!
    # self 包（有 fulfillment）物流信息
    trackingNo: String
    carrierName: String
    # city 包（有 deliveryOrder）配送信息
    courierName: String
    courierPhone: String
    thirdPartyNo: String
    etaMinutes: Int
}

extend type Query {
    myOrderPackages(orderId: ID!): [OrderPackageShop!]!
}
```

### 3.2 归属校验（安全）

复用 `LogisticsService.getMyOrderTracks` 既有模式（[logistics.service.ts](packages/logistics-plugin/src/logistics.service.ts)）：

```
ctx.activeUserId 缺失 → UnauthorizedError
orderService.findOne(ctx, orderId, ['customer', 'fulfillments']) 不存在 → EntityNotFoundError
order.customer.id !== ctx.activeUserId → ForbiddenError（不泄露他人订单）
```

### 3.3 数据流与富化（`OrderPackageService.getMyOrderPackages`）

```
归属校验 → findByOrder 取包列表（按 code 排序）
→ 每个包：解析 linesJson（SplitLine[]）→ OrderLine join variant/product/translations 富化 productName/sku
→ self 包：fulfillmentId → LogisticsTrack 映射 trackingNo/carrierName
→ city 包：deliveryOrderId → 'DeliveryOrderShopLinker'（注入器 duck-typing）取骑手信息
→ 组装 OrderPackageShop[]
```

位置：
- `packages/logistics-plugin/src/order-package.service.ts`：新增 `getMyOrderPackages`；`OrderPackageService` 需新增 `init()`（`OnApplicationBootstrap`）经注入器获取 `OrderService` 与 `'DeliveryOrderShopLinker'`（try/catch 降级，延续 delivery-gateway 的既有跨插件范式）。
- `packages/logistics-plugin/src/order-package-shop.resolver.ts`（新增）：`@Query() @Allow(Permission.Authenticated) myOrderPackages(@Ctx() ctx, @Args('orderId') orderId)`，调用 service。

行明细富化实现：`connection.getRepository(ctx, OrderLine).find({ where: { id: In(lineIds) }, relations: ['variant', 'variant.product', 'variant.product.translations'] })`（用 `In()` 而非已弃用的 `findByIds`），productName 取 `ProductTranslation.name`（按 `ctx.languageCode`），sku 取 `variant.sku`。

### 3.4 跨插件 DeliveryOrderShopLinker

**delivery-gateway-plugin（数据侧）：**
- 新增方法 `getShopDelivery(ctx, deliveryOrderId): Promise<DeliveryShopInfo | null>`，`DeliveryShopInfo = { courierName; courierPhone; thirdPartyNo; etaMinutes }`（仅暴露 shop 需要的字段），未命中返回 null。
- [delivery-gateway.plugin.ts](packages/delivery-gateway-plugin/src/delivery-gateway.plugin.ts) `providers` 注册字符串 token：`{ provide: 'DeliveryOrderShopLinker', useExisting: DeliveryGatewayService }`。

**logistics-plugin（消费侧，零编译依赖）：**
- `OrderPackageService.init()` 中 `try { this.deliveryShopLinker = injector.get('DeliveryOrderShopLinker') } catch { this.deliveryShopLinker = null }`（不 import 任何 delivery-gateway 类型，duck-typing 字段接口）。
- `getMyOrderPackages` 对 city 包：`if (pkg.deliveryOrderId && this.deliveryShopLinker) await this.deliveryShopLinker.getShopDelivery(ctx, pkg.deliveryOrderId)`；linker 缺失或未命中 → 骑手字段留 null（正常降级，不报错）。

### 3.5 错误边界与降级

| 场景 | 行为 |
|---|---|
| 未登录查询 | UnauthorizedError |
| 订单不存在 | EntityNotFoundError |
| 订单非本人 | ForbiddenError |
| delivery-gateway 未注册 / token 缺失 | 正常返回，city 包骑手字段 null（Logger.warn 一次） |
| deliveryOrderId 未命中配送单 | 骑手字段 null，不抛错 |
| linesJson 为空/非法 | 返回空 lines 数组 |
| self 包无 fulfillment（未发货） | trackingNo/carrierName 为 null |
| 商品已下架（查不到 translation） | productName 回退 `(已下架)`，sku 保留 |
| 商品富化 join 失败 | 单条包失败不拖垮整单，log 后该行 productName 用 `(未知)` |

## 4. 测试方案

**新增 `tools/e2e-phase7-shop-order-package.mjs`**：

| 用例 | 场景 | 断言 |
|---|---|---|
| t1 | customer A 下单拆两仓 → confirmSplitPlan | `myOrderPackages` 返回 2 包，status=pending、lines 富化（productName/sku）、deliveryMode 正确 |
| t2 | `batchCreateFulfillment(P1)`（self） | P1 status=shipped + shippedAt 非空 + trackingNo/carrierName 非空 |
| t3 | `createDelivery(P2)` + 事件链 pickup | P2 status=shipped + courierName/courierPhone/thirdPartyNo/etaMinutes 非空 |
| t4 | `markPackageDelivered(P1)` + 配送 delivered 事件 | 两包均 delivered + deliveredAt 非空 |
| t5 | customer B 查询 customer A 的订单 | ForbiddenError |
| t6 | 未登录 token 查询 | UnauthorizedError |
| t7 | 回归：self 包无 fulfillment 时 tracking 字段为 null | 拆单后未发货即查，字段为 null |

**全量回归**：phase2 68 / split 23 / matrix 14 / city 8 / phase4 9 / phase5 8 / phase6 10 —— 全部 0 FAIL。

## 5. 边界与后续

- nshop 前端订单跟踪页对接（独立 Nuxt 仓库，另开任务）。
- 业务规则门槛（如「仅已送达可售后」）——阶段6 状态机已预留 `canTransition` 复用点。
- queryTrack 签收自动回写 self 包 delivered（阶段6 边界项，本期仍用 `markPackageDelivered`）。
- 每包独立 fulfillment、真实配送对接（跨阶段总边界）。
