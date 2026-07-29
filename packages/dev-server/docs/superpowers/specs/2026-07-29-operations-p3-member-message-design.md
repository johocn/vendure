# Operations P3 会员管理 + 消息群发模块设计

> 运营模块第三阶段（P3）：为运营人员提供移动端会员管理（查看/调积分/调成长值/等级配置）与消息群发（站内信 + uniPush App 推送）能力。复用已存在的 `@vendure/member-level-plugin`，新建 `@vendure/message-plugin`。

**Date:** 2026-07-29
**Status:** Approved
**Scope:** P3 — 会员管理（扩展 member-level-plugin admin 侧） + 消息群发（新建 message-plugin）

## 0. 前置调研结论

| 项 | 现状 | P3 动作 |
|---|---|---|
| member-level-plugin admin resolver | 已有 3 个 API：`memberInfo(customerId)`、`pointsHistory(customerId, options)`、`adjustPoints(customerId, amount, remark)`，权限用 `ReadCustomer`/`UpdateCustomer` | 新增 `members(options)` 列表、`adjustMemberGrowth` mutation、`updateLevelConfig` mutation；现有 3 个 API 权限改为 `ManageMember` |
| channel.customFields | 已有 level1~5Threshold/Name、pointsEarnRatio、pointsEarnOnShipping 共 12 字段 | 新增 `updateLevelConfig` mutation 编辑这些字段（通过 ChannelService.updateChannel） |
| customer.customFields | 有 growthValue/points/memberLevel，**无 tags 字段** | 消息群发人群筛选不依赖 tags，简化为：全员 / 按会员等级（1-5） |
| 消息群发基础设施 | 无 | 新建 `@vendure/message-plugin`（Message 广播表 + MessageDelivery 投递表 + JobQueue 异步发送） |
| uniPush 集成 | 无 | message-plugin 自定义 channel.customFields（uniPush AppKey/MasterSecret）+ customer.customFields（pushCid），保持插件独立性 |

## 1. 目标

1. **会员管理**：运营在移动端查看会员列表/详情、手动调整积分与成长值、编辑等级配置
2. **消息群发**：运营在移动端创建消息（站内信/App 推送）、选择目标人群（全员/按等级）、异步发送、查看投递统计
3. **权限隔离**：新增 2 个权限 `ManageMember` / `ManageMessage`
4. **前端集成**：vadmin 新增 2 个子包 `pkg-member`（5 页）+ `pkg-message`（3 页）

## 2. 非目标（YAGNI 排除）

- ❌ 消息群发按自定义标签筛选人群（customer 无 tags 字段，仅支持全员/按等级）
- ❌ 微信模板消息/短信渠道（仅站内信 + uniPush）
- ❌ 消息定时发送（仅立即发送，定时发送留后续）
- ❌ 消息草稿协作编辑（单用户编辑即可）
- ❌ 积分过期规则配置（已有 expiresAt 字段但规则硬编码在 service）
- ❌ 会员等级权益配置（等级仅有阈值+名称，权益另算）
- ❌ 站内信已读回执 WebSocket 实时推送（C 端轮询足够）

## 3. 架构

### 3.1 两个独立子系统

| 子系统 | 后端插件 | 前端子包 | 权限 |
|---|---|---|---|
| 会员管理 | 扩展 `@vendure/member-level-plugin` | `pkg-member`（5 页） | `ManageMember` |
| 消息群发 | 新建 `@vendure/message-plugin` | `pkg-message`（3 页） | `ManageMessage` |

### 3.2 member-level-plugin 扩展

```
packages/member-level-plugin/src/
├── member-level-admin.resolver.ts   # 扩展：新增 members/adjustMemberGrowth/updateLevelConfig，改权限
├── member-level.service.ts          # 扩展：新增 findAllMembers（ListQueryBuilder）、updateLevelConfig
├── channel-custom-fields.ts         # 不变（已有 level1~5 配置）
├── customer-custom-fields.ts        # 不变（pushCid 由 message-plugin 定义）
└── plugin.ts                        # 扩展：adminSchema 追加新 type/mutation
```

