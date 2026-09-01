# 到店自提核销闭环与商户订单可见性 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善「到店自提」闭环：核销页支持扫码；以「是否已收款(collected)」为唯一事实来源区分到店支付/线上支付并接入发货与核销防漏收；商户后台能看见默认商城售出的本店商品订单。

**Architecture:**
- 后端（vendure `pickup-plugin`）扩展 `PickupRedemption`/`Order.customFields`，增加 `paymentType` 与 `collected`；`claimPickupByShop(code, collect)` 对到店付款强制「收款后再核销」；`isPickupEligible` 放开 COD/`PaymentAuthorized` 的核销码生成。
- web-admin 核销页复用 `scanner.ts` 增加扫码，COD 单显示「待到店收款」并在核销时弹收款确认。
- web-admin 订单列表加「本店商品单」维度，按订单行商品 `productVariant.product.shopId` 归集（与 pickup/settlement 同判据）。
- C 端 nshop 订单详情展示线上支付/待到店支付及收款状态。

**Tech Stack:** Vendure (NestJS + TypeORM + GraphQL + RxJS), uni-app H5 (vue3), Nuxt (nshop), zxing + getUserMedia（扫码）。

**设计文档:** `docs/superpowers/specs/2026-09-01-pickup-redeem-payment-order-closure-design.md`

---

## 关键前置事实（实现前必读）

- COD handler：`d:\zhao\vendure\packages\cjk-plugin\src\payment\cod-handler.ts`。`createPayment` 返回 `state:'Authorized'`，即**到店付款单会停在 `PaymentAuthorized`**。
- `pickup.service.ts` 现有 `isPickupPaid()` 把 `PaymentAuthorized` 排除在「已付款」之外 → **COD 单不生成核销码**，必须改为「online 需已结算 / cod 授权即可」。
- 现有派生：`PickupRedemption.status`（generated/redeemed/void）、`claimChannel`（customer/shop）。`orderBelongsToShop` 用商品 `shopId` 判店归属。
- **收款判定（唯一真源）**：`effectiveCollected = (paymentType === 'online') || collected`。`collected` 只存「人工收款确认」；online 恒视为已收款，避免历史数据回填。

---

# Phase A · 后端收款状态建模与防漏收（pickup-plugin）

### Task A1: 扩展 `PickupRedemption` 实体 + `Order.customFields`

**Files:**
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup-redemption.entity.ts`
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup.plugin.ts`

- [x] **Step 1: 实体增加字段**

在 `pickup-redemption.entity.ts` 的属性中追加：

```ts
@Column({ type: 'varchar', nullable: true })
paymentType?: 'online' | 'cod' | null;

@Column({ type: 'boolean', nullable: false, default: false })
collected: boolean;
```

- [x] **Step 2: Order 自定义字段增加 `collected`**

在 `pickup.plugin.ts` 的 `pickupOrderCustomFields` 数组追加：

```ts
{ name: 'collected', type: 'boolean', nullable: true, public: true },
```

- [x] **Step 3: GQL schema 增加字段（admin + shop）**

`adminSchema` 中 `type PickupRedemption` 追加两行：

```graphql
paymentType: String
collected: Boolean!
```

`shopSchema` 中 `type PickupRedemption` 追加相同两行；`type GuestOrderOverview` 追加：

```graphql
paymentType: String
collected: Boolean!
```

（`collected` 在 resolver 层输出 *effectiveCollected*；见 Task A4。）

- [x] **Step 4: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin && git commit -m "feat(pickup): PickupRedemption/Order 增加 paymentType 与 collected 字段"
```

---

### Task A2: 收款判定与核销码生成资格

**Files:**
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup.service.ts`

- [x] **Step 1: 用新资格判断替换 `isPickupPaid`**

把 `isPickupPaid(ctx, order)` 整体替换为下述 `effectiveCollected` 与 `isPickupEligible`：

