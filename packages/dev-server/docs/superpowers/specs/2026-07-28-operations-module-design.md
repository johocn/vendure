# Operations Module Design (P1: Dashboard + CMS)

**Date:** 2026-07-28
**Status:** Approved
**Scope:** P1 — Dashboard (聚合统计) + CMS (单表多态内容管理)
**Out of scope:** P2 营销聚合（Coupon/FlashSale/GroupBuy/Promotion），P3 会员/消息群发

---

## 1. 背景与目标

### 1.1 业务背景
Vendure 移动后端已完成 4 个业务模块（delivery / sales / inventory / customer-service），MODULE_CONFIGS 中 `ops` 模块（sort:50）尚未实现，shortcuts.ts 中 ops 相关项为占位（`enabled: false`，`route: /pkg-ops/pages/placeholder`）。

运营人员目前缺乏统一的移动端工作台：
- 无法在手机端查看运营关键指标（订单/GMV/配送/库存/售后/营销）
- 无法在手机端管理首页 Banner、推荐位、公告、楼层等 CMS 内容

### 1.2 本次目标
1. **数据看板**：移动端 1 页聚合 6 类运营指标 + 销售趋势折线图 + 品类 TOP10 柱状图
2. **CMS 内容管理**：4 类内容（Banner/Recommendation/Notice/Floor）的 CRUD + 自动上下线 + shop-api 公开查询
3. **权限隔离**：operations-staff 角色按内容类型细分权限（ManageBanner/Recommendation/Notice/Floor）
4. **前端集成**：vadmin 中 9 页（1 看板 + 4 类型 × 2 列表/详情）

### 1.3 非目标（YAGNI 排除）
- ❌ 营销活动管理页（P2 spec）
- ❌ 优惠券/闪购/拼团管理页（P2 spec）
- ❌ 消息群发（P3 spec）
- ❌ 会员等级管理（P3 spec）
- ❌ CMS H5 预览页（仅 JSON 预览）
- ❌ 看板 WebSocket 实时推送（进入加载 + 下拉刷新足够）
- ❌ 看板数据物化快照（实时聚合足够）
- ❌ 多语言 CMS 内容（本次单语言）

---

## 2. 架构

### 2.1 插件位置与命名
- **npm 包名**：`@vendure/operations-plugin`
- **目录**：`e:\code\vendure\packages\operations-plugin\`
- **Plugin 类名**：`OperationsPlugin`
- **模块 code**：`ops`（保持不变，与 shortcuts.ts 已有前缀对齐）
- **前端目录**：`e:\code\vadmin\src\pkg-operations\`

### 2.2 目录结构

```
packages/operations-plugin/
├── package.json / tsconfig.json
├── src/
│   ├── index.ts                          # Barrel exports
│   ├── constants.ts                      # 权限、ContentType 枚举、ROLE_PERMISSIONS_MAP、LOW_STOCK_THRESHOLD
│   ├── role-sync.ts                      # RoleSyncService（增量同步）
│   ├── entities/
│   │   └── content-item.entity.ts        # ContentItem 单表多态实体（含软删除）
│   ├── operations-dashboard.service.ts   # 看板聚合 service（实时调用各模块 service / 直查表）
│   ├── content.service.ts                # CMS CRUD + 自动上下线 Job
│   ├── operations-admin.resolver.ts      # admin-api resolver（看板 + CMS 管理）
│   ├── operations-shop.resolver.ts       # shop-api resolver（CMS 公开查询）
│   └── operations.plugin.ts              # Plugin 入口（SDL + config + bootstrap）
```

### 2.3 修改的现有文件

| 文件 | 修改内容 |
|---|---|
| `packages/delivery-plugin/src/constants.ts` | 新增 4 个权限：ManageBanner/Recommendation/Notice/Floor；扩展 operations-staff / manager / super-admin 角色权限；MODULE_CONFIGS.ops.enabled: true，entryPath: /pkg-operations/pages/dashboard/index |
| `packages/dev-server/dev-config.ts` | 注册 `OperationsPlugin.init()` |
| `vadmin/src/pages.json` | 注册 `pkg-operations/pages` 子包 |
| `vadmin/src/config/shortcuts.ts` | 更新 ops shortcuts（5 项 placeholder → actual，enabled: true） |

### 2.4 架构边界
- OperationsPlugin **不依赖** inventory-plugin / delivery-plugin / customer-service-plugin 的实体
- 看板聚合通过原生 TypeORM QueryBuilder 直查表（避免循环依赖各插件 service）
- CMS 实体独立，无外键关联其他业务实体
- shop-api resolver 仅暴露 CMS 查询，不暴露看板（看板仅 admin）

---

## 3. 权限与角色

### 3.1 权限定义
在 `delivery-plugin/src/constants.ts` 扩展 `DeliveryPermissions`：

```typescript
export const DeliveryPermissions = {
  // ... 原有权限 ...
  ManageBanner: 'ManageBanner',
  ManageRecommendation: 'ManageRecommendation',
  ManageNotice: 'ManageNotice',
  ManageFloor: 'ManageFloor',
} as const;

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // ... 原有描述 ...
  ManageBanner: 'Banner 轮播管理',
  ManageRecommendation: '推荐位管理',
  ManageNotice: '公告/弹窗管理',
  ManageFloor: '首页楼层管理',
};
```

### 3.2 角色权限映射（ROLE_PERMISSIONS_MAP）

```typescript
'operations-staff': [
    'Authenticated',
    'ViewDashboard',
    'ManageBanner',
    'ManageRecommendation',
    'ManageNotice',
    'ManageFloor',
    'ManagePromotion',      // 原有（本次 spec 不实现营销页，权限保留以便 P2 接入）
    'ManageContent',        // 原有（保留以便 P2 接入）
],
// manager 和 super-admin 末尾追加 4 个新权限
'manager': [..., 'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor'],
'super-admin': [..., 'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor', 'SuperAdmin'],
```

### 3.3 权限使用矩阵

| API / 页面 | 权限 | 角色 |
|---|---|---|
| 看板 admin-api（dashboardOverview/salesTrend/categoryTop） | `ViewDashboard` | operations-staff, manager, super-admin |
| Banner CRUD admin-api | `ManageBanner` | operations-staff, manager, super-admin |
| Recommendation CRUD admin-api | `ManageRecommendation` | 同上 |
| Notice CRUD admin-api | `ManageNotice` | 同上 |
| Floor CRUD admin-api | `ManageFloor` | 同上 |
| CMS shop-api（publishedContent） | 无（公开） | 任意访问者 |

### 3.4 权限同步流程
1. OperationsPlugin.onApplicationBootstrap → RoleSyncService.syncRoles()
2. RoleSyncService.init(injector) 注入 TransactionalConnection + ChannelService
3. 遍历 ROLE_PERMISSIONS_MAP，对每个角色：
   - 不存在则创建（channels = [defaultChannel]）
   - 已存在则对 permissions 做并集运算后保存（增量补绑，不覆盖现有权限）

---

## 4. 数据模型

### 4.1 ContentItem 实体（单表多态 + 软删除）

```typescript
// packages/operations-plugin/src/entities/content-item.entity.ts
import { Channel, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToMany, JoinTable, Index } from 'typeorm';