### 3.3 message-plugin 新建

```
packages/message-plugin/
├── package.json / tsconfig.json
├── index.ts                          # Barrel exports
├── src/
│   ├── constants.ts                  # loggerCtx, MESSAGE_PLUGIN_OPTIONS
│   ├── types.ts                      # MessagePluginOptions
│   ├── channel-custom-fields.ts      # uniPush AppKey/MasterSecret
│   ├── customer-custom-fields.ts     # pushCid（个推客户端标识）
│   ├── entities/
│   │   ├── message.entity.ts         # Message 广播主记录
│   │   └── message-delivery.entity.ts # MessageDelivery 投递记录
│   ├── message.service.ts            # CRUD + 发送逻辑
│   ├── message-push.service.ts       # uniPush 集成（个推 REST API）
│   ├── message-admin.resolver.ts     # admin-api
│   ├── message-shop.resolver.ts      # shop-api（C 端站内信）
│   ├── message-job.ts                # JobQueue 定义（send-message）
│   └── plugin.ts                     # Plugin 入口
```

### 3.4 权限注册

在 `delivery-plugin/constants.ts` 注册（沿用 P1/P2 模式）：
- `ManageMember`（新增，当前未定义）
- `ManageMessage`（已定义，已在 manager/super-admin 中）

**需修改的位置：**
1. `DeliveryPermissions` 对象追加 `ManageMember: 'ManageMember'`
2. `PERMISSION_DESCRIPTIONS` 追加 `ManageMember: '会员管理'`
3. `ROLE_PERMISSIONS_MAP.operations-staff` 追加 `'ManageMember', 'ManageMessage'`（两者都缺）
4. `MODULE_CONFIGS` 的 ops 模块 perms 追加 `'ManageMember', 'ManageMessage'`

**破坏性变更标注：**
member-level-plugin 现有 3 个 admin API（memberInfo/pointsHistory/adjustPoints）权限从 `ReadCustomer`/`UpdateCustomer` 改为 `ManageMember`。原来有 ReadCustomer/UpdateCustomer 但没 ManageMember 的角色（如 sales-staff、customer-service）将无法访问这些 API。这是 P3 的意图（权限细分），需在 RoleSyncService 同步后验证不影响其他模块。

shop-api（myMemberInfo/myPointsHistory）用 `Permission.Authenticated`，不受影响。

## 4. 后端 API

### 4.1 会员管理（member-level-plugin admin-api 扩展）

**新增/修改的 Query/Mutation：**

| 类型 | 名称 | 权限 | 说明 |
|---|---|---|---|
| Query | `members(options)` | `ManageMember` | 会员列表（分页+搜索+等级筛选），新增 |
| Query | `memberInfo(customerId)` | `ManageMember` | 已有，改权限 |
| Query | `pointsHistory(customerId, options)` | `ManageMember` | 已有，改权限 |
| Mutation | `adjustPoints(customerId, amount, remark)` | `ManageMember` | 已有，改权限 |
| Mutation | `adjustMemberGrowth(customerId, amount, source)` | `ManageMember` | 新增，调成长值 |
| Mutation | `updateLevelConfig(input)` | `ManageMember` | 新增，编辑 channel.customFields level1~5 |

**GraphQL Schema（admin 侧追加）：**

