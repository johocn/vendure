# 产品优惠券（多租户）设计

- 日期：2026-09-01
- 状态：已评审；**经现状核对后修订**（仓库已有成熟 coupon-plugin，本设计改为「补差闭合」而非重建）
- 关联：多租户 Channel、原生 Promotion、coupon-plugin、web-admin / nshop / vshop 多端

## 0. 现状核对结论（修订依据）

`packages/coupon-plugin` 已实现完整的优惠券体系，包括：

- 实体：`CouponTemplate`（ChannelAware、FIXED/PERCENT/FULL、minSpend、限量 totalCount/claimedCount、每人限领 perUserLimit、scope ALL/CATEGORY/SKU、pointsPrice 积分兑换、enabled、channels）+ `CustomerCoupon`（UNUSED/USED/RETURNED/EXPIRED/INVALID、唯一 code、usedOrderId、expiredAt 快照）。
- 结算机制：`applyCouponToOrder` 把 `couponCode`+`couponId` 写入 Order 自定义字段，注册 `coupon_applied` 条件 + `coupon_discount` 动作（`applyPriceAdjustments` 时读取账本打折）；`clearCouponFromOrder` 清券。
- 账本：领券/兑换用 `atomicIncrementClaimed`（条件自增防超发）、`perUserLimit`→`countHeld`；`OrderPlacedEvent`→`bindAsUsed`（一次性核销）、订单 `Cancelled`→`returnCoupon`（RETURNED 可复用）。
- 前端：nshop（OrderSummary 选券、JdFunctionGrid 领券入口、useOrderMutation/useOrderStore）、vshop（coupons.vue 券包/领券、checkout 选券、points-mall、member-center）、vshop web-admin（商品营销 Tab 内发券）均已接线。

**本设计不再重复上述内容**，只针对下述差距做闭合。

## 1. 目标与差距清单

商户（租户）需要一套多租户、多语言、中国本地化、灵活多变的优惠券体系。复用现有 coupon-plugin，闭合以下差距：

| # | 差距 | 说明 |
|---|------|------|
| G1 | 免邮券 | 现有 `CouponType` 仅 FIXED/PERCENT/FULL，缺免配送费券 |
| G2 | 跨渠道「默认商城含本店商品」可用范围 | `applyCouponToOrder`/`couponAppliedCondition` 未校验订单渠道与发行租户的商品归属；跨渠道时折扣整单生效而非仅本店商品行。`couponCentre` 仅按 `ctx.channelId` 列券，默认商城看不到租户券 |
| G3 | 券多语言 | `CouponTemplate.name` 为纯字符串，非 `LocalizedText`；缺 description |
| G4 | 属店权限与核销 | admin 发券/统计缺租户属店权限闸；跨渠道单在本店核销入口的生单可见性需与「本店商品单」对齐 |

## 2. 可用范围口径（G2 核心规则，沿用既有语义）

券归属 = 发券时的租户 Channel（`channels`）。可用判定 `isCouponApplicableToOrder`：
- 订单当前 Channel == 券所属租户 Channel → ✅ 自渠道可用（现有行为）；
- 订单当前 Channel == 默认商城（`__default__`），且订单含【商品 `customFields.shopId` == 发行租户对应 shopId】的订单行 → ✅ 跨渠道（判据同「本店商品单」）；
- 其余 → ❌ `COUPON_SCOPE_MISMATCH`。

跨渠道折扣只对**本店商品行**生效（PERCENT/FIXED 用本店商品行小计作为基数；CATEGORY/SKU 券的行级范围天然限定；minSpend 门槛改用本店商品行小计判定）。

## 3. 结算接入（沿用现有机制，非新增 Promotion）

沿用 `applyCouponToOrder(code)` 写入 Order `couponCode`/`couponId` + `coupon_applied`/`coupon_discount` 的现有链路。改动点：
- `couponAppliedCondition`：加入 G2 范围判定（自渠道 / 默认商城含本店商品），跨渠道时按本店商品行计算折扣基数；
- 选券入口按券包 `myCoupons` 提供，`applyCouponToOrder` 以顾客名下券码调用（前端已有）。

## 4. 免邮券（G1）

`CouponType` 新增 `FREE_SHIPPING`：折扣 = 本订单/本店商品行的配送小计（或配送费），`coupon_discount` 按免邮规则计算；`minSpend` 门槛可按需生效。

## 5. 多语言（G3）

`CouponTemplate.name` 改为 `LocalizedText` 并新增 `description`（LocalizedText），展示走 `localizeText()` 逐级回退；C 端固定文案（领券/券包/结算选券/状态标签/错误码）走 i18n 字典，nshop 各语言包与 vshop 两端同步补齐。

## 6. 属店权限（G4）

- Admin 发券/编辑/统计（`couponTemplates`/`createCouponTemplate`/`couponStats`）校验当前管理员可管理的 shop 与券所属租户一致；
- 跨渠道本店商品单的可核销券判定与「本店商品单」属店判据一致（`orderLineHasShop`）。

## 7. 账本（沿用，无新增）

限量/限领/一次性/回退沿用现有实现（原子防超发、OrderPlaced 核销、Cancelled 回退），仅当跨渠道生单时确保单一券实例仍仅核销一次。

## 8. 多端落地

| 端 | 动作 |
|----|------|
| coupon-plugin 后端 | G1 免邮、G2 范围、G3 多语言、G4 属店权限 |
| vshop web-admin | 发券 Tab：补 FREE_SHIPPING 类型编辑、多语言 name/description、属店权限；统计 |
| nshop C 端 | 结算选券（含 FREE_SHIPPING 展示）、领券中心、我的券包；i18n 字典补齐 |
| vshop C 端 | 与 nshop 对齐：结算选券/领券/券包、FREE_SHIPPING 展示 |

## 9. 错误码（沿用，新增两项）

| 错误码 | 场景 |
|--------|------|
| `COUPON_EXHAUSTED` | 发行量已领完（已有） |
| `COUPON_PER_USER_LIMIT` | 超出每人限领（已有） |
| `COUPON_EXPIRED` | 券已过期（已有） |
| `COUPON_SCOPE_MISMATCH` | **新增**：范围不符（非自渠道且非默认商城含本店商品） |
| `COUPON_ALREADY_USED` | 已核销复用（已有） |

## 10. 边界

- 原生 `couponCode`（Promotion 全局码）与 coupon-plugin 券并存，结算入口分别处理。
- 分箱/拆单沿用现有 `BoxShippingLineAssignmentStrategy`，不新增。
- 跨渠道折扣确保不混淆多租户商品行（仅本店商品行参与）。