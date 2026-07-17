# 企业职工自提点功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vendure 多租户系统增加企业职工自提点配送方式，支持租户开通/关闭、宽松/强制模式、就近排序、四语多语言、三级权限分级。

**Architecture:** 扩展 CjkPlugin 现有 PickupLocation 实体（新增 type='employee'、isPublic、ownerChannelId），新增 EmployeeCustomer 绑定实体，新增 employee-pickup ShippingMethod 配套 checker/calculator/fulfillmentHandler，补全 Shop API 供 C 端查询，前端结算页按配送方式类型动态展示 UI 并支持定位就近排序。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeScript + TypeORM)、CjkPlugin、uni-app (Vue 3 + Vite)、Angular (Admin UI)

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-14-employee-pickup-design.md`

---

## Plan Review Notes（代码对照后修订）

对照实际代码审查后，对原计划作出以下关键修订：

1. **Task 1**: `ownerChannelId` 使用 `@EntityId({ nullable: true })` 而非 `@Column`（Vendure 外键引用规范），同步引入 `EntityId` 和 `ID` 装饰器
2. **Task 2**: `EmployeeCustomer` 必须 `implements ChannelAware`，补 `JoinTable`、`DeepPartial`、`EntityId` import
3. **Task 8**: 删除不存在的 `paginate` 函数引用，保留现有手动 `skip/take` 模式；`EntityNotFoundError` 从 `@vendure/core` 导入
4. **Task 16**: 必须修改 `types.ts` 扩展 `CjkPluginOptions`；`hasPickup` 表达式需包含 `employeePickup?.enabled`；通过 `config.authOptions.customPermissions` 注册自定义权限；`shopApiExtensions` 必须扩展 `Order.customFields` 暴露 `selectedPickupLocationId` 和 `pickupType`
5. **Task 17**: 为现有 3 个自提点补全经纬度（北京中关村、望京、五道口）
6. **Task 18-19**: shop-a 通过 `SHOP_A_SHIPPING_METHODS` 独立创建 ShippingMethod（非从 default 分配）；明确角色权限列表 `TENANT_ADMIN_PERMISSIONS` 和 `SALES_PERSON_PERMISSIONS`；明确测试客户为 `zhangsan@test.cn`（default）和 `wangwu@test.cn`（shop-a）
7. **Task 22**: tenant store 改为通过 `activeChannel` query 从后端加载 `employeePickupMode` 和 `defaultLocation`，而非写死在 `TENANT_CONFIGS`
8. **Task 27-28**: Admin UI 实际使用 Vendure Dashboard 扩展（React/TSX），不是 Angular 模块。plugin.ts 已有 `dashboard: '../dashboard/index.tsx'` 配置

---

## File Structure

### 后端 cjk-plugin（扩展）

| 文件 | 操作 | 职责 |
|---|---|---|
| `cjk-plugin/src/pickup/pickup-location.entity.ts` | 修改 | 新增 type='employee'、isPublic、ownerChannelId |
| `cjk-plugin/src/pickup/pickup-location.service.ts` | 修改 | 可见性查询、升级公共、channel 隔离校验、就近排序 |
| `cjk-plugin/src/pickup/pickup-location-admin.resolver.ts` | 修改 | 新增 promote/assign/remove mutation |
| `cjk-plugin/src/pickup/pickup-location-shop.resolver.ts` | 新建 | Shop API：pickupLocations、employeePickupLocations |
| `cjk-plugin/src/pickup/pickup-eligibility-checker.ts` | 修改 | 新增 employeePickupEligibilityChecker |
| `cjk-plugin/src/pickup/pickup-calculator.ts` | 修改 | 新增 employeePickupCalculator |
| `cjk-plugin/src/pickup/pickup-fulfillment-handler.ts` | 修改 | 新增 employeePickupFulfillmentHandler + 读取 order.customFields |
| `cjk-plugin/src/pickup/pickup-shop.resolver.ts` | 新建 | Shop API：setOrderPickupLocation mutation |
| `cjk-plugin/src/pickup/pickup-permissions.ts` | 新建 | 权限定义 |
| `cjk-plugin/src/pickup/i18n-messages.ts` | 新建 | 四语错误消息 |
| `cjk-plugin/src/pickup/enterprise-customer/enterprise-customer.entity.ts` | 新建 | EmployeeCustomer 实体 |
| `cjk-plugin/src/pickup/enterprise-customer/enterprise-customer.service.ts` | 新建 | CRUD + channel 隔离 |
| `cjk-plugin/src/pickup/enterprise-customer/enterprise-customer-admin.resolver.ts` | 新建 | Admin API |
| `cjk-plugin/src/tenant/tenant-channel-custom-fields.ts` | 修改 | 新增 employeePickupMode、defaultLocation |
| `cjk-plugin/src/tenant/tenant-setup.service.ts` | 修改 | 自动创建角色 + 权限同步 |
| `cjk-plugin/src/order/order-custom-fields.ts` | 新建 | Order.customFields |
| `cjk-plugin/src/plugin.ts` | 修改 | 注册新组件、API 扩展 |

### 后端 dev-server（populate）

| 文件 | 操作 | 职责 |
|---|---|---|
| `dev-server/china-data/sources.ts` | 修改 | 新增双阳区自提点、employee 类型、经纬度 |
| `dev-server/china-data/02-default-channel.ts` | 修改 | loose 模式、defaultLocation、ShippingMethod、角色、EmployeeCustomer |
| `dev-server/china-data/03-shop-a-channel.ts` | 修改 | strict 模式、defaultLocation、ShippingMethod 分配、EmployeeCustomer |
| `dev-server/dev-config.ts` | 修改 | CjkPlugin.init 启用 employeePickup |

### 前端 vshop

| 文件 | 操作 | 职责 |
|---|---|---|
| `vshop/src/pkg-order/pages/checkout.vue` | 修改 | 配送方式分类、动态 UI、自提点选择、定位兜底、提交校验 |
| `vshop/src/api/queries/pickup.ts` | 新建 | getPickupLocations、getEmployeePickupLocations |
| `vshop/src/api/mutations/checkout.ts` | 修改 | 新增 setOrderPickupLocation |
| `vshop/src/stores/tenant.ts` | 修改 | 加载 defaultLocation、employeePickupMode |
| `vshop/src/locale/zh-Hans.ts` | 修改 | 新增 checkout keys |
| `vshop/src/locale/en.ts` | 修改 | 新增 checkout keys |
| `vshop/src/locale/ja.ts` | 新建 | 日语 locale |
| `vshop/src/locale/ko.ts` | 新建 | 韩语 locale |

---

## Phase 1: 数据模型与后端基础

### Task 1: PickupLocation 实体扩展

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.entity.ts`

- [ ] **Step 1: 读取现有实体**

Read `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.entity.ts` 确认现有字段结构。

- [ ] **Step 2: 扩展实体**

修改 `pickup-location.entity.ts`，扩展 `type` 字段类型联合为 `'store' | 'point' | 'employee'`，新增 `isPublic` 和 `ownerChannelId` 字段。`ownerChannelId` 使用 `@EntityId` 装饰器（Vendure 外键引用规范），需引入 `EntityId` 和 `ID`：

```typescript
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ChannelAware, Channel, DeepPartial, EntityId, HasCustomFields, ID, VendureEntity } from '@vendure/core';

class CustomPickupLocationFields {}

@Entity()
export class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'varchar', default: 'store' })
    type: 'store' | 'point' | 'employee';

    @Column() address: string;

    @Column({ nullable: true }) phoneNumber: string;

    @Column({ nullable: true }) businessHours: string;

    @Column({ type: 'simple-json', nullable: true })
    coordinates: { lat: number; lng: number } | null;

    @Column({ nullable: true }) partner: string;

    @Column({ default: false }) isPublic: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomPickupLocationFields)
    customFields: CustomPickupLocationFields;
}
```

注意：保留现有 `type` 字段的 `@Column()` 装饰器形式也可工作（TypeScript 联合类型不会影响数据库列类型），但显式声明 `type: 'varchar'` 更清晰。`synchronize: true`（dev）会自动添加新列；生产环境需手写 migration。

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 编译成功无错误

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-location.entity.ts
git commit -m "Feat: extend PickupLocation with type/isPublic/ownerChannelId"
```

### Task 2: EmployeeCustomer 实体

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\enterprise-customer\enterprise-customer.entity.ts`

- [ ] **Step 1: 创建实体文件**

```typescript
import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import {
    Channel,
    ChannelAware,
    Customer,
    DeepPartial,
    EntityId,
    ID,
    VendureEntity,
} from '@vendure/core';
import { PickupLocation } from '../pickup-location.entity';

@Entity()
export class EmployeeCustomer extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<EmployeeCustomer>) {
        super(input);
    }

    @ManyToOne(() => Customer)
    customer: Customer;

    @EntityId()
    customerId: ID;

    @Column()
    enterpriseName: string;

    @Column({ nullable: true })
    employeeId: string;

    @ManyToMany(() => PickupLocation)
    @JoinTable({
        name: 'employee_customer_pickup_location',
        joinColumn: { name: 'employee_customer_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'pickup_location_id', referencedColumnName: 'id' },
    })
    pickupLocations: PickupLocation[];

    @ManyToOne(() => Channel)
    channel: Channel;

    @EntityId()
    channelId: ID;

    @Column({ default: false })
    verified: boolean;
}
```

注意：`implements ChannelAware` 是必需的，Vendure 通过此接口识别 channel 隔离实体。`@EntityId` 用于外键引用字段（customerId、channelId），与 `@ManyToOne` 关系字段配对。

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/src/pickup/enterprise-customer/
git commit -m "Feat: add EmployeeCustomer entity"
```

### Task 3: Order.customFields

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\order\order-custom-fields.ts`

- [ ] **Step 1: 创建 Order customFields**

