# Vendure 后续功能插件设计文档

## 概述

为 Vendure 电商平台新增 6 个独立插件包，覆盖国内电商核心场景：订单超时取消、发票、物流追踪、拼团、秒杀、分销/佣金。所有插件遵循 Channel 即租户的多租户架构，实体实现 `ChannelAware` 接口，业务逻辑按 `ctx.channelId` 过滤数据。

## 架构原则

1. **独立插件包**：每个功能一个独立 `@vendure/*-plugin` 包，按需安装
2. **多租户**：Channel 即租户，实体实现 `ChannelAware`，配置通过 Channel CustomFields
3. **无外部依赖**：除 `@vendure/core` 和 `@vendure/common` 外无运行时依赖
4. **Vendure 规范**：VendurePlugin 装饰器、configuration 函数、PluginCommonModule
5. **事件驱动**：通过 EventBus 订阅状态变更事件触发业务逻辑
6. **JobQueue 异步**：定时任务和延迟任务通过 JobQueue 实现

## 插件架构

```
packages/
├── order-timeout-plugin/          # 订单超时自动取消
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       ├── order-timeout.job.ts
│       └── channel-custom-fields.ts
│
├── invoice-plugin/                # 发票
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       └── order-custom-fields.ts
│
├── logistics-plugin/              # 物流追踪 + 多仓库发货策略
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       ├── fulfillment-custom-fields.ts
│       ├── channel-custom-fields.ts
│       └── channel-stock-allocation-strategy.ts
│
├── group-buy-plugin/              # 拼团
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       ├── group-buy-activity.entity.ts
│       ├── group-buy-order.entity.ts
│       ├── group-buy.service.ts
│       ├── group-buy-admin.resolver.ts
│       ├── group-buy-shop.resolver.ts
│       ├── group-buy-promotion-condition.ts
│       ├── group-buy-leader-promotion.ts
│       └── group-buy.job.ts
│
├── flash-sale-plugin/             # 秒杀
│   └── src/
│       ├── plugin.ts
│       ├── constants.ts
│       ├── types.ts
│       ├── flash-sale-activity.entity.ts
│       ├── flash-sale.service.ts
│       ├── flash-sale-admin.resolver.ts
│       ├── flash-sale-shop.resolver.ts
│       ├── flash-sale-promotion-condition.ts
│       ├── flash-sale-eligibility-checker.ts
│       └── flash-sale.job.ts
│
└── distribution-plugin/           # 分销/佣金
    └── src/
        ├── plugin.ts
        ├── constants.ts
        ├── types.ts
        ├── distributor.entity.ts
        ├── commission-record.entity.ts
        ├── withdrawal-request.entity.ts
        ├── channel-custom-fields.ts
        ├── customer-custom-fields.ts
        ├── distribution.service.ts
        ├── commission.service.ts
        ├── withdrawal.service.ts
        ├── distribution-admin.resolver.ts
        ├── distribution-shop.resolver.ts
        └── commission.job.ts
```

## 实施优先级

| 优先级 | 插件 | 复杂度 | 依赖 |
|--------|------|--------|------|
| P0 | order-timeout-plugin | 低 | 无 |
| P1 | invoice-plugin | 中 | 无 |
| P1 | logistics-plugin | 中 | 无 |
| P2 | group-buy-plugin | 高 | order-timeout-plugin |
| P2 | flash-sale-plugin | 高 | order-timeout-plugin |
| P3 | distribution-plugin | 高 | 无 |

---

## 1. 订单超时自动取消 (`@vendure/order-timeout-plugin`)

### 功能范围

仅未支付订单超时取消。订单进入 `ArrangingPayment` 状态后，若在超时时间内未完成支付，自动取消订单。

### 数据流

```
订单进入 ArrangingPayment
  → EventBus 订阅 OrderStateTransitionEvent
  → JobQueue 添加延迟 Job（timeoutMinutes 后执行）
  → Job 执行时检查订单状态
  → 若仍为 ArrangingPayment → OrderService.cancelOrder()
  → 若已支付 → 跳过
```

### Channel CustomFields

```typescript
Channel: [
  {
    name: 'orderTimeoutMinutes',
    type: 'int',
    defaultValue: 30,
    label: [{ languageCode: LanguageCode.zh_Hans, value: '订单超时时间（分钟）' }],
  },
]
```

