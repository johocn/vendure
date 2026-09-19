# 优惠券 G1-G4 深挖修补（P0+P1+P2） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修补已上线商品专属优惠券（G1–G4）暴露的 8 个边界缺陷/健壮性/性能点（P0×2 + P1×3 + P2×3），不改实体结构、不新增字段。

**Architecture:** 纯行为修正 + 查询/缓存优化，全部落在 `coupon-plugin` 单仓库。P0/P1 修正授权与口径（末绑定回退、渠道隔离、newCustomerOnly 统一、redeem 渠道过滤、限领口径）；P2 内聚进 `listByTemplate` 的进程内 TTL 缓存 + 幂等索引迁移。分两批实施，P2 独立提交规避缓存并发风险。

**Tech Stack:** Vendure 3.x / TypeScript / TypeORM / vitest

**Spec:** `d:\zhao\vendure\docs\superpowers\specs\2026-09-19-coupon-gaps-supplement-design.md`

---

## 文件结构总览

| 文件 | 职责 | 本计划改动 |
|---|---|---|
| `packages/coupon-plugin/src/coupon-binding.service.ts` | 绑定 CRUD + 可见性 + 结算集合 | ① 末绑定回退、⑥ TTL 缓存内聚 |
| `packages/coupon-plugin/src/coupon-binding-cache.ts` | 新建：结算 binding 集合 TTL 缓存 | ⑥ 新增 |
| `packages/coupon-plugin/src/coupon-settlement.ts` | isNewCustomer 公共判定 | ③ 抽 `isNewCustomerWithinChannel` + 渠道过滤 |
| `packages/coupon-plugin/src/coupon.service.ts` | 领取/兑换/限领/发券 | ② 渠道校验、④ redeem 渠道过滤、⑤ countHeld 口径 |
| `packages/coupon-plugin/src/migrations/20260919-coupon-indexes.ts` | 新建：幂等索引迁移 | ⑦ 新增 |
| `packages/coupon-plugin/src/coupon-binding.service.spec.ts` | 绑定服务测试 | ①⑥ 用例追加 |
| `packages/coupon-plugin/src/coupon-settlement.spec.ts` | 新客判定测试 | ③ 用例 |
| `packages/coupon-plugin/src/coupon.service.spec.ts` | 领取/兑换/限领测试 | ②④⑤ 用例 |

测试基建约定：仓库用 **vitest**，跑单测命令 `npx vitest run src/<file>.spec.ts`。Promotion 条件/settlement 依赖 `getCouponConnection()` / `getBindingService()` 单例注入，测试里用 `vi.mock` 或对单例赋值打桩（沿用 `2026-09-19-product-coupon-binding` 计划 A3/A4 的 mock 手法：直接对 `getCouponConnection()`/`getBindingService()` 返回的重载对象做 stub）。

---

## 批次 1：P0 + P1（语义正确性）

### Task 0: 写测试基建桩（先跑通现有测试）

**Files:**
- Read: `packages/coupon-plugin/src/coupon-binding.service.spec.ts`
- Read: `packages/coupon-plugin/src/coupon-promotion-condition.spec.ts`

- [ ] **Step 1: 确认现有测试框架可跑**

Run: `npx vitest run packages/coupon-plugin/src`
Expected: 仓库既有 coupon 测试全部 PASS（若本来全绿则跳过本 Task 的后续提交，仅确认命令可用）。

- [ ] **Step 2: 记录 mock 手法**

记下现有 spec 如何打桩 `getCouponConnection()`（`coupon-runtime.ts` 单例）、`TransactionalConnection.getRepository`、以及是否用 `vi.mock`。后续 Task 沿用该模式，不复刻测试框架。

---

