# 订单查看配送档案过滤 + 新订单语音/横幅提醒 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 受限核销员（VerifyOrder + 非超管）在 web-admin 订单列表看到的数据与统计按其配送档案白名单过滤；登录后台任意页面在 30s 内收到新订单的 TTS 语音播报 + 文字横幅 + 铃铛角标提醒（版式 A），提醒范围与列表过滤口径一致。

**Architecture:** cjk-plugin 新增 `order-scope` 模块（复用 `RedeemScopeService` 白名单判定），提供 `scopedOrders` / `scopedOrderCounts` / `newOrderSignal` 三个 admin-api 查询；web-admin 订单列表页按权限切数据源，`orderAlertHub` 以 DOM 注入方式全局轮询提醒。不做 WebSocket、不做通知落库。

**Tech Stack:** Vendure 3.x + NestJS + TypeORM(Postgres/jsonb)、web-admin = uni-app H5 + Pinia、测试 = vitest（cjk-plugin）+ node:test/tsx（web-admin）。

**规格依据:** `docs/superpowers/specs/2026-10-11-order-scope-and-new-order-alert-design.md`（commit 461bcd648）

---

## 关键事实（探索已核实，实现者必读）

- 受限判定链：`RedeemScopeService.resolve(ctx)`（`packages/cjk-plugin/src/tenant/redeem-scope.service.ts`）按 `ctx.userHasPermissions(['VerifyOrder'])` 判定，白名单 = `TenantMember.shippingProfileIds`（channelId 维度）。**注意：该方法不排除超管**——超管角色拥有全部权限会命中 VerifyOrder，故新服务必须先单独放行 SuperAdmin。
- 范围语义：订单**所有商品行**的 `productVariant.customFields.shippingProfileId` 都须在白名单（任一行空/越界 → 整单排除）；无行订单排除。
- Order 是 ChannelAware：隔离写法 `innerJoin('order.channels', 'ch', 'ch.id = :cid')`（见 `redemption-code.service.ts:507`）。
- 本库 QB 直接写 `order.customFields.xxx`（embedded 列，实测可用，见 redemption-code.service.ts:508）；变体侧用 `pv.customFields.shippingProfileId`。Task 1 的探针步骤验证列存储形态（embedded 列 vs jsonb），二选一后固化。
- 前端过滤语义源：`web-admin/src/utils/orderFilter.ts`（`buildOrderFilter` 产 Vendure 原生 filter；restricted 路径改传**语义入参**，由后端翻译 SQL）。
- web-admin 单测方式：`npx tsx --test src/utils/<file>.test.ts`（node:test，无 vitest）。
- cjk-plugin 单测方式：包目录内 `pnpm test`（vitest）。

---

### Task 0: 后端探针——确认 customFields 列存储形态

**Files:** 无新文件（只读探针，结果写入 Task 1 的常量）

- [ ] **Step 1: 启动 dev-server 后对本地 admin-api 跑一次 introspection 探针**

用 PowerShell 临时 JSON 文件（勿内联引号），向 dev 环境 admin-api 查询 `__type(name:"ProductVariant")` 中 `shippingProfileId` 字段是否存在：

```powershell
Set-Content -Path "$env:TEMP\probe.json" -Encoding utf8 -NoNewline -Value '{"query":"query{__type(name:\"ProductVariant\"){inputFields{name}fields{name}}}"}'
curl.exe -s -X POST http://localhost:3050/admin-api -H "Content-Type: application/json" --data-binary "@$env:TEMP\probe.json"
```

（端口以 dev-server 实际为准；仅确认 schema 有该 customField。）

- [ ] **Step 2: 确认列存储形态**