### 核心实现

**order-timeout.job.ts**：

```typescript
import { JobQueue, JobQueueService, Logger, OrderService, RequestContext, ChannelService } from '@vendure/core';

export class OrderTimeoutJob {
  private jobQueue: JobQueue<{ orderId: string; channelId: string }>;

  async init(jobQueueService: JobQueueService, private orderService: OrderService, private channelService: ChannelService) {
    this.jobQueue = await jobQueueService.createQueue({
      name: 'order-timeout',
      process: async (job) => {
        const channel = await this.channelService.findOne(job.data.channelId);
        if (!channel) return;
        const ctx = new RequestContext({ apiType: 'admin', channel, isAuthorized: true, authorizedAsOwnerOnly: false });
        const order = await this.orderService.findOne(ctx, job.data.orderId);
        if (order && order.state === 'ArrangingPayment') {
          await this.orderService.cancelOrder(ctx, job.data.orderId);
          Logger.info(`Order ${job.data.orderId} cancelled due to timeout`, 'OrderTimeoutPlugin');
        }
      },
    });
  }

  async scheduleCancellation(orderId: string, channelId: string, timeoutMinutes: number) {
    await this.jobQueue.add({ orderId, channelId }, { delay: timeoutMinutes * 60 * 1000 });
  }
}
```

**plugin.ts** 中的 EventBus 订阅：

```typescript
// 在 onApplicationBootstrap 中
this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
  if (event.toState === 'ArrangingPayment') {
    const timeoutMinutes = (event.ctx.channel as any).customFields?.orderTimeoutMinutes ?? 30;
    this.orderTimeoutJob.scheduleCancellation(event.order.id, event.ctx.channelId, timeoutMinutes);
  }
});
```

### 配置接口

```typescript
interface OrderTimeoutPluginOptions {
  defaultTimeoutMinutes?: number;
}
```

### 无外部依赖

---

## 2. 发票 (`@vendure/invoice-plugin`)

### 功能范围

仅数据记录。通过 Order CustomFields 存储发票信息（抬头/税号/类型），不生成 PDF。

### Order CustomFields

```typescript
Order: [
  { name: 'invoiceRequired', type: 'boolean', defaultValue: false },
  {
    name: 'invoiceType',
    type: 'string',
    nullable: true,
    ui: {
      component: 'select-form-input',
      options: [
        { value: 'ordinary' },
        { value: 'special' },
        { value: 'electronic' },
      ],
    },
  },
  { name: 'invoiceTitle', type: 'string', nullable: true },
  { name: 'invoiceTaxNumber', type: 'string', nullable: true },
  { name: 'invoiceEmail', type: 'string', nullable: true },
  { name: 'invoiceCompanyAddress', type: 'string', nullable: true },
  { name: 'invoiceCompanyPhone', type: 'string', nullable: true },
  { name: 'invoiceBankName', type: 'string', nullable: true },
  { name: 'invoiceBankAccount', type: 'string', nullable: true },
]
```

### 配置接口

```typescript
interface InvoicePluginOptions {
  enabledTypes?: ('ordinary' | 'special' | 'electronic')[];
}
```

### 无外部依赖

---

## 3. 物流追踪 (`@vendure/logistics-plugin`)

### 功能范围

1. Fulfillment CustomFields 记录物流单号和物流公司
2. Channel CustomFields 配置仓库优先级和发货策略
3. 自定义 StockAllocationStrategy 按 Channel 配置分配库存

### Fulfillment CustomFields

```typescript
Fulfillment: [
  { name: 'trackingNumber', type: 'string', nullable: true },
  { name: 'carrier', type: 'string', nullable: true },
  { name: 'carrierCode', type: 'string', nullable: true },
  { name: 'shippingNote', type: 'string', nullable: true },
]
```

### Channel CustomFields

```typescript
Channel: [
  {
    name: 'stockLocationPriority',
    type: 'string',
    nullable: true,
    label: [{ languageCode: LanguageCode.zh_Hans, value: '仓库优先级配置（JSON）' }],
  },
  {
    name: 'shippingStrategy',
    type: 'string',
    defaultValue: 'priority',
    ui: {
      component: 'select-form-input',
      options: [
        { value: 'priority' },
        { value: 'nearest' },
        { value: 'stock-first' },
      ],
    },
  },
]
```

### ChannelStockAllocationStrategy

