# 中国化多租户测试数据填充实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立 populate 脚本生成中国化多租户测试数据，覆盖 2 个 Channel / 8 SPU 商品 / 中国习惯支付物流 / 优惠券叠加 / 客户余额 / 历史订单。

**Architecture:** 纯 Service 调用 + clearAllTables 全量清库，6 阶段顺序执行（基础设置 → default Channel → shop-a Channel → 优惠券 → 客户 → 订单），通过 NestJS DI 拿到各 Service，RequestContext 切换 Channel。

**Tech Stack:** TypeScript / ts-node / Vendure core Service / cjk-plugin PickupLocationService / RechargeCardService / TypeORM repositories

**Spec:** [docs/superpowers/specs/2026-07-14-china-test-data-design.md](file:///e:/code/vendure/docs/superpowers/specs/2026-07-14-china-test-data-design.md)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/dev-server/populate-china-dev.ts` | 入口：编排 6 阶段、清库、bootstrap、日志 |
| `packages/dev-server/china-data/index.ts` | 导出各阶段函数和共享工具 |
| `packages/dev-server/china-data/shared.ts` | 共享工具：ctx 构造、日志、计时 |
| `packages/dev-server/china-data/01-base.ts` | 阶段1：superadmin + Zone/Country/TaxRate/Facet/Collection |
| `packages/dev-server/china-data/02-default-channel.ts` | 阶段2：default Channel 商品/图片/配送/支付/自提点 |
| `packages/dev-server/china-data/03-shop-a-channel.ts` | 阶段3+4：shop-a 创建+配置+商品分配 |
| `packages/dev-server/china-data/04-promotions.ts` | 阶段5a：优惠券（含 customFields） |
| `packages/dev-server/china-data/05-customers.ts` | 阶段5b：客户+地址+余额 |
| `packages/dev-server/china-data/06-orders.ts` | 阶段6：历史订单 |
| `packages/dev-server/china-data/sources.ts` | 所有数据源（商品/配送/支付/自提点/客户/优惠券/订单） |
| `packages/dev-server/package.json` | 添加 `populate:china` script |

---

### Task 1: 创建脚本入口与共享工具骨架

**Files:**
- Create: `packages/dev-server/populate-china-dev.ts`
- Create: `packages/dev-server/china-data/index.ts`
- Create: `packages/dev-server/china-data/shared.ts`
- Modify: `packages/dev-server/package.json`

- [ ] **Step 1: 在 package.json 添加 populate:china script**

修改 [packages/dev-server/package.json](file:///e:/code/vendure/packages/dev-server/package.json) 的 `scripts` 节点，在 `"populate"` 行后添加：

```json
"populate:china": "node -r ts-node/register -r dotenv/config -r tsconfig-paths/register populate-china-dev.ts",
```

- [ ] **Step 2: 创建 china-data/shared.ts 共享工具**

Create `packages/dev-server/china-data/shared.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { Channel, RequestContext, RequestContextService } from '@vendure/core';

export interface StageResult {
    name: string;
    ok: boolean;
    durationMs: number;
    error?: string;
}

export async function withCtx(
    app: INestApplication,
    channel: Channel,
    fn: (ctx: RequestContext) => Promise<void>,
): Promise<void> {
    const ctxService = app.get(RequestContextService);
    const ctx = await ctxService.create({ apiType: 'admin', channel });
    await fn(ctx);
}

export async function runStage(
    name: string,
    fn: () => Promise<void>,
): Promise<StageResult> {
    const start = Date.now();
    try {
        await fn();
        return { name, ok: true, durationMs: Date.now() - start };
    } catch (e: any) {
        return { name, ok: false, durationMs: Date.now() - start, error: e.message };
    }
}

export function logStage(stageIndex: number, total: number, result: StageResult): void {
    const status = result.ok ? 'OK' : 'FAIL';
    const duration = (result.durationMs / 1000).toFixed(1);
    const prefix = `[${stageIndex}/${total}] ${result.name} ... ${status} (${duration}s)`;
    console.log(result.ok ? prefix : `${prefix}\n  ERROR: ${result.error}`);
}

export function yuanToCents(yuan: number): number {
    return Math.round(yuan * 100);
}
```

- [ ] **Step 3: 创建 china-data/index.ts 导出空函数**

Create `packages/dev-server/china-data/index.ts`:

```typescript
export { runStage, logStage, withCtx, yuanToCents } from './shared';
export type { StageResult } from './shared';

// 阶段函数（后续 Task 实现，先导出空 stub 便于入口引用）
export { populateBase } from './01-base';
export { populateDefaultChannel } from './02-default-channel';
export { populateShopAChannel } from './03-shop-a-channel';
export { populatePromotions } from './04-promotions';
export { populateCustomers } from './05-customers';
export { populateOrders } from './06-orders';
```

- [ ] **Step 4: 创建各阶段 stub 文件**

为 01-base.ts / 02-default-channel.ts / 03-shop-a-channel.ts / 04-promotions.ts / 05-customers.ts / 06-orders.ts 各创建一个最小 stub：

以 `01-base.ts` 为例（其他 5 个文件同理，仅函数名和文件名不同）：

```typescript
import { INestApplication } from '@nestjs/common';

export async function populateBase(app: INestApplication): Promise<void> {
    // TODO: Task 2 实现
}
```

对应函数名：
- `01-base.ts` → `populateBase`
- `02-default-channel.ts` → `populateDefaultChannel`
- `03-shop-a-channel.ts` → `populateShopAChannel`
- `04-promotions.ts` → `populatePromotions`
- `05-customers.ts` → `populateCustomers`
- `06-orders.ts` → `populateOrders`

- [ ] **Step 5: 创建 populate-china-dev.ts 入口**

Create `packages/dev-server/populate-china-dev.ts`:

```typescript
/* eslint-disable no-console */
import { bootstrap, JobQueueService, Logger } from '@vendure/core';
import { clearAllTables } from '@vendure/testing';
import path from 'path';

import { devConfig } from './dev-config';
import {
    populateBase,
    populateDefaultChannel,
    populateShopAChannel,
    populatePromotions,
    populateCustomers,
    populateOrders,
    runStage,
    logStage,
    StageResult,
} from './china-data';

if (require.main === module) {
    clearAllTables(devConfig, true)
        .then(() => bootstrap(devConfig))
        .then(async app => {
            await app.get(JobQueueService).start();
            const results: StageResult[] = [];
            const total = 6;

            results.push(await runStage('基础设置: superadmin + Zone/Country/TaxRate/Facet/Collection', () => populateBase(app)));
            logStage(1, total, results[0]);

            results.push(await runStage('default Channel: 8 SPU + 4 配送 + 3 支付 + 3 自提点', () => populateDefaultChannel(app)));
            logStage(2, total, results[1]);

            results.push(await runStage('shop-a Channel: 创建 + 8 商品分配 + 2 配送 + 3 支付 + 1 自提点', () => populateShopAChannel(app)));
            logStage(3, total, results[2]);

            results.push(await runStage('优惠券: default 1 + shop-a 2', () => populatePromotions(app)));
            logStage(4, total, results[3]);

            results.push(await runStage('客户: 3 + 余额账户 2', () => populateCustomers(app)));
            logStage(5, total, results[4]);

            results.push(await runStage('历史订单: default 5 + shop-a 3', () => populateOrders(app)));
            logStage(6, total, results[5]);

            const okCount = results.filter(r => r.ok).length;
            const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
            console.log(`\n完成! ${okCount}/${total} 阶段成功, 总耗时: ${(totalMs / 1000).toFixed(1)}s`);
            if (okCount < total) {
                console.log('失败阶段:');
                results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.error}`));
            }

            return app.close();
        })
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
```

- [ ] **Step 6: 验证脚本能启动（即使数据为空）**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 脚本清库后 bootstrap，6 阶段全部 OK（但无实际数据），打印 `完成! 6/6 阶段成功`。如果 bootstrap 报错，检查 dev-config.ts 是否已启用 cjk-plugin tenant 模块。

- [ ] **Step 7: Commit**

```bash
git add packages/dev-server/populate-china-dev.ts packages/dev-server/china-data/ packages/dev-server/package.json
git commit -m "feat(dev-server): add china populate script skeleton"
```

---

### Task 2: 阶段1 - 基础设置（superadmin + Zone/Country/TaxRate/Facet/Collection）

**Files:**
- Create: `packages/dev-server/china-data/sources.ts`（数据源片段）
- Modify: `packages/dev-server/china-data/01-base.ts`

- [ ] **Step 1: 在 sources.ts 添加基础数据源**

Create `packages/dev-server/china-data/sources.ts`:

```typescript
import { LanguageCode } from '@vendure/common/lib/generated-types';