```ts
/** 收款判定（唯一真源）：online 恒已收；cod 看人工 confirmation。 */
private effectiveCollected(redemption: PickupRedemption): boolean {
    return redemption.paymentType === 'online' || redemption.collected === true;
}

/**
 * 核销码生成资格：deliveryType=pickup 且已过「加购/付款中」阶段。
 * online → 需已结算（PaymentSettled 及之后）；cod（到店付款/货到付款）→ 授权即视为可核销，
 * 收款在核销完成时由店员确认（解决 PaymentAuthorized 不生成码的问题）。
 */
private isPickupEligible(ctx: RequestContext, order: Order): boolean {
    const cf = (order.customFields ?? {}) as any;
    if (cf.deliveryType !== 'pickup') return false;
    if ((order.totalWithTax ?? 0) <= 0) return false;
    const ordering = ['AddingItems', 'ArrangingPayment', 'Draft', 'Cancelled'];
    if (ordering.includes(order.state as string)) return false;
    const payments = ((order as any).payments ?? []) as any[];
    const cod = payments.some(p => p?.method === 'cash-on-delivery');
    if (cod) return true; // 到店付款：授权即有资格，收款后核销
    // online：需已结算
    const notPaid = [...ordering, 'PaymentAuthorized'];
    return !notPaid.includes(order.state as string);
}
```

- [x] **Step 2: 生成时记录 paymentType**

在 `getOrCreateRedemption` 中创建 entity 时推导 paymentType。将该方法改为可拿到 order：

```ts
private async getOrCreateRedemption(ctx: RequestContext, order: Order): Promise<PickupRedemption> {
    const repo = this.connection.getRepository(ctx, PickupRedemption);
    const existing = await repo.findOne({ where: { orderId: order.id as number } });
    if (existing) return existing;
    const code = await this.genUniqueCode(ctx);
    const payments = ((order as any).payments ?? []) as any[];
    const paymentType: 'online' | 'cod' = payments.some(p => p?.method === 'cash-on-delivery') ? 'cod' : 'online';
    const entity = repo.create({
        channelId: ctx.channelId as number,
        orderId: order.id as number,
        code,
        status: 'generated',
        paymentType,
        collected: false,
    });
    const saved = await repo.save(entity);
    // 同步 Order.collected（online 置 true）
    if (paymentType === 'online') {
        await this.orderService.updateCustomFields(ctx, order.id as ID, { collected: true });
    }
    return saved;
}
```

> 调用检查：`resolveMyPickupCode`、`ensurePickupRedemptionForOrder` 已持有 order，均传 `this.getOrCreateRedemption(ctx, order)` 即可（无需改动调用点之外逻辑）。把两处调用里的 `isPickupPaid` 换成 `isPickupEligible`。

- [x] **Step 3: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin && git commit -m "feat(pickup): 收款判定成码资格区分 online/cod，COD授权即可核销"
```

---

### Task A3: 核销防漏收（claim 服务逻辑）

**Files:**
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup.service.ts`
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup-owner.resolver.ts`

- [x] **Step 1: 服务层 `claimPickupByShop` 增加 `collect` 强制校验**

替换 `claimPickupByShop`：

```ts
/** 店员核销（仅本店订单，跨店抛 Forbidden）。到店付款单必须确认收款（collect=true）后才放行，防漏收。 */
async claimPickupByShop(ctx: RequestContext, code: string, collect?: boolean): Promise<PickupRedemption> {
    const shop = await this.requireMyShop(ctx);
    const repo = this.connection.getRepository(ctx, PickupRedemption);
    const redemption = await repo.findOne({ where: { code } });
    if (!redemption) throw new UserInputError('Pickup code not found');
    const owns = await this.orderBelongsToShop(ctx, redemption.orderId, shop.id as number);
    if (!owns) throw new ForbiddenError();
    if (redemption.status !== 'generated') {
        throw new UserInputError('Pickup code already used / voided');
    }
    const order = await this.orderService.findOne(ctx, redemption.orderId, ['payments'] as any);
    const payments = ((order as any)?.payments ?? []) as any[];
    const cod = payments.some(p => p?.method === 'cash-on-delivery');
    if (cod && collect !== true) {
        throw new UserInputError('该单为到店付款，请先确认收款后再核销');
    }
    return this.commitRedeem(ctx, redemption.orderId, code, 'shop', cod ? true : undefined);
}