在 dev Postgres 执行（连接串取 dev-server 配置）：

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_variant' AND column_name LIKE '%shippingProfile%';
```

- 命中 `customFields_shippingProfileId` → **embedded 列形态**，Task 1 谓词用 `pv.customFields.shippingProfileId`（QB 自动映射）。
- 无命中（customFields 为 jsonb）→ **jsonb 形态**，谓词用 raw SQL `pv.customFields->>'shippingProfileId'`。

下文统一用 `PROFILE_PRED` 指代该谓词（embedded: `pv.customFields.shippingProfileId`；jsonb: `pv.customFields->>'shippingProfileId'`），实现时替换一次即可。

---

### Task 1: 后端 OrderScopeService（TDD）

**Files:**
- Create: `packages/cjk-plugin/src/order-scope/order-scope.service.ts`
- Test: `packages/cjk-plugin/src/order-scope/order-scope.service.spec.ts`

- [ ] **Step 1: 写失败的单测**

`order-scope.service.spec.ts`（mock `TransactionalConnection`，风格对齐 `src/tenant/redeem-scope.service.spec.ts`）：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OrderScopeService } from './order-scope.service';

const andWhere = vi.fn().mockReturnThis();
const innerJoin = vi.fn().mockReturnThis();
const orderBy = vi.fn().mockReturnThis();
const skipQb = vi.fn().mockReturnThis();
const takeQb = vi.fn().mockReturnThis();
const setParams = vi.fn().mockReturnThis();
const getRawMany = vi.fn().mockResolvedValue([{ id: 11 }, { id: 12 }]);

const qb: any = {
  andWhere, innerJoin, orderBy, skip: skipQb, take: takeQb,
  setParameters: setParams, getRawMany,
  andWhereIn: undefined,
};

const repo: any = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
const conn: any = { getRepository: vi.fn().mockReturnValue(repo) };
const scopeSvc: any = { resolve: vi.fn().mockResolvedValue({ restricted: true, shippingProfileIds: ['5', '7'] }) };
const ctx: any = { channelId: 3, userHasPermissions: (ps: string[]) => ps.includes('VerifyOrder') };

describe('OrderScopeService', () => {
  it('超管 → 不受限（不叠加档案过滤）', async () => {
    const svc = new OrderScopeService(conn, scopeSvc);
    const s = await svc.resolveScope({ ...ctx, userHasPermissions: () => true } as any);
    expect(s.restricted).toBe(false);
  });

  it('受限 + 空白名单 → 直接 1=0', async () => {
    (scopeSvc.resolve as any).mockResolvedValueOnce({ restricted: true, shippingProfileIds: [] });
    const svc = new OrderScopeService(conn, scopeSvc);
    await svc.scopedOrders(ctx, {}, 20, 0);
    expect(andWhere).toHaveBeenCalledWith('1 = 0');
  });

  it('受限 + 白名单 → 叠加 NOT EXISTS 谓词（含 allow 参数）', async () => {
    andWhere.mockClear();
    const svc = new OrderScopeService(conn, scopeSvc);
    await svc.scopedOrders(ctx, {}, 20, 0);
    const calls = andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((c) => c.includes('NOT EXISTS') && c.includes('PROFILE_PRED_PLACEHOLDER') === false)).toBe(true);
    expect(setParams).toHaveBeenCalled();
  });

  it('newOrderSignal 按 since 过滤并返回 latestPlacedAt', async () => {
    getRawMany.mockResolvedValueOnce([{ cnt: '2', latest: '2026-10-11T08:00:00.000Z' }]);
    const svc = new OrderScopeService(conn, scopeSvc);
    const r = await svc.newOrderSignal(ctx, new Date('2026-10-11T00:00:00.000Z'));
    expect(r).toEqual({ count: 2, latestPlacedAt: '2026-10-11T08:00:00.000Z' });
  });
});
```

（注：谓词字符串以实际实现为准——测试用 `calls.some(c => c.includes('NOT EXISTS'))` 断言，上面含 `PROFILE_PRED_PLACEHOLDER` 的写法仅示意，实现时删掉该子句。）

- [ ] **Step 2: 运行确认失败**

Run: `cd d:\zhao\vendure\packages\cjk-plugin; pnpm test -- src/order-scope`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 OrderScopeService**

`order-scope.service.ts`：