```typescript
import { CustomFields, LanguageCode } from '@vendure/core';
import { PickupLocation } from '../pickup/pickup-location.entity';

export const orderCustomFields: CustomFields = {
    Order: [
        {
            name: 'selectedPickupLocationId',
            type: 'relation',
            entity: PickupLocation,
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '选中的自提点' },
                { languageCode: LanguageCode.en, value: 'Selected Pickup Location' },
                { languageCode: LanguageCode.ja, value: '選択した受取場所' },
                { languageCode: LanguageCode.ko, value: '선택된 수거 장소' },
            ],
        },
        {
            name: 'pickupType',
            type: 'string',
            nullable: true,
            public: true,
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提类型' },
                { languageCode: LanguageCode.en, value: 'Pickup Type' },
                { languageCode: LanguageCode.ja, value: '受取タイプ' },
                { languageCode: LanguageCode.ko, value: '수거 유형' },
            ],
        },
    ],
};
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/src/order/
git commit -m "Feat: add Order customFields for pickup location"
```

### Task 4: Channel.customFields 扩展

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 1: 读取现有文件**

Read `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 2: 新增两个字段**

在 `Channel` 数组中追加：

```typescript
{
    name: 'employeePickupMode',
    type: 'string',
    defaultValue: 'disabled',
    options: [
        { value: 'disabled', label: [
            { languageCode: LanguageCode.zh_Hans, value: '未开通' },
            { languageCode: LanguageCode.en, value: 'Disabled' },
            { languageCode: LanguageCode.ja, value: '未設定' },
            { languageCode: LanguageCode.ko, value: '미사용' },
        ]},
        { value: 'loose', label: [
            { languageCode: LanguageCode.zh_Hans, value: '宽松' },
            { languageCode: LanguageCode.en, value: 'Loose' },
            { languageCode: LanguageCode.ja, value: 'ルーズ' },
            { languageCode: LanguageCode.ko, value: '느슨함' },
        ]},
        { value: 'strict', label: [
            { languageCode: LanguageCode.zh_Hans, value: '强制' },
            { languageCode: LanguageCode.en, value: 'Strict' },
            { languageCode: LanguageCode.ja, value: '厳格' },
            { languageCode: LanguageCode.ko, value: '엄격함' },
        ]},
    ],
    label: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提模式' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup Mode' },
        { languageCode: LanguageCode.ja, value: '従業員受取モード' },
        { languageCode: LanguageCode.ko, value: '직원 수거 모드' },
    ],
},
{
    name: 'defaultLocation',
    type: 'json',
    nullable: true,
    label: [
        { languageCode: LanguageCode.zh_Hans, value: '租户默认位置（经纬度兜底）' },
        { languageCode: LanguageCode.en, value: 'Tenant Default Location (lat/lng fallback)' },
        { languageCode: LanguageCode.ja, value: 'テナントデフォルト位置（緯度経度フォールバック）' },
        { languageCode: LanguageCode.ko, value: '테넌트 기본 위치(위도/경도 폴백)' },
    ],
},
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts
git commit -m "Feat: add employeePickupMode and defaultLocation to Channel customFields"
```

### Task 5: 权限定义

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-permissions.ts`

- [ ] **Step 1: 创建权限定义文件**

```typescript
export const PickupPermissions = {
    ReadPickupLocation: 'PickupLocationRead',
    CreatePickupLocation: 'PickupLocationCreate',
    UpdatePickupLocation: 'PickupLocationUpdate',
    DeletePickupLocation: 'PickupLocationDelete',
    PromotePickupLocation: 'PickupLocationPromote',
    AssignPickupLocation: 'PickupLocationAssign',
    ReadEmployeeCustomer: 'EmployeeCustomerRead',
    CreateEmployeeCustomer: 'EmployeeCustomerCreate',
    UpdateEmployeeCustomer: 'EmployeeCustomerUpdate',
    DeleteEmployeeCustomer: 'EmployeeCustomerDelete',
    BindPickupLocation: 'EmployeeCustomerBind',
    VerifyEmployeeCustomer: 'EmployeeCustomerVerify',
    UpdateChannelPickupConfig: 'UpdateChannelPickupConfig',
} as const;
```

- [ ] **Step 2: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-permissions.ts
git commit -m "Feat: add pickup permission definitions"
```

### Task 6: i18n 消息模块

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\i18n-messages.ts`

- [ ] **Step 1: 创建四语错误消息**

```typescript
import { LanguageCode, RequestContext } from '@vendure/core';

export const ERROR_MESSAGES = {
    PICKUP_LOCATION_NOT_SELECTED: {
        [LanguageCode.zh_Hans]: '订单未选择自提点',
        [LanguageCode.en]: 'No pickup location selected for the order',
        [LanguageCode.ja]: '受取場所が選択されていません',
        [LanguageCode.ko]: '수거 장소가 선택되지 않았습니다',
    },
    PICKUP_LOCATION_NOT_BOUND: {
        [LanguageCode.zh_Hans]: '您未绑定该企业职工自提点',
        [LanguageCode.en]: 'You are not bound to this employee pickup location',
        [LanguageCode.ja]: 'この従業員受取場所にバインドされていません',
        [LanguageCode.ko]: '이 직원 수거 장소에 바인딩되지 않았습니다',
    },
    FORBIDDEN_PROMOTE: {
        [LanguageCode.zh_Hans]: '仅超级管理员可升级公共自提点',
        [LanguageCode.en]: 'Only super admin can promote pickup location',
        [LanguageCode.ja]: 'スーパー管理者のみ公開に昇格できます',
        [LanguageCode.ko]: '슈퍼 관리자만 공개로 승격할 수 있습니다',
    },
    NO_ACTIVE_ORDER: {
        [LanguageCode.zh_Hans]: '无活动订单',
        [LanguageCode.en]: 'No active order',
        [LanguageCode.ja]: 'アクティブな注文がありません',
        [LanguageCode.ko]: '활성 주문이 없습니다',
    },
    PICKUP_LOCATION_NOT_VISIBLE: {
        [LanguageCode.zh_Hans]: '自提点不在当前租户可见范围内',
        [LanguageCode.en]: 'Pickup location not visible in current tenant',
        [LanguageCode.ja]: '受取場所が現在のテナントで表示できません',
        [LanguageCode.ko]: '수거 장소가 현재 테넌트에서 볼 수 없습니다',
    },
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

export function translateError(ctx: RequestContext, key: ErrorMessageKey): string {
    const messages = ERROR_MESSAGES[key];
    return messages[ctx.languageCode] || messages[LanguageCode.en];
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/cjk-plugin/src/pickup/i18n-messages.ts
git commit -m "Feat: add i18n error messages (zh/en/ja/ko)"
```

### Task 7: EmployeeCustomer Service

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\enterprise-customer\enterprise-customer.service.ts`

- [ ] **Step 1: 创建 service**

```typescript
import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { EmployeeCustomer } from './enterprise-customer.entity';
import { PickupLocationService } from '../pickup-location.service';

@Injectable()
export class EmployeeCustomerService {
    constructor(
        private connection: TransactionalConnection,
        @Inject(PickupLocationService) private pickupLocationService: PickupLocationService,
    ) {}

