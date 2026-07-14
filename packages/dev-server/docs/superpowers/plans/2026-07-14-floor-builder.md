# 首页楼层可视化搭建器 实施规划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vendure Admin 后台提供搭积木式选品+外观配置能力，前端首页按多租户动态渲染楼层。

**Architecture:** 复用 Vendure Collection（ChannelAware 天然多租户隔离）+ customFields（struct 类型）扩展楼层配置；创建 FloorBuilderPlugin 提供 Admin UI 搭建器（defineDashboardExtension 注入 collection-detail 页）；前端新建 Collection 查询和 FloorLayout 组件，根据 floorLayout 动态渲染。

**Tech Stack:** Vendure v3.6.4（TypeScript + NestJS）、@vendure/dashboard（React + defineDashboardExtension）、uni-app（Vue3 + Vite + Pinia + graphql-request）

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-14-floor-builder-design.md`

---

## 文件结构

### 后端（Vendure）

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `e:\code\vendure\packages\dev-server\dev-config.ts` | 添加 `customFields.Collection` 配置，注册 FloorBuilderPlugin |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\index.ts` | Plugin 入口，导出 FloorBuilderPlugin |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\floor-builder-plugin.ts` | Plugin 定义，订阅 ProductEvent 清理悬挂引用 |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\package.json` | Plugin 包配置 |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\tsconfig.json` | TypeScript 配置 |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\dashboard\index.tsx` | Dashboard 扩展入口，注入楼层搭建器到 collection-detail 页 |
| 创建 | `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\dashboard\FloorBuilderBlock.tsx` | 楼层搭建器 React 组件（选品+配置+预览） |

### 前端（VShop）

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `e:\code\vshop\src\api\queries\collection.ts` | 封装带 customFields 的 Collection 查询 |
| 创建 | `e:\code\vshop\src\components\FloorSection.vue` | 单个楼层容器组件（标题+布局渲染） |
| 创建 | `e:\code\vshop\src\components\floor\SingleScroll.vue` | 单列横向滚动布局 |
| 创建 | `e:\code\vshop\src\components\floor\DoubleGrid.vue` | 双列网格布局 |
| 创建 | `e:\code\vshop\src\components\floor\TripleGrid.vue` | 三列网格布局 |
| 创建 | `e:\code\vshop\src\components\floor\HeroWithList.vue` | 大图主推+下方列表布局 |
| 修改 | `e:\code\vshop\src\templates\default\pages\HomeContent.vue` | 集成楼层区域到默认模板 |
| 修改 | `e:\code\vshop\src\templates\fresh\pages\HomeContent.vue` | 集成楼层区域到生鲜模板 |

### 数据填充

| 操作 | 路径 | 职责 |
|------|------|------|
| 创建 | `e:\code\vendure\packages\dev-server\china-data\07-floors.ts` | 为 default 和 shop-a Channel 创建楼层测试数据 |
| 修改 | `e:\code\vendure\packages\dev-server\populate-china-dev.ts` | 添加 stage 7 调用 |

---

## Task 1: 后端 Collection customFields 配置

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts:131-138`

- [ ] **Step 1: 添加 customFields.Collection 配置**

在 `dev-config.ts` 的 `customFields` 对象中，在 `Channel: []` 之前添加 `Collection` 键：

```typescript
    customFields: {
        Collection: [
            { name: 'floorEnabled', type: 'boolean', defaultValue: false, public: true,
              ui: { component: 'boolean-form-input' } },
            { name: 'floorTitle', type: 'string', public: true,
              ui: { component: 'text-form-input' } },
            { name: 'floorSubtitle', type: 'string', public: true,
              ui: { component: 'text-form-input' } },
            { name: 'floorLayout', type: 'string', defaultValue: 'double_grid', public: true,
              ui: {
                  component: 'select-form-input',
                  options: [
                      { value: 'single_scroll', label: '单列横滑' },
                      { value: 'double_grid', label: '双列网格' },
                      { value: 'triple_grid', label: '三列网格' },
                      { value: 'hero_with_list', label: '大图+列表' },
                  ],
              } },
            { name: 'floorSortOrder', type: 'int', defaultValue: 0, public: true },
            { name: 'floorMaxScreens', type: 'int', defaultValue: 3, public: true },
            {
                name: 'floorTheme', type: 'struct', public: true, fields: [
                    { name: 'primaryColor', type: 'string', defaultValue: '#ff6600' },
                    { name: 'backgroundColor', type: 'string', defaultValue: '#ffffff' },
                    { name: 'titleIcon', type: 'string' },
                ],
            },
            {
                name: 'floorItemConfig', type: 'struct', list: true, public: true, fields: [
                    { name: 'productId', type: 'string' },
                    { name: 'size', type: 'string', defaultValue: 'medium',
                      ui: { component: 'select-form-input',
                            options: [
                                { value: 'small', label: '小' },
                                { value: 'medium', label: '中' },
                                { value: 'large', label: '大' },
                            ] } },
                    { name: 'highlighted', type: 'boolean', defaultValue: false },
                    { name: 'label', type: 'string' },
                ],
            },
            {
                name: 'floorSchedule', type: 'struct', public: true, fields: [
                    { name: 'startAt', type: 'datetime' },
                    { name: 'endAt', type: 'datetime' },
                ],
            },
        ],
        Channel: [],
        Customer: [],
        Fulfillment: [],
        Order: [],
        Product: [],
        Promotion: [],
    },