```typescript
import { Injectable } from '@nestjs/common';
import {
    ID, Order, Permission, RequestContext, TransactionalConnection,
} from '@vendure/core';
import { RedeemScope, RedeemScopeService } from '../tenant/redeem-scope.service';

/** 前端语义过滤入参（对应 orderFilter.ts 的 OrderFilterInput，时间为已解析的半开区间） */
export interface ScopedOrderFilter {
    states?: string[];
    /** createdAt >= start（ISO，含） */
    timeStart?: string;
    /** createdAt < end（ISO，不含） */
    timeEnd?: string;
    keyword?: string;
    deliveryType?: string;
    exceptionType?: string;
    exceptionOnly?: boolean;
    afterSales?: string[];
}

export interface ScopedOrderList {
    totalItems: number;
    items: Order[];
}

export interface NewOrderSignal {
    count: number;
    /** 过滤范围内最大 orderPlacedAt（ISO），无单为 null */
    latestPlacedAt: string | null;
}

@Injectable()
export class OrderScopeService {
    constructor(
        private connection: TransactionalConnection,
        private redeemScopeService: RedeemScopeService,
    ) {}

    /** 超管恒不受限；其余复用 RedeemScopeService（VerifyOrder → 白名单） */
    async resolveScope(ctx: RequestContext): Promise<RedeemScope> {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) {
            return { restricted: false, shippingProfileIds: [] };
        }
        return this.redeemScopeService.resolve(ctx);
    }

    /** 受限：叠加「全部行档案 ∈ 白名单」谓词（与 RedeemScopeService.orderInScope 语义一致） */
    private applyScope(ctx: RequestContext, qb: any): Promise<void> {
        return this.resolveScope(ctx).then((scope) => {
            if (!scope.restricted) return;
            const allow = scope.shippingProfileIds.map(String);
            if (!allow.length) {
                qb.andWhere('1 = 0');
                return;
            }
            // PROFILE_PRED 按 Task 0 探针固化（embedded 列 / jsonb 二选一）
            qb.andWhere(
                `EXISTS (SELECT 1 FROM order_line hasl WHERE hasl.orderId = order.id) AND NOT EXISTS (
                    SELECT 1 FROM order_line viol
                    INNER JOIN product_variant pv ON pv.id = viol.productVariantId
                    WHERE viol.orderId = order.id
                      AND (PROFILE_PRED IS NULL OR CAST(PROFILE_PRED AS varchar) NOT IN (:...allow))
                )`,
                { allow },
            );
        });
    }

    private applyFilter(qb: any, f: ScopedOrderFilter): void {
        if (f.states?.length) qb.andWhere('order.state IN (:...states)', { states: f.states });
        if (f.timeStart) qb.andWhere('order.createdAt >= :timeStart', { timeStart: f.timeStart });
        if (f.timeEnd) qb.andWhere('order.createdAt < :timeEnd', { timeEnd: f.timeEnd });
        const kw = (f.keyword || '').trim();
        if (kw) {
            qb.andWhere(
                `(order.code ILIKE :kw OR order.customFields.contactName ILIKE :kw
                  OR order.customFields.contactPhone ILIKE :kw OR order.customFields.remark ILIKE :kw)`,
                { kw: `%${kw}%` },
            );
        }
        if (f.deliveryType) qb.andWhere('order.customFields.deliveryType = :deliveryType', { deliveryType: f.deliveryType });
        if (f.exceptionType) qb.andWhere('order.customFields.exceptionType = :exceptionType', { exceptionType: f.exceptionType });
        else if (f.exceptionOnly) qb.andWhere('order.customFields.exceptionType IS NOT NULL');
        if (f.afterSales?.length) {
            qb.andWhere('order.customFields.afterSalesStatus IN (:...afterSales)', { afterSales: f.afterSales });
        }
    }

    private baseQb(ctx: RequestContext, f: ScopedOrderFilter) {
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId });
        this.applyFilter(qb, f);
        return qb;
    }

    async scopedOrders(ctx: RequestContext, filter: ScopedOrderFilter, take: number, skip: number): Promise<ScopedOrderList> {
        await this.applyScope(ctx, (filter as any).__qb ?? (filter as any)); // 占位防误用，实际见下
        const qb = this.baseQb(ctx, filter);
        await this.applyScope(ctx, qb);
        const totalQb = qb.clone();
        const totalItems = Number((await totalQb.select('COUNT(DISTINCT order.id)', 'cnt').getRawOne())?.cnt ?? 0);
        const qbPage = this.baseQb(ctx, filter);
        await this.applyScope(ctx, qbPage);
        const items = await qbPage
            .orderBy('order.createdAt', 'DESC')
            .skip(skip)
            .take(take)
            .getMany();
        return { totalItems, items };
    }

    /** N 组计数（每条独立 QB，参数互不冲突）；异常向上抛由前端保留旧值 */
    async scopedOrderCounts(ctx: RequestContext, filters: ScopedOrderFilter[]): Promise<number[]> {
        const out: number[] = [];
        for (const f of filters) {
            const qb = this.baseQb(ctx, f);
            await this.applyScope(ctx, qb);
            const row = await qb.select('COUNT(DISTINCT order.id)', 'cnt').getRawOne();
            out.push(Number(row?.cnt ?? 0));
        }
        return out;
    }

    /** 新单信号：since 之后下单数 + 范围内最大 orderPlacedAt */
    async newOrderSignal(ctx: RequestContext, since: Date): Promise<NewOrderSignal> {
        const qb = this.baseQb(ctx, { timeStart: since.toISOString() });
        await this.applyScope(ctx, qb);
        const row = await qb
            .select('COUNT(DISTINCT order.id)', 'cnt')
            .addSelect('MAX(order.orderPlacedAt)', 'latest')
            .getRawOne();
        return {
            count: Number(row?.cnt ?? 0),
            latestPlacedAt: row?.latest ? new Date(row.latest).toISOString() : null,
        };
    }
}
```

实现注意（与上面骨架的差异在写码时落实）：
- `scopedOrders` 里**先建 QB 再 applyScope 一次**即可，不要重复叠加谓词；`totalItems` 与 `items` 各用一次 `clone()`/重建，保证 skip/take 不影响计数。上面骨架中的 `__qb` 占位行删除。
- `innerJoin('order.channels', ...)` 会使 DISTINCT 计数必要——必须 `COUNT(DISTINCT order.id)`。

- [ ] **Step 4: 运行单测通过**

Run: `cd d:\zhao\vendure\packages\cjk-plugin; pnpm test -- src/order-scope`
Expected: PASS（4 个用例）

- [ ] **Step 5: Commit**

```bash
git -C d:\zhao\vendure add packages/cjk-plugin/src/order-scope
git -C d:\zhao\vendure commit -m "feat(order-scope): 配送档案范围订单查询/计数/新单信号服务"
```

---

### Task 2: 后端 Resolver + schema 注册

**Files:**
- Create: `packages/cjk-plugin/src/order-scope/order-scope.resolver.ts`
- Modify: `packages/cjk-plugin/src/plugin.ts`（providers 数组 ~L269、adminApi resolvers 数组 ~L2056、adminApiExtensions.schema ~L2000 附近追加类型）

- [ ] **Step 1: 写 Resolver**

`order-scope.resolver.ts`：

