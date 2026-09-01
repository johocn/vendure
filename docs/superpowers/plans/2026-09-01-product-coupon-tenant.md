# 多租户产品优惠券（补差闭合）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于既有 `coupon-plugin`（已实现满减/折扣/固定面额、限量/限领/一次性、积分兑换、券包/领券），闭合四类差距：免邮券、跨渠道「默认商城含本店商品」可用范围、券多语言、属店权限，并同步 nshop / vshop 两端与 i18n。

**Architecture:** 沿用现有机制——`applyCouponToOrder` 把 `couponCode`+`couponId` 写入 Order 自定义字段，`coupon_applied` 条件 + `coupon_discount` 动作在 `applyPriceAdjustments` 时读取账本打折。跨渠道范围在条件层用「订单行商品 `product.customFields.shopId == 券的 shopId`」判定本店商品行并据此计算折扣基数。前端复用既有券包/领券页，仅补齐新类型展示与多语言。

**Tech Stack:** TypeScript / NestJS / Vendure 3 / TypeORM / GraphQL / Vitest（e2e）；前端 uni-app（vshop）、Nuxt（nshop）、双语言 i18n（zh-CN / en-US）。

**部署铁律：** 本地构建，提交构建产物到 git，服务器 `git pull` + `pm2 restart`；**绝不在服务器构建**。vshop web-admin 走 `scripts/deploy.mjs`（本地 build:h5 → scp → 服务器解压 + nginx reload）。

---
参考规格：`docs/superpowers/specs/2026-09-01-product-coupon-tenant-design.md`。测试命令：`cd packages/coupon-plugin && pnpm e2e`（内部 `cross-env PACKAGE=coupon-plugin vitest --config vitest.config.mts --run`）。既有 e2e：`packages/coupon-plugin/e2e/coupon.e2e-spec.ts`（含 `proceedToArrangingPayment` / `addPaymentToOrder` / `testSuccessfulPaymentMethod` / `assertThrowsWithMessage` 模式，直接复用）。

---

## Phase A：免邮券 FREE_SHIPPING（后端）

### Task A1：`CouponType` 增加 FREE_SHIPPING

**Files:**
- Modify: `packages/coupon-plugin/src/types.ts`

- [ ] **Step 1: 先补测试断言所需的最小改动（类型）**

  Modify `types.ts`，`CouponType` 增加 `FREE_SHIPPING`：

  ```ts
  export type CouponType = 'FIXED' | 'PERCENT' | 'FULL' | 'FREE_SHIPPING';
  ```

- [ ] **Step 2: 同步两处 GraphQL 枚举**

  Modify `packages/coupon-plugin/src/plugin.ts`：admin 与 shop 两处 `enum CouponType { FIXED PERCENT FULL }` 追加 `FREE_SHIPPING`：

  ```graphql
  enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
  ```

- [ ] **Step 3: 本地类型编译校验**

  Run: `cd packages/coupon-plugin && pnpm build`
  Expected: 编译通过（`lib/` 重新生成）。

- [ ] **Step 4: Commit**

  ```bash
  cd packages/coupon-plugin && git add src/types.ts src/plugin.ts && git commit -m "feat(coupon): CouponType 增加 FREE_SHIPPING"
  ```