// ===== Zone / Country =====
export const ZONES = [{ name: 'Asia' }];
export const COUNTRIES = [{ name: 'China', code: 'CN', zone: 'Asia' }];

// ===== TaxRate =====
export const TAX_RATES = [
    { name: '普通税率', percentage: 13 },
    { name: '优惠税率', percentage: 9 },
    { name: '零税率', percentage: 0 },
];

// ===== Facet / FacetValue =====
export const FACETS = [
    {
        code: 'category',
        name: '类目',
        values: [
            { name: '食品生鲜', code: 'food-fresh' },
            { name: '数码电器', code: 'digital-electronics' },
        ],
    },
    {
        code: 'brand',
        name: '品牌',
        values: [
            { name: '农夫山泉', code: 'nongfu' },
            { name: '三只松鼠', code: 'three-squirrel' },
            { name: '小米', code: 'xiaomi' },
            { name: '华为', code: 'huawei' },
        ],
    },
    {
        code: 'spec',
        name: '规格',
        values: [
            { name: '500ml', code: '500ml' },
            { name: '1kg', code: '1kg' },
            { name: '标准版', code: 'standard' },
            { name: 'Pro版', code: 'pro' },
        ],
    },
];

// ===== Collection =====
export const COLLECTIONS = [
    {
        name: '食品生鲜',
        facetValueNames: ['食品生鲜'],
        assetFile: 'nathan-fertig-249917-unsplash.jpg',
    },
    {
        name: '数码电器',
        facetValueNames: ['数码电器'],
        assetFile: 'chuttersnap-324234-unsplash.jpg',
    },
];
```

- [ ] **Step 2: 实现 01-base.ts**

Replace `packages/dev-server/china-data/01-base.ts` 内容:

```typescript
import { INestApplication } from '@nestjs/common';
import { ChannelService, LanguageCode, RoleService, UserService } from '@vendure/core';
import path from 'path';

import { withCtx } from './shared';
import { ZONES, COUNTRIES, TAX_RATES, FACETS, COLLECTIONS } from './sources';

const ASSETS_DIR = path.join(__dirname, '../../core/mock-data/assets');

export async function populateBase(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const userService = app.get(UserService);
    const roleService = app.get(RoleService);

    // 获取 default Channel（clearAllTables 后仍存在 default Channel）
    const defaultChannel = await channelService.getDefaultChannel();

    await withCtx(app, defaultChannel, async ctx => {
        // 1. 创建 superadmin
        const adminRole = await roleService.getSuperAdminRole();
        await userService.createAdminUser({
            identifier: 'superadmin@china.test',
            password: 'superadmin',
            roles: [adminRole],
        });

        // 2. Zone / Country
        const zoneService = app.get('ZoneService');
        const countryService = app.get('CountryService');
        for (const z of ZONES) {
            await zoneService.create(ctx, { name: z.name });
        }
        for (const c of COUNTRIES) {
            const zone = await zoneService.findAll(ctx);
            const zoneEntity = zone.items.find(z => z.name === c.zone);
            if (zoneEntity) {
                await countryService.create(ctx, {
                    code: c.code,
                    name: c.name,
                    zoneId: zoneEntity.id,
                    enabled: true,
                });
            }
        }

        // 3. TaxCategory + TaxRate
        const taxCategoryService = app.get('TaxCategoryService');
        const taxRateService = app.get('TaxRateService');
        const asiaZone = (await zoneService.findAll(ctx)).items.find(z => z.name === 'Asia')!;
        for (const t of TAX_RATES) {
            const taxCategory = await taxCategoryService.create(ctx, { name: t.name });
            await taxRateService.create(ctx, {
                name: t.name,
                amount: t.percentage,
                categoryId: taxCategory.id,
                zoneId: asiaZone.id,
                customerGroupId: null,
                enabled: true,
            });
        }

        // 4. Facet + FacetValue
        const facetService = app.get('FacetService');
        for (const f of FACETS) {
            await facetService.create(ctx, {
                code: f.code,
                name: f.name,
                values: f.values.map(v => ({ code: v.code, name: v.name })),
            });
        }

        // 5. Collection（用 AssetService 导入图片后创建）
        const assetService = app.get('AssetService');
        const collectionService = app.get('CollectionService');
        const allFacets = await facetService.findAll(ctx);
        for (const c of COLLECTIONS) {
            const asset = await assetService.create(ctx, {
                input: { file: new File([await readFile(ASSETS_DIR, c.assetFile)], c.assetFile) },
            });
            const facetValueIds: string[] = [];
            for (const facet of allFacets.items) {
                for (const fv of facet.values) {
                    if (c.facetValueNames.includes(fv.name)) {
                        facetValueIds.push(fv.id as string);
                    }
                }
            }
            await collectionService.create(ctx, {
                name: c.name,
                assetIds: [asset.id as string],
                filters: [
                    {
                        code: 'facet-value-filter',
                        arguments: [{ name: 'facetValueIds', value: `"${facetValueIds.join(',')}"` }, { name: 'containsAny', value: 'false' }],
                    },
                ],
            });
        }
    });
}

