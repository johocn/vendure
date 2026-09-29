# OperationsPlugin 运营中台插件

## 概述

`OperationsPlugin` 为 Vendure 提供运营侧统一能力：经营看板聚合、CMS 内容管理（Banner / 推荐位 / 公告 / 楼层 / 图标宫格 / 分类导航，单表多态 + 软删除 + 定时上下线）、营销活动统一管理（秒杀 / 拼团，另含券的**只读统计**），以及商品展示值（销量 / 可得积分）重算。

**核心特性：**
- 经营看板：销售 / 配送 / 客户 / 库存 / 售后 / 营销六类指标，含销售趋势与分类 Top
- CMS：`ContentItem` 单表多态，`startAt` / `endAt` 到点自动上下线（每日任务 + 每分钟任务）
- 营销：秒杀 / 拼团的活动 CRUD 与总览，以及券模板的**只读状态统计**（统一走细分权限）。券的 CRUD 由 `coupon-plugin` 自带 API 提供，不在本插件
- 商品展示值：`Product.salesCount`（销量）与 `Product.pointsReward`（可得积分）由订单与价格派生并落库，C 端直读

**包名：** `@vendure/operations-plugin`

**类名：** `OperationsPlugin`

---

## 安装

```bash
npm install @vendure/operations-plugin
```

---

## 配置说明

在 `vendure-config.ts` 中注册插件：

```ts
import { OperationsPlugin } from '@vendure/operations-plugin';

export const config = {
  // ...
  plugins: [
    OperationsPlugin.init(),
  ],
};
```

插件注册时会：

- 注册 `ScheduledTask`：`operations-content-lifecycle`（每分钟）、`operations-product-stats`（每日 03:05）
- 合并自定义字段：`Product.displayTemplate`、`Channel.themeId`
- 订阅 `ProductEvent` / `ProductVariantEvent`（商品展示值即时重算）

> 任务只在 worker 进程执行（`schedulerOptions.runTasksInWorkerOnly`）。生产必须常驻一个 worker 进程，否则不会有任何 ScheduledTask 运行。

---

## 数据模型：商品展示值相关自定义字段

字段定义在 `@vendure/marketplace-plugin` 的 `Product`（`custom-fields.ts`，Product 字段唯一来源）。

| 字段 | 类型 | public | 可空 | 默认 | 说明 |
|------|------|--------|------|------|------|
| `salesCount` | `Int` | 是 | 否 | `0` | **展示销量** = `realSalesCount + bonusSales`，由重算写回；C 端直读 |
| `realSalesCount` | `Int` | 否 | 否 | `0` | 真实聚合销量，后台可核对 |
| `bonusSales` | `Int` | 否 | 否 | `0` | 后台展示基数（运营手填） |
| `pointsReward` | `Int` | 是 | 是 | — | **展示积分** = `pointsRewardOverride ?? 派生值`，由重算写回；C 端直读 |
| `pointsRewardOverride` | `Int` | 否 | 是 | — | 后台单品覆盖值 |

> `public: true` 只给两个**展示值**，内部字段不进 Shop API；Admin API 始终可见全部 5 个字段，Vendure 会自动在商品编辑页渲染表单控件，无需自研 dashboard 组件。

---

## 计算口径

### 销量

```
realSalesCount(product) = Σ orderLine.quantity
    WHERE orderLine.productVariant.productId = product.id
      AND order.state IN ('PaymentSettled','PartiallyShipped','Shipped','PartiallyDelivered','Delivered')
```

- 状态白名单即「已支付及之后」；`AddingItems` / `ArrangingPayment` / `PaymentAuthorized` / `Modifying` / `Draft` / `Cancelled` 天然排除。
- **全渠道合计**：`Product` 是全局实体，销量不按渠道拆分。
- 退款**不回退**销量（历史成交口径）。

### 可得积分

```
最低变体价 = MIN(product_variant_price.price)   // 全渠道最低，不含税，单位分
pointsReward = pointsRewardOverride ?? floor(最低变体价 × 1)
```

- 与会员实发规则（`member-level-plugin`）口径对齐的维度：基数取不含税价、取整用 `Math.floor`。
- 倍率差异：会员实发按档位 `tier.pointsMultiplier` 计（未登录不可知），详情页统一按 **×1** 展示，是下界而不会误导为「可得更多」。
- 积分折算：`Channel.pointsPerYuan` 默认 100（100 积分抵 1 元），1 分 = 1 积分 ⇒ ¥99 商品「可得 9900 积分」。
- 取**全渠道**最低价而非当前渠道，是为了让重算结果与执行上下文（渠道）无关，保证幂等。

### 写回

