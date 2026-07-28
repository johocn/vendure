# Operations P2 营销聚合模块设计

> 运营模块第二阶段（P2）：为 Coupon / FlashSale / GroupBuy 三个已存在的营销插件提供移动端统一管理界面。在 `@vendure/operations-plugin` 内扩展，复用 P1 的权限体系和插件骨架。

## 目标

- 运营人员在 vadmin 移动端创建/编辑/启停/删除闪购、拼团、优惠券活动
- 提供营销总览页，聚合展示 3 类活动状态
- 权限细分，每类活动独立管控
- 不修改 3 个营销插件源码，只通过 service 调用

## 范围

### 纳入
- Coupon / FlashSale / GroupBuy 三类营销活动的移动端完整 CRUD
- 营销总览页（聚合 3 类活动状态计数）
- 3 个新权限：ManageFlashSale / ManageGroupBuy / ManageCoupon

### 不纳入
- Vendure 原生 Promotion（促销规则）的管理（保留在 PC 端 admin-ui）
- 营销活动的效果分析报表（归 P1 dashboard 的 marketingMetrics）

## 架构

### 后端：扩展 operations-plugin

在 `@vendure/operations-plugin` 内新增 P2 代码，不新建插件：

```
packages/operations-plugin/src/
├── marketing/                          # P2 新增目录
│   ├── marketing-admin.resolver.ts     # 3 类营销活动的 admin-api resolver
│   ├── flash-sale.service.ts           # 封装 FlashSaleService 调用 + 权限校验
│   ├── group-buy.service.ts            # 封装 GroupBuyService 调用 + 权限校验
│   ├── coupon.service.ts               # 封装 CouponService 调用 + 权限校验
│   └── marketing-overview.service.ts   # 营销总览聚合（复用 P1 getMarketingMetrics 逻辑）
└── operations.plugin.ts                # 扩展 adminApiExtensions schema
```

### 依赖

operations-plugin/package.json 新增依赖：
- `@vendure/flash-sale-plugin`
- `@vendure/group-buy-plugin`
- `@vendure/coupon-plugin`

### Service 封装原则

每个 service 不重写业务逻辑，而是：
1. 通过 `injector.get(FlashSaleService)` 等获取现有 service
2. 在调用前做权限校验（`ctx.userHasPermissions([ManageFlashSale])`）
3. 对移动端不需要的字段做裁剪

### 前置修改：3 个插件的 service 导出

flash-sale-plugin 和 group-buy-plugin 的 `index.ts` 当前未导出 Service，需追加：
- `flash-sale-plugin/src/index.ts`：`export * from './flash-sale.service';`
- `group-buy-plugin/src/index.ts`：`export * from './group-buy.service';`
- coupon-plugin 已导出 `CouponService`，无需修改

### 前置修改：修复 P1 getMarketingMetrics BUG

`operations-dashboard.service.ts:242-279` 当前用 `e.enabled` 查询，但 `FlashSaleActivity`/`GroupBuyActivity` 实体只有 `status` 字段无 `enabled` 字段，导致 count 恒为 0。P2 实施时同步修复：
```ts
// 修复前（错误）
.where('e.enabled = :enabled', { enabled: true })
.andWhere('e.endAt >= :now', { now })
// 修复后（正确）
.where('e.status = :status', { status: 'active' })
.andWhere('e.startAt <= :now', { now })
.andWhere('e.endAt >= :now', { now })
```

## 后端 API

### GraphQL（方案 A：每类独立 API）

3 组 admin query/mutation（实际方法名对齐各插件 service）：

| 类型 | Query | Mutation |
|---|---|---|
| 闪购 | `flashSaleActivities(filter, page)` / `flashSaleActivity(id)` | `createFlashSale` / `updateFlashSale` / `deleteFlashSale` |
| 拼团 | `groupBuyActivities(filter, page)` / `groupBuyActivity(id)` | `createGroupBuy` / `updateGroupBuy` / `deleteGroupBuy` |
| 优惠券 | `coupons(filter, page)` / `coupon(id)` | `createCoupon` / `updateCoupon` / `deleteCoupon` / `enableCouponForChannel` / `disableCouponForChannel` |

