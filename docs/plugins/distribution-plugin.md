# DistributionPlugin 分销插件

## 概述

`DistributionPlugin` 是 Vendure 的多级分销插件，支持直推/间推佣金计算、分销商管理、提现审核等完整分销业务流程。适用于社交电商、推广返佣等场景。

**核心特性：**
- 多级分销体系（直推 + 间推）
- 灵活的佣金比例配置（万分之精度）
- 分销商申请与审核
- 提现管理（银行/支付宝/微信）
- 佣金结算周期控制
- 渠道级独立配置
- Dashboard UI 扩展，管理端可视化操作

**包名：** `@vendure/distribution-plugin`

**类名：** `DistributionPlugin`

---

## 安装

```bash
npm install @vendure/distribution-plugin
```

---

## 配置说明

在 `vendure-config.ts` 中注册插件：

```ts
import { DistributionPlugin } from '@vendure/distribution-plugin';

export const config = {
  // ...
  plugins: [
    DistributionPlugin.init({
      defaultDirectRate: 1000,      // 直推佣金比例 10%（万分之 1000）
      defaultIndirectRate: 500,     // 间推佣金比例 5%（万分之 500）
      minWithdrawalAmount: 10000,   // 最低提现金额 100元（单位：分）
      settlementDays: 7,            // 佣金结算天数 7天
    }),
  ],
};
```

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultDirectRate` | `number` | `1000` | 直推佣金比例（万分之），1000 = 10% |
| `defaultIndirectRate` | `number` | `500` | 间推佣金比例（万分之），500 = 5% |
| `minWithdrawalAmount` | `number` | `10000` | 最低提现金额（分），10000 = 100元 |
| `settlementDays` | `number` | `7` | 佣金结算天数，订单完成后等待 N 天确认佣金 |

> **注意：** 佣金比例使用万分之精度，便于精确计算。例如 10% = 1000/10000，5% = 500/10000。

---

## 数据模型

### Distributor（分销商）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 分销商唯一标识 |
| `customerId` | `ID` | 关联客户 ID |
| `parentId` | `ID` | 上级分销商 ID（间推关系） |
| `level` | `Int` | 分销层级 |
| `status` | `DistributorStatus` | 分销商状态：`active` / `frozen` / `pending` |
| `totalEarnings` | `Int` | 累计收益（分） |
| `availableBalance` | `Int` | 可用余额（分） |
| `frozenBalance` | `Int` | 冻结余额（分，结算中的佣金） |
| `referralCode` | `String` | 推荐码 |
| `channels` | `Channel[]` | 所属渠道 |

### CommissionRecord（佣金记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 记录唯一标识 |
| `distributorId` | `ID` | 分销商 ID |
| `orderId` | `ID` | 关联订单 ID |
| `commissionType` | `CommissionType` | 佣金类型：`direct` / `indirect` |
| `commissionRate` | `Int` | 佣金比例（万分之） |
| `orderAmount` | `Int` | 订单金额（分） |
| `commissionAmount` | `Int` | 佣金金额（分） |
| `status` | `CommissionStatus` | 佣金状态：`pending` / `confirmed` / `paid` / `cancelled` |
| `settledAt` | `DateTime` | 结算时间 |

### WithdrawalRequest（提现申请）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | 申请唯一标识 |
| `distributorId` | `ID` | 分销商 ID |
| `amount` | `Int` | 提现金额（分） |
| `method` | `WithdrawalMethod` | 提现方式：`bank` / `alipay` / `wechat` |
| `accountInfo` | `JSON` | 账户信息（银行卡号/支付宝账号/微信账号） |
| `status` | `WithdrawalStatus` | 提现状态：`pending` / `approved` / `rejected` / `paid` |
| `reviewedAt` | `DateTime` | 审核时间 |
| `paidAt` | `DateTime` | 打款时间 |

### Channel 自定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `distributionEnabled` | `Boolean` | 是否启用分销功能 |
| `directCommissionRate` | `Int` | 渠道级直推佣金比例（万分之） |
| `indirectCommissionRate` | `Int` | 渠道级间推佣金比例（万分之） |
| `minWithdrawalAmount` | `Int` | 渠道级最低提现金额（分） |
| `settlementDays` | `Int` | 渠道级佣金结算天数 |

### Customer 自定义字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `distributorId` | `ID` | 关联分销商 ID |
| `referralBy` | `ID` | 推荐人分销商 ID |

### 枚举

**DistributorStatus：**

| 值 | 说明 |
|----|------|
| `active` | 正常 |
| `frozen` | 冻结 |
| `pending` | 待审核 |

**CommissionType：**

| 值 | 说明 |
|----|------|
| `direct` | 直推佣金（直接推荐的下级产生的订单） |
| `indirect` | 间推佣金（下级的下级产生的订单） |

**CommissionStatus：**

| 值 | 说明 |
|----|------|
| `pending` | 待结算（订单完成但未到结算期） |
| `confirmed` | 已确认（结算期已过，佣金到账） |
| `paid` | 已提现（佣金已通过提现发放） |
| `cancelled` | 已取消（订单退款等原因取消佣金） |

**WithdrawalMethod：**

| 值 | 说明 |
|----|------|
| `bank` | 银行卡 |
| `alipay` | 支付宝 |
| `wechat` | 微信 |

**WithdrawalStatus：**

| 值 | 说明 |
|----|------|
| `pending` | 待审核 |
| `approved` | 已审核 |
| `rejected` | 已拒绝 |
| `paid` | 已打款 |

---

## GraphQL API 参考

### Admin API

#### Query

**查询分销商列表**

```graphql
query GetDistributors($options: DistributorListOptions) {
  distributors(options: $options) {
    items {
      id
      customerId
      parentId
      level
      status
      totalEarnings
      availableBalance
      frozenBalance
      referralCode
    }
    totalItems
  }
}
```

**查询佣金记录**

```graphql
query GetCommissionRecords($options: CommissionRecordListOptions) {
  commissionRecords(options: $options) {
    items {
      id
      distributorId
      orderId
      commissionType
      commissionRate
      orderAmount
      commissionAmount
      status
      settledAt
    }
    totalItems
  }
}
```

**查询提现申请**

```graphql
query GetWithdrawalRequests($options: WithdrawalRequestListOptions) {
  withdrawalRequests(options: $options) {
    items {
      id
      distributorId
      amount
      method
      accountInfo
      status
      reviewedAt
      paidAt
    }
    totalItems
  }
}
```

#### Mutation

**审核通过分销商申请**

```graphql
mutation ApproveDistributor($id: ID!) {
  approveDistributor(id: $id) {
    id
    status
  }
}
```

**冻结分销商**

```graphql
mutation FreezeDistributor($id: ID!) {
  freezeDistributor(id: $id) {
    id
    status
  }
}
```

**审核通过提现申请**

```graphql
mutation ApproveWithdrawal($id: ID!) {
  approveWithdrawal(id: $id) {
    id
    status
    reviewedAt
  }
}
```

**拒绝提现申请**

```graphql
mutation RejectWithdrawal($id: ID!) {
  rejectWithdrawal(id: $id) {
    id
    status
    reviewedAt
  }
}
```

**标记提现已打款**

```graphql
mutation MarkWithdrawalPaid($id: ID!) {
  markWithdrawalPaid(id: $id) {
    id
    status
    paidAt
  }
}
```

### Shop API

#### Query

**查询我的分销商资料**

```graphql
query GetMyDistributorProfile {
  myDistributorProfile {
    id
    status
    level
    totalEarnings
    availableBalance
    frozenBalance
    referralCode
  }
}
```

**查询我的佣金记录**

```graphql
query GetMyCommissionRecords {
  myCommissionRecords {
    id
    commissionType
    commissionRate
    orderAmount
    commissionAmount
    status
    settledAt
  }
}
```

**查询我的提现记录**

```graphql
query GetMyWithdrawalRequests {
  myWithdrawalRequests {
    id
    amount
    method
    accountInfo
    status
    reviewedAt
    paidAt
  }
}
```

#### Mutation

**申请成为分销商**

```graphql
mutation ApplyDistributor {
  applyDistributor {
    id
    status
    referralCode
  }
}
```

**申请提现**

```graphql
mutation RequestWithdrawal($amount: Int!, $method: WithdrawalMethod!, $accountInfo: JSON!) {
  requestWithdrawal(amount: $amount, method: $method, accountInfo: $accountInfo) {
    id
    amount
    method
    status
  }
}
```

变量示例（支付宝提现）：

```json
{
  "amount": 10000,
  "method": "alipay",
  "accountInfo": {
    "account": "user@example.com",
    "realName": "张三"
  }
}
```

变量示例（银行卡提现）：

```json
{
  "amount": 50000,
  "method": "bank",
  "accountInfo": {
    "bankName": "中国工商银行",
    "branchName": "北京朝阳支行",
    "accountNo": "6222021234567890123",
    "realName": "张三"
  }
}
```

---

## 业务流程详解

### 分销商注册流程

1. **用户申请**：用户通过 Shop API 调用 `applyDistributor`，状态设为 `pending`
2. **管理员审核**：管理员通过 Admin API 调用 `approveDistributor`，状态变为 `active`
3. **生成推荐码**：审核通过后自动生成唯一 `referralCode`
4. **建立层级关系**：若用户通过推荐码注册，自动建立 `parentId` 关联

### 佣金计算流程

1. **用户下单**：被推荐的用户完成订单支付
2. **直推佣金**：订单完成后，为直接推荐人（`parentId`）创建 `direct` 类型的佣金记录
3. **间推佣金**：若直接推荐人也有上级，为上级创建 `indirect` 类型的佣金记录
4. **佣金金额计算**：
   - 直推佣金 = 订单金额 × 直推佣金比例（万分之）
   - 间推佣金 = 订单金额 × 间推佣金比例（万分之）
5. **佣金状态**：初始状态为 `pending`（待结算），佣金金额计入 `frozenBalance`

### 佣金结算流程

1. **结算等待**：订单完成后等待 `settlementDays` 天（防止退款）
2. **自动结算**：到达结算时间后，佣金状态变为 `confirmed`
3. **余额转移**：佣金金额从 `frozenBalance` 转移到 `availableBalance`
4. **退款处理**：若订单在结算期内退款，佣金状态变为 `cancelled`，释放冻结金额

### 提现流程

1. **分销商申请**：分销商调用 `requestWithdrawal`，指定金额、提现方式和账户信息
2. **余额校验**：校验 `availableBalance >= amount` 且 `amount >= minWithdrawalAmount`
3. **冻结金额**：申请提现后，提现金额从 `availableBalance` 转入 `frozenBalance`
4. **管理员审核**：
   - 通过 `approveWithdrawal`：状态变为 `approved`
   - 通过 `rejectWithdrawal`：状态变为 `rejected`，金额退回 `availableBalance`
5. **确认打款**：管理员线下打款后调用 `markWithdrawalPaid`，状态变为 `paid`

### 分销层级关系

```
分销商 A（顶级，level=1）
  └── 分销商 B（A 的直推，level=2，parentId=A.id）
        └── 分销商 C（B 的直推，level=3，parentId=B.id）
