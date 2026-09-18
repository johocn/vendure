# 租户指定商品优惠券：商品绑券 + 详情页领券 + 凭码兑换 设计

> 日期：2026-09-19
> 状态：已评审（brainstorming 流程产出，用户确认）
> 范围：核心闭环优先 —— 商品绑券（双入口）+ 详情页领券 + 结算按商品限定 + 凭码兑换；会员等级/赠券规则/积分兑换等排二期（字段预留）。

## 1. 背景与目标

现有 coupon-plugin 已具备：`CouponTemplate`（FIXED/PERCENT/FULL/FREE_SHIPPING 券类型、minSpend 门槛、时间窗、totalCount/claimedCount 限量、perUserLimit 限领、pointsPrice 积分价、scope ALL/CATEGORY/SKU、shopId 租户隔离）、`CustomerCoupon`（用户持券，唯一 code）、`claimCoupon`（C 端领券）、`grantCoupon`/`grantCouponIssue`（后台定向发券）、`coupon-promotion-condition`（结算校验，仅按 shopId + minSpend）。

缺口：
- 「指定商品」维度仅有字段（scope=SKU + variantId）**没有结算校验逻辑**——券可用于本店任何商品。
- 无商品维度运营层（无法在商品页查看/配置该商品的券）。
- 无详情页领券入口、无凭码兑换入口。
- 无「领取后 N 天有效」「仅限新客」等中国本地化玩法字段。

目标：以 B 融合形态落地 —— 新增运营层 `ProductCouponBinding`，物理校验复用现有 scope 链路（单向同步），结算校验按 binding 集合过滤订单行。

## 2. 数据模型

### 2.1 新增实体 `ProductCouponBinding`（coupon-plugin）

| 字段 | 类型 | 用途 | 归属 |
|---|---|---|---|
| id | int | 主键 | 本期 |
| productId | int | 绑定商品（商品下全 SKU） | 本期 |
| variantIds | jsonb/int[] | 多规格细化，空=全 SKU | 本期 |
| couponTemplateId | int | 关联 CouponTemplate | 本期 |
| enabled | bool | 绑定点开关 | 本期 |
| channelId | int | 租户隔离（对齐 shopId 语义） | 本期 |
| displayOrder | int | 详情页领券排序 | 本期 |
| perUserClaimLimit | int 可空 | 每人限领（覆盖模板 perUserLimit） | 预留 |
| claimWindowStart/End | timestamptz 可空 | 该商品券专属领券时间窗 | 预留 |
| claimStock | int 可空 | 该商品券独立库存 | 预留 |
| badgeText | varchar 可空 | 领券卡片角标（「新人专享」「限时」） | 预留 |
| promoTitle | varchar 可空 | 领券卡片主文案覆盖 | 预留 |
| remark | varchar | 运营备注 | 本期 |

### 2.2 `CouponTemplate` 新增字段

| 字段 | 类型 | 用途 | 归属 |
|---|---|---|---|
| claimable | bool 默认 true | 详情页领券入口开关（binding.enabled && template.claimable） | 本期 |
| claimCode | varchar 可空 | 兑换码（非空=支持凭码兑换，同租户唯一） | 本期 |
| validDays | int 可空 | 领取后 N 天有效（空=固定 startsAt/endsAt） | 本期 |
| newCustomerOnly | bool 默认 false | 仅限新客（本租户无历史有效订单）可领可用 | 本期 |
| memberLevel | varchar 可空 | 会员等级限定 | 预留（只建字段不开发） |
| stackable | bool 默认 false | 是否可叠加其他券 | 预留 |
| excludePromotionItems | bool 默认 false | 特价/秒杀品排除 | 预留 |
| claimStartAt/EndAt | timestamptz 可空 | 领券/兑换全局时间窗 | 预留 |
| listInCouponCenter | bool 默认 false | 领券中心公开展示 | 预留 |
| badgeText | varchar 可空 | 券通用角标 | 预留 |