```typescript
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { OrderScopeService, ScopedOrderFilter } from './order-scope.service';

@Resolver()
export class OrderScopeAdminResolver {
    constructor(private orderScopeService: OrderScopeService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async scopedOrders(
        @Ctx() ctx: RequestContext,
        @Args('filter', { nullable: true }) filter?: ScopedOrderFilter,
        @Args('take', { nullable: true, type: () => Number }) take?: number,
        @Args('skip', { nullable: true, type: () => Number }) skip?: number,
    ) {
        return this.orderScopeService.scopedOrders(ctx, filter ?? {}, take ?? 20, skip ?? 0);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async scopedOrderCounts(
        @Ctx() ctx: RequestContext,
        @Args('filters', { nullable: true, type: () => [Object] }) filters?: ScopedOrderFilter[],
    ): Promise<number[]> {
        return this.orderScopeService.scopedOrderCounts(ctx, filters ?? []);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async newOrderSignal(
        @Ctx() ctx: RequestContext,
        @Args('since', { type: () => String }) since: string,
    ) {
        return this.orderScopeService.newOrderSignal(ctx, new Date(since));
    }
}
```

- [ ] **Step 2: plugin.ts 三处注册**

1. import 区（`RedemptionCodeService` import 附近，~L132）：

```typescript
import { OrderScopeService } from './order-scope/order-scope.service';
import { OrderScopeAdminResolver } from './order-scope/order-scope.resolver';
```

2. providers 数组（~L269 `RedemptionCodeService,` 行后）追加 `OrderScopeService,`。
3. adminApi resolvers 数组（~L2056 行尾 `HotelBookingAdminResolver` 后）追加 `OrderScopeAdminResolver`。
4. `adminApiExtensions.schema`（extend type Mutation adjustOrderPrice 块后，~L2053 前）追加：

```graphql
input ScopedOrderFilterInput {
    states: [String!]
    timeStart: String
    timeEnd: String
    keyword: String
    deliveryType: String
    exceptionType: String
    exceptionOnly: Boolean
    afterSales: [String!]
}
type ScopedOrderList { totalItems: Int!, items: [Order!]! }
type NewOrderSignal { count: Int!, latestPlacedAt: DateTime }
extend type Query {
    scopedOrders(filter: ScopedOrderFilterInput, take: Int, skip: Int): ScopedOrderList!
    scopedOrderCounts(filters: [ScopedOrderFilterInput!]): [Int!]!
    newOrderSignal(since: DateTime!): NewOrderSignal!
}
```

- [ ] **Step 3: 构建验证**

Run: `cd d:\zhao\vendure\packages\cjk-plugin; pnpm build`
Expected: 无编译错误（lib 产出含 order-scope）

- [ ] **Step 4: dev 环境实查（受限/不受限双角色）**

以受限核销员令牌（verify 权限角色）请求：

```powershell
Set-Content -Path "$env:TEMP\sig.json" -Encoding utf8 -NoNewline -Value '{"query":"query{newOrderSignal(since:\"2026-01-01T00:00:00.000Z\"){count latestPlacedAt} scopedOrders(take:5){totalItems items{id code}}}"}'
curl.exe -s -X POST http://localhost:3050/admin-api -H "Content-Type: application/json" -H "Cookie: <受限核销员会话Cookie或Authorization头>" --data-binary "@$env:TEMP\sig.json"
```

Expected: `count`/`totalItems` 仅统计白名单内订单（与核销页 pendingPickupOrders 数字口径一致）。

- [ ] **Step 5: Commit**

```bash
git -C d:\zhao\vendure add packages/cjk-plugin/src/order-scope packages/cjk-plugin/src/plugin.ts
git -C d:\zhao\vendure commit -m "feat(order-scope): admin-api 三查询注册（scopedOrders/scopedOrderCounts/newOrderSignal）"
```

---

### Task 3: web-admin API 函数 + 纯函数翻译

**Files:**
- Modify: `web-admin/src/apis/order.ts`（文件尾追加）
- Modify: `web-admin/src/utils/orderFilter.ts`（追加 buildScopedFilter）
- Test: `web-admin/src/utils/orderFilter.scoped.test.ts`

- [ ] **Step 1: 写失败测试 `orderFilter.scoped.test.ts`**

```typescript
// npx tsx --test src/utils/orderFilter.scoped.test.ts
// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildScopedFilter } from './orderFilter';

describe('buildScopedFilter', () => {
  it('空输入 → 空对象', () => {
    assert.deepEqual(buildScopedFilter({}), {});
  });
  it('states/delivery/afterSales 透传，时间解析为半开区间', () => {
    const out = buildScopedFilter({
      states: ['PaymentSettled'],
      delivery: 'pickup',
      afterSales: ['Pending'],
      time: { key: 'today' },
    }, new Date(2026, 9, 11, 12));
    assert.deepEqual(out.states, ['PaymentSettled']);
    assert.equal(out.deliveryType, 'pickup');
    assert.deepEqual(out.afterSales, ['Pending']);
    assert.ok(out.timeStart && out.timeEnd && out.timeStart < out.timeEnd);
  });
  it('exceptionOnly → exceptionType 置空 + exceptionOnly=true', () => {
    const out = buildScopedFilter({ exceptionOnly: true });
    assert.equal(out.exceptionOnly, true);
    assert.equal(out.exceptionType, undefined);
  });
  it('exceptionType 优先于 exceptionOnly', () => {
    const out = buildScopedFilter({ exceptionOnly: true, exceptionType: 'damaged' });
    assert.equal(out.exceptionType, 'damaged');
    assert.equal(out.exceptionOnly, undefined);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd d:\zhao\vshop\web-admin; npx tsx --test src/utils/orderFilter.scoped.test.ts`
