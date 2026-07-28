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
3. 对移动端不需要的字段做裁剪（如闪购的 promotionConditions JSON 不在列表返回）

## 后端 API

### GraphQL（方案 A：每类独立 API）

3 组 admin query/mutation：

| 类型 | Query | Mutation |
|---|---|---|
| 闪购 | `flashSaleActivities(filter, page)` / `flashSaleActivity(id)` | `createFlashSale` / `updateFlashSale` / `deleteFlashSale` / `toggleFlashSaleStatus` |
| 拼团 | `groupBuyActivities(filter, page)` / `groupBuyActivity(id)` | `createGroupBuy` / `updateGroupBuy` / `deleteGroupBuy` / `toggleGroupBuyStatus` |
| 优惠券 | `coupons(filter, page)` / `coupon(id)` / `couponCodes(couponId, page)` | `createCoupon` / `updateCoupon` / `deleteCoupon` / `toggleCouponStatus` / `generateCouponCodes` |

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
| 闪购列表 | `pages/flash-sale/index.vue` | 列表 + 状态筛选 + 分页 + 启停/删除 | ManageFlashSale |
| 闪购详情 | `pages/flash-sale/detail.vue` | 基础表单 + 阶梯价 JSON 编辑器 | ManageFlashSale |
| 拼团列表 | `pages/group-buy/index.vue` | 同闪购列表结构 | ManageGroupBuy |
| 拼团详情 | `pages/group-buy/detail.vue` | 基础表单 + 成团规则 JSON 编辑器 | ManageGroupBuy |
| 优惠券列表 | `pages/coupon/index.vue` | 列表 + 状态筛选 + 分页 | ManageCoupon |
| 优惠券详情 | `pages/coupon/detail.vue` | 基础表单 + 适用范围 JSON + 码列表 + 批量生成 | ManageCoupon |

### 总览页设计

3 个卡片（闪购/拼团/优惠券），每个卡片显示：
- 进行中数量（绿色徽标）
- 即将开始数量（橙色徽标）
- 已结束数量（灰色徽标）
- 点击卡片跳转对应列表页

复用 P1 dashboard 的卡片样式，保持视觉一致。

### 表单策略（基础表单 + JSON）

**闪购详情页字段**：
- 基础表单：name / enabled / startAt / endAt / limitPerUser / description
- JSON 编辑器：`tiers`（阶梯价数组 `[{quantity, price}]`）、`productVariantIds`（参与商品 ID 数组）

**拼团详情页字段**：
- 基础表单：name / enabled / startAt / endAt / groupSize / durationHours / description
- JSON 编辑器：`productVariantIds`、`leaderReward`（团长奖励规则）

**优惠券详情页字段**：
- 基础表单：name / enabled / startAt / endAt / discountValue / minSpend
- JSON 编辑器：`conditions`（适用范围规则）
- 码管理子区域：码列表（分页）+ 批量生成按钮（输入数量，调用 generateCouponCodes）

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
| 2 | 营销总览 | 返回 3 类活动计数（进行中/即将开始/已结束） |
| 3 | 闪购 CRUD | 创建→查询→更新（改 name/limitPerUser）→列表筛选→启停→删除 |
| 4 | 闪购阶梯价 JSON | 创建含 tiers JSON→查询返回结构正确→非法 JSON 报错 |
| 5 | 拼团 CRUD | 创建（含 groupSize/durationHours）→查询→更新→删除 |
| 6 | 优惠券 CRUD | 创建→查询→更新→删除 |
| 7 | 优惠券码批量生成 | 创建 coupon→generateCouponCodes(5)→couponCodes 列表返回 5 条 |
| 8 | 权限隔离 | 无 ManageFlashSale 的角色调用 createFlashSale → FORBIDDEN |
| 9 | 状态流转 | 闪购 created→enabled→disabled；coupon 未开始→进行中→已结束（按 startAt/endAt） |
| 10 | 数据清理 | 测试创建的活动全部软删除/硬删除，不影响后续运行 |

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

## 偏差与改进记录

实施过程中如发现设计偏差，记录于此：
- （实施时填写）