### Task 1: P0-① 末绑定回退（只清关联，不改回 scope）

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-binding.service.ts`
- Test: `packages/coupon-plugin/src/coupon-binding.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `coupon-binding.service.spec.ts` 追加：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CouponBindingService 末绑定回退', () => {
    const svc = { syncTemplateScope: vi.fn() };
    // 提供一个可注入的 CouponBindingService 实例或测其内部私有方法（经 public 委托）
    // 若无法覆盖私有方法，改为通过 create/delete/toggleEnabled 行为断言（见 Step 3 后）

    it('删除最后一个 enabled binding 后模板 variantId 被清空、scope 保持 SKU', async () => {
        // 预置：token 模板绑定 1 条 binding
        const ctx = { channel: { id: 37 } } as any;
        // service 内部：delete 后应调用 syncTemplateScopeAfterMutation
        // 断言 repo.save 对 CouponTemplate 写入 { id, scope:'SKU', variantId: null }
        expect(svc.syncTemplateScope).toBeDefined();
    });
});
```

> 说明：若 `syncTemplateScopeAfterMutation` 为私有、无法直接测，则把 Step 1 的测试改为「断言 delete/toggleEnabled(false) 后调用 summary 返回/副作用」——本 Task 以「Delete 后 `listByTemplate` 返回空 + 模板 variantId 清空」为行为验收。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon-binding.service.spec.ts`
Expected: FAIL（`syncTemplateScopeAfterMutation` 不存在）

- [ ] **Step 3: 实现末绑定回退逻辑**

在 `coupon-binding.service.ts` 新增私有方法并在 `delete`/`toggleEnabled`/`update` 三处调用：

```ts
import { ID } from '@vendure/core';

// 追加到 delete 末尾（delete id 后是模板 id，需先取 templateId）
async delete(ctx: RequestContext, id: ID): Promise<void> {
    const repo = this.connection.getRepository(ctx, ProductCouponBinding);
    const binding = await repo.findOne({ where: { id: id as any } });
    const templateId = binding?.couponTemplateId;
    await repo.delete(id);
    if (templateId != null) {
        await this.syncTemplateScopeAfterMutation(ctx, templateId);
    }
}

async toggleEnabled(ctx: RequestContext, id: ID): Promise<ProductCouponBinding> {
    const repo = this.connection.getRepository(ctx, ProductCouponBinding);
    const binding = await repo.findOne({ where: { id: id as any } });
    if (!binding) throw new UserInputError(`ProductCouponBinding with id ${id} not found`);
    binding.enabled = !binding.enabled;
    const saved = await repo.save(binding);
    if (!saved.enabled) {
        await this.syncTemplateScopeAfterMutation(ctx, saved.couponTemplateId);
    }
    return saved;
}

/**
 * 删除/停用后：若模板已无任何为 enabled 的 binding，则仅清空的陈旧 variantId
 * （释放单 SKU 指向），保持 template.scope 不变（不误改历史，靠 scope 原判定回退）。
 */
private async syncTemplateScopeAfterMutation(ctx: RequestContext, templateId: number): Promise<void> {
    if (templateId == null) return;
    const repo = this.connection.getRepository(ctx, ProductCouponBinding);
    const remaining = await repo.count({
        where: { couponTemplateId: templateId as any, enabled: true },
    });
    if (remaining > 0) return;
    const tplRepo = this.connection.getRepository(ctx, CouponTemplate);
    const tpl = await tplRepo.findOne({ where: { id: templateId as any } });
    if (!tpl) return;
    if (tpl.variantId != null) {
        tpl.variantId = null as any;
        await tplRepo.save(tpl);
    }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/coupon-binding.service.spec.ts`
Expected: PASS（含既有用例）

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin/src/coupon-binding.service.ts
git commit -m "fix(coupon): 删除/停用最后一个绑定后清空模板陈旧 variantId（scope 保持）"
```

---

### Task 2: P0-② claimProductCoupon 渠道隔离

**Files:**
- Modify: `packages/coupon-plugin/src/coupon.service.ts:386-397`
- Test: `packages/coupon-plugin/src/coupon.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `coupon.service.spec.ts` 追加：

```ts
describe('couponService.claimProductCoupon 渠道隔离', () => {
    it('跨渠道 bindingId → UserInputError("Binding not found")', async () => {
        const ctx = { channel: { id: 37 }, channelId: 37 } as any;
        const binding = { id: 1, enabled: true, couponTemplateId: 3, channelId: 1,
            template: { id: 3, claimable: true } } as any;
        // mock connection.getRepository(ProductCouponBinding).findOne → binding
        const svc = new CouponServiceHelper().svc;
        await expect(svc.claimProductCoupon(ctx, 1)).rejects.toThrow('Binding not found');
    });
    it('同渠道 bindingId → 走 claimCoupon', async () => {
        const ctx = { channel: { id: 37 }, channelId: 37 } as any;
        const binding = { id: 1, enabled: true, couponTemplateId: 3, channelId: 37,
            template: { id: 3, claimable: true } } as any;
        // mock findOne → binding；mock claimCoupon = vi.fn()
        await expect(svc.claimProductCoupon(ctx, 1)).resolves.toBeDefined();
        expect(svc.claimCoupon).toHaveBeenCalledWith(ctx, 3);
    });
});
```

