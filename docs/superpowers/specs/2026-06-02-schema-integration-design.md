# GraphQL Schema 补全 + 集成测试设计文档

## 概述

为 3 个需要自定义 GraphQL API 的插件（group-buy-plugin、flash-sale-plugin、distribution-plugin）补全 GraphQL Schema 定义，并通过 dev-server 集成测试验证所有 12 个自定义插件协同工作。

## 范围

1. **GraphQL Schema 补全**：3 个插件的 Admin + Shop API Schema
2. **dev-server 集成测试**：注册所有插件，启动验证

不需要 Schema 的插件：order-timeout-plugin（内部逻辑）、invoice-plugin（CustomFields 自动暴露）、logistics-plugin（CustomFields 自动暴露）

---

## 1. GraphQL Schema 补全

### 组织方式

Schema 内嵌在 plugin.ts 的 `adminApiExtensions.schema` / `shopApiExtensions.schema` 中，与 Vendure 官方插件风格一致。

### group-buy-plugin

**Admin Schema**：

```graphql
enum GroupBuyStatus { active completed expired }

type GroupBuyActivity {
  id: ID!
  name: String!
  description: String!
  targetCount: Int!
  currentCount: Int!
  maxCount: Int!
  status: GroupBuyStatus!
  startAt: DateTime!
  endAt: DateTime!
  groupPrice: Int!
  leaderDiscount: Int!
  leaderRewardType: String!
  autoConfirm: Boolean!
  allowJoinAfterComplete: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type GroupBuyActivityList implements PaginatedList {
  items: [GroupBuyActivity!]!
  totalItems: Int!
}

input CreateGroupBuyActivityInput {
  name: String!
  description: String!
  targetCount: Int!
  maxCount: Int
  startAt: DateTime!
  endAt: DateTime!
  groupPrice: Int!
  leaderDiscount: Int
  leaderRewardType: String
  autoConfirm: Boolean
  allowJoinAfterComplete: Boolean
  productId: ID!
  variantId: ID!
}

input UpdateGroupBuyActivityInput {
  id: ID!
  name: String
  description: String
  targetCount: Int
  maxCount: Int
  startAt: DateTime
  endAt: DateTime
  groupPrice: Int
  leaderDiscount: Int
  status: GroupBuyStatus
}

input GroupBuyActivityListOptions

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

**Shop Schema**：

```graphql
type GroupBuyOrderResult {
  id: ID!
  groupBuyActivityId: ID!
  isLeader: Boolean!
  status: String!
}

extend type Query {
  activeGroupBuyActivities: [GroupBuyActivity!]!
  groupBuyActivity(id: ID!): GroupBuyActivity
}

extend type Mutation {
  joinGroupBuy(activityId: ID!, isLeader: Boolean!): GroupBuyOrderResult!
}
```

### flash-sale-plugin

**Admin Schema**：

```graphql
enum FlashSaleStatus { upcoming active ended }

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
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FlashSaleActivityList implements PaginatedList {
  items: [FlashSaleActivity!]!
  totalItems: Int!
}

input CreateFlashSaleActivityInput {
  name: String!
  startAt: DateTime!
  endAt: DateTime!
  flashPrice: Int!
  totalStock: Int!
  limitPerUser: Int
  productId: ID!
  variantId: ID!
}

input UpdateFlashSaleActivityInput {
  id: ID!
  name: String
  startAt: DateTime
  endAt: DateTime
  flashPrice: Int
  totalStock: Int
  limitPerUser: Int
  status: FlashSaleStatus
}

input FlashSaleActivityListOptions

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

**Shop Schema**：

```graphql
extend type Query {
  activeFlashSaleActivities: [FlashSaleActivity!]!
  flashSaleActivity(id: ID!): FlashSaleActivity
}
```

### distribution-plugin

**Admin Schema**：

