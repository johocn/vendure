# 租户指定商品优惠券 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 商品绑定专属优惠券（详情页领券 + 凭码兑换 + 结算按商品限定），与现有 coupon-plugin 融合复用。

**Architecture:** B 融合形态——新增运营层 `ProductCouponBinding`（商品↔券），物理校验复用现有 scope 链路（单向同步写 template.scope=SKU），结算判定以 binding 集合为唯一权威；`CouponTemplate` 加 claimable/claimCode/validDays/newCustomerOnly 字段。三仓库：vendure（后端）→ nshop（C 端）→ vshop web-admin（后台）。

**Tech Stack:** Vendure 3.x / TypeScript / TypeORM / vitest；Nuxt 3 (nshop)；uni-app (web-admin)

**Spec:** `d:\zhao\vendure\docs\superpowers\specs\2026-09-19-product-coupon-binding-design.md`

---

## 阶段 A：后端（vendure coupon-plugin）

### A1. CouponTemplate 新增字段（实体 + admin schema）

**Files:**
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-template.entity.ts:76`（enabled 之后加字段）
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\plugin.ts`（couponTemplateType + Create/UpdateCouponTemplateInput）

- [ ] **Step 1: 实体加字段**

在 `coupon-template.entity.ts` 的 `enabled` 后追加：

```ts
    /** 详情页领券入口开关（binding.enabled && claimable 才展示领券入口） */
    @Column({ default: true }) claimable: boolean;

    /** 兑换码（非空=支持凭码兑换；同租户内唯一由 service 层保证） */
    @Column('varchar', { nullable: true }) claimCode?: string;

    /** 领取后 N 天有效（空=走固定 startsAt/endsAt） */
    @Column({ nullable: true }) validDays?: number;

    /** 仅限新客（本租户无历史有效订单）可领可用 */
    @Column({ default: false }) newCustomerOnly: boolean;

    /** 会员等级限定（预留，本期只建字段不开发逻辑） */
    @Column('varchar', { nullable: true }) memberLevel?: string;
```

- [ ] **Step 2: plugin.ts 同步 schema**

`couponTemplateType`（L38-59）在 `enabled: Boolean!` 后加：

```ts
    claimable: Boolean!
    claimCode: String
    validDays: Int
    newCustomerOnly: Boolean!
    memberLevel: String
```

`CreateCouponTemplateInput` 与 `UpdateCouponTemplateInput` 各加：

```ts
    claimable: Boolean
    claimCode: String
    validDays: Int
    newCustomerOnly: Boolean
    memberLevel: String
```

- [ ] **Step 3: 写 migration**

新建 `packages/coupon-plugin/src/migrations/20260919-add-coupon-fields.ts`（对齐 cjk-plugin migrate 模式，幂等）：

```ts
export class AddCouponFields20260919 {
    async up(qb: any) {
        for (const col of ['claimable', 'claimCode', 'validDays', 'newCustomerOnly', 'memberLevel']) {
            await qb.query(
                `ALTER TABLE "coupon_template" ADD COLUMN IF NOT EXISTS "${col}" ...`,
            );
        }
    }
}
```

（迁移注册方式遵循本仓库既有 migration 机制——查看 cjk-plugin 的 migration 注册后对齐。）

- [ ] **Step 4: 运行 migration 验证**

Run: `npx ts-node packages/coupon-plugin/src/migrations/run.ts`（或仓库既有方式）
Expected: `coupon_template` 表含新列，无报错

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin
git commit -m "feat(coupon): CouponTemplate 新增 claimable/claimCode/validDays/newCustomerOnly/memberLevel"
```

---

### A2. ProductCouponBinding 实体 + 迁移

**Files:**
- Create: `d:\zhao\vendure\packages\coupon-plugin\src\product-coupon-binding.entity.ts`
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\plugin.ts:81`（entities 数组）
- Create: `d:\zhao\vendure\packages\coupon-plugin\src\migrations/20260919-product-coupon-binding.ts`

- [ ] **Step 1: 新建实体**

