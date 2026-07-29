# Operations P3 会员管理 + 消息群发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为运营人员提供移动端会员管理（查看/调积分/调成长值/等级配置）与消息群发（站内信 + uniPush App 推送）能力。

**Architecture:** 扩展 `@vendure/member-level-plugin`（admin 侧新增 members 列表/adjustMemberGrowth/updateLevelConfig），新建 `@vendure/message-plugin`（广播+投递表模式，JobQueue 异步发送，uniPush 集成含降级策略）。前端新建 `pkg-member`（5 页）+ `pkg-message`（3 页）两个子包。

**Tech Stack:** Vendure 3.6 + TypeORM + NestJS GraphQL + JobQueue + uni-app + graphql-request

---

## File Structure

### 后端 — member-level-plugin 扩展

```
packages/member-level-plugin/src/
├── member-level.service.ts          # 修改：新增 findAllMembers/getLevelConfig/updateLevelConfig
├── member-level-admin.resolver.ts   # 修改：新增 members/adjustMemberGrowth/updateLevelConfig/levelConfig，改权限
├── plugin.ts                        # 修改：adminSchema 追加新 type/input/mutation
└── index.ts                         # 修改：导出 MemberListItem 类型（如需要）
```

### 后端 — message-plugin 新建

```
packages/message-plugin/
├── package.json
├── tsconfig.json
├── index.ts
├── src/
│   ├── constants.ts
│   ├── types.ts
│   ├── channel-custom-fields.ts     # uniPush AppKey/MasterSecret
│   ├── customer-custom-fields.ts    # pushCid
│   ├── entities/
│   │   ├── message.entity.ts
│   │   └── message-delivery.entity.ts
│   ├── message-push.service.ts      # uniPush 集成
│   ├── message.service.ts           # CRUD + 发送逻辑
│   ├── message-job.ts               # JobQueue
│   ├── message-admin.resolver.ts
│   ├── message-shop.resolver.ts
│   └── plugin.ts
```

### 后端 — 现有文件修改

```
packages/delivery-plugin/src/constants.ts          # 追加 ManageMember 权限
packages/dev-server/dev-config.ts                  # 注册 MessagePlugin
```

### 前端

```
vadmin/src/
├── pkg-member/
│   ├── api/member.ts
│   └── pages/
│       ├── list/index.vue
│       ├── detail/index.vue
│       ├── detail/points-history.vue
│       ├── detail/adjust.vue
│       └── level-config/index.vue
├── pkg-message/
│   ├── api/message.ts
│   └── pages/
│       ├── list/index.vue
│       ├── detail/index.vue
│       └── detail/stats.vue
├── config/shortcuts.ts                            # 追加 2 项
└── pages.json                                      # 追加 2 个 subPackage
```

### 测试

```
vendure/
├── reset-p3-pwd.js                                 # 测试账号脚本
└── test-p3-flow.js                                 # E2E 测试脚本
```

---

## Task 1: 权限注册

**Files:**
- Modify: `packages/delivery-plugin/src/constants.ts`

- [ ] **Step 1: 追加 ManageMember 到 DeliveryPermissions**

在 `DeliveryPermissions` 对象的 `ManageCoupon: 'ManageCoupon',` 后追加：

```typescript
  ManageMember: 'ManageMember',
```

- [ ] **Step 2: 追加 ManageMember 描述到 PERMISSION_DESCRIPTIONS**

在 `ManageCoupon: '优惠券管理',` 后追加：

```typescript
  ManageMember: '会员管理',
```

- [ ] **Step 3: operations-staff 角色追加权限**

将 `ROLE_PERMISSIONS_MAP.operations-staff` 改为：

```typescript
  'operations-staff':   ['Authenticated', 'ViewDashboard', 'ManageBanner', 'ManageRecommendation', 'ManageNotice', 'ManageFloor', 'ManagePromotion', 'ManageContent', 'ManageFlashSale', 'ManageGroupBuy', 'ManageCoupon', 'ManageMember', 'ManageMessage'],
```

- [ ] **Step 4: MODULE_CONFIGS ops 模块追加权限**

将 ops 模块的 perms 改为：

```typescript
  { code: 'ops',       name: '运营',  enabled: true,  entryPath: '/pkg-ops/pages/dashboard/index', icon: '📊', sort: 50, perms: ['ViewDashboard','ManageBanner','ManageRecommendation','ManageNotice','ManageFloor','ManagePromotion','ManageContent','ManageMember','ManageMessage'] },
```

- [ ] **Step 5: 构建 delivery-plugin**

```bash
cd e:\code\vendure\packages\delivery-plugin && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd e:\code\vendure && git add packages/delivery-plugin/src/constants.ts && git commit -m "feat: add ManageMember permission and grant to operations-staff" --no-verify
```

---

## Task 2: member-level.service.ts 扩展

**Files:**
- Modify: `packages/member-level-plugin/src/member-level.service.ts`

- [ ] **Step 1: 追加 import**

在文件顶部 import 中追加 `ChannelService`：

```typescript
import {
    Channel,
    ChannelService,
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';
```

- [ ] **Step 2: 构造函数注入 ChannelService**

将构造函数改为：

```typescript
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
        private channelService: ChannelService,
    ) {}
```

- [ ] **Step 3: 追加 findAllMembers 方法**

在 `getMemberInfo` 方法前追加：

```typescript
    async findAllMembers(
        ctx: RequestContext,
        options?: ListQueryOptions<Customer>,
    ): Promise<PaginatedList<any>> {
        return this.listQueryBuilder
            .build(Customer, options, {
                ctx,
                relations: ['channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(c => {
                    const cf = (c as any).customFields ?? {};
                    const level = cf.memberLevel ?? 1;
                    return {
                        customerId: c.id,
                        emailAddress: c.emailAddress,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        level,
                        levelName: this.getLevelName(ctx, level),
                        growthValue: cf.growthValue ?? 0,
                        points: cf.points ?? 0,
                        createdAt: c.createdAt,
                    };
                }),
                totalItems,
            }));
    }

    async getLevelConfig(ctx: RequestContext): Promise<any> {
        const cf = (ctx.channel as any).customFields ?? {};
        return {
            level1Threshold: cf.level1Threshold ?? 0,
            level1Name: cf.level1Name ?? '普通会员',
            level2Threshold: cf.level2Threshold ?? 1000,
            level2Name: cf.level2Name ?? '银卡会员',
            level3Threshold: cf.level3Threshold ?? 5000,
            level3Name: cf.level3Name ?? '金卡会员',
            level4Threshold: cf.level4Threshold ?? 20000,
            level4Name: cf.level4Name ?? '白金会员',
            level5Threshold: cf.level5Threshold ?? 100000,
            level5Name: cf.level5Name ?? '钻石会员',
            pointsEarnRatio: cf.pointsEarnRatio ?? 1,
            pointsEarnOnShipping: cf.pointsEarnOnShipping ?? false,
        };
    }

    async updateLevelConfig(ctx: RequestContext, input: any): Promise<any> {
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        if (!channel) {
            throw new EntityNotFoundError('Channel', ctx.channelId);
        }
        const updated = await this.channelService.update(ctx, {
            id: ctx.channelId,
            customFields: {
                level1Threshold: input.level1Threshold,
                level1Name: input.level1Name,
                level2Threshold: input.level2Threshold,
                level2Name: input.level2Name,
                level3Threshold: input.level3Threshold,
                level3Name: input.level3Name,
                level4Threshold: input.level4Threshold,
                level4Name: input.level4Name,
                level5Threshold: input.level5Threshold,
                level5Name: input.level5Name,
                pointsEarnRatio: input.pointsEarnRatio,
                pointsEarnOnShipping: input.pointsEarnOnShipping,
            },
        });
        return this.getLevelConfig(ctx);
    }
```

- [ ] **Step 4: 构建 member-level-plugin**

```bash
cd e:\code\vendure\packages\member-level-plugin && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd e:\code\vendure && git add packages/member-level-plugin/src/member-level.service.ts && git commit -m "feat(member-level): add findAllMembers/getLevelConfig/updateLevelConfig" --no-verify
```

---

## Task 3: member-level-admin.resolver.ts 扩展 + plugin.ts schema

**Files:**
- Modify: `packages/member-level-plugin/src/member-level-admin.resolver.ts`
- Modify: `packages/member-level-plugin/src/plugin.ts`

- [ ] **Step 1: 重写 member-level-admin.resolver.ts**

替换整个文件内容：

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';

import { DeliveryPermissions } from '@vendure/delivery-plugin';
import { MemberLevelService } from './member-level.service';