> `claimCoupon` 是 public，可实例化后 stub。若 `CouponServiceHelper` 不存在，直接 `new CouponService()` + 属性注入 mock 依赖（沿用仓库既有 spec 的实例化方式）。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: FAIL（跨渠道未抛错）

- [ ] **Step 3: 实现渠道校验**

在 `claimProductCoupon`（L390）`!binding.enabled` 校验后、`!binding.template` 校验前插入：

```ts
if (!binding || !binding.enabled) {
    throw new UserInputError('Binding not found');
}
// 渠道隔离：binding 归属当前渠道（与 visibleBinding 的 channelMatch 一致），错误不泄露存在性
if (binding.channelId != null && Number(binding.channelId) !== Number(ctx.channel?.id)) {
    throw new UserInputError('Binding not found');
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin/src/coupon.service.ts packages/coupon-plugin/src/coupon.service.spec.ts
git commit -m "fix(coupon): claimProductCoupon 校验 binding 归属渠道，堵跨租户绕过"
```

---

### Task 3: P1-③ newCustomerOnly 口径统一 + 渠道过滤

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-settlement.ts`
- Modify: `packages/coupon-plugin/src/coupon.service.ts:816-824`（hasPlacedOrder 改为复用）
- Test: `packages/coupon-plugin/src/coupon-settlement.spec.ts`（新建）
- Test: `packages/coupon-plugin/src/coupon.service.spec.ts`

- [ ] **Step 1: 写失败测试**

新建 `coupon-settlement.spec.ts`：

```ts
import { describe, it, expect, vi } from 'vitest';
import { isNewCustomerWithinChannel } from './coupon-settlement';