export enum ContentType {
    Banner = 'Banner',
    Recommendation = 'Recommendation',
    Notice = 'Notice',
    Floor = 'Floor',
}

@Entity()
export class ContentItem extends VendureEntity {
    constructor(input?: DeepPartial<ContentItem>) {
        super(input);
    }

    @Column({ type: 'varchar' }) type: ContentType;

    @Index()
    @Column() code: string;                    // 业务编码（如 'home_banner_top'），唯一约束 (code, channel, deletedAt)

    @Column() name: string;                    // 运营命名（如 '首页顶部轮播'）

    @Column({ default: true }) enabled: boolean;

    @Index()
    @Column({ default: 0 }) sort: number;

    @Index()
    @Column({ default: 'home' }) position: string;  // 页面位置编码（home/category/...）

    @Column({ type: 'timestamp', nullable: true }) startAt?: Date;

    @Column({ type: 'timestamp', nullable: true }) endAt?: Date;

    @Column({ type: 'jsonb', nullable: true }) data?: any;
    // Banner:          { imageUrl, linkUrl, linkType }
    // Recommendation:  { itemType: 'product'|'collection'|'link', itemId, linkUrl, imageUrl }
    // Notice:          { content, popup: boolean, popupImageUrl?: string }
    // Floor:           { title, layout: 'grid'|'carousel'|'list', items: [{itemId, imageUrl, linkUrl}] }

    @Column({ nullable: true }) staffId?: string;

    @Column({ type: 'timestamp', nullable: true }) publishedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) unpublishedAt?: Date;

    // 软删除字段
    @Index()
    @Column({ type: 'timestamp', nullable: true }) deletedAt?: Date;
    @Column({ nullable: true }) deletedBy?: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

### 4.2 字段设计要点
- **强类型字段**：可索引、所有类型共用（type/code/position/enabled/sort/startAt/endAt）
- **JSON 字段**：差异化内容存 `data`，由 service 层按 type 校验结构
- **唯一约束**：`UNIQUE(code, channel_id, deletedAt)` — 同一渠道下未删除的 code 不重复；删除后可重建同 code
- **软删除**：`deletedAt` 标记删除时间，`deletedBy` 记录操作人；所有查询默认加 `deletedAt IS NULL`
- **时间审计**：startAt/endAt 配合 Job 自动上下线；publishedAt/unpublishedAt 记录实际生效时间

