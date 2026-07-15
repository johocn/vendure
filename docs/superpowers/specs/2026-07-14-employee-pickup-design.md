# 企业职工自提点功能设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan.

**Goal:** 为 Vendure 多租户系统增加企业职工自提点配送方式，支持租户开通/关闭、宽松/强制模式、就近排序、多语言、权限分级。

**Architecture:** 扩展 CjkPlugin 现有 PickupLocation 实体（新增 type='employee'、isPublic、ownerChannelId），新增 EmployeeCustomer 绑定实体，新增 employee-pickup ShippingMethod 配套 checker/calculator/fulfillmentHandler，补全 Shop API 供 C 端查询，前端结算页按配送方式类型动态展示 UI 并支持定位就近排序。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeScript + TypeORM)、CjkPlugin、uni-app (Vue 3 + Vite)、Angular (Admin UI)

---

## 1. 数据模型

### 1.1 PickupLocation 扩展

```
PickupLocation (现有实体扩展)
├─ type: 'store' | 'point' | 'employee'   // 新增 employee
├─ isPublic: boolean                         // 新增：公共=true / 租户自建=false
├─ ownerChannelId: ID (nullable)             // 新增：自建者 channel；公共为 null
├─ address: string (unique)                  // 现有，新增全局唯一约束
├─ name, phoneNumber, businessHours, coordinates, partner  // 现有
└─ channels: Channel[] (manyToMany)          // 现有：启用的租户列表
```

**可见性规则**：
- `isPublic=true`：所有 channel 可见，admin 可勾选启用
- `isPublic=false`：仅 `ownerChannelId` 可见
- 管理员"升级"操作：`isPublic` 设为 true，`ownerChannelId` 设为 null

### 1.2 EmployeeCustomer 绑定实体（新建）

```typescript
@Entity()
export class EmployeeCustomer extends VendureEntity implements ChannelAware {
    @ManyToOne(() => Customer) customer: Customer;
    @EntityId() customerId: ID;

    @Column() enterpriseName: string;
    @Column({ nullable: true }) employeeId: string;

    @ManyToMany(() => PickupLocation)
    @JoinTable()
    pickupLocations: PickupLocation[];

    @ManyToOne(() => Channel) channel: Channel;
    @EntityId() channelId: ID;

    @Column({ default: false }) verified: boolean;
}
```

**绑定流程**（当前阶段：手动建立）：
- 客户下单后，admin 手动创建 EmployeeCustomer 记录
- 关联 pickupLocations（该客户属于哪些企业的哪些自提点）
- `verified=false` 表示待核实，不强制限制下单

**过渡到强制**（后续阶段，本次不实现）：
- `verified=true` 后，strict 模式下仅可选择绑定的企业自提点

### 1.3 Channel.customFields 新增

```typescript
{
    name: 'employeePickupMode',
    type: 'string',
    defaultValue: 'disabled',   // disabled | loose | strict
    options: [disabled, loose, strict],
    label: [zh_Hans, en, ja, ko],
},
{
    name: 'defaultLocation',
    type: 'json',
    nullable: true,             // { lat, lng }
    label: [zh_Hans, en, ja, ko],
},
```

### 1.4 Order.customFields 新增

```typescript
{
    name: 'selectedPickupLocationId',
    type: 'relation',
    entity: PickupLocation,
    nullable: true,
    public: true,               // shop API 可写
},
{
    name: 'pickupType',
    type: 'string',
    nullable: true,
    public: true,
},
```

### 1.5 三模式语义

| 模式 | ShippingMethod 可见 | 自提点列表 | 下单校验 |
|---|---|---|---|
| `disabled` | 不分配 employee-pickup 到该 channel | N/A | N/A |
| `loose` | 分配 + checker 通过 | 返回所有 type='employee' 的点 | 不校验绑定 |
| `strict` | 分配 + checker 检查绑定 | 仅返回当前用户绑定的点 | 校验 EmployeeCustomer 绑定 |

---

## 2. 后端架构

### 2.1 模块结构