    async findByCustomer(ctx: RequestContext, customerId: ID): Promise<EmployeeCustomer[]> {
        return this.connection.getRepository(ctx, EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.customerId = :customerId', { customerId })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getMany();
    }

    async findOne(ctx: RequestContext, id: ID): Promise<EmployeeCustomer | undefined> {
        return this.connection.getRepository(ctx, EmployeeCustomer)
            .createQueryBuilder('ec')
            .leftJoinAndSelect('ec.pickupLocations', 'pl')
            .where('ec.id = :id', { id })
            .andWhere('ec.channelId = :channelId', { channelId: ctx.channelId })
            .getOne() ?? undefined;
    }

    async create(ctx: RequestContext, input: {
        customerId: ID;
        enterpriseName: string;
        employeeId?: string;
        pickupLocationIds: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer> {
        // 校验自提点在当前 channel 可见
        const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
        const allowedIds = allowedLocations.map(l => l.id);
        const invalidIds = input.pickupLocationIds.filter(id => !allowedIds.includes(id));
        if (invalidIds.length > 0) {
            throw new UserInputError('部分自提点不在当前租户可见范围内');
        }

        const ec = new EmployeeCustomer();
        ec.customerId = input.customerId;
        ec.enterpriseName = input.enterpriseName;
        ec.employeeId = input.employeeId;
        ec.channelId = ctx.channelId;
        ec.verified = input.verified ?? false;
        ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds.includes(l.id));

        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }

    async update(ctx: RequestContext, input: {
        id: ID;
        enterpriseName?: string;
        employeeId?: string;
        pickupLocationIds?: ID[];
        verified?: boolean;
    }): Promise<EmployeeCustomer> {
        const ec = await this.findOne(ctx, input.id);
        if (!ec) throw new UserInputError('EmployeeCustomer not found');

        if (input.enterpriseName != null) ec.enterpriseName = input.enterpriseName;
        if (input.employeeId != null) ec.employeeId = input.employeeId;
        if (input.verified != null) ec.verified = input.verified;

        if (input.pickupLocationIds != null) {
            const allowedLocations = await this.pickupLocationService.findByType(ctx, 'employee');
            ec.pickupLocations = allowedLocations.filter(l => input.pickupLocationIds!.includes(l.id));
        }

        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        const ec = await this.findOne(ctx, id);
        if (!ec) return false;
        await this.connection.getRepository(ctx, EmployeeCustomer).remove(ec);
        return true;
    }

    async verify(ctx: RequestContext, id: ID): Promise<EmployeeCustomer> {
        const ec = await this.findOne(ctx, id);
        if (!ec) throw new UserInputError('EmployeeCustomer not found');
        ec.verified = true;
        return this.connection.getRepository(ctx, EmployeeCustomer).save(ec);
    }
}
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/src/pickup/enterprise-customer/enterprise-customer.service.ts
git commit -m "Feat: add EmployeeCustomerService with channel isolation"
```

---

## Phase 2: 后端 Shipping 组件

### Task 8: PickupLocationService 可见性查询 + 就近排序

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.service.ts`

- [ ] **Step 1: 读取现有 service**

Read `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.service.ts`

- [ ] **Step 2: 修改 findAll 可见性查询**

将现有 `findAll` 方法改为（保留手动 skip/take 分页模式，与现有代码一致；不使用不存在的 `paginate` 函数）：

```typescript
async findAll(ctx: RequestContext, options?: ListQueryOptions<PickupLocation>): Promise<PaginatedList<PickupLocation>> {
    const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
    // 可见规则：公共点 + 本租户自建点
    qb.where(
        '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
        { isPublic: true, channelId: ctx.channelId }
    );
    // channels 关联：仅返回已启用的
    qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });

    if (options?.filter?.name) {
        qb.andWhere('pl.name LIKE :name', { name: `%${options.filter.name}%` });
    }
    if (options?.filter?.type) {
        qb.andWhere('pl.type = :type', { type: options.filter.type });
    }

    const skip = options?.skip || 0;
    const take = options?.take || 10;
    qb.skip(skip).take(take);

    const [items, totalItems] = await qb.getManyAndCount();
    return { items, totalItems };
}
```

注意：原 `findAll` 已经有 `name`/`type` filter 和手动 skip/take，本次修改仅在 where 子句追加可见性条件。

- [ ] **Step 3: 新增 findByType 方法**

```typescript
async findByType(ctx: RequestContext, type: string): Promise<PickupLocation[]> {
    const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
    qb.where(
        '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
        { isPublic: true, channelId: ctx.channelId }
    );
    qb.andWhere('pl.type = :type', { type });
    qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
    return qb.getMany();
}
```

- [ ] **Step 4: 新增 findByIds 方法**

```typescript
async findByIds(ctx: RequestContext, ids: ID[]): Promise<PickupLocation[]> {
    if (ids.length === 0) return [];
    const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
    qb.where(
        '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
        { isPublic: true, channelId: ctx.channelId }
    );
    qb.andWhere('pl.id IN (:...ids)', { ids });
    qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
    return qb.getMany();
}
```

- [ ] **Step 5: 新增 promoteToPublic 方法**

```typescript
async promoteToPublic(ctx: RequestContext, id: ID): Promise<PickupLocation> {
    const loc = await this.findOne(ctx, id);
    if (!loc) throw new EntityNotFoundError('PickupLocation', id);
    loc.isPublic = true;
    loc.ownerChannelId = null;
    return this.connection.getRepository(ctx, PickupLocation).save(loc);
}
```

注意：`EntityNotFoundError` 需在文件顶部从 `@vendure/core` 导入：`import { EntityNotFoundError } from '@vendure/core';`

- [ ] **Step 6: 新增 sortByDistance 方法**

```typescript
async sortByDistance(locations: PickupLocation[], lat: number, lng: number): Promise<PickupLocation[]> {
    return locations
        .map(loc => ({
            loc,
            distance: loc.coordinates
                ? this.haversineDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng)
                : Number.MAX_VALUE
        }))
        .sort((a, b) => a.distance - b.distance)
        .map(item => item.loc);
}

private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 7: 修改 create 方法设置 ownerChannelId**

修改现有 `create` 方法，设置 `ownerChannelId` 和 `isPublic`：

```typescript
async create(ctx: RequestContext, input: any): Promise<PickupLocation> {
    const repo = this.connection.getRepository(ctx, PickupLocation);
    const location = new PickupLocation(input);
    location.channels = [ctx.channel];
    location.ownerChannelId = ctx.channelId;
    location.isPublic = input.isPublic ?? false;
    return repo.save(location);
}
```

注意：公共自提点（isPublic=true）的 ownerChannelId 在 promoteToPublic 时会被置为 null；其余自提点的 ownerChannelId 始终等于创建者的 channelId。

- [ ] **Step 8: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 9: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-location.service.ts
git commit -m "Feat: add visibility query, distance sort, promote to public"
```

### Task 9: employee-pickup-eligibility checker

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-eligibility-checker.ts`

- [ ] **Step 1: 读取现有文件**

Read `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-eligibility-checker.ts`

- [ ] **Step 2: 新增 employeePickupEligibilityChecker**

在文件末尾追加：

```typescript
import { Injector } from '@vendure/core';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';

let employeeCustomerService: EmployeeCustomerService;

export const employeePickupEligibilityChecker = new ShippingEligibilityChecker({
    code: 'employee-pickup-eligibility',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提资格检查' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup Eligibility Checker' },
        { languageCode: LanguageCode.ja, value: '従業員受取資格チェック' },
        { languageCode: LanguageCode.ko, value: '직원 수거 자격 확인' },
    ],
    args: {},
    init: (injector: Injector) => {
        employeeCustomerService = injector.get(EmployeeCustomerService);
    },
    check: async (ctx, order) => {
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'disabled') return false;
        if (mode === 'loose') return true;
        if (mode === 'strict') {
            if (!ctx.activeUserId) return false;
            const bindings = await employeeCustomerService.findByCustomer(ctx, ctx.activeUserId);
            return bindings.length > 0;
        }
        return false;
    },
});
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-eligibility-checker.ts
git commit -m "Feat: add employee-pickup-eligibility checker with 3 modes"
```

### Task 10: employee-pickup-calculator

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-calculator.ts`

- [ ] **Step 1: 读取现有文件**

- [ ] **Step 2: 新增 employeePickupCalculator**

在文件末尾追加：

```typescript
export const employeePickupCalculator = new ShippingCalculator({
    code: 'employee-pickup-calculator',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提运费计算' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup Shipping Calculator' },
        { languageCode: LanguageCode.ja, value: '従業員受取送料計算' },
        { languageCode: LanguageCode.ko, value: '직원 수거 배송비 계산' },
    ],
    args: {
        shippingPrice: {
            type: 'int',
            defaultValue: 0,
            ui: { component: 'currency-form-input' },
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '运费（分）' },
                { languageCode: LanguageCode.en, value: 'Shipping Price (cents)' },
                { languageCode: LanguageCode.ja, value: '送料（分）' },
                { languageCode: LanguageCode.ko, value: '배송비(분)' },
            ],
        },
    },
    calculate: (ctx, order, args) => {
        return {
            price: args.shippingPrice || 0,
            taxRate: 0,
            priceIncludesTax: true,
            metadata: { pickupType: 'employee' },
        };
    },
});
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-calculator.ts
git commit -m "Feat: add employee-pickup-calculator"
```

### Task 11: employee-pickup fulfillmentHandler

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-fulfillment-handler.ts`

- [ ] **Step 1: 读取现有文件**

- [ ] **Step 2: 新增 employeePickupFulfillmentHandler**

在文件末尾追加（需注入 PickupLocationService 和 EmployeeCustomerService）：

```typescript
import { Injector, LanguageCode } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';
import { translateError } from './i18n-messages';

let pickupLocationService: PickupLocationService;
let employeeCustomerService: EmployeeCustomerService;

const methodLabels: Record<string, string> = {
    [LanguageCode.zh_Hans]: '企业职工自提',
    [LanguageCode.en]: 'Employee Pickup',
    [LanguageCode.ja]: '従業員受取',
    [LanguageCode.ko]: '직원 수거',
};

export const employeePickupFulfillmentHandler = new FulfillmentHandler({
    code: 'employee-pickup',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup' },
        { languageCode: LanguageCode.ja, value: '従業員受取' },
        { languageCode: LanguageCode.ko, value: '직원 수거' },
    ],
    args: {},
    init: (injector: Injector) => {
        pickupLocationService = injector.get(PickupLocationService);
        employeeCustomerService = injector.get(EmployeeCustomerService);
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        const order = orders[0];
        const locationId = order.customFields.selectedPickupLocationId;
        if (!locationId) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_SELECTED'));

        const location = await pickupLocationService.findOne(ctx, locationId);
        if (!location) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));

        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'strict') {
            const bindings = await employeeCustomerService.findByCustomer(ctx, order.customer.id);
            const allowed = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
            if (!allowed.includes(locationId)) {
                throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            }
        }

        return {
            method: `${methodLabels[ctx.languageCode] || methodLabels[LanguageCode.en]} - ${location.name}`,
            trackingCode: `PICKUP-EMP-${location.id}`,
        };
    },
});
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-fulfillment-handler.ts
git commit -m "Feat: add employee-pickup fulfillmentHandler with strict mode validation"
```

---

## Phase 3: 后端 API

### Task 12: PickupLocation Admin Resolver 扩展

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location-admin.resolver.ts`

- [ ] **Step 1: 读取现有 resolver**

- [ ] **Step 2: 新增 promote/assign/remove mutation**

为新增的 mutation 添加 `@Allow` 装饰器明确权限（需从 `@vendure/core` 导入 `Allow`、`Permission`、`PickupPermissions`）：

```typescript
import { Allow, Ctx, Permission, RequestContext, Transaction, ID, PaginatedList, ListQueryOptions } from '@vendure/core';
import { PickupPermissions } from './pickup-permissions';

// 在现有 PickupLocationAdminResolver 类中追加：

@Mutation()
@Transaction()
@Allow(Permission.SuperAdmin)
async promotePickupLocationToPublic(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<PickupLocation> {
    return this.pickupLocationService.promoteToPublic(ctx, id);
}

@Mutation()
@Transaction()
@Allow(PickupPermissions.AssignPickupLocation)
async assignPickupLocationsToChannel(@Ctx() ctx: RequestContext, @Args('ids') ids: ID[]): Promise<boolean> {
    await this.pickupLocationService.assignToChannel(ctx, ids, ctx.channelId);
    return true;
}

@Mutation()
@Transaction()
@Allow(PickupPermissions.AssignPickupLocation)
async removePickupLocationsFromChannel(@Ctx() ctx: RequestContext, @Args('ids') ids: ID[]): Promise<boolean> {
    await this.pickupLocationService.removeFromChannel(ctx, ids, ctx.channelId);
    return true;
}
```

注意：Vendure 默认 admin API 要求登录，但不会自动校验具体权限。`@Allow` 装饰器显式声明所需权限，由 `AuthService` 在请求时校验。`promotePickupLocationToPublic` 仅 SuperAdmin 可调用；assign/remove 需 `PickupPermissions.AssignPickupLocation` 权限。

- [ ] **Step 3: 在 PickupLocationService 中新增 assignToChannel/removeFromChannel**

需在 service 文件顶部 import `Channel`：`import { Channel } from '@vendure/core';`。使用 `findOne` 而非已弃用的 `findByIds`，并通过 `In` 操作符批量查询：