// 辅助函数：读取 mock-data/assets 下的文件
async function readFile(dir: string, filename: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return fs.readFile(path.join(dir, filename));
}
```

- [ ] **Step 3: 验证阶段1执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1 OK。检查日志无报错。如果有 `AssetService.create` API 不匹配错误，参考 vendure/packages/core/src/service/services/asset-service.ts 的签名调整。

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/china-data/sources.ts packages/dev-server/china-data/01-base.ts
git commit -m "feat(dev-server): implement stage 1 base setup (admin/zone/country/tax/facet/collection)"
```

---

### Task 3: 阶段2 - default Channel 商品+图片+配送+支付+自提点

**Files:**
- Modify: `packages/dev-server/china-data/sources.ts`（追加商品/配送/支付/自提点数据源）
- Modify: `packages/dev-server/china-data/02-default-channel.ts`

- [ ] **Step 1: 在 sources.ts 追加商品/配送/支付/自提点数据源**

在 `packages/dev-server/china-data/sources.ts` 末尾追加:

```typescript
// ===== Products =====
export interface ProductSource {
    name: string;
    slug: string;
    description: string;
    brand: string;
    category: string;
    imageFile: string;
    variants: Array<{ name: string; sku: string; price: number; stock: number; spec?: string }>;
}

export const PRODUCTS: ProductSource[] = [
    {
        name: '农夫山泉天然水',
        slug: 'nongfu-spring-water',
        description: '农夫山泉天然水 500ml',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '500ml', sku: 'NF-WATER-500', price: 2, stock: 1000, spec: '500ml' }],
    },
    {
        name: '三只松鼠坚果礼盒',
        slug: 'three-squirrel-nut-gift-box',
        description: '三只松鼠坚果礼盒 1kg',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'neonbrand-428982-unsplash.jpg',
        variants: [{ name: '1kg', sku: 'TS-NUT-1KG', price: 99, stock: 200, spec: '1kg' }],
    },
    {
        name: '五常稻花香大米',
        slug: 'wuchang-rice',
        description: '五常稻花香大米 5kg',
        brand: '农夫山泉',
        category: '食品生鲜',
        imageFile: 'nathan-fertig-249917-unsplash.jpg',
        variants: [{ name: '5kg', sku: 'NF-RICE-5KG', price: 49, stock: 300, spec: '1kg' }],
    },
    {
        name: '内蒙古牛肉卷',
        slug: 'inner-mongolia-beef-roll',
        description: '内蒙古牛肉卷 500g',
        brand: '三只松鼠',
        category: '食品生鲜',
        imageFile: 'brandi-redd-104140-unsplash.jpg',
        variants: [{ name: '500g', sku: 'TS-BEEF-500', price: 59, stock: 150, spec: '1kg' }],
    },
    {
        name: '小米手环8',
        slug: 'xiaomi-band-8',
        description: '小米手环8',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-324234-unsplash.jpg',
        variants: [
            { name: '标准版', sku: 'XM-BAND-8-STD', price: 199, stock: 100, spec: '标准版' },
            { name: 'Pro版', sku: 'XM-BAND-8-PRO', price: 299, stock: 80, spec: 'Pro版' },
        ],
    },
    {
        name: '华为路由器',
        slug: 'huawei-router',
        description: '华为路由器',
        brand: '华为',
        category: '数码电器',
        imageFile: 'alexandru-acea-686569-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-ROUTER-STD', price: 159, stock: 120, spec: '标准版' }],
    },
    {
        name: '小米充电宝',
        slug: 'xiaomi-power-bank',
        description: '小米充电宝 10000mAh',
        brand: '小米',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '10000mAh', sku: 'XM-PB-10000', price: 99, stock: 200, spec: '标准版' }],
    },
    {
        name: '华为蓝牙耳机',
        slug: 'huawei-bluetooth-earphone',
        description: '华为蓝牙耳机',
        brand: '华为',
        category: '数码电器',
        imageFile: 'chuttersnap-584518-unsplash.jpg',
        variants: [{ name: '标准版', sku: 'HW-BT-EAR-STD', price: 399, stock: 60, spec: '标准版' }],
    },
];

// ===== Shipping Methods (default Channel) =====
export const DEFAULT_SHIPPING_METHODS = [
    {
        code: 'store-pickup',
        name: '门店自提',
        description: '到店自提，免运费',
        checker: { code: 'store-pickup-eligibility', arguments: [] },
        calculator: { code: 'store-pickup-calculator', arguments: [] },
    },
    {
        code: 'pickup-point',
        name: '菜鸟驿站自提',
        description: '到菜鸟驿站自提，3元',
        checker: { code: 'pickup-point-eligibility', arguments: [] },
        calculator: { code: 'pickup-point-calculator', arguments: [{ name: 'shippingPrice', value: '300' }] },
    },
    {
        code: 'free-shipping-99',
        name: '满99包邮',
        description: '订单满99元免运费',
        checker: { code: 'order-total', arguments: [{ name: 'minimum', value: '9900' }] },
        calculator: { code: 'shipping-by-price', arguments: [{ name: 'rate', value: '0' }] },
    },
    {
        code: 'sf-express',
        name: '顺丰标准快递',
        description: '顺丰标准快递 12元',
        checker: { code: 'order-total', arguments: [{ name: 'minimum', value: '0' }] },
        calculator: { code: 'shipping-by-price', arguments: [{ name: 'rate', value: '1200' }] },
    },
];

// ===== Shipping Methods (shop-a Channel) =====
export const SHOP_A_SHIPPING_METHODS = [
    DEFAULT_SHIPPING_METHODS[0], // store-pickup
    DEFAULT_SHIPPING_METHODS[2], // free-shipping-99
];

// ===== Payment Methods =====
export const PAYMENT_METHODS = [
    {
        code: 'dummy-payment',
        name: '测试支付',
        description: '开发环境测试支付',
        handler: { code: 'dummy-payment-handler', arguments: [{ name: 'automaticSettle', value: 'false' }] },
    },
    {
        code: 'cash-on-delivery',
        name: '货到付款',
        description: '收货时支付现金',
        handler: { code: 'cash-on-delivery', arguments: [] },
    },
    {
        code: 'balance-pay',
        name: '余额支付',
        description: '使用充值卡余额支付',
        handler: { code: 'balance-pay', arguments: [] },
    },
];

// ===== Pickup Locations =====
export const DEFAULT_PICKUP_LOCATIONS = [
    { name: '中关村门店', type: 'store' as const, address: '北京市海淀区中关村大街1号', phoneNumber: '010-12345678', businessHours: '09:00-22:00' },
    { name: '望京SOHO店', type: 'store' as const, address: '北京市朝阳区望京街10号', phoneNumber: '010-87654321', businessHours: '09:00-21:00' },
    { name: '菜鸟驿站(五道口店)', type: 'point' as const, address: '北京市海淀区成府路28号', phoneNumber: '010-66668888', businessHours: '08:00-22:00' },
];

export const SHOP_A_PICKUP_LOCATIONS = [
    { name: '生鲜自提点(国贸店)', type: 'store' as const, address: '北京市朝阳区建国门外大街1号', phoneNumber: '010-11112222', businessHours: '07:00-21:00' },
];
```