### 4.3 自动上下线 Job
- **Job 名**：`operations-content-lifecycle`
- **频率**：每 60 秒执行一次（Vendure JobQueue）
- **上线逻辑**：查询 `enabled=true AND startAt <= now() AND publishedAt IS NULL AND deletedAt IS NULL` → 设置 `publishedAt = now()`
- **下线逻辑**：查询 `enabled=true AND endAt <= now() AND unpublishedAt IS NULL AND deletedAt IS NULL` → 设置 `enabled=false, unpublishedAt = now()`
- **错误处理**：单条失败记录错误日志，继续处理下一条

---

## 5. Service 层

### 5.1 OperationsDashboardService（看板聚合，实时查询）

```typescript
// packages/operations-plugin/src/operations-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';

@Injectable()
export class OperationsDashboardService {
    constructor(private connection: TransactionalConnection) {}

    // ===== 6 类指标卡片 =====

    /** 订单/销售指标：今日订单数、GMV、同比环比、待处理订单数 */
    async getSalesMetrics(ctx: RequestContext, range: 'today'|'yesterday'|'week'|'month') {
        // 查询 order 表，按 createdAt 过滤时间范围
        // status IN (Paid, Shipped, Delivered, PartiallyShipped) 计为有效订单
        // GMV = SUM(totalWithTax)
        // 同比 = 与上一同等长度时段对比
        // 待处理数 = status IN (AddingItems, ArrangingPayment)
    }

    /** 配送指标：待配送、配送中、已完成、异常 */
    async getDeliveryMetrics(ctx: RequestContext, range) {
        // 查询 order 表，按 customFields.deliveryStatus 分组统计
        // 依赖 delivery-plugin 写入的 order.customFields.deliveryStatus
    }

    /** 客户/会员指标：今日新客、累计会员数、会员等级分布 */
    async getCustomerMetrics(ctx: RequestContext, range) {
        // 查询 customer 表：今日新客 = createdAt 在范围内
        // 累计会员数 = COUNT(*)
        // 等级分布 = GROUP BY customFields.memberLevelId（依赖 member-level-plugin）
    }

    /** 库存指标：低库存预警、待入库/出库/调拨/盘点单数 */
    async getInventoryMetrics(ctx: RequestContext) {
        // 查询 stock_level 表：低库存 = stockOnHand <= LOW_STOCK_THRESHOLD
        // 查询 inventory-plugin 的 4 个订单实体：state='Pending' 计数
    }

    /** 售后/异常指标：待处理售后单、异常订单数 */
    async getAfterSalesMetrics(ctx: RequestContext, range) {
        // 查询 after_sales_request 表（after-sales-plugin）：state='pending' 计数
        // 异常订单数 = order.customFields.deliveryStatus = 'exception'
    }

    /** 营销活动指标：运行中闪购/拼团/优惠券领取量 */
    async getMarketingMetrics(ctx: RequestContext) {
        // 查询 flash_sale_activity 表：enabled=true AND endAt >= now()
        // 查询 group_buy_activity 表：同上
        // 查询 coupon 表 + coupon_code 表：coupon.enabled=true，领取量 = COUNT(coupon_code WHERE claimedAt IS NOT NULL)
    }

    // ===== 趋势图表 =====

    /** 近 7/30 日销售趋势：返回 [{date, orderCount, gmv}] */
    async getSalesTrend(ctx: RequestContext, days: 7 | 30) {
        // 查询 order 表，按 DATE(createdAt) 分组
        // 返回 [{date: '2026-07-01', orderCount: 12, gmv: 5800}, ...]
    }

    /** 品类销售 TOP10：返回 [{categoryName, gmv, orderCount}] */
    async getCategoryTop(ctx: RequestContext, days: 7 | 30) {
        // 查询 order_line JOIN product_variant JOIN product JOIN product_category
        // 按 category 分组，SUM(linePriceWithTax)
        // ORDER BY gmv DESC LIMIT 10
    }

    // ===== 看板聚合入口 =====

    /** 一次返回看板首页所有卡片数据（容错：单子模块失败返回 null） */
    async getDashboardOverview(ctx: RequestContext, range) {
        const safeRun = async (fn, key) => {
            try { return await fn(); }
            catch (e) { Logger.warn(`Dashboard ${key} failed: ${e.message}`, 'OperationsDashboard'); return null; }
        };
        const [sales, delivery, customer, inventory, afterSales, marketing] = await Promise.all([
            safeRun(() => this.getSalesMetrics(ctx, range), 'sales'),
            safeRun(() => this.getDeliveryMetrics(ctx, range), 'delivery'),
            safeRun(() => this.getCustomerMetrics(ctx, range), 'customer'),
            safeRun(() => this.getInventoryMetrics(ctx), 'inventory'),
            safeRun(() => this.getAfterSalesMetrics(ctx, range), 'afterSales'),
            safeRun(() => this.getMarketingMetrics(ctx), 'marketing'),
        ]);
        return { sales, delivery, customer, inventory, afterSales, marketing };
    }
}
```