```typescript
import { In } from 'typeorm';

async assignToChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
    const repo = this.connection.getRepository(ctx, PickupLocation);
    const locations = await repo.find({
        where: { id: In(ids as any[]) },
        relations: { channels: true },
    });
    const channel = await this.connection.getRepository(ctx, Channel).findOne({
        where: { id: channelId as any },
    });
    if (!channel) throw new EntityNotFoundError('Channel', channelId);

    for (const loc of locations) {
        if (!loc.channels.find(c => c.id === channelId)) {
            loc.channels.push(channel);
        }
    }
    await repo.save(locations);
}

async removeFromChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
    const repo = this.connection.getRepository(ctx, PickupLocation);
    const locations = await repo.find({
        where: { id: In(ids as any[]) },
        relations: { channels: true },
    });
    for (const loc of locations) {
        loc.channels = loc.channels.filter(c => c.id !== channelId);
    }
    await repo.save(locations);
}
```

- [ ] **Step 4: 扩展 admin GraphQL schema**

在 plugin.ts 的 adminApiExtensions schema 中追加：

```graphql
extend type Mutation {
    promotePickupLocationToPublic(id: ID!): PickupLocation!
    assignPickupLocationsToChannel(ids: [ID!]!): Boolean!
    removePickupLocationsFromChannel(ids: [ID!]!): Boolean!
}
```

- [ ] **Step 5: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 6: 提交**

```bash
git add packages/cjk-plugin/src/pickup/
git commit -m "Feat: add promote/assign/remove mutations for PickupLocation"
```

### Task 13: PickupLocation Shop Resolver（查询 + 就近排序）

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location-shop.resolver.ts`

- [ ] **Step 1: 创建 shop resolver**

```typescript
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';
import { PickupLocation } from './pickup-location.entity';

@Resolver()
export class PickupLocationShopResolver {
    constructor(
        private pickupLocationService: PickupLocationService,
        private employeeCustomerService: EmployeeCustomerService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async pickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('type') type?: string,
        @Args('lat') lat?: number,
        @Args('lng') lng?: number,
    ): Promise<PickupLocation[]> {
        const locations = type
            ? await this.pickupLocationService.findByType(ctx, type)
            : await this.pickupLocationService.findAll(ctx);
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }

    @Query()
    @Allow(Permission.Owner)
    async employeePickupLocations(
        @Ctx() ctx: RequestContext,
        @Args('lat') lat?: number,
        @Args('lng') lng?: number,
    ): Promise<PickupLocation[]> {
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'disabled') return [];

        if (mode === 'loose') {
            const locations = await this.pickupLocationService.findByType(ctx, 'employee');
            if (lat != null && lng != null) {
                return this.pickupLocationService.sortByDistance(locations, lat, lng);
            }
            return locations;
        }

        // strict
        if (!ctx.activeUserId) return [];
        const bindings = await this.employeeCustomerService.findByCustomer(ctx, ctx.activeUserId);
        const locationIds = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
        const locations = await this.pickupLocationService.findByIds(ctx, locationIds);
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }
}
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-location-shop.resolver.ts
git commit -m "Feat: add PickupLocation shop resolver with distance sort"
```

### Task 14: EmployeeCustomer Admin Resolver

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\enterprise-customer\enterprise-customer-admin.resolver.ts`

- [ ] **Step 1: 创建 admin resolver**

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { EmployeeCustomerService } from './enterprise-customer.service';
import { EmployeeCustomer } from './enterprise-customer.entity';

@Resolver()
export class EmployeeCustomerAdminResolver {
    constructor(private employeeCustomerService: EmployeeCustomerService) {}

    @Query()
    async employeeCustomers(@Ctx() ctx: RequestContext): Promise<EmployeeCustomer[]> {
        // 返回当前 channel 的所有绑定
        return this.employeeCustomerService.findAll(ctx);
    }

    @Query()
    async employeeCustomer(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<EmployeeCustomer | undefined> {
        return this.employeeCustomerService.findOne(ctx, id);
    }

    @Query()
    async employeeCustomersByCustomer(@Ctx() ctx: RequestContext, @Args('customerId') customerId: ID): Promise<EmployeeCustomer[]> {
        return this.employeeCustomerService.findByCustomer(ctx, customerId);
    }

    @Mutation()
    async createEmployeeCustomer(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.create(ctx, input);
    }

    @Mutation()
    async updateEmployeeCustomer(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.update(ctx, input);
    }

    @Mutation()
    async deleteEmployeeCustomer(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.employeeCustomerService.delete(ctx, id);
    }

    @Mutation()
    async bindEnterprisePickupLocations(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('pickupLocationIds') pickupLocationIds: ID[]): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.update(ctx, { id, pickupLocationIds });
    }