@Resolver()
export class MemberLevelAdminResolver {
    constructor(private memberLevelService: MemberLevelService) {}

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async members(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.memberLevelService.findAllMembers(ctx, options);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async memberInfo(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID): Promise<any> {
        return this.memberLevelService.getMemberInfo(ctx, customerId);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async pointsHistory(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('options', { nullable: true }) options: any,
    ): Promise<any> {
        return this.memberLevelService.getPointsHistory(ctx, customerId, options);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMember as any)
    async levelConfig(@Ctx() ctx: RequestContext): Promise<any> {
        return this.memberLevelService.getLevelConfig(ctx);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMember as any)
    async adjustPoints(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('remark', { nullable: true }) remark?: string,
    ): Promise<any> {
        return this.memberLevelService.adjustPoints(ctx, customerId, amount, remark);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMember as any)
    async adjustMemberGrowth(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: ID,
        @Args('amount') amount: number,
        @Args('source', { nullable: true }) source?: string,
    ): Promise<any> {
        return this.memberLevelService.addGrowthValue(ctx, customerId, amount, source);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMember as any)
    async updateLevelConfig(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.memberLevelService.updateLevelConfig(ctx, input);
    }
}
```

- [ ] **Step 2: 更新 plugin.ts 的 adminSchema**

在 `adminSchema` 的 `extend type Mutation` 块中追加新 mutation，在 `extend type Query` 块中追加新 query。将 adminSchema 替换为：

```typescript
const adminSchema = () => gql`
    type MemberInfo {
        customerId: ID!
        level: Int!
        levelName: String!
        growthValue: Int!
        points: Int!
        nextLevelThreshold: Int
        nextLevelName: String
    }

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

    type MemberPointsHistory implements Node {
        id: ID!
        customerId: ID!
        type: String!
        amount: Int!
        balanceBefore: Int!
        balanceAfter: Int!
        orderId: ID
        remark: String
        expiresAt: DateTime
        createdAt: DateTime!
    }

    type PointsHistoryList implements PaginatedList {
        items: [MemberPointsHistory!]!
        totalItems: Int!
    }

    input PointsHistoryListOptions {
        skip: Int
        take: Int
    }

    extend type Query {
        members(options: JSON): MemberList!
        memberInfo(customerId: ID!): MemberInfo!
        pointsHistory(customerId: ID!, options: PointsHistoryListOptions): PointsHistoryList!
        levelConfig: LevelConfig!
    }

    extend type Mutation {
        adjustPoints(customerId: ID!, amount: Int!, remark: String): MemberInfo!
        adjustMemberGrowth(customerId: ID!, amount: Int!, source: String): MemberInfo!
        updateLevelConfig(input: UpdateLevelConfigInput!): LevelConfig!
    }
`;
```

- [ ] **Step 3: 在 plugin.ts 的 imports 中追加 ChannelService**

在 `@VendurePlugin` 装饰器的 `imports` 数组中追加 `ChannelService`（如果 PluginCommonModule 不自动提供的话）。实际上 ChannelService 是 Vendure core service，通过 ModuleRef 自动可用，无需额外 import。但如果 DI 失败，需在 providers 中追加 `{ provide: ChannelService, useFactory: (injector: Injector) => injector.get(ChannelService) }`。先不加，构建后测试。

- [ ] **Step 4: 在 member-level-plugin/package.json 追加 delivery-plugin 依赖**

在 `dependencies` 中追加：

```json
    "@vendure/delivery-plugin": "1.0.0",
```

- [ ] **Step 5: 构建 member-level-plugin**

```bash
cd e:\code\vendure\packages\member-level-plugin && npm run build
```

- [ ] **Step 6: Commit**

```bash
cd e:\code\vendure && git add packages/member-level-plugin/ && git commit -m "feat(member-level): add admin resolver for members list, level config, growth adjustment" --no-verify
```

---

## Task 4: message-plugin 骨架

**Files:**
- Create: `packages/message-plugin/package.json`
- Create: `packages/message-plugin/tsconfig.json`
- Create: `packages/message-plugin/index.ts`
- Create: `packages/message-plugin/src/constants.ts`
- Create: `packages/message-plugin/src/types.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "@vendure/message-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run",
        "e2e": "cross-env PACKAGE=message-plugin vitest --config vitest.config.mts --run"
    },
    "dependencies": {},
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2"
    }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
    "extends": "../../tsconfig.json",
    "compilerOptions": {
        "outDir": "lib",
        "rootDir": "src",
        "declaration": true
    },
    "include": ["src/**/*", "index.ts"]
}
```

- [ ] **Step 3: 创建 index.ts**

```typescript
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/entities/message.entity';
export * from './src/entities/message-delivery.entity';
```

- [ ] **Step 4: 创建 src/constants.ts**

```typescript
export const loggerCtx = 'MessagePlugin';
export const MESSAGE_PLUGIN_OPTIONS = Symbol('MESSAGE_PLUGIN_OPTIONS');
```

- [ ] **Step 5: 创建 src/types.ts**

```typescript
export interface MessagePluginOptions {
    batchSize?: number;
}

export const DEFAULT_BATCH_SIZE = 500;
```

- [ ] **Step 6: Commit**

```bash
cd e:\code\vendure && git add packages/message-plugin/ && git commit -m "feat(message-plugin): scaffold package structure" --no-verify
```

---

## Task 5: message-plugin customFields + 实体

**Files:**
- Create: `packages/message-plugin/src/channel-custom-fields.ts`
- Create: `packages/message-plugin/src/customer-custom-fields.ts`
- Create: `packages/message-plugin/src/entities/message.entity.ts`
- Create: `packages/message-plugin/src/entities/message-delivery.entity.ts`

- [ ] **Step 1: 创建 channel-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const messageChannelCustomFields: CustomFields = {
    Channel: [
        {
            name: 'uniPushAppKey',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'uniPush AppKey' }],
        },
        {
            name: 'uniPushMasterSecret',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: 'uniPush MasterSecret' }],
        },
    ],
};
```

- [ ] **Step 2: 创建 customer-custom-fields.ts**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';

export const messageCustomerCustomFields: CustomFields = {
    Customer: [
        {
            name: 'pushCid',
            type: 'string',
            label: [{ languageCode: LanguageCode.zh_Hans, value: '个推客户端标识' }],
        },
    ],
};
```

- [ ] **Step 3: 创建 message.entity.ts**

```typescript
import { Channel, ChannelAware, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';

@Entity()
export class Message extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Message>) {
        super(input);
    }

    @Column() title: string;
    @Column({ type: 'text' }) body: string;
    @Column({ default: 'inapp' }) deliveryChannel: 'inapp' | 'push';
    @Column({ default: 'all' }) audienceType: 'all' | 'level';
    @Column({ nullable: true }) audienceLevel?: number;
    @Column({ default: 'draft' }) status: 'draft' | 'pending' | 'sending' | 'sent' | 'failed';
    @Column({ default: 0 }) totalTarget: number;
    @Column({ default: 0 }) totalSent: number;
    @Column({ default: 0 }) totalFailed: number;
    @Column({ type: 'datetime', nullable: true }) sentAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 4: 创建 message-delivery.entity.ts**

```typescript
import { Channel, ChannelAware, DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
@Index(['messageId', 'customerId'])
@Index(['customerId', 'readAt'])
export class MessageDelivery extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MessageDelivery>) {
        super(input);
    }

    @Column() messageId: number;
    @Column() customerId: number;
    @Column({ default: 'pending' }) deliveryStatus: 'pending' | 'sent' | 'failed';
    @Column({ type: 'text', nullable: true }) deliveryError?: string;
    @Column({ type: 'datetime', nullable: true }) readAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
```

- [ ] **Step 5: Commit**

```bash
cd e:\code\vendure && git add packages/message-plugin/ && git commit -m "feat(message-plugin): add customFields and entities (Message + MessageDelivery)" --no-verify
```

---

## Task 6: message-push.service.ts

**Files:**
- Create: `packages/message-plugin/src/message-push.service.ts`

- [ ] **Step 1: 创建 message-push.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { Customer, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { loggerCtx } from './constants';

@Injectable()
export class MessagePushService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * 发送 uniPush 推送。
     * 凭证缺失时降级为 no-op（仅 warn 日志），不抛错。
     */
    async sendPush(ctx: RequestContext, customerId: number, title: string, body: string): Promise<void> {
        const customerRepo = this.connection.getRepository(ctx, Customer);
        const customer = await customerRepo.findOne({ where: { id: customerId as any } });
        if (!customer) {
            throw new Error(`Customer ${customerId} not found`);
        }
        const pushCid = (customer as any).customFields?.pushCid;
        if (!pushCid) {
            Logger.warn(`Customer ${customerId} has no pushCid, skipping push`, loggerCtx);
            return;
        }

        const cf = (ctx.channel as any).customFields ?? {};
        const appKey = cf.uniPushAppKey;
        const masterSecret = cf.uniPushMasterSecret;
        if (!appKey || !masterSecret) {
            Logger.warn(`Channel ${ctx.channelId} has no uniPush credentials, skipping push`, loggerCtx);
            return;
        }

        try {
            const token = await this.getToken(appKey, masterSecret);
            await this.pushSingle(appKey, token, pushCid, title, body);
            Logger.info(`Push sent to customer ${customerId}`, loggerCtx);
        } catch (e: any) {
            Logger.error(`Push failed for customer ${customerId}: ${e.message}`, loggerCtx);
            throw e;
        }
    }

    private async getToken(appKey: string, masterSecret: string): Promise<string> {
        // 个推 REST API v2 鉴权
        const timestamp = Date.now();
        const token = Buffer.from(`${appKey}${timestamp}${masterSecret}`).toString('base64');
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': token },
            body: JSON.stringify({ timestamp: String(timestamp), sign: token }),
        });
        const data: any = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui auth failed: ${data.msg}`);
        }
        return data.data.token;
    }

    private async pushSingle(appKey: string, token: string, cid: string, title: string, body: string): Promise<void> {
        const requestId = crypto.randomUUID();
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/push/single/cid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token },
            body: JSON.stringify({
                request_id: requestId,
                audience: { cid: [cid] },
                push_message: {
                    notification: { title, body, click_type: 'payload' },
                },
            }),
        });
        const data: any = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui push failed: ${data.msg}`);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/message-plugin/src/message-push.service.ts && git commit -m "feat(message-plugin): add MessagePushService with uniPush integration" --no-verify