```

- C 的订单产生佣金：B 获得直推佣金，A 获得间推佣金
- B 的订单产生佣金：A 获得直推佣金，无间推佣金

---

## 与其他插件集成

### 渠道级配置

分销插件通过 Channel 自定义字段支持渠道级独立配置，不同渠道可设置不同的佣金比例和提现规则：

```ts
// 在 Channel 配置中设置
{
  distributionEnabled: true,
  directCommissionRate: 1500,     // 该渠道直推佣金 15%
  indirectCommissionRate: 800,    // 该渠道间推佣金 8%
  minWithdrawalAmount: 20000,     // 该渠道最低提现 200元
  settlementDays: 14,             // 该渠道结算期 14天
}
```

**优先级：** 渠道级配置 > 插件全局配置

### Dashboard UI 扩展

插件自动在 Dashboard 中添加分销管理页面，支持：
- 分销商列表查看与状态管理（审核/冻结）
- 佣金记录查看与筛选
- 提现申请审核（通过/拒绝/标记打款）
- 分销层级关系可视化
- 渠道级分销配置

---

## 注意事项

1. **合规风险**：分销层级建议不超过 2 级（直推 + 间推），超过 2 级可能涉及传销法律风险
2. **佣金精度**：佣金比例使用万分之精度，计算时注意整数除法的精度损失，建议先乘后除
3. **结算周期**：`settlementDays` 应根据业务退款率合理设置，过短可能导致退款后佣金已结算
4. **提现安全**：`accountInfo` 包含敏感信息，API 返回时应做脱敏处理
5. **冻结余额**：提现申请后金额会冻结，确保分销商不会重复提现
6. **退款处理**：订单退款时需同步取消对应的佣金记录，已结算的佣金需从余额中扣回
7. **推荐码唯一性**：`referralCode` 需保证全局唯一，建议使用短链算法生成
8. **渠道隔离**：分销商和佣金记录支持多渠道，不同渠道的分销体系相互独立
9. **并发控制**：佣金计算和提现操作需注意并发安全，避免余额计算错误
10. **数据迁移**：安装插件后需运行数据库迁移以创建相关表和自定义字段