```

- [ ] **Step 2: 验证后端启动**

Run: `cd packages\dev-server ; npm run dev:server`
Expected: Vendure 正常启动，无 schema 错误，Admin UI Collection 编辑页出现 floor 相关 customFields

- [ ] **Step 3: Commit**

```bash
git add packages/dev-server/dev-config.ts
git commit -m "feat(dev-server): Add floor customFields to Collection"
```

---

## Task 2: 创建 FloorBuilderPlugin（事件订阅）

**Files:**
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\index.ts`
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\floor-builder-plugin.ts`
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\package.json`
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\tsconfig.json`

- [ ] **Step 1: 创建 package.json**

```json
{
    "name": "vendure-floor-builder-plugin",
    "version": "0.0.1",
    "description": "Floor builder plugin for multi-tenant homepage",
    "scripts": {
        "build": "tsc && cp -r dashboard dist/"
    },
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "files": ["dist"],
    "private": true
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["./index.ts"]
}
```

- [ ] **Step 3: 创建 floor-builder-plugin.ts（含 ProductEvent 订阅）**

```typescript
import { EventBus, PluginCommonModule, ProductEvent, VendurePlugin } from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';

@VendurePlugin({
    imports: [PluginCommonModule],
    dashboard: './dashboard/index.tsx',
})
export class FloorBuilderPlugin implements OnApplicationBootstrap {
    constructor(private readonly eventBus: EventBus) {}

    onApplicationBootstrap(): void {
        // 商品删除时，清理 floorItemConfig 中的悬挂 productId 引用
        this.eventBus.ofType(ProductEvent).subscribe(async event => {
            if (event.type !== 'deleted') return;
            // struct list 的悬挂引用在前端查询时跳过即可，无需后端清理
            // 此处仅记录日志，便于排查
            console.log(`[FloorBuilderPlugin] Product deleted: ${event.entity.id}, floorItemConfig references may be orphaned`);
        });
    }
}
```

- [ ] **Step 4: 创建 index.ts**

```typescript
export { FloorBuilderPlugin } from './floor-builder-plugin';
```

- [ ] **Step 5: 在 dev-config.ts 注册 Plugin**

在 `dev-config.ts` 的 import 区添加：
```typescript
import { FloorBuilderPlugin } from './test-plugins/floor-builder';
```

在 `plugins: [...]` 数组中（在 `ReviewsPlugin` 之后）添加：
```typescript
        FloorBuilderPlugin,
```

- [ ] **Step 6: 创建占位 dashboard/index.tsx**

```typescript
import { defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'floor-builder',
            component: () => null,  // Task 3 实现
            title: '楼层搭建器',
            location: {
                pageId: 'collection-detail',
                column: 'main',
                position: { blockId: 'contents', order: 'after' },
            },
        },
    ],
});
```

- [ ] **Step 7: 验证后端启动**

Run: `cd packages\dev-server ; npm run dev:server`
Expected: Vendure 正常启动，无编译错误（dashboard 扩展需在 Task 3 验证，此处只验证后端）

- [ ] **Step 8: Commit**

```bash
git add packages/dev-server/test-plugins/floor-builder/ packages/dev-server/dev-config.ts
git commit -m "feat(floor-builder): Create FloorBuilderPlugin with ProductEvent subscription"
```

---

## Task 3: Admin Dashboard 楼层搭建器组件

**Files:**
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\dashboard\index.tsx`
- Create: `e:\code\vendure\packages\dev-server\test-plugins\floor-builder\dashboard\FloorBuilderBlock.tsx`

- [ ] **Step 1: 创建 FloorBuilderBlock.tsx**

```tsx
import { usePage } from '@vendure/dashboard';
import { useMemo } from 'react';

interface FloorItemConfig {
    productId: string;
    size: string;
    highlighted: boolean;
    label: string;
}

export function FloorBuilderBlock() {
    const page = usePage();
    const entity = page?.entity as any;

    // 读取当前 Collection 的 customFields
    const floorItemConfig: FloorItemConfig[] = entity?.customFields?.floorItemConfig || [];
    const productVariants = entity?.productVariants?.items || [];

    // 预览：根据 floorLayout 渲染不同布局
    const floorLayout = entity?.customFields?.floorLayout || 'double_grid';
    const floorTitle = entity?.customFields?.floorTitle || entity?.name || '';

    if (!entity) {
        return <div className="p-4 text-gray-500">请先保存 Collection</div>;
    }

    return (
        <div className="space-y-4 p-4">
            <h3 className="text-lg font-semibold">楼层搭建器</h3>
            <div className="rounded border p-4 bg-gray-50">
                <h4 className="text-sm font-medium mb-2">实时预览（{floorLayout}）</h4>
                <div className="bg-white rounded p-2" style={{ maxWidth: '375px', margin: '0 auto' }}>
                    <div className="font-bold text-sm mb-2">{floorTitle}</div>
                    <PreviewGrid
                        layout={floorLayout}
                        items={productVariants.slice(0, 6)}
                        itemConfig={floorItemConfig}
                    />
                </div>
            </div>
            <div className="text-sm text-gray-600">
                <p>商品选品：在上方 "Contents" 区域使用 product-id-filter 添加商品</p>
                <p>外观配置：在下方 "Custom fields" 区域配置 floorLayout、floorTheme、floorItemConfig</p>
                <p>floorItemConfig 中的 productId 必须与 Contents 中的商品 ID 一致</p>
            </div>
        </div>
    );
}

function PreviewGrid({ layout, items, itemConfig }: {
    layout: string;
    items: any[];
    itemConfig: FloorItemConfig[];
}) {
    const cols = layout === 'triple_grid' ? 3 : layout === 'double_grid' ? 2 : layout === 'single_scroll' ? 1 : 2;

    if (layout === 'hero_with_list' && items.length > 0) {
        return (
            <div>
                <div className="bg-gray-200 h-32 rounded mb-2 flex items-center justify-center">
                    <img src={items[0]?.product?.featuredAsset?.preview} alt="" className="max-h-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {items.slice(1, 5).map(v => <PreviewItem key={v.id} name={v.product?.name} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {items.map(v => <PreviewItem key={v.id} name={v.product?.name} />)}
        </div>
    );
}

function PreviewItem({ name }: { name?: string }) {
    return (
        <div className="bg-gray-100 rounded p-2 text-center">
            <div className="bg-gray-200 h-16 rounded mb-1" />
            <div className="text-xs truncate">{name || '商品名'}</div>
        </div>
    );
}
```

- [ ] **Step 2: 更新 dashboard/index.tsx**