### Task A2：`coupon_applied` 条件支持 FREE_SHIPPING 折扣额

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-promotion-condition.ts`

- [ ] **Step 1: 写失败测试** — 在 `e2e/coupon.e2e-spec.ts` 末尾追加用例，免邮券折扣额 = 配送费小计：

  ```ts
  it('免邮券：订单选中后折扣额=配送费', async () => {
      const tplId = await createTemplate({
          name: '免邮券',
          type: 'FREE_SHIPPING',
          discountValue: 0,
      });
      const cc = await claim(tplId);
      await resetActiveOrder();
      await addToCart(1);
      await shopClient.query(gql`
          mutation { setShippingMethod(shippingMethodId: "${shippingMethodId}") { ... on Order { id } ... on ErrorResult { errorCode message } } }
      `);
      const applied = await apply(cc.code);
      // discount 为 0 → 免邮未生效，测试失败
      expect(applied.discounts.some((d: any) => d.amountWithTax < 0)).toBe(true);
  });
  ```
  注：需在 `beforeAll` 里取得一个 `shippingMethodId`（复用 `adminClient.query(gql`query{ shippingMethods { items { id } } }`)`）。

- [ ] **Step 2: 运行确认失败**

  Run: `cd packages/coupon-plugin && pnpm e2e`
  Expected: 新用例失败（免邮券走 FIXED/FULL 分支 → discountValue=0 → 折扣 0）。

- [ ] **Step 3: 实现 FREE_SHIPPING 分支**

  在 `couponAppliedCondition.check` 内，`template.type === 'PERCENT'` 分支之后增加：

  ```ts
  if (template.type === 'FREE_SHIPPING') {
      // 免邮券：折扣额 = 符合条件的配送线小计；无配送线则 0
      discountAmount = order.shippingLines
          .filter(l => (l.customFields?.eligibleForCoupon ?? true))
          .reduce((s, l: any) => s + (pricesIncludeTax ? l.shippingPriceWithTax : l.shippingPrice), 0);
  } else {
      discountAmount = Math.max(0, Math.min(template.discountValue, upperBound));
  }
  ```
  将原有 `else` 分支改写为上面的 `else`（PERCENT 分支保持独立返回）。

- [ ] **Step 4: 运行确认通过**

  Run: `cd packages/coupon-plugin && pnpm e2e`
  Expected: 免邮券用例 PASS，既有用例全绿。

- [ ] **Step 5: Commit**

  ```bash
  cd packages/coupon-plugin && git add src/coupon-promotion-condition.ts e2e/coupon.e2e-spec.ts && git commit -m "feat(coupon): 免邮券 FREE_SHIPPING 折扣额=配送小计"
  ```

---

## Phase B：跨渠道「默认商城含本店商品」可用范围（G2）

### Task B1：`CouponTemplate` 记录发行 shopId

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-template.entity.ts`
- Modify: `packages/coupon-plugin/src/coupon.service.ts`

- [ ] **Step 1: 实体加 `shopId`**

  在 `CouponTemplate` 增加：`@Column('bigint', { nullable: true }) shopId?: number;`

- [ ] **Step 2: `createTemplate` 写入发行 shop**

  在 `coupon.service.ts.createTemplate` 内，从 `ctx` 解析发行商并落 `tpl.shopId`（复用 shop-plugin 归属解析：`activeUserId → Administrator.user → Shop.administratorId`；提供 `Shop` repo 按 `administratorId` 查询）：

  ```ts
  if (tpl.shopId == null) {
      const shop = await this.shopRepoByAdministrator(ctx, ctx.activeUserId!);
      tpl.shopId = shop?.id as number | undefined;
  }
  ```
  新增私有方法 `shopRepoByAdministrator`：用 `this.connection.getRepository(ctx, Shop)` 查 `Shop` where `{ administratorId: admin.id }`（admin 由 `Administrator` 按 `ctx.activeUserId` 解析）。若 `Shop`/`member-level` 等可选依赖未注册，回退为 `undefined`（推销 `FULL`/`FIXED` 时不影响）。

- [ ] **Step 3: 运行既有测试确认不回归**

  Run: `cd packages/coupon-plugin && pnpm e2e`
  Expected: 全绿（既有用例不创建 shop，shopId 为 undefined，不影响）。

- [ ] **Step 4: Commit**

  ```bash
  cd packages/coupon-plugin && git add src/coupon-template.entity.ts src/coupon.service.ts && git commit -m "feat(coupon): CouponTemplate 记录发行 shopId(跨渠道范围用)"
  ```