```graphql
type MemberListItem {
    customerId: ID!
    emailAddress: String!
    firstName: String
    lastName: String
    level: Int!
    levelName: String!
    growthValue: Int!
    points: Int!
    createdAt: DateTime!
}

type MemberList implements PaginatedList {
    items: [MemberListItem!]!
    totalItems: Int!
}

input MemberListOptions {
    skip: Int
    take: Int
    filter: MemberFilter
}

input MemberFilter {
    emailAddress: String
    level: Int
}

input UpdateLevelConfigInput {
    level1Threshold: Int
    level1Name: String
    level2Threshold: Int
    level2Name: String
    level3Threshold: Int
    level3Name: String
    level4Threshold: Int
    level4Name: String
    level5Threshold: Int
    level5Name: String
    pointsEarnRatio: Float
    pointsEarnOnShipping: Boolean
}

type LevelConfig {
    level1Threshold: Int!
    level1Name: String!
    level2Threshold: Int!
    level2Name: String!
    level3Threshold: Int!
    level3Name: String!
    level4Threshold: Int!
    level4Name: String!
    level5Threshold: Int!
    level5Name: String!
    pointsEarnRatio: Float!
    pointsEarnOnShipping: Boolean!
}

extend type Query {
    members(options: MemberListOptions): MemberList!
    levelConfig: LevelConfig!
}

extend type Mutation {
    adjustMemberGrowth(customerId: ID!, amount: Int!, source: String): MemberInfo!
    updateLevelConfig(input: UpdateLevelConfigInput!): LevelConfig!
}
```

**Service 新增方法：**

```typescript
// member-level.service.ts
async findAllMembers(ctx, options: MemberListOptions): Promise<PaginatedList<MemberListItem>>
async updateLevelConfig(ctx, input: UpdateLevelConfigInput): Promise<LevelConfig>
async getLevelConfig(ctx): Promise<LevelConfig>  // 读取 channel.customFields
```

`findAllMembers` 用 `ListQueryBuilder.build(Customer, ...)`，select 含 customFields.memberLevel/growthValue/points，filter 支持 emailAddress（like）+ level（customFields.memberLevel =）。

`updateLevelConfig` 通过 `ChannelService.updateChannel` 更新 ctx.channelId 的 customFields。

### 4.2 消息群发（message-plugin admin-api）

**实体设计：**

```typescript
// message.entity.ts
@Entity()
export class Message extends VendureEntity {
    id: ID;
    title: string;                    // 消息标题
    body: string;                     // 消息正文（纯文本）
    deliveryChannel: 'inapp' | 'push'; // 投递渠道（避免与 Vendure Channel 概念冲突）
    audienceType: 'all' | 'level';    // 人群类型
    audienceLevel?: number;           // 当 audienceType=level 时，目标等级 1-5
    status: 'draft' | 'pending' | 'sending' | 'sent' | 'failed';
    totalTarget: number;              // 目标人数
    totalSent: number;                // 成功发送数
    totalFailed: number;              // 失败数
    createdAt: DateTime;
    sentAt?: DateTime;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];              // 多租户关联（Vendure Channel）
}

// message-delivery.entity.ts
@Entity()
@Index(['messageId', 'customerId'])   // 群发查询核心索引
@Index(['customerId', 'readAt'])      // C 端未读查询索引
export class MessageDelivery extends VendureEntity {
    id: ID;
    messageId: ID;
    customerId: ID;
    deliveryStatus: 'pending' | 'sent' | 'failed';  // 投递状态（站内信和推送共用）
    deliveryError?: string;           // 失败原因
    readAt?: DateTime;                // 站内信已读时间
    createdAt: DateTime;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

**实体继承 VendureEntity**（含 id/createdAt/updatedAt/deletedAt 基础字段），多租户用 `@ManyToMany(() => Channel) + @JoinTable()`（Vendure 标准模式）。

**admin Query/Mutation：**

```graphql
type Message {
    id: ID!
    title: String!
    body: String!
    deliveryChannel: String!
    audienceType: String!
    audienceLevel: Int
    status: String!
    totalTarget: Int!
    totalSent: Int!
    totalFailed: Int!
    createdAt: DateTime!
    sentAt: DateTime
}

type MessageList implements PaginatedList {
    items: [Message!]!
    totalItems: Int!
}

input CreateMessageInput {
    title: String!
    body: String!
    deliveryChannel: String!
    audienceType: String!
    audienceLevel: Int
}

input UpdateMessageInput {
    title: String
    body: String
    deliveryChannel: String
    audienceType: String
    audienceLevel: Int
}