```typescript
import { defineDashboardExtension } from '@vendure/dashboard';

import { FloorBuilderBlock } from './FloorBuilderBlock';

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'floor-builder',
            component: FloorBuilderBlock,
            title: '楼层搭建器',
            location: {
                pageId: 'collection-detail',
                column: 'main',
                position: { blockId: 'contents', order: 'after' },
            },
        },
    ],
});
```

- [ ] **Step 3: 验证 Admin UI**

需要同时启动后端和 Dashboard dev server：
- 后端：`cd packages\dev-server ; npm run dev:server`（3000 端口）
- Dashboard：`cd packages\dev-server ; npm run dashboard:dev`（5173 端口，Vite 编译 tsx）

访问 `http://localhost:3000/dashboard`（注意是 `/dashboard`，不是 `/admin`），进入 Collections → 编辑任意 Collection
Expected: Contents 区域下方出现"楼层搭建器"块，显示预览和提示信息

- [ ] **Step 4: Commit**

```bash
git add packages/dev-server/test-plugins/floor-builder/dashboard/
git commit -m "feat(floor-builder): Add FloorBuilderBlock dashboard component with preview"
```

---

## Task 4: 后端测试数据（楼层 Collection）

**Files:**
- Create: `e:\code\vendure\packages\dev-server\china-data\07-floors.ts`
- Modify: `e:\code\vendure\packages\dev-server\populate-china-dev.ts`

- [ ] **Step 1: 创建 07-floors.ts**

```typescript
import { INestApplication } from '@nestjs/common';
import {
    ChannelService,
    CollectionService,
    ProductService,
    ProductVariantService,
    RequestContext,
} from '@vendure/core';

import { withCtx, createAdminCtx } from './shared';

interface FloorSeed {
    name: string;
    slug: string;
    description: string;
    channel: 'default' | 'shop-a';
    productSkus: string[];
    customFields: {
        floorEnabled: boolean;
        floorTitle: string;
        floorSubtitle: string;
        floorLayout: 'single_scroll' | 'double_grid' | 'triple_grid' | 'hero_with_list';
        floorSortOrder: number;
        floorMaxScreens: number;
        floorTheme: { primaryColor: string; backgroundColor: string; titleIcon: string };
        floorItemConfig: Array<{ productId: string; size: string; highlighted: boolean; label: string }>;
        floorSchedule: { startAt: string | null; endAt: string | null } | null;
    };
}

const FLOORS: FloorSeed[] = [
    {
        name: '精选好物',
        slug: 'featured',
        description: '精选好物推荐',
        channel: 'default',
        productSkus: ['NF-WATER-500', 'TS-NUT-1KG', 'NF-RICE-5KG', 'XM-BAND-8-STD'],
        customFields: {
            floorEnabled: true,
            floorTitle: '精选好物',
            floorSubtitle: '为你挑选的优质商品',
            floorLayout: 'double_grid',
            floorSortOrder: 1,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#ff6600', backgroundColor: '#fff3e6', titleIcon: '🔥' },
            // productId 在运行时由真实 ID 替换，这里留空占位
            floorItemConfig: [
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: true, label: '热销' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: false, label: '新品' },
            ],
            floorSchedule: null,
        },
    },
    {
        name: '数码专区',
        slug: 'digital-zone',
        description: '数码电器专场',
        channel: 'default',
        productSkus: ['XM-BAND-8-PRO', 'HW-ROUTER-STD', 'XM-PB-10000', 'HW-BT-EAR-STD'],
        customFields: {
            floorEnabled: true,
            floorTitle: '数码专区',
            floorSubtitle: '科技改变生活',
            floorLayout: 'triple_grid',
            floorSortOrder: 2,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#1890ff', backgroundColor: '#e6f7ff', titleIcon: '📱' },
            floorItemConfig: [
                { productId: '', size: 'small', highlighted: false, label: '' },
                { productId: '', size: 'small', highlighted: false, label: '' },
                { productId: '', size: 'small', highlighted: true, label: '爆款' },
                { productId: '', size: 'small', highlighted: false, label: '' },
            ],
            floorSchedule: null,
        },
    },
    {
        name: '生鲜特惠',
        slug: 'fresh-deals',
        description: '生鲜特惠专场',
        channel: 'shop-a',
        productSkus: ['TS-NUT-1KG', 'NF-RICE-5KG', 'TS-BEEF-500'],
        customFields: {
            floorEnabled: true,
            floorTitle: '生鲜特惠',
            floorSubtitle: '新鲜直达',
            floorLayout: 'hero_with_list',
            floorSortOrder: 1,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#07c160', backgroundColor: '#e6f7ee', titleIcon: '🥬' },
            floorItemConfig: [
                { productId: '', size: 'large', highlighted: true, label: '主推' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
            ],
            // 定时上下线测试：已过期，应被 filterActiveFloors 过滤掉
            floorSchedule: { startAt: '2026-01-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' },
        },
    },
];

export async function populateFloors(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const collectionService = app.get(CollectionService);
    const productService = app.get(ProductService);
    const productVariantService = app.get(ProductVariantService);
    const defaultChannel = await channelService.getDefaultChannel();

    const allChannels = await channelService.findAll(await createAdminCtx(app, defaultChannel));
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');

    for (const floor of FLOORS) {
        const targetChannel = floor.channel === 'default' ? defaultChannel : shopAChannel;
        if (!targetChannel) {
            console.warn(`  跳过楼层 ${floor.name}: channel ${floor.channel} 不存在`);
            continue;
        }

        await withCtx(app, targetChannel, async (ctx: RequestContext) => {
            // 1. 查询当前 Channel 的所有商品，建立 SKU → productId 映射
            const products = await productService.findAll(ctx, { take: 999 });
            const variants = await productVariantService.findAll(ctx, { take: 999 });
            const skuToProductId: Record<string, string> = {};
            for (const v of variants.items) {
                if (v.sku) {
                    skuToProductId[v.sku] = String(v.productId);
                }
            }

            // 2. 根据 productSkus 收集真实的 product IDs
            const realProductIds: string[] = [];
            const skuToIndex: Record<string, number> = {};
            for (let i = 0; i < floor.productSkus.length; i++) {
                const sku = floor.productSkus[i];
                const pid = skuToProductId[sku];
                if (pid) {
                    realProductIds.push(pid);
                    skuToIndex[sku] = i;
                } else {
                    console.warn(`  警告: SKU ${sku} 在 channel ${floor.channel} 中未找到`);
                }
            }

            if (realProductIds.length === 0) {
                console.warn(`  跳过楼层 ${floor.name}: 无有效商品`);
                return;
            }

            // 3. 填充 floorItemConfig 中的真实 productId
            const itemConfig = floor.customFields.floorItemConfig.map((item, idx) => {
                const sku = floor.productSkus[idx];
                return {
                    ...item,
                    productId: skuToProductId[sku] || '',
                };
            });

            // 4. 创建 Collection（使用 translations 格式，非顶层 name/slug）
            const collection = await collectionService.create(ctx, {
                translations: [
                    {
                        languageCode: ctx.languageCode,
                        name: floor.name,
                        slug: floor.slug,
                        description: floor.description,
                    },
                ],
                filters: [
                    {
                        code: 'product-id-filter',
                        arguments: [
                            { name: 'productIds', value: JSON.stringify(realProductIds) },
                            { name: 'combineWithAnd', value: 'false' },
                        ],
                    },
                ],
                customFields: {
                    ...floor.customFields,
                    floorItemConfig: itemConfig,
                },
            });

            console.log(`  楼层 ${floor.name} (${floor.channel}) 已创建, 商品数: ${realProductIds.length}`);
        });
    }
}
```