### Task B2：`coupon_applied` 条件按本店商品行计算折扣基数

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-promotion-condition.ts`

- [ ] **Step 1: 写失败测试**（跨渠道：默认商城订单含本店商品行时折扣只作用于本店行；无本店商品行时报 `below scope`）

  在 e2e 追加（用 `testConfig()` 多渠道 fixture，构造 shop 与含 `customFields.shopId` 的产品）：

  ```ts
  it('跨渠道范围：默认商城含本店商品行才可核销，且仅对本店行打折', async () => {
      // 1. 建 shop + 把 variant 的 product.customFields.shopId 指向该 shop
      // 2. 默认商城渠道下，下单含本店行 + 另一家行
      // 3. 选本店券 → 成功，折扣基数为本店行小计
      // 4. 清理本店行后 → 选同券报 COUPON_SCOPE_MISMATCH
  });
  ```
  （沿用 pickup 的属店判据 `Number((l.productVariant?.product?.customFields)?.shopId) === shop.id`。测试内用 adminClient 更新 product 的 `customFields.shopId`，并创建 CouponTemplate 使其 `shopId` 指向该 shop。）

- [ ] **Step 2: 运行确认失败**

  Run: `cd packages/coupon-plugin && pnpm e2e`
  Expected: 新用例失败（条件未做范围判定，仍整单打折）。

- [ ] **Step 3: 实现范围判定 + 行级基数**

  `couponAppliedCondition.check` 中，在读取 `customerCoupon/template` 之后、计算 `base`/`discountAmount` 之前插入：

  ```ts
  const tplShopId = template.shopId as number | undefined;
  const isDefaultChannel = String(ctx.channel.token || '') === '__default__';
  const eligibleLines = isDefaultChannel
      ? (order.lines ?? []).filter((l: any) => {
            const sid = (l.productVariant?.product?.customFields ?? {})?.shopId;
            return tplShopId == null || (sid != null && Number(sid) === tplShopId);
        })
      : (order.lines ?? []);
  if (isDefaultChannel && eligibleLines.length === 0) return { scopeMismatch: true } as any;
  const lineBase = eligibleLines.reduce(
      (s, l: any) => s + (pricesIncludeTax ? l.linePriceWithTax : l.linePrice),
      0,
  );
  ```
  将后续 `base`（minSpend 门槛）、`upperBound`（折扣基数）改用 `lineBase` 代替整单 `subTotalWithTax`。同时给 action 传回的错误语义：当 `scopeMismatch` 时，在 `applyCouponToOrder`（见 B3）抛 `COUPON_SCOPE_MISMATCH`。

- [ ] **Step 4: 运行确认通过**

  Run: `cd packages/coupon-plugin && pnpm e2e`
  Expected: 新用例 PASS，既有用例全绿。

- [ ] **Step 5: Commit**

  ```bash
  cd packages/coupon-plugin && git add src/coupon-promotion-condition.ts e2e/coupon.e2e-spec.ts && git commit -m "feat(coupon): 跨渠道默认商城含本店商品行才打折"
  ```

### Task B3：`applyCouponToOrder` 选券前校验范围 + `couponCentre` 默认商城列出可领租户券

**Files:**
- Modify: `packages/coupon-plugin/src/coupon.service.ts`

- [ ] **Step 1: 写失败测试**（在默认商城直接选一无可核销行的券被拒）

  e2e 追加：默认商城下，对「无本店商品行」的订单 `applyCouponToOrder` 抛 `COUPON_SCOPE_MISMATCH`。

- [ ] **Step 2: 运行确认失败**

  Run: `cd packages/coupon-plugin && pnpm e2e`

- [ ] **Step 3: 实现选券前范围校验**

  在 `applyCouponToOrder` 命中 template 后、写 `couponCode` 前调用私有 `assertInScope(ctx, order, tpl)`：复用 B2 的行级判定，若 `isDefaultChannel && eligibleLines.length === 0` 抛 `UserInputError('COUPON_SCOPE_MISMATCH')`。

  同时扩展 `couponCentre`：默认商城渠道时，除本渠道券外，追加 `channels` 含「其 shopId 对应产品出现在本商城」的租户券（leftJoin `tpl.shopId` → product `customFields.shopId` 存在即列出），并 `enabled`/有效期过滤。

- [ ] **Step 4: 运行确认通过**

  Run: `cd packages/coupon-plugin && pnpm e2e`

- [ ] **Step 5: Commit**

  ```bash
  cd packages/coupon-plugin && git add src/coupon.service.ts e2e/coupon.e2e-spec.ts && git commit -m "feat(coupon): 选券范围校验 SCOPE_MISMATCH + 默认商城领券中心列出本店商品券"
  ```

---

## Phase C：券多语言（G3）

### Task C1：`CouponTemplate.name/description` 改为 LocalizedText

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-template.entity.ts`
- Modify: `packages/coupon-plugin/src/coupon.service.ts`
- Modify: `packages/coupon-plugin/src/plugin.ts`
- Add: `packages/coupon-plugin/src/localize.ts`