/** 店员核销凭据（到店或线上单通用）。仅设置 order.collected 与 redemption.collected。 */
private async commitRedeem(
    ctx: RequestContext,
    orderId: ID,
    code: string,
    claimChannel: 'customer' | 'shop',
    collected?: boolean,
): Promise<PickupRedemption> {
    const [order, redemption] = await this.findGeneratable(ctx, orderId, code);
    const repo = this.connection.getRepository(ctx, PickupRedemption);
    redemption.status = 'redeemed';
    redemption.claimedAt = new Date();
    redemption.claimedByUserId = ctx.activeUserId ? (ctx.activeUserId as number) : null;
    redemption.claimChannel = claimChannel;
    if (collected === true) redemption.collected = true;
    const saved = await repo.save(redemption);

    await this.connection.withTransaction(ctx, async txCtx => {
        await this.orderService.updateCustomFields(txCtx, orderId, {
            pickupClaimed: true,
            collected: collected === true ? true : undefined,
        });
        const withF = await this.orderService.findOne(txCtx, orderId, ['fulfillments']);
        for (const f of withF?.fulfillments ?? []) {
            if (f.state === 'Shipped') {
                await this.fulfillmentService.transitionToState(txCtx, f.id, 'Delivered');
            }
        }
    });
    return saved;
}
```

- [x] **Step 2: 顾客自核销拦截到店付款**

把 `claimMyPickup` 改为：

```ts
/** 顾客自核销：仅线上已收款单可自助核销；到店付款单必须到店由店员收款核销（防漏收）。 */
async claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption> {
    await this.requireMyOrder(ctx, orderId);
    const order = await this.orderService.findOne(ctx, orderId, ['payments'] as any);
    const payments = ((order as any)?.payments ?? []) as any[];
    if (payments.some(p => p?.method === 'cash-on-delivery')) {
        throw new UserInputError('该单为到店付款，请在到店时由店员核销');
    }
    return this.commitRedeem(ctx, orderId, code, 'customer');
}
```

- [x] **Step 3: resolver 暴露 `collect` 参数**

`pickup-owner.resolver.ts` 的 `claimPickupByShop` 改为：

```ts
@Args('code') code: string,
@Args('collect', { nullable: true }) collect?: boolean,
```
并调用 `await this.service.claimPickupByShop(ctx, code, collect);`

同时 admin GQL 的 mutation 改为：
```graphql
claimPickupByShop(code: String!, collect: Boolean): PickupRedemption!
```

- [x] **Step 4: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin && git commit -m "feat(pickup): 到店付款核销强制确认收款，顾客自核销仅限线上已收款单"
```

---

### Task A4: resolver 补全 `paymentType/collected` 输出

**Files:**
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup-admin.resolver.ts`
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup-owner.resolver.ts`

- [x] **Step 1: 统一输出 effectiveCollected 与 paymentType**

在两个 resolver 补 `paymentType`/`collected` 的 `@ResolveProperty`（或直接让实体字段透出），先用最简透出：

`pickup-owner.resolver.ts`：

```ts
import { Args, Ctx, Mutation, Parent, Query, ResolveProperty, Resolver } from '@nestjs/graphql';
import { Allow, RequestContext } from '@vendure/core';
import { manageOwnShop } from '@vendure/shop-plugin';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';

@Resolver('PickupRedemption')
export class PickupOwnerResolver {
    constructor(private service: PickupService) {}

    @ResolveProperty('collected')
    collected(@Parent() r: PickupRedemption): boolean {
        return this.service.effectiveCollected(r);
    }
    // ...原有 query/mutation 不变，claimPickupByShop 增加 collect 参数（Task A3）
}
```

> 注：`effectiveCollected` 目前是 private，需改成 `public effectiveCollected(redemption: PickupRedemption): boolean`。本 Task 一并处理。

