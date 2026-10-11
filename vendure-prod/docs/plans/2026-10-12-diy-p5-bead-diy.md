# P5 · bead-diy C 端对接 Vendure shop-api 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bead-diy 小程序从本地 mock 切换到 Vendure shop-api 真实数据源：分类/素材走 `diyCategories`/`diyMaterials`，算量换用与后端同构的 `@diy/calc`（vendor 源码拷贝），作品保存匿名落库 `createDiyPlan`（draft），works 记录 planId。登录/报价/下单留 P6。

**Architecture:** 三层改造——① 后端补一个 Public 分类查询 + 一个幂等 populate 脚本灌 18 颗 mock 珠（按直径档位展开成多 SKU，`attrs.group` 分组键沿用 mock id）；② bead-diy 把 `@diy/calc` 源码 vendor 进 `src/vendor/diy-calc`，engine/calc.ts 变成「领域模型 → CalculatorInput → 结果回译」适配层；③ 数据层新增 `src/api/`（gql client + documents + plans），repository 切 RemoteBeadRepository，mapper 按 `attrs.group` 聚合成带 `variants` 的组材质。

**Tech Stack:** Vendure 3 + typeorm（后端）；Taro 4.3 + React + zustand + vitest（小程序）；PowerShell 环境。

**关联文档:**
- 规格：`d:\zhao\vendure\vendure-prod\docs\specs\2026-10-11-diy-plugin-design.md`（附录 A 领域模型映射）
- P1-P4 计划：`d:\zhao\vendure\vendure-prod\docs\plans\2026-10-11-diy-plugin-p1-p4.md`

---

## 全局约定（每个 subagent 必读）

1. **仓库路径**：
   - 后端 monorepo：`d:\zhao\vendure`（pnpm workspace，包在 `packages/`）
   - 小程序：`D:\zhao\bead-diy`（npm，**尚无 .git**，嵌在 D:\zhao mono 仓库内且未跟踪——T7 才做 git init，之前不要碰它的 git）
2. **PowerShell 硬规范**：不支持 `&&`（用 `;` 分隔）；curl JSON body 必须写临时文件 + `--data-binary "@文件路径"`；多行 commit message 用 `[IO.File]::WriteAllText($p,$msg,[Text.UTF8Encoding]::new($false))` 写临时文件 + `git commit -F`。
3. **vendure 仓库工作区有与本任务无关的脏文件**（deploy-pack.js、pnpm-lock.yaml 等）——**提交一律 path-scoped**（明确 `git add <具体路径>`，禁止 `git add -A`/`git add .`）。
4. **单位与语言**：后端金额一律「分」整数，bead-diy 显示层一律「元」；后端 `LocalizedText` jsonb 键为 `zh-CN`/`en-US`；长度 mm。
5. **算量同构铁律**：C 端演示与后端复算必须走同一套 `@diy/calc` 纯函数。语义要点：`braceletCalculator` 只处理 main/focal/spacer 三角色；**focal 固定 1 颗**；spacer 数量 = `floor(total/(every+1))`；`easeOf(fit)`: snug→4 / 其余→10 / loose→20（bead-diy 的 `'comfort'` 落 default=10，与后端 `'comfortable'` 等效）；`L_center = W + ease + π·d`（内径修正项）；BOM 金额单位分。
6. **直径档位 = 多 SKU**：后端每个直径一行 `DiyMaterial`（货号含直径段，如 `AG-RED-08-N`）。populate 把 mock 每颗珠按 `availableDiameters` 展开成多行，`attrs = { group: <mock id>, defaultDiameter, weightPerBead }`。C 端按 `attrs.group` 聚合成组材质（`id` = group = mock id，如 `'agate-red'`，`DEFAULT_MAIN_BEAD_ID` 等常量无需改）。
7. **P5 最小闭环边界**：不做登录、不接 quoteDiyPlan/createOrderFromPlan/myDiyPlans；`createDiyPlan` 本就是 Public（匿名 → DiyPlan.userId=null, status=draft）。
8. **手机截图硬规范**：Playwright 移动视口 390×844，`device_scale_factor=2`；截图入库到 `D:\zhao\bead-diy\docs\manual\shots\<日期-主题>\`。
9. **禁止硬编码生产域名**：bead-diy 的 API 地址走构建期常量（env 注入），dev 默认 `http://localhost:3000/shop-api`（shop-api 端口 = `process.env.API_PORT || 3000`）。

## 现有代码关键事实（免重复探索）

**后端（均已核实，直接引用）：**
- `packages/diy-plugin/src/diy-shop.resolver.ts`：已有 diyMaterials/diyShopTemplates/diyShopTemplate/createDiyPlan(Public)；**无 diyCategories**。
- `packages/diy-plugin/src/diy-shop.service.ts`：`findShopMaterials(ctx, filter)` 两层合并内存过滤；`createDiyPlan` 校验 required 槽位→`runDiyCalc`→draft 落库。
- `packages/diy-plugin/src/diy-plugin.ts`：shopSchema 里 **没有 DiyCategory type**（admin schema 里有）。
- `packages/diy-plugin/src/material-merge.ts`：纯函数模块（单测在 `src/__tests__/material-merge.spec.ts`）。
- `packages/diy-plugin/src/seed.ts`：种 7 个平台分类（crystal/agate/wood/amber/pearl/metal/gemstone，**无 spacer**）+ 模板 `bracelet-classic`（slots: main required / focal fixed=1 / spacer user [0,40] defaultEvery=2；params: wristSize 120-200 / fit enum / gap 0-2）。
- `packages/diy-plugin/src/entities/diy-material.entity.ts`：id(number)/code/name(LocalizedText simple-json)/categoryId(int)/shape/diameter/axialLength/holeSize(float nullable)/attrs(simple-json)/render(simple-json)/price(int 分)/priceUnit(default 'piece')/currency('CNY')/stock(int)/images/sourceMaterialId/enabled/sortOrder。
- `packages/diy-plugin/src/calc-bridge.ts`：runDiyCalc 把 spec.slots 映射为 SlotSelection；未知 slot 键抛错。
- 单测位置：`packages/diy-plugin/src/__tests__/*.spec.ts`（vitest，跑法见 diy-plugin/package.json 的 test script）。
- dev server：`packages/dev-server/dev-config.ts:399` 已注册 `DiyPlugin.init({ app })`；postgres 连接 env 在 571 行附近（subagent 自行查看变量名）。