- [ ] **Step 1: 新建本地化工具** `src/localize.ts`：

  ```ts
  import { LanguageCode } from '@vendure/core';
  export type LocalizedText = string | Partial<Record<LanguageCode, string>>;
  export function localizeText(v: LocalizedText | undefined, locale: LanguageCode, fallback = ''): string {
      if (!v) return fallback;
      if (typeof v === 'string') return v;
      const byLocale = (v as any)[locale];
      if (byLocale != null) return byLocale;
      const en = (v as any)[LanguageCode.en];
      if (en != null) return en;
      const first = Object.values(v as any).find(x => typeof x === 'string');
      return first ?? fallback;
  }
  ```

- [ ] **Step 2: 实体字段改 JSON**：`name` 与新增 `description` 改为 `@Column({ type: 'varchar', nullable: true }) name: LocalizedText;`（存储 JSON 字符串）；`description?: LocalizedText`。既有种子/老数据兼容：读取时用 `localizeText` 兜底。

- [ ] **Step 3: Service/Resolver 输出本地化**：`coupon.service.ts` 中 `pointsMallExchange` 的 `${tpl.name}` 与 SDL 暴露改为经 `localizeText(name, ctx.languageCode)` 求值；`plugin.ts` SDL 的 `name: String!`、`description` 通过新写解析器（或 service 返回已本地化字段）实现。`CreateCouponTemplateInput.name` 接受 JSON 字符串或逐 `languageCode` 键，`updateTemplate` 白名单同步加 `description`。

- [ ] **Step 4: 写/改测试**：在 e2e 用 `createTemplate({ name: JSON.stringify({ zh_Hans: '满100减20', en: '20 off 100' }) })`，断言 `couponCentre` 在 zh 会话下返回本地化 `name`。

- [ ] **Step 5: 运行 `pnpm e2e`** 全绿后提交。

  ```bash
  cd packages/coupon-plugin && git add src && git commit -m "feat(coupon): 券名称/说明多语言 LocalizedText"
  ```

---

## Phase D：属店权限（G4）

### Task D1：Admin 发券/编辑/统计校验属店

**Files:**
- Modify: `packages/coupon-plugin/src/coupon-admin.resolver.ts`

- [ ] **Step 1: 读现有 resolver**，确认 `couponTemplates`/`createCouponTemplate`/`updateCouponTemplate`/`grantCoupon`/`revokeCustomerCoupon` 调用点。
- [ ] **Step 2: 新增守卫**：在每次 mutation 前，用 `ctx` 解析当前管理员的 shopId（与 B1 的 `shopRepoByAdministrator` 同法），断言目标 CouponTemplate 的 `shopId`（或 `channels`）与该 shop 一致，不一致抛 `ForbiddenError`；`couponTemplates` 查询按 `shopId`/`channels` 过滤，仅返回本店创建的券。
- [ ] **Step 3: 写测试**：两个 admin 各建 shop，A 的 admin 无法 `updateCouponTemplate` B 的券。
- [ ] **Step 4: `pnpm e2e` 全绿后提交**：

  ```bash
  cd packages/coupon-plugin && git add src && git commit -m "feat(coupon): 发券管理按属店权限隔离"
  ```

---

## Phase E：前端对齐（nshop / vshop / web-admin + i18n）

### Task E1：vshop web-admin 发券 Tab 补齐

**Files:**
- Modify: `vshop/web-admin/src/components/product-tabs/ProductBrandMarketingTab.vue`
- i18n：`vshop/web-admin/src/.../zh-CN.ts`、`en-US.ts`（按现有 key 约定补齐）

- [ ] **Step 1:** 读 `ProductBrandMarketingTab.vue`，确认现有的券创建/编辑 UI 与 GraphQL mutation 映射。
- [ ] **Step 2:** 在下拉规则类型加入 `FREE_SHIPPING`（免配送费）；`name`/`description` 输入改为双语言字段（zh-CN / en-US 两个输入框，提交时组装成 `LocalizedText` JSON）。
- [ ] **Step 3:** 保存时透传 `shopId` 已由后端 `createTemplate` 从 ctx 解析，前端无需传。
- [ ] **Step 4:** i18n 字典补充新词条（含错误码 `COUPON_SCOPE_MISMATCH` 中文提示）。
- [ ] **Step 5:** 本地 `npm run build:h5` 通过。

### Task E2：nshop C 端结算选券 / 券包 / 领券中心对齐

**Files:**
- Modify: `nshop/layers/base/app/components/checkout/OrderSummary.vue`
- Modify: `nshop/layers/base/app/composables/useOrderMutation.ts`
- Modify: `nshop/layers/base/app/composables/useOrderStore.ts`（若含领券入口）
- Modify: `nshop/layers/base/app/components/home/jd/JdFunctionGrid.vue`（领券入口，若已是入口则保持）
- i18n：`nshop/layers/base/i18n/locales/zh-CN.ts`、`en-US.ts`（及默认 locale 同步）