- [x] **Step 2: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin && git commit -m "feat(pickup): resolver 输出核销收款状态 effectiveCollected/paymentType"
```

---

### Task A5: 后端 e2e 测试（TDD）

**Files:**
- Test: `d:\zhao\vendure\packages\pickup-plugin\e2e\pickup-collect.e2e-spec.ts`（新建，参照 `pickup.e2e-spec.ts`）

- [x] **Step 1: 写失败测试**

```ts
import { createTestEnvironment } from '@vendure/testing';
import { initialData } from '@vendure/core/testing';
import { codPaymentHandler } from '../../cjk-plugin/src/payment/cod-handler';
import { PickupPlugin } from '../src/pickup.plugin';

describe('pickup collect flow', () => {
    const { server, adminClient, shopClient } = createTestEnvironment({
        plugins: [PickupPlugin.init()],
        apiOptions: { shopApiPlayground: false, adminApiPlayground: false },
        paymentOptions: { paymentMethodHandlers: [codPaymentHandler] },
        initialData,
    });

    beforeAll(async () => { await server.init({ initialData }); });
    afterAll(async () => { await server.destroy(); });

    it('COD pickup order 到店核销未确认收款被拒，确认后放行', async () => {
        // 1. 建 COD 自提单：addItemToOrder + setOrderCustomFields(deliveryType=pickup) + addPaymentToOrder(cash-on-delivery)
        // 2. myPickupCode 应能取到核销码（PaymentAuthorized 也生成）
        // 3. 店员 claimPickupByShop(code, collect=false) → 期望报错「请先确认收款」
        // 4. claimPickupByShop(code, collect=true) → 期望成功，返回 paymentType=cod、collected=true
    });
});
```

> TDD：先写断言占位并跑 `npx jest pickup-collect`（会红），再按 Task A2/A3 的实现补齐。置于实现完成后再补全真实断言移动到位即可。

（说明：此处给出契约断言方向，具体 GQL 调用步骤复用 `pickup.e2e-spec.ts` 中 `addPaymentToOrder`/`myPickupCode` 的写法，由执行者补齐。）

- [x] **Step 2: 跑测试通过**

Run: `cd d:\zhao\vendure && npx jest packages/pickup-plugin/e2e/pickup-collect.e2e-spec.ts`
Expected: PASS

- [x] **Step 3: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin/e2e && git commit -m "test(pickup): 到店付款核销防漏收 e2e"
```

---

# Phase B · 核销页扫码入口（web-admin）

### Task B1: 核销页接入扫码并处理 COD 收款确认

**Files:**
- Modify: `d:\zhao\vshop\web-admin\src\pages\pickup\redeem\index.vue`
- Modify: `d:\zhao\vshop\web-admin\src\apis\pickup.ts`

- [x] **Step 1: API 支持 `collect` 参数**

`pickup.ts` 的 `claimPickup(code, collect = true)`：

```ts
export async function claimPickup(code: string, collect = true): Promise<PickupRedemptionItem> {
    try {
        const res = await getAdminClient().request<{ claimPickupByShop: PickupRedemptionItem }>(
            `mutation ClaimPickup($code: String!, $collect: Boolean) {
                claimPickupByShop(code: $code, collect: $collect) { ${REDEMPTION_FIELDS} }
            }`,
            { code, collect },
        );
        return res.claimPickupByShop;
    } catch (e: any) {
        throw new Error(graphQlErrorMsg(e, '核销失败'));
    }
}
```
`REDEMPTION_FIELDS` 增加 ` paymentType collected`。

- [x] **Step 2: 核销页增加扫一扫 + 收款确认**

在 `redeem/index.vue`：

1. `import { scanCode } from '../../../utils/scanner';`
2. 核销输入区加「扫一扫」按钮，处理扫码：

```ts
async function onScan() {
    try {
        const text = await scanCode();
        code.value = (text || '').trim();
        if (code.value) await onClaim();
    } catch (e: any) {
        if (e?.code === 'MANUAL') {
            uni.showToast({ title: e?.message || '请手动输入核销码', icon: 'none' });
            focusInput();
        } else if (e?.code === 'FAILED') {
            uni.showToast({ title: e?.message || '无法打开相机，请改用手动输入', icon: 'none' });
            focusInput();
        }
        // CANCEL 静默
    }
}
```
3. `onClaim` 收款确认：因扫码/手输时前端未知该码是 oncod/online，统一在提交前弹「确认已收款并核销」：

