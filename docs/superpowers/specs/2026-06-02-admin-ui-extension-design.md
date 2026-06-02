# Admin UI 扩展设计文档

> 日期：2026-06-02
> 版本：v1
> 状态：已确认

## 1. 概述

为 12 个 CJK 本地化插件中的 7 个提供完整的 React Dashboard 管理界面扩展。基于 Vendure v3.6.x 新版 React Dashboard 的 `defineDashboardExtension()` API，采用各插件内嵌 `dashboard/` 目录的组织方式。

## 2. 架构决策

### 2.1 扩展框架

使用 Vendure v3.5+ 新版 React Dashboard（非旧版 Angular Admin UI）。扩展机制：

- 插件通过 `@VendurePlugin({ dashboard: './dashboard/index.tsx' })` 声明 UI 扩展入口
- 入口文件调用 `defineDashboardExtension()` 注册所有扩展
- Vite 插件自动从 Vendure 配置发现并编译所有 dashboard 扩展

### 2.2 代码组织

每个需要 UI 的插件在其包内创建 `dashboard/` 目录：

```
packages/<plugin>/
  src/plugin.ts              ← 添加 dashboard 属性
  dashboard/
    index.tsx                ← defineDashboardExtension()
    tsconfig.json            ← TypeScript 配置
    <feature>-list.tsx       ← 列表页组件
    <feature>-detail.tsx     ← 详情页组件
    <feature>-blocks.tsx     ← PageBlock 组件
```

### 2.3 不需要 UI 的插件

以下 5 个插件仅使用 CustomFields 自动渲染，无需自定义 UI：

- alipay-plugin（PaymentMethodHandler args 配置）
- wechatpay-plugin（PaymentMethodHandler args 配置）
- oss-plugin（AssetStorageStrategy 配置）
- phone-auth-plugin（AuthenticationStrategy 配置）
- wechat-auth-plugin（AuthenticationStrategy 配置）

## 3. 各插件 UI 扩展详细设计

### 3.1 CjkPlugin — 自提点管理 + 优惠券叠加配置

#### 独立 CRUD 页面

**自提点列表页** `/pickup-locations`

- 使用 `ListPage` 组件
- GraphQL 查询：`pickupLocations`
- 列：id / name / type / address / phoneNumber / businessHours / partner
- 导航项：放在 Settings 区域，id=`pickup-locations`

**自提点详情页** `/pickup-locations/$id`

- 使用 `DetailPage` + `useDetailPage()` hook
- GraphQL 查询：`pickupLocation(id: $id)`
- GraphQL 变更：`createPickupLocation` / `updatePickupLocation` / `deletePickupLocation`
- 表单字段：name / type(select: store/pickup_point) / address / phoneNumber / businessHours / coordinates / partner

#### 现有页面扩展

**Channel 详情表单扩展：**

- pageId: `channel-detail`
- 字段：couponStackable / maxStackableCount（来自 tenant-channel-custom-fields）

**Promotion 详情表单扩展：**

- pageId: `promotion-detail`
- 字段：stackable / stackableGroup / maxStackableWith（来自 promotion-custom-fields）

### 3.2 OrderTimeoutPlugin — Channel 超时配置

#### 现有页面扩展

**Channel 详情表单扩展：**

- pageId: `channel-detail`
- 字段：orderTimeoutMinutes（来自 order-timeout-channel-custom-fields）
- 无需独立页面

### 3.3 InvoicePlugin — 订单发票信息

#### 现有页面扩展

**Order 详情页 PageBlock：**

- pageId: `order-detail`
- blockId: `invoice-info`
- 位置：side 列，`main-form` 之后
- 条件渲染：仅当 `invoiceRequired = true` 时显示
- 展示字段：invoiceType / invoiceTitle / invoiceTaxNumber / invoiceEmail / invoiceCompanyAddress / invoiceCompanyPhone / invoiceBankName / invoiceBankAccount

### 3.4 LogisticsPlugin — 物流信息 + 发货策略配置

#### 现有页面扩展

**Order 详情页 PageBlock（物流追踪卡片）：**