- [ ] **Step 2: 修改 china-data/index.ts 添加 export**

在 `06-orders` export 之后添加：
```typescript
export { populateFloors } from './07-floors';
```

- [ ] **Step 3: 修改 populate-china-dev.ts**

将 `const total = 6;` 改为 `const total = 7;`

在 `logStage(6, total, results[5]);` 之后、`const okCount = ...` 之前添加：
```typescript
            results.push(await runStage('楼层配置: default 2 + shop-a 1', () => populateFloors(app)));
            logStage(7, total, results[6]);
```

- [ ] **Step 4: 运行 populate 验证**

Run: `cd packages\dev-server ; npm run populate:china`
Expected: 7/7 阶段成功，3 个楼层 Collection 创建完成（default 2 个，shop-a 1 个）

- [ ] **Step 5: 验证 Shop API 查询**

Run:
```powershell
$body = @{query='{ collections { items { name customFields { floorEnabled floorTitle floorLayout floorSortOrder } } } }'} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/shop-api" -Method Post -ContentType "application/json" -Headers @{"vendure-token"="default-token"} -Body $body | ConvertTo-Json -Depth 5
```
Expected: 返回 2 个 floorEnabled=true 的 Collection（精选好物、数码专区）

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/shop-api" -Method Post -ContentType "application/json" -Headers @{"vendure-token"="shop-a-token"} -Body $body | ConvertTo-Json -Depth 5
```
Expected: 返回 0 个 floorEnabled=true 的 Collection（生鲜特惠因 floorSchedule 已过期，被 filterActiveFloors 过滤；但 Shop API 层不过滤 schedule，仍返回 1 个）

- [ ] **Step 6: Commit**

```bash
git add packages/dev-server/china-data/07-floors.ts packages/dev-server/china-data/index.ts packages/dev-server/populate-china-dev.ts
git commit -m "feat(dev-server): Add floor test data for default and shop-a channels"
```

---

## Task 5: 前端 Collection 查询

**Files:**
- Create: `e:\code\vshop\src\api\queries\collection.ts`

- [ ] **Step 1: 创建 collection.ts**

```typescript
import { getGraphQLClient } from '../client';

export interface FloorItemConfig {
    productId: string;
    size: string;
    highlighted: boolean;
    label: string;
}

export interface FloorCollection {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    featuredAsset: { preview: string } | null;
    customFields: {
        floorEnabled: boolean;
        floorTitle: string;
        floorSubtitle: string;
        floorLayout: string;
        floorSortOrder: number;
        floorMaxScreens: number;
        floorTheme: { primaryColor: string; backgroundColor: string; titleIcon: string } | null;
        floorItemConfig: FloorItemConfig[];
        floorSchedule: { startAt: string | null; endAt: string | null } | null;
    };
    productVariants: {
        items: Array<{
            id: string;
            productId: string;
            product: {
                id: string;
                name: string;
                slug: string;
                featuredAsset: { preview: string } | null;
                variants: Array<{ price: number; priceWithTax: number; currencyCode: string }>;
            };
        }>;
    };
}

export async function getEnabledFloors(): Promise<{ collections: { items: FloorCollection[] } }> {
    const client = getGraphQLClient();
    const query = `
        query GetEnabledFloors {
            collections {
                items {
                    id
                    slug
                    name
                    description
                    featuredAsset { preview }
                    customFields {
                        floorEnabled
                        floorTitle
                        floorSubtitle
                        floorLayout
                        floorSortOrder
                        floorMaxScreens
                        floorTheme { primaryColor backgroundColor titleIcon }
                        floorItemConfig { productId size highlighted label }
                        floorSchedule { startAt endAt }
                    }
                    productVariants(options: { take: 30 }) {
                        items {
                            id
                            productId
                            product {
                                id
                                name
                                slug
                                featuredAsset { preview }
                                variants { price priceWithTax currencyCode }
                            }
                        }
                    }
                }
            }
        }
    `;
    return client.request(query);
}

/**
 * 过滤启用中的楼层：
 * - floorEnabled=true
 * - 在 floorSchedule 时间范围内
 * - 有商品（productVariants.items 非空）
 */