Expected: FAIL（buildScopedFilter 未导出）

- [ ] **Step 3: orderFilter.ts 追加实现**

```typescript
/** 后端 ScopedOrderFilterInput 入参（order-scope 模块） */
export interface ScopedFilterOut {
  states?: string[];
  timeStart?: string;
  timeEnd?: string;
  keyword?: string;
  deliveryType?: string;
  exceptionType?: string;
  exceptionOnly?: boolean;
  afterSales?: string[];
}

/** 受限核销员路径：语义条件 → 后端 ScopedOrderFilterInput（时间在后端按 createdAt 比较） */
export function buildScopedFilter(input: OrderFilterInput = {}, now = new Date()): ScopedFilterOut {
  const out: ScopedFilterOut = {};
  if (input.states?.length) out.states = input.states;
  const w = resolveTimeWindow(input.time || {}, now);
  if (w) { out.timeStart = w.start; out.timeEnd = w.end; }
  const kw = (input.keyword || '').trim();
  if (kw) out.keyword = kw;
  if (input.delivery) out.deliveryType = input.delivery;
  if (input.exceptionType) out.exceptionType = input.exceptionType;
  else if (input.exceptionOnly) out.exceptionOnly = true;
  if (input.afterSales?.length) out.afterSales = input.afterSales;
  return out;
}
```

- [ ] **Step 4: apis/order.ts 尾部追加三个函数**

```typescript
// ===== 配送档案范围查询（order-scope 模块，受限核销员使用） =====
export interface ScopedOrderFilterInput {
  states?: string[]; timeStart?: string; timeEnd?: string; keyword?: string;
  deliveryType?: string; exceptionType?: string; exceptionOnly?: boolean; afterSales?: string[];
}

export async function fetchScopedOrders(
  input: { take?: number; skip?: number; filter?: ScopedOrderFilterInput | null } = {},
): Promise<{ totalItems: number; items: OrderRow[] }> {
  const { take = 20, skip = 0, filter } = input;
  const vars: Record<string, any> = { take, skip };
  if (filter && Object.keys(filter).length) vars.filter = filter;
  const { scopedOrders } = await getAdminClient().request<{ scopedOrders: { totalItems: number; items: OrderRow[] } }>(
    `query ScopedOrders($take: Int, $skip: Int, $filter: ScopedOrderFilterInput) {
      scopedOrders(take: $take, skip: $skip, filter: $filter) {
        totalItems
        items {${ORDER_FIELDS}}
      }
    }`,
    vars,
  );
  return { totalItems: scopedOrders.totalItems, items: scopedOrders.items };
}

export async function fetchScopedOrderCounts(filters: ScopedOrderFilterInput[]): Promise<number[]> {
  const { scopedOrderCounts } = await getAdminClient().request<{ scopedOrderCounts: number[] }>(
    `query ScopedOrderCounts($filters: [ScopedOrderFilterInput!]) { scopedOrderCounts(filters: $filters) }`,
    { filters: filters.length ? filters : [{}] },
  );
  return scopedOrderCounts ?? [];
}

export async function fetchNewOrderSignal(since: string): Promise<{ count: number; latestPlacedAt: string | null }> {
  const { newOrderSignal } = await getAdminClient().request<{ newOrderSignal: { count: number; latestPlacedAt: string | null } }>(
    `query NewOrderSignal($since: DateTime!) { newOrderSignal(since: $since) { count latestPlacedAt } }`,
    { since },
  );
  return newOrderSignal;
}
```

- [ ] **Step 5: 测试通过 + Commit**

Run: `cd d:\zhao\vshop\web-admin; npx tsx --test src/utils/orderFilter.scoped.test.ts`
Expected: PASS（4 用例）

```bash
git -C d:\zhao\vshop add src/apis/order.ts src/utils/orderFilter.ts src/utils/orderFilter.scoped.test.ts
git -C d:\zhao\vshop commit -m "feat(order-list): 配送档案范围查询 API 与语义过滤翻译"
```

---

### Task 4: 订单列表页按权限切数据源

**Files:**
- Modify: `web-admin/src/pages/order/list/index.vue`

- [ ] **Step 1: restricted 判定 + 数据源分支**

`<script setup>` 中（`const locale = useLocaleStore();` 后）追加：

```typescript
import { useAuthStore } from '../../../stores/authStore';
import { fetchScopedOrders, fetchScopedOrderCounts, type ScopedOrderFilterInput } from '../../../apis/order';
import { buildScopedFilter } from '../../../utils/orderFilter';

const auth = useAuthStore();
// 受限核销员（与 pickup/redeem、in-store/bills 同一判定模式）
const restricted = computed(() => !auth.isSuperAdmin && auth.permissions.includes('VerifyOrder'));
```

`load()` 的 else（channel）分支改为：

```typescript
    } else if (restricted.value) {
      const { items, totalItems: total } = await fetchScopedOrders({
        take: perPage.value,
        skip: (page.value - 1) * perPage.value,
        filter: currentScopedFilter(),
      });
      if (my !== seq) return;
      totalItems.value = total;
      views.value = items.map(channelToView).filter((v) => !isGhostView(v));
    } else {
      // 原生 fetchOrders 分支保持不变
```