**bead-diy（均已核实）：**
- `src/types.ts`：`BeadMaterial{id,code,name,category(7 枚举,无 gemstone 有 spacer),shape,beadDiameter,beadLength,holeSize,availableDiameters,priceUnit(元),currency,stock,renderSpec,weightPerBead?}`；`BraceletSpec{wristSize,ease('snug'|'comfort'|'loose'),layoutMode,mainMaterialId,diameter,gap,seed,secondaryMaterialId?,spacerEnabled?,spacerId?,spacerEvery?,focalId?,focalCount?,focalPosition?,viewTilt,rotation}`；`WorkRecord{id,name,createdAt,updatedAt,spec,totalAmount,thumbnail?}`。
- `src/data/repository.ts`：`BeadRepository` 接口（listMaterials/getMaterial/getByCode/priceOf）+ LocalBeadRepository + `DEFAULT_MAIN_BEAD_ID='agate-red'` / `DEFAULT_SECONDARY_BEAD_ID='metal-gold'` / `DEFAULT_FOCAL_BEAD_ID='amber-yellow'`。
- `src/data/mapper.ts`：旧 RemoteBeadDTO（与后端不符，**整体重写**）。
- `src/engine/calc.ts`：本地旧算量（缺 π·d 修正，**整体重写为适配层**）；导出 `DIAMETER_PRESETS` 需保留。
- `src/engine/derive.ts`：`deriveBracelet(spec, materials)` → `{calc, slots, bom, lookup, mainMaterial}`（签名保留）。
- `src/engine/layout.ts` buildSlots、`src/utils/geo`、`src/utils/prng`：**不动**。
- `src/engine/bom.ts` buildBOM：**重写为 BOM 回译适配**（spacer 旧实现根本没进 BOM，新版由 calc 产出 spacer 行，是行为增强）。
- `src/store/designer-store.ts`：`load()` 调 `beadRepository.listMaterials()`；focal 相关 setter 已存在（`setFocalCount` 钳 0..3——后端 focal 固定 1 颗，本计划不改 UI 钳位，但 calc/落库按 1 颗口径）。
- `src/pages/works/index.tsx`：`saveWork(spec, totalAmount)` 同步保存到 Taro storage；`src/utils/works.ts`。
- `src/data/beads.mock.json`：**18 颗珠**（4 crystal/3 agate/2 wood/2 amber/2 pearl/3 metal/2 spacer），priceUnit 元，T3 后仅供测试 fixture。
- 测试：`tests/calc.test.ts`（引 engine/calc + engine/layout，**重写**）、`tests/engine-snapshot.test.ts`（T3 执行时读取并更新）。
- `config/index.ts`：`defineConstants: {}`（T4 填充）；H5 dev server 端口 **10086**（hash 路由）；alias @/@engine/@data/@store/@components。
- `package.json`：scripts 有 typecheck/test/build:weapp/dev:h5。

---

### Task 1: 后端 diyCategories C 端查询

**Files:**
- Modify: `d:\zhao\vendure\packages\diy-plugin\src\material-merge.ts`（追加纯函数）
- Modify: `d:\zhao\vendure\packages\diy-plugin\src\diy-shop.service.ts`
- Modify: `d:\zhao\vendure\packages\diy-plugin\src\diy-shop.resolver.ts`
- Modify: `d:\zhao\vendure\packages\diy-plugin\src\diy-plugin.ts`（shopSchema）
- Test: `d:\zhao\vendure\packages\diy-plugin\src\__tests__\material-merge.spec.ts`

- [ ] **Step 1: 在 material-merge.ts 追加纯函数 unionCategories**

```typescript
/** C 端分类并集（规格 §7）：平台 + 租户两层直拼，过滤 enabled 且有 code 的行，sortOrder/id 升序 */
export function unionCategories<T extends { id: number; code: string | null; enabled: boolean; sortOrder: number }>(
    platform: T[],
    tenant: T[],
): T[] {
    return [...platform, ...tenant]
        .filter(c => c.enabled && !!c.code)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
```

- [ ] **Step 2: 写失败单测（material-merge.spec.ts 追加）**

```typescript
describe('unionCategories', () => {
    const row = (id: number, code: string | null, enabled = true, sortOrder = 0) =>
        ({ id, code, enabled, sortOrder });
    it('平台 + 租户并集，过滤 disabled 与无 code 行', () => {
        const r = unionCategories(
            [row(1, 'crystal'), row(2, 'agate', false), row(3, null)],
            [row(4, 'spacer'), row(5, 'metal', false)],
        );
        expect(r.map(c => c.code)).toEqual(['crystal', 'spacer']);
    });
    it('按 sortOrder 升序，同序按 id', () => {
        const r = unionCategories([row(2, 'b', true, 1), row(1, 'a', true, 1), row(3, 'c', true, 0)]);
        expect(r.map(c => c.code)).toEqual(['c', 'a', 'b']);
    });
});
```

- [ ] **Step 3: 跑测试确认先失败后过**

Run: `pnpm --filter @vendure/diy-plugin test -- material-merge`（在 `d:\zhao\vendure` 下；若 filter 名不对，读 `packages/diy-plugin/package.json` 的 name/test script 修正）
Expected: 先 FAIL（函数不存在）→ 实现后 PASS

- [ ] **Step 4: service 加方法（diy-shop.service.ts，import unionCategories 与 DiyCategory）**

```typescript
/** C 端分类列表：平台 + 租户两层并集（无覆盖），仅 enabled，sortOrder 升序 */
async findShopCategories(ctx: RequestContext): Promise<DiyCategory[]> {
    const repo = this.connection.getRepository(ctx, DiyCategory);
    const [platform, tenant] = await Promise.all([
        repo.find({ where: { app: IsNull() } }),
        repo.find({ where: { app: this.app } }),
    ]);
    return unionCategories(platform, tenant);
}
```

- [ ] **Step 5: resolver 加查询（diy-shop.resolver.ts，import DiyCategory）**

```typescript
@Query()
@Allow(Permission.Public)
async diyCategories(@Ctx() ctx: RequestContext): Promise<DiyCategory[]> {
    return this.service.findShopCategories(ctx);
}
```

- [ ] **Step 6: shopSchema 补 type 与 Query（diy-plugin.ts 的 shopSchema，紧跟 `type DiyMaterialList` 之前插入 type，Query 里加一行）**

```graphql
type DiyCategory {
    id: ID!
    app: String
    code: String
    name: JSON
    image: String
    sortOrder: Int!
    enabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
}
```
在 `extend type Query { diyMaterials(filter: JSON): DiyMaterialList! ... }` 中追加：`diyCategories: [DiyCategory!]!`

- [ ] **Step 7: 全量回归 + 提交**

Run: `pnpm --filter @vendure/diy-plugin test`
Commit（path-scoped）:
```powershell
git -C d:\zhao\vendure add packages/diy-plugin/src/material-merge.ts packages/diy-plugin/src/diy-shop.service.ts packages/diy-plugin/src/diy-shop.resolver.ts packages/diy-plugin/src/diy-plugin.ts packages/diy-plugin/src/__tests__/material-merge.spec.ts
git -C d:\zhao\vendure commit -m "feat(diy-plugin): add public diyCategories shop query"
```

---

### Task 2: populate 脚本灌 mock 素材（直径展开多 SKU）

**Files:**
- Create: `d:\zhao\vendure\packages\diy-plugin\scripts\beads-mock.json`（从 `D:\zhao\bead-diy\src\data\beads.mock.json` 原样拷贝）
- Create: `d:\zhao\vendure\packages\diy-plugin\scripts\populate-beads.ts`

- [ ] **Step 1: 拷贝 mock json 到 scripts/ 并读取 dev-config.ts:555-585 确定 postgres env 变量名**

- [ ] **Step 2: 写 populate-beads.ts（幂等 upsert，按 (app, code) 匹配）**