```typescript
import { StockAllocationStrategy, RequestContext } from '@vendure/core';

export class ChannelStockAllocationStrategy implements StockAllocationStrategy {
  async allocateFromStockLocation(ctx: RequestContext, stockLocations, item) {
    const ccf = (ctx.channel as any).customFields;
    const strategy = ccf?.shippingStrategy ?? 'priority';

    switch (strategy) {
      case 'priority': {
        const priorityConfig = ccf?.stockLocationPriority
          ? JSON.parse(ccf.stockLocationPriority)
          : [];
        const sorted = priorityConfig.length > 0
          ? stockLocations.sort((a, b) => {
              const pa = priorityConfig.find((p: any) => p.locationId === a.id)?.priority ?? 999;
              const pb = priorityConfig.find((p: any) => p.locationId === b.id)?.priority ?? 999;
              return pa - pb;
            })
          : stockLocations;
        return sorted[0];
      }
      case 'stock-first':
        return stockLocations.sort((a, b) => b.stockOnHand - a.stockOnHand)[0];
      case 'nearest':
      default:
        return stockLocations[0];
    }
  }
}
```

### 配置接口

```typescript
interface LogisticsPluginOptions {
  defaultShippingStrategy?: 'priority' | 'nearest' | 'stock-first';
}
```

### 无外部依赖

---

## 4. 拼团 (`@vendure/group-buy-plugin`)

### 功能范围

基础拼团 + 团长优惠 + 超额奖励规则。固定人数成团，团长享额外优惠，超额参团触发奖励。

### 数据模型

**GroupBuyActivity**：

```typescript
@Entity()
class GroupBuyActivity extends VendureEntity implements ChannelAware {
  @Column() name: string;
  @Column() description: string;
  @Column() targetCount: number;
  @Column() currentCount: number;
  @Column() maxCount: number;
  @Column() status: 'active' | 'completed' | 'expired';
  @Column() startAt: Date;
  @Column() endAt: Date;
  @Column() productId: ID;
  @Column() variantId: ID;
  @Column() groupPrice: number;            // 拼团价（分），所有参团人统一价格
  @Column() leaderDiscount: number;        // 团长额外优惠（分），团长实付 = groupPrice - leaderDiscount
  @Column() leaderRewardType: 'discount' | 'cashback' | 'free';
  @Column('simple-json') rewardRules: RewardRule[];
  @Column() autoConfirm: boolean;
  @Column() allowJoinAfterComplete: boolean;
  @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}

interface RewardRule {
  excessCount: number;
  rewardType: 'discount' | 'cashback' | 'gift';
  rewardValue: number;
}
```

**GroupBuyOrder**：

```typescript
@Entity()
class GroupBuyOrder extends VendureEntity {
  @Column() groupBuyActivityId: ID;
  @Column() orderId: ID;
  @Column() isLeader: boolean;
  @Column() status: 'pending' | 'success' | 'failed';
}
```

### 业务流程

```
1. 管理员创建拼团活动（选商品、设人数、设价格、设团长优惠、设超额规则、设时间）
2. 用户开团 → 创建 GroupBuyOrder(isLeader=true) + 创建订单
3. 其他用户参团 → 创建 GroupBuyOrder(isLeader=false) + 创建订单
4. 达到 targetCount → 成团 → 所有订单标记 success → 通知支付
5. 超额参团至 maxCount → 检查 rewardRules → 团长获得超额奖励
6. 超时未满 → 所有订单取消
```

### PromotionCondition

**group_buy_discount**：当订单关联拼团活动时应用拼团价。

**group_buy_leader_reward**：当团长成团且满足超额条件时，额外应用团长优惠。

### JobQueue

**group-buy.job.ts**：
- 定时检查活动状态（active → expired）
- 成团检查（currentCount >= targetCount → completed）
- 超时取消（endAt 已过且未成团 → 取消所有关联订单）

### Admin API

```graphql
type GroupBuyActivity {
  id: ID!
  name: String!
  targetCount: Int!
  currentCount: Int!
  maxCount: Int!
  status: GroupBuyStatus!
  groupPrice: Int!
  leaderDiscount: Int!
  startAt: DateTime!
  endAt: DateTime!
  # ...
}

extend type Query {
  groupBuyActivities(options: GroupBuyActivityListOptions): GroupBuyActivityList!
  groupBuyActivity(id: ID!): GroupBuyActivity
}

extend type Mutation {
  createGroupBuyActivity(input: CreateGroupBuyActivityInput!): GroupBuyActivity!
  updateGroupBuyActivity(input: UpdateGroupBuyActivityInput!): GroupBuyActivity!
  deleteGroupBuyActivity(id: ID!): Boolean!
}
```

