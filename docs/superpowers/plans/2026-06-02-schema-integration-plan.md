# Schema Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 3 个插件补全 GraphQL Schema，并通过 dev-server 集成测试验证所有 12 个插件协同工作。

**Architecture:** Schema 内嵌在 plugin.ts 的 adminApiExtensions.schema / shopApiExtensions.schema 中。dev-server 注册所有插件后启动验证。

**Tech Stack:** TypeScript, GraphQL, Vendure v3.6.x, NestJS

---

## File Structure

```
packages/group-buy-plugin/src/plugin.ts          # 修改：添加 adminApiExtensions.schema + shopApiExtensions.schema
packages/flash-sale-plugin/src/plugin.ts          # 修改：添加 adminApiExtensions.schema + shopApiExtensions.schema
packages/distribution-plugin/src/plugin.ts         # 修改：添加 adminApiExtensions.schema + shopApiExtensions.schema
packages/dev-server/dev-config.ts                  # 修改：注册所有 12 个自定义插件
```

---

### Task 1: group-buy-plugin GraphQL Schema 补全

**Files:**
- Modify: `packages/group-buy-plugin/src/plugin.ts`

- [ ] **Step 1: 读取当前 plugin.ts 内容**

Run: 读取 `e:\code\vendure\packages\group-buy-plugin\src\plugin.ts`

- [ ] **Step 2: 在 plugin.ts 中添加 adminApiExtensions.schema 和 shopApiExtensions.schema**

在 `@VendurePlugin` 装饰器中，将现有的 `adminApiExtensions` 和 `shopApiExtensions` 从仅包含 resolvers 扩展为同时包含 schema 和 resolvers。

adminApiExtensions.schema 内容：

```typescript
schema: () => `
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

  extend type Query {
    groupBuyActivities(options: Json): GroupBuyActivityList!
    groupBuyActivity(id: ID!): GroupBuyActivity
  }

  extend type Mutation {
    createGroupBuyActivity(input: CreateGroupBuyActivityInput!): GroupBuyActivity!
    updateGroupBuyActivity(input: UpdateGroupBuyActivityInput!): GroupBuyActivity!
    deleteGroupBuyActivity(id: ID!): Boolean!
  }
`,
```

shopApiExtensions.schema 内容：

```typescript
schema: () => `
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
`,
```

- [ ] **Step 3: 构建验证**

Run: `cd e:\code\vendure\packages\group-buy-plugin && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/group-buy-plugin/src/plugin.ts
git commit -m "feat(group-buy-plugin): add GraphQL schema for admin and shop API"
```

---

### Task 2: flash-sale-plugin GraphQL Schema 补全

**Files:**
- Modify: `packages/flash-sale-plugin/src/plugin.ts`

- [ ] **Step 1: 读取当前 plugin.ts 内容**

Run: 读取 `e:\code\vendure\packages\flash-sale-plugin\src\plugin.ts`

- [ ] **Step 2: 在 plugin.ts 中添加 adminApiExtensions.schema 和 shopApiExtensions.schema**

adminApiExtensions.schema 内容：

```typescript
schema: () => `
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

  extend type Query {
    flashSaleActivities(options: Json): FlashSaleActivityList!
    flashSaleActivity(id: ID!): FlashSaleActivity
  }

  extend type Mutation {
    createFlashSaleActivity(input: CreateFlashSaleActivityInput!): FlashSaleActivity!
    updateFlashSaleActivity(input: UpdateFlashSaleActivityInput!): FlashSaleActivity!
    deleteFlashSaleActivity(id: ID!): Boolean!
  }
`,
```

shopApiExtensions.schema 内容：

```typescript
schema: () => `
  extend type Query {
    activeFlashSaleActivities: [FlashSaleActivity!]!
    flashSaleActivity(id: ID!): FlashSaleActivity
  }
`,
```

- [ ] **Step 3: 构建验证**

Run: `cd e:\code\vendure\packages\flash-sale-plugin && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/flash-sale-plugin/src/plugin.ts
git commit -m "feat(flash-sale-plugin): add GraphQL schema for admin and shop API"
```

---

### Task 3: distribution-plugin GraphQL Schema 补全

**Files:**
- Modify: `packages/distribution-plugin/src/plugin.ts`

- [ ] **Step 1: 读取当前 plugin.ts 内容**

Run: 读取 `e:\code\vendure\packages\distribution-plugin\src\plugin.ts`

- [ ] **Step 2: 在 plugin.ts 中添加 adminApiExtensions.schema 和 shopApiExtensions.schema**

adminApiExtensions.schema 内容：

```typescript
schema: () => `
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

  type DistributorList implements PaginatedList {
    items: [Distributor!]!
    totalItems: Int!
  }

  type CommissionRecordList implements PaginatedList {
    items: [CommissionRecord!]!
    totalItems: Int!
  }

  type WithdrawalRequestList implements PaginatedList {
    items: [WithdrawalRequest!]!
    totalItems: Int!
  }

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
`,
```

shopApiExtensions.schema 内容：

```typescript
schema: () => `
  extend type Query {
    myDistributorProfile: Distributor
    myCommissionRecords: [CommissionRecord!]!
    myWithdrawalRequests: [WithdrawalRequest!]!
  }

  extend type Mutation {
    applyDistributor: Distributor!
    requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
  }
`,
```

- [ ] **Step 3: 构建验证**

Run: `cd e:\code\vendure\packages\distribution-plugin && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/distribution-plugin/src/plugin.ts
git commit -m "feat(distribution-plugin): add GraphQL schema for admin and shop API"
```

---

### Task 4: dev-server 集成配置

**Files:**
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 读取当前 dev-config.ts 内容**

Run: 读取 `e:\code\vendure\packages\dev-server\dev-config.ts`

- [ ] **Step 2: 在 dev-config.ts 中添加所有 12 个自定义插件注册**

在现有 plugins 数组中添加以下插件（在已有插件之后）：

```typescript
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
```

同时添加对应的 import 语句。

- [ ] **Step 3: 构建验证**

Run: `cd e:\code\vendure\packages\dev-server && npx tsc --noEmit`
Expected: 可能有类型错误需要修复

- [ ] **Step 4: 修复构建错误（如有）**

根据 Step 3 的输出修复类型错误。常见问题：
- 插件 init 返回类型不匹配
- 缺少 import
- 插件选项类型不匹配

- [ ] **Step 5: 提交**

```bash
git add packages/dev-server/
git commit -m "feat(dev-server): register all 12 custom plugins for integration testing"
```

---

### Task 5: 全量构建验证

- [ ] **Step 1: 构建所有 12 个自定义插件**

对每个插件目录执行 `npx tsc --noEmit`：
- packages/cjk-plugin
- packages/alipay-plugin
- packages/wechatpay-plugin
- packages/oss-plugin
- packages/phone-auth-plugin
- packages/wechat-auth-plugin
- packages/order-timeout-plugin
- packages/invoice-plugin
- packages/logistics-plugin
- packages/group-buy-plugin
- packages/flash-sale-plugin
- packages/distribution-plugin

- [ ] **Step 2: 构建 dev-server**

Run: `cd e:\code\vendure\packages\dev-server && npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: complete schema integration - all plugins with GraphQL API and dev-server config"
```