```typescript
/**
 * P5 mock 素材灌库脚本（幂等，可重复执行）：
 * - 读 beads-mock.json（与 bead-diy mock 同源），按 availableDiameters 展开为多行 DiyMaterial（直径档位=多 SKU）
 * - attrs = { group: <mock id>, defaultDiameter, weightPerBead }（C 端按 group 聚合）
 * - 补种 'spacer' 平台分类（seed.ts 无此分类）
 * - 价格 元→分（×100）；app=null 平台库
 * 运行：pnpm exec ts-node --transpile-only -P packages/diy-plugin/tsconfig.json packages/diy-plugin/scripts/populate-beads.ts
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { DiyCategory } from '../src/entities/diy-category.entity';
import { DiyMaterial } from '../src/entities/diy-material.entity';
import beadsRaw from './beads-mock.json';

interface MockBead {
    id: string; code: string; name: string; category: string; shape: string;
    beadDiameter: number; beadLength: number; holeSize: number;
    availableDiameters: number[]; priceUnit: number; stock: number;
    weightPerBead?: number; renderSpec: Record<string, any>;
}

// ↓ 连接参数变量名从 dev-config.ts postgres 段（~571 行）抄，保持一致
const ds = new DataSource({
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'vendure',
    entities: [DiyCategory, DiyMaterial],
    synchronize: false,
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const variantCode = (code: string, d: number) =>
    code.replace(/^([A-Z]+)-([A-Z]+)-\d{2}-([A-Z]+)$/, `$1-$2-${pad2(d)}-$3`);

async function main() {
    await ds.initialize();
    const beads = beadsRaw as unknown as MockBead[];
    const catRepo = ds.getRepository(DiyCategory);
    const matRepo = ds.getRepository(DiyMaterial);

    // 1) 补种 spacer 分类（幂等）
    let spacerCat = await catRepo.findOne({ where: { app: null as any, code: 'spacer' } });
    if (!spacerCat) {
        spacerCat = await catRepo.save(new DiyCategory({
            app: null, code: 'spacer',
            name: { 'zh-CN': '隔片配饰', 'en-US': 'Spacers' },
            sortOrder: 7, enabled: true,
        }));
        console.log('[populate] created spacer category');
    }
    const cats = await catRepo.find();
    const catByCode = new Map(cats.map(c => [c.code!, c.id as number]));

    // 2) 展开 + upsert
    let created = 0, updated = 0;
    for (const [i, bead] of beads.entries()) {
        const categoryId = catByCode.get(bead.category);
        if (!categoryId) throw new Error(`Category not found for "${bead.category}"（先启动一次 dev server 让 seed 执行）`);
        for (const d of bead.availableDiameters) {
            const code = variantCode(bead.code, d);
            const isDisc = bead.shape !== 'round';
            const axialLength = isDisc
                ? Math.round(((bead.beadLength * d) / bead.beadDiameter) * 10) / 10
                : d;
            const existing = await matRepo.findOne({ where: { app: null as any, code } });
            const row = existing ?? new DiyMaterial({ app: null, code });
            Object.assign(row, {
                name: { 'zh-CN': bead.name },
                categoryId,
                shape: bead.shape,
                diameter: d,
                axialLength,
                holeSize: bead.holeSize,
                attrs: { group: bead.id, defaultDiameter: bead.beadDiameter, weightPerBead: bead.weightPerBead },
                render: bead.renderSpec,
                price: Math.round(bead.priceUnit * 100),
                priceUnit: 'piece',
                currency: 'CNY',
                stock: bead.stock < 0 ? 999999 : bead.stock,
                images: null,
                sourceMaterialId: null,
                enabled: true,
                sortOrder: i,
            });
            await matRepo.save(row);
            existing ? updated++ : created++;
        }
    }
    console.log(`[populate] done: ${created} created, ${updated} updated（预期 created≈61 行 = 18 珠 × 各直径档）`);
    await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: 确认 resolveJsonModule 可用**

读 `packages/diy-plugin/tsconfig.json`：若无 `"resolveJsonModule": true`，不要改共享 tsconfig——把 Step 2 里 `import beadsRaw from './beads-mock.json'` 改为 `const beadsRaw = require('./beads-mock.json')`。

- [ ] **Step 4: 启动 dev server 一次让 seed 落库，然后跑 populate**

```powershell
# 终端 A（保持运行）：pnpm dev:server
# 终端 B（dev server 起来后）：在 d:\zhao\vendure 下
pnpm exec ts-node --transpile-only -P packages/diy-plugin/tsconfig.json packages/diy-plugin/scripts/populate-beads.ts
```
Expected: 日志 `[populate] done: ~61 created ...`；重复执行第二次应 `0 created, 61 updated`（幂等验证）。

- [ ] **Step 5: GraphQL 冒烟验证（PowerShell 临时文件模式）**

```powershell
Set-Content -Encoding utf8 -NoNewline "$env:TEMP\diy_q.json" '{"query":"query { diyMaterials(filter:{onlyEnabled:true,take:3}) { total items { code attrs diameter axialLength price } } }"}'
curl.exe -s --data-binary "@$env:TEMP\diy_q.json" -H "Content-Type: application/json" http://localhost:3000/shop-api
```
Expected: `total` ≈ 61；items 里 `attrs.group`/`diameter`/`price`（分）正确。**端口若非 3000，以 dev server 启动日志为准。**

- [ ] **Step 6: 提交（path-scoped；不提交 dist/node_modules）**

```powershell
git -C d:\zhao\vendure add packages/diy-plugin/scripts/beads-mock.json packages/diy-plugin/scripts/populate-beads.ts
git -C d:\zhao\vendure commit -m "chore(diy-plugin): add idempotent populate script for bead mock materials"
```

---

### Task 3: bead-diy vendor @diy/calc + engine 适配层

**Files:**
- Create: `D:\zhao\bead-diy\src\vendor\diy-calc\`（9 个文件，从 `d:\zhao\vendure\packages\diy-calc\src\` 拷贝：types.ts / bracelet.ts / bracelet-calculator.ts / registry.ts / sum.ts / prng.ts / layout.ts / version.ts / index.ts）
- Modify: `D:\zhao\bead-diy\src\types.ts`（BeadVariant + BeadMaterial.variants + WorkRecord.planId）
- Rewrite: `D:\zhao\bead-diy\src\engine\calc.ts`、`D:\zhao\bead-diy\src\engine\bom.ts`、`D:\zhao\bead-diy\src\engine\derive.ts`
- Test: `D:\zhao\bead-diy\tests\calc.test.ts`（重写）、`tests\engine-snapshot.test.ts`（读后更新）

- [ ] **Step 1: vendor 拷贝**

拷贝上述 9 文件到 `src/vendor/diy-calc/`，每个文件头部加一行注释：`// vendor 拷贝自 vendure 仓 packages/diy-calc/src（P5, 2026-10-12），与后端下单复算保持同构；升级时重新拷贝`。内部 import 均为相对路径，无需改动。**不拷 lib/ 构建产物、不拷 package.json。**

- [ ] **Step 2: types.ts 增补**

```typescript
/** 直径档位变体：对应后端同材质多直径 SKU（mock/本地数据无此字段，走组本体字段） */
export interface BeadVariant {
  id: string
  code: string
  beadLength: number
  holeSize: number
  priceUnit: number
}
```
`BeadMaterial` 接口追加：`/** 直径档位 → 变体 SKU（远程数据源填充） */ variants?: Record<string, BeadVariant>`
`WorkRecord` 追加：`/** 云端 DiyPlan id（匿名 draft；P6 报价/下单用） */ planId?: string`

- [ ] **Step 3: 先写失败测试（重写 tests/calc.test.ts）**

