# 企业职工自提点功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vendure 多租户系统增加企业职工自提点配送方式，支持租户开通/关闭、宽松/强制模式、就近排序、四语多语言、三级权限分级。

**Architecture:** 扩展 CjkPlugin 现有 PickupLocation 实体（新增 type='employee'、isPublic、ownerChannelId），新增 EmployeeCustomer 绑定实体，新增 employee-pickup ShippingMethod 配套 checker/calculator/fulfillmentHandler，补全 Shop API 供 C 端查询，前端结算页按配送方式类型动态展示 UI 并支持定位就近排序。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeScript + TypeORM)、CjkPlugin、uni-app (Vue 3 + Vite)、Angular (Admin UI)

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-14-employee-pickup-design.md`

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

在 `PickupLocation` 实体中新增字段：

```typescript
@Column({ type: 'varchar', default: 'store' })
type: 'store' | 'point' | 'employee';

@Column({ default: false })
isPublic: boolean;

@Column({ nullable: true })
ownerChannelId: ID | null;
```

注意：`type` 字段已存在，只需扩展类型联合为 `'store' | 'point' | 'employee'`。新增 `isPublic` 和 `ownerChannelId` 字段。

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
import { Column, Entity, ManyToMany, ManyToOne } from 'typeorm';
import { ID } from '@vendure/common/lib/shared-types';
import { Channel, Customer } from '@vendure/core';
import { VendureEntity } from '@vendure/core';
import { EntityId } from '@vendure/core';
import { PickupLocation } from '../pickup-location.entity';

@Entity()
export class EmployeeCustomer extends VendureEntity {
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

将现有 `findAll` 方法改为：

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
    // ... 分页逻辑保持不变
    return paginate(qb, options);
}
```

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

在现有 `create` 方法中，设置 `location.ownerChannelId = ctx.channelId` 和 `location.isPublic = input.isPublic ?? false`。

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

```typescript
@Mutation()
async promotePickupLocationToPublic(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<PickupLocation> {
    return this.pickupLocationService.promoteToPublic(ctx, id);
}

@Mutation()
async assignPickupLocationsToChannel(@Ctx() ctx: RequestContext, @Args('ids') ids: ID[]): Promise<boolean> {
    // 将自提点分配到当前 channel
    await this.pickupLocationService.assignToChannel(ctx, ids, ctx.channelId);
    return true;
}

@Mutation()
async removePickupLocationsFromChannel(@Ctx() ctx: RequestContext, @Args('ids') ids: ID[]): Promise<boolean> {
    await this.pickupLocationService.removeFromChannel(ctx, ids, ctx.channelId);
    return true;
}
```

- [ ] **Step 3: 在 PickupLocationService 中新增 assignToChannel/removeFromChannel**

