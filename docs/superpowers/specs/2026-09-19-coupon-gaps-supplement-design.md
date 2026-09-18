# 租户指定商品优惠券：四缺口补充设计

> 日期：2026-09-19
> 状态：brainstorming 产出，用户确认
> 关系：方案1 的补充深化文档。不推翻方案1（`2026-09-19-product-coupon-binding-design.md`），仅将方案1「背景与目标」中列出的 4 个缺口逐条展开为完整详设；实施仍走方案1 计划（`2026-09-19-product-coupon-binding.md`）。

---

## G1. 「指定商品」维度仅有字段、无结算校验逻辑

### 现状分析

- `CouponTemplate` 已有 `scope: ALL|CATEGORY|SKU`、`categoryId`、`variantId` 字段，但结算校验 `couponAppliedCondition`（`coupon-promotion-condition.ts`）**只按 shopId 过滤本店行 + minSpend 门槛**，`variantId` 完全不参与订单行判定。
- 后果：一张 `scope=SKU` 的券在结算时可作用于本店**任何商品**，与后台配置的「指定商品」语义不符，属真实缺陷。

### 解决方案

**binding 集合为唯一权威**：模板存在 `ProductCouponBinding` 记录时，按绑定集合过滤订单行；无 binding 的历史模板仍走现有 `scope/variantId` 兼容判定。

校验顺序（`coupon-promotion-condition.ts` 内，shopId 过滤之后、minSpend 之前插入）：

1. 查询模板的 enabled binding 集合：`CouponBindingService.listByTemplate(ctx, template.id)`
2. 集合非空时，订单行命中条件：`b.productId === line.product.id && (!b.variantIds?.length || b.variantIds.includes(line.variant.id))`；`variantIds` 为空 = 该商品全 SKU 命中
3. 命中行变为新的 `eligibleLines`；空则 `return false`
4. 集合为空（绑定全部禁用/删除）→ 回退现有 shopId 过滤行为，不破坏历史券

### 数据模型/接口

| 项 | 说明 |
|---|---|
| 实体 | `ProductCouponBinding`（productId + variantIds + couponTemplateId + enabled + channelId + displayOrder + 预留字段） |
| 服务 | `CouponBindingService.listByTemplate(ctx, templateId: ID): Promise<ProductCouponBinding[]>`（只返回 enabled） |
| 运行时 | 对齐现有 `getCouponConnection` 模式新增 `getBindingConnection()` 注入点，避免循环依赖 |

### 边界与错误处理

- **binding 禁用/删除后**：集合变空 → 回退历史行为（券按 shopId 全店可用），不报错
- **多规格**：`variantIds` 数组匹配任一即命中；空数组 = 全 SKU 命中
- **免邮券（FREE_SHIPPING）**：eligibleLines 过滤同样应用于配送线判定，base 计算不涉及商品行时以命中行集合为空判定
- **PERCENT/FIXED/FULL**：`discountAmount` 上限 = 命中行小计（`upperBound`），与现有逻辑一致

### 测试点（TDD）

1. 订单含绑定行 + 非绑定行 → 只对绑定行计算 base，FIXED 封顶命中行小计
2. 订单全为非绑定行 → `return false`
3. binding 全部禁用 → 回退全店可用（历史行为）
4. `variantIds` 空数组 → 商品全 SKU 命中
5. 多 variant 绑定 → 命中任一变体行即纳入

---

## G2. 无商品维度运营层

### 现状分析

- 券模板按 scope/categoryId/variantId 表达适用范围，**没有「从商品视角查看/配置该商品有哪些券」的运营入口**。
- 后果：运营无法在商品页直观看到某商品的券覆盖，配置依赖优惠券页反向逐个建 SKU 券，易遗漏、无聚合视图。

### 解决方案

**新增运营层实体 `ProductCouponBinding`（商品 ↔ 券模板关联）+ 双入口**：