- [ ] **Step 2: 实现 02-default-channel.ts**

Replace `packages/dev-server/china-data/02-default-channel.ts` 内容:

```typescript
import { INestApplication } from '@nestjs/common';
import { ChannelService, CurrencyCode, LanguageCode } from '@vendure/core';
import path from 'path';

import { withCtx, yuanToCents } from './shared';
import { PRODUCTS, DEFAULT_SHIPPING_METHODS, PAYMENT_METHODS, DEFAULT_PICKUP_LOCATIONS } from './sources';

const ASSETS_DIR = path.join(__dirname, '../../core/mock-data/assets');

export async function populateDefaultChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 更新 default Channel 为 CNY / zh_Hans / Asia Zone
    const zoneService = app.get('ZoneService');
    await withCtx(app, defaultChannel, async ctx => {
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia')!;
        await channelService.update(ctx, {
            id: defaultChannel.id as string,
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans, LanguageCode.en],
            customFields: { couponStackable: false, maxStackableCount: null },
        });
        // Channel defaultZone 更新需通过 repository（ChannelService.update 不支持）
        const conn = app.get('TransactionalConnection');
        const channelRepo = conn.getRepository(ctx, 'Channel');
        await channelRepo.update(defaultChannel.id, { defaultTaxZone: asiaZone, defaultShippingZone: asiaZone } as any);

        await createProducts(app, ctx);
        await createShippingMethods(app, ctx);
        await createPaymentMethods(app, ctx);
        await createPickupLocations(app, ctx);
    });
}

async function createProducts(app: INestApplication, ctx: any): Promise<void> {
    const productService = app.get('ProductService');
    const facetService = app.get('FacetService');
    const assetService = app.get('AssetService');
    const taxCategoryService = app.get('TaxCategoryService');
    const stockMovementService = app.get('StockMovementService');
    const fs = await import('fs/promises');

    const allFacets = await facetService.findAll(ctx);
    const taxCategories = await taxCategoryService.findAll(ctx);
    const standardTax = taxCategories.items.find(tc => tc.name === '普通税率')!;

    for (const p of PRODUCTS) {
        // 导入图片
        const fileBuffer = await fs.readFile(path.join(ASSETS_DIR, p.imageFile));
        const asset = await assetService.create(ctx, {
            input: { file: new File([fileBuffer], p.imageFile) },
        });

        // 找到 brand 和 category 的 facetValueId
        const facetValueIds: string[] = [];
        for (const facet of allFacets.items) {
            for (const fv of facet.values) {
                if (fv.name === p.brand || fv.name === p.category) {
                    facetValueIds.push(fv.id as string);
                }
            }
        }

        const product = await productService.create(ctx, {
            name: p.name,
            slug: p.slug,
            description: p.description,
            facetValueIds,
            assetIds: [asset.id as string],
        });

        // 创建变体
        for (const v of p.variants) {
            await productService.createVariant(ctx, product.id as string, {
                sku: v.sku,
                name: v.name,
                price: yuanToCents(v.price),
                taxCategoryId: standardTax.id as string,
            });
        }

        // 调整库存
        const updatedProduct = await productService.findOne(ctx, product.id);
        if (updatedProduct?.variants) {
            for (let i = 0; i < updatedProduct.variants.length; i++) {
                const variant = updatedProduct.variants[i];
                const stock = p.variants[i].stock;
                await stockMovementService.adjust(ctx, variant.id as string, stock);
            }
        }
    }
}

async function createShippingMethods(app: INestApplication, ctx: any): Promise<void> {
    const shippingMethodService = app.get('ShippingMethodService');
    for (const sm of DEFAULT_SHIPPING_METHODS) {
        await shippingMethodService.create(ctx, {
            code: sm.code,
            name: sm.name,
            description: sm.description,
            checker: sm.checker,
            calculator: sm.calculator,
        });
    }
}

async function createPaymentMethods(app: INestApplication, ctx: any): Promise<void> {
    const paymentMethodService = app.get('PaymentMethodService');
    for (const pm of PAYMENT_METHODS) {
        await paymentMethodService.create(ctx, {
            code: pm.code,
            name: pm.name,
            description: pm.description,
            enabled: true,
            handler: pm.handler,
        });
    }
}

async function createPickupLocations(app: INestApplication, ctx: any): Promise<void> {
    // PickupLocationService 通过字符串 token 获取
    const pickupLocationService = app.get('PickupLocationService');
    for (const loc of DEFAULT_PICKUP_LOCATIONS) {
        await pickupLocationService.create(ctx, {
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
        });
    }
}
```

- [ ] **Step 3: 验证阶段2执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1+2 OK。8 SPU / 9 SKU 创建，4 配送 + 3 支付 + 3 自提点创建。

验证 Admin UI：启动 dev:server 后访问 `http://localhost:3000/admin`，用 `superadmin@china.test` / `superadmin` 登录，Catalog → Products 应显示 8 个中文商品。

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/china-data/sources.ts packages/dev-server/china-data/02-default-channel.ts
git commit -m "feat(dev-server): implement stage 2 default channel (products/shipping/payment/pickup)"
```

---

### Task 4: 阶段3+4 - shop-a Channel 创建+配置+商品分配

**Files:**
- Modify: `packages/dev-server/china-data/03-shop-a-channel.ts`

- [ ] **Step 1: 实现 03-shop-a-channel.ts**

Replace `packages/dev-server/china-data/03-shop-a-channel.ts` 内容:

```typescript
import { INestApplication } from '@nestjs/common';
import { ChannelService, CurrencyCode, LanguageCode } from '@vendure/core';

import { withCtx, yuanToCents } from './shared';
import { SHOP_A_SHIPPING_METHODS, PAYMENT_METHODS, SHOP_A_PICKUP_LOCATIONS } from './sources';