```

---

## Task 7: message.service.ts

**Files:**
- Create: `packages/message-plugin/src/message.service.ts`

- [ ] **Step 1: 创建 message.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import {
    ID,
    ListQueryBuilder,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Repository } from 'typeorm';

import { loggerCtx } from './constants';
import { MessageDelivery } from './entities/message-delivery.entity';
import { Message } from './entities/message.entity';
import { MessagePushService } from './message-push.service';
import { DEFAULT_BATCH_SIZE } from './types';

@Injectable()
export class MessageService {
    private messageRepo: Repository<Message>;
    private deliveryRepo: Repository<MessageDelivery>;

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private pushService: MessagePushService,
    ) {
        this.messageRepo = this.connection.rawConnection.getRepository(Message);
        this.deliveryRepo = this.connection.rawConnection.getRepository(MessageDelivery);
    }

    async findAll(ctx: RequestContext, options?: any): Promise<PaginatedList<Message>> {
        return this.listQueryBuilder
            .build(Message, options, { ctx, channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Message | undefined> {
        return this.messageRepo.findOne({ where: { id: id as any } });
    }

    async create(ctx: RequestContext, input: any): Promise<Message> {
        const msg = new Message({
            title: input.title,
            body: input.body,
            deliveryChannel: input.deliveryChannel ?? 'inapp',
            audienceType: input.audienceType ?? 'all',
            audienceLevel: input.audienceLevel,
            status: 'draft',
        } as any);
        msg.channels = [ctx.channel];
        return this.messageRepo.save(msg);
    }

    async update(ctx: RequestContext, id: ID, input: any): Promise<Message> {
        const msg = await this.findOne(ctx, id);
        if (!msg) throw new UserInputError(`Message ${id} not found`);
        if (msg.status === 'sending' || msg.status === 'sent') {
            throw new UserInputError(`Cannot edit message in ${msg.status} state`);
        }
        Object.assign(msg, {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.body !== undefined && { body: input.body }),
            ...(input.deliveryChannel !== undefined && { deliveryChannel: input.deliveryChannel }),
            ...(input.audienceType !== undefined && { audienceType: input.audienceType }),
            ...(input.audienceLevel !== undefined && { audienceLevel: input.audienceLevel }),
        });
        return this.messageRepo.save(msg);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const msg = await this.findOne(ctx, id);
        if (!msg) return false;
        await this.messageRepo.remove(msg);
        return true;
    }

    async sendMessage(ctx: RequestContext, id: ID): Promise<Message> {
        const msg = await this.findOne(ctx, id);
        if (!msg) throw new UserInputError(`Message ${id} not found`);
        if (msg.status !== 'draft') {
            throw new UserInputError(`Message ${id} is not in draft state (current: ${msg.status})`);
        }
        msg.status = 'pending';
        await this.messageRepo.save(msg);
        return msg;
    }

    /**
     * 由 JobQueue worker 调用，实际执行发送。
     */
    async processSending(ctx: RequestContext, messageId: ID): Promise<void> {
        const msg = await this.messageRepo.findOne({ where: { id: messageId as any } });
        if (!msg) {
            Logger.warn(`Message ${messageId} not found, skipping`, loggerCtx);
            return;
        }
        if (msg.status !== 'pending') {
            Logger.warn(`Message ${messageId} status is ${msg.status}, skipping`, loggerCtx);
            return;
        }

        msg.status = 'sending';
        await this.messageRepo.save(msg);

        try {
            const customerIds = await this.getTargetCustomerIds(ctx, msg);
            msg.totalTarget = customerIds.length;
            await this.messageRepo.save(msg);

            const batchSize = DEFAULT_BATCH_SIZE;
            let sent = 0;
            let failed = 0;

            for (let i = 0; i < customerIds.length; i += batchSize) {
                const batch = customerIds.slice(i, i + batchSize);
                for (const customerId of batch) {
                    const delivery = new MessageDelivery({
                        messageId: msg.id,
                        customerId,
                        deliveryStatus: 'pending',
                    } as any);
                    delivery.channels = [ctx.channel];
                    await this.deliveryRepo.save(delivery);

                    try {
                        if (msg.deliveryChannel === 'push') {
                            await this.pushService.sendPush(ctx, customerId, msg.title, msg.body);
                        }
                        delivery.deliveryStatus = 'sent';
                        await this.deliveryRepo.save(delivery);
                        sent++;
                    } catch (e: any) {
                        delivery.deliveryStatus = 'failed';
                        delivery.deliveryError = e.message?.slice(0, 500);
                        await this.deliveryRepo.save(delivery);
                        failed++;
                        Logger.error(`Delivery failed for customer ${customerId}: ${e.message}`, loggerCtx);
                    }
                }
            }

            msg.totalSent = sent;
            msg.totalFailed = failed;
            msg.status = 'sent';
            msg.sentAt = new Date();
            await this.messageRepo.save(msg);
            Logger.info(`Message ${messageId} sent: ${sent} success, ${failed} failed`, loggerCtx);
        } catch (e: any) {
            msg.status = 'failed';
            await this.messageRepo.save(msg);
            Logger.error(`Message ${messageId} sending failed: ${e.message}`, loggerCtx);
            throw e;
        }
    }

    async getDeliveryStats(ctx: RequestContext, messageId: ID): Promise<any> {
        const msg = await this.findOne(ctx, messageId);
        if (!msg) throw new UserInputError(`Message ${messageId} not found`);
        const totalRead = await this.deliveryRepo
            .createQueryBuilder('d')
            .where('d.messageId = :mid', { mid: messageId })
            .andWhere('d.readAt IS NOT NULL')
            .getCount();
        return {
            totalTarget: msg.totalTarget,
            totalSent: msg.totalSent,
            totalFailed: msg.totalFailed,
            totalRead,
        };
    }

    private async getTargetCustomerIds(ctx: RequestContext, msg: Message): Promise<number[]> {
        const repo = this.connection.getRepository(ctx, 'Customer' as any);
        const qb = repo.createQueryBuilder('customer').select('customer.id', 'id');

        if (msg.audienceType === 'level') {
            qb.andWhere('customer.customFields_memberLevel = :level', { level: msg.audienceLevel ?? 1 });
        }
        qb.andWhere('customer.deletedAt IS NULL');

        const rows = await qb.getRawMany();
        return rows.map(r => Number(r.id));
    }

    // ===== Shop-api methods =====

    async findMyMessages(ctx: RequestContext, options?: any): Promise<PaginatedList<any>> {
        if (!ctx.activeUserId) {
            return { items: [], totalItems: 0 };
        }
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);
        const customer = await customerRepo
            .createQueryBuilder('c')
            .select('c.id')
            .innerJoin('c.user', 'user')
            .where('user.id = :userId', { userId: ctx.activeUserId })
            .getOne();
        if (!customer) {
            return { items: [], totalItems: 0 };
        }

        const qb = this.deliveryRepo
            .createQueryBuilder('d')
            .innerJoinAndSelect('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: customer.id })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('d.deliveryStatus = :status', { status: 'sent' })
            .orderBy('d.createdAt', 'DESC');

        if (options?.skip) qb.skip(options.skip);
        if (options?.take) qb.take(options.take);

        const [deliveries, totalItems] = await qb.getManyAndCount();
        const messageIds = deliveries.map(d => d.messageId);
        const messages = messageIds.length > 0
            ? await this.messageRepo.findByIds(messageIds)
            : [];
        const msgMap = new Map(messages.map(m => [m.id, m]));

        return {
            items: deliveries.map(d => {
                const m = msgMap.get(d.messageId);
                return {
                    id: d.id,
                    messageId: d.messageId,
                    title: m?.title ?? '',
                    body: m?.body ?? '',
                    readAt: d.readAt,
                    createdAt: d.createdAt,
                };
            }),
            totalItems,
        };
    }

    async getMyUnreadCount(ctx: RequestContext): Promise<number> {
        if (!ctx.activeUserId) return 0;
        const customerRepo = this.connection.getRepository(ctx, 'Customer' as any);
        const customer = await customerRepo
            .createQueryBuilder('c')
            .select('c.id')
            .innerJoin('c.user', 'user')
            .where('user.id = :userId', { userId: ctx.activeUserId })
            .getOne();
        if (!customer) return 0;

        return this.deliveryRepo
            .createQueryBuilder('d')
            .innerJoin('d.channels', 'channel')
            .where('d.customerId = :cid', { cid: customer.id })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('d.deliveryStatus = :status', { status: 'sent' })
            .andWhere('d.readAt IS NULL')
            .getCount();
    }

    async markRead(ctx: RequestContext, deliveryId: ID): Promise<boolean> {
        if (!ctx.activeUserId) return false;
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId as any } });
        if (!delivery) return false;
        delivery.readAt = new Date();
        await this.deliveryRepo.save(delivery);
        return true;
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vendure && git add packages/message-plugin/src/message.service.ts && git commit -m "feat(message-plugin): add MessageService with CRUD, send flow, and shop-api methods" --no-verify
```

---

## Task 8: message-job.ts + resolvers + plugin.ts

**Files:**
- Create: `packages/message-plugin/src/message-job.ts`
- Create: `packages/message-plugin/src/message-admin.resolver.ts`
- Create: `packages/message-plugin/src/message-shop.resolver.ts`
- Create: `packages/message-plugin/src/plugin.ts`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 创建 message-job.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ID, JobQueue, JobQueueService, Logger, RequestContext, ChannelService } from '@vendure/core';

import { loggerCtx } from './constants';
import { MessageService } from './message.service';

export interface SendMessageJobData {
    messageId: ID;
    channelId: ID;
}

@Injectable()
export class MessageJob {
    private jobQueue!: JobQueue<SendMessageJobData>;