- pageId: `order-detail`
- blockId: `logistics-tracking`
- 位置：side 列，`invoice-info` 之后
- 展示字段：trackingNumber / carrier / carrierCode / shippingNote
- 当 trackingNumber 有值时显示物流追踪链接

**Channel 详情表单扩展：**

- pageId: `channel-detail`
- 字段：stockLocationPriority / shippingStrategy（来自 logistics-channel-custom-fields）

### 3.5 GroupBuyPlugin — 拼团活动管理

#### 独立 CRUD 页面

**拼团活动列表页** `/group-buy-activities`

- 使用 `ListPage` 组件
- GraphQL 查询：`groupBuyActivities`
- 列：id / name / status(badge) / targetCount / currentCount / maxCount / groupPrice / startAt / endAt
- 状态筛选：active / completed / expired
- 导航项：放在"营销"区域，id=`group-buy-activities`

**拼团活动详情页** `/group-buy-activities/$id`

- 使用 `DetailPage` + `useDetailPage()` hook
- GraphQL 查询：`groupBuyActivity(id: $id)`
- GraphQL 变更：`createGroupBuyActivity` / `updateGroupBuyActivity` / `deleteGroupBuyActivity`
- 表单字段：name / description / targetCount / maxCount / startAt / endAt / groupPrice / leaderDiscount / leaderRewardType / autoConfirm / allowJoinAfterComplete / productId / variantId

#### 现有页面扩展

**Order 详情页 PageBlock（拼团信息卡片）：**

- pageId: `order-detail`
- blockId: `group-buy-info`
- 位置：side 列，`logistics-tracking` 之后
- 条件渲染：仅当 `groupBuyActivityId` 有值时显示
- 展示字段：groupBuyActivityId（链接到拼团详情页）/ groupBuyIsLeader(badge)

### 3.6 FlashSalePlugin — 秒杀活动管理

#### 独立 CRUD 页面

**秒杀活动列表页** `/flash-sale-activities`

- 使用 `ListPage` 组件
- GraphQL 查询：`flashSaleActivities`
- 列：id / name / status(badge) / flashPrice / totalStock / soldCount / limitPerUser / startAt / endAt
- 状态筛选：upcoming / active / ended
- 导航项：放在"营销"区域，id=`flash-sale-activities`

**秒杀活动详情页** `/flash-sale-activities/$id`

- 使用 `DetailPage` + `useDetailPage()` hook
- GraphQL 查询：`flashSaleActivity(id: $id)`
- GraphQL 变更：`createFlashSaleActivity` / `updateFlashSaleActivity` / `deleteFlashSaleActivity`
- 表单字段：name / startAt / endAt / flashPrice / totalStock / limitPerUser / productId / variantId

#### 现有页面扩展

**Order 详情页 PageBlock（秒杀信息卡片）：**

- pageId: `order-detail`
- blockId: `flash-sale-info`
- 位置：side 列，`group-buy-info` 之后
- 条件渲染：仅当 `flashSaleActivityId` 有值时显示
- 展示字段：flashSaleActivityId（链接到秒杀详情页）/ flashSaleStartAt / flashSaleEndAt

### 3.7 DistributionPlugin — 分销商 + 佣金 + 提现管理

#### 独立 CRUD 页面

**分销商列表页** `/distributors`

- 使用 `ListPage` 组件
- GraphQL 查询：`distributors`
- 列：id / referralCode / customerId / parentId / level / status(badge) / totalEarnings / availableBalance / frozenBalance
- 状态筛选：active / frozen / pending
- 导航项：放在"分销管理"区域，id=`distributors`

**分销商详情页** `/distributors/$id`

- 使用 `DetailPage` + `useDetailPage()` hook
- GraphQL 查询：`distributors`（filter by id）
- 操作按钮：approveDistributor / freezeDistributor
- 展示字段：referralCode / customerId / parentId / level / status / totalEarnings / availableBalance / frozenBalance

**佣金记录列表页** `/commission-records`

- 使用 `ListPage` 组件（只读）
- GraphQL 查询：`commissionRecords`
- 列：id / distributorId / orderId / commissionType / commissionRate / orderAmount / commissionAmount / status(badge) / settledAt / createdAt
- 导航项：放在"分销管理"区域，id=`commission-records`