```typescript
import { describe, it, expect } from 'vitest'
import { computeBracelet, DIAMETER_PRESETS } from '../src/engine/calc'
import { buildSlots } from '../src/engine/layout'
import type { BeadMaterial, BraceletSpec } from '../src/types'

const mat = (over: Partial<BeadMaterial>): BeadMaterial => ({
  id: 'agate-red', code: 'AG-RED-08-N', name: '南红玛瑙', category: 'agate', shape: 'round',
  beadDiameter: 8, beadLength: 8, holeSize: 1, availableDiameters: [6, 8, 10, 12, 14],
  priceUnit: 6.5, currency: 'CNY', stock: 600, ...over,
})
const baseSpec: BraceletSpec = {
  wristSize: 160, ease: 'comfort', layoutMode: 'solid', mainMaterialId: 'agate-red',
  diameter: 8, gap: 0.6, seed: 1, viewTilt: 0.5, rotation: 0,
}

describe('算量（@diy/calc 同构适配）', () => {
  it('160 手围 + 8mm + comfort：含 π·d 修正应为 22 颗左右（旧行为 19 颗已修正）', () => {
    const r = computeBracelet(baseSpec, [mat({})])
    expect(r.count).toBeGreaterThanOrEqual(20)
    expect(r.count).toBeLessThanOrEqual(24)
    expect(r.fitStatus).toBe('ok')
    expect(r.cordLengthMm).toBeGreaterThan(300)
  })
  it('直径档位变体参与算量与计价（分→元回译）', () => {
    const m = mat({
      priceUnit: 6.5,
      variants: { '10': { id: '201', code: 'AG-RED-10-N', beadLength: 10, holeSize: 1, priceUnit: 8.0 } },
    })
    const r = computeBracelet({ ...baseSpec, diameter: 10 }, [m])
    expect(r.count).toBeLessThan(20) // 10mm 比 8mm 颗数少
    expect(r.raw.bom.items[0].code).toBe('AG-RED-10-N')
    expect(r.raw.bom.items[0].unitPrice).toBe(800) // 分
  })
  it('focal 布局：focal 固定 1 颗计入 BOM', () => {
    const focal = mat({ id: 'amber-yellow', code: 'AM-YEL-10-N', beadDiameter: 10, beadLength: 10, priceUnit: 12 })
    const r = computeBracelet(
      { ...baseSpec, layoutMode: 'focal', focalId: 'amber-yellow', focalCount: 2 },
      [mat({}), focal],
    )
    const focalItem = r.raw.bom.items.find((i) => i.code === 'AM-YEL-10-N')
    expect(focalItem?.qty).toBe(1)
  })
  it('spacer：every=3 → 约 total/4 颗入 BOM', () => {
    const spacer = mat({ id: 'spacer-silicon', code: 'SP-SIL-02-N', shape: 'disc', beadDiameter: 8, beadLength: 1.5, priceUnit: 0.2 })
    const r = computeBracelet(
      { ...baseSpec, spacerEnabled: true, spacerId: 'spacer-silicon', spacerEvery: 3 },
      [mat({}), spacer],
    )
    const spacerItem = r.raw.bom.items.find((i) => i.code === 'SP-SIL-02-N')
    expect(spacerItem).toBeTruthy()
    expect(spacerItem!.qty).toBeGreaterThan(0)
  })
  it('相同输入确定性', () => {
    const a = computeBracelet(baseSpec, [mat({})])
    const b = computeBracelet(baseSpec, [mat({})])
    expect(a.count).toBe(b.count)
    expect(a.raw.bom.totalAmount).toBe(b.raw.bom.totalAmount)
  })
  it('DIAMETER_PRESETS 保留导出', () => {
    expect(DIAMETER_PRESETS).toContain(8)
  })
})

describe('排布 layout（不变）', () => {
  it('AB 模式严格交替', () => {
    const slots = buildSlots({ mainMaterialId: 'agate-red', secondaryMaterialId: 'metal-gold', layoutMode: 'ab', count: 20, seed: 1 })
    expect(slots[0].materialId).toBe('agate-red')
    expect(slots[1].materialId).toBe('metal-gold')
  })
})
```

Run: `npm test -- calc`（D:\zhao\bead-diy 下）→ Expected: FAIL（computeBracelet 新签名不存在）

- [ ] **Step 4: 重写 engine/calc.ts 为适配层**

```typescript
/**
 * 算量适配层：C 端领域模型（BeadMaterial/BraceletSpec，价格元）→ @diy/calc CalculatorInput（价格分）
 * → 结果回译。@diy/calc 为 vendor 源码拷贝，与后端 runDiyCalc 完全同构。
 */
import type { BeadMaterial, BraceletSpec } from '../types'
import { braceletCalculator, CalcMaterial, CalculatorOutput, SlotSelection } from '../vendor/diy-calc'

/** 可选直径档位（mm）——保留既有导出，UI 直径选择器用 */
export const DIAMETER_PRESETS = [4, 6, 8, 10, 12, 14, 16]

/** （组）材质 + 当前直径档位 → 实际 SKU 视图（variants 命中用变体，否则回退组本体） */
export function resolveCalcMaterial(m: BeadMaterial, diameter?: number): CalcMaterial {
  const v = diameter != null ? m.variants?.[String(diameter)] : undefined
  return {
    id: v?.id ?? m.id,
    code: v?.code ?? m.code,
    name: m.name,
    shape: m.shape,
    diameter: diameter ?? m.beadDiameter,
    axialLength: v?.beadLength ?? m.beadLength,
    holeSize: v?.holeSize ?? m.holeSize,
    price: Math.round((v?.priceUnit ?? m.priceUnit) * 100),
  }
}

export interface BraceletCalc {
  count: number
  innerCircumferenceMm: number
  outerCircumferenceMm: number
  fitStatus: 'tight' | 'ok' | 'loose'
  /** 中文反馈文案（@diy/calc feedback 回译） */
  feedback: string
  clearance: number
  cordLengthMm: number
  cordDiameter: number
  /** @diy/calc 原始输出（BOM 换算用） */
  raw: CalculatorOutput
}

const FEEDBACK_TEXT: Record<string, string> = {
  'too-tight': '过紧：戴不上，建议加大直径或放松量',
  snug: '偏紧：可加大松量',
  ok: '贴合度良好',
  loose: '偏松：可减小松量',
  'too-loose': '过松：建议减小直径或减松量',
}

export function fitStatusOf(feedback: string | undefined): 'tight' | 'ok' | 'loose' {
  if (feedback === 'too-tight' || feedback === 'snug') return 'tight'
  if (feedback === 'ok') return 'ok'
  return 'loose'
}

/** 手串算量：与后端 bracelet-classic 模板同一套纯函数（main/focal/spacer 三角色） */
export function computeBracelet(spec: BraceletSpec, materials: BeadMaterial[]): BraceletCalc {
  const lookup = (id?: string) => (id ? materials.find((m) => m.id === id) : undefined)
  const main = lookup(spec.mainMaterialId)
  const focal = spec.layoutMode === 'focal' ? lookup(spec.focalId) : undefined
  const spacer = spec.spacerEnabled ? lookup(spec.spacerId) : undefined

  const slots: SlotSelection[] = [{ key: 'main', role: 'main', materialId: spec.mainMaterialId }]
  if (focal) slots.push({ key: 'focal', role: 'focal', materialId: focal.id })
  if (spacer) slots.push({ key: 'spacer', role: 'spacer', materialId: spacer.id, every: Math.max(1, spec.spacerEvery ?? 2) })

  const used = new Map<string, CalcMaterial>()
  if (main) used.set(spec.mainMaterialId, resolveCalcMaterial(main, spec.diameter))
  for (const m of [focal, spacer]) {
    if (m && !used.has(m.id)) used.set(m.id, resolveCalcMaterial(m, m.beadDiameter))
  }

  const out = braceletCalculator({
    params: { wristSize: spec.wristSize, fit: spec.ease, gap: spec.gap },
    slots,
    materials: [...used.values()],
  })
  const calc = out.calc
  return {
    count: calc?.count ?? 0,
    innerCircumferenceMm: Math.round(calc?.innerCircumference ?? 0),
    outerCircumferenceMm: Math.round(calc?.centerCircumference ?? 0),
    fitStatus: fitStatusOf(calc?.feedback),
    feedback: FEEDBACK_TEXT[calc?.feedback ?? 'ok'] ?? '',
    clearance: Math.round((calc?.clearance ?? 0) * 10) / 10,
    cordLengthMm: Math.round(calc?.cordLength ?? 0),
    cordDiameter: calc?.cordDiameter ?? 0.8,
    raw: out,
  }
}
```