1. **优惠券页建券**（复用现有链路）：建券时 scope=SKU + 选商品（预填 variantId）→ 保存后自动创建 binding 记录（若不存在）
2. **商品页快捷区**（新增）：商品编辑页内嵌「商品专属券」区块——列出 `productCouponBindings(productId)`，支持停用/删除/「为此商品新建券」（预填 SKU 跳建券页，保存时建 binding）

**单向同步机制**：创建/更新 binding 时同步写 `template.scope='SKU'`；`variantIds` 长度 1 时写 `template.variantId`，多 variant 留空。binding 是运营层权威，模板字段仅兼容历史。

### 数据模型/接口

| 项 | 说明 |
|---|---|
| 实体 | `ProductCouponBinding`（见方案1 第 2.1 节，字段全量含预留） |
| admin Query | `productCouponBindings(productId: ID!): [ProductCouponBinding!]!` |
| admin Mutation | `createProductCouponBinding(input)` / `updateProductCouponBinding(input)` / `deleteProductCouponBinding(id)` |
| 服务 | `CouponBindingService.create / update / delete / toggleEnabled / syncTemplateScope / listByProduct` |

### 边界与错误处理

- **空态**：商品无绑券时商品页区块显示「暂无商品专属券」+ 新建入口
- **重复绑券去重**：同 productId + couponTemplateId 已存在时 `create` 抛 `UserInputError('Binding already exists')`，不产生重复行
- **租户隔离**：binding 按 channelId 过滤；跨租户同商品互不可见
- **模板删除联动**：删除 CouponTemplate 前检查是否有 binding，有则提示先解绑（或级联删除，采用「提示」防误删）

### 测试点（TDD）

1. `create` 建 binding 并同步 `template.scope='SKU'` + 单 variant 写 variantId
2. 多 variant 同步后 template.variantId 为 null
3. 重复绑券去重报错
4. `listByProduct` 只返回 enabled 且模板 claimable
5. 模板删除保护

---

## G3. 无详情页领券入口、无凭码兑换入口

### 现状分析

- C 端仅有 `claimCoupon(templateId)`（凭模板 id 领券），无「按商品维度展示可领券 + 一键领取」的入口，也无「输入兑换码领券」能力。
- 后果：运营希望「详情页直接领券」「不发券码、客户凭码自助领」的场景完全缺失。

### 解决方案

**新增三个 shop-api 接口（全部复用现有 `claimCoupon` 发放链路，保持校验/发券/扣库存一致）**：

| 接口 | 说明 |
|---|---|
| `productCoupons(productId: ID!): [CouponTemplate!]!` | 详情页可领券列表：`listByProduct` 结果去模板，含 enabled + claimable + 时间 + 限领 + newCustomerOnly 前置过滤 |
| `claimProductCoupon(bindingId: ID!): CustomerCoupon!` | 详情页领券：按 bindingId 找到模板 → `claimCoupon(ctx, templateId)` |
| `redeemCouponByCode(claimCode: String!): CustomerCoupon!` | 凭码兑换：同租户内 `claimCode` 唯一匹配模板 → 校验 channel 归属 → `claimCoupon(ctx, templateId)` |

**C 端 UI（nshop）**：
- 商品详情页新增「领券专区」积木块 `ProductCouponBlock`（按积木式 UI 规范挂载到 DetailClassic/DetailFloor/DetailDualBuy），展示券卡片（面额/门槛/有效期/角标 badgeText）+「立即领取」→ `claimProductCoupon` → 成功 toast + 跳转我的优惠券
- 我的优惠券页顶部内嵌「输入兑换码」输入框 + 兑换按钮 → `redeemCouponByCode`，错误码文案映射

### 边界与错误处理