`loadMore()` 内 `fetchOrders` 调用处做同样分支（restricted → fetchScopedOrders + currentScopedFilter()）。

- [ ] **Step 2: 计数分支 + filter 组装**

`currentFilter()` 旁追加：

```typescript
function currentScopedFilter(): ScopedOrderFilterInput | null {
  const f = buildScopedFilter({ ...baseInput(), ...currentTabInput() });
  return Object.keys(f).length ? f : null;
}
```

`loadCounts()` 中：`const filters = [...]` 组装后，请求行改为按权限二选一：

```typescript
    const nums = restricted.value
      ? await fetchScopedOrderCounts(filters.map(toScoped))
      : await fetchOrderCounts(filters);
```

其中模块级辅助（把既有 buildOrderFilter 结果还原为语义入参不可行，故直接从语义源组装）：

```typescript
function toScoped(f: Record<string, any> | null): ScopedOrderFilterInput {
  // loadCounts 的每个 filter 都由 buildOrderFilter(语义) 生成；restricted 路径改为直接传语义源
  return (f as any)?.__scoped ?? (f as any);
}
```

**落实方式（避免双翻译）**：`loadCounts()` 的 5 组 filters 在 restricted 时改为 `buildScopedFilter` 组装——抽取局部函数：

```typescript
    const mk = (inp: OrderFilterInput) => restricted.value
      ? buildScopedFilter(inp)
      : buildOrderFilter(inp);
    const filters = [
      mk({ time: { key: 'today' } }),
      mk({ states: UNPAID_STATES }),
      mk({ states: TO_SHIP_STATES }),
      mk({ afterSales: AFTER_SALES_OPEN }),
      ...tabGroups.value.map((g) => mk({ ...b, ...groupCondition(g.key) })),
    ];
    const nums = restricted.value
      ? await fetchScopedOrderCounts(filters as ScopedOrderFilterInput[])
      : await fetchOrderCounts(filters as Record<string, any>[]);
```

- [ ] **Step 3: 隐藏越权入口 + 档案胶囊**

- scope 强制：`const scope = ref('channel');` 后追加 `watch(restricted, (r) => { if (r) scope.value = 'channel'; }, { immediate: true });`（`watch` 从 vue import）。
- 渲染器传参：`:scopes="restricted ? [] : scopes"`（OrderListScope 空 v-for 自然不渲染）。
- 顶部胶囊（layout-bar 内追加，i18n key 见 Task 6）：

```html
<view v-if="restricted" class="scope-chip">{{ $t('orderAlert.profileScoped') }}</view>
```

样式（页面 style 块追加）：

```scss
.scope-chip {
  display: inline-block;
  margin-left: 16rpx;
  padding: 4rpx 20rpx;
  font-size: 24rpx;
  color: #004d26;
  background: #e5fff2;
  border: 1px dashed #0ab861;
  border-radius: 999rpx;
}
```

- [ ] **Step 4: 手工验证（dev）**

Run: `cd d:\zhao\vshop\web-admin; pnpm dev:h5` 后浏览器 390×844 视口登录受限核销员账号：
Expected: 列表/统计/计数均为白名单内数据；无「渠道单/商品单」切换；顶部显示胶囊。普通管理员视图与现状一致（对照一次）。

- [ ] **Step 5: Commit**

```bash
git -C d:\zhao\vshop add src/pages/order/list/index.vue
git -C d:\zhao\vshop commit -m "feat(order-list): 受限核销员按配送档案过滤订单列表与统计"
```

---

### Task 5: 全局提醒 Hub（orderAlertHub + App.vue）

**Files:**
- Create: `web-admin/src/utils/orderAlertHub.ts`
- Modify: `web-admin/src/App.vue`（onLaunch 一行）
- Modify: `web-admin/src/locale/zh-Hans.json`、`web-admin/src/locale/en.json`

- [ ] **Step 1: i18n 词条（两语言同步）**

`zh-Hans.json` 顶层追加：

```json
"orderAlert": {
  "profileScoped": "已按配送档案过滤",
  "banner": "您有 {n} 笔新订单",
  "bannerOne": "您有 1 笔新订单",
  "view": "查看",
  "voiceOn": "语音播报 开",
  "voiceOff": "语音播报 关",
  "goOrders": "前往订单列表"
}
```

`en.json` 对应：`"profileScoped": "Filtered by delivery profile"`, `"banner": "You have {n} new orders"`, `"bannerOne": "You have 1 new order"`, `"view": "View"`, `"voiceOn": "Voice on"`, `"voiceOff": "Voice off"`, `"goOrders": "Go to orders"`。

- [ ] **Step 2: 实现 orderAlertHub.ts**