### 5.2 ContentService（CMS CRUD + 自动上下线）

```typescript
// packages/operations-plugin/src/content.service.ts
import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { ContentItem, ContentType } from './entities/content-item.entity';

@Injectable()
export class ContentService {
    constructor(private connection: TransactionalConnection) {}

    // ===== CRUD =====

    async createContentItem(ctx, input): Promise<ContentItem> {
        // 1. 校验 data 结构与 type 匹配（validateDataByType）
        // 2. 校验 (code, channelId, deletedAt IS NULL) 唯一
        // 3. 保存
    }

    async updateContentItem(ctx, id, input): Promise<ContentItem> {
        // 仅 enabled/name/sort/data/startAt/endAt/position 可更新；type 不可改
        // 查询时加 deletedAt IS NULL
    }

    async deleteContentItem(ctx, id): Promise<boolean> {
        // 软删除：设置 deletedAt = now(), deletedBy = ctx.activeUserId
        // 返回 true
    }

    async findContentItems(ctx, options: {
        type?: ContentType;
        position?: string;
        enabled?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: ContentItem[]; totalItems: number }> {
        // 支持按 type/position/enabled 过滤 + 分页
        // 默认加 deletedAt IS NULL
    }

    async findOneContentItem(ctx, id: ID): Promise<ContentItem | null> {
        return this.connection.getRepository(ctx, ContentItem)
            .findOne({ where: { id: id as any, deletedAt: undefined }, relations: ['channels'] });
    }

    // ===== shop-api 公开查询（仅返回已发布内容） =====

    async findPublishedContentItems(ctx, options: {
        type?: ContentType;
        position?: string;
    }): Promise<ContentItem[]> {
        // 查询条件：deletedAt IS NULL AND enabled=true AND publishedAt IS NOT NULL
        //          AND (startAt IS NULL OR startAt <= now())
        //          AND (endAt IS NULL OR endAt > now())
        // 按 sort ASC 排序
    }

    // ===== 校验 =====

    private validateDataByType(type: ContentType, data: any): void {
        // Banner: 必有 imageUrl
        // Recommendation: 必有 itemType, itemId
        // Notice: 必有 content
        // Floor: 必有 title, layout, items 数组
    }

    // ===== 自动上下线（由 Job 调用） =====

    async runLifecycleCheck(ctx: RequestContext): Promise<{ published: number; unpublished: number }> {
        // 上线：enabled=true AND startAt <= now() AND publishedAt IS NULL AND deletedAt IS NULL
        //      → publishedAt = now()
        // 下线：enabled=true AND endAt <= now() AND unpublishedAt IS NULL AND deletedAt IS NULL
        //      → enabled=false, unpublishedAt = now()
    }
}
```

### 5.3 依赖与边界
- `OperationsDashboardService` 仅依赖 `TransactionalConnection`，通过原生 TypeORM QueryBuilder 直接查表（避免循环依赖 inventory/delivery/customer-service 插件的 service）
- `ContentService` 完全自包含，仅操作 ContentItem 表
- 自动上下线 Job 在 plugin 的 `onApplicationBootstrap` 中通过 `JobQueue` 注册

---

## 6. GraphQL API（SDL）

### 6.1 admin-api 扩展（看板 + CMS 管理）

```graphql
# ===== 看板 =====
type DashboardMetrics {
    sales: SalesMetrics
    delivery: DeliveryMetrics
    customer: CustomerMetrics
    inventory: InventoryMetrics
    afterSales: AfterSalesMetrics
    marketing: MarketingMetrics
}

type SalesMetrics {
    orderCount: Int!
    gmv: Int!
    previousOrderCount: Int!
    previousGmv: Int!
    pendingCount: Int!
}

type DeliveryMetrics {
    pending: Int!
    inProgress: Int!
    delivered: Int!
    exception: Int!
}

type CustomerMetrics {
    newCount: Int!
    totalCount: Int!
    levelDistribution: [MemberLevelCount!]!
}

type MemberLevelCount {
    levelId: ID
    levelName: String
    count: Int!
}

type InventoryMetrics {
    lowStockCount: Int!
    pendingStockIn: Int!
    pendingStockOut: Int!
    pendingStockMove: Int!
    pendingStocktake: Int!
}

type AfterSalesMetrics {
    pendingCount: Int!
    exceptionOrderCount: Int!
}

type MarketingMetrics {
    activeFlashSaleCount: Int!
    activeGroupBuyCount: Int!
    couponClaimedCount: Int!
}

type SalesTrendPoint {
    date: String!
    orderCount: Int!
    gmv: Int!
}

type CategoryTopItem {
    categoryId: ID!
    categoryName: String!
    gmv: Int!
    orderCount: Int!
}

extend type Query {
    dashboardOverview(range: String!): DashboardMetrics!
    salesTrend(days: Int!): [SalesTrendPoint!]!
    categoryTop(days: Int!): [CategoryTopItem!]!
}

# ===== CMS =====
type ContentItem {
    id: ID!
    type: String!
    code: String!
    name: String!
    enabled: Boolean!
    sort: Int!
    position: String!
    startAt: DateTime
    endAt: DateTime
    data: JSON
    staffId: String
    publishedAt: DateTime
    unpublishedAt: DateTime
    deletedAt: DateTime
    deletedBy: String
    createdAt: DateTime!
    updatedAt: DateTime!
}

type ContentItemList {
    items: [ContentItem!]!
    totalItems: Int!
}

input CreateContentItemInput {
    type: String!
    code: String!
    name: String!
    position: String!
    sort: Int
    startAt: DateTime
    endAt: DateTime
    data: JSON
}

input UpdateContentItemInput {
    name: String
    enabled: Boolean
    sort: Int
    position: String
    startAt: DateTime
    endAt: DateTime
    data: JSON
}

extend type Query {
    contentItems(type: String, position: String, enabled: Boolean, page: Int, pageSize: Int): ContentItemList!
    contentItem(id: ID!): ContentItem
}

extend type Mutation {
    createContentItem(input: CreateContentItemInput!): ContentItem!
    updateContentItem(id: ID!, input: UpdateContentItemInput!): ContentItem!
    deleteContentItem(id: ID!): Boolean!
}
```