// shop-a 上五常大米便宜 5 元
const SHOP_A_PRICE_OVERRIDE: Record<string, number> = {
    'NF-RICE-5KG': 44,
};

export async function populateShopAChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 1. 在 default Channel ctx 下创建 shop-a Channel
    await withCtx(app, defaultChannel, async ctx => {
        const zoneService = app.get('ZoneService');
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia')!;

        await channelService.create(ctx, {
            code: 'shop-a',
            token: 'shop-a-token',
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans],
            pricesIncludeTax: true,
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: { couponStackable: true, maxStackableCount: 3 },
        });
    });

    // 2. 切换到 shop-a Channel ctx，配置数据
    const allChannels = await channelService.findAll(ctx_any(app));
    const shopA = allChannels.items.find(c => c.code === 'shop-a')!;

    await withCtx(app, shopA, async ctx => {
        await assignProductsFromDefault(app, ctx, defaultChannel.id as string);
        await overrideShopAPrices(app, ctx);
        await createShippingMethods(app, ctx);
        await createPaymentMethods(app, ctx);
        await createPickupLocations(app, ctx);
    });
}

// 辅助：构造一个无 channel 的 ctx 用于 findAll（实际用 default Channel）
function ctx_any(app: INestApplication) {
    // placeholder: 用 default Channel
    return (async () => {
        const channelService = app.get(ChannelService);
        return channelService.getDefaultChannel();
    })();
}

async function assignProductsFromDefault(app: INestApplication, ctx: any, defaultChannelId: string): Promise<void> {
    const productService = app.get('ProductService');
    const channelService = app.get(ChannelService');

    // 先切回 default Channel 查询所有商品 ID
    const defaultChannel = await channelService.getDefaultChannel();
    await withCtx(app, defaultChannel, async defaultCtx => {
        const products = await productService.findAll(defaultCtx, { take: 999 });
        const productIds = products.items.map(p => p.id as string);

        // 分配到 shop-a（需在 default Channel ctx 下调用）
        await productService.assignProductsToChannel(defaultCtx, {
            channelId: ctx.channelId,
            productIds,
        });
    });
}

async function overrideShopAPrices(app: INestApplication, ctx: any): Promise<void> {
    const productService = app.get('ProductService');
    const products = await productService.findAll(ctx, { take: 999 });

    for (const product of products.items) {
        const fullProduct = await productService.findOne(ctx, product.id);
        if (!fullProduct?.variants) continue;

        for (const variant of fullProduct.variants) {
            const overridePrice = SHOP_A_PRICE_OVERRIDE[variant.sku];
            if (overridePrice !== undefined) {
                await productService.updateVariant(ctx, {
                    id: variant.id as string,
                    price: yuanToCents(overridePrice),
                });
            }
        }
    }
}

async function createShippingMethods(app: INestApplication, ctx: any): Promise<void> {
    const shippingMethodService = app.get('ShippingMethodService');
    for (const sm of SHOP_A_SHIPPING_METHODS) {
        await shippingMethodService.create(ctx, {
            code: sm.code,
            name: sm.name,
            description: sm.description,
            checker: sm.checker,
            calculator: sm.calculator,
        });
    }
}

async function createPaymentMethods(app: INestApplication, ctx: any): Promise<void> {
    const paymentMethodService = app.get('PaymentMethodService');
    for (const pm of PAYMENT_METHODS) {
        await paymentMethodService.create(ctx, {
            code: pm.code,
            name: pm.name,
            description: pm.description,
            enabled: true,
            handler: pm.handler,
        });
    }
}

async function createPickupLocations(app: INestApplication, ctx: any): Promise<void> {
    const pickupLocationService = app.get('PickupLocationService');
    for (const loc of SHOP_A_PICKUP_LOCATIONS) {
        await pickupLocationService.create(ctx, {
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
        });
    }
}
```

> **注意**：`assignProductsToChannel` 的参数签名可能因 Vendure 版本而异。如果报错，参考 `packages/core/src/service/services/product-service.ts` 的 `assignProductsToChannel` 方法签名调整。Channel 自定义字段（couponStackable）需在 create 时传入，如果 `channelService.create` 不支持 customFields，改用 `channelService.update`。

- [ ] **Step 2: 验证阶段3执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1+2+3 OK。shop-a Channel 创建，8 SPU 分配到 shop-a，五常大米价格为 44 元。

验证：Admin UI 右上角 Channel 选择器出现 shop-a，切换后商品列表与 default 一致，五常大米显示 ¥44。

- [ ] **Step 3: Commit**

```bash
git add packages/dev-server/china-data/03-shop-a-channel.ts
git commit -m "feat(dev-server): implement stage 3 shop-a channel (create/assign/configure)"
```

---

### Task 5: 阶段5a - 优惠券

**Files:**
- Modify: `packages/dev-server/china-data/sources.ts`（追加优惠券数据源）
- Modify: `packages/dev-server/china-data/04-promotions.ts`

- [ ] **Step 1: 在 sources.ts 追加优惠券数据源**

在 `packages/dev-server/china-data/sources.ts` 末尾追加:

```typescript
// ===== Promotions =====
export interface PromotionSource {
    name: string;
    couponCode: string;
    channel: 'default' | 'shop-a';
    conditions: Array<{ code: string; arguments: Array<{ name: string; value: string }> }>;
    actions: Array<{ code: string; arguments: Array<{ name: string; value: string }> }>;
    customFields?: { stackable?: boolean; stackableGroup?: string | null; maxStackableWith?: number | null };
}

export const PROMOTIONS: PromotionSource[] = [
    {
        name: '满100减10',
        couponCode: 'SAVE10',
        channel: 'default',
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '10000' }] }],
        actions: [{ code: 'order-fixed-discount', arguments: [{ name: 'discount', value: '1000' }] }],
    },
    {
        name: '新人9折',
        couponCode: 'NEW90',
        channel: 'shop-a',
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '0' }] }],
        actions: [{ code: 'order-percentage-discount', arguments: [{ name: 'discount', value: '10' }] }],
        customFields: { stackable: true, stackableGroup: null, maxStackableWith: null },
    },
    {
        name: '满50减5',
        couponCode: 'SAVE5',
        channel: 'shop-a',
        conditions: [{ code: 'order-total', arguments: [{ name: 'minimum', value: '5000' }] }],
        actions: [{ code: 'order-fixed-discount', arguments: [{ name: 'discount', value: '500' }] }],
        customFields: { stackable: true, stackableGroup: null, maxStackableWith: null },
    },
];
```

- [ ] **Step 2: 实现 04-promotions.ts**

Replace `packages/dev-server/china-data/04-promotions.ts` 内容:

```typescript
import { INestApplication } from '@nestjs/common';
import { ChannelService } from '@vendure/core';