- **claimCode 唯一性**：同租户（channel）内唯一；跨租户同码互不干扰（查询带 channel 过滤）
- **未登录**：领券/兑换前校验当前 customer，无则 `UserInputError('No customer for the current user')`（复用 claimCoupon 内校验）
- **错误码**：`Invalid claim code`（码不存在/已被停用）、`Coupon has expired`、`Per-user coupon limit reached`、`Coupon sold out`、`Coupon is for new customers only`（C 端映射中文文案）
- **已领取状态**：详情页领券卡片由 `myCoupons` 比对 code 判定已领，按钮变「已领取」禁用
- **兑换码与可领取开关独立**：`claimable=false + claimCode 有值` = 详情页不展示但可凭码领；`claimable=true` = 详情页可领，可同时支持凭码

### 测试点（TDD）

1. `productCoupons` 返回 enabled + claimable 模板，过滤 disabled/非 claimable
2. `claimProductCoupon` 领券成功 / bindingId 无效报错
3. `redeemCouponByCode` 正确码成功 / 错码报 `Invalid claim code` / 跨租户码不可用
4. 重复领取触发 perUserLimit
5. 详情页已领取状态判定

---

## G4. 缺「领取后 N 天有效」「仅限新客」等中国本地化玩法字段

### 现状分析

- `CouponTemplate` 仅有固定 `startsAt/endsAt` 时间窗，**无相对有效期**（领取后 N 天有效）与**人群限定**（仅新客可领可用）。
- 中国本地化高频玩法：新客立减券、领券后 7 天内有效券，当前均无法表达。

### 解决方案

**CouponTemplate 新增 4 个本期字段 + 1 个预留字段**：

| 字段 | 类型 | 语义 |
|---|---|---|
| `claimable` | bool 默认 true | 详情页领券入口开关（binding.enabled && claimable） |
| `claimCode` | varchar 可空 | 兑换码（非空 = 支持凭码兑换；同租户唯一） |
| `validDays` | int 可空 | 领取后 N 天有效；空 = 走固定 startsAt/endsAt |
| `newCustomerOnly` | bool 默认 false | 仅限新客（本租户无历史有效订单）可领可用 |
| `memberLevel` | varchar 可空 | 会员等级限定（**本期只建字段不开发逻辑，二期接入**） |

**validDays 实现**：`createUserCoupon` 生成用户券时计算 `expiredAt = claimedAt + validDays * 86400000`；结算校验 `coupon.expiredAt`（与固定 endsAt 二选一，取先到者）。

**newCustomerOnly 实现**（领券 + 结算双校验）：
- 领券（claimCoupon / claimProductCoupon / redeemCouponByCode）：该客户在本租户**历史有效订单数 > 0** → 拒绝领取
- 结算（coupon-promotion-condition）：同样判定，防止「领时新客、用时有单」的边界——以用券时点为准再次校验
- 统计口径：订单状态非 Cancelled 即计入有效历史订单

### 边界与错误处理

- **validDays 与 endsAt 并存**：`expiredAt = min(claimedAt + validDays, endsAt)`，先到先失效
- **newCustomerOnly 时点**：以领券/用券当前客户历史订单为准，不缓存领取时判定结果
- **兑换码与开关**：`claimable=false + claimCode` 仍可凭码领；`newCustomerOnly` 对三种领券入口统一生效
- **会员等级预留**：`memberLevel` 本期仅建字段与 admin 表单隐藏，不写校验分支

### 测试点（TDD）

1. `validDays=7` → 领取后第 8 天过期，结算拒绝；第 7 天内可用
2. `validDays` 与 `endsAt` 并存 → 取先到者
3. `newCustomerOnly=true` 且客户有历史订单 → 领券拒绝（`Coupon is for new customers only`）
4. 新客（无历史订单）→ 领券成功；下单后再用同券 → 结算拦截
5. 历史订单为 Cancelled → 不计入，仍视为新客

---

## 与方案1 的关系

- 本补充文档仅深化 4 个缺口的现状/方案/接口/边界/测试设计，**不新增实体与字段**（全部实体/字段已在方案1 第 2 节定义）。
- 实施按方案1 计划执行；本补充文档的测试点与边界将作为方案1 计划 A3/A4/A5/B2/B3 各任务的验收补充。