```graphql
enum DistributorStatus { active frozen pending }
enum CommissionType { direct indirect }
enum CommissionStatus { pending confirmed paid cancelled }
enum WithdrawalMethod { bank alipay wechat }
enum WithdrawalStatus { pending approved rejected paid }

type Distributor {
  id: ID!
  customerId: ID!
  parentId: ID
  level: Int!
  status: DistributorStatus!
  totalEarnings: Int!
  availableBalance: Int!
  frozenBalance: Int!
  referralCode: String!
  createdAt: DateTime!
  updatedAt: DateTime!
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
  settledAt: DateTime
  createdAt: DateTime!
}

type WithdrawalRequest {
  id: ID!
  distributorId: ID!
  amount: Int!
  method: WithdrawalMethod!
  accountInfo: String!
  status: WithdrawalStatus!
  reviewedAt: DateTime
  paidAt: DateTime
  createdAt: DateTime!
}

type DistributorList implements PaginatedList { items: [Distributor!]! totalItems: Int! }
type CommissionRecordList implements PaginatedList { items: [CommissionRecord!]! totalItems: Int! }
type WithdrawalRequestList implements PaginatedList { items: [WithdrawalRequest!]! totalItems: Int! }

input DistributorListOptions
input CommissionRecordListOptions
input WithdrawalRequestListOptions

extend type Query {
  distributors(options: DistributorListOptions): DistributorList!
  commissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
  withdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
}

extend type Mutation {
  approveDistributor(id: ID!): Distributor!
  freezeDistributor(id: ID!): Distributor!
  approveWithdrawal(id: ID!): WithdrawalRequest!
  rejectWithdrawal(id: ID!): WithdrawalRequest!
  markWithdrawalPaid(id: ID!): WithdrawalRequest!
}
```

**Shop Schema**：

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

---

## 2. dev-server 集成测试

### 目标

在 dev-server 中注册所有 12 个自定义插件，启动服务器验证插件协同工作。

### 修改文件

`packages/dev-server/dev-config.ts`：添加所有自定义插件注册。

### 插件注册配置

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

plugins: [
  CjkPlugin.init({ i18n: { enabled: true }, regions: { enabled: true } }),
  AlipayPlugin.init({
    appId: process.env.ALIPAY_APP_ID ?? '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
    tradeType: 'PAGE',
  }),
  WechatPayPlugin.init({
    appId: process.env.WECHATPAY_APP_ID ?? '',
    mchId: process.env.WECHATPAY_MCH_ID ?? '',
    publicKey: process.env.WECHATPAY_PUBLIC_KEY ?? '',
    privateKey: process.env.WECHATPAY_PRIVATE_KEY ?? '',
    apiKey: process.env.WECHATPAY_API_KEY ?? '',
    serialNo: process.env.WECHATPAY_SERIAL_NO ?? '',
    tradeType: 'NATIVE',
  }),
  OssPlugin.init({
    region: process.env.OSS_REGION ?? '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? '',
    bucket: process.env.OSS_BUCKET ?? '',
  }),
  PhoneAuthPlugin.init({
    accessKeyId: process.env.SMS_ACCESS_KEY_ID ?? '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET ?? '',
    signName: process.env.SMS_SIGN_NAME ?? '',
    templateCode: process.env.SMS_TEMPLATE_CODE ?? '',
  }),
  WechatAuthPlugin.init({
    appId: process.env.WECHAT_AUTH_APP_ID ?? '',
    appSecret: process.env.WECHAT_AUTH_APP_SECRET ?? '',
  }),
  OrderTimeoutPlugin.init({ defaultTimeoutMinutes: 30 }),
  InvoicePlugin.init(),
  LogisticsPlugin.init(),
  GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 }),
  FlashSalePlugin.init({ defaultTimeoutMinutes: 15 }),
  DistributionPlugin.init({
    defaultDirectRate: 1000,
    defaultIndirectRate: 500,
    minWithdrawalAmount: 10000,
    settlementDays: 7,
  }),
]
```

### 验证清单

1. 服务器启动无错误
2. Admin API introspection 包含所有自定义 type/query/mutation
3. Shop API introspection 包含所有自定义 query/mutation
4. Channel CustomFields 包含：orderTimeoutMinutes, couponStackable, maxStackableCount, stockLocationPriority, shippingStrategy, directCommissionRate, indirectCommissionRate, minWithdrawalAmount, commissionSettlementDays, distributionEnabled
5. Order CustomFields 包含：invoiceRequired, invoiceType, invoiceTitle, invoiceTaxNumber, invoiceEmail, invoiceCompanyAddress, invoiceCompanyPhone, invoiceBankName, invoiceBankAccount, groupBuyActivityId, groupBuyIsLeader, flashSaleActivityId, flashSaleStartAt, flashSaleEndAt
6. Fulfillment CustomFields 包含：trackingNumber, carrier, carrierCode, shippingNote
7. Customer CustomFields 包含：wechatOpenid, wechatMiniOpenid, referralCode, referredBy
8. 自定义实体表已创建：pickup_location, group_buy_activity, group_buy_order, flash_sale_activity, distributor, commission_record, withdrawal_request

### 注意事项

- 支付插件（Alipay/WechatPay）使用空字符串配置时，handler 注册但不执行实际支付
- OSS 插件使用空配置时，需要 fallback 到默认存储策略
- PhoneAuthPlugin 使用空配置时，验证码发送失败但不影响启动
- dev-server 使用 SQLite + SQL JobQueue 适配器