### 6.2 shop-api 扩展（CMS 公开查询）

```graphql
# 仅暴露公开查询，不暴露看板
type ContentItemPublic {
    id: ID!
    type: String!
    code: String!
    name: String!
    sort: Int!
    position: String!
    data: JSON
    startAt: DateTime
    endAt: DateTime
}

extend type Query {
    publishedContent(type: String, position: String): [ContentItemPublic!]!
}
```

### 6.3 Resolver 权限矩阵

| API | 权限 | 说明 |
|---|---|---|
| `dashboardOverview` | `ViewDashboard` | 看板总览（@Allow） |
| `salesTrend` | `ViewDashboard` | 销售趋势（@Allow） |
| `categoryTop` | `ViewDashboard` | 品类 TOP10（@Allow） |
| `contentItems` (list) | 按 type 区分：Banner→`ManageBanner`，Recommendation→`ManageRecommendation`，Notice→`ManageNotice`，Floor→`ManageFloor`；不传 type 则要求 `ManageContent` | CMS 列表（手动鉴权） |
| `contentItem` (detail) | 同上，按 type 路由权限 | CMS 详情（手动鉴权） |
| `createContentItem` | 按 input.type 区分权限 | CMS 创建（手动鉴权） |
| `updateContentItem` | 先查 type，按 type 区分权限 | CMS 更新（手动鉴权） |
| `deleteContentItem` | 同 update | CMS 删除（手动鉴权） |
| `publishedContent` (shop) | 公开（无 @Allow） | 商城查询 |

### 6.4 实现要点

**Resolver 按 type 动态鉴权**（关键设计）：

```typescript
@Query()
async contentItems(@Ctx() ctx, @Args('type', { nullable: true }) type?: string) {
    const requiredPerm = this.getPermissionByType(type);
    // 手动校验 ctx.user.permissions 是否包含 requiredPerm
    // 不通过则抛 ForbiddenError
    return this.contentService.findContentItems(ctx, { type });
}

private getPermissionByType(type?: string): Permission {
    switch (type) {
        case 'Banner': return 'ManageBanner' as Permission;
        case 'Recommendation': return 'ManageRecommendation' as Permission;
        case 'Notice': return 'ManageNotice' as Permission;
        case 'Floor': return 'ManageFloor' as Permission;
        default: return 'ManageContent' as Permission;
    }
}
```

注意：因 `@Allow` 是静态装饰器，无法根据参数动态切换权限，故 contentItems/contentItem/createContentItem/updateContentItem/deleteContentItem **不使用 @Allow**，而是在方法内手动校验权限。

---

## 7. 前端 vadmin 页面

### 7.1 页面清单（9 页）

| 页面 | 路径 | 功能 | 权限 |
|---|---|---|---|
| 看板 | `/pkg-operations/pages/dashboard/index` | 6 类指标卡片 + 趋势图 + 品类 TOP10 | `ViewDashboard` |
| Banner 列表 | `/pkg-operations/pages/banner/index` | 列表 + 筛选 + 启停 | `ManageBanner` |
| Banner 详情 | `/pkg-operations/pages/banner/detail` | 创建/编辑 + JSON 预览 | `ManageBanner` |
| 推荐位列表 | `/pkg-operations/pages/recommendation/index` | 列表 + 筛选 | `ManageRecommendation` |
| 推荐位详情 | `/pkg-operations/pages/recommendation/detail` | 创建/编辑 | `ManageRecommendation` |
| 公告列表 | `/pkg-operations/pages/notice/index` | 列表 + 筛选 | `ManageNotice` |
| 公告详情 | `/pkg-operations/pages/notice/detail` | 创建/编辑 + 富文本 | `ManageNotice` |
| 楼层列表 | `/pkg-operations/pages/floor/index` | 列表 + 筛选 | `ManageFloor` |
| 楼层详情 | `/pkg-operations/pages/floor/detail` | 创建/编辑 + items 数组管理 | `ManageFloor` |