    constructor(
        private jobQueueService: JobQueueService,
        private messageService: MessageService,
        private channelService: ChannelService,
    ) {}

    async init(): Promise<void> {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'send-message',
            process: async (job) => {
                const { messageId, channelId } = job.data;
                const channel = await this.channelService.getChannelFromToken(channelId as any);
                const ctx = new RequestContext({
                    apiType: 'admin',
                    channel,
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
                await this.messageService.processSending(ctx, messageId);
            },
        });
        Logger.info('MessageJob queue initialized', loggerCtx);
    }

    async addSendJob(messageId: ID, channelId: ID): Promise<void> {
        await this.jobQueue.add({ messageId, channelId });
    }
}
```

- [ ] **Step 2: 创建 message-admin.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';

import { DeliveryPermissions } from '@vendure/delivery-plugin';
import { MessageJob } from './message-job';
import { MessageService } from './message.service';

@Resolver()
export class MessageAdminResolver {
    constructor(
        private messageService: MessageService,
        private messageJob: MessageJob,
    ) {}

    @Query()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async messages(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any) {
        return this.messageService.findAll(ctx, options);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async message(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.findOne(ctx, id);
    }

    @Query()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async messageDeliveryStats(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.getDeliveryStats(ctx, id);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async createMessage(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.messageService.create(ctx, input);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async updateMessage(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('input') input: any) {
        return this.messageService.update(ctx, id, input);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async deleteMessage(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.delete(ctx, id);
    }

    @Mutation()
    @Allow(DeliveryPermissions.ManageMessage as any)
    async sendMessage(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        const msg = await this.messageService.sendMessage(ctx, id);
        await this.messageJob.addSendJob(msg.id, ctx.channelId);
        return msg;
    }
}
```

- [ ] **Step 3: 创建 message-shop.resolver.ts**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { MessageService } from './message.service';