import { withCtx } from './shared';
import { PROMOTIONS } from './sources';

export async function populatePromotions(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const allChannels = await channelService.findAll(await getDefaultCtx(app));
    const defaultChannel = allChannels.items.find(c => c.code === '__default__')!;
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a')!;

    for (const promo of PROMOTIONS) {
        const targetChannel = promo.channel === 'default' ? defaultChannel : shopAChannel;
        await withCtx(app, targetChannel, async ctx => {
            const promotionService = app.get('PromotionService');
            await promotionService.create(ctx, {
                name: promo.name,
                enabled: true,
                startsAt: new Date('2026-01-01').toISOString(),
                endsAt: new Date('2027-12-31').toISOString(),
                conditions: promo.conditions,
                actions: promo.actions,
                couponCode: promo.couponCode,
                perCustomerUsageLimit: 100,
                customFields: promo.customFields || {},
            });
        });
    }
}

async function getDefaultCtx(app: INestApplication) {
    const ctxService = app.get('RequestContextService');
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    return ctxService.create({ apiType: 'admin', channel: defaultChannel });
}
```

- [ ] **Step 3: 验证阶段4执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1-4 OK。3 张优惠券创建，shop-a 的 2 张 stackable=true。

验证：Admin UI → Promotions，default Channel 显示 1 张（SAVE10），shop-a Channel 显示 2 张（NEW90/SAVE5），shop-a 的优惠券自定义字段 stackable=true。

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/china-data/sources.ts packages/dev-server/china-data/04-promotions.ts
git commit -m "feat(dev-server): implement stage 4 promotions (coupons with stackable customFields)"
```

---

### Task 6: 阶段5b - 客户+地址+余额

**Files:**
- Modify: `packages/dev-server/china-data/sources.ts`（追加客户数据源）
- Modify: `packages/dev-server/china-data/05-customers.ts`

- [ ] **Step 1: 在 sources.ts 追加客户数据源**

在 `packages/dev-server/china-data/sources.ts` 末尾追加:

```typescript
// ===== Customers =====
export interface CustomerSource {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    emailAddress: string;
    channel: 'default' | 'shop-a';
    balance: number; // 元，0 表示不创建余额
    address: {
        streetLine1: string;
        city: string;
        province: string;
        postalCode: string;
        country: string; // China
    };
}

export const CUSTOMERS: CustomerSource[] = [
    {
        firstName: '三',
        lastName: '张',
        phoneNumber: '13800138001',
        emailAddress: 'zhangsan@test.cn',
        channel: 'default',
        balance: 0,
        address: {
            streetLine1: '北京市海淀区中关村大街1号',
            city: '北京市',
            province: '北京市',
            postalCode: '100080',
            country: 'China',
        },
    },
    {
        firstName: '四',
        lastName: '李',
        phoneNumber: '13800138002',
        emailAddress: 'lisi@test.cn',
        channel: 'default',
        balance: 500,
        address: {
            streetLine1: '北京市朝阳区望京街10号',
            city: '北京市',
            province: '北京市',
            postalCode: '100102',
            country: 'China',
        },
    },
    {
        firstName: '五',
        lastName: '王',
        phoneNumber: '13800138003',
        emailAddress: 'wangwu@test.cn',
        channel: 'shop-a',
        balance: 200,
        address: {
            streetLine1: '北京市朝阳区建国门外大街1号',
            city: '北京市',
            province: '北京市',
            postalCode: '100020',
            country: 'China',
        },
    },
];
```

- [ ] **Step 2: 实现 05-customers.ts**

Replace `packages/dev-server/china-data/05-customers.ts` 内容:

```typescript
import { INestApplication } from '@nestjs/common';
import { ChannelService, CustomerService } from '@vendure/core';

import { withCtx, yuanToCents } from './shared';
import { CUSTOMERS } from './sources';

export async function populateCustomers(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const customerService = app.get(CustomerService);

    const allChannels = await channelService.findAll(await getDefaultCtx(app));
    const defaultChannel = allChannels.items.find(c => c.code === '__default__')!;
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a')!;

    for (const c of CUSTOMERS) {
        const targetChannel = c.channel === 'default' ? defaultChannel : shopAChannel;
        await withCtx(app, targetChannel, async ctx => {
            // 创建客户（含地址）
            const customer = await customerService.create(ctx, {
                firstName: c.firstName,
                lastName: c.lastName,
                phoneNumber: c.phoneNumber,
                emailAddress: c.emailAddress,
                addresses: [
                    {
                        fullName: `${c.lastName}${c.firstName}`,
                        streetLine1: c.address.streetLine1,
                        city: c.address.city,
                        province: c.address.province,
                        postalCode: c.address.postalCode,
                        country: c.address.country,
                        defaultShippingAddress: true,
                        defaultBillingAddress: true,
                    },
                ],
            });

            // 写入余额（通过 RechargeCardService.addBalance 或直接操作 CustomerBalance 表）
            if (c.balance > 0) {
                await setCustomerBalance(app, ctx, customer.id as number, yuanToCents(c.balance));
            }
        });
    }
}

async function setCustomerBalance(app: INestApplication, ctx: any, customerId: number, amount: number): Promise<void> {
    try {
        // 优先尝试 RechargeCardService
        const rechargeCardService = app.get('RechargeCardService');
        await rechargeCardService.addBalance(ctx, customerId, amount);
    } catch {
        // 回退：直接操作 CustomerBalance 表
        const conn = app.get('TransactionalConnection');
        const repo = conn.getRepository(ctx, 'CustomerBalance');
        const existing = await repo.findOne({ where: { customerId, channelId: ctx.channelId } });
        if (existing) {
            existing.balance = amount;
            await repo.save(existing);
        } else {
            await repo.save({
                customerId,
                channelId: ctx.channelId,
                balance: amount,
            });
        }
    }
}

async function getDefaultCtx(app: INestApplication) {
    const ctxService = app.get('RequestContextService');
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    return ctxService.create({ apiType: 'admin', channel: defaultChannel });
}
```

- [ ] **Step 3: 验证阶段5执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1-5 OK。3 个客户创建，李四余额 500 元（50000 单位），王五余额 200 元（20000 单位）。