type MessageDeliveryStats {
    totalTarget: Int!
    totalSent: Int!
    totalFailed: Int!
    totalRead: Int!
}

extend type Query {
    messages(options: JSON): MessageList!
    message(id: ID!): Message
    messageDeliveryStats(id: ID!): MessageDeliveryStats!
}

extend type Mutation {
    createMessage(input: CreateMessageInput!): Message!
    updateMessage(id: ID!, input: UpdateMessageInput!): Message!
    deleteMessage(id: ID!): Boolean!
    sendMessage(id: ID!): Message!  # 触发 JobQueue
}
```

**shop-api（C 端站内信查看，供后续 pkg-common 用）：**

```graphql
type MyMessage {
    id: ID!
    messageId: ID!
    title: String!
    body: String!
    readAt: DateTime
    createdAt: DateTime!
}

type MyMessageList implements PaginatedList {
    items: [MyMessage!]!
    totalItems: Int!
}

extend type Query {
    myMessages(options: JSON): MyMessageList!
    myUnreadMessageCount: Int!
}

extend type Mutation {
    markMessageRead(id: ID!): Boolean!
}
```

### 4.3 发送流程（JobQueue）

1. 运营调用 `sendMessage(id)` → 校验 `ManageMessage` 权限
2. Message.status 置 `sending`，写入 JobQueue（jobName: `send-message`，data: `{ messageId }`）
3. Worker 消费：
   - 按 `audienceType` 查询目标 Customer：
     - `all`：`SELECT id FROM customer WHERE deletedAt IS NULL`
     - `level`：`SELECT id FROM customer WHERE customFields_memberLevel = :level AND deletedAt IS NULL`
   - 分批处理（每批 500），逐个：
     - 创建 `MessageDelivery`（deliveryStatus=pending）
     - 站内信（deliveryChannel=inapp）：直接置 deliveryStatus=sent
     - App 推送（deliveryChannel=push）：调 `MessagePushService.sendPush(customerId, title, body)`，成功置 sent，失败置 failed + deliveryError
   - 更新 Message.totalSent/totalFailed
4. 全部完成，Message.status 置 `sent`，sentAt = now

### 4.4 uniPush 集成

**channel.customFields 新增（message-plugin/src/channel-custom-fields.ts）：**
```typescript
{
    Channel: [
        { name: 'uniPushAppKey', type: 'string', label: 'uniPush AppKey' },
        { name: 'uniPushMasterSecret', type: 'string', label: 'uniPush MasterSecret' },
    ]
}
```

**customer.customFields 新增（message-plugin/src/customer-custom-fields.ts）：**
```typescript
{
    Customer: [
        { name: 'pushCid', type: 'string', label: '个推客户端标识' },
    ]
}
```

**MessagePushService：**
```typescript
// message-push.service.ts
async sendPush(ctx, customerId, title, body): Promise<void>
// 1. 查 customer.customFields.pushCid
// 2. 查 channel.customFields.uniPushAppKey/MasterSecret
// 3. 若任一缺失，跳过（降级为仅站内信）
// 4. 调个推 REST API：POST https://restapi.getui.com/v2/{appKey}/push/single/cid
//    body: { request_id: uuid, audience: { cid: [pushCid] }, push_message: { notification: { title, body } } }
//    header: token = getToken(appKey, masterSecret)  // 个推鉴权
// 5. 失败抛错，由调用方捕获记录 deliveryError
```

uniPush 凭证缺失时降级策略：消息仍创建 MessageDelivery（deliveryStatus=sent），但不实际推送。日志 warn。

## 5. 前端

### 5.1 pkg-member（5 页）

| 页面 | 路径 | 功能 |
|---|---|---|
| 会员列表 | `pkg-member/pages/list/index` | 分页列表+搜索框+等级筛选 |
| 会员详情 | `pkg-member/pages/detail/index?id=` | 基本信息+等级+积分+成长值，入口跳转积分历史/调整 |
| 积分历史 | `pkg-member/pages/detail/points-history?id=` | 分页列表，展示时间/类型/金额/余额/备注 |
| 调整积分 | `pkg-member/pages/detail/adjust?id=` | 表单：调整类型（积分/成长值）+金额+备注，提交确认 |
| 等级配置 | `pkg-member/pages/level-config/index` | 5 级阈值+名称+积分比例+运费积分开关 |

### 5.2 pkg-message（3 页）

| 页面 | 路径 | 功能 |
|---|---|---|
| 消息列表 | `pkg-message/pages/list/index` | 分页列表+状态筛选（草稿/已发送/发送中） |
| 消息详情 | `pkg-message/pages/detail/index?id=` | 编辑标题/正文/渠道/人群，发送按钮 |
| 投递统计 | `pkg-message/pages/detail/stats?id=` | 目标/已发送/失败/已读统计 |

### 5.3 shortcuts.ts 与 pages.json

shortcuts.ts 新增 2 项：
```typescript
{ code: 'member-list', name: '会员', icon: '👥', perm: 'ManageMember', route: '/pkg-member/pages/list/index', enabled: true },
{ code: 'message-list', name: '群发', icon: '📣', perm: 'ManageMessage', route: '/pkg-message/pages/list/index', enabled: true },
```

pages.json 新增 2 个 subPackage：`pkg-member`、`pkg-message`。

### 5.4 前端 API client 组织

```
vadmin/src/
├── pkg-member/
│   ├── api/member.ts          # 会员管理 API（members/memberInfo/adjustPoints/adjustMemberGrowth/pointsHistory/levelConfig）
│   └── pages/...
├── pkg-message/
│   ├── api/message.ts         # 消息群发 API（messages/message/createMessage/updateMessage/deleteMessage/sendMessage/messageDeliveryStats）
│   └── pages/...
```

沿用 pkg-ops/api/operations.ts 的模式：`getClient().request(query, variables)`。

### 5.5 message-plugin 与 member-level-plugin 的关系

message-plugin **不依赖** member-level-plugin（无需 imports）。查询目标人群时直接用 `TransactionalConnection` 查 `customer` 表的 `customFields_memberLevel` 列（Vendure customFields 按列存储），不需要注入 MemberLevelService。

## 6. 关键风险点

1. **uniPush 凭证**：测试环境可能未开通 uniPush。降级策略：凭证缺失时仅站内信，不阻塞发送流程。E2E 测试用站内信渠道验证，App 推送做 mock 验证。
2. **ChannelService.updateChannel 更新 customFields**：需确认 Vendure 3.6 的 updateChannel 是否支持 customFields 更新。若不支持，直接用 TransactionalConnection 写 channel 表。
3. **ListQueryBuilder 查询 customFields**：Vendure customFields 按列存储（`customFields_memberLevel`），ListQueryBuilder filter 需用 `customFields: { memberLevel: 1 }` 语法。
4. **JobQueue 注册**：需在 dev-config.ts 的 `jobQueueOptions` 注册 `send-message` job，或用默认 SQL JobQueue。
5. **大规模群发**：10w 用户群发时 JobQueue 分批处理（每批 500），单批事务提交，避免长事务。

## 7. 测试计划

### 7.1 测试账号

复用 `marketing1@zhao.test`（已有 operations-staff 角色，将追加 ManageMember/ManageMessage 权限）。

### 7.2 E2E 测试用例（10 组）

1. 权限同步验证（operations-staff 含 2 个新权限）
2. 等级配置读取（levelConfig query）
3. 等级配置更新（updateLevelConfig mutation）
4. 会员列表查询（分页+等级筛选）
5. 会员详情查询（memberInfo）
6. 调整积分（adjustPoints）
7. 调整成长值（adjustMemberGrowth）
8. 积分历史查询（pointsHistory）
9. 消息 CRUD（create/update/delete）
10. 消息发送流程（sendMessage → 站内信投递 → 投递统计）