### 7.2 看板页面布局

```
┌───────────────────────────────────────────┐
│  时间范围选择：[今日][昨日][本周][本月]    │
│  下拉刷新 ↻                               │
├───────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  │订单数│ │ GMV  │ │待处理│  ← 销售卡片    │
│  │  42  │ │¥5800 │ │  3   │               │
│  │↑12%  │ │↑8%   │ │      │               │
│  └──────┘ └──────┘ └──────┘               │
├───────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │待配送│ │配送中│ │已送达│ │异常  │ ← 配送│
│  │  15  │ │  8   │ │  32  │ │  2   │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
├───────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  │新客  │ │累计  │ │低库存│  ← 客户/库存   │
│  │  5   │ │ 230  │ │  4   │               │
│  └──────┘ └──────┘ └──────┘               │
├───────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐                        │
│  │待售后│ │异常单│  ← 售后/异常            │
│  │  3   │ │  2   │                        │
│  └──────┘ └──────┘                        │
├───────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  │闪购  │ │拼团  │ │优惠券│  ← 营销        │
│  │  2   │ │  1   │ │ 156  │               │
│  └──────┘ └──────┘ └──────┘               │
├───────────────────────────────────────────┤
│  销售趋势（近 7 日）                      │
│  ┌─────────────────────────────────────┐  │
│  │      /\      /\                     │  │
│  │   /\/  \   /\/  \    ← 折线图       │  │
│  │  /      \_/      \__                │  │
│  └─────────────────────────────────────┘  │
│  [7日] [30日]                             │
├───────────────────────────────────────────┤
│  品类销售 TOP10                           │
│  ┌─────────────────────────────────────┐  │
│  │ ████████████ 食品 45%               │  │
│  │ ████████ 日用品 28%                 │  │
│  │ █████ 家电 18%       ← 横向柱状图    │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### 7.3 看板数据加载策略

```typescript
// 看板页面 onShow/onPullDownRefresh
async function loadDashboard() {
    loading.value = true;
    try {
        const [overview, trend, top] = await Promise.all([
            operationsApi.dashboardOverview(currentRange.value),  // 'today'|'yesterday'|'week'|'month'
            operationsApi.salesTrend(7),                          // 默认近 7 日
            operationsApi.categoryTop(7),
        ]);
        overviewData.value = overview;
        trendData.value = trend;
        topData.value = top;
        renderCharts();  // 调用 uCharts 渲染
    } finally {
        loading.value = false;
    }
}
```

### 7.4 CMS 列表页通用模式

```vue
<template>
    <view class="container">
        <!-- 顶部筛选 -->
        <view class="filter">
            <picker v-model="filter.position" :range="positions" />
            <switch v-model="filter.enabled" title="仅启用" />
        </view>
        <!-- 列表 -->
        <view class="list">
            <view v-for="item in list" :key="item.id" class="item" @click="goDetail(item.id)">
                <text class="name">{{ item.name }}</text>
                <text class="code">{{ item.code }}</text>
                <text :class="['badge', item.enabled ? 'on' : 'off']">
                    {{ item.enabled ? '启用' : '停用' }}
                </text>
                <text class="time" v-if="item.startAt">{{ formatDate(item.startAt) }} ~ {{ formatDate(item.endAt) }}</text>
            </view>
        </view>
        <!-- 新增按钮 -->
        <button class="fab" @click="goDetail()">+</button>
    </view>
</template>
```

### 7.5 CMS 详情页通用模式

```vue
<template>
    <view class="container">
        <view class="form">
            <view class="field"><text>名称</text><input v-model="form.name" /></view>
            <view class="field"><text>编码</text><input v-model="form.code" :disabled="isEdit" /></view>
            <view class="field"><text>位置</text><picker v-model="form.position" :range="positions" /></view>
            <view class="field"><text>排序</text><input type="number" v-model="form.sort" /></view>
            <view class="field"><text>启用</text><switch v-model="form.enabled" /></view>
            <view class="field"><text>开始时间</text><picker mode="date" v-model="form.startAt" /></view>
            <view class="field"><text>结束时间</text><picker mode="date" v-model="form.endAt" /></view>
        </view>

        <!-- 按类型显示差异化字段 -->
        <BannerFields v-if="form.type === 'Banner'" v-model="form.data" />
        <RecommendationFields v-else-if="form.type === 'Recommendation'" v-model="form.data" />
        <NoticeFields v-else-if="form.type === 'Notice'" v-model="form.data" />
        <FloorFields v-else-if="form.type === 'Floor'" v-model="form.data" />

        <!-- JSON 预览（折叠） -->
        <view class="json-preview" @click="showJson = !showJson">
            <text>JSON 预览</text>
            <view v-if="showJson" class="json-content">{{ JSON.stringify(form.data, null, 2) }}</view>
        </view>

        <button type="primary" @click="onSave">保存</button>
        <button v-if="isEdit" type="warn" @click="onDelete">删除</button>
    </view>