- [ ] **Step 5: 重写 engine/bom.ts**

```typescript
import type { BeadMaterial, BraceletBOM, BOMItem } from '../types'
import type { CalcBom } from '../vendor/diy-calc'
import { fitStatusOf } from './calc'

/** @diy/calc BOM（分）→ BraceletBOM（元）+ 分类/克重回填（纯函数） */
export function toBraceletBOM(bom: CalcBom, materials: BeadMaterial[]): BraceletBOM {
  const byCode = new Map<string, { category: BeadMaterial['category']; weight: number }>()
  for (const m of materials) {
    if (m.variants) {
      for (const v of Object.values(m.variants)) {
        byCode.set(v.code, { category: m.category, weight: v.weightPerBead ?? m.weightPerBead ?? 0 })
      }
    }
    byCode.set(m.code, { category: m.category, weight: m.weightPerBead ?? 0 })
  }
  const items: BOMItem[] = bom.items.map((i) => ({
    code: i.code,
    name: i.name,
    spec: i.spec,
    count: i.qty,
    unitPrice: Math.round(i.unitPrice) / 100,
    subtotal: Math.round(i.subtotal) / 100,
    category: byCode.get(i.code)?.category ?? 'crystal',
  }))
  const weightG = bom.items.reduce((s, i) => s + (byCode.get(i.code)?.weight ?? 0) * i.qty, 0)
  return {
    totalCount: bom.totalCount,
    totalAmount: Math.round(bom.totalAmount) / 100,
    items,
    cordLengthMm: bom.cord?.length ?? 0,
    cordSpec: bom.cord ? `弹力线 ${bom.cord.diameter}mm · 建议长 ${(bom.cord.length / 10).toFixed(1)}cm` : '',
    weightG: Math.round(weightG * 10) / 10,
    fitStatus: fitStatusOf(bom.geometry?.feedback),
  }
}
```

- [ ] **Step 6: 改 engine/derive.ts**

```typescript
import type { BraceletSpec, BeadMaterial, BeadSlot, BraceletBOM } from '../types'
import { computeBracelet, BraceletCalc } from './calc'
import { buildSlots } from './layout'
import { toBraceletBOM } from './bom'

export interface DerivedBracelet {
  calc: BraceletCalc
  slots: BeadSlot[]
  bom: BraceletBOM
  lookup: (id: string) => BeadMaterial | undefined
  mainMaterial?: BeadMaterial
}

/** 由方案 + 材质库派生出算量、排布与清单（供设计器 / 清单 / 导出页复用） */
export function deriveBracelet(spec: BraceletSpec, materials: BeadMaterial[]): DerivedBracelet {
  const lookup = (id: string): BeadMaterial | undefined => materials.find((m) => m.id === id)
  const mainMaterial = lookup(spec.mainMaterialId)
  const calc = computeBracelet(spec, materials)
  const slots = buildSlots({
    mainMaterialId: spec.mainMaterialId,
    secondaryMaterialId: spec.secondaryMaterialId,
    layoutMode: spec.layoutMode,
    count: calc.count,
    seed: spec.seed,
    focalId: spec.focalId,
    focalPosition: spec.focalPosition ?? 0.5,
    focalCount: spec.focalId ? spec.focalCount ?? 1 : 0,
  })
  const bom = toBraceletBOM(calc.raw.bom, materials)
  return { calc, slots, bom, lookup, mainMaterial }
}
```

- [ ] **Step 7: 修残余引用 + 全量测试**

先 `Grep -n "EASE_MM|centerCircumference|easeToMm|computeCount|CORD_TAIL_MM|from './calc'|from '../engine/calc'"` 于 `D:\zhao\bead-diy\src` 与 `tests`：pages/components 若引用被删导出，按映射改（`cordLengthMm`→`calc.cordLengthMm`、`fitStatus`→`calc.fitStatus`、`message`→`calc.feedback`、`innerCircumferenceMm`/`outerCircumferenceMm` 仍在）。`tests/engine-snapshot.test.ts` 读取后按新结果更新快照/断言（用 mock json 作材质输入，验证 deriveBracelet 仍返回 count/slots/bom 结构）。
Run: `npm run typecheck; npm test`
Expected: 全 PASS

- [ ] **Step 8: bead-diy 暂不提交（T7 统一 git init；此任务结束只报告结果）**

---

### Task 4: bead-diy 数据层切远程（api client + mapper + RemoteRepository）

**Files:**
- Create: `D:\zhao\bead-diy\src\api\client.ts`、`src\api\documents.ts`、`src\api\plans.ts`（plans.ts 在 T5 填充，本任务先建空壳会引入未用文件——**本任务不建 plans.ts，T5 再建**）
- Rewrite: `D:\zhao\bead-diy\src\data\mapper.ts`、`D:\zhao\bead-diy\src\data\repository.ts`
- Modify: `D:\zhao\bead-diy\config\index.ts`

- [ ] **Step 1: config defineConstants 注入 API 地址**

`config/index.ts` 的 `defineConstants: {}` 改为：

```typescript
defineConstants: {
  // shop-api 地址：构建期注入，禁止硬编码生产域名；本地 dev 默认 localhost
  API_BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE || 'http://localhost:3000/shop-api'),
},
```
并在项目根 `.env`（无则创建）写：`TARO_APP_API_BASE=http://localhost:3000/shop-api`（值含 `#` 时必须加双引号——本项目当前不含）。

- [ ] **Step 2: src/api/client.ts**

```typescript
import Taro from '@tarojs/taro'

/** shop-api GraphQL 客户端；API_BASE_URL 由构建期 defineConstants 注入 */
declare const API_BASE_URL: string

interface GqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await Taro.request({
    url: API_BASE_URL,
    method: 'POST',
    data: { query, variables: variables ?? {} },
    header: { 'Content-Type': 'application/json' },
  })
  const body = res.data as GqlResponse<T>
  if (body.errors?.length) throw new Error(body.errors[0].message)
  if (!body.data) throw new Error('Empty GraphQL response')
  return body.data
}
```

- [ ] **Step 3: src/api/documents.ts**

```typescript
/** shop-api 文档（与 vendure diy-plugin shopSchema 对齐） */
export const DIY_CATEGORIES_QUERY = `
  query { diyCategories { id code name } }
`

export const DIY_MATERIALS_QUERY = `
  query($take: Int) {
    diyMaterials(filter: { onlyEnabled: true, take: $take }) {
      total
      items { id code name categoryId shape diameter axialLength holeSize attrs render price currency stock }
    }
  }
`
```

- [ ] **Step 4: 重写 src/data/mapper.ts**