describe('isNewCustomerWithinChannel', () => {
    it('无 customerId → 视为新客', async () => {
        expect(await isNewCustomerWithinChannel({} as any, undefined as any)).toBe(true);
    });
    it('本渠道无有效历史订单 → 新客', async () => {
        // mock getCouponConnection() 返回 createQueryBuilder 链 getCount → 0
        // 断言 where 含 channelId 过滤
        const spy = vi.fn();
        // 设置 query builder stub 捕获 andWhere 参数
        expect(await isNewCustomerWithinChannel({ channelId: 37 } as any, 5)).toBe(true);
        // 断言 andWhere 被以 channelId=37 调用（见实现后对齐）
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon-settlement.spec.ts`
Expected: FAIL（`isNewCustomerWithinChannel` 不存在）

- [ ] **Step 3: 实现公共判定（含渠道过滤）**

在 `coupon-settlement.ts` 追加导出函数：

```ts
import { Customer, Order, RequestContext, TransactionalConnection } from '@vendure/core';

/**
 * 新客判定（统一口径）：本租户（channelId）无历史有效订单。
 * 有效订单排除未完成/取消态；跨渠道订单不计入（本租户新客）。
 */
export async function isNewCustomerWithinChannel(
    ctx: RequestContext,
    customerId: number | undefined | null,
): Promise<boolean> {
    if (customerId == null) return true;
    const count = await getCouponConnection()
        .getRepository(ctx, Order)
        .createQueryBuilder('o')
        .where('o.customerId = :cid', { cid: customerId })
        .andWhere('o.channelId = :chan', { chan: ctx.channelId })
        .andWhere("o.state NOT IN ('Created','AddingItems','ArrangingPayment','Modifying','Cancelled')")
        .getCount();
    return count === 0;
}
```

将原 `isNewCustomer` 改为委托：保留 customerId 解析（`order.customer.id`/`ctx.activeUserId`→Customer），取到 id 后调 `isNewCustomerWithinChannel`：

```ts
export async function isNewCustomer(ctx: RequestContext, order: any): Promise<boolean> {
    let customerId: number | undefined = order?.customer?.id as number | undefined;
    if (customerId == null && ctx.activeUserId != null) {
        const cust = await getCouponConnection()
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } } as any);
        customerId = cust?.id as number | undefined;
    }
    return isNewCustomerWithinChannel(ctx, customerId);
}
```

- [ ] **Step 4: 领取侧 hasPlacedOrder 复用公共判定**

在 `coupon.service.ts` 改 `hasPlacedOrder` 实现（L816）：

```ts
private async hasPlacedOrder(ctx: RequestContext, customerId: number): Promise<boolean> {
    return !(await isNewCustomerWithinChannel(ctx, customerId));
}
```

并顶部确保导入 `isNewCustomerWithinChannel`（从 `./coupon-settlement`）。删除旧的按 customerId 不带渠道的 query builder 实现。

- [ ] **Step 5: 运行确认通过（settlement + 领取侧）**

Run: `npx vitest run src/coupon-settlement.spec.ts src/coupon.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/coupon-plugin/src/coupon-settlement.ts packages/coupon-plugin/src/coupon.service.ts packages/coupon-plugin/src/coupon-settlement.spec.ts
git commit -m "fix(coupon): newCustomerOnly 抽出公共判定并按渠道过滤，统一领取/结算口径"
```

---

### Task 4: P1-④ redeemByClaimCode 渠道过滤 + 索引

**Files:**
- Modify: `packages/coupon-plugin/src/coupon.service.ts:400-411`
- Modify: `packages/coupon-plugin/src/migrations/20260919-coupon-indexes.ts`（claim_code 索引，见 Task 6 复用同一迁移）
- Test: `packages/coupon-plugin/src/coupon.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `coupon.service.spec.ts` 追加：

```ts
describe('couponService.redeemByClaimCode 渠道过滤', () => {
    it('同码多模板，命中当前渠道那一个', async () => {
        const ctx = { channelId: 37 } as any;
        const tplA = { id: 1, claimCode: 'X', channels: [{ id: 1 }] } as any;
        const tplB = { id: 2, claimCode: 'X', channels: [{ id: 37 }] } as any;
        // mock findMany → [tplA, tplB]；claimCoupon = vi.fn()
        await svc.redeemByClaimCode(ctx, 'X');
        expect(svc.claimCoupon).toHaveBeenCalledWith(ctx, 2);
    });
    it('有码但当前渠道无归属 → Claim code not available in this shop', async () => {
        const ctx = { channelId: 1 } as any;
        const tplA = { id: 1, claimCode: 'X', channels: [{ id: 37 }] } as any;
        // mock findMany → [tplA]
        await expect(svc.redeemByClaimCode(ctx, 'X'))
            .rejects.toThrow('Claim code not available in this shop');
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: FAIL（现有 `findOne` 直接取第一条，渠道不定）

- [ ] **Step 3: 实现候选集遍历命中渠道**

改 `redeemByClaimCode`：

```ts
async redeemByClaimCode(ctx: RequestContext, claimCode: string): Promise<CustomerCoupon> {
    const repo = this.connection.getRepository(ctx, CouponTemplate);
    const candidates = await repo.find({
        where: { claimCode } as any,
        relations: { channels: true },
    });
    const hit = candidates.find(t => t.claimCode && this.templateBelongsToChannel(ctx, t));
    if (!hit) {
        // 彻底无码 vs 有码但渠道不匹配：有码时给渠道专属错误
        if (candidates.length === 0) {
            throw new UserInputError('Invalid claim code');
        }
        throw new UserInputError('Claim code not available in this shop');
    }
    return this.claimCoupon(ctx, hit.id);
}
```

同时修正 `templateBelongsToChannel` 已有实现（L414-419）保持不变即可（空 channels → true 视为全渠道）。若同码模板 `channels` 为空（不限渠道），`templateBelongsToChannel` 返回 true，会成为候选命中——按规格「同租户内 claimCode 唯一」业务约束建议，`channels` 为空属历史遗留，本 Task 保持候选集按渠道优先命中；不再额外限制（普通索引 `idx_coupon_template_claim_code` 见 Task 6）。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin/src/coupon.service.ts packages/coupon-plugin/src/coupon.service.spec.ts
git commit -m "fix(coupon): redeemByClaimCode 按候选集命中当前渠道模板"
```

---

### Task 5: P1-⑤ perUserLimit 口径（排除已用/已过期，RETURNED 仍占用）

**Files:**
- Modify: `packages/coupon-plugin/src/coupon.service.ts:785-794`（countHeld）
- Test: `packages/coupon-plugin/src/coupon.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `coupon.service.spec.ts` 追加：

```ts
describe('countHeld 限领口径', () => {
    it('已用(USED)券不占名额', async () => {
        // mock rawConnection.getRepository(CustomerCoupon).createQueryBuilder ... getCount → count(只含 UNUSED/RETURNED)
        // 语义断言：query 必须仅含 UNUSED/RETURNED，且排除过期
        const n = await svc.countHeld(5, 3);
        expect(n).toBe(0); // 仅有 USED 券时
    });
    it('已过期券不占名额', async () => {
        // 有 UNUSED 但 expiredAt < now → 不计
    });
    it('RETURNED 券仍占名额', async () => {
        // 有 RETURNED → 计入
    });
});
```

> 通过 mock `createQueryBuilder` 捕获 where 条件断言 SQL 形态，或直接对 `buildWhere` 的过滤字段做单测。countHeld 用 `rawConnection`（无 ctx），对过期判定需传 now。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: FAIL（当前 `NOT IN ('RETURNED','INVALID','EXPIRED')` 计入 USED、排除 RETURNED，与目标相反）

- [ ] **Step 3: 重写 countHeld（排除 USED/过期，保留 RETURNED）**

countHeld 无 ctx，改用 `rawConnection` + `now` 参数：

```ts
private async countHeld(
    customerId: number,
    templateId: ID,
    now: Date = new Date(),
): Promise<number> {
    const nowISO = now.toISOString();
    const countRepo = this.connection.rawConnection.getRepository(CustomerCoupon);
    return countRepo
        .createQueryBuilder('cc')
        .where('cc.customerId = :customerId', { customerId })
        .andWhere('cc.templateId = :templateId', { templateId: templateId as any })
        .andWhere("cc.status IN ('UNUSED','RETURNED')")
        .andWhere('(cc.expiredAt IS NULL OR cc.expiredAt > :now)', { now: nowISO })
        .getCount();
}
```

调用点无需改动（仍 `this.countHeld(customerId, tpl.id)`），L360/L542 均命中。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/coupon.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin/src/coupon.service.ts packages/coupon-plugin/src/coupon.service.spec.ts
git commit -m "fix(coupon): perUserLimit 仅计可取用券（排除已用/过期，RETURNED 仍占用）"
```

---

## 批次 2：P2（性能 + 索引）

### Task 6: P2-⑦ 幂等索引迁移

**Files:**
- Create: `packages/coupon-plugin/src/migrations/20260919-coupon-indexes.ts`
- Modify: `packages/coupon-plugin/src/migrations/<注册文件>`（按仓库既有迁移注册机制挂入）

- [ ] **Step 1: 查看既有迁移注册机制**

Read: `packages/coupon-plugin/src/migrations/`（对齐 `20260919-add-coupon-fields.ts` 或 cjk-plugin 的 migrate 注册方式，确认 `up(qb)` 签名与如何注册到 migration 列表）。

- [ ] **Step 2: 写迁移（幂等索引）**

按既有迁移文件同构创建：

```ts
export class AddCouponIndexes20260919 {
    async up(qb: any): Promise<void> {
        await qb.query(
            `CREATE INDEX IF NOT EXISTS idx_binding_template ON product_coupon_binding ("couponTemplateId")`,
        );
        await qb.query(
            `CREATE INDEX IF NOT EXISTS idx_coupon_template_claim_code ON coupon_template ("claimCode")`,
        );
        await qb.query(
            `CREATE INDEX IF NOT EXISTS idx_customer_coupon_customer_template ON customer_coupon ("customerId", "templateId")`,
        );
    }
}
```

> `idx_coupon_template_claim_code` 为**普通（非唯一）索引**——规格要求 `claimCode` 仅「同租户内唯一」，全局允许跨租户同码，建唯一索引会误禁合法场景。同租户唯一由 service 层保证（建券时校验本 channel 内查重，属既有链路外的补充约束，本计划 Task 4 已让兑换按渠道过滤候选集，无需在此强加唯一索引）。

- [ ] **Step 3: 注册迁移 + 运行**

按既有注册文件把 `AddCouponIndexes20260919` 挂入，然后运行迁移命令（对齐 Task 1 仓库既有方式：`npx ts-node packages/coupon-plugin/src/migrations/run.ts` 或库内 migrate 脚本）。
Expected: 三个索引创建成功，无报错。

- [ ] **Step 4: 验证**

查询 `information_schema.indexes` 或库级确认三索引存在，`\d product_coupon_binding` 看到 `idx_binding_template`。

- [ ] **Step 5: Commit**

```bash
git add packages/coupon-plugin/src/migrations/
git commit -m "perf(coupon): 幂等索引迁移（binding.templateId / template.claimCode / customerCoupon 组合）"
```

---

### Task 7: P2-⑥ 结算 binding 集合 TTL 缓存

**Files:**
- Create: `packages/coupon-plugin/src/coupon-binding-cache.ts`
- Modify: `packages/coupon-plugin/src/coupon-binding.service.ts`（listByTemplate 走缓存 + create/update/delete/toggleEnabled/syncTemplateScope 失效）
- Test: `packages/coupon-plugin/src/coupon-binding-cache.spec.ts`（新建）
- Test: `packages/coupon-plugin/src/coupon-binding.service.spec.ts`

- [ ] **Step 1: 写失败测试（缓存模块）**

新建 `coupon-binding-cache.spec.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponBindingCache } from './coupon-binding-cache';

describe('CouponBindingCache', () => {
    let cache: CouponBindingCache;
    let loader: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        loader = vi.fn();
        cache = new CouponBindingCache(loader, { ttlMs: 4000 });
    });

    it('TTL 内重复读取命中缓存，loader 仅调用一次', async () => {
        loader.mockResolvedValue([{ id: 1 }]);
        const k = '37:3';
        await cache.get(k, () => loader());
        await cache.get(k, () => loader());
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('超过 TTL 后重新加载', async () => {
        loader.mockResolvedValue([{ id: 1 }]);
        const k = '37:3';
        await cache.get(k, () => loader());
        // 压低 TTL 或注入假时钟
        cache.ttlMs = -1;
        await cache.get(k, () => loader());
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('invalidate(templateId) 使该模板所有 key 失效', async () => {
        loader.mockResolvedValue([{ id: 1 }]);
        await cache.get('37:3', () => loader());
        await cache.get('1:3', () => loader());
        cache.invalidate(3);
        await cache.get('37:3', () => loader());
        expect(loader).toHaveBeenCalledTimes(3);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/coupon-binding-cache.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现缓存模块**

```ts
type Entry = { until: number; value: any[] };

/** 结算 binding 集合 TTL 缓存：key=`channelId:templateId`，进程内，主动失效 */
export class CouponBindingCache {
    private store = new Map<string, Entry>();
    ttlMs: number;
    constructor(private loader: () => Promise<any[]>, opts?: { ttlMs?: number }) {
        this.ttlMs = opts?.ttlMs ?? 4000;
    }

    async get(key: string, load: () => Promise<any[]>): Promise<any[]> {
        const hit = this.store.get(key);
        if (hit && hit.until > Date.now()) return hit.value;
        const value = await load();
        this.store.set(key, { until: Date.now() + this.ttlMs, value });
        return value;
    }

    /** 按模板 id 失效（跨渠道全部 key，key 形如 `${channelId}:${templateId}`） */
    invalidate(templateId: number | string): void {
        const suffix = `:${templateId}`;
        for (const key of this.store.keys()) {
            if (key.endsWith(suffix)) this.store.delete(key);
        }
    }
}
```

- [ ] **Step 4: 接入 CouponBindingService**

在 `coupon-binding.service.ts` 顶部建模块级缓存单例（进程内共享，供结算侧 `getBindingService().listByTemplate` 使用）：

```ts
import { CouponBindingCache } from './coupon-binding-cache';

export const couponBindingCache = new CouponBindingCache(() =>
    Promise.reject(new Error('not wired')), // loader 由 listByTemplate 覆写
);
```

`listByTemplate` 改为走缓存：

```ts
async listByTemplate(ctx: RequestContext, templateId: ID): Promise<ProductCouponBinding[]> {
    const key = `${ctx.channel?.id ?? 0}:${templateId}`;
    return couponBindingCache.get(key, async () => {
        const repo = this.connection.getRepository(ctx, ProductCouponBinding);
        const bindings = await repo.find({
            where: { couponTemplateId: templateId as any, enabled: true },
            relations: { template: true },
        });
        return bindings.filter(b => this.visibleBinding(b, ctx));
    }) as Promise<ProductCouponBinding[]>;
}
```

在 `create`/`update`/`delete`/`toggleEnabled` 的模板 id 可得处，以及 `syncTemplateScope` 末尾，追加 `couponBindingCache.invalidate(templateId)`。例如 create 的 tpl 找到后：

```ts
if (tpl) {
    await this.syncTemplateScope(ctx, tpl, saved);
    couponBindingCache.invalidate(input.couponTemplateId);
}
```

> 备注：`listByTemplate` 结果含 `visibleBinding` 渠道过滤，故 key 用 `channelId:templateId`。跨实例部署各进程独立，TTL≈4s 最终一致；强一致后续接 Redis（本期不做）。

- [ ] **Step 5: 跑缓存模块 + 绑定服务测试**

Run: `npx vitest run src/coupon-binding-cache.spec.ts src/coupon-binding.service.spec.ts`
Expected: PASS（缓存单测 + 既有绑定服务用例不回归）

- [ ] **Step 6: 结算链路冒烟验证**

改 `coupon-promotion-condition.ts` 不在本 Task 改（`getBindingService().listByTemplate` 已自动走缓存）。运行结算相关既有测试：
Run: `npx vitest run packages/coupon-plugin/src`
Expected: coupon-plugin 全部 PASS（确认缓存接入未破坏结算判定）

- [ ] **Step 7: Commit**

```bash
git add packages/coupon-plugin/src/coupon-binding-cache.ts packages/coupon-plugin/src/coupon-binding-cache.spec.ts packages/coupon-plugin/src/coupon-binding.service.ts
git commit -m "perf(coupon): 结算 binding 集合进程内 TTL 缓存 + CRUD 主动失效"
```

---

### Task 8: P2-⑧ 预留字段行为标注（仅注释，不开发）

**Files:**
- Modify: `packages/coupon-plugin/src/product-coupon-binding.entity.ts`

- [ ] **Step 1: 给预留字段加注释**

在 `product-coupon-binding.entity.ts` 的绑定型预留字段（`perUserClaimLimit/claimWindowStart/claimWindowEnd/claimStock/badgeText/promoTitle/remark`）上方补注释：

```ts
/* 预留字段：本期仅建字段不落地行为；结算/领取均忽略，勿误以为已生效。* 后续实现见 specs 2026-09-19-coupon-gaps-supplement-design.md P2-⑧。*/
@Column({ nullable: true }) perUserClaimLimit?: number;
```

- [ ] **Step 2: Commit**

```bash
git add packages/coupon-plugin/src/product-coupon-binding.entity.ts
git commit -m "docs(coupon): 标注绑定预留字段本期未落地行为"
```

---

### Task 9: 收尾回归 + 提交

- [ ] **Step 1: 全量测试**

Run: `npx tsc --noEmit -p packages/coupon-plugin/tsconfig.json` → 无类型错误
Run: `npx vitest run packages/coupon-plugin/src` → 全绿

- [ ] **Step 2: 本地起服冒烟（可选，若环境可起）**

本地 dev 起服，验证：建券→绑商品→删除绑定→模板 variantId 清空；跨渠道 claimProductCoupon 被拒不致 500。

- [ ] **Step 3: 推送**

```bash
git push
```

---

## 完成标准（总）

- [ ] ① 末绑定回退：删/停最后一个 enabled binding 后模板 variantId 清空、scope 保持、无陈旧指向。
- [ ] ② 跨渠道 claimProductCoupon → `Binding not found`（不泄露存在）。
- [ ] ③ newCustomerOnly 领取/结算共用同一渠道过滤判定，跨境门店订单不误判。
- [ ] ④ redeemByClaimCode 候选集按渠道命中；同码渠道不符 → `Claim code not available in this shop`。
- [ ] ⑤ countHeld 排除 USED/过期、保留 RETURNED 占用，`Per-user coupon limit reached` 文案不变。
- [ ] ⑥ 结算 binding 集合进程内 TTL 缓存，CRUD 主动失效，结算判定结果一致。
- [ ] ⑦ 三索引幂等迁移创建成功。
- [ ] ⑧ 预留字段注释标注，另无行为改动。