</template>
```

### 7.6 shortcuts.ts 更新

```typescript
// ops 运营模块（启用）
{ code: 'ops-dashboard', name: '看板', icon: '📊', perm: 'ViewDashboard',
  route: '/pkg-operations/pages/dashboard/index', enabled: true },
{ code: 'ops-banner', name: 'Banner', icon: '🖼️', perm: 'ManageBanner',
  route: '/pkg-operations/pages/banner/index', enabled: true },
{ code: 'ops-recommendation', name: '推荐位', icon: '📌', perm: 'ManageRecommendation',
  route: '/pkg-operations/pages/recommendation/index', enabled: true },
{ code: 'ops-notice', name: '公告', icon: '📢', perm: 'ManageNotice',
  route: '/pkg-operations/pages/notice/index', enabled: true },
{ code: 'ops-floor', name: '楼层', icon: '🏠', perm: 'ManageFloor',
  route: '/pkg-operations/pages/floor/index', enabled: true },
```

### 7.7 uCharts 集成
- **安装**：`npm install @qiun/ucharts`（uni-app 原生兼容，约 200KB）
- **组件封装**：`pkg-operations/components/LineChart.vue` / `BarChart.vue`
- **折线图**（销售趋势）：x 轴日期，y 轴订单数/GMV 双轴
- **横向柱状图**（品类 TOP10）：按 gmv 降序

---

## 8. 错误处理、测试与开放问题

### 8.1 错误处理策略

| 场景 | 处理方式 | 错误码/消息 |
|---|---|---|
| CMS 创建时 (code, channelId, deletedAt IS NULL) 重复 | 抛 `UserInputError` | `Content item code '{code}' already exists in this channel` |
| CMS data 字段结构不匹配 type | 抛 `UserInputError` | `Invalid data for type '{type}': missing required field '{field}'` |
| CMS 更新时 type 不可改 | 抛 `UserInputError` | `Content type cannot be changed after creation` |
| CMS 操作已软删除的项 | 抛 `UserInputError` | `Content item not found` |
| 看板查询时间范围非法 | 抛 `UserInputError` | `Invalid range: must be one of today/yesterday/week/month` |
| 看板某子模块查询失败 | 该子模块返回 null + 日志告警，不阻塞整体 | `Logger.warn(...)` |
| CMS 权限不足 | 抛 `ForbiddenError` | `User is not authorized to manage {type} content` |
| Job 自动上下线失败 | 单条失败记录错误日志，继续处理下一条 | `Logger.error(...)` |

**看板容错原则**：单个子模块查询失败不应阻塞整个看板。`getDashboardOverview` 内部对每个子查询做 try-catch，失败时该字段返回 `null`，前端显示"暂无数据"。

### 8.2 测试策略

**e2e 测试脚本**：`e:\code\vendure\test-operations-flow.js`，10 组测试：

```javascript
// 参考既有 test-cs-flow.js / test-inventory-flow.js 模式
// 使用 node-fetch + pg，鉴权用 cookie（与 cs/inventory 一致）

// [1] 角色权限同步验证
//     operations-staff 包含 8 个权限（Authenticated + ViewDashboard + 4 个 Manage + 2 个保留）
//     manager / super-admin 包含 4 个新权限

// [2] 看板查询：dashboardOverview 返回 6 类指标（允许 null）
//     salesTrend(7) 返回 [{date, orderCount, gmv}]
//     categoryTop(7) 返回 [{categoryId, categoryName, gmv, orderCount}]

// [3] CMS 创建：4 种类型各创建 1 条
//     验证 type/code/name/enabled/sort/position 字段持久化

// [4] CMS 唯一约束：(code, channelId, deletedAt IS NULL) 重复时抛 UserInputError

// [5] CMS data 校验：Banner 缺 imageUrl 时抛 UserInputError

// [6] CMS 更新：name/sort/data 可更新；type 不可改（抛错）

// [7] CMS 软删除：deleteContentItem 后 deletedAt 非空；列表查询不可见；同 code 可重建

// [8] CMS 自动上下线：
//     - 创建 startAt=now+1s 的项，等待 2s 后 runLifecycleCheck，publishedAt 非空
//     - 创建 endAt=now+1s 的项，等待 2s 后 runLifecycleCheck，enabled=false, unpublishedAt 非空

