# 产品优惠券（多租户）设计

- 日期：2026-09-01
- 状态：已评审（用户确认方案 A/C）
- 关联：多租户 Channel、原生 Promotion 促销、分箱与拆单结算、web-admin / nshop / vshop 多端

## 1. 目标与背景

商户（租户）需要一套**灵活多变**的产品优惠券系统：每租户发行，租户内的商品可使用，且**既可在本租户自渠道订单用，也可在默认商城渠道中含本店商品的订单用**。系统需满足中国本地化、多租户、多语言，并**与 Vendure 原生 `couponCode` 促销并存**。

现有机制核查结论：Vendure 原生 `defaultPromotionActions`（`orderFixedDiscount`/`orderLineFixedDiscount`/`orderPercentageDiscount`/`discountOnItemWithFacets`/`productsPercentageDiscount`/`freeShipping`/`buyXGetYFreeAction`）与 `defaultPromotionConditions`（`minimumOrderAmount`/`hasFacetValues`/`containsProducts`/`customerGroup`）已覆盖全部所需规则形态；原生 `couponCode` 为全局可无限复用码，无限量/限领/一次性语义。

本设计复用原生 Promotion 作**规则引擎**，新建 Coupon 层作**策略 + 范围 + 限量账本 + 多语言**门面（方案 A/C 合并落地）。

## 2. 需求摘要

| 维度 | 结论 |
|------|------|
| 券模型 | 独立券实体，与原生 couponCode 促销**并存** |
| 可用范围 | ① 发行租户自渠道订单；② 默认商城渠道中「含本店商品」订单（判据同「本店商品单」） |
| 领用方式 | 领券入账户（券包），结算从券包选券 |
| 规则形态 | 满减 / 折扣(百分比) / 固定面额 / 指定商品 / 品类 / 免邮（全部映射到原生 action） |
| 生命周期 | 限量发行 + 每人限领 + 一次性使用 |
| 目标 | 中国本地化、灵活多变促销、多租户、多语言 |
| 落地端 | vshop web-admin 发券；nshop 结算选券 + 领券中心 + 券包；vshop C 端同步 |

## 3. 数据模型

### 3.1 Coupon（发行模板，Channel-aware，归属发行租户）

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 内部唯一编码 |
| `name` / `description` | `LocalizedText` | 多语言，逐级回退 |
| `ruleType` | enum | `FIXED_AMOUNT`(固定面额) \| `PERCENTAGE`(折扣) \| `THRESHOLD`(满减) \| `PRODUCT_SPECIFIC`(指定商品) \| `CATEGORY`(品类) \| `FREE_SHIPPING`(免邮) |
| `ruleArgs` | JSON | 面额/百分比/门槛/免邮开关 |
| `scopeProductIds` | [ID] | 指定商品券范围 |
| `scopeFacetOrCollectionIds` | [ID] | 品类券范围 |
| `totalQuantity` / `issuedCount` | int | 发行总量 / 已领取 |
| `perUserLimit` | int | 每人限领 |
| `startsAt` / `expiresAt` | DateTime | 生效 / 失效时间 |
| `enabled` | boolean | 是否启用 |
| `rulePromotionId` | ID | 发券时自动生成的关联原生 Promotion |

### 3.2 CustomerCoupon（领取实例）

| 字段 | 类型 | 说明 |
|------|------|------|
| `customerId` / `couponId` | ID | 顾客 / 券 |
| `claimedAt` | DateTime | 领取时间 |
| `status` | enum | `AVAILABLE`(未用) \| `USED`(已核销) \| `EXPIRED`(过期) \| `REVERSED`(作废) |
| `usedOrderId` / `usedAt` | ID / DateTime | 核销订单与时间 |

## 4. 范围判定

券归属 = 发券时的租户 Channel（`ownerChannel`）。

选券校验（`isCouponApplicableToOrder`）：
- 订单当前 Channel == `ownerChannel` → ✅ 自渠道可用；
- 订单当前 Channel == 默认商城（`__default__`），且订单含【商品 `customFields.shopId` == ownerChannel 对应 shopId】的订单行 → ✅ 跨渠道（判据同「本店商品单」）；
- 其余 → ❌ `COUPON_SCOPE_MISMATCH`。