```
cjk-plugin/src/pickup/
├─ pickup-location.entity.ts          # 扩展 type/isPublic/ownerChannelId
├─ pickup-location.service.ts         # 可见性查询/升级逻辑/channel 隔离
├─ pickup-location-admin.resolver.ts  # admin API（升级、自建、assign/remove）
├─ pickup-location-shop.resolver.ts   # 新增：shop API（C 端查询 + 就近排序）
├─ pickup-eligibility-checker.ts      # 新增 employee-pickup-eligibility（三模式）
├─ pickup-calculator.ts               # 新增 employee-pickup-calculator
├─ pickup-fulfillment-handler.ts      # 新增 employee-pickup handler + 读取 order.customFields
├─ pickup-shop.resolver.ts            # 新增：setOrderPickupLocation mutation
├─ pickup-permissions.ts              # 权限定义
├─ i18n-messages.ts                   # 四语错误消息
└─ enterprise-customer/
    ├─ enterprise-customer.entity.ts
    ├─ enterprise-customer.service.ts
    └─ enterprise-customer-admin.resolver.ts
```

### 2.2 PickupLocation 可见性查询

```typescript
async findAll(ctx, options?) {
    const qb = this.connection.getRepository(ctx, PickupLocation).createQueryBuilder('pl');
    qb.where(
        '(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)',
        { isPublic: true, channelId: ctx.channelId }
    );
    if (options?.filter?.type) {
        qb.andWhere('pl.type = :type', { type: options.filter.type });
    }
    qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
    return paginate(qb, options);
}
```

### 2.3 升级为公共自提点（仅 SuperAdmin）

```typescript
async promoteToPublic(ctx, id): Promise<PickupLocation> {
    if (!this.isSuperAdmin(ctx)) {
        throw new ForbiddenError(translateError(ctx, 'FORBIDDEN_PROMOTE'));
    }
    const loc = await this.findOne(ctx, id);
    loc.isPublic = true;
    loc.ownerChannelId = null;
    return this.connection.getRepository(ctx, PickupLocation).save(loc);
}
```

### 2.4 employee-pickup-eligibility checker

```typescript
export const employeePickupEligibilityChecker = new ShippingEligibilityChecker({
    code: 'employee-pickup-eligibility',
    args: {},
    check: async (ctx, order) => {
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'disabled') return false;
        if (mode === 'loose') return true;
        // strict：检查用户是否已绑定 EmployeeCustomer
        if (mode === 'strict') {
            if (!ctx.activeUserId) return false;
            const bindings = await employeeCustomerService.findByCustomer(ctx, ctx.activeUserId);
            return bindings.length > 0;
        }
        return false;
    },
});
```

### 2.5 employee-pickup fulfillmentHandler

```typescript
export const employeePickupFulfillmentHandler = new FulfillmentHandler({
    code: 'employee-pickup',
    args: {},
    createFulfillment: async (ctx, orders, lines, args) => {
        const order = orders[0];
        const locationId = order.customFields.selectedPickupLocationId;
        if (!locationId) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_SELECTED'));
        
        const location = await pickupLocationService.findOne(ctx, locationId);
        // strict 模式额外校验绑定
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'strict') {
            const bindings = await employeeCustomerService.findByCustomer(ctx, order.customer.id);
            const allowed = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
            if (!allowed.includes(locationId)) {
                throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            }
        }
        return {
            method: `${methodLabels[ctx.languageCode]} - ${location.name}`,
            trackingCode: `PICKUP-EMP-${location.id}`,
        };
    },
});
```

### 2.6 Shop API

```graphql
extend type Query {
    pickupLocations(type: String, lat: Float, lng: Float): [PickupLocation!]!
    employeePickupLocations(lat: Float, lng: Float): [PickupLocation!]!
}

extend type Mutation {
    setOrderPickupLocation(pickupLocationId: ID!, pickupType: String!): Order!
}
```

**employeePickupLocations 逻辑**：
- `disabled`：返回空
- `loose`：返回当前 channel 启用的所有 type='employee' 的点
- `strict`：返回当前用户绑定的点

**setOrderPickupLocation 逻辑**：
1. 写入 Order.customFields（selectedPickupLocationId + pickupType）
2. 同步更新 shipping address 为自提点地址

### 2.7 就近排序

```typescript
private sortByDistance(locations, lat, lng): PickupLocation[] {
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
```