```typescript
import type { BeadMaterial, BeadCategory, BeadShape, BeadVariant, RenderSpec, TextureType, Luster } from '../types'

/** shop-api DiyMaterial 行（GraphQL 返回原样；price 分） */
export interface DiyMaterialDTO {
  id: string | number
  code: string
  name: Record<string, string> | string
  categoryId: number
  shape: string
  diameter: number | null
  axialLength: number | null
  holeSize: number | null
  attrs: { group?: string; defaultDiameter?: number; weightPerBead?: number } | null
  render: Record<string, any> | null
  price: number
  currency: string
  stock: number
}

export interface DiyCategoryDTO {
  id: string | number
  code: string | null
  name: Record<string, string> | string
}

const BEAD_CATEGORIES: BeadCategory[] = ['crystal', 'agate', 'wood', 'amber', 'pearl', 'metal', 'spacer']
/** 后端分类码 → bead-diy 枚举回退（gemstone 归 crystal） */
const CATEGORY_FALLBACK: Record<string, BeadCategory> = { gemstone: 'crystal' }

/** LocalizedText 取值：zh-CN → en-US → 首个值 → 兜底 */
export function localizeText(t: Record<string, string> | string | null | undefined, fallback = ''): string {
  if (!t) return fallback
  if (typeof t === 'string') return t
  return t['zh-CN'] ?? t['en-US'] ?? Object.values(t)[0] ?? fallback
}

/** render jsonb（bead-diy RenderSpec 同构）→ RenderSpec，缺字段补内建默认 */
export function toRenderSpec(r: Record<string, any> | null): RenderSpec {
  if (!r) {
    return {
      baseColor: '#C9CDD4', shadowColor: '#8A9099', highlightColor: '#FFFFFF',
      gloss: 0.6, translucency: 0.1, textureType: 'solid', textureStrength: 0.2,
      rimColor: '#AAB2BB', envLightColor: '#B8C4CC',
    }
  }
  return {
    baseColor: r.baseColor ?? '#C9CDD4',
    shadowColor: r.shadowColor ?? '#8A9099',
    highlightColor: r.highlightColor ?? '#FFFFFF',
    gloss: r.gloss ?? 0.6,
    translucency: r.translucency ?? 0,
    textureType: (r.textureType ?? 'solid') as TextureType,
    textureStrength: r.textureStrength ?? 0.2,
    rimColor: r.rimColor ?? '#AAB2BB',
    envLightColor: r.envLightColor ?? '#B8C4CC',
    accentColor: r.accentColor,
    luster: r.luster as Luster | undefined,
  }
}

/** 单行 DTO → 直径变体 SKU */
export function toVariant(dto: DiyMaterialDTO): BeadVariant {
  return {
    id: String(dto.id),
    code: dto.code,
    beadLength: dto.axialLength ?? dto.diameter ?? 8,
    holeSize: dto.holeSize ?? 1,
    priceUnit: dto.price / 100,
  }
}

/**
 * 后端多 SKU 行 → C 端组材质列表：
 * 按 attrs.group 聚合（无 group 的行自成一组），组 id = group（= mock id，DEFAULT_* 常量依赖它）。
 */
export function groupMaterials(rows: DiyMaterialDTO[], catCodeById: Map<number, string>): BeadMaterial[] {
  const groups = new Map<string, DiyMaterialDTO[]>()
  for (const r of rows) {
    const g = r.attrs?.group ?? String(r.id)
    const list = groups.get(g) ?? []
    list.push(r)
    groups.set(g, list)
  }
  const out: BeadMaterial[] = []
  for (const [gid, list] of groups) {
    list.sort((a, b) => (a.diameter ?? 0) - (b.diameter ?? 0))
    const canonical = list.find((r) => r.diameter === r.attrs?.defaultDiameter) ?? list[0]
    const variants: Record<string, BeadVariant> = {}
    for (const r of list) variants[String(r.diameter)] = toVariant(r)
    const catCode = catCodeById.get(canonical.categoryId) ?? ''
    const category: BeadCategory = BEAD_CATEGORIES.includes(catCode as BeadCategory)
      ? (catCode as BeadCategory)
      : CATEGORY_FALLBACK[catCode] ?? 'crystal'
    out.push({
      id: gid,
      code: canonical.code,
      name: localizeText(canonical.name),
      category,
      shape: canonical.shape as BeadShape,
      beadDiameter: canonical.diameter ?? 8,
      beadLength: canonical.axialLength ?? canonical.diameter ?? 8,
      holeSize: canonical.holeSize ?? 1,
      availableDiameters: list.map((r) => r.diameter ?? 0).filter((d) => d > 0),
      priceUnit: canonical.price / 100,
      currency: 'CNY',
      stock: canonical.stock,
      renderSpec: toRenderSpec(canonical.render),
      weightPerBead: canonical.attrs?.weightPerBead,
      variants,
    })
  }
  return out
}
```

- [ ] **Step 5: 重写 src/data/repository.ts**

```typescript
import { gql } from '../api/client'
import { DIY_CATEGORIES_QUERY, DIY_MATERIALS_QUERY } from '../api/documents'
import type { BeadMaterial, BeadCategory } from '../types'
import { DiyCategoryDTO, DiyMaterialDTO, groupMaterials } from './mapper'

/** 珠子数据访问接口：业务层只依赖该抽象，不关心数据来源 */
export interface BeadRepository {
  listMaterials(): Promise<BeadMaterial[]>
  getMaterial(id: string): Promise<BeadMaterial | undefined>
  getByCode(code: string): Promise<BeadMaterial | undefined>
  priceOf(id: string): Promise<number>
}

/** 远程实现：Vendure shop-api（diyCategories + diyMaterials），按 attrs.group 聚合后内存缓存 */
class RemoteBeadRepository implements BeadRepository {
  private cache: BeadMaterial[] | null = null

  private async all(): Promise<BeadMaterial[]> {
    if (this.cache) return this.cache
    const [mats, cats] = await Promise.all([
      gql<{ diyMaterials: { items: DiyMaterialDTO[] } }>(DIY_MATERIALS_QUERY, { take: 500 }),
      gql<{ diyCategories: DiyCategoryDTO[] }>(DIY_CATEGORIES_QUERY),
    ])
    const catCodeById = new Map<number, string>()
    for (const c of cats.diyCategories) {
      if (c.code) catCodeById.set(Number(c.id), c.code)
    }
    this.cache = groupMaterials(mats.diyMaterials.items, catCodeById)
    return this.cache
  }

  async listMaterials(): Promise<BeadMaterial[]> {
    return (await this.all()).map((m) => ({ ...m, renderSpec: { ...m.renderSpec } }))
  }

  async getMaterial(id: string): Promise<BeadMaterial | undefined> {
    const m = (await this.all()).find((b) => b.id === id)
    return m ? { ...m, renderSpec: { ...m.renderSpec } } : undefined
  }

  async getByCode(code: string): Promise<BeadMaterial | undefined> {
    const m = (await this.all()).find((b) => b.code === code)
    return m ? { ...m, renderSpec: { ...m.renderSpec } } : undefined
  }

  async priceOf(id: string): Promise<number> {
    return (await this.getMaterial(id))?.priceUnit ?? 0
  }
}

export const beadRepository: BeadRepository = new RemoteBeadRepository()

/** 设计器默认主珠 / 次珠 / 焦点珠（= 素材 attrs.group，沿用 mock id 作为分组键） */
export const DEFAULT_MAIN_BEAD_ID = 'agate-red'
export const DEFAULT_SECONDARY_BEAD_ID = 'metal-gold'
export const DEFAULT_FOCAL_BEAD_ID = 'amber-yellow'
```

- [ ] **Step 6: 类型检查 + 全量测试（engine 测试用自建材质，不依赖远程）**