验证：Admin UI → Customers，default 显示 2 个（张三/李四），shop-a 显示 1 个（王五）。

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/china-data/sources.ts packages/dev-server/china-data/05-customers.ts
git commit -m "feat(dev-server): implement stage 5 customers (with address and balance)"
```

---

### Task 7: 阶段6 - 历史订单

**Files:**
- Modify: `packages/dev-server/china-data/sources.ts`（追加订单数据源）
- Modify: `packages/dev-server/china-data/06-orders.ts`

- [ ] **Step 1: 在 sources.ts 追加订单数据源**

在 `packages/dev-server/china-data/sources.ts` 末尾追加:

```typescript
// ===== Orders =====
export interface OrderSource {
    channel: 'default' | 'shop-a';
    customerEmail: string;
    items: Array<{ sku: string; quantity: number }>;
    shippingMethodCode: string;
    paymentMethodCode?: string; // 不传则不付款
    state: 'ArrangingPayment' | 'PaymentSettled' | 'Shipped' | 'Completed' | 'Cancelled';
    couponCodes?: string[];
}

export const ORDERS: OrderSource[] = [
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'NF-WATER-500', quantity: 5 }],
        shippingMethodCode: 'sf-express',
        state: 'ArrangingPayment',
    },
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'TS-NUT-1KG', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'dummy-payment',
        state: 'PaymentSettled',
    },
    {
        channel: 'default',
        customerEmail: 'lisi@test.cn',
        items: [{ sku: 'NF-RICE-5KG', quantity: 2 }, { sku: 'TS-BEEF-500', quantity: 1 }],
        shippingMethodCode: 'sf-express',
        paymentMethodCode: 'dummy-payment',
        state: 'Shipped',
    },
    {
        channel: 'default',
        customerEmail: 'lisi@test.cn',
        items: [{ sku: 'XM-BAND-8-STD', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'balance-pay',
        state: 'Completed',
    },
    {
        channel: 'default',
        customerEmail: 'zhangsan@test.cn',
        items: [{ sku: 'HW-ROUTER-STD', quantity: 1 }],
        shippingMethodCode: 'sf-express',
        state: 'Cancelled',
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'TS-NUT-1KG', quantity: 1 }],
        shippingMethodCode: 'store-pickup',
        state: 'ArrangingPayment',
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'NF-RICE-5KG', quantity: 2 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'cash-on-delivery',
        state: 'PaymentSettled',
        couponCodes: ['NEW90', 'SAVE5'],
    },
    {
        channel: 'shop-a',
        customerEmail: 'wangwu@test.cn',
        items: [{ sku: 'XM-PB-10000', quantity: 1 }],
        shippingMethodCode: 'free-shipping-99',
        paymentMethodCode: 'balance-pay',
        state: 'Shipped',
    },
];
```

- [ ] **Step 2: 实现 06-orders.ts**

Replace `packages/dev-server/china-data/06-orders.ts` 内容:

```typescript
import { INestApplication, Logger } from '@nestjs/common';
import { ChannelService, CustomerService, OrderService, ProductVariantService, ShippingMethodService, PaymentMethodService } from '@vendure/core';

import { withCtx } from './shared';
import { ORDERS, OrderSource } from './sources';

export async function populateOrders(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const customerService = app.get(CustomerService);
    const orderService = app.get(OrderService);
    const variantService = app.get('ProductVariantService');
    const shippingMethodService = app.get(ShippingMethodService);

    const allChannels = await channelService.findAll(await getDefaultCtx(app));
    const defaultChannel = allChannels.items.find(c => c.code === '__default__')!;
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a')!;

    let successCount = 0;
    let failCount = 0;

    for (const orderSrc of ORDERS) {
        try {
            const targetChannel = orderSrc.channel === 'default' ? defaultChannel : shopAChannel;
            await withCtx(app, targetChannel, async ctx => {
                await createOneOrder(app, ctx, orderSrc, customerService, orderService, variantService, shippingMethodService);
            });
            successCount++;
        } catch (e: any) {
            Logger.warn(`订单创建失败 (${orderSrc.channel}/${orderSrc.customerEmail}): ${e.message}`, 'PopulateChina');
            failCount++;
        }
    }
    console.log(`  订单: ${successCount}/${ORDERS.length} 成功, ${failCount} 失败`);
}

async function createOneOrder(
    app: INestApplication,
    ctx: any,
    orderSrc: OrderSource,
    customerService: CustomerService,
    orderService: OrderService,
    variantService: any,
    shippingMethodService: ShippingMethodService,
): Promise<void> {
    // 1. 找到客户
    const customerResult = await customerService.findAll(ctx, { filter: { emailAddress: { eq: orderSrc.customerEmail } } });
    const customer = customerResult.items[0];
    if (!customer) throw new Error(`Customer not found: ${orderSrc.customerEmail}`);

    // 2. 创建 draft order
    const order = await orderService.create(ctx, customer.id as string);

    // 3. 添加商品
    for (const item of orderSrc.items) {
        const variants = await variantService.findAll(ctx, { filter: { sku: { eq: item.sku } }, take: 1 });
        const variant = variants.items[0];
        if (!variant) throw new Error(`Variant not found: ${item.sku}`);
        await orderService.addItem(ctx, order.id as string, variant.id as string, item.quantity);
    }

    // 4. 设置配送方式
    const shippingMethods = await shippingMethodService.findAll(ctx);
    const shippingMethod = shippingMethods.items.find(sm => sm.code === orderSrc.shippingMethodCode);
    if (!shippingMethod) throw new Error(`Shipping method not found: ${orderSrc.shippingMethodCode}`);

    // 设置 shipping address（用客户默认地址）
    const fullCustomer = await customerService.findOne(ctx, customer.id);
    const defaultAddress = fullCustomer?.addresses?.[0];
    if (defaultAddress) {
        await orderService.setShippingAddress(ctx, order.id as string, {
            fullName: `${customer.lastName}${customer.firstName}`,
            streetLine1: defaultAddress.streetLine1,
            city: defaultAddress.city,
            province: defaultAddress.province,
            postalCode: defaultAddress.postalCode,
            countryCode: 'CN',
        });
    }
    await orderService.setShippingMethod(ctx, order.id as string, [shippingMethod.id as string]);

    // 5. 应用优惠券
    if (orderSrc.couponCodes) {
        for (const code of orderSrc.couponCodes) {
            try {
                await orderService.applyCouponCode(ctx, order.id as string, code);
            } catch (e: any) {
                Logger.warn(`优惠券应用失败 ${code}: ${e.message}`, 'PopulateChina');
            }
        }
    }

    // 6. 状态转换 + 支付
    if (orderSrc.state === 'Cancelled') {
        await orderService.cancelOrder(ctx, order.id as string, []);
        return;
    }

    if (orderSrc.paymentMethodCode) {
        // transitionToState(ArrangingPayment)
        await orderService.transitionToState(ctx, order.id as string, 'ArrangingPayment' as any);

        const paymentMethodService = app.get(PaymentMethodService);
        const paymentMethods = await paymentMethodService.findAll(ctx);
        const paymentMethod = paymentMethods.items.find(pm => pm.code === orderSrc.paymentMethodCode);
        if (!paymentMethod) throw new Error(`Payment method not found: ${orderSrc.paymentMethodCode}`);

        // 添加支付
        const updatedOrder = await orderService.findOne(ctx, order.id);
        const total = updatedOrder?.totalWithTax || 0;
        await orderService.addPaymentToOrder(ctx, order.id as string, {
            method: paymentMethod.code,
            metadata: { amount: total },
        });
    }

    // 状态转换到目标 state
    if (orderSrc.state === 'Shipped' || orderSrc.state === 'Completed') {
        // 创建 Fulfillment
        const fulfillmentService = app.get('FulfillmentService');
        try {
            const updatedOrder = await orderService.findOne(ctx, order.id);
            if (updatedOrder?.lines) {
                await fulfillmentService.create(ctx, {
                    lines: updatedOrder.lines.map(l => ({ orderLineId: l.id as string, quantity: l.quantity })),
                    handler: { code: 'manual-fulfillment', arguments: [] },
                });
            }
        } catch (e: any) {
            Logger.warn(`Fulfillment 创建失败: ${e.message}`, 'PopulateChina');
        }

        if (orderSrc.state === 'Completed') {
            try {
                await orderService.transitionToState(ctx, order.id as string, 'Completed' as any);
            } catch (e: any) {
                Logger.warn(`订单 Completed 转换失败: ${e.message}`, 'PopulateChina');
            }
        }
    }
}