无 coordinates 的点排末尾。

### 2.8 Admin API

```graphql
extend type Mutation {
    # PickupLocation
    promotePickupLocationToPublic(id: ID!): PickupLocation!
    assignPickupLocationsToChannel(ids: [ID!]!): Boolean!
    removePickupLocationsFromChannel(ids: [ID!]!): Boolean!
    
    # EmployeeCustomer
    createEmployeeCustomer(input: CreateEmployeeCustomerInput!): EmployeeCustomer!
    updateEmployeeCustomer(input: UpdateEmployeeCustomerInput!): EmployeeCustomer!
    deleteEmployeeCustomer(id: ID!): Boolean!
    bindEnterprisePickupLocations(id: ID!, pickupLocationIds: [ID!]!): EmployeeCustomer!
    verifyEmployeeCustomer(id: ID!): EmployeeCustomer!
}

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
```

---

## 3. 前端结算页交互

### 3.1 配送方式分类

```typescript
type ShippingCategory = 'shipping' | 'store-pickup' | 'point-pickup' | 'employee-pickup';

function categorizeShipping(sm: any): ShippingCategory {
    if (sm.code === 'store-pickup') return 'store-pickup';
    if (sm.code === 'pickup-point') return 'point-pickup';
    if (sm.code === 'employee-pickup') return 'employee-pickup';
    return 'shipping';
}
```

### 3.2 动态 UI

```
┌─────────────────────────────────┐
│ 配送方式                          │
│  ○ 门店自提 [store-pickup]       │
│  ○ 菜鸟驿站自提 [pickup-point]   │
│  ○ 企业职工自提 [employee-pickup]│  ← 列表非空时显示
│  ○ 满99包邮 [free-shipping-99]   │
│  ○ 顺丰快递 [sf-express]         │
└─────────────────────────────────┘

根据选中方式动态展示：
- shipping 类 → 收货地址（必填）
- store-pickup → 门店列表（单选必选）
- point-pickup → 驿站列表（单选必选）
- employee-pickup → 企业自提点（单选必选，strict 空状态提示）
```

### 3.3 定位三级兜底

```typescript
async function resolveLocation(): Promise<{lat,lng}|null> {
    // 1. 定位授权（3秒超时）
    const pos = await getLocationWithTimeout(3000);
    if (pos) return pos;
    
    // 2. 客户默认地址经纬度
    const addr = selectedAddress.value;
    if (addr?.customFields?.lat && addr?.customFields?.lng) {
        return { lat: addr.customFields.lat, lng: addr.customFields.lng };
    }
    
    // 3. 租户默认位置
    const tenantStore = useTenantStore();
    if (tenantStore.defaultLocation) return tenantStore.defaultLocation;
    
    return null;  // 无定位，原始顺序
}
```

### 3.4 提交校验

```typescript
async function submitOrder() {
    if (shippingCategory.value === 'shipping') {
        const addr = selectedAddress.value || address.value;
        if (!addr.fullName || !addr.phoneNumber || !addr.streetLine1) {
            ui.showToast(t('checkout.address.required')); return;
        }
        await setOrderShippingAddress(addr);
    } else {
        if (!selectedPickupLocation.value) {
            ui.showToast(t('checkout.pickupLocation.select')); return;
        }
        // setOrderPickupLocation 内部同步设置 shipping address
        await setOrderPickupLocation(selectedPickupLocation.value.id, shippingCategory.value);
    }
    await setOrderShippingMethod([selectedShipping.value]);
    await transitionOrderToState('ArrangingPayment');
    await addPaymentToOrder(selectedPayment.value);
}
```

### 3.5 strict 模式空状态

```vue
<view v-if="shippingCategory === 'employee-pickup' && employeePickupLocations.length === 0"
      class="empty-state">
    <text>{{ $t('checkout.pickupLocation.empty') }}</text>
    <text class="hint">{{ $t('checkout.pickupLocation.emptyHint') }}</text>
</view>
```

---

## 4. 多语言支持

### 4.1 语言范围

四语：zh_Hans、en、ja、ko