Run: `npm run typecheck; npm test`
Expected: PASS。旧 mapper 的 RemoteBeadDTO/toRemoteDTO 若有引用报错——`Grep "toRemoteDTO|RemoteBeadDTO|beads.mock.json" src tests`，测试 fixture 改从 `../src/data/beads.mock.json` 直接断言（保留 json 文件）。

- [ ] **Step 7: 报告即可（不提交，T7 统一收口）**

---

### Task 5: BraceletSpec → DiyPlanSpec + 匿名保存 + works 存 planId

**Files:**
- Create: `D:\zhao\bead-diy\src\api\plans.ts`
- Modify: `D:\zhao\bead-diy\src\utils\works.ts`、`D:\zhao\bead-diy\src\pages\works\index.tsx`
- Test: `D:\zhao\bead-diy\tests\plans.test.ts`（新建）

- [ ] **Step 1: 失败测试 tests/plans.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { toPlanSpec } from '../src/api/plans'
import type { BeadMaterial, BraceletSpec } from '../src/types'

const mat = (over: Partial<BeadMaterial>): BeadMaterial => ({
  id: 'agate-red', code: 'AG-RED-08-N', name: '南红', category: 'agate', shape: 'round',
  beadDiameter: 8, beadLength: 8, holeSize: 1, availableDiameters: [6, 8, 10],
  priceUnit: 6.5, currency: 'CNY', stock: 600,
  variants: {
    '8': { id: '101', code: 'AG-RED-08-N', beadLength: 8, holeSize: 1, priceUnit: 6.5 },
    '10': { id: '102', code: 'AG-RED-10-N', beadLength: 10, holeSize: 1, priceUnit: 8 },
  },
  ...over,
})
const spec: BraceletSpec = {
  wristSize: 160, ease: 'comfort', layoutMode: 'focal', mainMaterialId: 'agate-red',
  diameter: 10, gap: 0.6, seed: 7, spacerEnabled: true, spacerId: 'spacer-silicon',
  spacerEvery: 3, focalId: 'amber-yellow', focalCount: 2, viewTilt: 0.5, rotation: 0,
}

describe('toPlanSpec', () => {
  it('槽位 materialId 用当前直径对应变体 SKU id；params 直接透传', () => {
    const focal = mat({ id: 'amber-yellow', code: 'AM-YEL-10-N', beadDiameter: 10, beadLength: 10, variants: { '10': { id: '201', code: 'AM-YEL-10-N', beadLength: 10, holeSize: 1.5, priceUnit: 12 } } })
    const spacer = mat({ id: 'spacer-silicon', code: 'SP-SIL-02-N', shape: 'disc', beadDiameter: 8, beadLength: 1.5, variants: { '8': { id: '301', code: 'SP-SIL-02-N', beadLength: 1.5, holeSize: 1, priceUnit: 0.2 } } })
    const out = toPlanSpec(spec, [mat({}), focal, spacer])
    expect(out.slots.main).toEqual({ materialId: '102' })
    expect(out.slots.focal).toEqual({ materialId: '201' })
    expect(out.slots.spacer).toEqual({ materialId: '301', every: 3 })
    expect(out.params).toEqual({ wristSize: 160, fit: 'comfort', gap: 0.6 })
    expect(out.seed).toBe(7)
  })
  it('无 variants（mock 数据）回退组 id，不抛错', () => {
    const out = toPlanSpec({ ...spec, spacerEnabled: false }, [mat({ variants: undefined })])
    expect(out.slots.main.materialId).toBe('agate-red')
    expect(out.slots.focal).toBeUndefined()
  })
})
```

Run: `npm test -- plans` → FAIL（模块不存在）

- [ ] **Step 2: src/api/plans.ts**

```typescript
import { gql } from './client'
import type { BeadMaterial, BraceletSpec } from '../types'

export const BRACELET_TEMPLATE_CODE = 'bracelet-classic'

export interface DiyPlanSlotSelection {
  materialId: string
  every?: number
}

export interface DiyPlanSpecPayload {
  slots: Record<string, DiyPlanSlotSelection>
  params: Record<string, number | string>
  seed?: number
}

/** 取材质的变体 SKU id：指定直径命中用之；无 variants（mock）回退组 id */
function skuId(m: BeadMaterial | undefined, diameter?: number): string | null {
  if (!m) return null
  const v = diameter != null ? m.variants?.[String(diameter)] : undefined
  return v?.id ?? (m.variants ? Object.values(m.variants)[0]?.id ?? null : m.id)
}

/** BraceletSpec + 材质库 → DiyPlanSpec（后端 createDiyPlan 入参；与 calc-bridge 槽位语义对齐） */
export function toPlanSpec(spec: BraceletSpec, materials: BeadMaterial[]): DiyPlanSpecPayload {
  const find = (id?: string) => (id ? materials.find((m) => m.id === id) : undefined)
  const slots: Record<string, DiyPlanSlotSelection> = {}
  const mainId = skuId(find(spec.mainMaterialId), spec.diameter)
  if (!mainId) throw new Error('主珠素材不可用，无法保存方案')
  slots.main = { materialId: mainId }
  if (spec.layoutMode === 'focal') {
    const focal = find(spec.focalId)
    const fid = skuId(focal, focal?.beadDiameter)
    if (fid) slots.focal = { materialId: fid }
  }
  if (spec.spacerEnabled) {
    const spacer = find(spec.spacerId)
    const sid = skuId(spacer, spacer?.beadDiameter)
    if (sid) slots.spacer = { materialId: sid, every: Math.max(1, spec.spacerEvery ?? 2) }
  }
  return {
    slots,
    params: { wristSize: spec.wristSize, fit: spec.ease, gap: spec.gap },
    seed: spec.seed,
  }
}

export interface SavedPlan {
  id: string
  status: string
}

const CREATE_DIY_PLAN_MUTATION = `
  mutation($templateCode: String!, $spec: JSON!, $thumb: String) {
    createDiyPlan(templateCode: $templateCode, spec: $spec, thumb: $thumb) { id status }
  }
`

/** 匿名保存方案（Public mutation）：后端复算 BOM 并落 draft，返回 plan id */
export async function createDiyPlan(spec: BraceletSpec, materials: BeadMaterial[]): Promise<SavedPlan> {
  const data = await gql<{ createDiyPlan: SavedPlan }>(CREATE_DIY_PLAN_MUTATION, {
    templateCode: BRACELET_TEMPLATE_CODE,
    spec: toPlanSpec(spec, materials),
    thumb: null,
  })
  return data.createDiyPlan
}
```

- [ ] **Step 3: works.ts 改造（保存时顺带云端落库）**

```typescript
import Taro from '@tarojs/taro'
import type { WorkRecord, BraceletSpec, BeadMaterial } from '../types'
import { createDiyPlan } from '../api/plans'

const KEY = 'bead-works'

export function loadWorks(): WorkRecord[] {
  try {
    return Taro.getStorageSync(KEY) || []
  } catch {
    return []
  }
}