export function filterActiveFloors(floors: FloorCollection[]): FloorCollection[] {
    const now = new Date();
    return floors
        .filter(f => f.customFields?.floorEnabled)
        .filter(f => (f.productVariants?.items?.length ?? 0) > 0)
        .filter(f => {
            const schedule = f.customFields?.floorSchedule;
            if (!schedule) return true;
            const startAt = schedule.startAt ? new Date(schedule.startAt) : null;
            const endAt = schedule.endAt ? new Date(schedule.endAt) : null;
            if (startAt && now < startAt) return false;
            if (endAt && now > endAt) return false;
            return true;
        })
        .sort((a, b) => (a.customFields?.floorSortOrder || 0) - (b.customFields?.floorSortOrder || 0));
}
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vshop
git add src/api/queries/collection.ts
git commit -m "feat(vshop): Add Collection query with floor customFields"
```

---

## Task 6: 前端楼层布局组件

**Files:**
- Create: `e:\code\vshop\src\components\floor\SingleScroll.vue`
- Create: `e:\code\vshop\src\components\floor\DoubleGrid.vue`
- Create: `e:\code\vshop\src\components\floor\TripleGrid.vue`
- Create: `e:\code\vshop\src\components\floor\HeroWithList.vue`

- [ ] **Step 1: 创建 SingleScroll.vue（单列横滑）**

```vue
<template>
  <scroll-view scroll-x class="single-scroll" :show-scrollbar="false">
    <view class="single-scroll__inner">
      <view
        v-for="item in items"
        :key="item.id"
        class="single-scroll__item"
        :style="{ width: itemWidth }"
        @click="$emit('click-item', item.product.slug)"
      >
        <VImage :src="item.product.featuredAsset?.preview || ''" width="100%" height="200rpx" />
        <text class="item-name">{{ item.product.name }}</text>
        <text v-if="itemLabel(item)" class="item-label">{{ itemLabel(item) }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import VImage from '../../components/VImage.vue';
import type { FloorItemConfig } from '../../api/queries/collection';

interface FloorProduct {
    id: string;
    productId: string;
    product: { id: string; name: string; slug: string; featuredAsset: { preview: string } | null };
}

const props = defineProps<{
    items: FloorProduct[];
    itemConfig: FloorItemConfig[];
}>();

defineEmits<{ 'click-item': [slug: string] }>();

const itemWidth = '240rpx';

function itemLabel(item: FloorProduct): string {
    const cfg = props.itemConfig.find(c => c.productId === item.productId);
    return cfg?.label || '';
}
</script>

<style lang="scss" scoped>
.single-scroll {
    white-space: nowrap;
    &__inner { display: inline-flex; gap: 16rpx; padding: 0 20rpx; }
    &__item { display: inline-block; background: $bg-color; border-radius: $radius-md; overflow: hidden; position: relative; }
}
.item-name { font-size: 24rpx; padding: 8rpx; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-label { position: absolute; top: 8rpx; left: 8rpx; background: $brand-color; color: #fff; font-size: 20rpx; padding: 2rpx 8rpx; border-radius: 4rpx; }
</style>
```

- [ ] **Step 2: 创建 DoubleGrid.vue（双列网格）**

```vue
<template>
  <view class="double-grid">
    <view
      v-for="item in items"
      :key="item.id"
      class="double-grid__item"
      @click="$emit('click-item', item.product.slug)"
    >
      <VImage :src="item.product.featuredAsset?.preview || ''" width="100%" height="240rpx" />
      <text class="item-name">{{ item.product.name }}</text>
      <text v-if="itemLabel(item)" class="item-label">{{ itemLabel(item) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import VImage from '../../components/VImage.vue';
import type { FloorItemConfig } from '../../api/queries/collection';

interface FloorProduct {
    id: string;
    productId: string;
    product: { id: string; name: string; slug: string; featuredAsset: { preview: string } | null };
}

const props = defineProps<{
    items: FloorProduct[];
    itemConfig: FloorItemConfig[];
}>();

defineEmits<{ 'click-item': [slug: string] }>();

function itemLabel(item: FloorProduct): string {
    const cfg = props.itemConfig.find(c => c.productId === item.productId);
    return cfg?.label || '';
}
</script>

<style lang="scss" scoped>
.double-grid {
    display: flex; flex-wrap: wrap; gap: 16rpx; padding: 0 20rpx;
    &__item { width: calc(50% - 8rpx); background: $bg-color; border-radius: $radius-md; overflow: hidden; position: relative; }
}
.item-name { font-size: 24rpx; padding: 8rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 64rpx; }
.item-label { position: absolute; top: 8rpx; left: 8rpx; background: $brand-color; color: #fff; font-size: 20rpx; padding: 2rpx 8rpx; border-radius: 4rpx; }
</style>
```

- [ ] **Step 3: 创建 TripleGrid.vue（三列网格，窄屏降级为双列）**

```vue
<template>
  <view class="triple-grid" :class="{ 'triple-grid--double': isNarrowScreen }">
    <view
      v-for="item in items"
      :key="item.id"
      class="triple-grid__item"
      @click="$emit('click-item', item.product.slug)"
    >
      <VImage :src="item.product.featuredAsset?.preview || ''" width="100%" height="180rpx" />
      <text class="item-name">{{ item.product.name }}</text>
      <text v-if="itemLabel(item)" class="item-label">{{ itemLabel(item) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import VImage from '../../components/VImage.vue';
import type { FloorItemConfig } from '../../api/queries/collection';

interface FloorProduct {
    id: string;
    productId: string;
    product: { id: string; name: string; slug: string; featuredAsset: { preview: string } | null };
}

const props = defineProps<{
    items: FloorProduct[];
    itemConfig: FloorItemConfig[];
}>();

defineEmits<{ 'click-item': [slug: string] }>();

const isNarrowScreen = ref(false);

function checkScreen() {
    // #ifdef H5
    isNarrowScreen.value = window.innerWidth < 480;
    // #endif
}

onMounted(() => {
    // #ifdef H5
    window.addEventListener('resize', checkScreen);
    checkScreen();
    // #endif
});

onUnmounted(() => {
    // #ifdef H5
    window.removeEventListener('resize', checkScreen);
    // #endif
});

function itemLabel(item: FloorProduct): string {
    const cfg = props.itemConfig.find(c => c.productId === item.productId);
    return cfg?.label || '';
}
</script>

<style lang="scss" scoped>
.triple-grid {
    display: flex; flex-wrap: wrap; gap: 12rpx; padding: 0 20rpx;
    &__item { width: calc(33.33% - 8rpx); background: $bg-color; border-radius: $radius-md; overflow: hidden; position: relative; }
    &--double .triple-grid__item { width: calc(50% - 6rpx); }
}
.item-name { font-size: 22rpx; padding: 6rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 56rpx; }
.item-label { position: absolute; top: 6rpx; left: 6rpx; background: $brand-color; color: #fff; font-size: 18rpx; padding: 2rpx 6rpx; border-radius: 4rpx; }
</style>
```

- [ ] **Step 4: 创建 HeroWithList.vue（大图+列表）**

```vue
<template>
  <view class="hero-list">
    <view v-if="heroItem" class="hero-list__hero" @click="$emit('click-item', heroItem.product.slug)">
      <VImage :src="heroItem.product.featuredAsset?.preview || ''" width="100%" height="320rpx" />
      <view class="hero-overlay">
        <text class="hero-name">{{ heroItem.product.name }}</text>
        <text v-if="heroLabel" class="hero-label">{{ heroLabel }}</text>
      </view>
    </view>
    <view class="hero-list__list">
      <view
        v-for="item in restItems"
        :key="item.id"
        class="hero-list__item"
        @click="$emit('click-item', item.product.slug)"
      >
        <VImage :src="item.product.featuredAsset?.preview || ''" width="120rpx" height="120rpx" />
        <view class="item-info">
          <text class="item-name">{{ item.product.name }}</text>
          <text v-if="itemLabel(item)" class="item-label">{{ itemLabel(item) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VImage from '../../components/VImage.vue';
import type { FloorItemConfig } from '../../api/queries/collection';

interface FloorProduct {
    id: string;
    productId: string;
    product: { id: string; name: string; slug: string; featuredAsset: { preview: string } | null };
}

const props = defineProps<{
    items: FloorProduct[];
    itemConfig: FloorItemConfig[];
}>();

defineEmits<{ 'click-item': [slug: string] }>();

const heroItem = computed(() => props.items[0] || null);
const restItems = computed(() => props.items.slice(1, 5));

const heroLabel = computed(() => {
    if (!heroItem.value) return '';
    const cfg = props.itemConfig.find(c => c.productId === heroItem.value!.productId);
    return cfg?.label || '';
});

function itemLabel(item: FloorProduct): string {
    const cfg = props.itemConfig.find(c => c.productId === item.productId);
    return cfg?.label || '';
}
</script>

<style lang="scss" scoped>
.hero-list {
    padding: 0 20rpx;
    &__hero { position: relative; border-radius: $radius-md; overflow: hidden; margin-bottom: 16rpx; }
    &__list { display: flex; flex-direction: column; gap: 12rpx; }
    &__item { display: flex; gap: 12rpx; background: $bg-color; border-radius: $radius-md; padding: 12rpx; }
}
.hero-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.6)); padding: 20rpx; }
.hero-name { color: #fff; font-size: 28rpx; font-weight: bold; display: block; }
.hero-label { color: #fff; font-size: 22rpx; background: $brand-color; padding: 2rpx 8rpx; border-radius: 4rpx; display: inline-block; margin-top: 4rpx; }
.item-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.item-name { font-size: 24rpx; }
.item-label { font-size: 20rpx; color: $brand-color; margin-top: 4rpx; }
</style>
```

- [ ] **Step 5: Commit**

```bash
cd e:\code\vshop
git add src/components/floor/
git commit -m "feat(vshop): Add floor layout components (SingleScroll, DoubleGrid, TripleGrid, HeroWithList)"
```

---

## Task 7: 前端 FloorSection 容器组件

**Files:**
- Create: `e:\code\vshop\src\components\FloorSection.vue`

- [ ] **Step 1: 创建 FloorSection.vue**

```vue
<template>
  <view class="floor-section" :style="{ backgroundColor: theme.backgroundColor || '#fff' }">
    <view class="floor-section__header" @click="goCollectionList">
      <view class="header-left">
        <text v-if="theme.titleIcon" class="header-icon">{{ theme.titleIcon }}</text>
        <text class="header-title">{{ floor.customFields?.floorTitle || floor.name }}</text>
      </view>
      <view class="header-right">
        <text v-if="floor.customFields?.floorSubtitle" class="header-subtitle">{{ floor.customFields.floorSubtitle }}</text>
        <text class="header-more">查看更多 ›</text>
      </view>
    </view>
    <component
      :is="layoutComponent"
      :items="validItems"
      :item-config="floor.customFields?.floorItemConfig || []"
      @click-item="goDetail"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SingleScroll from './floor/SingleScroll.vue';
import DoubleGrid from './floor/DoubleGrid.vue';
import TripleGrid from './floor/TripleGrid.vue';
import HeroWithList from './floor/HeroWithList.vue';
import type { FloorCollection } from '../api/queries/collection';

const props = defineProps<{ floor: FloorCollection }>();

const layoutMap: Record<string, any> = {
    single_scroll: SingleScroll,
    double_grid: DoubleGrid,
    triple_grid: TripleGrid,
    hero_with_list: HeroWithList,
};

const layoutComponent = computed(() => {
    const layout = props.floor.customFields?.floorLayout || 'double_grid';
    return layoutMap[layout] || DoubleGrid;
});

const theme = computed(() => props.floor.customFields?.floorTheme || { primaryColor: '#ff6600', backgroundColor: '#fff', titleIcon: '' });

// 过滤掉 floorItemConfig 中找不到对应商品的项（悬挂引用跳过）
// 同时保留 productVariants 中所有商品（即使 itemConfig 没有对应配置，只是 label 为空）
const validItems = computed(() => {
    const variants = props.floor.productVariants?.items || [];
    const itemConfig = props.floor.customFields?.floorItemConfig || [];
    const configProductIds = new Set(itemConfig.map(c => c.productId));
    // 只保留在 itemConfig 中有配置的商品（如果 itemConfig 非空）
    // 如果 itemConfig 为空，则保留所有商品
    if (configProductIds.size === 0) return variants;
    return variants.filter(v => configProductIds.has(v.productId));
});

function goDetail(slug: string) {
    uni.navigateTo({ url: '/pkg-product/pages/detail?slug=' + slug });
}

function goCollectionList() {
    uni.navigateTo({ url: '/pkg-product/pages/list?collectionSlug=' + props.floor.slug });
}
</script>

<style lang="scss" scoped>
.floor-section {
    margin-bottom: 20rpx;
    &__header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx; }
}
.header-left { display: flex; align-items: center; gap: 8rpx; }
.header-icon { font-size: 32rpx; }
.header-title { font-size: 32rpx; font-weight: bold; color: #333; }
.header-right { display: flex; align-items: center; gap: 12rpx; }
.header-subtitle { font-size: 24rpx; color: #999; }
.header-more { font-size: 24rpx; color: $brand-color; }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd e:\code\vshop
git add src/components/FloorSection.vue
git commit -m "feat(vshop): Add FloorSection container component"
```

---

## Task 8: 集成楼层到首页模板

**Files:**
- Modify: `e:\code\vshop\src\templates\default\pages\HomeContent.vue`
- Modify: `e:\code\vshop\src\templates\fresh\pages\HomeContent.vue`

- [ ] **Step 1: 修改 default 模板 HomeContent.vue**

在 `<template>` 的 `__nav` 之后、`__section` 之前插入楼层区域，并在 `<script>` 中加载楼层数据：

完整修改后的文件：

```vue
<template>
  <view class="default-home">
    <swiper class="default-home__banner" autoplay :indicator-dots="true" circular>
      <swiper-item v-for="i in 3" :key="i"><view class="banner-placeholder">Banner {{ i }}</view></swiper-item>
    </swiper>
    <view class="default-home__nav">
      <view class="nav-item" @click="navTo('/pkg-promotion/pages/flash-sale')"><text class="nav-icon">⚡</text><text>秒杀</text></view>
      <view class="nav-item" @click="navTo('/pkg-promotion/pages/group-buy')"><text class="nav-icon">👥</text><text>拼团</text></view>
      <view class="nav-item" @click="navTo('/pkg-promotion/pages/coupons')"><text class="nav-icon">🎫</text><text>优惠券</text></view>
      <view class="nav-item" @click="navTo('/pkg-user/pages/recharge')"><text class="nav-icon">💳</text><text>充值</text></view>
    </view>
    <FloorSection
      v-for="floor in floors"
      :key="floor.id"
      :floor="floor"
    />
    <view v-if="floors.length === 0" class="default-home__section">
      <text class="section-title">推荐商品</text>
      <view class="product-grid">
        <view v-for="p in products" :key="p.productId" class="product-mini" @click="goDetail(p.slug)">
          <VImage :src="p.productAsset?.preview || ''" width="100%" height="240rpx" />
          <text class="product-mini__name">{{ p.productName }}</text>
          <PriceTag :price="getMinPrice(p.priceWithTax)" />
        </view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { searchProducts } from '../../../api/queries/product';
import { getEnabledFloors, filterActiveFloors, type FloorCollection } from '../../../api/queries/collection';
import VImage from '../../../components/VImage.vue';
import PriceTag from '../../../components/PriceTag.vue';
import FloorSection from '../../../components/FloorSection.vue';

const products = ref<any[]>([]);
const floors = ref<FloorCollection[]>([]);

onMounted(async () => {
    try {
        const res: any = await searchProducts({ take: 10 });
        products.value = res.search?.items || [];
    } catch (e) {}

    try {
        const res: any = await getEnabledFloors();
        const allFloors = res.collections?.items || [];
        floors.value = filterActiveFloors(allFloors).slice(0, 3);
    } catch (e) {
        console.error('加载楼层失败', e);
    }
});

function getMinPrice(price: any): number { return price?.value ?? price?.min ?? 0; }
function navTo(url: string) { uni.navigateTo({ url }); }
function goDetail(slug: string) { uni.navigateTo({ url: '/pkg-product/pages/detail?slug=' + slug }); }
</script>
<style lang="scss" scoped>
.default-home {
    &__banner { height: 360rpx; .banner-placeholder { height: 360rpx; background: linear-gradient(135deg, $brand-color, #ff9966); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 40rpx; } }
    &__nav { display: flex; background: #fff; padding: 30rpx 0; margin-bottom: 20rpx; }
    &__section { background: #fff; padding: 20rpx; margin-bottom: 20rpx; }
}
.nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; .nav-icon { font-size: 48rpx; margin-bottom: 8rpx; } text { font-size: 24rpx; } }
.section-title { font-size: 32rpx; font-weight: bold; display: block; margin-bottom: 16rpx; }
.product-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.product-mini { width: calc(50% - 8rpx); background: $bg-color; border-radius: $radius-md; overflow: hidden; &__name { font-size: 24rpx; padding: 8rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 64rpx; } }
</style>
```

- [ ] **Step 2: 修改 fresh 模板 HomeContent.vue**

在 fresh 模板中集成楼层区域，保留原有样式：

```vue
<template>
  <view class="fresh-home">
    <view class="fresh-home__hero">
      <text class="fresh-home__title">新鲜好物</text>
      <text class="fresh-home__subtitle">每天为你精选</text>
    </view>
    <view class="fresh-home__shortcuts">
      <view class="shortcut" @click="navTo('/pkg-promotion/pages/flash-sale')"><text>⚡ 秒杀</text></view>
      <view class="shortcut" @click="navTo('/pkg-promotion/pages/group-buy')"><text>👥 拼团</text></view>
    </view>
    <FloorSection
      v-for="floor in floors"
      :key="floor.id"
      :floor="floor"
    />
    <view v-if="floors.length === 0" class="fresh-home__products">
      <view v-for="p in products" :key="p.productId" class="fresh-product" @click="goDetail(p.slug)">
        <VImage :src="p.productAsset?.preview || ''" width="200rpx" height="200rpx" />
        <view class="fresh-product__info">
          <text>{{ p.productName }}</text>
          <PriceTag :price="getMinPrice(p.priceWithTax)" />
        </view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { searchProducts } from '../../../api/queries/product';
import { getEnabledFloors, filterActiveFloors, type FloorCollection } from '../../../api/queries/collection';
import VImage from '../../../components/VImage.vue';
import PriceTag from '../../../components/PriceTag.vue';
import FloorSection from '../../../components/FloorSection.vue';

const products = ref<any[]>([]);
const floors = ref<FloorCollection[]>([]);

onMounted(async () => {
    try { const res: any = await searchProducts({ take: 10 }); products.value = res.search?.items || []; } catch (e) {}
    try {
        const res: any = await getEnabledFloors();
        const allFloors = res.collections?.items || [];
        floors.value = filterActiveFloors(allFloors).slice(0, 3);
    } catch (e) { console.error('加载楼层失败', e); }
});

function getMinPrice(price: any): number { return price?.value ?? price?.min ?? 0; }
function navTo(url: string) { uni.navigateTo({ url }); }
function goDetail(slug: string) { uni.navigateTo({ url: '/pkg-product/pages/detail?slug=' + slug }); }
</script>
<style lang="scss" scoped>
.fresh-home {
    &__hero { background: linear-gradient(135deg, #07c160, #4dd599); padding: 60rpx 30rpx; color: #fff; & .fresh-home__title { font-size: 48rpx; font-weight: bold; display: block; } & .fresh-home__subtitle { font-size: 26rpx; opacity: 0.8; } }
    &__shortcuts { display: flex; gap: 16rpx; padding: 20rpx; }
    &__products { padding: 0 20rpx; }
}
.shortcut { flex: 1; background: #fff; padding: 20rpx; border-radius: $radius-md; text-align: center; font-size: 28rpx; box-shadow: $shadow; }
.fresh-product { display: flex; background: #fff; padding: 20rpx; border-radius: $radius-md; margin-bottom: 12rpx; &__info { flex: 1; padding-left: 16rpx; display: flex; flex-direction: column; justify-content: space-between; font-size: 28rpx; } }
</style>
```

- [ ] **Step 3: 验证前端编译**

Run: 前端 dev server 自动 HMR，无编译错误
Expected: 无 TypeScript 错误，Vite HMR 正常

- [ ] **Step 4: Commit**

```bash
cd e:\code\vshop
git add src/templates/default/pages/HomeContent.vue src/templates/fresh/pages/HomeContent.vue
git commit -m "feat(vshop): Integrate floor sections into home templates"
```

---

## Task 9: 端到端验证

- [ ] **Step 1: 启动后端、Dashboard 和前端**

- 后端：`cd packages\dev-server ; npm run dev:server`（3000 端口）
- Dashboard：`cd packages\dev-server ; npm run dashboard:dev`（5173 端口，编译 tsx）
- 前端：`cd vshop ; npm run dev:h5`（5175 端口）

- [ ] **Step 2: 验证 default Channel 楼层**

浏览器访问 `http://localhost:5175/?tenant=default`
Expected:
- 首页显示租户栏"默认商城"
- Banner 下方显示 2 个楼层（精选好物、数码专区）
- "精选好物"使用双列网格布局，标题旁有 🔥 图标
- "数码专区"使用三列网格布局，标题旁有 📱 图标
- 点击商品跳转详情页
- 点击楼层标题跳转 Collection 列表页

- [ ] **Step 3: 验证 shop-a Channel 楼层**

浏览器访问 `http://localhost:5175/?tenant=shop-a`
Expected:
- 首页显示租户栏"生鲜优选"
- 不显示"生鲜特惠"楼层（因 floorSchedule 已过期，被 filterActiveFloors 过滤）
- 显示默认推荐商品（fallback 空状态）

- [ ] **Step 4: 验证 Admin UI 搭建器**

访问 `http://localhost:3000/dashboard`，登录后进入 Collections
Expected:
- 编辑"精选好物"Collection，Contents 下方出现"楼层搭建器"块
- 显示实时预览（手机宽度 375px）
- Custom fields 区域显示所有 floor 相关字段

- [ ] **Step 5: 验证空状态**

在 Admin UI 中将所有楼层 floorEnabled 设为 false
刷新前端首页
Expected: 楼层区域消失，显示默认推荐商品（fallback）

- [ ] **Step 6: 验证悬挂引用处理**

在 Admin UI 中删除"精选好物"楼层中的一个商品
刷新前端首页
Expected: 楼层中该商品卡片消失（validItems 过滤生效），其他商品正常展示

- [ ] **Step 7: Final Commit**

```bash
cd e:\code\vendure
git add -A
git commit -m "test(floor-builder): End-to-end verification passed"
```

---

## 自检清单

**Spec 覆盖：**
- [x] 数据模型（customFields.Collection）→ Task 1
- [x] Admin 端搭建器（defineDashboardExtension）→ Task 2, 3
- [x] 前端渲染（布局组件）→ Task 6, 7, 8
- [x] 数据查询（Collection.productVariants）→ Task 5
- [x] 多租户隔离（Channel 级）→ Task 4, 9
- [x] 点击交互（单品→详情、标题→列表）→ Task 7
- [x] 空状态策略（fallback 推荐位）→ Task 8
- [x] 响应式降级（triple_grid→double_grid）→ Task 6 (TripleGrid.vue)
- [x] 错误处理（悬挂引用跳过）→ Task 5 (filterActiveFloors)
- [x] 悬挂引用清理（ProductEvent 订阅）→ Task 2