@Resolver()
export class MessageShopResolver {
    constructor(private messageService: MessageService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myMessages(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any) {
        return this.messageService.findMyMessages(ctx, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myUnreadMessageCount(@Ctx() ctx: RequestContext) {
        return this.messageService.getMyUnreadCount(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markMessageRead(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.markRead(ctx, id);
    }
}
```

- [ ] **Step 4: 创建 plugin.ts**

```typescript
import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { messageChannelCustomFields } from './channel-custom-fields';
import { loggerCtx, MESSAGE_PLUGIN_OPTIONS } from './constants';
import { messageCustomerCustomFields } from './customer-custom-fields';
import { MessageDelivery } from './entities/message-delivery.entity';
import { Message } from './entities/message.entity';
import { MessageJob } from './message-job';
import { MessageAdminResolver } from './message-admin.resolver';
import { MessagePushService } from './message-push.service';
import { MessageService } from './message.service';
import { MessageShopResolver } from './message-shop.resolver';
import { MessagePluginOptions } from './types';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Message, MessageDelivery],
    providers: [
        { provide: MESSAGE_PLUGIN_OPTIONS, useFactory: () => MessagePlugin.options },
        MessageService,
        MessagePushService,
        MessageJob,
    ],
    adminApiExtensions: {
        schema: () => gql`
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
                deliveryChannel: String
                audienceType: String
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
                sendMessage(id: ID!): Message!
            }
        `,
        resolvers: [MessageAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
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
        `,
        resolvers: [MessageShopResolver],
    },
    configuration: (config) => {
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...(messageChannelCustomFields.Channel ?? []),
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            ...(messageCustomerCustomFields.Customer ?? []),
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class MessagePlugin implements OnApplicationBootstrap {
    private static options: MessagePluginOptions = {};

    constructor(private messageJob: MessageJob) {}

    static init(options?: MessagePluginOptions): Type<MessagePlugin> {
        MessagePlugin.options = options ?? {};
        return MessagePlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.messageJob.init();
        Logger.info('MessagePlugin initialized', loggerCtx);
    }
}
```

- [ ] **Step 5: 在 dev-config.ts 注册 MessagePlugin**

在 import 部分追加：

```typescript
import { MessagePlugin } from '@vendure/message-plugin';
```

在 plugins 数组中 `OperationsPlugin.init()` 后追加：

```typescript
    MessagePlugin.init(),
```

- [ ] **Step 6: 构建 message-plugin**

```bash
cd e:\code\vendure\packages\message-plugin && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd e:\code\vendure && git add packages/message-plugin/ packages/dev-server/dev-config.ts && git commit -m "feat(message-plugin): add plugin, resolvers, JobQueue, and register in dev-config" --no-verify
```

---

## Task 9: 前端 pkg-member API client + 5 页面

**Files:**
- Create: `vadmin/src/pkg-member/api/member.ts`
- Create: `vadmin/src/pkg-member/pages/list/index.vue`
- Create: `vadmin/src/pkg-member/pages/detail/index.vue`
- Create: `vadmin/src/pkg-member/pages/detail/points-history.vue`
- Create: `vadmin/src/pkg-member/pages/detail/adjust.vue`
- Create: `vadmin/src/pkg-member/pages/level-config/index.vue`

- [ ] **Step 1: 创建 api/member.ts**

```typescript
import { GraphQLClient } from 'graphql-request';
import { useAuthStore } from '@/stores/auth';

const endpoint = `${import.meta.env.VITE_API_URL}/admin-api`;

function getClient() {
    const authStore = useAuthStore();
    return new GraphQLClient(endpoint, {
        headers: authStore.token ? { authorization: `Bearer ${authStore.token}` } : {},
    });
}

export const memberApi = {
    async members(params: { page?: number; pageSize?: number; level?: number; search?: string } = {}) {
        const client = getClient();
        const options: any = {
            take: params.pageSize ?? 20,
            skip: ((params.page ?? 1) - 1) * (params.pageSize ?? 20),
        };
        if (params.level) options.filter = { customFields: { memberLevel: { eq: params.level } } };
        if (params.search) {
            options.filter = { ...options.filter, emailAddress: { contains: params.search } };
        }
        const data = await client.request(
            `query Members($options: JSON) {
                members(options: $options) {
                    items { customerId emailAddress firstName lastName level levelName growthValue points createdAt }
                    totalItems
                }
            }`,
            { options },
        );
        return (data as any).members;
    },

    async memberInfo(customerId: string) {
        const client = getClient();
        const data = await client.request(
            `query MemberInfo($customerId: ID!) {
                memberInfo(customerId: $customerId) {
                    customerId level levelName growthValue points nextLevelThreshold nextLevelName
                }
            }`,
            { customerId },
        );
        return (data as any).memberInfo;
    },

    async pointsHistory(customerId: string, params: { page?: number; pageSize?: number } = {}) {
        const client = getClient();
        const data = await client.request(
            `query PointsHistory($customerId: ID!, $options: PointsHistoryListOptions) {
                pointsHistory(customerId: $customerId, options: $options) {
                    items { id type amount balanceBefore balanceAfter orderId remark createdAt }
                    totalItems
                }
            }`,
            { customerId, options: { skip: ((params.page ?? 1) - 1) * (params.pageSize ?? 20), take: params.pageSize ?? 20 } },
        );
        return (data as any).pointsHistory;
    },

    async adjustPoints(customerId: string, amount: number, remark?: string) {
        const client = getClient();
        const data = await client.request(
            `mutation AdjustPoints($customerId: ID!, $amount: Int!, $remark: String) {
                adjustPoints(customerId: $customerId, amount: $amount, remark: $remark) {
                    customerId level levelName growthValue points
                }
            }`,
            { customerId, amount, remark },
        );
        return (data as any).adjustPoints;
    },

    async adjustMemberGrowth(customerId: string, amount: number, source?: string) {
        const client = getClient();
        const data = await client.request(
            `mutation AdjustMemberGrowth($customerId: ID!, $amount: Int!, $source: String) {
                adjustMemberGrowth(customerId: $customerId, amount: $amount, source: $source) {
                    customerId level levelName growthValue points
                }
            }`,
            { customerId, amount, source },
        );
        return (data as any).adjustMemberGrowth;
    },

    async levelConfig() {
        const client = getClient();
        const data = await client.request(
            `query { levelConfig { level1Threshold level1Name level2Threshold level2Name level3Threshold level3Name level4Threshold level4Name level5Threshold level5Name pointsEarnRatio pointsEarnOnShipping } }`,
        );
        return (data as any).levelConfig;
    },

    async updateLevelConfig(input: any) {
        const client = getClient();
        const data = await client.request(
            `mutation UpdateLevelConfig($input: UpdateLevelConfigInput!) {
                updateLevelConfig(input: $input) {
                    level1Threshold level1Name level2Threshold level2Name level3Threshold level3Name level4Threshold level4Name level5Threshold level5Name pointsEarnRatio pointsEarnOnShipping
                }
            }`,
            { input },
        );
        return (data as any).updateLevelConfig;
    },
};
```

- [ ] **Step 2: 创建 list/index.vue**

```vue
<template>
    <view class="page">
        <view class="search-bar">
            <input class="search-input" v-model="search" placeholder="搜索邮箱" @confirm="reload" />
            <view class="filter-item" :class="{ active: levelFilter === 0 }" @click="levelFilter = 0">全部</view>
            <view class="filter-item" :class="{ active: levelFilter === l }" v-for="l in 5" :key="l" @click="levelFilter = l">LV{{ l }}</view>
        </view>
        <view class="list">
            <view class="list-item" v-for="item in list" :key="item.customerId" @click="goDetail(item.customerId)">
                <view class="list-item__header">
                    <text class="list-item__name">{{ item.firstName }} {{ item.lastName }}</text>
                    <text class="list-item__level">LV{{ item.level }} {{ item.levelName }}</text>
                </view>
                <view class="list-item__body">
                    <text class="list-item__info">{{ item.emailAddress }}</text>
                    <text class="list-item__info">积分: {{ item.points }}</text>
                    <text class="list-item__info">成长值: {{ item.growthValue }}</text>
                </view>
            </view>
        </view>
        <view class="load-more" v-if="!hasMore && list.length > 0">没有更多了</view>
    </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { memberApi } from '@/pkg-member/api/member';

const list = ref<any[]>([]);
const search = ref('');
const levelFilter = ref(0);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);

async function loadList(reset = false) {
    if (reset) { page.value = 1; hasMore.value = true; }
    if (!hasMore.value && !reset) return;
    try {
        const res = await memberApi.members({ page: page.value, pageSize, level: levelFilter.value || undefined, search: search.value || undefined });
        if (reset) { list.value = res.items; } else { list.value.push(...res.items); }
        hasMore.value = list.value.length < res.totalItems;
    } catch (e: any) {
        uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
    }
}

function goDetail(id: string) {
    uni.navigateTo({ url: `/pkg-member/pages/detail/index?id=${id}` });
}

function reload() { loadList(true); }

watch(() => levelFilter.value, () => loadList(true));
onShow(() => loadList(true));
onReachBottom(() => { if (hasMore.value) { page.value++; loadList(false); } });
</script>

<style scoped>
.page { padding: 16rpx; }
.search-bar { display: flex; gap: 8rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 300rpx; padding: 12rpx; font-size: 28rpx; background: #fff; border-radius: 8rpx; }
.filter-item { padding: 8rpx 16rpx; font-size: 24rpx; background: #f5f5f5; border-radius: 8rpx; }
.filter-item.active { background: #007aff; color: #fff; }
.list-item { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.list-item__header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.list-item__name { font-size: 32rpx; font-weight: 600; color: #333; }
.list-item__level { font-size: 24rpx; color: #007aff; }
.list-item__body { display: flex; gap: 24rpx; }
.list-item__info { font-size: 26rpx; color: #666; }
.load-more { text-align: center; font-size: 24rpx; color: #999; padding: 24rpx; }
</style>
```

- [ ] **Step 3: 创建 detail/index.vue**

```vue
<template>
    <view class="page">
        <view class="info-card">
            <view class="info-row"><text class="label">邮箱</text><text class="value">{{ member.emailAddress }}</text></view>
            <view class="info-row"><text class="label">等级</text><text class="value">LV{{ member.level }} {{ member.levelName }}</text></view>
            <view class="info-row"><text class="label">积分余额</text><text class="value">{{ member.points }}</text></view>
            <view class="info-row"><text class="label">成长值</text><text class="value">{{ member.growthValue }}</text></view>
            <view class="info-row" v-if="member.nextLevelThreshold"><text class="label">下一级</text><text class="value">{{ member.nextLevelName }} (需 {{ member.nextLevelThreshold }})</text></view>
        </view>
        <view class="actions">
            <button class="btn" @click="goAdjust('points')">调整积分</button>
            <button class="btn" @click="goAdjust('growth')">调整成长值</button>
            <button class="btn" @click="goHistory">积分历史</button>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { memberApi } from '@/pkg-member/api/member';

const customerId = ref('');
const member = ref<any>({});

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    customerId.value = currentPage?.options?.id;
    if (customerId.value) {
        try {
            member.value = await memberApi.memberInfo(customerId.value);
        } catch (e: any) {
            uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
        }
    }
});

function goAdjust(type: string) {
    uni.navigateTo({ url: `/pkg-member/pages/detail/adjust?id=${customerId.value}&type=${type}` });
}
function goHistory() {
    uni.navigateTo({ url: `/pkg-member/pages/detail/points-history?id=${customerId.value}` });
}
</script>

<style scoped>
.page { padding: 16rpx; }
.info-card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.info-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.label { font-size: 28rpx; color: #666; }
.value { font-size: 28rpx; color: #333; font-weight: 500; }
.actions { display: flex; flex-direction: column; gap: 16rpx; padding: 24rpx; }
.btn { height: 80rpx; line-height: 80rpx; font-size: 30rpx; border-radius: 8rpx; background: #007aff; color: #fff; }
</style>
```

- [ ] **Step 4: 创建 detail/points-history.vue**

```vue
<template>
    <view class="page">
        <view class="list">
            <view class="list-item" v-for="item in list" :key="item.id">
                <view class="list-item__header">
                    <text class="list-item__type">{{ typeText(item.type) }}</text>
                    <text class="list-item__amount" :class="item.amount >= 0 ? 'plus' : 'minus'">{{ item.amount >= 0 ? '+' : '' }}{{ item.amount }}</text>
                </view>
                <view class="list-item__body">
                    <text class="list-item__info">余额: {{ item.balanceAfter }}</text>
                    <text class="list-item__info">{{ formatTime(item.createdAt) }}</text>
                </view>
                <text class="list-item__remark" v-if="item.remark">{{ item.remark }}</text>
            </view>
        </view>
        <view class="load-more" v-if="!hasMore && list.length > 0">没有更多了</view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onReachBottom } from '@dcloudio/uni-app';
import { memberApi } from '@/pkg-member/api/member';

const customerId = ref('');
const list = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    customerId.value = currentPage?.options?.id;
    await loadList(true);
});

async function loadList(reset = false) {
    if (reset) { page.value = 1; hasMore.value = true; }
    if (!hasMore.value && !reset) return;
    try {
        const res = await memberApi.pointsHistory(customerId.value, { page: page.value, pageSize: 20 });
        if (reset) { list.value = res.items; } else { list.value.push(...res.items); }
        hasMore.value = list.value.length < res.totalItems;
    } catch (e: any) {
        uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
    }
}

function typeText(type: string) { return ({ EARN: '获得', SPEND: '消费', ADJUST: '调整' } as any)[type] || type; }
function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN'); }

onReachBottom(() => { if (hasMore.value) { page.value++; loadList(false); } });
</script>

<style scoped>
.page { padding: 16rpx; }
.list-item { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.list-item__header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.list-item__type { font-size: 28rpx; font-weight: 600; color: #333; }
.list-item__amount { font-size: 32rpx; font-weight: 700; }
.list-item__amount.plus { color: #52c41a; }
.list-item__amount.minus { color: #ff4d4f; }
.list-item__body { display: flex; gap: 24rpx; }
.list-item__info { font-size: 24rpx; color: #999; }
.list-item__remark { font-size: 24rpx; color: #666; margin-top: 4rpx; }
.load-more { text-align: center; font-size: 24rpx; color: #999; padding: 24rpx; }
</style>
```

- [ ] **Step 5: 创建 detail/adjust.vue**

```vue
<template>
    <view class="page">
        <view class="form-group">
            <text class="label">{{ type === 'points' ? '调整积分' : '调整成长值' }}</text>
            <input class="input" type="number" v-model.number="amount" placeholder="正数增加，负数减少" />
        </view>
        <view class="form-group">
            <text class="label">备注</text>
            <input class="input" v-model="remark" placeholder="可选" />
        </view>
        <button class="btn" @click="onSubmit">提交</button>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { memberApi } from '@/pkg-member/api/member';

const customerId = ref('');
const type = ref('points');
const amount = ref(0);
const remark = ref('');

onMounted(() => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    customerId.value = currentPage?.options?.id;
    type.value = currentPage?.options?.type || 'points';
});

async function onSubmit() {
    if (!amount.value || amount.value === 0) {
        uni.showToast({ title: '请输入非零金额', icon: 'none' });
        return;
    }
    const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({ title: '确认操作', content: `${type.value === 'points' ? '积分' : '成长值'}${amount.value > 0 ? '+' : ''}${amount.value}`, success: r => resolve(r.confirm) });
    });
    if (!confirmed) return;
    try {
        if (type.value === 'points') {
            await memberApi.adjustPoints(customerId.value, amount.value, remark.value || undefined);
        } else {
            await memberApi.adjustMemberGrowth(customerId.value, amount.value, remark.value || undefined);
        }
        uni.showToast({ title: '操作成功', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1000);
    } catch (e: any) {
        uni.showToast({ title: '操作失败: ' + e.message, icon: 'none' });
    }
}
</script>

<style scoped>
.page { padding: 16rpx; }
.form-group { background: #fff; border-radius: 8rpx; padding: 24rpx; margin-bottom: 16rpx; }
.label { font-size: 28rpx; color: #333; font-weight: 500; display: block; margin-bottom: 8rpx; }
.input { width: 100%; padding: 12rpx 0; font-size: 28rpx; border-bottom: 1rpx solid #eee; }
.btn { width: 100%; height: 80rpx; line-height: 80rpx; font-size: 30rpx; border-radius: 8rpx; background: #007aff; color: #fff; margin-top: 24rpx; }
</style>
```

- [ ] **Step 6: 创建 level-config/index.vue**

```vue
<template>
    <view class="page">
        <view class="form-group" v-for="i in 5" :key="i">
            <text class="label">LV{{ i }}</text>
            <view class="row">
                <input class="input" type="number" v-model.number="form[`level${i}Threshold`]" placeholder="成长值阈值" />
                <input class="input" v-model="form[`level${i}Name`]" placeholder="等级名称" />
            </view>
        </view>
        <view class="form-group">
            <text class="label">积分获取比例（每元）</text>
            <input class="input" type="number" v-model.number="form.pointsEarnRatio" />
        </view>
        <view class="form-group">
            <text class="label">运费是否产生积分</text>
            <switch :checked="form.pointsEarnOnShipping" @change="e => form.pointsEarnOnShipping = e.detail.value" />
        </view>
        <button class="btn" @click="onSave">保存配置</button>
    </view>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { memberApi } from '@/pkg-member/api/member';

const form = reactive({
    level1Threshold: 0, level1Name: '', level2Threshold: 0, level2Name: '',
    level3Threshold: 0, level3Name: '', level4Threshold: 0, level4Name: '',
    level5Threshold: 0, level5Name: '', pointsEarnRatio: 1, pointsEarnOnShipping: false,
});

onMounted(async () => {
    try {
        const config = await memberApi.levelConfig();
        Object.assign(form, config);
    } catch (e: any) {
        uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
    }
});

async function onSave() {
    try {
        await memberApi.updateLevelConfig(form);
        uni.showToast({ title: '保存成功', icon: 'success' });
    } catch (e: any) {
        uni.showToast({ title: '保存失败: ' + e.message, icon: 'none' });
    }
}
</script>

<style scoped>
.page { padding: 16rpx; }
.form-group { background: #fff; border-radius: 8rpx; padding: 24rpx; margin-bottom: 16rpx; }
.label { font-size: 28rpx; color: #333; font-weight: 500; display: block; margin-bottom: 8rpx; }
.row { display: flex; gap: 16rpx; }
.input { flex: 1; padding: 12rpx 0; font-size: 28rpx; border-bottom: 1rpx solid #eee; }
.btn { width: 100%; height: 80rpx; line-height: 80rpx; font-size: 30rpx; border-radius: 8rpx; background: #007aff; color: #fff; margin-top: 24rpx; }
</style>
```

- [ ] **Step 7: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-member/ && git commit -m "feat(vadmin): add pkg-member with 5 pages and API client" --no-verify
```

---

## Task 10: 前端 pkg-message API client + 3 页面

**Files:**
- Create: `vadmin/src/pkg-message/api/message.ts`
- Create: `vadmin/src/pkg-message/pages/list/index.vue`
- Create: `vadmin/src/pkg-message/pages/detail/index.vue`
- Create: `vadmin/src/pkg-message/pages/detail/stats.vue`

- [ ] **Step 1: 创建 api/message.ts**

```typescript
import { GraphQLClient } from 'graphql-request';
import { useAuthStore } from '@/stores/auth';

const endpoint = `${import.meta.env.VITE_API_URL}/admin-api`;

function getClient() {
    const authStore = useAuthStore();
    return new GraphQLClient(endpoint, {
        headers: authStore.token ? { authorization: `Bearer ${authStore.token}` } : {},
    });
}

export const messageApi = {
    async messages(params: { page?: number; pageSize?: number } = {}) {
        const client = getClient();
        const data = await client.request(
            `query Messages($options: JSON) {
                messages(options: $options) {
                    items { id title body deliveryChannel audienceType audienceLevel status totalTarget totalSent totalFailed createdAt sentAt }
                    totalItems
                }
            }`,
            { options: { take: params.pageSize ?? 20, skip: ((params.page ?? 1) - 1) * (params.pageSize ?? 20) } },
        );
        return (data as any).messages;
    },

    async message(id: string) {
        const client = getClient();
        const data = await client.request(
            `query Message($id: ID!) {
                message(id: $id) { id title body deliveryChannel audienceType audienceLevel status totalTarget totalSent totalFailed createdAt sentAt }
            }`,
            { id },
        );
        return (data as any).message;
    },

    async createMessage(input: any) {
        const client = getClient();
        const data = await client.request(
            `mutation CreateMessage($input: CreateMessageInput!) {
                createMessage(input: $input) { id title status }
            }`,
            { input },
        );
        return (data as any).createMessage;
    },

    async updateMessage(id: string, input: any) {
        const client = getClient();
        const data = await client.request(
            `mutation UpdateMessage($id: ID!, $input: UpdateMessageInput!) {
                updateMessage(id: $id, input: $input) { id title status }
            }`,
            { id, input },
        );
        return (data as any).updateMessage;
    },

    async deleteMessage(id: string) {
        const client = getClient();
        const data = await client.request(
            `mutation DeleteMessage($id: ID!) { deleteMessage(id: $id) }`,
            { id },
        );
        return (data as any).deleteMessage;
    },

    async sendMessage(id: string) {
        const client = getClient();
        const data = await client.request(
            `mutation SendMessage($id: ID!) {
                sendMessage(id: $id) { id status totalTarget }
            }`,
            { id },
        );
        return (data as any).sendMessage;
    },

    async messageDeliveryStats(id: string) {
        const client = getClient();
        const data = await client.request(
            `query MessageDeliveryStats($id: ID!) {
                messageDeliveryStats(id: $id) { totalTarget totalSent totalFailed totalRead }
            }`,
            { id },
        );
        return (data as any).messageDeliveryStats;
    },
};
```

- [ ] **Step 2: 创建 list/index.vue**

```vue
<template>
    <view class="page">
        <view class="list">
            <view class="list-item" v-for="item in list" :key="item.id" @click="goDetail(item.id)">
                <view class="list-item__header">
                    <text class="list-item__title">{{ item.title }}</text>
                    <text class="list-item__status" :class="'status-' + item.status">{{ statusText(item.status) }}</text>
                </view>
                <view class="list-item__body">
                    <text class="list-item__info">渠道: {{ item.deliveryChannel === 'inapp' ? '站内信' : '推送' }}</text>
                    <text class="list-item__info">人群: {{ item.audienceType === 'all' ? '全员' : 'LV' + item.audienceLevel }}</text>
                </view>
                <view class="list-item__footer">
                    <text class="list-item__time">{{ formatTime(item.createdAt) }}</text>
                    <text class="list-item__stats" v-if="item.status === 'sent'">已发 {{ item.totalSent }}/{{ item.totalTarget }}</text>
                </view>
            </view>
        </view>
        <view class="load-more" v-if="!hasMore && list.length > 0">没有更多了</view>
        <view class="fab" @click="goDetail('')">+</view>
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { messageApi } from '@/pkg-message/api/message';

const list = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

async function loadList(reset = false) {
    if (reset) { page.value = 1; hasMore.value = true; }
    if (!hasMore.value && !reset) return;
    try {
        const res = await messageApi.messages({ page: page.value, pageSize: 20 });
        if (reset) { list.value = res.items; } else { list.value.push(...res.items); }
        hasMore.value = list.value.length < res.totalItems;
    } catch (e: any) {
        uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
    }
}

function goDetail(id: string) {
    uni.navigateTo({ url: `/pkg-message/pages/detail/index${id ? '?id=' + id : ''}` });
}

function statusText(s: string) { return ({ draft: '草稿', pending: '待发送', sending: '发送中', sent: '已发送', failed: '失败' } as any)[s] || s; }
function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN'); }

onShow(() => loadList(true));
onReachBottom(() => { if (hasMore.value) { page.value++; loadList(false); } });
</script>

<style scoped>
.page { padding: 16rpx; }
.list-item { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 16rpx; }
.list-item__header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.list-item__title { font-size: 32rpx; font-weight: 600; color: #333; }
.list-item__status { font-size: 24rpx; padding: 4rpx 12rpx; border-radius: 4rpx; }
.status-draft { background: #f5f5f5; color: #999; }
.status-sending { background: #fff7e6; color: #fa8c16; }
.status-sent { background: #f6ffed; color: #52c41a; }
.status-failed { background: #fff1f0; color: #ff4d4f; }
.list-item__body { display: flex; gap: 24rpx; margin-bottom: 8rpx; }
.list-item__info { font-size: 26rpx; color: #666; }
.list-item__footer { display: flex; justify-content: space-between; }
.list-item__time { font-size: 24rpx; color: #999; }
.list-item__stats { font-size: 24rpx; color: #007aff; }
.load-more { text-align: center; font-size: 24rpx; color: #999; padding: 24rpx; }
.fab { position: fixed; right: 32rpx; bottom: 64rpx; width: 96rpx; height: 96rpx; background: #007aff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48rpx; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.2); }
</style>
```

- [ ] **Step 3: 创建 detail/index.vue**

```vue
<template>
    <view class="page">
        <view class="form-group">
            <text class="label">标题</text>
            <input class="input" v-model="form.title" placeholder="消息标题" />
        </view>
        <view class="form-group">
            <text class="label">正文</text>
            <textarea class="textarea" v-model="form.body" placeholder="消息正文" />
        </view>
        <view class="form-group">
            <text class="label">投递渠道</text>
            <picker :range="channelOptions" :range-key="'label'" :value="channelIndex" @change="e => form.deliveryChannel = channelOptions[e.detail.value].value">
                <view class="picker">{{ channelOptions[channelIndex].label }}</view>
            </picker>
        </view>
        <view class="form-group">
            <text class="label">目标人群</text>
            <picker :range="audienceOptions" :range-key="'label'" :value="audienceIndex" @change="onAudienceChange">
                <view class="picker">{{ audienceOptions[audienceIndex].label }}</view>
            </picker>
        </view>
        <view class="form-group" v-if="form.audienceType === 'level'">
            <text class="label">目标等级</text>
            <picker :range="[1,2,3,4,5]" :value="form.audienceLevel - 1" @change="e => form.audienceLevel = Number(e.detail.value) + 1">
                <view class="picker">LV{{ form.audienceLevel }}</view>
            </picker>
        </view>
        <view class="actions">
            <button class="btn btn-save" @click="onSave">保存</button>
            <button class="btn btn-send" v-if="isEdit && form.status === 'draft'" @click="onSend">发送</button>
            <button class="btn btn-stats" v-if="isEdit && form.status === 'sent'" @click="goStats">统计</button>
            <button class="btn btn-delete" v-if="isEdit" @click="onDelete">删除</button>
        </view>
    </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { messageApi } from '@/pkg-message/api/message';

const isEdit = ref(false);
const channelOptions = [{ label: '站内信', value: 'inapp' }, { label: 'App 推送', value: 'push' }];
const audienceOptions = [{ label: '全员', value: 'all' }, { label: '按等级', value: 'level' }];

const form = reactive({
    id: undefined as string | undefined,
    title: '', body: '', deliveryChannel: 'inapp',
    audienceType: 'all', audienceLevel: 1, status: 'draft',
});

const channelIndex = computed(() => channelOptions.findIndex(o => o.value === form.deliveryChannel));
const audienceIndex = computed(() => audienceOptions.findIndex(o => o.value === form.audienceType));

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    const id = currentPage?.options?.id;
    if (id) {
        isEdit.value = true;
        try {
            const data = await messageApi.message(id);
            Object.assign(form, data);
        } catch (e: any) {
            uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
        }
    }
});

function onAudienceChange(e: any) { form.audienceType = audienceOptions[e.detail.value].value; }

async function onSave() {
    try {
        const input = { title: form.title, body: form.body, deliveryChannel: form.deliveryChannel, audienceType: form.audienceType, audienceLevel: form.audienceType === 'level' ? form.audienceLevel : undefined };
        if (isEdit.value) {
            await messageApi.updateMessage(form.id!, input);
        } else {
            const created = await messageApi.createMessage(input);
            form.id = created.id;
            isEdit.value = true;
        }
        uni.showToast({ title: '保存成功', icon: 'success' });
    } catch (e: any) {
        uni.showToast({ title: '保存失败: ' + e.message, icon: 'none' });
    }
}

async function onSend() {
    const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({ title: '确认发送', content: '发送后不可编辑，确认？', success: r => resolve(r.confirm) });
    });
    if (!confirmed) return;
    try {
        await messageApi.sendMessage(form.id!);
        uni.showToast({ title: '已提交发送', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1500);
    } catch (e: any) {
        uni.showToast({ title: '发送失败: ' + e.message, icon: 'none' });
    }
}

async function onDelete() {
    const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({ title: '确认删除', content: '删除后不可恢复', success: r => resolve(r.confirm) });
    });
    if (!confirmed) return;
    try {
        await messageApi.deleteMessage(form.id!);
        uni.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1000);
    } catch (e: any) {
        uni.showToast({ title: '删除失败: ' + e.message, icon: 'none' });
    }
}

function goStats() { uni.navigateTo({ url: `/pkg-message/pages/detail/stats?id=${form.id}` }); }
</script>

<style scoped>
.page { padding: 16rpx; }
.form-group { background: #fff; border-radius: 8rpx; padding: 24rpx; margin-bottom: 16rpx; }
.label { font-size: 28rpx; color: #333; font-weight: 500; display: block; margin-bottom: 8rpx; }
.input { width: 100%; padding: 12rpx 0; font-size: 28rpx; border-bottom: 1rpx solid #eee; }
.textarea { width: 100%; height: 200rpx; padding: 12rpx 0; font-size: 28rpx; border-bottom: 1rpx solid #eee; }
.picker { padding: 12rpx 0; font-size: 28rpx; color: #333; }
.actions { display: flex; gap: 16rpx; padding: 24rpx; }
.btn { flex: 1; height: 80rpx; line-height: 80rpx; font-size: 30rpx; border-radius: 8rpx; text-align: center; }
.btn-save { background: #007aff; color: #fff; }
.btn-send { background: #52c41a; color: #fff; }
.btn-stats { background: #fff; color: #007aff; border: 1rpx solid #007aff; }
.btn-delete { background: #fff; color: #ff4d4f; border: 1rpx solid #ff4d4f; }
</style>
```

- [ ] **Step 4: 创建 detail/stats.vue**

```vue
<template>
    <view class="page">
        <view class="stats-card">
            <view class="stats-item"><text class="stats-value">{{ stats.totalTarget }}</text><text class="stats-label">目标人数</text></view>
            <view class="stats-item"><text class="stats-value sent">{{ stats.totalSent }}</text><text class="stats-label">已发送</text></view>
            <view class="stats-item"><text class="stats-value failed">{{ stats.totalFailed }}</text><text class="stats-label">失败</text></view>
            <view class="stats-item"><text class="stats-value read">{{ stats.totalRead }}</text><text class="stats-label">已读</text></view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { messageApi } from '@/pkg-message/api/message';

const stats = ref({ totalTarget: 0, totalSent: 0, totalFailed: 0, totalRead: 0 });

onMounted(async () => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1] as any;
    const id = currentPage?.options?.id;
    if (id) {
        try {
            stats.value = await messageApi.messageDeliveryStats(id);
        } catch (e: any) {
            uni.showToast({ title: '加载失败: ' + e.message, icon: 'none' });
        }
    }
});
</script>

<style scoped>
.page { padding: 16rpx; }
.stats-card { background: #fff; border-radius: 12rpx; padding: 32rpx; display: flex; justify-content: space-around; }
.stats-item { display: flex; flex-direction: column; align-items: center; }
.stats-value { font-size: 48rpx; font-weight: 700; color: #333; }
.stats-value.sent { color: #52c41a; }
.stats-value.failed { color: #ff4d4f; }
.stats-value.read { color: #007aff; }
.stats-label { font-size: 24rpx; color: #999; margin-top: 8rpx; }
</style>
```

- [ ] **Step 5: Commit**

```bash
cd e:\code\vadmin && git add src/pkg-message/ && git commit -m "feat(vadmin): add pkg-message with 3 pages and API client" --no-verify
```

---

## Task 11: shortcuts.ts + pages.json 更新

**Files:**
- Modify: `vadmin/src/config/shortcuts.ts`
- Modify: `vadmin/src/pages.json`

- [ ] **Step 1: shortcuts.ts 追加 2 项**

在 `ops-floor` 行后追加：

```typescript
    { code: 'member-list', name: '会员', icon: '👥', perm: 'ManageMember', route: '/pkg-member/pages/list/index', enabled: true },
    { code: 'message-list', name: '群发', icon: '📣', perm: 'ManageMessage', route: '/pkg-message/pages/list/index', enabled: true },
```

- [ ] **Step 2: pages.json 追加 2 个 subPackage**

在 subPackages 数组中追加：

```json
            {
                "root": "pkg-member",
                "pages": [
                    { "path": "pages/list/index", "style": { "navigationBarTitleText": "会员列表" } },
                    { "path": "pages/detail/index", "style": { "navigationBarTitleText": "会员详情" } },
                    { "path": "pages/detail/points-history", "style": { "navigationBarTitleText": "积分历史" } },
                    { "path": "pages/detail/adjust", "style": { "navigationBarTitleText": "调整" } },
                    { "path": "pages/level-config/index", "style": { "navigationBarTitleText": "等级配置" } }
                ]
            },
            {
                "root": "pkg-message",
                "pages": [
                    { "path": "pages/list/index", "style": { "navigationBarTitleText": "消息列表" } },
                    { "path": "pages/detail/index", "style": { "navigationBarTitleText": "消息详情" } },
                    { "path": "pages/detail/stats", "style": { "navigationBarTitleText": "投递统计" } }
                ]
            }
```

- [ ] **Step 3: Commit**

```bash
cd e:\code\vadmin && git add src/config/shortcuts.ts src/pages.json && git commit -m "feat(vadmin): add member and message shortcuts and subPackages" --no-verify
```

---

## Task 12: 测试脚本

**Files:**
- Create: `vendure/reset-p3-pwd.js`
- Create: `vendure/test-p3-flow.js`

- [ ] **Step 1: 创建 reset-p3-pwd.js**

```javascript
const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };

async function gql(query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (body.errors) {
        const err = new Error(body.errors.map(e => e.message).join('; '));
        err.body = body;
        throw err;
    }
    const headerToken = res.headers.get('vendure-auth-token');
    if (headerToken) body.data.__authToken = headerToken;
    return body.data;
}

async function login(username, password) {
    const data = await gql(
        `mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { message }
            }
        }`,
        { username, password },
    );
    if (!data.__authToken) throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== P3 测试账号初始化 ===\n');
    console.log('[1] 超管登录...');
    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    console.log('  ✓ superadmin login ok\n');

    console.log('[2] 查询 operations-staff 角色...');
    const rolesData = await gql(
        `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { id code permissions } } }`,
        {},
        adminToken,
    );
    const opsRoleId = rolesData.roles.items[0]?.id;
    if (!opsRoleId) throw new Error('operations-staff 角色不存在');
    const perms = rolesData.roles.items[0].permissions;
    const hasMember = perms.includes('ManageMember');
    const hasMessage = perms.includes('ManageMessage');
    console.log(`  ✓ operations-staff: ManageMember=${hasMember}, ManageMessage=${hasMessage}\n`);

    if (!hasMember || !hasMessage) {
        console.log('  ⚠ 权限未同步，请重启 dev-server 触发 RoleSyncService\n');
    }

    console.log('=== 完成 ===');
    console.log('测试账号: marketing1@zhao.test / a963963');
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
```

- [ ] **Step 2: 创建 test-p3-flow.js**

```javascript
const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
const STAFF = { username: 'marketing1@zhao.test', password: 'a963963' };

let stepCounter = 0;
const results = [];
function log(msg) { console.log(`[Step ${++stepCounter}] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); results.push({ ok: true, msg }); }
function fail(msg, err) { console.error(`  ✗ ${msg}`); if (err) console.error('    ', err?.message ?? err); results.push({ ok: false, msg, err: err?.message ?? String(err) }); }

async function gql(query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(ADMIN_API, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const body = await res.json();
    if (body.errors) { const err = new Error(body.errors.map(e => e.message).join('; ')); err.body = body; throw err; }
    const headerToken = res.headers.get('vendure-auth-token');
    if (headerToken) body.data.__authToken = headerToken;
    return body.data;
}

async function login(username, password) {
    const data = await gql(`mutation Login($u: String!, $p: String!) { login(username: $u, password: $p) { ... on CurrentUser { identifier } ... on InvalidCredentialsError { message } } }`, { u: username, p: password });
    if (!data.__authToken) throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== 运营 P3 会员管理 + 消息群发 E2E 验收 ===\n');

    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    log('超管登录'); ok('admin token acquired');

    // 1. 权限验证
    log('验证 operations-staff 权限');
    const rolesData = await gql(`query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { permissions } } }`, {}, adminToken);
    const perms = rolesData.roles.items[0].permissions;
    if (perms.includes('ManageMember')) ok('ManageMember 已同步'); else { fail('ManageMember 缺失'); throw new Error('perm missing'); }
    if (perms.includes('ManageMessage')) ok('ManageMessage 已同步'); else { fail('ManageMessage 缺失'); throw new Error('perm missing'); }

    // 2. 等级配置读取
    log('等级配置读取');
    const lc = await gql(`query { levelConfig { level1Threshold level1Name level2Threshold level2Name pointsEarnRatio pointsEarnOnShipping } }`, {}, adminToken);
    ok(`LV1: ${lc.levelConfig.level1Name} (${lc.levelConfig.level1Threshold}), ratio=${lc.levelConfig.pointsEarnRatio}`);

    // 3. 等级配置更新
    log('等级配置更新');
    const updated = await gql(`mutation UpdateLevelConfig($input: UpdateLevelConfigInput!) { updateLevelConfig(input: $input) { level1Name level2Threshold } }`, { input: { level1Name: '测试普通', level2Threshold: 1200 } }, adminToken);
    ok(`更新后: LV1=${updated.updateLevelConfig.level1Name}, LV2阈值=${updated.updateLevelConfig.level2Threshold}`);

    // 恢复
    await gql(`mutation UpdateLevelConfig($input: UpdateLevelConfigInput!) { updateLevelConfig(input: $input) { level1Name } }`, { input: { level1Name: '普通会员', level2Threshold: 1000 } }, adminToken);

    // 4. 会员列表
    log('会员列表查询');
    const members = await gql(`query Members($options: JSON) { members(options: $options) { items { customerId emailAddress level levelName points growthValue } totalItems } }`, { options: { take: 10 } }, adminToken);
    ok(`会员总数: ${members.members.totalItems}`);
    if (members.members.items.length > 0) {
        const firstMember = members.members.items[0];
        ok(`第一个会员: ${firstMember.emailAddress}, LV${firstMember.level} ${firstMember.levelName}`);
        const testCustomerId = firstMember.customerId;

        // 5. 会员详情
        log('会员详情查询');
        const info = await gql(`query MemberInfo($id: ID!) { memberInfo(customerId: $id) { customerId level levelName growthValue points nextLevelThreshold nextLevelName } }`, { id: testCustomerId }, adminToken);
        ok(`详情: LV${info.memberInfo.level} ${info.memberInfo.levelName}, 积分=${info.memberInfo.points}`);

        // 6. 调整积分
        log('调整积分');
        const beforePoints = info.memberInfo.points;
        const adj = await gql(`mutation AdjustPoints($id: ID!, $amount: Int!, $remark: String) { adjustPoints(customerId: $id, amount: $amount, remark: $remark) { points } }`, { id: testCustomerId, amount: 100, remark: 'E2E测试' }, adminToken);
        ok(`积分: ${beforePoints} -> ${adj.adjustPoints.points} (+100)`);

        // 7. 调整成长值
        log('调整成长值');
        const adjG = await gql(`mutation AdjustGrowth($id: ID!, $amount: Int!, $source: String) { adjustMemberGrowth(customerId: $id, amount: $amount, source: $source) { growthValue } }`, { id: testCustomerId, amount: 500, source: 'E2E测试' }, adminToken);
        ok(`成长值调整为: ${adjG.adjustMemberGrowth.growthValue}`);

        // 8. 积分历史
        log('积分历史查询');
        const hist = await gql(`query PointsHistory($id: ID!, $options: PointsHistoryListOptions) { pointsHistory(customerId: $id, options: $options) { items { type amount remark createdAt } totalItems } }`, { id: testCustomerId, options: { take: 5 } }, adminToken);
        ok(`历史记录数: ${hist.pointsHistory.totalItems}`);

        // 回滚积分调整
        await gql(`mutation AdjustPoints($id: ID!, $amount: Int!, $remark: String) { adjustPoints(customerId: $id, amount: $amount, remark: $remark) { points } }`, { id: testCustomerId, amount: -100, remark: 'E2E回滚' }, adminToken);
    }

    // 9. 消息 CRUD
    log('消息 CRUD - 创建');
    let messageId;
    try {
        const created = await gql(`mutation CreateMessage($input: CreateMessageInput!) { createMessage(input: $input) { id title status } }`, { input: { title: 'E2E测试消息', body: '测试正文', deliveryChannel: 'inapp', audienceType: 'all' } }, adminToken);
        messageId = created.createMessage.id;
        ok(`消息创建: id=${messageId}, status=${created.createMessage.status}`);
    } catch (e) { fail('消息创建失败', e); throw e; }

    log('消息 CRUD - 查询');
    const msgDetail = await gql(`query Message($id: ID!) { message(id: $id) { id title body deliveryChannel audienceType status } }`, { id: messageId }, adminToken);
    ok(`消息查询: title=${msgDetail.message.title}`);

    log('消息 CRUD - 更新');
    const msgUpdated = await gql(`mutation UpdateMessage($id: ID!, $input: UpdateMessageInput!) { updateMessage(id: $id, input: $input) { title } }`, { id: messageId, input: { title: 'E2E测试消息-改' } }, adminToken);
    ok(`消息更新: title=${msgUpdated.updateMessage.title}`);

    // 10. 消息发送
    log('消息发送流程');
    try {
        const sent = await gql(`mutation SendMessage($id: ID!) { sendMessage(id: $id) { id status totalTarget } }`, { id: messageId }, adminToken);
        ok(`发送触发: status=${sent.sendMessage.status}, target=${sent.sendMessage.totalTarget}`);

        // 等待 JobQueue 处理
        await new Promise(r => setTimeout(r, 3000));

        const stats = await gql(`query Stats($id: ID!) { messageDeliveryStats(id: $id) { totalTarget totalSent totalFailed totalRead } }`, { id: messageId }, adminToken);
        ok(`投递统计: target=${stats.messageDeliveryStats.totalTarget}, sent=${stats.messageDeliveryStats.totalSent}, failed=${stats.messageDeliveryStats.totalFailed}`);
    } catch (e) { fail('消息发送失败', e); }

    // 清理
    log('数据清理');
    try { await gql(`mutation DeleteMessage($id: ID!) { deleteMessage(id: $id) }`, { id: messageId }, adminToken); ok('消息已删除'); } catch (e) { fail('消息删除失败', e); }

    console.log('\n=== Results: ' + results.filter(r => r.ok).length + ' passed, ' + results.filter(r => !r.ok).length + ' failed ===');
    if (results.some(r => !r.ok)) process.exit(1);
}

main().catch(e => { console.error('验收失败:', e.message); process.exit(1); });
```

- [ ] **Step 3: Commit**

```bash
cd e:\code\vendure && git add reset-p3-pwd.js test-p3-flow.js && git commit -m "test: add P3 member+message E2E test scripts" --no-verify
```

---

## Task 13: 构建、运行测试并修复

**Files:**
- Various (修复构建/测试发现的问题)

- [ ] **Step 1: 构建所有修改的插件**

```bash
cd e:\code\vendure\packages\delivery-plugin && npm run build
cd e:\code\vendure\packages\member-level-plugin && npm run build
cd e:\code\vendure\packages\message-plugin && npm run build
```

- [ ] **Step 2: 启动 dev-server（如未运行）**

检查端口 3000 是否有响应。如无，启动 dev-server 并等待启动完成。

- [ ] **Step 3: 运行测试账号脚本**

```bash
cd e:\code\vendure && node reset-p3-pwd.js
```

- [ ] **Step 4: 运行 E2E 测试**

```bash
cd e:\code\vendure && node test-p3-flow.js
```

- [ ] **Step 5: 修复发现的问题**

常见问题及修复方向：
1. **NestJS DI 失败**：ChannelService 注入失败 → 检查 member-level-plugin 是否需要 import 或在 providers 中声明
2. **GraphQL schema 错误**：检查 plugin.ts schema 字符串是否完整
3. **权限错误**：重启 dev-server 触发 RoleSyncService.syncRoles()
4. **JobQueue 处理失败**：检查 RequestContext 构造方式，可能需要用 ChannelService.getChannelFromToken
5. **TypeScript 编译错误**：修复后重新 build 对应插件

每次修复后重新 build + 重启 dev-server + 重新运行测试。

- [ ] **Step 6: 测试全通过后提交修复**

```bash
cd e:\code\vendure && git add -A && git commit -m "fix: resolve issues found during P3 E2E testing" --no-verify
```

- [ ] **Step 7: 汇报测试结果**

汇报：测试通过数、发现并修复的问题、git commit hash。