```ts
@Entity()
export class ProductCouponBinding extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<ProductCouponBinding>) { super(input); }

    @Column() productId: number;
    /** 多规格细化；空=商品全 SKU */
    @Column('jsonb', { nullable: true }) variantIds?: number[];
    @Column() couponTemplateId: number;
    @Column({ default: true }) enabled: boolean;
    @Column('bigint', { nullable: true }) channelId?: number;
    @Column({ default: 0 }) displayOrder: number;
    /** 预留：每人限领覆盖 / 专属时间窗 / 独立库存 / 角标 / 主文案 */
    @Column({ nullable: true }) perUserClaimLimit?: number;
    @Column({ nullable: true }) claimWindowStart?: Date;
    @Column({ nullable: true }) claimWindowEnd?: Date;
    @Column({ nullable: true }) claimStock?: number;
    @Column('varchar', { nullable: true }) badgeText?: string;
    @Column('varchar', { nullable: true }) promoTitle?: string;
    @Column('varchar', { nullable: true }) remark?: string;

    @ManyToOne(() => CouponTemplate)
    template: CouponTemplate;
}
```

- [ ] **Step 2: plugin.ts 注册实体**

`entities: [CouponTemplate, CustomerCoupon, ProductCouponBinding],`

- [ ] **Step 3: 迁移建表**

```ts
CREATE TABLE IF NOT EXISTS "product_coupon_binding" (
    "id" serial PRIMARY KEY,
    "productId" integer NOT NULL,
    "variantIds" jsonb,
    "couponTemplateId" integer NOT NULL,
    "enabled" boolean DEFAULT true,
    "channelId" bigint,
    "displayOrder" integer DEFAULT 0,
    "perUserClaimLimit" integer,
    "claimWindowStart" timestamptz,
    "claimWindowEnd" timestamptz,
    "claimStock" integer,
    "badgeText" varchar(255),
    "promoTitle" varchar(255),
    "remark" varchar(500),
    "createdAt" timestamptz DEFAULT now(),
    "updatedAt" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_binding_product ON product_coupon_binding ("productId", "channelId");
CREATE INDEX IF NOT EXISTS idx_binding_template ON product_coupon_binding ("couponTemplateId");
```

- [ ] **Step 4: Commit**

```bash
git add packages/coupon-plugin
git commit -m "feat(coupon): ProductCouponBinding 实体 + 迁移"
```

---

### A3. CouponBindingService（TDD）