注意：
- 闪购/拼团无 `toggleStatus` mutation（service 无此方法，状态由定时任务管理）；拼团可通过 `updateGroupBuy` 改 status 字段
- 优惠券无批量生成码 mutation（券码在用户 claimCoupon 时按需生成），详情页只展示已领取的码列表
- 优惠券的 `enableCouponForChannel`/`disableCouponForChannel` 用于租户启用/停用全局券

### 权限

新增 3 个 PermissionDefinition（在 delivery-plugin/constants.ts 注册，沿用 P1 模式）：
- `ManageFlashSale`
- `ManageGroupBuy`
- `ManageCoupon`

`operations-staff` 角色追加这 3 个权限；`manager`/`super-admin` 同步追加。

## 前端

### 页面清单（7 页，pkg-ops 子包内新增）

| 页面 | 路径 | 功能 | 权限 |
|---|---|---|---|
| 营销总览 | `pages/marketing/index.vue` | 3 类活动概览卡片 + 快捷入口 + 状态统计 | ManagePromotion（沿用，作总览入口） |
| 闪购列表 | `pages/flash-sale/index.vue` | 列表 + 状态筛选 + 分页 + 删除 | ManageFlashSale |
| 闪购详情 | `pages/flash-sale/detail.vue` | 基础表单（单商品/规格/价格/库存） | ManageFlashSale |
| 拼团列表 | `pages/group-buy/index.vue` | 同闪购列表结构 | ManageGroupBuy |
| 拼团详情 | `pages/group-buy/detail.vue` | 基础表单 + rewardRules JSON 编辑器 | ManageGroupBuy |
| 优惠券列表 | `pages/coupon/index.vue` | 列表 + 状态筛选 + 分页 + 删除 | ManageCoupon |
| 优惠券详情 | `pages/coupon/detail.vue` | 基础表单 + 适用范围 JSON + 渠道启停 + 码列表（只读） | ManageCoupon |

### 总览页设计

3 个卡片（闪购/拼团/优惠券），每个卡片显示：
- 进行中数量（绿色徽标）
- 即将开始数量（橙色徽标）
- 已结束数量（灰色徽标）
- 点击卡片跳转对应列表页

复用 P1 dashboard 的卡片样式，保持视觉一致。

### 表单策略（基础表单 + JSON）

字段设计对齐各插件实际实体字段（经卡点检查修正）：

**闪购详情页字段**（`FlashSaleActivity` 实体）：
- 基础表单：name / startAt / endAt / flashPrice / totalStock / limitPerUser / productId / variantId
- 只读展示：status / soldCount（由系统管理，不可编辑）
- 说明：闪购只支持单商品单规格（`productId`+`variantId`），无阶梯价/多规格

**拼团详情页字段**（`GroupBuyActivity` 实体）：
- 基础表单：name / description / startAt / endAt / targetCount / maxCount / groupPrice / productId / variantId / leaderDiscount / leaderRewardType / autoConfirm
- JSON 编辑器：`rewardRules`（团长奖励规则数组 `[{excessCount, rewardType, rewardValue}]`）
- 只读展示：status / currentCount
- 说明：字段名是 `targetCount`（非 groupSize）；无 `durationHours`，用 startAt+endAt 表达时间窗口

**优惠券详情页字段**（`Coupon` 实体）：
- 基础表单：name / description / couponType（fixed/percentage）/ discountValue / minSpend / maxDiscount / startAt / endAt / totalQuantity / limitPerUser / isNewUserOnly
- JSON 编辑器：`applicableProductIds`（适用商品 ID 数组）、`applicableCategoryIds`（适用分类 ID 数组）
- 渠道操作：`enableCouponForChannel`/`disableCouponForChannel` 按钮（租户启用/停用全局券）
- 码列表子区域：展示已领取的 `CouponCode` 列表（分页，只读，无批量生成）

### JSON 编辑器组件

新增 `pkg-ops/components/JsonEditor.vue`：
- textarea 输入 + 实时校验 + 格式化按钮
- 只读模式（详情查看时）
- 复用于 3 个详情页

### 列表页通用功能

沿用 P1 修复模式，4 个列表页（含营销总览的列表行为）均实现：
- `watch(filter)` 触发重置 page=1 并重新加载
- `onReachBottom` 上拉加载更多（pageSize=20）
- 列表项删除按钮（`uni.showModal` 二次确认 + 本地移除）
- 只用 `onShow` 触发加载（避免 onMounted+onShow 重复请求）