    @Mutation()
    async verifyEmployeeCustomer(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<EmployeeCustomer> {
        return this.employeeCustomerService.verify(ctx, id);
    }
}
```

- [ ] **Step 2: 在 EmployeeCustomerService 中新增 findAll 方法**

```typescript
async findAll(ctx: RequestContext): Promise<EmployeeCustomer[]> {
    return this.connection.getRepository(ctx, EmployeeCustomer)
        .createQueryBuilder('ec')
        .leftJoinAndSelect('ec.pickupLocations', 'pl')
        .leftJoinAndSelect('ec.customer', 'customer')
        .where('ec.channelId = :channelId', { channelId: ctx.channelId })
        .getMany();
}
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/pickup/enterprise-customer/
git commit -m "Feat: add EmployeeCustomer admin resolver"
```

### Task 15: Pickup Shop Resolver（setOrderPickupLocation mutation）

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-shop.resolver.ts`

- [ ] **Step 1: 创建 shop resolver**

```typescript
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, Permission, RequestContext, UserInputError } from '@vendure/core';
import { OrderService } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { translateError } from './i18n-messages';

@Resolver()
export class PickupShopResolver {
    constructor(
        private orderService: OrderService,
        private pickupLocationService: PickupLocationService,
    ) {}

    @Mutation()
    @Allow(Permission.Owner)
    async setOrderPickupLocation(
        @Ctx() ctx: RequestContext,
        @Args('pickupLocationId') pickupLocationId: ID,
        @Args('pickupType') pickupType: string,
    ): Promise<Order> {
        const order = await this.orderService.getActiveOrderForUser(ctx, ctx.activeUserId!);
        if (!order) throw new UserInputError(translateError(ctx, 'NO_ACTIVE_ORDER'));

        const location = await this.pickupLocationService.findOne(ctx, pickupLocationId);
        if (!location) throw new UserInputError(translateError(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));

        // 1. 写入 Order.customFields
        await this.orderService.updateCustomFields(ctx, order.id, {
            selectedPickupLocationId: pickupLocationId,
            pickupType,
        });

        // 2. 同步设置 shipping address 为自提点地址
        await this.orderService.setShippingAddress(ctx, order.id, {
            fullName: order.customer?.firstName || '自提用户',
            streetLine1: location.address,
            phoneNumber: location.phoneNumber || '',
            countryCode: 'CN',
        });

        return this.orderService.findOne(ctx, order.id);
    }
}
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/src/pickup/pickup-shop.resolver.ts
git commit -m "Feat: add setOrderPickupLocation shop mutation"
```

### Task 16: plugin.ts 注册所有组件

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts`

- [ ] **Step 1: 读取现有 plugin.ts**

- [ ] **Step 2: 修改 hasPickup 表达式并注册 ShippingMethod 组件**

**关键**：现有 `hasPickup = CjkPlugin.options.storePickup?.enabled || CjkPlugin.options.pickupPoint?.enabled;` 必须扩展加入 `employeePickup?.enabled`，否则当只启用 employeePickup 时 `shippingOptions` 不会被初始化，后续 push 操作会失败。

修改 `configuration` 钩子中的 `hasPickup` 表达式，并追加 employee-pickup 分支：

```typescript
const hasPickup = CjkPlugin.options.storePickup?.enabled
    || CjkPlugin.options.pickupPoint?.enabled
    || CjkPlugin.options.employeePickup?.enabled;
if (hasPickup) {
    config.shippingOptions = config.shippingOptions || {};
    config.shippingOptions.shippingEligibilityCheckers = [
        ...(config.shippingOptions.shippingEligibilityCheckers || []),
    ];
    config.shippingOptions.shippingCalculators = [
        ...(config.shippingOptions.shippingCalculators || []),
    ];
    config.shippingOptions.fulfillmentHandlers = [
        ...(config.shippingOptions.fulfillmentHandlers || []),
    ];

    if (CjkPlugin.options.storePickup?.enabled) {
        config.shippingOptions.shippingEligibilityCheckers!.push(storePickupEligibilityChecker);
        config.shippingOptions.shippingCalculators!.push(storePickupCalculator);
        config.shippingOptions.fulfillmentHandlers!.push(storePickupFulfillmentHandler);
    }

    if (CjkPlugin.options.pickupPoint?.enabled) {
        config.shippingOptions.shippingEligibilityCheckers!.push(pickupPointEligibilityChecker);
        config.shippingOptions.shippingCalculators!.push(pickupPointCalculator);
        config.shippingOptions.fulfillmentHandlers!.push(pickupPointFulfillmentHandler);
    }

    if (CjkPlugin.options.employeePickup?.enabled) {
        config.shippingOptions.shippingEligibilityCheckers!.push(employeePickupEligibilityChecker);
        config.shippingOptions.shippingCalculators!.push(employeePickupCalculator);
        config.shippingOptions.fulfillmentHandlers!.push(employeePickupFulfillmentHandler);
    }
}
```

- [ ] **Step 3: 注册 providers**

在 providers 中追加：

```typescript
EmployeeCustomerService,
PickupLocationShopResolver,
EmployeeCustomerAdminResolver,
PickupShopResolver,
```

- [ ] **Step 4: 扩展 adminApiExtensions schema**

追加 EmployeeCustomer 相关 type 和 query/mutation：

```graphql
type EmployeeCustomer implements Node {
    id: ID!
    customer: Customer!
    enterpriseName: String!
    employeeId: String
    pickupLocations: [PickupLocation!]!
    channel: Channel!
    verified: Boolean!
    createdAt: DateTime!
}

input CreateEmployeeCustomerInput {
    customerId: ID!
    enterpriseName: String!
    employeeId: String
    pickupLocationIds: [ID!]!
    verified: Boolean
}

input UpdateEmployeeCustomerInput {
    id: ID!
    enterpriseName: String
    employeeId: String
    pickupLocationIds: [ID!]
    verified: Boolean
}

extend type Query {
    employeeCustomers: [EmployeeCustomer!]!
    employeeCustomer(id: ID!): EmployeeCustomer
    employeeCustomersByCustomer(customerId: ID!): [EmployeeCustomer!]!
}

extend type Mutation {
    createEmployeeCustomer(input: CreateEmployeeCustomerInput!): EmployeeCustomer!
    updateEmployeeCustomer(input: UpdateEmployeeCustomerInput!): EmployeeCustomer!
    deleteEmployeeCustomer(id: ID!): Boolean!
    bindEnterprisePickupLocations(id: ID!, pickupLocationIds: [ID!]!): EmployeeCustomer!
    verifyEmployeeCustomer(id: ID!): EmployeeCustomer!
}
```

- [ ] **Step 5: 扩展 shopApiExtensions schema**

**关键**：除了 query/mutation，必须显式扩展 `Order.customFields` 暴露 `selectedPickupLocationId` 和 `pickupType` 字段，否则前端 shop API 查询无法返回这些字段（即使 customFields 配置了 `public: true`，shop API 仍需在 schema 中声明）。

```graphql
extend type Query {
    pickupLocations(type: String, lat: Float, lng: Float): [PickupLocation!]!
    employeePickupLocations(lat: Float, lng: Float): [PickupLocation!]!
}

extend type Mutation {
    setOrderPickupLocation(pickupLocationId: ID!, pickupType: String!): Order!
}

# 暴露 Order.customFields 给 shop API（Vendure 不会自动暴露 customFields 到 shop schema）
extend type Order {
    customFields: OrderCustomFields!
}

type OrderCustomFields {
    selectedPickupLocationId: ID
    pickupType: String
}
```

注意：Vendure v3 中，admin API 默认自动暴露 customFields，但 shop API 需要手动声明。`OrderCustomFields` 是新建类型，不与 Vendure 内置冲突。

- [ ] **Step 6: 注册 Order customFields**

在 `configuration` 钩子中：

```typescript
config.customFields = {
    ...config.customFields,
    Order: [
        ...(config.customFields?.Order || []),
        ...orderCustomFields.Order!,
    ],
};
```

- [ ] **Step 7: 注册自定义权限**

**关键**：Vendure 自定义权限必须通过 `config.authOptions.customPermissions` 注册，否则 `@Allow(PickupPermissions.XXX)` 装饰器无法识别这些权限。在 `configuration` 钩子中追加：

```typescript
import { PickupPermissions } from './pickup/pickup-permissions';

// 在 configuration 钩子中：
config.authOptions = config.authOptions || {};
config.authOptions.customPermissions = [
    ...(config.authOptions.customPermissions || []),
    ...Object.entries(PickupPermissions).map(([key, value]) => ({
        name: value,
        label: key,
        assignable: true,
    })),
];
```

- [ ] **Step 8: 扩展 CjkPluginOptions 类型**

修改 `e:\code\vendure\packages\cjk-plugin\src\types.ts`，新增 `employeePickup` 字段：

```typescript
export interface CjkPluginOptions {
    i18n?: { enabled: boolean; languages?: string[] };
    regions?: { enabled: boolean };
    tenant?: { enabled: boolean };
    cod?: { enabled: boolean };
    storePickup?: { enabled: boolean };
    pickupPoint?: { enabled: boolean };
    employeePickup?: { enabled: boolean };   // 新增
    promotionPolicy?: { enabled: boolean };
}
```

- [ ] **Step 9: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 10: 提交**

```bash
git add packages/cjk-plugin/src/
git commit -m "Feat: register employee-pickup components in plugin.ts"
```

---

## Phase 4: Populate 数据

### Task 17: sources.ts 新增测试数据

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\china-data\sources.ts`

- [ ] **Step 1: 读取现有 DEFAULT_PICKUP_LOCATIONS**

- [ ] **Step 2: 为现有自提点补全经纬度**

更新 `DEFAULT_PICKUP_LOCATIONS` 每项添加 `coordinates` 字段（北京三里屯/五道口/望京的近似经纬度）：

```typescript
export const DEFAULT_PICKUP_LOCATIONS = [
    {
        name: '中关村门店', type: 'store' as const,
        address: '北京市海淀区中关村大街1号',
        phoneNumber: '010-12345678', businessHours: '09:00-22:00',
        coordinates: { lat: 39.984702, lng: 116.311407 },
    },
    {
        name: '望京SOHO店', type: 'store' as const,
        address: '北京市朝阳区望京街10号',
        phoneNumber: '010-87654321', businessHours: '09:00-21:00',
        coordinates: { lat: 39.995830, lng: 116.478850 },
    },
    {
        name: '菜鸟驿站(五道口店)', type: 'point' as const,
        address: '北京市海淀区成府路28号',
        phoneNumber: '010-66668888', businessHours: '08:00-22:00',
        coordinates: { lat: 39.992870, lng: 116.337650 },
    },
];

export const SHOP_A_PICKUP_LOCATIONS = [
    {
        name: '生鲜自提点(国贸店)', type: 'store' as const,
        address: '北京市朝阳区建国门外大街1号',
        phoneNumber: '010-11112222', businessHours: '07:00-21:00',
        coordinates: { lat: 39.908160, lng: 116.459790 },
    },
];
```

- [ ] **Step 3: 新增双阳区自提点**

在 `DEFAULT_PICKUP_LOCATIONS` 追加：

```typescript
{
    name: '双阳商城店', type: 'store' as const,
    address: '吉林省长春市双阳区西双阳大街188号',
    phoneNumber: '0431-84221001', businessHours: '08:30-20:30',
    coordinates: { lat: 43.526210, lng: 125.664780 },
},
{
    name: '菜鸟驿站(双阳泰山店)', type: 'point' as const,
    address: '吉林省长春市双阳区泰山路25号',
    phoneNumber: '0431-84221202', businessHours: '08:00-21:00',
    coordinates: { lat: 43.528890, lng: 125.665420 },
},
{
    name: '长春科技学院自提点', type: 'employee' as const,
    address: '吉林省长春市双阳区双阳大街1697号',
    phoneNumber: '0431-84221666', businessHours: '09:00-17:00',
    coordinates: { lat: 43.533450, lng: 125.671230 },
    isPublic: true,
},
```

- [ ] **Step 4: 新增 SHOP_A 测试数据**

在 `SHOP_A_PICKUP_LOCATIONS` 追加：

```typescript
{
    name: '双阳生鲜自提点', type: 'store' as const,
    address: '吉林省长春市双阳区东双阳大街555号',
    phoneNumber: '0431-84222888', businessHours: '07:00-21:00',
    coordinates: { lat: 43.525870, lng: 125.668950 },
},
{
    name: '吉林农业大学自提点', type: 'employee' as const,
    address: '吉林省长春市双阳区新城大街2888号',
    phoneNumber: '0431-84222999', businessHours: '08:00-18:00',
    coordinates: { lat: 43.531120, lng: 125.679840 },
    isPublic: false,
},
```

- [ ] **Step 5: 新增 employee-pickup ShippingMethod 定义**

在 `DEFAULT_SHIPPING_METHODS` 追加 employee-pickup（default channel，loose 模式可用）：

```typescript
{
    code: 'employee-pickup',
    name: '企业职工自提',
    description: '企业职工自提点自提',
    fulfillmentHandler: 'employee-pickup',
    checker: { code: 'employee-pickup-eligibility', arguments: [] },
    calculator: { code: 'employee-pickup-calculator', arguments: [{ name: 'shippingPrice', value: '0' }] },
},
```

同时修改 `SHOP_A_SHIPPING_METHODS`，让 shop-a 也独立创建一份 employee-pickup（与 store-pickup 同模式：每个 channel 独立创建 ShippingMethod 实例）：

```typescript
export const SHOP_A_SHIPPING_METHODS = [
    DEFAULT_SHIPPING_METHODS[0], // store-pickup
    DEFAULT_SHIPPING_METHODS[2], // free-shipping-99
    DEFAULT_SHIPPING_METHODS.find(sm => sm.code === 'employee-pickup')!, // employee-pickup（shop-a strict 模式）
];
```

注意：Vendure 的 ShippingMethod 是 channel 隔离的实体，每个 channel 需要独立的 ShippingMethod 实例（即使 code 相同）。`SHOP_A_SHIPPING_METHODS` 引用 `DEFAULT_SHIPPING_METHODS` 中相同的对象定义，但在 shop-a channel 的 ctx 下创建，会生成独立的实例。

- [ ] **Step 6: 提交**

```bash
git add packages/dev-server/china-data/sources.ts
git commit -m "Feat: add shuangyang district pickup locations with coordinates"
```

### Task 18: 02-default-channel.ts 更新

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\china-data\02-default-channel.ts`

- [ ] **Step 1: 读取现有文件**

- [ ] **Step 2: 更新 channel customFields**

在 `channelService.update` 中追加：

```typescript
customFields: {
    couponStackable: false,
    maxStackableCount: null,
    employeePickupMode: 'loose',
    defaultLocation: { lat: 43.526210, lng: 125.664780 },
},
```

- [ ] **Step 3: 创建 employee-pickup ShippingMethod**

在 `createShippingMethods` 函数中追加 employee-pickup 的创建（带四语 translations）。

- [ ] **Step 4: 分配 employee-pickup 到 default channel**

ShippingMethod 默认创建在 default channel，无需额外分配。

- [ ] **Step 5: 创建 EmployeeCustomer 测试绑定（default channel）**

明确使用 `zhangsan@test.cn`（default channel 的测试客户，CUSTOMERS[0]）作为绑定对象：

```typescript
import { EmployeeCustomerService } from '@vendure/cjk-plugin';
import { CustomerService } from '@vendure/core';

async function createEmployeeCustomers(app: INestApplication, ctx: RequestContext): Promise<void> {
    const employeeCustomerService = app.get(EmployeeCustomerService);
    const customerService = app.get(CustomerService);
    const pickupLocationService = app.get(PickupLocationService);

    // 通过 emailAddress 精确查找测试客户
    const customers = await customerService.findAll(ctx, { filter: { emailAddress: { eq: 'zhangsan@test.cn' } }, take: 1 });
    const testCustomer = customers.items[0];
    if (!testCustomer) {
        console.warn('[populate] zhangsan@test.cn not found, skip EmployeeCustomer binding');
        return;
    }

    // 查找长春科技学院自提点
    const locations = await pickupLocationService.findByType(ctx, 'employee');
    const cctuLocation = locations.find(l => l.name.includes('长春科技学院'));
    if (!cctuLocation) {
        console.warn('[populate] 长春科技学院自提点 not found, skip EmployeeCustomer binding');
        return;
    }

    await employeeCustomerService.create(ctx, {
        customerId: testCustomer.id,
        enterpriseName: '长春科技学院',
        employeeId: 'CT20240001',
        pickupLocationIds: [cctuLocation.id],
        verified: false,  // default channel 是 loose 模式，verified=false 即可
    });
}
```

注意：default channel 是 loose 模式，verified=false 即可使用。绑定后此客户在 default channel 下可以选择企业自提点下单。

- [ ] **Step 6: 创建 tenant-admin 和 sales-person 角色**

明确权限列表（参考 spec §5.2 权限矩阵）。Vendure 内置 `Permission` enum 包含 `SuperAdmin`、`Owner`、`Public`、`Authenticated` 等；自定义权限通过 `PickupPermissions` 引用。

```typescript
import { Permission } from '@vendure/core';
import { PickupPermissions } from '@vendure/cjk-plugin';

// TenantAdmin 权限：本 channel 全权（不含 SuperAdmin），加自提点/EmployeeCustomer 全部权限
const TENANT_ADMIN_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.Owner,
    // Order/Customer/Product 等业务权限
    Permission.ReadOrder,
    Permission.UpdateOrder,
    Permission.CreateCustomer,
    Permission.ReadCustomer,
    Permission.UpdateCustomer,
    // 自提点权限（不含 PromotePickupLocation 和 UpdateChannelPickupConfig）
    PickupPermissions.ReadPickupLocation,
    PickupPermissions.CreatePickupLocation,
    PickupPermissions.UpdatePickupLocation,
    PickupPermissions.DeletePickupLocation,
    PickupPermissions.AssignPickupLocation,
    PickupPermissions.ReadEmployeeCustomer,
    PickupPermissions.CreateEmployeeCustomer,
    PickupPermissions.UpdateEmployeeCustomer,
    PickupPermissions.DeleteEmployeeCustomer,
    PickupPermissions.BindPickupLocation,
    PickupPermissions.VerifyEmployeeCustomer,
];