跨渠道折扣：引入自定义条件 `couponScopeShop(shopId)`，把 eligible 订单行限定到本店商品行；行级折扣/满减/免邮只对 eligible 行小计判定。该 Promotion 需同时挂到默认商城 Channel 才能评估。

## 5. 结算接入

- **选券入口**：结算页「券包」列出名下 `AVAILABLE` 且未过期券（叠加策略受 `couponStackable` 约束），选后调 mutation。
- **`selectCoupon(couponId)`**：
  1. 事务内锁 CustomerCoupon，校验状态=AVAILABLE、未过期、符合范围判定；
  2. 解析 `CustomerCoupon → Coupon → rulePromotionId`，将该 Promotion 的 `couponCode` 挂到 active order（**复用原生 applyCouponCode**，订单合计/分箱/结算/支付链路零改动）；
  3. 在 `order.customFields.selectedCouponRef` 记录券实例 id，供优惠归属展示与核销追溯。
- **`deselectCoupon`**：移除所选，调用原生移除逻辑。

**分箱/拆单交互**
- 结算拆成多子订单（不选余额时按配送档案全拆）时，券只落到**含该券主商品行**的子订单；
- 单一券实例全程只核销一次，由事务保证，不会跨子订单重复扣减。

## 6. 核销账本（限量 / 限领 / 一次性）

- **领券竞态**：`claimCoupon` 用条件更新原子自增——`issuedCount < totalQuantity` 才 +1 否则 `COUPON_EXHAUSTED`；`perUserLimit` 校验名下单人已有数量，超限 `COUPON_PER_USER_LIMIT`。
- **核销时点**：选中券仅 `AVAILABLE`（不立即消费）；订单进入 PaymentAuthorized/Completed 的 transition hook 消费实例 → `status=USED`、写 `usedOrderId`/`usedAt`。「付了才算用」。
- **回溯/作废**：订单取消/退款 → 实例置 `REVERSED`；是否回退已领额度由后台规则决定。
- **过期**：`expiresAt < now` 的实例不可选，未用到期标记 `EXPIRED`。

## 7. 多语言

- 券 `name`/`description` 用 `LocalizedText`（当前 locale → defaultLocale → 首个值 → 内建占位）。
- C 端固定文案（领券中心、券包、结算选券、状态标签、错误提示）全部走 i18n 字典，nshop 各语言包与 vshop 两端同步补齐，禁止写死单一语言。

## 8. 多端落地

| 端 | 能力 |
|----|------|
| vshop web-admin（商户） | 「优惠券」页：发行/编辑、限量/限领/有效期/范围/规则、领取与核销统计、上下架 |
| nshop C 端（Nuxt） | 结算券包选券（与原生券码输入并存）、领券中心、我的券包、订单优惠展示 |
| vshop C 端 | 与 nshop 同等结算选券 + 领券中心 + 券包 |

## 9. 后端接口清单

**Shop API（C 端，走 `vendure-token` 路由）**
- `availableCoupons`：领券中心可领取列表（按发行租户 + 范围过滤）
- `claimCoupon(couponId)`：领取（限量+限领原子校验）→ CustomerCoupon
- `myCoupons`：我的券包（含状态/过期）
- `selectCoupon(couponId)` / `deselectCoupon`：结算选/退券（复用 applyCouponCode）

**Admin API（web-admin）**
- `coupons`：券列表（发券租户可见）
- `createCoupon` / `updateCoupon` / `setCouponEnabled`：发行管理（自动同步 rulePromotion）
- `couponStats(couponId)`：领取/核销/作废统计

## 10. 错误处理（统一错误码）

| 错误码 | 场景 |
|--------|------|
| `COUPON_EXHAUSTED` | 发行量已领完 |
| `COUPON_PER_USER_LIMIT` | 超出每人限领 |
| `COUPON_EXPIRED` | 券已过期 |
| `COUPON_DISABLED` | 券已停用 |
| `COUPON_SCOPE_MISMATCH` | 范围不符（非自渠道、无本店商品） |
| `COUPON_ALREADY_USED` | 已核销复用 / 并发核销乐观锁冲突 |

## 11. 边界与后续可配置项

- 原生 `couponCode` 入口保留，新券包选券与其并存。
- 作废是否回退领额度：后台开关可配置。
- 券与分箱、叠加策略的联动依赖现有 `couponStackableCondition` + `BoxShippingLineAssignmentStrategy`，无需改动既有分箱/结算核心。