### Shop API

```graphql
extend type Query {
  activeGroupBuyActivities: [GroupBuyActivity!]!
  groupBuyActivity(id: ID!): GroupBuyActivity
}

extend type Mutation {
  joinGroupBuy(activityId: ID!, isLeader: Boolean!): GroupBuyOrderResult!
}
```

### 配置接口

```typescript
interface GroupBuyPluginOptions {
  defaultTimeoutMinutes?: number;
}
```

### 无外部依赖

---

## 5. 秒杀 (`@vendure/flash-sale-plugin`)

### 功能范围

基础秒杀：时间窗口 + 库存限定 + 每人限购。使用 Vendure 内置库存机制。

### 数据模型

**FlashSaleActivity**：

```typescript
@Entity()
class FlashSaleActivity extends VendureEntity implements ChannelAware {
  @Column() name: string;
  @Column() startAt: Date;
  @Column() endAt: Date;
  @Column() flashPrice: number;
  @Column() totalStock: number;
  @Column() soldCount: number;
  @Column() limitPerUser: number;
  @Column() productId: ID;
  @Column() variantId: ID;
  @Column() status: 'upcoming' | 'active' | 'ended';
  @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}
```

### 业务流程

```
1. 管理员创建秒杀活动（选商品、设价格、设库存、设时间窗口、设限购）
2. 活动开始 → status 变为 active（JobQueue 定时切换）
3. 用户下单 → 检查时间窗口 + 库存 + 限购 → 创建订单
4. 库存售罄 → 自动结束
5. 活动结束 → 未支付订单超时取消
```

### PromotionCondition

**flash_sale_discount**：当订单在秒杀时间窗口内且商品匹配时应用秒杀价。

### 限购检查

通过查询当前用户在该活动中的历史订单数量实现：

```typescript
const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
const flashSaleOrders = existingOrders.items.filter(
  (o) => (o as any).customFields?.flashSaleActivityId === activityId && o.state !== 'Cancelled'
);
if (flashSaleOrders.length >= activity.limitPerUser) {
  return false;
}
```

### JobQueue

**flash-sale.job.ts**：
- 定时切换活动状态（upcoming → active → ended）
- 售罄自动结束

### Admin API

```graphql
type FlashSaleActivity {
  id: ID!
  name: String!
  startAt: DateTime!
  endAt: DateTime!
  flashPrice: Int!
  totalStock: Int!
  soldCount: Int!
  limitPerUser: Int!
  status: FlashSaleStatus!
  # ...
}

extend type Query {
  flashSaleActivities(options: FlashSaleActivityListOptions): FlashSaleActivityList!
  flashSaleActivity(id: ID!): FlashSaleActivity
}

extend type Mutation {
  createFlashSaleActivity(input: CreateFlashSaleActivityInput!): FlashSaleActivity!
  updateFlashSaleActivity(input: UpdateFlashSaleActivityInput!): FlashSaleActivity!
  deleteFlashSaleActivity(id: ID!): Boolean!
}
```

### Shop API

```graphql
extend type Query {
  activeFlashSaleActivities: [FlashSaleActivity!]!
  flashSaleActivity(id: ID!): FlashSaleActivity
}
```

### 配置接口

```typescript
interface FlashSalePluginOptions {
  defaultTimeoutMinutes?: number;
}
```

### 无外部依赖

---

## 6. 分销/佣金 (`@vendure/distribution-plugin`)

### 功能范围

二级分销 + 提现结算 + 报表。合规设计，不超过二级分销。

### 数据模型

**Distributor**：

```typescript
@Entity()
class Distributor extends VendureEntity implements ChannelAware {
  @Column() customerId: ID;
  @Column() parentId: ID;
  @Column() level: number;
  @Column() status: 'active' | 'frozen' | 'pending';
  @Column() totalEarnings: number;
  @Column() availableBalance: number;
  @Column() frozenBalance: number;
  @Column({ unique: true }) referralCode: string;
  @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}
```