**Files:**
- Create: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-binding.service.ts`
- Test: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-binding.service.spec.ts`（对齐仓库既有测试框架）
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\plugin.ts`（providers + exports）

- [ ] **Step 1: 写失败测试**

```ts
describe('CouponBindingService', () => {
    it('创建 binding 时单向同步模板 scope=SKU（单 variant 写 variantId）', async () => {
        const tpl = { id: 1, scope: 'ALL', variantId: null } as any;
        const binding = { productId: 10, variantIds: [100] } as any;
        await service.syncTemplateScope(ctx, tpl, binding);
        expect(tpl.scope).toBe('SKU');
        expect(tpl.variantId).toBe(100);
    });
    it('多 variant 留空 variantId', async () => {
        const tpl = { scope: 'ALL', variantId: 999 } as any;
        await service.syncTemplateScope(ctx, tpl, { variantIds: [1, 2] } as any);
        expect(tpl.scope).toBe('SKU');
        expect(tpl.variantId).toBeNull();
    });
    it('listByProduct 只返回 enabled binding 且模板 claimable', async () => {
        // mock repo：3 条 binding（1 disabled），模板 1 claimable / 1 非 claimable
        const result = await service.listByProduct(ctx, 10);
        expect(result.map(r => r.id)).toEqual([1]);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon-binding.service.spec.ts`
Expected: FAIL（service 不存在）

- [ ] **Step 3: 实现 service**

```ts
@Injectable()
export class CouponBindingService {
    constructor(
        @Inject(COUPON_PLUGIN_OPTIONS) private options: CouponPluginOptions,
        private connection: TransactionalConnection,
    ) {}
    private injector!: Injector;
    init(injector: Injector) { this.injector = injector; }

    /** 单向同步：创建/更新 binding 时写模板 scope=SKU；单 variant 写 variantId，多 variant 留空 */
    async syncTemplateScope(ctx: RequestContext, tpl: CouponTemplate, binding: { variantIds?: number[] }) {
        tpl.scope = 'SKU' as any;
        tpl.variantId = (binding.variantIds?.length === 1 ? binding.variantIds[0] : null) as any;
        await this.connection.getRepository(ctx, CouponTemplate).save(tpl);
    }

    async listByProduct(ctx: RequestContext, productId: number): Promise<ProductCouponBinding[]> {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const bindings = await repo.find({
            where: { productId, enabled: true } as any,
            relations: { template: true },
            order: { displayOrder: 'ASC' } as any,
        });
        return bindings.filter(b => b.template?.enabled && b.template.claimable);
    }

    /** 结算用：模板的全部 enabled binding 集合（供 promotion condition 判定） */
    async listByTemplate(ctx: RequestContext, templateId: ID): Promise<ProductCouponBinding[]> {
        return this.connection.getRepository(ctx, ProductCouponBinding).find({
            where: { couponTemplateId: templateId as any, enabled: true } as any,
        });
    }

    async create(ctx: RequestContext, input: CreateProductCouponBindingInput): Promise<ProductCouponBinding> {
        const binding = new ProductCouponBinding(input as any);
        const saved = await this.connection.getRepository(ctx, ProductCouponBinding).save(binding);
        const tpl = await this.connection.getRepository(ctx, CouponTemplate).findOne({ where: { id: saved.couponTemplateId as any } });
        if (tpl) await this.syncTemplateScope(ctx, tpl, saved);
        return saved;
    }
    // update / delete / toggleEnabled 类似：update 时重新 syncTemplateScope
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/coupon-binding.service.spec.ts`
Expected: PASS

- [ ] **Step 5: plugin.ts 注册 provider**

```ts
providers: [..., CouponService, CouponBindingService],
exports: [CouponService, CouponBindingService],
```

- [ ] **Step 6: Commit**

```bash
git add packages/coupon-plugin
git commit -m "feat(coupon): CouponBindingService（CRUD + 单向同步 + listByProduct）"
```

---

### A4. 结算校验改造（binding 过滤 + validDays + newCustomerOnly，TDD）

**Files:**
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-promotion-condition.ts:41-49`
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\coupon.service.ts`（claimCoupon/兑换入口加 newCustomerOnly 校验 + validDays 计算）
- Test: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-promotion-condition.spec.ts`

- [ ] **Step 1: 写失败测试（条件过滤）**

```ts
describe('couponAppliedCondition binding 过滤', () => {
    it('订单含非绑定商品行时只对绑定行计算', async () => {
        const order = {
            customFields: { couponCode: 'X' },
            lines: [
                { product: { id: 10 }, variant: { id: 100 }, linePrice: 100, linePriceWithTax: 100 },
                { product: { id: 20 }, variant: { id: 200 }, linePrice: 50, linePriceWithTax: 50 },
            ],
            shippingLines: [],
        };
        mockGetCouponConnection = () => ({
            getRepository: () => ({
                findOne: async () => ({ code: 'X', status: 'UNUSED', template: { id: 1, enabled: true, shopId: null, minSpend: 0, type: 'FIXED', discountValue: 30 } }),
            }),
        });
        mockListByTemplate = async () => [{ productId: 10, variantIds: [100], enabled: true }];
        const state = await couponAppliedCondition.check(ctx, order, {});
        expect(state.discountAmount).toBe(30); // 只算绑定行 base=100，封顶 30
    });
    it('newCustomerOnly 且客户有历史订单 → false', async () => {
        mockHasOrderCount = async () => 1;
        const state = await couponAppliedCondition.check(ctx, { customFields: { couponCode: 'X' }, lines: [] }, {});
        expect(state).toBe(false);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon-promotion-condition.spec.ts`
Expected: FAIL

- [ ] **Step 3: 改造条件（注入 binding 集合判定）**

`coupon-promotion-condition.ts` 在 `lineHasShopId` 过滤后追加：

```ts
        // 商品限定：模板有 binding 时按 binding 集合判定（唯一权威）
        const bindings = await getBindingConnection().listByTemplate(ctx, template.id);
        if (bindings.length) {
            const hit = (l: any) => bindings.some(b =>
                b.productId === l.product?.id &&
                (!b.variantIds?.length || (l.variant?.id && b.variantIds.includes(l.variant.id))));
            eligibleLines = eligibleLines.filter(hit);
            if (eligibleLines.length === 0) return false;
        }
        // newCustomerOnly：本租户历史有效订单 > 0 则不可用
        if (template.newCustomerOnly && !isNewCustomer(ctx, order.customer?.id)) return false;
        // validDays：券的 expiredAt 由领取时计算，结算校验 expiredAt
        if (coupon.expiredAt && now > coupon.expiredAt) return false;
```

（`getBindingConnection` 与 `isNewCustomer` 在 coupon-runtime/coupon-scope 旁新增小模块，对齐现有 `getCouponConnection` 模式。）

- [ ] **Step 4: claimCoupon 加 newCustomerOnly + validDays**

`coupon.service.ts` claimCoupon（L324-360）在限领校验后追加：

```ts
        // 仅限新客：本租户历史有效订单数 > 0 则不可领
        if (tpl.newCustomerOnly) {
            const orders = await this.countCustomerOrders(ctx, customerId);
            if (orders > 0) throw new UserInputError('Coupon is for new customers only');
        }
```

并在 `createUserCoupon` 处计算 `expiredAt`：`tpl.validDays ? new Date(now.getTime() + tpl.validDays * 86400000) : tpl.endsAt`（检查 createUserCoupon 现有逻辑后合入）。

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run src/coupon-promotion-condition.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/coupon-plugin
git commit -m "feat(coupon): 结算按 binding 商品限定 + newCustomerOnly + validDays"
```

---

### A5. C 端接口（productCoupons / claimProductCoupon / redeemCouponByCode）

**Files:**
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\plugin.ts`（shopApiExtensions schema + resolvers）
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-shop.resolver.ts`
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\coupon.service.ts`（listProductCoupons / redeemByClaimCode）

- [ ] **Step 1: schema 加 query/mutation**

shopApiExtensions 的 Query 加：

```ts
    productCoupons(productId: ID!): [CouponTemplate!]!
```

Mutation 加：

```ts
    claimProductCoupon(bindingId: ID!): CustomerCoupon!
    redeemCouponByCode(claimCode: String!): CustomerCoupon!
```

- [ ] **Step 2: service 实现**

```ts
    /** 详情页可领券：binding.enabled && template.enabled && claimable + 前置校验 */
    async listProductCoupons(ctx: RequestContext, productId: ID): Promise<CouponTemplate[]> {
        const bindings = await this.bindingService.listByProduct(ctx, productId as number);
        return bindings.map(b => b.template);
    }

    async claimProductCoupon(ctx: RequestContext, bindingId: ID): Promise<CustomerCoupon> {
        const binding = await this.bindingRepo.findOne({ where: { id: bindingId as any }, relations: { template: true } });
        if (!binding || !binding.enabled) throw new UserInputError('Binding not found');
        return this.claimCoupon(ctx, binding.couponTemplateId);
    }

    /** 凭码兑换：同租户内 claimCode 唯一匹配模板 → 复用 claimCoupon */
    async redeemByClaimCode(ctx: RequestContext, claimCode: string): Promise<CustomerCoupon> {
        const tpl = await this.templateRepo.findOne({ where: { claimCode } as any, relations: { channels: true } });
        if (!tpl || !tpl.claimCode) throw new UserInputError('Invalid claim code');
        if (!this.templateBelongsToChannel(ctx, tpl)) throw new UserInputError('Claim code not available in this shop');
        return this.claimCoupon(ctx, tpl.id);
    }
```

（`templateBelongsToChannel` 复用现有 channels 关系判定，对齐 couponCentre 的过滤方式。）

- [ ] **Step 3: resolver 绑定**

`coupon-shop.resolver.ts` 加三个方法（@Query/@Mutation + @Transaction，模式同 claimCoupon L28-32）。

- [ ] **Step 4: 运行验证**

Run: `npx tsc --noEmit -p packages/coupon-plugin/tsconfig.json`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin
git commit -m "feat(coupon): shop-api productCoupons/claimProductCoupon/redeemCouponByCode"
```

---

### A6. 后台接口（Binding CRUD + 模板表单字段）

**Files:**
- Modify: `d:\zhao\vendure\packages\coupon-plugin\src\plugin.ts`（adminApiExtensions）
- Create: `d:\zhao\vendure\packages\coupon-plugin\src\coupon-binding-admin.resolver.ts`

- [ ] **Step 1: admin schema**

```ts
            type ProductCouponBinding implements Node {
                id: ID!
                productId: ID!
                variantIds: [ID!]
                couponTemplateId: ID!
                enabled: Boolean!
                displayOrder: Int!
                badgeText: String
                promoTitle: String
                remark: String
                template: CouponTemplate
            }

            input CreateProductCouponBindingInput {
                productId: ID!
                variantIds: [ID!]
                couponTemplateId: ID!
                enabled: Boolean
                displayOrder: Int
                badgeText: String
                promoTitle: String
                remark: String
            }
            input UpdateProductCouponBindingInput {
                id: ID!
                variantIds: [ID!]
                enabled: Boolean
                displayOrder: Int
                badgeText: String
                promoTitle: String
                remark: String
            }

            extend type Query {
                productCouponBindings(productId: ID!): [ProductCouponBinding!]!
            }
            extend type Mutation {
                createProductCouponBinding(input: CreateProductCouponBindingInput!): ProductCouponBinding!
                updateProductCouponBinding(input: UpdateProductCouponBindingInput!): ProductCouponBinding!
                deleteProductCouponBinding(id: ID!): Boolean!
            }
```

- [ ] **Step 2: admin resolver（@Transaction 委托 CouponBindingService）**

模式对齐 `coupon-admin.resolver.ts` 的 grantCoupon 绑定。

- [ ] **Step 3: plugin.ts 注册 resolver**

`adminApiExtensions.resolvers` 数组加 `CouponBindingAdminResolver`。

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit -p packages/coupon-plugin/tsconfig.json`
Expected: 无类型错误 → commit `feat(coupon): admin-api ProductCouponBinding CRUD`

---

### A7. 后端完成标准

- [ ] `npx tsc --noEmit -p packages/coupon-plugin/tsconfig.json` 通过
- [ ] `npx vitest run` 全绿（含既有测试）
- [ ] 本地 dev 起服，admin/shop schema 含全部新字段与接口
- [ ] **Commit**（若 A3-A6 已各 commit 则跳过）

---

## 阶段 B：C 端前端（nshop）

### B1. gql + codegen

**Files:**
- Create: `d:\zhao\nshop\layers\base\gql\queries\product-coupons.ts`（productCoupons / claimProductCoupon / redeemCouponByCode 文档）
- Modify: `d:\zhao\nshop\layers\base\gql\schema.graphql`（按既有 schema 同步流程刷新）

- [ ] **Step 1: 写 gql 文档**（对齐 `layers/base/gql/queries` 既有风格）
- [ ] **Step 2: 运行 codegen**（按仓库既有命令，如 `pnpm codegen`），确认生成 useProductCoupons 等 composable
- [ ] **Step 3: Commit** `feat(nshop): productCoupons gql + codegen`

### B2. 详情页领券积木块 ProductCouponBlock

**Files:**
- Create: `d:\zhao\nshop\layers\base\app\components\product-detail\ProductCouponBlock.vue`（积木块，遵循现有 product-detail 积木命名与注册规范——完整注册名，防止 SSR 空注释）

- [ ] **Step 1: 组件实现**：`useAsyncData('productCoupons', ...)` 调 `productCoupons(productId)`；展示券卡片（面额/门槛/有效期/角标 badgeText）；「立即领取」→ `claimProductCoupon(bindingId)` → 成功 toast + 跳转我的优惠券；已领取状态由 myCoupons 比对 code 判定
- [ ] **Step 2: 接入详情页渲染器**（DetailClassic/DetailFloor/DetailDualBuy 或 ProductDetailRenderer 按 layout 挂载该块，遵循积木式 UI 规范）
- [ ] **Step 3: Commit** `feat(nshop): 详情页领券积木块`

### B3. 我的优惠券页兑换入口

**Files:**
- Modify: 我的优惠券页面（定位：`layers/base/app/pages` 下 coupon 相关 page）

- [ ] **Step 1: 页面顶部加「兑换码」输入框 + 兑换按钮** → `redeemCouponByCode(claimCode)`；错误码文案映射（Invalid claim code / expired / limit / new customer only）
- [ ] **Step 2: Commit** `feat(nshop): 优惠券兑换入口`

### B4. i18n 四语言词条

**Files:**
- Modify: `d:\zhao\nshop\layers\base\i18n\locales\`（zh-CN / en-US 等四个语言包）

- [ ] **Step 1: 补词条**（领券/立即领取/已领取/兑换码/兑换/仅限新客/领取后N天有效等，四语言同步，禁止单语言写死）
- [ ] **Step 2: Commit** `feat(nshop): 优惠券 i18n 四语言`

---

## 阶段 C：后台前端（web-admin）

### C1. 券模板表单「领取设置」区

**Files:**
- Modify: `d:\zhao\vshop\web-admin\src\apis\coupon.ts:38-53`（Create/Update 输入加 claimable/claimCode/validDays/newCustomerOnly）
- Modify: 券模板表单页（定位 coupon 相关 pages/form）

- [ ] **Step 1: API 层补字段**
- [ ] **Step 2: 表单加「领取设置」区块**：可领取开关、兑换码、领取后有效天数、仅限新客；「指定商品」选择器（scope=SKU 时绑商品 → 保存后调 createProductCouponBinding）
- [ ] **Step 3: Commit** `feat(web-admin): 券模板领取设置`

### C2. 商品页「商品专属券」区块

**Files:**
- Modify: 商品编辑页（product 相关 pages/form）

- [ ] **Step 1: 内嵌「商品专属券」区块**：`productCouponBindings(productId)` 列表（券名/面额/状态/角标）+ 停用/删除按钮 + 「为此商品新建券」快捷入口（预填 SKU 跳转建券页，保存时建 Binding）
- [ ] **Step 2: Commit** `feat(web-admin): 商品页绑券管理`

### C3. 券列表标签

- [ ] **Step 1: 券列表显示**：可领取/兑换码/仅限新客 标签
- [ ] **Step 2: Commit** `feat(web-admin): 券列表标签`

---

## 阶段 D：测试 + 部署 + 手册

### D1. Playwright 手机截图（390×844，dpr=2，硬规范）

- [ ] 详情页领券区截图（有券可领 / 已领取状态）
- [ ] 兑换页输入码 + 兑换成功
- [ ] 后台建券表单（领取设置区）
- [ ] 商品页绑券区块
- [ ] 产物放 `d:\zhao\vshop\web-admin\src\static\manual\shots\`

### D2. 部署（铁律：本地构建，服务器只解压/pm2 restart）

- [ ] vendure：git pull + `pm2 restart vendure`（服务器不构建）
- [ ] nshop：`node scripts/deploy.mjs`（本地 `pnpm build` → scp → 解压 → pm2 restart）
- [ ] web-admin：`node scripts/deploy.mjs`（`npm run build:h5` → tar → scp → 解压替换 → nginx reload）

### D3. 线上回归 + 手册

- [ ] 线上验证：建 SKU 券 → 绑商品 → 详情页领券 → 下单校验（非绑定商品行剔除）→ 凭码兑换 → newCustomerOnly 拦截
- [ ] 操作手册新增章节（含全部 D1 截图）

### D4. 提交

- [ ] vendure / nshop / vshop 三仓库按各自 commit 策略分批提交

---

## 完成标准（总）

首页/详情页展示商品专属券可领；凭码兑换可用；结算仅对绑定商品行生效；newCustomerOnly/validDays 生效；后台可管理绑券；手机截图齐全；操作手册补丁完成；三端已部署。