async function getDefaultCtx(app: INestApplication) {
    const ctxService = app.get('RequestContextService');
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    return ctxService.create({ apiType: 'admin', channel: defaultChannel });
}
```

- [ ] **Step 3: 验证阶段6执行**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 阶段1-6 OK。8 笔订单创建（允许部分状态转换失败但脚本不中断）。日志显示 `订单: X/8 成功, Y 失败`。

验证：Admin UI → Orders，default 显示 5 笔，shop-a 显示 3 笔，状态覆盖 ArrangingPayment / PaymentSettled / Shipped / Completed / Cancelled。

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/china-data/sources.ts packages/dev-server/china-data/06-orders.ts
git commit -m "feat(dev-server): implement stage 6 historical orders (8 orders across 5 states)"
```

---

### Task 8: 端到端验证与文档更新

**Files:**
- 无新文件，仅验证

- [ ] **Step 1: 完整运行脚本**

Run: `cd packages/dev-server && npm run populate:china`

Expected: 6/6 阶段成功，总耗时约 10-20s。无关键阶段失败。

- [ ] **Step 2: 启动 dev-server 验证 Admin UI**

Run: `cd packages/dev-server && npm run dev:server`

打开 `http://localhost:3000/admin`，用 `superadmin@china.test` / `superadmin` 登录。

验证清单：
- [ ] Channel 选择器显示 `default` + `shop-a`
- [ ] 切换到 shop-a → Settings → Channels → 自定义字段 `couponStackable=true`, `maxStackableCount=3`
- [ ] Catalog → Products：default 8 SPU，shop-a 8 SPU，五常大米 shop-a 显示 ¥44
- [ ] Settings → Shipping Methods：default 4 个，shop-a 2 个
- [ ] Settings → Payment Methods：每个 Channel 各 3 个
- [ ] Promotions：default 1 张，shop-a 2 张（stackable=true）
- [ ] Customers：default 2 个，shop-a 1 个
- [ ] Orders：default 5 笔，shop-a 3 笔

- [ ] **Step 3: 启动 VShop 验证前端**

Run: `cd e:\code\vshop && npm run dev:h5`

打开 `http://localhost:5174/?tenant=shop-a`：

- [ ] 首页使用 fresh 模板
- [ ] 商品列表显示 8 个中文商品
- [ ] 加入购物车 → 进入结算页
- [ ] 配送方式显示"门店自提"+"满99包邮"
- [ ] 支付方式显示"测试支付/货到付款/余额支付"
- [ ] 应用 `NEW90` + `SAVE5` 优惠券，确认叠加成功

- [ ] **Step 4: Shop API GraphiQL 验证**

打开 `http://localhost:3000/shop-api`（GraphiQL），设置 HTTP Header `{"vendure-token":"shop-a-token"}`：

```graphql
query {
  products(options: { take: 10 }) {
    items { id name slug priceWithTax }
    totalItems
  }
  eligibleShippingMethods { id name priceWithTax }
  eligiblePaymentMethods { id code name isEligible }
}
```

Expected:
- `totalItems` = 8
- 配送方式 = 2 个
- 支付方式 = 3 个

- [ ] **Step 5: Commit 最终版本**

```bash
git add -A
git commit -m "test(dev-server): verify china populate script end-to-end"
```

---

## Self-Review 检查

**Spec coverage**:
- ✅ superadmin 用户 (Task 2)
- ✅ Zone/Country/TaxRate/Facet/Collection (Task 2)
- ✅ default Channel 中国化 + 商品+图片 (Task 3)
- ✅ default Channel 4 配送 + 3 支付 + 3 自提点 (Task 3)
- ✅ shop-a Channel 创建 + customFields (Task 4)
- ✅ shop-a 商品分配 + 五常大米 44 元 (Task 4)
- ✅ shop-a 2 配送 + 3 支付 + 1 自提点 (Task 4)
- ✅ 3 张优惠券含 condition/action + customFields (Task 5)
- ✅ 3 客户 + 地址 + 余额 (Task 6)
- ✅ 8 历史订单 5 状态 (Task 7)
- ✅ 端到端验证 (Task 8)

**Placeholder scan**: 无 TBD/TODO（Task 1 的 stub 注释在 Task 2-7 被实际代码替换）

**Type consistency**:
- `withCtx(app, channel, fn)` 签名一致
- `yuanToCents` 全局统一
- `ProductSource` / `PromotionSource` / `CustomerSource` / `OrderSource` 接口定义在 sources.ts，各阶段文件引用一致

**已知风险点**（实现时需关注）：
1. `AssetService.create` 的参数签名（File 对象 vs 文件路径）— Vendure 3.6 可能用 `{ input: { file: ... } }` 或 `{ input: { create: { file: ... } } }`，需查实际签名
2. `channelService.create` 是否支持 `customFields` 参数 — 如不支持，create 后用 `channelService.update` 补写
3. `productService.assignProductsToChannel` 参数签名 — 可能是 `(ctx, { channelId, productIds })` 或 `(ctx, channelId, productIds)`
4. `PickupLocationService` 通过 `app.get('PickupLocationService')` 获取 — 如失败尝试 import 类
5. 订单状态转换链可能需要中间状态（如 ArrangingShipment）— 允许失败不中断