### shortcuts.ts 更新

`ops-promo` 改为 `enabled: true`，route 指向 `/pkg-ops/pages/marketing/index`。

### pages.json 更新

在 pkg-ops subPackage 的 pages 数组追加 7 页。

## 测试与验收

### 测试账号

新增 `e:\code\vendure\reset-marketing-pwd.js`，创建 `marketing1@zhao.test / a963963`（operations-staff 角色，含 3 个新权限）。沿用 reset-operations-pwd.js 模式（roleIds 而非 roleCodes）。

### E2E 测试脚本

新增 `e:\code\vendure\test-marketing-flow.js`，沿用 P1 的 `test-operations-flow.js` 模式（node-fetch + Bearer token from header）。

### 测试用例（10 组）

| # | 测试组 | 断言要点 |
|---|---|---|
| 1 | 角色权限同步 | operations-staff 含 ManageFlashSale/ManageGroupBuy/ManageCoupon |
| 2 | 营销总览 | 返回 3 类活动计数（进行中/即将开始/已结束），验证 P1 getMarketingMetrics BUG 已修复（count 不为 0） |
| 3 | 闪购 CRUD | 创建（含 productId/variantId/flashPrice/totalStock）→查询→更新（改 name/limitPerUser）→列表筛选→删除 |
| 4 | 闪购状态只读 | 验证 status/soldCount 不可通过 update 修改（闪购 status 由定时任务管理） |
| 5 | 拼团 CRUD | 创建（含 targetCount/groupPrice/leaderDiscount/rewardRules）→查询→更新→删除 |
| 6 | 拼团 rewardRules JSON | 创建含 rewardRules JSON→查询返回结构正确→非法 JSON 报错 |
| 7 | 优惠券 CRUD | 创建（含 couponType/discountValue/applicableProductIds）→查询→更新→删除 |
| 8 | 优惠券渠道启停 | 创建 coupon→enableCouponForChannel→disableCouponForChannel |
| 9 | 权限隔离 | 无 ManageFlashSale 的角色调用 createFlashSale → FORBIDDEN |
| 10 | 数据清理 | 测试创建的活动全部删除，不影响后续运行 |

### 验收标准

- 10 组测试全通过（0 失败）
- 前端 7 页面无编译错误，vadmin dev server 正常
- 列表页筛选/分页/删除功能正常
- 总览页 3 卡片跳转正常

## 非功能约束

- 不修改 3 个营销插件（coupon/flash-sale/group-buy）的源码，只通过 service 调用
- operations-plugin 构建无 TypeScript 错误
- 复用 P1 的 RoleSyncService 自动同步 3 个新权限

## 测试数据依赖

- 闪购/拼团需商品 variant，复用 `test-sales-flow.js` 已创建的商品
- 优惠券无外部数据依赖

## 卡点检查修正记录（实施前）

经实际验证 3 个营销插件的源码，对原设计做以下修正：

1. **闪购无 tiers/productVariantIds**：`FlashSaleActivity` 只支持单 `productId`+`variantId`+`flashPrice`+`totalStock`，移除阶梯价和多规格假设
2. **拼团字段名修正**：`groupSize` → `targetCount`；移除 `durationHours`（用 startAt+endAt）；`leaderReward` 拆为 `leaderDiscount`+`leaderRewardType`+`rewardRules`
3. **优惠券字段修正**：`conditions` → `applicableProductIds`+`applicableCategoryIds`；移除 `generateCouponCodes`（无此方法，券码按需生成）
4. **移除 toggleStatus**：3 个插件均无此方法，闪购 status 由定时任务管理，拼团可通过 update 改 status
5. **service 导出补全**：flash-sale/group-buy 的 index.ts 需追加 service 导出
6. **P1 getMarketingMetrics BUG**：`e.enabled` 查询不存在的列，改为 `e.status = 'active'` + 时间范围过滤
7. **权限装饰器对齐**：3 个插件原有 resolver 权限与 ManagePromotion 不一致（flash-sale/group-buy 无 @Allow，coupon 用 ReadSettings），P2 在 operations-plugin 新建独立 resolver 统一用细分权限装饰，不修改原插件 resolver

## 偏差与改进记录

实施过程中如发现设计偏差，记录于此：
- （实施时填写）