| 层级 | 多语言内容 | 实现方式 |
|---|---|---|
| 业务数据 | PickupLocation.name/address、EmployeeCustomer.enterpriseName | 单语言（admin 维护） |
| ShippingMethod | name/description | Vendure translations 机制 |
| 组件 | description/label | `label: [{languageCode, value}]` 四语 |
| Shop API 错误 | Error message | i18n key + `translateError(ctx, key)` |
| 前端 | 所有 UI 文案 | locale 文件四语 |

### 4.2 错误消息四语

```typescript
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
} as const;
```

### 4.3 Channel availableLanguageCodes

- default channel: `[zh_Hans, en, ja, ko]`
- shop-a: `[zh_Hans]`

---

## 5. 权限分级

### 5.1 角色定义

| 角色 | 范围 | 来源 |
|---|---|---|
| SuperAdmin | 全局所有 channel | Vendure 内置 |
| TenantAdmin | 仅本 channel | 新增角色，populate 自动创建 |
| SalesPerson | 仅本 channel，受限 | 新增角色，populate 自动创建 |

### 5.2 权限矩阵

| 操作 | SuperAdmin | TenantAdmin | SalesPerson |
|---|---|---|---|
| 查看公共自提点 | ✓（全局） | ✓（本租户可见） | ✓（只读） |
| 创建自建自提点 | ✓ | ✓ | ✗ |
| 编辑本租户自建自提点 | ✓ | ✓ | ✗ |
| 编辑公共自提点 | ✓ | ✗ | ✗ |
| 升级为公共自提点 | ✓ | ✗ | ✗ |
| 启用/禁用自提点到本 channel | ✓ | ✓ | ✗ |
| 查看 EmployeeCustomer | ✓ | ✓ | ✓ |
| 创建 EmployeeCustomer | ✓ | ✓ | ✓ |
| 修改企业/工号/绑定 | ✓ | ✓ | ✗ |
| 核实（verified=true） | ✓ | ✓ | ✗ |
| 删除 EmployeeCustomer | ✓ | ✓ | ✗ |
| 修改 Channel 配置 | ✓ | ✗ | ✗ |
| 创建 fulfillment | ✓ | ✓ | ✓ |

### 5.3 数据隔离

所有 service 方法强制校验：
- `channelId` 隔离（EmployeeCustomer）
- `isPublic + ownerChannelId` 可见性（PickupLocation）
- 公共自提点编辑仅 SuperAdmin

### 5.4 权限定义

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

---

## 6. 测试数据

### 6.1 双阳区自提点

```typescript
// default channel (loose)
{ name: '双阳商城店', type: 'store', address: '吉林省长春市双阳区西双阳大街188号', coordinates: { lat: 43.526210, lng: 125.664780 } },
{ name: '菜鸟驿站(双阳泰山店)', type: 'point', address: '吉林省长春市双阳区泰山路25号', coordinates: { lat: 43.528890, lng: 125.665420 } },
{ name: '长春科技学院自提点', type: 'employee', address: '吉林省长春市双阳区双阳大街1697号', coordinates: { lat: 43.533450, lng: 125.671230 }, isPublic: true },

// shop-a channel (strict)
{ name: '双阳生鲜自提点', type: 'store', address: '吉林省长春市双阳区东双阳大街555号', coordinates: { lat: 43.525870, lng: 125.668950 } },
{ name: '吉林农业大学自提点', type: 'employee', address: '吉林省长春市双阳区新城大街2888号', coordinates: { lat: 43.531120, lng: 125.679840 }, isPublic: false },
```

### 6.2 EmployeeCustomer 绑定

```typescript
// default channel (loose, verified=false)
{ customerId: testCustomer.id, enterpriseName: '长春科技学院', employeeId: 'CT20240001', verified: false }

// shop-a channel (strict, verified=true)
{ customerId: shopATestCustomer.id, enterpriseName: '吉林农业大学', employeeId: 'JLNY20240088', verified: true }
```

### 6.3 租户默认位置

- default channel: `{ lat: 43.526210, lng: 125.664780 }`（双阳区中心）
- shop-a: `{ lat: 43.525870, lng: 125.668950 }`

### 6.4 就近排序验证场景