**CommissionRecord**：

```typescript
@Entity()
class CommissionRecord extends VendureEntity implements ChannelAware {
  @Column() distributorId: ID;
  @Column() orderId: ID;
  @Column() orderLineId: ID;
  @Column() fromDistributorId: ID;
  @Column() commissionType: 'direct' | 'indirect';
  @Column() commissionRate: number;
  @Column() orderAmount: number;
  @Column() commissionAmount: number;
  @Column() status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  @Column() settledAt: Date;
  @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}
```

**WithdrawalRequest**：

```typescript
@Entity()
class WithdrawalRequest extends VendureEntity implements ChannelAware {
  @Column() distributorId: ID;
  @Column() amount: number;
  @Column() method: 'bank' | 'alipay' | 'wechat';
  @Column() accountInfo: string;
  @Column() status: 'pending' | 'approved' | 'rejected' | 'paid';
  @Column() reviewedAt: Date;
  @Column() paidAt: Date;
  @ManyToMany(() => Channel) @JoinTable() channels: Channel[];
}
```

### Channel CustomFields

```typescript
Channel: [
  { name: 'directCommissionRate', type: 'int', defaultValue: 1000 },
  { name: 'indirectCommissionRate', type: 'int', defaultValue: 500 },
  { name: 'minWithdrawalAmount', type: 'int', defaultValue: 10000 },
  { name: 'commissionSettlementDays', type: 'int', defaultValue: 7 },
  { name: 'distributionEnabled', type: 'boolean', defaultValue: false },
]
```

### Customer CustomFields

```typescript
Customer: [
  { name: 'referralCode', type: 'string', nullable: true },
  { name: 'referredBy', type: 'string', nullable: true },
]
```

### 业务流程

```
1. 用户申请成为分销商 → 审核通过 → 生成推荐码
2. 分销商分享推荐链接 → 新用户通过链接注册（Customer.referralCode 记录来源）
3. 订单完成支付 → EventBus 订阅 PaymentStateTransitionEvent
   → 计算直推佣金（一级，commissionType=direct）
   → 若分销商有上级 → 计算间推佣金（二级，commissionType=indirect）
4. 佣金状态 pending → 订单确认收货后 N 天 → confirmed（JobQueue 定时结算）
5. 分销商申请提现 → 管理员审核 → 线下打款 → 标记 paid
```

### 佣金计算

```typescript
async calculateCommission(ctx: RequestContext, order: Order): Promise<void> {
  const customer = order.customer;
  if (!customer) return;

  const referralCode = (customer as any).customFields?.referralCode;
  if (!referralCode) return;

  const directDistributor = await this.findByReferralCode(ctx, referralCode);
  if (!directDistributor || directDistributor.status !== 'active') return;

  const ccf = (ctx.channel as any).customFields;
  const directRate = ccf?.directCommissionRate ?? 1000;
  const indirectRate = ccf?.indirectCommissionRate ?? 500;

  const orderTotal = order.total;

  // 直推佣金
  await this.createCommissionRecord(ctx, {
    distributorId: directDistributor.id,
    orderId: order.id,
    commissionType: 'direct',
    commissionRate: directRate,
    orderAmount: orderTotal,
    commissionAmount: Math.floor(orderTotal * directRate / 10000),
  });

  // 间推佣金
  if (directDistributor.parentId) {
    const parentDistributor = await this.findOne(ctx, directDistributor.parentId);
    if (parentDistributor && parentDistributor.status === 'active') {
      await this.createCommissionRecord(ctx, {
        distributorId: parentDistributor.id,
        orderId: order.id,
        fromDistributorId: directDistributor.id,
        commissionType: 'indirect',
        commissionRate: indirectRate,
        orderAmount: orderTotal,
        commissionAmount: Math.floor(orderTotal * indirectRate / 10000),
      });
    }
  }
}
```

### Admin API