**提现申请列表页** `/withdrawal-requests`

- 使用 `ListPage` 组件
- GraphQL 查询：`withdrawalRequests`
- 列：id / distributorId / amount / method / accountInfo / status(badge) / reviewedAt / paidAt / createdAt
- 操作按钮：approveWithdrawal / rejectWithdrawal / markWithdrawalPaid
- 导航项：放在"分销管理"区域，id=`withdrawal-requests`

#### 现有页面扩展

**Channel 详情表单扩展：**

- pageId: `channel-detail`
- 字段：directCommissionRate / indirectCommissionRate / minWithdrawalAmount / commissionSettlementDays / distributionEnabled

**Customer 详情表单扩展：**

- pageId: `customer-detail`
- 字段：referralCode / referredBy

## 4. 导航结构

```
营销 (Marketing)           ← 新增区域, order: 600
  ├─ 拼团活动              id=group-buy-activities, icon=Users, requiresPermission=ReadPromotion
  └─ 秒杀活动              id=flash-sale-activities, icon=Zap, requiresPermission=ReadPromotion

分销管理 (Distribution)    ← 新增区域, order: 700
  ├─ 分销商                id=distributors, icon=UserCheck, requiresPermission=ReadCustomer
  ├─ 佣金记录              id=commission-records, icon=Coins, requiresPermission=ReadCustomer
  └─ 提现申请              id=withdrawal-requests, icon=Wallet, requiresPermission=ReadCustomer

设置 (Settings)            ← 已有区域，追加
  └─ 自提点管理            id=pickup-locations, icon=MapPin, requiresPermission=ReadSettings
```

## 5. 技术规范

### 5.1 依赖

所有 dashboard 扩展代码从 `@vendure/dashboard` 导入组件和 API：

```tsx
import { defineDashboardExtension, ListPage, DetailPage, useDetailPage, Button, ... } from '@vendure/dashboard';
```

### 5.2 GraphQL 查询

使用 `graphql()` 模板标签定义类型安全的查询：

```tsx
import { graphql } from '@/graphql/graphql';

const getGroupBuyActivities = graphql(`
  query GetGroupBuyActivities($options: Json) {
    groupBuyActivities(options: $options) {
      items { id name status targetCount currentCount ... }
      totalItems
    }
  }
`);
```

### 5.3 i18n

使用 `@lingui/react/macro` 的 `<Trans>` 组件：

```tsx
import { Trans } from '@lingui/react/macro';
<Trans>Group Buy Activities</Trans>
```

### 5.4 tsconfig.json

每个 dashboard 目录需要独立的 tsconfig.json，配置路径别名：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "paths": {
      "@/*": ["./../*/src/app/*"],
      "@/vdb/*": ["./node_modules/@vendure/dashboard/src/lib/*"],
      "@/graphql/*": ["./node_modules/@vendure/dashboard/src/app/graphql/*"]
    }
  }
}
```

### 5.5 插件注册

每个插件的 `plugin.ts` 需要添加 `dashboard` 属性：

```ts
@VendurePlugin({
  // ...existing config
  dashboard: './dashboard/index.tsx',
})
```

## 6. 扩展点汇总

| 插件 | 独立路由 | PageBlocks | DetailForms | NavSections |
|------|----------|------------|-------------|-------------|
| CjkPlugin | 2（自提点列表+详情） | - | Channel + Promotion | - |
| OrderTimeoutPlugin | - | - | Channel | - |
| InvoicePlugin | - | 1（Order 发票卡片） | - | - |
| LogisticsPlugin | - | 1（Order 物流卡片） | Channel | - |
| GroupBuyPlugin | 2（拼团列表+详情） | 1（Order 拼团卡片） | - | 营销 |
| FlashSalePlugin | 2（秒杀列表+详情） | 1（Order 秒杀卡片） | - | 营销 |
| DistributionPlugin | 4（分销商+佣金+提现列表+详情） | - | Channel + Customer | 分销管理 |

**总计：** 10 个独立路由页面、3 个 PageBlock、4 个 DetailForm 扩展、2 个新导航区域