- [ ] **Step 1:** 在结算券包选券处支持 FREE_SHIPPING 券展示（图标/文案「免配送费」），并展示多语言券名（券数据来自 `myCoupons` 已本地化字段）。
- [ ] **Step 2:** 确认「我的券包」「领券中心」页存在；无则复用 vshop `coupons.vue` 逻辑在 nshop 补一页（模板按 nshop 既有页面风格）。
- [ ] **Step 3:** 补 i18n 词条（领券中心、券包、状态标签 UNUSED/USED/EXPIRED、`COUPON_SCOPE_MISMATCH` 错误提示、FREE_SHIPPING）。
- [ ] **Step 4:** 本地 `pnpm build` 通过（注意 GraphQL schema 需含 `FREE_SHIPPING`，应从新增后端 schema 重新生成）。

### Task E3：vshop C 端对齐

**Files:**
- Modify: `vshop/src/pkg-order/pages/checkout.vue`
- Modify: `vshop/src/pkg-promotion/pages/coupons.vue`
- Modify: `vshop/src/api/queries/coupon.ts`、`vshop/src/api/mutations/coupon.ts`
- i18n：vshop 对应语言包

- [ ] **Step 1:** 与 nshop 一致支持 FREE_SHIPPING 券展示、多语言券名。
- [ ] **Step 2:** 补 i18n 词条（错误码与新增类型）。
- [ ] **Step 3:** 本地构建通过。

---

## Phase F：回归 / 部署 / 验收

### Task F1：全量回归

- [ ] **Step 1:** 运行后端插件测试：`cd packages/coupon-plugin && pnpm e2e`（全绿）+ 相关 `pickup`/`shop` 插件 e2e 无回归。
- [ ] **Step 2:** `npm run build`/`pnpm build` 本地构建通过（vendure、nshop、vshop、web-admin）。

### Task F2：提交构建产物并部署

- [ ] **Step 1:** 按**部署铁律**将后端 `lib/`（coupon-plugin 编译产物）与本仓库构建产物提交并推送。
- [ ] **Step 2:** 服务器 `git pull && pm2 restart`（vendure）；vshop web-admin 用 `node scripts/deploy.mjs`（本地 build:h5 → scp → 服务器解压 → nginx reload）。**禁止服务器构建。**
- [ ] **Step 3:** Nginx 对 `/guanli/static/manual/` 保持 `no-cache`，图片保留 7 天缓存（沿用既有配置）。

### Task F3：手机视口截图 + 手册

- [ ] **Step 1:** Playwright 手机视口（390×844，dpr=2=780×1688）对 nshop 结算券包、领券中心、vshop C 端券包、web-admin 发券页补截图，存 `d:\zhao\vendure\e2e-shots\`。
- [ ] **Step 2:** 把截图补到运营手册（HTML `vshop/web-admin/src/static/manual/index.html` 新增「优惠券」章节 + MD `doc/多租户使用手册.md` 对应章节），并部署手册。
- [ ] **Step 3:** 更新规格/计划状态为完成，提交文档改动。

---

## Self-Review（针对规格逐条核对）

- G1 免邮 → Task A1/A2 ✓
- G2 跨渠道范围 → Task B1/B2/B3（范围判定、本店行基数、couponCentre、SCOPE_MISMATCH）✓
- G3 多语言 → Task C1（LocalizedText + localizeText）✓
- G4 属店权限 → Task D1 + B1（shopId 归属）✓
- 多端 → Phase E（web-admin / nshop / vshop + i18n）✓
- 账本沿用（无新增）→ 不设任务，回归覆盖 ✓
- 部署/验收 → Phase F ✓

**类型一致性提示：** `COUPON_SCOPE_MISMATCH` 作为 `UserInputError('COUPON_SCOPE_MISMATCH')` 抛出，前后端用该字符串对齐；`CouponType` 枚举后端 TS/GQL 与前端选项一一对应；`LocalizedText` 统一由 `localizeText(v, ctx.languageCode, fallback)` 求值。实现时以本计划为唯一事实来源，勿引入与既有 `coupon-code`/`couponDiscountAction` 冲突的命名。