```typescript
async assignToChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
    const locations = await this.connection.getRepository(ctx, PickupLocation).findByIds(ids);
    const channel = await this.connection.getRepository(ctx, Channel).findOne(channelId);
    for (const loc of locations) {
        if (!loc.channels.find(c => c.id === channelId)) {
            loc.channels.push(channel);
        }
    }
    await this.connection.getRepository(ctx, PickupLocation).save(locations);
}

async removeFromChannel(ctx: RequestContext, ids: ID[], channelId: ID): Promise<void> {
    const locations = await this.connection.getRepository(ctx, PickupLocation).findByIds(ids);
    for (const loc of locations) {
        loc.channels = loc.channels.filter(c => c.id !== channelId);
    }
    await this.connection.getRepository(ctx, PickupLocation).save(locations);
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

- [ ] **Step 2: 注册 ShippingMethod 组件**

在 `configuration` 钩子中，追加 employee-pickup 组件注册（与 storePickup/pickupPoint 同模式）：

```typescript
if (CjkPlugin.options.employeePickup?.enabled) {
    config.shippingOptions!.shippingEligibilityCheckers!.push(employeePickupEligibilityChecker);
    config.shippingOptions!.shippingCalculators!.push(employeePickupCalculator);
    config.shippingOptions!.fulfillmentHandlers!.push(employeePickupFulfillmentHandler);
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

```graphql
extend type Query {
    pickupLocations(type: String, lat: Float, lng: Float): [PickupLocation!]!
    employeePickupLocations(lat: Float, lng: Float): [PickupLocation!]!
}

extend type Mutation {
    setOrderPickupLocation(pickupLocationId: ID!, pickupType: String!): Order!
}
```

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

- [ ] **Step 7: 扩展 CjkPluginOptions 类型**

在 types.ts 中新增：

```typescript
employeePickup?: {
    enabled: boolean;
};
```

- [ ] **Step 8: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

- [ ] **Step 9: 提交**

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

更新 `DEFAULT_PICKUP_LOCATIONS` 每项添加 `coordinates` 字段。

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

在 `DEFAULT_SHIPPING_METHODS` 追加：

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

- [ ] **Step 5: 创建 EmployeeCustomer 测试绑定**

```typescript
async function createEmployeeCustomers(app: INestApplication, ctx: RequestContext): Promise<void> {
    const employeeCustomerService = app.get(EmployeeCustomerService);
    const customerService = app.get(CustomerService);
    
    // 找到测试客户
    const customers = await customerService.findAll(ctx);
    const testCustomer = customers.items.find(c => c.emailAddress?.includes('test'));
    
    if (testCustomer) {
        // 找到长春科技学院自提点
        const pickupLocations = await pickupLocationService.findAll(ctx);
        const cctuLocation = pickupLocations.items.find(l => l.name.includes('长春科技学院'));
        
        if (cctuLocation) {
            await employeeCustomerService.create(ctx, {
                customerId: testCustomer.id,
                enterpriseName: '长春科技学院',
                employeeId: 'CT20240001',
                pickupLocationIds: [cctuLocation.id],
                verified: false,
            });
        }
    }
}
```

- [ ] **Step 6: 创建 tenant-admin 和 sales-person 角色**

```typescript
async function createRoles(app: INestApplication, ctx: RequestContext): Promise<void> {
    const roleService = app.get(RoleService);
    
    await roleService.create(ctx, {
        code: 'tenant-admin',
        title: '租户管理员',
        description: '租户级管理员',
        permissions: TENANT_ADMIN_PERMISSIONS,
        channelIds: [defaultChannel.id],
    });
    
    await roleService.create(ctx, {
        code: 'sales-person',
        title: '销售人员',
        description: '租户级销售人员',
        permissions: SALES_PERSON_PERMISSIONS,
        channelIds: [defaultChannel.id],
    });
}
```

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

- [ ] **Step 3: 分配 employee-pickup ShippingMethod 到 shop-a**

```typescript
// 找到 employee-pickup ShippingMethod 并分配到 shop-a channel
const shippingMethodService = app.get(ShippingMethodService);
const shippingMethods = await shippingMethodService.findAll(ctx);
const employeePickupMethod = shippingMethods.items.find(sm => sm.code === 'employee-pickup');
if (employeePickupMethod) {
    await shippingMethodService.assignToChannel(ctx, employeePickupMethod.id, shopAChannel.id);
}
```

- [ ] **Step 4: 创建 shop-a 的 EmployeeCustomer 绑定（verified=true）**

为 shop-a 测试客户创建绑定，关联吉林农业大学自提点。

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

### Task 22: tenant store 扩展

**Files:**
- Modify: `e:\code\vshop\src\stores\tenant.ts`

- [ ] **Step 1: 读取现有 tenant store**

- [ ] **Step 2: 新增 defaultLocation 和 employeePickupMode**

在 `TenantConfig` interface 和 `tenantStore` state 中新增 `defaultLocation` 和 `employeePickupMode` 字段。在 `initTenant` 中从 `activeChannel` 查询加载。

- [ ] **Step 3: 提交**

```bash
git add src/stores/tenant.ts
git commit -m "Feat: load defaultLocation and employeePickupMode from activeChannel"
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
| 1.1 PickupLocation 扩展 | Task 1 | ✅ |
| 1.2 EmployeeCustomer 实体 | Task 2, 7 | ✅ |
| 1.3 Channel.customFields | Task 4 | ✅ |
| 1.4 Order.customFields | Task 3 | ✅ |
| 1.5 三模式语义 | Task 9, 13 | ✅ |
| 2.1 模块结构 | Task 1-16 | ✅ |
| 2.2 可见性查询 | Task 8 | ✅ |
| 2.3 升级公共 | Task 8, 12 | ✅ |
| 2.4 eligibility checker | Task 9 | ✅ |
| 2.5 fulfillmentHandler | Task 11 | ✅ |
| 2.6 Shop API | Task 13, 15 | ✅ |
| 2.7 就近排序 | Task 8 | ✅ |
| 2.8 Admin API | Task 12, 14 | ✅ |
| 3 前端结算页 | Task 21-23 | ✅ |
| 4 多语言 | Task 24-26 | ✅ |
| 5 权限分级 | Task 5, 18 | ✅ |
| 6 测试数据 | Task 17-20 | ✅ |
| 7 Admin UI | Task 27-28 | ✅（可能降级） |
| 8 端到端验证 | Task 29-32 | ✅ |

### Placeholder scan

无 TBD/TODO，所有 step 都有具体代码或命令。

### Type consistency

- `EmployeeCustomer` / `EmployeeCustomerService` 全局一致
- `employee-pickup` 命名全局一致
- `employeePickupMode` / `defaultLocation` / `selectedPickupLocationId` / `pickupType` 命名一致
- `pickupLocations` / `employeePickupLocations` query 命名一致