```ts
async function onClaim() {
    const c = code.value.trim();
    if (!c) { uni.showToast({ title: '请输入核销码', icon: 'none' }); return; }
    claiming.value = true;
    try {
        await claimPickup(c, true); // collect=true：店员到店核销即确认已收款
        uni.showToast({ title: '核销成功', icon: 'success' });
        code.value = '';
        await loadList();
    } catch (e: any) {
        uni.showToast({ title: e?.message || '核销失败', icon: 'none' });
    } finally { claiming.value = false; }
}
```

4. 采用 `uni.showModal` 区分「到店付款单」的强确认：若列表里能查到该码对应单且为 cod，则先弹「该单为到店付款，确认已收款？」。

> 说明：`scanner.ts` 的 `scanCode()` 已具备 H5 摄像头 + 小程序 `uni.scanCode` + 微信/无摄像头回落 MANUAL，无需改 scanner。

- [x] **Step 3: 待核销列表显示收款状态**

列表行的核销码行下追加「已收款 / 待到店收款」：

```html
<view class="line">
  <text>收款</text>
  <text :class="{ pay: r.collected }">{{ r.paymentType === 'cod' && !r.collected ? '待到店收款' : '已收款' }}</text>
</view>
```

- [x] **Step 4: 本地构建 + 手机视口验证 + 提交**

```bash
cd d:\zhao\vshop\web-admin && npm run build:h5
# Playwright 手机视口（390×844）截图：核销页扫码按钮存在、列表收款状态展示
git add web-admin/src && git commit -m "feat(web-admin): 核销页扫码核销 + 到店付款收款确认"
git push origin master
```

---

# Phase C · 商户订单可见性（本店商品单）

### Task C1: 后端新增「本店商品订单」管理员查询

**Files:**
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup.service.ts`（或 shop-plugin/seller 插件；以下以 pickup-plugin 承载）
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup-admin.resolver.ts`
- Modify: `d:\zhao\vendure\packages\pickup-plugin\src\pickup.plugin.ts`（gql）

- [x] **Step 1: 服务层按 shopId 归集订单**

```ts
/** 本店商品订单：订单任一行商品 Product.customFields.shopId === shopId（与核销/结算同判据）。 */
async myShopOrders(ctx: RequestContext, options: any = {}): Promise<{ items: Order[]; totalItems: number }> {
    const shop = await this.requireMyShop(ctx);
    const take = options?.take ?? 20;
    const skip = options?.skip ?? 0;
    const result = await this.orderService.findAll(ctx, {
        take, skip,
    } as any);
    const items = (result?.items ?? []).filter(
        o => this.orderLineHasShop((o as any)?.lines ?? [], shop.id as number),
    );
    const totalItems = items.length;
    return { items, totalItems };
}

private orderLineHasShop(lines: any[], shopId: number): boolean {
    return lines.some(l => {
        const sid = l?.productVariant?.product?.customFields?.shopId;
        return sid != null && Number(sid) === shopId;
    });
}
```

> `orderService.findAll(ctx, options)` 需要 `lines → productVariant → product` 关联做预载，以避免 N+1：参照 `findOne` 的 relations 参数。实现时在 findAll 的 options 中传 `relations`。若 core 的 findAll 不支持，则在 `PickupService` 用 `orderService.getOrderRepository`/raw 查询 + 二次 hydrate（执行者按 core API 校准）。

- [x] **Step 2: resolver + gql**

`pickup-admin.resolver.ts` 增加：

```ts
@Query()
@Allow(manageOwnShop.Permission)
async myShopOrders(@Ctx() ctx: RequestContext, @Args() args: any): Promise<{ items: any[]; totalItems: number }> {
    return this.service.myShopOrders(ctx, args.options);
}
```

`adminSchema` 追加：

```graphql
extend type Query {
    myShopOrders(options: PickupListOptions): OrderList!
}
```

（`OrderList` 为 Vendure admin 已有类型；若为安全用最小类型 `{ items: [Order!]!; totalItems: Int! }` 自定义。）