```typescript
// 全局新订单提醒 Hub（H5 专用，DOM 注入挂 body，任意页面生效；对齐 h5Nav.ts 模式）
// 轮询 newOrderSignal(30s)：受限核销员按档案白名单口径（后端决定），其余为本店渠道。
// localStorage: orderAlertLastPlacedAt（防刷新重播）、orderAlertMuted（语音开关）
import { useAuthStore } from '../stores/authStore';
import { useLocaleStore } from '../stores/localeStore';
import { fetchNewOrderSignal } from '../apis/order';

const LS_LAST = 'orderAlertLastPlacedAt';
const LS_MUTE = 'orderAlertMuted';
const HIDDEN_ROUTES = new Set(['pages/login/index', 'pages/channel-select/index', 'pages/change-password/index']);
let booted = false;

export function startOrderAlertHub() {
  if (typeof window === 'undefined' || booted || !(window as any).speechSynthesis && !('speechSynthesis' in window) && booted) return;
  if (booted) return;
  booted = true;

  const auth = useAuthStore();
  const locale = useLocaleStore();
  let unread = 0;

  // ---- DOM：顶部横幅 + 右下铃铛角标（版式 A） ----
  const banner = document.createElement('div');
  banner.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%) translateY(-120%);z-index:9999;' +
    'display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #0ab861;border-radius:10px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px 12px;font-size:14px;color:#1a1f2b;' +
    'transition:transform .25s;max-width:92vw;';
  const bell = document.createElement('div');
  bell.setAttribute('role', 'button');
  bell.style.cssText =
    'position:fixed;right:12px;bottom:64px;z-index:9999;width:34px;height:34px;border-radius:50%;' +
    'background:#fff;border:1px solid #d8dee9;box-shadow:0 2px 6px rgba(0,0,0,.14);' +
    'display:none;align-items:center;justify-content:center;font-size:17px;cursor:pointer;';
  bell.innerHTML = '&#128276;<span class="wa-badge" style="position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;' +
    'border-radius:999px;background:#0ab861;color:#fff;font-size:10px;line-height:16px;text-align:center;padding:0 3px;display:none;"></span>';
  const menu = document.createElement('div');
  menu.style.cssText =
    'position:fixed;right:12px;bottom:104px;z-index:9999;width:150px;background:#fff;border:1px solid #e5e8ef;' +
    'border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.16);padding:4px;display:none;flex-direction:column;';
  document.body.appendChild(banner);
  document.body.appendChild(bell);
  document.body.appendChild(menu);

  const badge = () => bell.querySelector('.wa-badge') as HTMLElement;
  function syncMuteItem() {
    const mute = localStorage.getItem(LS_MUTE) === '1';
    menu.innerHTML =
      `<div class="wa-mi" data-act="mute" style="padding:9px 10px;border-radius:8px;font-size:13px;cursor:pointer;">${mute ? locale.t('orderAlert.voiceOff') : locale.t('orderAlert.voiceOn')}</div>` +
      `<div class="wa-mi" data-act="go" style="padding:9px 10px;border-radius:8px;font-size:13px;cursor:pointer;">${locale.t('orderAlert.goOrders')}</div>`;
  }
  syncMuteItem();
  menu.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('.wa-mi') as HTMLElement | null;
    if (!el) return;
    if (el.dataset.act === 'mute') {
      localStorage.setItem(LS_MUTE, localStorage.getItem(LS_MUTE) === '1' ? '0' : '1');
      syncMuteItem();
    } else {
      setMenu(false);
      uni.navigateTo({ url: '/pages/order/list/index' });
    }
  });
  bell.addEventListener('click', () => setMenu(menu.style.display === 'none'));
  document.addEventListener('click', (e) => {
    if (!bell.contains(e.target as Node) && !menu.contains(e.target as Node)) setMenu(false);
  });
  function setMenu(open: boolean) { menu.style.display = open ? 'flex' : 'none'; }

  function showBanner(n: number) {
    const t = locale.t('orderAlert.banner').replace('{n}', String(n));
    banner.innerHTML =
      `<span style="flex:1">${n > 1 ? t : locale.t('orderAlert.bannerOne')}</span>` +
      `<span class="wa-view" style="color:#fff;background:#0ab861;border-radius:999px;padding:3px 12px;cursor:pointer;flex-shrink:0;">${locale.t('orderAlert.view')}</span>` +
      `<span class="wa-x" style="color:#6a7480;cursor:pointer;flex-shrink:0;">&#10005;</span>`;
    banner.querySelector('.wa-view')!.addEventListener('click', () => {
      hideBanner();
      uni.navigateTo({ url: '/pages/order/list/index' });
    });
    banner.querySelector('.wa-x')!.addEventListener('click', hideBanner);
    banner.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(hideBanner, 8000);
  }
  function hideBanner() { banner.style.transform = 'translateX(-50%) translateY(-120%)'; }

  function speak() {
    if (localStorage.getItem(LS_MUTE) === '1') return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance('您有新的订单，请及时处理');
      u.lang = 'zh-CN';
      u.rate = 1;
      synth.speak(u);
    } catch { /* TTS 不可用 → 仅横幅 */ }
  }

  // 首次交互预解锁 TTS（自动播放策略）
  const unlock = () => {
    try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance(' ')); } catch { /* noop */ }
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });

  function setUnread(n: number) {
    unread = n;
    const b = badge();
    if (!b) return;
    b.textContent = String(n);
    b.style.display = n > 0 ? 'block' : 'none';
  }

  // ---- 轮询 ----
  async function tick() {
    const pages = (globalThis as any).getCurrentPages?.() ?? [];
    const route = pages[pages.length - 1]?.route || '';
    if (!auth.isAuthed || HIDDEN_ROUTES.has(route)) {
      bell.style.display = 'none';
      hideBanner();
      return;
    }
    bell.style.display = 'flex';
    try {
      const last = localStorage.getItem(LS_LAST);
      const since = last || new Date(Date.now() - 30_000).toISOString();
      const sig = await fetchNewOrderSignal(since);
      if (sig.latestPlacedAt) {
        if (last && sig.latestPlacedAt > last && sig.count > 0) {
          setUnread(unread + sig.count);
          showBanner(sig.count);
          speak();
        }
        localStorage.setItem(LS_LAST, sig.latestPlacedAt);
      }
    } catch { /* 静默重试下一轮 */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  tick();
  setInterval(tick, 30_000);
}
```

实现注意：
- `locale.t` 若不支持 `{n}` 占位，直接用已写的 replace 方案（banner 文案分 bannerOne/banner 两键，t 出来后 replace）。
- 首轮（无 LS_LAST）：只记 baseline 不提醒（since=30s 前兜底，count 通常 0；即便非 0，`last` 为空分支不触发提醒）。
- 启动守卫第一行是冗余的三元表达式——写码时简化为 `if (typeof window === 'undefined' || booted) return;`。

- [ ] **Step 3: App.vue 启动**

`App.vue` onLaunch 内（`enableH5Nav` 调用后）追加：

```typescript
    // 全局新订单提醒（H5）：登录态由 Hub 每 tick 自检，登录/登出动态生效
    startOrderAlertHub();
```

import 区追加 `import { startOrderAlertHub } from './utils/orderAlertHub';`

- [ ] **Step 4: 手工验证**

dev 起前后端，登录后台任意页（如数据看板），用 C 端下真单：
Expected: ≤30s 横幅滑入 + 语音播报 + 铃铛角标 +N；横幅「查看」跳订单列表；铃铛菜单可关语音（刷新后仍关）；刷新页面不重播旧单；登出后横幅/铃铛隐藏。

- [ ] **Step 5: Commit**

```bash
git -C d:\zhao\vshop add src/utils/orderAlertHub.ts src/App.vue src/locale/zh-Hans.json src/locale/en.json
git -C d:\zhao\vshop commit -m "feat(alert): 全局新订单语音播报+横幅+铃铛角标提醒（轮询 30s）"
```

---

### Task 6: 验收——截图 + 手册 + 回归

**Files:**
- Modify: `web-admin/src/static/manual/`（操作手册页，按既有手册文件结构追加章节）

- [ ] **Step 1: 手机视口截图（硬规范 390×844 dpr=2）**

Playwright 截取并存 `src/static/manual/shots/`：
1. `orderlist_profile_scoped_390.png` —— 受限核销员订单列表（胶囊+过滤后数据）
2. `order_alert_banner_390.png` —— 新订单横幅+铃铛角标
3. `order_alert_menu_390.png` —— 铃铛菜单（语音开关）
4. 桌面 1440 宽对照图 `orderlist_profile_scoped_1440.png`

- [ ] **Step 2: 操作手册追加章节**（受限核销员列表口径说明 + 提醒使用说明 + 静音开关 + 截图引用）

- [ ] **Step 3: 回归清单（逐项实测）**

- 核销四入口（pendingPickupOrders/redemptionLookup/claim/reissue）行为不变
- 普通管理员订单列表（渠道单/商品单切换、tab 计数、筛选）不变
- in-store/bills 受限口径不变
- 未登录/登录页无提醒 DOM 残留

- [ ] **Step 4: 收尾提交 + 部署（一气呵成）**

```bash
git -C d:\zhao\vshop add src/static/manual
git -C d:\zhao\vshop commit -m "docs(manual): 配送档案过滤与新订单提醒操作手册+截图"
```

部署（本地构建，服务器只解压/restart）：
- vendure 后端：`cd d:\zhao\vendure; pnpm build`（如 monorepo 构建脚本不同以实际为准）→ 按既有 git pull + pm2 restart 机制发布
- web-admin：`cd d:\zhao\vshop\web-admin; pnpm build:h5` → `node scripts/deploy.mjs`（以仓库实际部署脚本为准）

---

## Self-Review 记录

- 规格覆盖：§3.1→Task1/2；§3.2→Task3/4；§4.1→Task2（newOrderSignal）；§4.2→Task3/5；§5 边界→Task1(空白名单/1=0)、Task5(静默重试/TTS降级/baseline不重播/登出隐藏)；§6→Task6；§7 不做项未引入。✓
- 占位符：PROFILE_PRED 为**显式二选一探针结果**（Task 0 给出两种确切写法），非 TBD。✓
- 类型一致：`ScopedOrderFilter`（service）↔ `ScopedOrderFilterInput`（schema/前端）字段名一致；`fetchScopedOrderCounts` 返回 `number[]` ↔ schema `[Int!]!`。✓
- 已知取舍：`scopedOrders` totalItems 与 items 两次建 QB（含子查询）成本可接受（受限核销员订单量级小）；多标签页不去重（spec §7）。