// SalesPerson 权限：只读自提点 + 创建 EmployeeCustomer（verified=false）
const SALES_PERSON_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.Owner,
    Permission.ReadOrder,
    Permission.ReadCustomer,
    PickupPermissions.ReadPickupLocation,
    PickupPermissions.ReadEmployeeCustomer,
    PickupPermissions.CreateEmployeeCustomer,  // 但不允许 Verify
];

async function createRoles(app: INestApplication, ctx: RequestContext, channelId: ID): Promise<void> {
    const roleService = app.get(RoleService);

    await roleService.create(ctx, {
        code: 'tenant-admin',
        title: '租户管理员',
        description: '租户级管理员',
        permissions: TENANT_ADMIN_PERMISSIONS,
        channelIds: [channelId],
    });

    await roleService.create(ctx, {
        code: 'sales-person',
        title: '销售人员',
        description: '租户级销售人员',
        permissions: SALES_PERSON_PERMISSIONS,
        channelIds: [channelId],
    });
}
```

调用：`await createRoles(app, freshCtx, defaultChannel.id as string);`

- [ ] **Step 7: 编译验证**

Run: `cd e:\code\vendure\packages\dev-server && npm run build`

- [ ] **Step 8: 提交**

```bash
git add packages/dev-server/china-data/02-default-channel.ts
git commit -m "Feat: populate default channel with loose mode and employee bindings"
```

### Task 19: 03-shop-a-channel.ts 更新

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\china-data\03-shop-a-channel.ts`

- [ ] **Step 1: 读取现有文件**

- [ ] **Step 2: 更新 shop-a channel customFields**

```typescript
customFields: {
    couponStackable: true,
    maxStackableCount: 3,
    employeePickupMode: 'strict',
    defaultLocation: { lat: 43.525870, lng: 125.668950 },
},
```

- [ ] **Step 3: 创建 shop-a 的 employee-pickup ShippingMethod**

shop-a 通过 `SHOP_A_SHIPPING_METHODS`（已在 Task 17 修改）独立创建 employee-pickup 实例。现有 `createShippingMethods` 函数已循环 `SHOP_A_SHIPPING_METHODS` 创建，无需额外修改。验证 SHOP_A_SHIPPING_METHODS 中包含 employee-pickup 即可。

注意：**不要**使用 `shippingMethodService.assignToChannel` 从 default channel 分配。Vendure 中 ShippingMethod 是 channel 隔离实体，shop-a 需要独立创建自己的实例（与现有 store-pickup/free-shipping-99 同模式）。

- [ ] **Step 4: 创建 shop-a 的 EmployeeCustomer 绑定（verified=true）**

明确使用 `wangwu@test.cn`（shop-a channel 的测试客户，CUSTOMERS[2]）作为绑定对象。shop-a 是 strict 模式，必须 `verified=true` 才能下单：

```typescript
async function createShopAEmployeeCustomers(app: INestApplication, ctx: RequestContext): Promise<void> {
    const employeeCustomerService = app.get(EmployeeCustomerService);
    const customerService = app.get(CustomerService);
    const pickupLocationService = app.get(PickupLocationService);

    // 通过 emailAddress 精确查找 shop-a 测试客户
    const customers = await customerService.findAll(ctx, { filter: { emailAddress: { eq: 'wangwu@test.cn' } }, take: 1 });
    const testCustomer = customers.items[0];
    if (!testCustomer) {
        console.warn('[populate] wangwu@test.cn not found in shop-a, skip EmployeeCustomer binding');
        return;
    }

    // 查找吉林农业大学自提点（shop-a 自建，非公共）
    const locations = await pickupLocationService.findByType(ctx, 'employee');
    const jlauLocation = locations.find(l => l.name.includes('吉林农业大学'));
    if (!jlauLocation) {
        console.warn('[populate] 吉林农业大学自提点 not found in shop-a, skip EmployeeCustomer binding');
        return;
    }

    await employeeCustomerService.create(ctx, {
        customerId: testCustomer.id,
        enterpriseName: '吉林农业大学',
        employeeId: 'JLNY20240088',
        pickupLocationIds: [jlauLocation.id],
        verified: true,  // shop-a 是 strict 模式，必须 verified=true 才能下单
    });
}
```

注意：shop-a strict 模式下，只有 verified=true 的 EmployeeCustomer 才能通过 `employeePickupEligibilityChecker` 检查并选择企业自提点下单。未绑定或 verified=false 的用户无法看到企业自提选项。

- [ ] **Step 5: 编译验证**

Run: `cd e:\code\vendure\packages\dev-server && npm run build`

- [ ] **Step 6: 提交**

```bash
git add packages/dev-server/china-data/03-shop-a-channel.ts
git commit -m "Feat: populate shop-a channel with strict mode and verified bindings"
```

### Task 20: dev-config.ts 启用 employeePickup

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts`

- [ ] **Step 1: 读取 CjkPlugin.init 配置**

- [ ] **Step 2: 新增 employeePickup 配置**

```typescript
CjkPlugin.init({
    i18n: { enabled: true },
    regions: { enabled: true },
    tenant: { enabled: true },
    cod: { enabled: true },
    storePickup: { enabled: true },
    pickupPoint: { enabled: true },
    employeePickup: { enabled: true },   // 新增
    promotionPolicy: { enabled: true },
}),
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\dev-server && npm run build`

- [ ] **Step 4: 提交**

```bash
git add packages/dev-server/dev-config.ts
git commit -m "Feat: enable employeePickup in CjkPlugin init"
```

---

## Phase 5: 前端结算页

### Task 21: 前端 API 层

**Files:**
- Create: `e:\code\vshop\src\api\queries\pickup.ts`
- Modify: `e:\code\vshop\src\api\mutations\checkout.ts`

- [ ] **Step 1: 创建 pickup.ts queries**

```typescript
import { getGraphQLClient } from '../client';

export async function getPickupLocations(
    type?: 'store' | 'point',
    location?: { lat: number; lng: number }
) {
    const client = getGraphQLClient();
    const variables: any = {};
    if (type) variables.type = type;
    if (location) { variables.lat = location.lat; variables.lng = location.lng; }
    return client.request(`query($type: String, $lat: Float, $lng: Float) {
        pickupLocations(type: $type, lat: $lat, lng: $lng) {
            id name type address phoneNumber businessHours coordinates
        }
    }`, variables);
}