```
salesCount   = realSalesCount + bonusSales
pointsReward = pointsRewardOverride ?? floor(最低变体价 × 1)
```

**写前比对**：与库中现值逐字段比较，完全一致则不调用 `ProductService.update` —— 既避免无谓写入，也切断 `ProductEvent` 自激循环。

---

## 重算触发路径

| 路径 | 时机 | 负责范围 |
|------|------|----------|
| 每日定时任务 `operations-product-stats` | 每日 03:05（worker 进程） | 订单驱动：新订单带来的销量变化最多 T+1 收敛 |
| 事件订阅 | `ProductEvent`(created/updated)、`ProductVariantEvent`(created/updated/deleted) | 后台改基数/覆盖值、改变体价后**即时**刷新 |
| 手动 mutation `recomputeProductStats` | 运营/部署后按需 | 一次性回填、纠偏 |

---

## GraphQL API 参考

### Admin API

#### Mutation

| 接口 | 权限 | 说明 |
|------|------|------|
| `recomputeProductStats(productIds: [ID!]): Int!` | `UpdateProduct` | 重算商品展示值，返回**实际被更新**的商品数；`productIds` 省略或传空数组 = 全量重算 |

**全量回填（部署后一次性执行）**

```graphql
mutation {
  recomputeProductStats
}
```

**指定商品纠偏**

```graphql
mutation RecomputeOne($ids: [ID!]) {
  recomputeProductStats(productIds: $ids)
}
```

### 其它 Admin API

| 接口 | 权限 | 说明 |
|------|------|------|
| `dashboardOverview(range: String!): DashboardMetrics!` | `ViewDashboard` | 看板六类指标，`range ∈ today/yesterday/week/month` |
| `salesTrend(days: Int!): [SalesTrendPoint!]!` | `ViewDashboard` | 销售趋势，`days ∈ 7/30` |
| `categoryTop(days: Int!): [CategoryTopItem!]!` | `ViewDashboard` | 分类 Top，`days ∈ 7/30` |
| `contentItems(type, position, enabled, page, pageSize): ContentItemList!` | 按 `type` 动态判定 | CMS 列表 |
| `contentItem(id: ID!): ContentItem` | 按 `type` 动态判定 | CMS 详情 |
| `createContentItem / updateContentItem / deleteContentItem` | 按 `type` 动态判定 | CMS 写操作 |
| `triggerContentLifecycle: ContentLifecycleResult!` | `ManageContent` | 手动触发一次内容上下线检查 |
| `marketingOverview` / `marketingFlashSale*` / `marketingGroupBuy*` | 见 `MarketingAdminResolver` | 营销活动统一管理（**券不在此**：券的 CRUD 由 coupon-plugin 自带的 `couponTemplates*` / `couponTemplate` / `createCouponTemplate` / … 提供） |

CMS 的 `type → 权限` 映射：`Banner → ManageBanner`、`Recommendation → ManageRecommendation`、`Notice → ManageNotice`、`Floor → ManageFloor`、`IconGrid` / `CategoryNav → ManageContent`。

### Shop API

| 接口 | 说明 |
|------|------|
| `publishedContent(type: String, position: String): [ContentItemPublic!]!` | 按类型/位置取已启用内容（过滤 `startAt`/`endAt`/`enabled`/未软删） |

商品展示值不在 Shop API 新增接口：直接读 `Product.customFields.salesCount` / `pointsReward`。

---

## 与其他插件集成

| 插件 | 关系 | 说明 |
|------|------|------|
| `@vendure/marketplace-plugin` | **字段来源** | 5 个展示值字段定义在 marketplace-plugin 的 Product 自定义字段清单 |
| `@vendure/flash-sale-plugin` / `@vendure/group-buy-plugin` / `@vendure/coupon-plugin` | 必需 | 插件 `imports` 中注册，营销总览与活动管理依赖 |
| `@vendure/delivery-plugin` | 权限体系 | 权限定义（`ViewDashboard` / `Manage*`）随 delivery-plugin 注册 |
| `@vendure/member-level-plugin` | 口径对齐 | 可得积分派生的基数与取整口径对齐会员实发规则 |

---

## 注意事项

- **worker 必须常驻**：任务只在 worker 执行，停掉 worker 后销量不再每日收敛。
- **最多 T+1**：订单带来的销量变化由每日任务收敛，不等同实时。
- **不按渠道拆分销量**：详情页展示本身不区分店铺来源，按渠道存需要额外结构，收益不抵成本。
- **退款不回退销量**：与主流电商「已售」口径一致（历史成交）。
- **事件订阅在两个进程都会触发**：server 与 worker 各自订阅，重复重算幂等、无副作用。