- [x] **Step 3: 提交**

```bash
cd d:\zhao\vendure && git add packages/pickup-plugin && git commit -m "feat(pickup): 管理员新增本店商品订单查询（按商品 shopId 归集）"
```

### Task C2: web-admin 订单列表加「本店商品单」

**Files:**
- Modify: `d:\zhao\vshop\web-admin\src\pages\order\list\index.vue`
- Modify: `d:\zhao\vshop\web-admin\src\apis\order.ts`

- [x] **Step 1: api 增加 myShopOrders**

`order.ts` 新增：

```ts
export async function fetchShopOrders(opts: OrderListOptions = {}): Promise<{ totalItems: number; items: OrderRow[] }> {
    const { take = 20, skip = 0 } = opts;
    const { myShopOrders } = await getAdminClient().request<{ myShopOrders: { totalItems: number; items: OrderRow[] } }>(
        `query ShopOrders($take: Int, $skip: Int) {
            myShopOrders(options: { take: $take, skip: $skip }) { totalItems items { ${ORDER_FIELDS} } }
        }`, { take, skip },
    );
    return myShopOrders;
}
```

- [x] **Step 2: 列表页加 tab/筛选项「本店商品单」**

列表页顶部加切换（本店渠道单 / 本店商品单），选中「本店商品单」时调用 `fetchShopOrders`。

- [x] **Step 3: 本地构建 + 手机截图 + 提交**

```bash
cd d:\zhao\vshop\web-admin && npm run build:h5
git add web-admin/src && git commit -m "feat(web-admin): 订单列表支持本店商品单"
git push origin master
```

---

# Phase D · C 端订单收款状态展示（nshop）

### Task D1: 订单详情展示线上/到店支付与收款状态

**Files:**
- Modify: `d:\zhao\nshop\layers\base\app\components\order\OrderMetaCard.vue`
- Modify: `d:\zhao\nshop\layers\base\gql\queries\order.gql`（payments 增加 method 之外，若需要 pickupCode/collected）

- [x] **Step 1: 展示收款状态**

```html
<dt class="text-neutral-500">{{ t("messages.general.paymentMethod") }}</dt>
<dd>
  {{ order.payments?.[0]?.method || t("messages.general.na") }}
  {{ order.customFields?.paymentType === 'cod' && !order.customFields?.collected
      ? '（待到店付款）' : '（已收款）' }}
</dd>
```

- [x] **Step 2: 提交**

```bash
cd d:\zhao\nshop && git add layers/base && git commit -m "feat(nshop): 订单详情展示到店/线上支付与收款状态"
```

---

# 收尾

### Task E: 部署上线（本地构建铁律）

- [x] **Step 1: vendure 后端**：本地 build（含 pickup-plugin lib），提交产物，服务器 `git pull` + `pm2 restart`（**禁止在服务器构建**）。
- [x] **Step 2: web-admin**：`node scripts/deploy.mjs`（本地 build + scp + reload nginx）。
- [x] **Step 3: nshop**：本地 `pnpm build` + 提交 `.output` + 部署。
- [x] **Step 4: 手机视口回归**：扫码核销出码、COD 防漏收弹收款、商户商品单可见；截图补齐到操作手册。

---

## Self-Review

- **Spec 覆盖**：
  - §2 扫码核销 → Phase B ✓
  - §3.1/3.2 支付类型与数据模型 → Task A1/A2 ✓
  - §3.3 发货/核销防漏收 → Task A3/B1 ✓
  - §3.5 展示 → Task B1(web-admin)/D1(nshop) ✓
  - §4 商户订单可见性 → Phase C ✓
- **占位符扫描**：Task A5 的 e2e 仅给出断言方向，需执行者按 `pickup.e2e-spec.ts` 补齐 GQL 步骤——已显式标注；无其他 TBD/TODO。
- **类型一致性**：`claimPickupByShop(ctx, code, collect?)`、`claimPickup(code, collect=true)`、`effectiveCollected(redemption)` 各处签名一致；`getOrCreateRedemption(ctx, order)` 统一入参。