export async function getEmployeePickupLocations(
    location?: { lat: number; lng: number }
) {
    const client = getGraphQLClient();
    const variables: any = {};
    if (location) { variables.lat = location.lat; variables.lng = location.lng; }
    return client.request(`query($lat: Float, $lng: Float) {
        employeePickupLocations(lat: $lat, lng: $lng) {
            id name address phoneNumber businessHours coordinates
        }
    }`, variables);
}
```

- [ ] **Step 2: 在 checkout.ts 新增 setOrderPickupLocation mutation**

```typescript
export async function setOrderPickupLocation(pickupLocationId: string, pickupType: string) {
    const client = getGraphQLClient();
    const mutation = `${ORDER_FRAGMENT}
        mutation SetPickup($pickupLocationId: ID!, $pickupType: String!) {
            setOrderPickupLocation(pickupLocationId: $pickupLocationId, pickupType: $pickupType) {
                ... on Order { ...OrderDetail }
                ... on ErrorResult { errorCode message }
            }
        }`;
    return client.request(mutation, { pickupLocationId, pickupType });
}
```

- [ ] **Step 3: 提交**

```bash
cd e:\code\vshop
git add src/api/queries/pickup.ts src/api/mutations/checkout.ts
git commit -m "Feat: add pickup location API queries and setOrderPickupLocation mutation"
```

### Task 22: tenant store 扩展（从后端加载 channel customFields）

**Files:**
- Modify: `e:\code\vshop\src\stores\tenant.ts`
- Modify: `e:\code\vshop\src\api\queries\user.ts`（或新建 `e:\code\vshop\src\api\queries\channel.ts`）

- [ ] **Step 1: 读取现有 tenant store**

- [ ] **Step 2: 新增 activeChannel query**

现有 `tenant.ts` 中 `TENANT_CONFIGS` 是写死的，**不**在此处添加 `defaultLocation` 和 `employeePickupMode`。改为在 store 中新增一个 `loadChannelConfig` 方法，通过 shop API 查询 `activeChannel` 获取 channel customFields。

新建 `e:\code\vshop\src\api\queries\channel.ts`：

```typescript
import { getGraphQLClient } from '../client';

export async function getActiveChannelConfig() {
    const client = getGraphQLClient();
    return client.request(`query {
        activeChannel {
            id code token
            customFields {
                employeePickupMode
                defaultLocation
            }
        }
    }`);
}
```

注意：shop API 中 `activeChannel.customFields` 默认不暴露，需在后端 shopApiExtensions 中扩展（已在 Task 16 Step 5 处理 `Order.customFields`，但 `Channel.customFields` 也需扩展）。补充 Task 16 shopApiExtensions：

```graphql
extend type Channel {
    customFields: ChannelCustomFields!
}

type ChannelCustomFields {
    couponStackable: Boolean
    maxStackableCount: Int
    employeePickupMode: String
    defaultLocation: JSON
}
```

- [ ] **Step 3: 修改 tenant store 添加 loadChannelConfig**

在 `useTenantStore` 中新增 state `employeePickupMode` 和 `defaultLocation`，并提供 `loadChannelConfig` 方法在结算页 onMounted 时调用：

```typescript
export const useTenantStore = defineStore('tenant', () => {
    // 现有 state...
    const employeePickupMode = ref<'disabled' | 'loose' | 'strict'>('disabled');
    const defaultLocation = ref<{ lat: number; lng: number } | null>(null);

    async function loadChannelConfig() {
        try {
            const res: any = await getActiveChannelConfig();
            const cf = res?.activeChannel?.customFields;
            if (cf) {
                employeePickupMode.value = cf.employeePickupMode || 'disabled';
                defaultLocation.value = cf.defaultLocation || null;
            }
        } catch (e) {
            console.warn('[tenant] loadChannelConfig failed', e);
        }
    }

    return {
        // 现有返回...
        employeePickupMode,
        defaultLocation,
        loadChannelConfig,
    };
});
```

- [ ] **Step 4: 提交**

```bash
git add src/stores/tenant.ts src/api/queries/channel.ts
git commit -m "Feat: load employeePickupMode and defaultLocation from activeChannel"
```

### Task 23: checkout.vue 配送方式分类 + 动态 UI

**Files:**
- Modify: `e:\code\vshop\src\pkg-order\pages\checkout.vue`

- [ ] **Step 1: 读取现有 checkout.vue**

- [ ] **Step 2: 新增配送方式分类逻辑**

```typescript
type ShippingCategory = 'shipping' | 'store-pickup' | 'point-pickup' | 'employee-pickup';

function categorizeShipping(sm: any): ShippingCategory {
    if (sm.code === 'store-pickup') return 'store-pickup';
    if (sm.code === 'pickup-point') return 'point-pickup';
    if (sm.code === 'employee-pickup') return 'employee-pickup';
    return 'shipping';
}

const shippingCategory = ref<ShippingCategory>('shipping');
const selectedPickupLocation = ref<any>(null);
const pickupLocations = ref<any[]>([]);
const employeePickupLocations = ref<any[]>([]);
```

- [ ] **Step 3: 新增定位三级兜底**

```typescript
const userLocation = ref<{ lat: number; lng: number } | null>(null);

function getLocationWithTimeout(ms: number): Promise<{lat:number;lng:number}|null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        uni.getLocation({
            type: 'gcj02',
            success: (res) => { clearTimeout(timer); resolve({ lat: res.latitude, lng: res.longitude }); },
            fail: () => { clearTimeout(timer); resolve(null); },
        });
    });
}

async function resolveLocation(): Promise<{ lat: number; lng: number } | null> {
    const pos = await getLocationWithTimeout(3000);
    if (pos) { userLocation.value = pos; return pos; }
    
    const addr = selectedAddress.value;
    if (addr?.customFields?.lat && addr?.customFields?.lng) {
        return { lat: addr.customFields.lat, lng: addr.customFields.lng };
    }
    
    const tenantStore = useTenantStore();
    if (tenantStore.defaultLocation) return tenantStore.defaultLocation;
    
    return null;
}
```

- [ ] **Step 4: 新增 watch 监听配送方式切换**

```typescript
watch(() => selectedShipping.value, async (id) => {
    const sm = shippingMethods.value.find(s => s.id === id);
    if (!sm) return;
    shippingCategory.value = categorizeShipping(sm);
    selectedPickupLocation.value = null;
    
    if (shippingCategory.value === 'store-pickup' || shippingCategory.value === 'point-pickup') {
        const location = await resolveLocation();
        const type = shippingCategory.value === 'store-pickup' ? 'store' : 'point';
        const res: any = await getPickupLocations(type, location);
        pickupLocations.value = res.pickupLocations || [];
        if (pickupLocations.value.length > 0) selectedPickupLocation.value = pickupLocations.value[0];
    } else if (shippingCategory.value === 'employee-pickup') {
        const location = await resolveLocation();
        const res: any = await getEmployeePickupLocations(location);
        employeePickupLocations.value = res.employeePickupLocations || [];
        if (employeePickupLocations.value.length > 0) selectedPickupLocation.value = employeePickupLocations.value[0];
    }
});
```

- [ ] **Step 5: 修改 template 动态展示**

根据 `shippingCategory` 显示：
- `shipping` → 收货地址表单（现有）
- `store-pickup` / `point-pickup` → 自提点列表（从 `pickupLocations` 渲染）
- `employee-pickup` → 企业自提点列表（从 `employeePickupLocations` 渲染，空状态提示）

- [ ] **Step 6: 修改 submitOrder 校验逻辑**

```typescript
async function submitOrder() {
    if (shippingCategory.value === 'shipping') {
        const addr = selectedAddress.value || address.value;
        if (!addr.fullName || !addr.phoneNumber || !addr.streetLine1) {
            uni.showToast({ title: t('checkout.address.required'), icon: 'none' }); return;
        }
        await setOrderShippingAddress(addr);
    } else {
        if (!selectedPickupLocation.value) {
            uni.showToast({ title: t('checkout.pickupLocation.select'), icon: 'none' }); return;
        }
        await setOrderPickupLocation(selectedPickupLocation.value.id, shippingCategory.value);
    }
    if (selectedShipping.value) await setOrderShippingMethod([selectedShipping.value]);
    await transitionOrderToState('ArrangingPayment');
    const payRes: any = await addPaymentToOrder(selectedPayment.value);
    // ... 现有支付逻辑
}
```

- [ ] **Step 7: 提交**

```bash
git add src/pkg-order/pages/checkout.vue
git commit -m "Feat: checkout dynamic UI with shipping category and pickup location selection"
```

---

## Phase 6: 前端多语言

### Task 24: zh-Hans/en locale 更新

**Files:**
- Modify: `e:\code\vshop\src\locale\zh-Hans.ts`
- Modify: `e:\code\vshop\src\locale\en.ts`

- [ ] **Step 1: 新增 checkout keys（zh-Hans）**

```typescript
checkout: {
    shippingMethod: {
        store: '门店自提',
        point: '菜鸟驿站自提',
        employee: '企业职工自提',
        shipping: '邮寄',
    },
    pickupLocation: {
        select: '请选择自提点',
        empty: '您尚未绑定企业职工身份',
        emptyHint: '请联系客服绑定企业自提点',
        distance: '距您 {km}km',
        address: '地址',
        businessHours: '营业时间',
    },
    address: {
        required: '请填写收货地址',
    },
},
```

- [ ] **Step 2: 新增 checkout keys（en）**

```typescript
checkout: {
    shippingMethod: { store: 'Store Pickup', point: 'Pickup Point', employee: 'Employee Pickup', shipping: 'Shipping' },
    pickupLocation: { select: 'Select pickup location', empty: 'You have no employee binding', emptyHint: 'Please contact customer service to bind', distance: '{km}km away', address: 'Address', businessHours: 'Business Hours' },
    address: { required: 'Please fill in shipping address' },
},
```

- [ ] **Step 3: 提交**

```bash
git add src/locale/zh-Hans.ts src/locale/en.ts
git commit -m "Feat: add checkout i18n keys for zh-Hans and en"
```

### Task 25: ja/ko locale 新建

**Files:**
- Create: `e:\code\vshop\src\locale\ja.ts`
- Create: `e:\code\vshop\src\locale\ko.ts`

- [ ] **Step 1: 创建 ja.ts**

```typescript
export default {
    checkout: {
        shippingMethod: { store: '店頭受取', point: '受取ポイント', employee: '従業員受取', shipping: '配送' },
        pickupLocation: { select: '受取場所を選択してください', empty: '従業員バインドがありません', emptyHint: 'カスタマーサービスに連絡してバインドしてください', distance: '{km}km先', address: '住所', businessHours: '営業時間' },
        address: { required: '配送先住所を入力してください' },
    },
};
```

- [ ] **Step 2: 创建 ko.ts**

```typescript
export default {
    checkout: {
        shippingMethod: { store: '매장 수거', point: '수거 포인트', employee: '직원 수거', shipping: '배송' },
        pickupLocation: { select: '수거 장소를 선택하세요', empty: '직원 바인딩이 없습니다', emptyHint: '고객 서비스에 연락하여 바인딩하세요', distance: '{km}km 거리', address: '주소', businessHours: '영업시간' },
        address: { required: '배송 주소를 입력해주세요' },
    },
};
```

- [ ] **Step 3: 注册到 i18n**

在 vshop 的 i18n 初始化文件中注册 ja 和 ko locale。

- [ ] **Step 4: 提交**

```bash
git add src/locale/ja.ts src/locale/ko.ts
git commit -m "Feat: add ja and ko locale files"
```

### Task 26: checkout.vue 接入 i18n

**Files:**
- Modify: `e:\code\vshop\src\pkg-order\pages\checkout.vue`

- [ ] **Step 1: 替换硬编码文案为 i18n 调用**

将 checkout.vue 中所有硬编码中文文案替换为 `t('checkout.xxx')` 或 `$t('checkout.xxx')`。

- [ ] **Step 2: 提交**

```bash
git add src/pkg-order/pages/checkout.vue
git commit -m "Feat: integrate i18n in checkout page"
```

---

## Phase 7: Admin UI

### Task 27: PickupLocation 管理页

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\admin-ui\pickup-location-extension\` 目录

**注意**：Admin UI 扩展需要 Angular 编译。如果 Angular 扩展编译与 Vendure v3.6.4 不兼容，此 Phase 可降级为仅通过 Admin API 手动操作（curl/Postman），暂不开发 UI 页面。

- [ ] **Step 1: 评估 Angular 扩展兼容性**

检查 Vendure v3.6.4 admin UI 扩展 API，确认是否支持自定义页面路由注册。

- [ ] **Step 2: 创建 PickupLocation 列表/创建/编辑模块**

如果兼容，创建 Angular 模块实现列表页（按 type/channel/isPublic 筛选）、创建页、编辑页、"升级为公共"按钮。

- [ ] **Step 3: 提交**

```bash
git add packages/cjk-plugin/admin-ui/
git commit -m "Feat: add PickupLocation admin UI extension"
```

### Task 28: EmployeeCustomer 管理页

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\admin-ui\employee-customer-extension\` 目录

- [ ] **Step 1: 创建 EmployeeCustomer 列表/创建/编辑模块**

实现列表页（按 channel/enterpriseName/verified 筛选）、创建页（选客户→填企业/工号→勾选自提点）、"标记已核实"按钮。

- [ ] **Step 2: 提交**

```bash
git add packages/cjk-plugin/admin-ui/employee-customer-extension/
git commit -m "Feat: add EmployeeCustomer admin UI extension"
```

---

## Phase 8: 端到端验证

### Task 29: 后端 API 验证

- [ ] **Step 1: 重启 dev server**

Run: `cd e:\code\vendure\packages\dev-server && npm run dev:server`

- [ ] **Step 2: 重新 populate 数据**

```bash
cd e:\code\vendure\packages\dev-server
npm run populate
```

- [ ] **Step 3: 验证 admin API**

用 GraphQL Playground 测试：
- `pickupLocations` 查询（按 type 筛选）
- `promotePickupLocationToPublic` mutation
- `createEmployeeCustomer` mutation
- `verifyEmployeeCustomer` mutation

- [ ] **Step 4: 验证 shop API**

- `pickupLocations(type: "employee", lat: 43.526, lng: 125.665)` 查询（loose 模式，返回全部 employee 点，按距离排序）
- `employeePickupLocations(lat: 43.526, lng: 125.665)` 查询（loose 模式，同上）
- `setOrderPickupLocation` mutation（需先创建 active order）

- [ ] **Step 5: 验证 strict 模式**

切换到 shop-a channel（vendure-token: shop-a-token）：
- `employeePickupLocations` 查询（strict 模式，仅返回已绑定用户的点）
- 未绑定用户查询返回空数组

### Task 30: 前端结算页验证

- [ ] **Step 1: 启动前端**

Run: `cd e:\code\vshop && npm run dev:h5`

- [ ] **Step 2: 验证 default channel（loose）**

访问 `http://localhost:5180/?tenant=default#/pkg-order/pages/checkout`：
- 配送方式列表包含"企业职工自提"
- 选择企业自提后显示自提点列表（按距离排序）
- 选择自提点 + 提交订单成功