| 场景 | 客户位置 | 预期顺序 |
|---|---|---|
| 定位授权（双阳大街） | 43.5260, 125.6650 | 双阳商城店 → 菜鸟驿站泰山店 → 长春科技学院 |
| 定位拒绝，默认地址带经纬度 | 43.5288, 125.6654 | 菜鸟驿站泰山店 → 双阳商城店 → 长春科技学院 |
| 无定位无地址 | 兜底租户默认位置 | 双阳商城店 → 菜鸟驿站泰山店 → 长春科技学院 |
| shop-a strict | 任意 | 仅返回吉林农业大学自提点 |

---

## 7. 实施阶段

### Phase 1: 数据模型与后端基础
- 1.1 PickupLocation 实体扩展
- 1.2 EmployeeCustomer 实体 + service
- 1.3 Order.customFields
- 1.4 Channel.customFields
- 1.5 权限定义 + populate 角色
- 1.6 i18n 消息模块

### Phase 2: 后端 Shipping 组件
- 2.1 employee-pickup-eligibility checker
- 2.2 employee-pickup-calculator
- 2.3 employee-pickup fulfillmentHandler
- 2.4 修订现有 store/point fulfillmentHandler 读取 customFields
- 2.5 plugin.ts 注册

### Phase 3: 后端 API
- 3.1 PickupLocation service 可见性查询
- 3.2 PickupLocation admin resolver
- 3.3 PickupLocation shop resolver + 就近排序
- 3.4 EmployeeCustomer admin resolver
- 3.5 Pickup shop resolver（setOrderPickupLocation）
- 3.6 plugin.ts 注册 API

### Phase 4: Populate 数据
- 4.1 sources.ts 双阳区自提点
- 4.2 02-default-channel.ts（loose）
- 4.3 03-shop-a-channel.ts（strict）
- 4.4 dev-config.ts 启用

### Phase 5: 前端结算页
- 5.1 API 层
- 5.2 tenant store
- 5.3 checkout.vue 配送方式分类 + 动态 UI
- 5.4 定位 + 三级兜底 + 就近查询
- 5.5 提交校验
- 5.6 strict 空状态

### Phase 6: 前端多语言
- 6.1 zh-Hans/en locale
- 6.2 ja/ko locale
- 6.3 checkout.vue 接入 i18n

### Phase 7: Admin UI
- 7.1 PickupLocation 管理页
- 7.2 升级/启用操作
- 7.3 EmployeeCustomer 管理页
- 7.4 绑定/核实操作
- 7.5 plugin.ts 注册

### Phase 8: 端到端验证
- 8.1 后端 API 验证
- 8.2 前端结算页验证
- 8.3 权限验证
- 8.4 多语言验证

---

## 8. 验收标准

| 场景 | 预期 |
|---|---|
| default channel（loose）选企业自提 | 显示全部 employee 类型点，按距离排序 |
| shop-a（strict）未绑定用户选企业自提 | 显示空状态提示 |
| shop-a（strict）已绑定用户选企业自提 | 仅显示绑定的点 |
| 定位拒绝 + 无地址经纬度 | 兜底租户 defaultLocation 排序 |
| TenantAdmin 编辑公共自提点 | 禁止，提示无权限 |
| SuperAdmin 升级自建为公共 | 成功，所有租户可见 |
| 销售人员创建 EmployeeCustomer | 成功，verified=false |
| TenantAdmin 核实 EmployeeCustomer | 成功，verified=true |
| 四语切换 | 所有 label/错误消息/locale 正确 |
| 下单选自提点 | order.customFields 记录 ID，fulfillment 自动读取 |

---

## 9. 技术约束与风险

**约束**：
1. PickupLocation 地址唯一约束需数据库迁移（已有数据需去重）
2. Vendure `eligibleShippingMethods` 不返回 metadata，前端用 `code` 识别类型
3. `setOrderCustomFields` 非内置 shop API，需自定义 mutation
4. Admin UI 扩展需编译 Angular 模块

**风险**：
1. strict 模式兼容性：现有未绑定用户在 strict channel 无法使用企业自提
2. 经纬度数据缺失：历史 PickupLocation 无 coordinates，需 populate 补全
3. Admin UI 构建：Angular 扩展编译可能与 Vendure 版本不兼容，需确认 v3.6.4 API