```graphql
type Distributor {
  id: ID!
  customerId: ID!
  parentId: ID
  level: Int!
  status: DistributorStatus!
  totalEarnings: Int!
  availableBalance: Int!
  referralCode: String!
  # ...
}

type CommissionRecord {
  id: ID!
  distributorId: ID!
  orderId: ID!
  commissionType: CommissionType!
  commissionRate: Int!
  orderAmount: Int!
  commissionAmount: Int!
  status: CommissionStatus!
  # ...
}

type WithdrawalRequest {
  id: ID!
  distributorId: ID!
  amount: Int!
  method: WithdrawalMethod!
  status: WithdrawalStatus!
  # ...
}

extend type Query {
  distributors(options: DistributorListOptions): DistributorList!
  commissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
  withdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
  distributionSummary: DistributionSummary!
}

extend type Mutation {
  approveDistributor(id: ID!): Distributor!
  freezeDistributor(id: ID!): Distributor!
  approveWithdrawal(id: ID!): WithdrawalRequest!
  rejectWithdrawal(id: ID!): WithdrawalRequest!
  markWithdrawalPaid(id: ID!): WithdrawalRequest!
}
```

### Shop API

```graphql
extend type Query {
  myDistributorProfile: Distributor
  myCommissionRecords: [CommissionRecord!]!
  myWithdrawalRequests: [WithdrawalRequest!]!
}

extend type Mutation {
  applyDistributor: Distributor!
  requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
}
```

### JobQueue

**commission.job.ts**：
- 定时结算：将 pending 佣金转为 confirmed（确认收货后 N 天）
- 分销商余额更新：confirmed 佣金累加到 availableBalance

### 配置接口

```typescript
interface DistributionPluginOptions {
  defaultDirectRate?: number;
  defaultIndirectRate?: number;
  minWithdrawalAmount?: number;
  settlementDays?: number;
}
```

### 无外部依赖

---

## 多租户规范

所有 6 个插件必须遵循以下多租户规范：

1. **实体 ChannelAware**：所有自定义实体实现 `ChannelAware` 接口，`@ManyToMany(() => Channel) @JoinTable() channels: Channel[]`
2. **数据隔离**：Service 层查询通过 `ctx.channelId` 过滤，确保租户间不泄露
3. **配置隔离**：通过 Channel CustomFields 传入渠道级配置，支持每个租户独立配置
4. **Admin API 权限**：按 Channel 权限控制访问

## 风险点

1. **拼团并发**：成团判断需防止超卖，使用数据库行锁或乐观锁
2. **秒杀库存**：高并发场景下 Vendure 内置库存机制可能不足，后续可引入 Redis 预扣
3. **分销合规**：严格限制二级分销，超过三级涉传销风险
4. **佣金精度**：使用整数（分）存储，避免浮点精度问题
5. **JobQueue 延迟**：JobQueue 的 delay 精度取决于适配器（SQL 适配器精度约 1 秒）
6. **CustomFields 冲突**：多个插件可能对同一实体扩展 CustomFields，需确保字段名不冲突

## 使用方式

```typescript
import { CjkPlugin } from '@vendure/cjk-plugin';
import { AlipayPlugin } from '@vendure/alipay-plugin';
import { WechatPayPlugin } from '@vendure/wechatpay-plugin';
import { OssPlugin } from '@vendure/oss-plugin';
import { PhoneAuthPlugin } from '@vendure/phone-auth-plugin';
import { WechatAuthPlugin } from '@vendure/wechat-auth-plugin';
import { OrderTimeoutPlugin } from '@vendure/order-timeout-plugin';
import { InvoicePlugin } from '@vendure/invoice-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { GroupBuyPlugin } from '@vendure/group-buy-plugin';
import { FlashSalePlugin } from '@vendure/flash-sale-plugin';
import { DistributionPlugin } from '@vendure/distribution-plugin';

const config: VendureConfig = {
  defaultLanguageCode: LanguageCode.zh_Hans,
  plugins: [
    // CJK 核心
    CjkPlugin.init({ i18n: { enabled: true }, regions: { enabled: true } }),
    AlipayPlugin.init({ /* ... */ }),
    WechatPayPlugin.init({ /* ... */ }),
    OssPlugin.init({ /* ... */ }),
    PhoneAuthPlugin.init({ /* ... */ }),
    WechatAuthPlugin.init({ /* ... */ }),

    // 后续功能
    OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
    InvoicePlugin.init({ enabledTypes: ['ordinary', 'special', 'electronic'] }),
    LogisticsPlugin.init({ defaultShippingStrategy: 'priority' }),
    GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
    FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
    DistributionPlugin.init({
      defaultDirectRate: 1000,
      defaultIndirectRate: 500,
      minWithdrawalAmount: 10000,
      settlementDays: 7,
    }),
  ],
};
```