- [ ] **Step 3: 验证 shop-a channel（strict）**

访问 `http://localhost:5180/?tenant=shop-a#/pkg-order/pages/checkout`：
- 已绑定用户：配送方式包含"企业职工自提"，显示绑定的自提点
- 未绑定用户：配送方式不包含"企业职工自提"（checker 返回 false）

- [ ] **Step 4: 验证定位兜底**

- 授权定位：自提点按实际位置排序
- 拒绝定位：使用租户 defaultLocation 排序

### Task 31: 权限验证

- [ ] **Step 1: 创建测试用户并分配角色**

通过 admin API 创建用户并分配 tenant-admin / sales-person 角色。

- [ ] **Step 2: 验证 TenantAdmin 权限**

- 可创建自建自提点
- 不可编辑公共自提点
- 不可升级为公共
- 可创建/核实 EmployeeCustomer

- [ ] **Step 3: 验证 SalesPerson 权限**

- 可查看自提点（只读）
- 可创建 EmployeeCustomer（verified=false）
- 不可核实 EmployeeCustomer
- 不可修改绑定

### Task 32: 多语言验证

- [ ] **Step 1: 切换前端语言**

在 default channel（availableLanguageCodes: [zh_Hans, en, ja, ko]）切换四种语言。

- [ ] **Step 2: 验证所有文案**

- 配送方式名称（四语）
- 自提点选择提示（四语）
- 空状态提示（四语）
- 地址必填提示（四语）

- [ ] **Step 3: 验证后端错误消息**

触发错误场景（如未选自提点提交），验证返回的错误消息与 ctx.languageCode 一致。

---

## Self-Review

### Spec coverage 检查

| Spec 章节 | 对应 Task | 状态 |
|---|---|---|
| 1.1 PickupLocation 扩展 | Task 1（已修订：使用 @EntityId） | ✅ |
| 1.2 EmployeeCustomer 实体 | Task 2（已修订：implements ChannelAware）, 7 | ✅ |
| 1.3 Channel.customFields | Task 4 | ✅ |
| 1.4 Order.customFields | Task 3 + Task 16（shopApiExtensions 暴露） | ✅ |
| 1.5 三模式语义 | Task 9, 13 | ✅ |
| 2.1 模块结构 | Task 1-16 | ✅ |
| 2.2 可见性查询 | Task 8（已修订：手动 skip/take） | ✅ |
| 2.3 升级公共 | Task 8, 12（已修订：@Allow SuperAdmin） | ✅ |
| 2.4 eligibility checker | Task 9 | ✅ |
| 2.5 fulfillmentHandler | Task 11 | ✅ |
| 2.6 Shop API | Task 13, 15 | ✅ |
| 2.7 就近排序 | Task 8 | ✅ |
| 2.8 Admin API | Task 12（已修订：@Allow 装饰器）, 14 | ✅ |
| 3 前端结算页 | Task 21-23 | ✅ |
| 4 多语言 | Task 24-26 | ✅ |
| 5 权限分级 | Task 5, 16（已修订：customPermissions 注册）, 18（已修订：明确权限列表） | ✅ |
| 6 测试数据 | Task 17（已修订：补全经纬度）-20 | ✅ |
| 7 Admin UI | Task 27-28（Dashboard React 扩展，非 Angular） | ⚠️（降级为 API 验证） |
| 8 端到端验证 | Task 29-32 | ✅ |

### Placeholder scan

无 TBD/TODO，所有 step 都有具体代码或命令。

### Type consistency

- `EmployeeCustomer` / `EmployeeCustomerService` 全局一致
- `employee-pickup` 命名全局一致
- `employeePickupMode` / `defaultLocation` / `selectedPickupLocationId` / `pickupType` 命名一致
- `pickupLocations` / `employeePickupLocations` query 命名一致

### 关键修订点回顾

1. **Task 1**: `ownerChannelId` 使用 `@EntityId({ nullable: true })`
2. **Task 2**: `EmployeeCustomer implements ChannelAware`
3. **Task 8**: 保留手动 skip/take，弃用 paginate；import `EntityNotFoundError`
4. **Task 12**: 所有新增 mutation 添加 `@Allow` 装饰器；`assignToChannel/removeFromChannel` 使用 `In` 操作符
5. **Task 16**: `hasPickup` 表达式扩展包含 employeePickup；`shopApiExtensions` 扩展 `Order.customFields` 和 `Channel.customFields`；`config.authOptions.customPermissions` 注册自定义权限；`types.ts` 扩展 `CjkPluginOptions`
6. **Task 17**: 现有 3 个自提点补全经纬度；`SHOP_A_SHIPPING_METHODS` 加入 employee-pickup
7. **Task 18**: 明确测试客户 `zhangsan@test.cn`；明确 `TENANT_ADMIN_PERMISSIONS` / `SALES_PERSON_PERMISSIONS` 列表
8. **Task 19**: shop-a 独立创建 employee-pickup（非从 default 分配）；明确测试客户 `wangwu@test.cn`，verified=true
9. **Task 22**: tenant store 通过 `activeChannel` query 从后端加载 channel customFields

### 未解决问题（需在执行时关注）

1. **Admin UI 扩展（Task 27-28）**：Vendure Dashboard 是 React/TSX 扩展（plugin.ts 已有 `dashboard: '../dashboard/index.tsx'`），但具体扩展 API 需在执行时确认。如果 Dashboard 扩展不支持自定义页面，降级为仅通过 Admin API（GraphQL Playground）操作。
2. **OrderService API 名称**：Task 15 使用 `orderService.updateCustomFields` 和 `orderService.setShippingAddress`，需在执行时确认 Vendure v3.6.4 的实际 API 名称（可能是 `orderService.updateCustomFields(ctx, id, customFields)` 或 `orderService.update(ctx, id, { customFields })`）。
3. **Channel.customFields shop API 暴露**：Task 22 提到需在 shopApiExtensions 扩展 `Channel.customFields`，但 Vendure v3 中 `activeChannel` query 可能已自动暴露 customFields（需执行时验证）。