/** 保存作品：同时匿名创建云端方案（失败不阻断本地存档），planId 附到记录上 */
export async function saveWork(spec: BraceletSpec, totalAmount: number, materials: BeadMaterial[]): Promise<WorkRecord> {
  let planId: string | undefined
  try {
    planId = (await createDiyPlan(spec, materials)).id
  } catch {
    /* 云端不可用（未启动/网络失败）→ 仅本地存档 */
  }
  const list = loadWorks()
  const record: WorkRecord = {
    id: String(Date.now()),
    name: `手串 ${list.length + 1}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    spec: { ...spec },
    totalAmount,
    planId,
  }
  list.unshift(record)
  try {
    Taro.setStorageSync(KEY, list)
  } catch {
    /* 忽略存储异常 */
  }
  return record
}

export function deleteWork(id: string): void {
  const list = loadWorks().filter((w) => w.id !== id)
  try {
    Taro.setStorageSync(KEY, list)
  } catch {
    /* 忽略 */
  }
}
```

- [ ] **Step 4: works 页调用点改异步（pages/works/index.tsx）**

`onSaveCurrent` 改为：

```typescript
  const [saving, setSaving] = useState(false)

  const onSaveCurrent = async () => {
    if (saving) return
    setSaving(true)
    try {
      const record = await saveWork(spec, currentDerived.bom.totalAmount, materials)
      setWorks(loadWorks())
      showToast({ title: record.planId ? '已保存（含云端方案）' : '已本地保存', icon: 'success' })
    } finally {
      setSaving(false)
    }
  }
```
（`useState` 已从 react 导入；`materials` 已在 store 解构中。）

- [ ] **Step 5: 全量验证**

Run: `npm run typecheck; npm test`
Expected: PASS

---

### Task 6: 联调回归 + 手机截图

**Files:**
- Create: `D:\zhao\bead-diy\docs\manual\shots\2026-10-12-diy-p5\*.png`（截图）
- Create: `D:\zhao\bead-diy\docs\manual\2026-10-12-diy-p5-对接说明.md`（简版手册，T7 一并提交）

- [ ] **Step 1: 两仓静态检查**

```powershell
# vendure
cd d:\zhao\vendure; pnpm --filter @vendure/diy-plugin test
# bead-diy
cd D:\zhao\bead-diy; npm run typecheck; npm test; npm run build:weapp
```
Expected: 全 PASS（build:weapp 产物成功即微信端可编译）。

- [ ] **Step 2: 起两端服务联调**

终端 A：`cd d:\zhao\vendure; pnpm dev:server`（等启动完成）；终端 B：`cd D:\zhao\bead-diy; npm run dev:h5`（端口 10086）。

- [ ] **Step 3: GraphQL 冒烟（PowerShell 临时文件）**

```powershell
Set-Content -Encoding utf8 -NoNewline "$env:TEMP\diy_plan.json" '{"query":"mutation($spec: JSON!){ createDiyPlan(templateCode:\"bracelet-classic\" spec:$spec){ id status bom } }","variables":{"spec":{"slots":{"main":{"materialId":"REPLACE_WITH_SKU_ID"}},"params":{"wristSize":160,"fit":"comfort","gap":0.6}}}}'
# REPLACE_WITH_SKU_ID 用 Task2 Step5 返回的某个 attrs.group='agate-red' 且 diameter=8 的行 id
curl.exe -s --data-binary "@$env:TEMP\diy_plan.json" -H "Content-Type: application/json" http://localhost:3000/shop-api
```
Expected: `createDiyPlan.id` + `status:"draft"` + bom.totalAmount（分）>0。**此步同时验证 T5 的落库语义。**

- [ ] **Step 4: Playwright 手机视口截图（390×844 dpr=2）**

写临时 python 脚本（playwright sync API）：viewport `{'width':390,'height':844}`，`device_scale_factor=2`，依次访问并截图：
- `http://localhost:10086/#/pages/designer/index`（设计器：确认材质列表来自后端、算量数字正常）
- `http://localhost:10086/#/pages/bom/index`（清单：主珠/隔片行 + 金额）
- `http://localhost:10086/#/pages/works/index`（点「保存当前设计」后刷新，验证 toast 与卡片）
输出到 `D:\zhao\bead-diy\docs\manual\shots\2026-10-12-diy-p5\01-designer.png / 02-bom.png / 03-works.png`。
若页面依赖首次 load 的网络请求，`page.wait_for_timeout(3000)` 后再截。

- [ ] **Step 5: 写简版对接说明手册**（md：环境变量 `TARO_APP_API_BASE`、populate 脚本用法、P5 边界与 P6 待办、截图引用）

---

### Task 7: 提交推送 + 上线三步

- [ ] **Step 1: vendure 仓提交推送（path-scoped，只含本任务产物）**

```powershell
git -C d:\zhao\vendure add vendure-prod/docs/plans/2026-10-12-diy-p5-bead-diy.md packages/diy-plugin
git -C d:\zhao\vendure commit -m "feat(diy-plugin): P5 bead-diy shop-api integration (diyCategories + populate script)"
git -C d:\zhao\vendure push origin HEAD
```
（若 T1/T2 已各自提交过，这里只补计划文档与遗漏文件；push 前先 `git -C d:\zhao\vendure log --oneline origin/master..HEAD` 确认待推提交。）

- [ ] **Step 2: bead-diy 首次纳入版本控制**

```powershell
# bead-diy 目前无 .git（嵌在 mono 仓内未跟踪）
cd D:\zhao\bead-diy
git init
# 检查 .gitignore 覆盖 node_modules/ dist/（无则补）
git add .gitignore package.json package-lock.json config project.config.json tsconfig.json src tests docs babel.config.js
git commit -m "feat: P5 integrate vendure shop-api (remote materials, @diy/calc vendor, anonymous plan save)"
```
然后 `gh repo create johocn/bead-diy --private --source . --remote origin --push`；gh 不可用则本地提交并报告用户。

- [ ] **Step 3: 生产接线三步（生产仓 vendure-prod）**

1. `Grep "ShopTemplatePlugin.init" d:\zhao\vendure\vendure-prod\packages` 定位生产入口 config，紧随其后注册 `DiyPlugin.init({ app: (process.env.APP as 'nshop' | 'vshop') ?? 'nshop' })`（import 对齐 dev-config.ts:85）。
2. 本地构建生产包（遵循部署铁律：绝不在服务器构建；具体打包命令参考 `d:\zhao\vendure\deploy-pack.js` 与根目录 vendure-prod 现有产物结构）。
3. 参照 `D:\zhao\scripts\_vendure_deploy.sh` 的既有部署机制执行；**新增步骤**：服务器上 `pnpm install`（拉取 @diy/calc、@vendure/diy-plugin 两个新 workspace 包）后再 `pm2 restart`。任一环节凭据/机制不明 → **停下询问用户，禁止猜测执行生产操作**。

- [ ] **Step 4: 收尾报告**

向用户报告：提交/推送结果、截图位置、上线状态、P6 待办（微信登录 wechat strategy + quoteDiyPlan/createOrderFromPlan 接线 + 小程序体验版上传验证）。

---

## Self-Review 记录

- 规格覆盖：附录 A 映射逐项落位（BeadMaterial→DiyMaterial/mapper、RenderSpec→render 透传、BraceletSpec→spec 快照、CalcResult→@diy/calc 同构、WorkRecord→本地+planId）；§7 shop 面 diyMaterials 已有、diyCategories 由 T1 补齐。
- 类型一致性：`BeadVariant`（T3 定义，T4 mapper 填充，T5 skuId 消费）；`computeBracelet(spec, materials)` 新签名贯穿 derive/plans 测试；`fitStatusOf` 由 bom.ts 复用自 calc.ts。
- 已知取舍（记录给评审）：focalCount>1 时 UI 视觉多颗、BOM/落库按后端固定 1 颗（braceletCalculator 语义），P6 如需多焦点珠需扩展计算器；`secondaryMaterialId` 仅客户端视觉（AB/渐变/随机），落库 spec 只有 main——服务端 BOM 以 main/focal/spacer 为准。