// [9] shop-api 公开查询：publishedContent 返回 enabled=true AND publishedAt 非空 AND deletedAt IS NULL 的项

// [10] 权限隔离：
//      - sales-staff 不能调用 dashboardOverview（缺 ViewDashboard）
//      - sales-staff 不能调用 createContentItem(type=Banner)（缺 ManageBanner）
//      - operations-staff 不能调用 salesCreateOrder
```

**reset 脚本**：`e:\code\vendure\reset-operations-pwd.js`，创建 `ops1@zhao.test` 测试账号（password: a963963，roleIds: [operationsRoleId]）

### 8.3 验收清单

- [ ] OperationsPlugin 在 dev-config.ts 注册
- [ ] dev 服务器启动无错误，日志包含 `OperationsPlugin onApplicationBootstrap`
- [ ] GraphQL introspection 包含 3 个看板 Query + 2 个 CMS Query + 3 个 CMS Mutation
- [ ] GraphQL shop-api 包含 `publishedContent` Query
- [ ] operations-staff 角色包含 8 个权限
- [ ] 10 组 e2e 测试全部通过
- [ ] vadmin 看板页面加载，6 类指标卡片 + 趋势图 + 品类 TOP10 展示
- [ ] vadmin 4 类 CMS 页面（列表+详情）可创建/编辑/删除
- [ ] 自动上下线 Job 按预期工作
- [ ] 软删除生效：删除后列表不可见，同 code 可重建

### 8.4 开放问题决策

**Q1：低库存阈值**
- **决策**：硬编码 `LOW_STOCK_THRESHOLD = 10`，写入 constants.ts 作为常量，便于后续调整

**Q2：看板时间范围的"本周/本月"定义**
- **决策**：本周=本周一 00:00 至 now；本月=本月 1 号 00:00 至 now（符合运营直觉）

**Q3：CMS 软删除还是硬删除？**
- **决策**：软删除。`deletedAt` 标记删除时间，`deletedBy` 记录操作人；所有查询默认加 `deletedAt IS NULL`；唯一约束 `UNIQUE(code, channel_id, deletedAt)` 允许删除后重建同 code

**Q4：shop-api publishedContent 是否分页？**
- **决策**：不分页，返回 `[ContentItemPublic!]!`（数组），按 sort ASC 排序

**Q5：uCharts 依赖体积**
- **决策**：安装 `@qiun/ucharts`（约 200KB，对 vadmin 包体积影响可接受）

---

## 9. 实施注意事项

### 9.1 既有模式参考
- Plugin 结构：参考 `customer-service-plugin/src/customer-service.plugin.ts`
- Resolver 鉴权：参考 `customer-service-plugin/src/customer-service-admin.resolver.ts`（nullable ID 参数用 `type: () => String`）
- RoleSyncService：参考 `inventory-plugin/src/role-sync.ts`
- 实体 ID 字段：使用 `@EntityId()` 装饰器（vendure 标准）
- `@OneToMany` 关系：添加 `cascade: true`
- 鉴权方式：cookie（与 cs/inventory 测试脚本一致）
- TypeScript 编译：`findOne` 返回 `T | null`（vendure v3.6 TypeORM API）

### 9.2 JobQueue 注册
- 在 `OperationsPlugin.onApplicationBootstrap` 中通过 `JobQueueService` 注册 `operations-content-lifecycle` Job
- 每 60 秒触发一次 `ContentService.runLifecycleCheck`
- 错误重试：单次失败不阻塞下一次执行

### 9.3 shop-api 扩展
- Plugin 配置中 `shopApiExtensions` 暴露 `publishedContent` Query
- 无 `@Allow` 装饰器（公开访问）
- Resolver 在 `operations-shop.resolver.ts` 中实现

### 9.4 构建与部署
- `npm run build` 在 `packages/operations-plugin` 中执行
- dev 模式自动编译（develop 模式 watch src/*.ts 变更）
- 生产部署：通过 `build-prod.bat` 预编译 dist/ 并提交 Git

---

## 10. 总结

本 spec 范围为 Operations 模块 P1（Dashboard + CMS），遵循 customer-service-plugin / inventory-plugin 既有模式：

- **后端**：独立 `@vendure/operations-plugin`，含 ContentItem 实体（单表多态 + 软删除）+ 看板聚合 service + CMS service + admin/shop resolver + 自动上下线 Job
- **前端**：vadmin 中 9 页（1 看板 + 4 类型 × 2 列表/详情），集成 uCharts 图表
- **权限**：4 个新权限按内容类型细分，operations-staff 角色同步
- **测试**：10 组 e2e 测试覆盖权限、CRUD、软删除、自动上下线、权限隔离

P2（营销聚合）/ P3（会员/消息）作为独立 spec 后续推进。