### 2.3 二期建表（本期只建表不开发）`CouponGiftRule`

| 字段 | 类型 | 说明 |
|---|---|---|
| trigger | enum | ORDER_PLACED / ORDER_PAID |
| conditionJson | jsonb | 触发条件（满 X 元/购满 N 件/指定商品） |
| couponTemplateId | int | 赠送哪张券 |
| quantity | int | 每次赠送张数 |
| channelId | int | 租户隔离 |
| enabled | bool | 规则开关 |
| perCustomerLimit | int 可空 | 每人累计赠送上限 |

## 3. 后端服务层（coupon-plugin）

### 3.1 迁移
- ProductCouponBinding 建表；CouponTemplate ADD COLUMN（幂等 IF NOT EXISTS，对齐 cjk-plugin migrate 模式）。

### 3.2 CouponBindingService
- `listByProduct(productId, channelId)`：商品可领券列表（详情页）。
- `create/update/delete/toggleEnabled`：后台 CRUD。
- **单向同步**：创建/更新 binding 时同步写 `template.scope='SKU'`；若 variantIds 长度为 1 则写 `template.variantId`，多 variant 留空（模板字段仅为历史模板兼容，**结算判定以 binding 集合为唯一权威**）。

### 3.3 结算校验改造（coupon-promotion-condition）
- 现有：shopId 本店行 + minSpend。
- 新增：模板存在 binding 记录时，按 binding 集合判定订单行（productId 匹配行.product，variantIds 匹配行.variantId，variantIds 为空=该商品全 SKU 命中），不命中行从 eligibleLines 剔除；模板 variantId 字段不再参与判定（仅兼容无 binding 的历史模板）。
- newCustomerOnly：该客户本租户历史有效订单数 > 0 则不可用（领券与结算两处校验）。
- validDays：领取时 expiresAt = claimedAt + validDays，结算校验未过期。

### 3.4 C 端接口（shop-api，复用 claimCoupon 链路）
| 接口 | 说明 |
|---|---|
| productCoupons(productId) | 详情页可领券列表 |
| claimProductCoupon(bindingId) | 详情页领券 → claimCoupon |
| redeemCouponByCode(claimCode) | 兑换页凭码领券（码匹配 + channel 隔离 + 发放前置）→ claimCoupon |
| myCoupons（已有） | 用户券列表 |

### 3.5 后台接口（admin-api）
- 券模板表单扩展：claimable、claimCode、validDays、newCustomerOnly（memberLevel 不暴露）。
- Binding CRUD + 商品页快捷建券（预填 SKU）。

## 4. C 端前端（nshop）

- 商品详情页「领券专区」积木块 ProductCouponBlock：productCoupons 列表 → 领券 → 成功态。
- 我的优惠券页：内嵌「输入兑换码」输入框 + 兑换按钮（错误码提示）。
- i18n 四语言词条同步（Template Standard 模块1）。

## 5. 后台前端（web-admin）

- 券模板表单「领取设置」区：可领取/兑换码/领取后有效天数/仅限新客 + 「指定商品」选择器。
- 商品编辑页「商品专属券」区块：已绑券列表（增/停用/删）+ 快捷新建。
- 券列表显示标签。

## 6. 测试（TDD 先行）

- 后端单测：binding CRUD + 单向同步、eligibleLines 过滤、validDays 过期、newCustomerOnly。
- API 回归：建 SKU 券 → 绑商品 → 领券 → 下单校验 → 凭码兑换。
- Playwright 手机截图（390×844，dpr=2）：详情页领券区、兑换页、后台建券表单、商品页绑券区。
- 操作手册章节（含截图）。

## 7. 范围边界

- 本期：2.1 全量 + 2.2 本期字段 + 2.3 建表、后端 3.x、前端 4/5 节。
- 二期：memberLevel 逻辑、赠券规则（下单赠券/支付后发券）、积分购买券、领券中心、叠加规则、特价品排除。
