# DIY 商品功能（diy-plugin）P1–P4 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vendure 仓库交付 diy-plugin（两层素材库 + 玩法模板 + 方案三链路）与共享算量包 @diy/calc（手串计算器），素材/模板/方案与 Product 零耦合，DIY 成品经 Vendure 自定义订单行进入原生订单/支付流程。

**Architecture:** 纯自建实体（DiyCategory/DiyMaterial/DiyTemplate/DiyPlan），单表单 `app` 列实现「平台库(app=null) + 租户库(app=X)」两层合并；算量封装为独立纯函数包 `@diy/calc`（registry 注册 `sum` 兜底 + `bracelet` 计算器），C 端演示与后端 quote/order 复算双端同构；下单 = 服务端复算 BOM（实时价为唯一权威）→ 原子扣减素材库存 → Vendure Order 自定义订单行（OrderLine customFields 挂 planId + BOM 快照 + diyUnitPrice，经包装的 OrderItemPriceCalculationStrategy 定价）。

**Tech Stack:** TypeScript 5.8 / Vendure 3.6.4（NestJS + TypeORM + GraphQL SDL） / pnpm workspace + lerna / vitest（单测根目录直跑 + e2e 用 @vendure/testing sqljs）/ 本地 postgres（迁移）。

**规格出处:** `vendure-prod/docs/specs/2026-10-11-diy-plugin-design.md`（commit 64fc1b28b）。本计划逐条落实其 §9 切分：P1 骨架 / P2 查询面 / P3 算量包 / P4 三链路。

---

## 执行者须知（先读，全部已实地核实）

### 仓库布局（重要）

- 活跃源码树：**`D:\zhao\vendure\packages\`**（pnpm workspace，`workspaces: ["packages/*"]`，包管理器 `pnpm@11.9.0`）。**不要**把源码放进 `vendure-prod/packages/`（那里只提交编译产物 lib/，供部署）。
- 新插件源码：`packages/diy-plugin`（包名 `@vendure/diy-plugin`）；算量包：`packages/diy-calc`（包名 `@diy/calc`）。
- 编码风格参照：`packages/shop-template-plugin`（实体 `simple-json` 列、plugin.ts 内嵌 SDL、TransactionalConnection、onApplicationBootstrap 幂等 seed、自定义 PermissionDefinition）。
- 主应用装配：`packages/dev-server/dev-config.ts`（全部插件在此注册）；dev-server 依赖声明在 `packages/dev-server/package.json`（如 `"@vendure/shop-template-plugin": "0.0.1"`，pnpm 自动解析为 workspace 链接）。
- 实例租户端：`ShopTemplatePlugin.init({ app: process.env.APP ?? 'nshop' })` 模式——diy-plugin 完全一致（`DiyPlugin.init({ app })`）。

### 常用命令（PowerShell，**不支持 `&&`，用 `;` 分隔**）

```powershell
# 所有命令都在仓库根 D:\zhao\vendure 执行，除非特别注明
cd D:\zhao\vendure

# 安装依赖（新增 workspace 包 / 改 package.json 后）
pnpm install

# 单元测试（根目录 vitest 直跑，无配置文件，默认 include **/*.spec.ts）
pnpm vitest run packages/diy-calc
pnpm vitest run packages/diy-plugin

# 构建（部署前必须，产物 lib/ 由 vendure-prod 树引用）
pnpm --filter @diy/calc build
pnpm --filter @vendure/diy-plugin build

# 数据库迁移（本地 postgres，packages/dev-server/.env: DB=postgres @127.0.0.1:5432 db=vendure）
cd packages/dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts generate add_diy_entities
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
cd D:\zhao\vendure

# e2e（包内 vitest 配置，sqljs 内存库，无需本地 DB）
pnpm --filter @vendure/diy-plugin e2e

# 本地起 dev server 冒烟（server + worker）
pnpm --filter dev-server dev
```

### 约定与硬规范

- **单位铁律**：金额一律**分**（整数）；长度一律 **mm**（double 列，1 位小数精度足够，无浮点误差风险——非金额字段）；库存按 priceUnit 计整数。
- **JSON 列**：全部用 `@Column('simple-json')`（shop-template 同款，sqlite/postgres/mariadb 三兼容）。规格文档写「jsonb」按此实现。
- **主键**：沿用仓库惯例 `VendureEntity` 自增 int 主键（规格表中「uuid PK」按此实现，FK/JSON 快照内引用一律存 int 的字符串形式或 number，见各类型定义）。
- **LocalizedText**：`string | Record<string, string>`，键用 `zh-CN` / `en-US`。回退链：当前 locale → defaultLocale → 首个值 → 内建占位。Vendure `ctx.languageCode`（如 `zh_Hans`）到 jsonb 键（`zh-CN`）的映射在后端 `resolveLocaleKey()` 完成（纯函数、有单测）。
- **素材图**：存 URL 字符串（静态目录 + 动态 origin 由 C 端/admin 侧拼装），后端不硬编码域名。
- **多语言数组**：LocalizedText 仅用于单值文案；无数组场景。
- **TDD**：每个功能先写失败测试再实现；每完成一个 Task 提交一次。
- **Git**：身份若未配置则 `git config user.name johocn; git config user.email johocn@163.com`。多行 commit message 用临时文件 `[IO.File]::WriteAllText($p, $msg, [Text.UTF8Encoding]::new($false))` + `git commit -F`（防 BOM）。
- **禁止占位符**：所有代码块直接可用；遇类型报错先对齐本计划的类型定义再改。

### 与规格的五处实现偏差（已论证，照此执行）

1. **DiyCategory 增加 `code` 列**（slug，如 `crystal`）：规格 §4.1 字段表无 code，但 §5.2 槽位 filter 用 `categoryCodes` 过滤，分类必须可编码引用。
2. **载体商品（carrier）**：Vendure `OrderLine.productVariant` 非空、`addItemsToOrder` 强校验 variant+product `enabled=true`（core/order.service.ts L682-692），因此 P4 在 bootstrap 幂等创建一个载体商品「DIY 定制成品」（enabled=true、price=0、trackInventory='FALSE'、仅默认渠道），DIY 成品行实际价格由 `diyUnitPrice` 覆盖。载体只落默认渠道 → 租户渠道的搜索索引看不到它（DefaultSearchPlugin 按渠道建索引）；单渠道部署会在默认渠道搜索可见，屏蔽不在本期范围（YAGNI）。
3. **库存扣减用 DB 原子 UPDATE**（规格 §6.4 设想 Redis 分布式锁）：`UPDATE diy_material SET stock = stock - qty WHERE id = ? AND stock >= qty` 单语句原子，affected=0 即缺口，全有或全无。单库真源、零新基础设施依赖，sqljs e2e 可直接验证「恰好一单成功」语义（Task 18 用例 5）。
4. **DiyPlan 主键用 VendureEntity 自增 int**（规格 §6.1 字段表写 uuid PK）：沿用本仓库全部实体惯例（须知「主键」条）；spec/BOM 快照与 API 输入中的引用一律以字符串 id 传递（`String(id)`），落库存 number。
5. **createDiyPlan 允许匿名**（规格 §7 鉴权行把 createDiyPlan 列入「写操作要求登录」）：按 §6.2 三链路语义，演示（draft）可匿名（userId 落 null，无法归属），报价（quoteDiyPlan）与下单（createOrderFromPlan）仍 `Permission.Authenticated` 收紧——与「演示+报价单」叠加模式的设计决策一致。

---

## File Structure（新增/修改文件总览）

```
D:\zhao\vendure\
├─ packages\
│  ├─ diy-calc\                          # @diy/calc 共享算量包（纯函数，禁 import Vendure/Taro/React/IO）
│  │  ├─ package.json                    # 新建
│  │  ├─ tsconfig.json / tsconfig.build.json
│  │  ├─ index.ts
│  │  └─ src\
│  │     ├─ index.ts                     # 桶导出
│  │     ├─ version.ts                   # CALC_VERSION
│  │     ├─ types.ts                     # CalcMaterial/SlotSelection/CalculatorInput/CalcResult/CalcBom/Calculator
│  │     ├─ prng.ts                      # mulberry32 确定性伪随机
│  │     ├─ sum.ts                       # 内置 sum 计算器（选择型玩法兜底）
│  │     ├─ bracelet.ts                  # 手串算量核心：countBeads/pickBestCount/innerCircOf/feedbackOf
│  │     ├─ bracelet-calculator.ts       # bracelet 计算器（BOM/cord/焦点珠隔片二次收敛）
│  │     ├─ layout.ts                    # buildLayout（solid/ab/gradient/random/focal，确定性）
│  │     ├─ registry.ts                  # getCalculator/registerCalculator
│  │     └─ __tests__\
│  │        ├─ prng.spec.ts
│  │        ├─ sum.spec.ts
│  │        ├─ bracelet.spec.ts          # §7.4 经验表 6 组断言 + 反向验证
│  │        ├─ bracelet-calculator.spec.ts
│  │        └─ layout.spec.ts            # 确定性快照
│  ├─ diy-plugin\                        # @vendure/diy-plugin
│  │  ├─ package.json / tsconfig.json / tsconfig.build.json / index.ts
│  │  ├─ vitest.config.mts               # e2e 配置（仿 points-mall-plugin）
│  │  ├─ src\
│  │  │  ├─ constants.ts                 # loggerCtx / PLUGIN_INIT_OPTIONS / 报价 TTL / 载体常量
│  │  │  ├─ types.ts                     # LocalizedText/Options/Inputs/DiyPlanSpec/DiyPlanBom/Filter
│  │  │  ├─ localize.ts                  # localizeText + resolveLocaleKey
│  │  │  ├─ material-merge.ts            # 两层素材/分类合并纯函数
│  │  │  ├─ template-config.ts           # parseTemplateConfig 纯函数（坏 JSON → null）
│  │  │  ├─ calc-bridge.ts               # spec+素材 → CalculatorInput → CalculatorOutput（复算桥）
│  │  │  ├─ quote-utils.ts               # 报价单号 + 有效期纯函数（随机注入可测）
│  │  │  ├─ permissions.ts               # DiyRead/Create/Update/Delete
│  │  │  ├─ entities\diy-category.entity.ts
│  │  │  ├─ entities\diy-material.entity.ts
│  │  │  ├─ entities\diy-template.entity.ts
│  │  │  ├─ entities\diy-plan.entity.ts
│  │  │  ├─ diy.service.ts               # admin CRUD + 导入 + 复制 + 发布
│  │  │  ├─ diy-stock.service.ts         # 原子扣减/回补（缺口明细）
│  │  │  ├─ diy-order.service.ts         # 载体商品 + createOrderFromPlan + 价格策略包装
│  │  │  ├─ diy-shop.service.ts          # shop 查询面 + createDiyPlan/quoteDiyPlan/myDiyPlans
│  │  │  ├─ seed.ts                      # 幂等种子：分类 + 手串模板 + 载体商品
│  │  │  ├─ diy-admin.resolver.ts
│  │  │  ├─ diy-shop.resolver.ts
│  │  │  ├─ diy-plugin.ts                # 插件主体（SDL/configuration/seed/取消回补订阅）
│  │  │  └─ __tests__\
│  │  │     ├─ localize.spec.ts
│  │  │     ├─ material-merge.spec.ts
│  │  │     ├─ template-config.spec.ts
│  │  │     ├─ calc-bridge.spec.ts
│  │  │     └─ quote-utils.spec.ts
│  │  └─ e2e\diy.e2e-spec.ts             # quote→order 全链路 + 并发扣减 + 取消回补
│  └─ dev-server\
│     ├─ package.json                    # 修改：+ "@vendure/diy-plugin": "0.0.1"
│     ├─ dev-config.ts                   # 修改：import + DiyPlugin.init({app})
│     └─ migrations\                     # 两个生成式迁移（P1 三实体 / P4 DiyPlan）
└─ vendure-prod\
   └─ docs\plans\2026-10-11-diy-plugin-p1-p4.md   # 本计划
```

### Task 与阶段映射

| 阶段 | Tasks | 验收 |
| --- | --- | --- |
| P1 插件骨架 | Task 1–6 | 迁移可跑；admin-api 可配分类/素材/模板 |
| P2 查询面 | Task 7–9 | 合并/去重/回退单测全过 |
| P3 算量包 | Task 10–13 | §7.4 经验表 6 组断言全过；layout 确定性快照 |
| P4 三链路 | Task 14–19 | quote→order e2e；并发扣减测试；取消回补 |

---

## Task 1：@diy/calc 包骨架

**Files:**
- Create: `packages/diy-calc/package.json`
- Create: `packages/diy-calc/tsconfig.json`
- Create: `packages/diy-calc/tsconfig.build.json`
- Create: `packages/diy-calc/index.ts`
- Create: `packages/diy-calc/src/version.ts`
- Create: `packages/diy-calc/src/types.ts`
- Create: `packages/diy-calc/src/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@diy/calc",
  "version": "0.1.0",
  "license": "GPL-3.0-or-later",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**/*"],
  "scripts": {
    "watch": "tsc -p ./tsconfig.build.json --watch",
    "build": "rimraf lib && tsc -p ./tsconfig.build.json",
    "lint": "eslint --fix ."
  },
  "devDependencies": {
    "rimraf": "^5.0.5",
    "typescript": "5.8.2"
  }
}
```

注意：**不声明任何 runtime dependencies**——纯函数包，违反即失败（禁 import Vendure/Taro/React/IO）。

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./lib" },
  "files": ["./index.ts"]
}
```

- [ ] **Step 4: 创建 index.ts（包根入口）**

```ts
export * from './src/index';
```

- [ ] **Step 5: 创建 src/version.ts**

```ts
/** @diy/calc 语义化版本；写入 DiyPlan.calcVersion，算量公式升级时追踪存量方案 */
export const CALC_VERSION = '1.0.0';
```

- [ ] **Step 6: 创建 src/types.ts**

```ts
/** 适配反馈：偏紧/贴合/合适/宽松/过松（阈值见 bracelet.feedbackOf） */
export type FitFeedback = 'too-tight' | 'snug' | 'ok' | 'loose' | 'too-loose';

/**
 * 计算器消费的素材最小视图（对齐 DiyMaterial 列字段）。
 * 金额单位「分」，长度单位「mm」。
 */
export interface CalcMaterial {
  id: string;
  code: string;
  name: string;
  /** round / barrel / drum / faceted / spacer / cube / custom */
  shape: string;
  /** 径向直径 mm——渲染与筛选用 */
  diameter: number | null;
  /** 轴向长度 mm——算量用它（隔片/桶珠远小于直径） */
  axialLength: number | null;
  /** 孔径 mm——配线校验用 */
  holeSize: number | null;
  /** 单价（分） */
  price: number;
}

/** 槽位选择（来自 DiyPlan.spec.slots） */
export interface SlotSelection {
  key: string;
  role: 'main' | 'secondary' | 'spacer' | 'focal' | 'decor';
  materialId?: string;
  /** user 数量槽位的覆盖值 */
  qtyOverride?: number;
  /** 隔片：每隔几颗插一片 */
  every?: number;
}

/** 计算器统一输入 */
export interface CalculatorInput {
  /** 模板 params 声明的键值对（wristSize/fit/gap…），调用方已完成钳制 */
  params: Record<string, number | string>;
  slots: SlotSelection[];
  /** 参与素材（按 spec.slots 引用的 materialId 解析后的完整行） */
  materials: CalcMaterial[];
}

/** 算量几何结论（bead-diy CalcResult 同构） */
export interface CalcResult {
  /** 需求颗数（收敛后） */
  count: number;
  /** 公式直出颗数（收敛前，便于测试分别验证公式与收敛） */
  countInitial: number;
  /** 珠子中心线周长（mm） */
  centerCircumference: number;
  /** 成品内孔实际周长（mm）——用户手腕要穿过的那个洞 */
  innerCircumference: number;
  feedback: FitFeedback;
  /** 相对手围余量（mm），正 = 有余量 */
  clearance: number;
  /** ±1 颗的反馈建议 */
  adjustHint: { delta: number; feedback: FitFeedback }[];
  /** 建议配线长度（mm）= 中心线周长 + 弹力线打结留量 */
  cordLength: number;
  /** 建议配线线径（mm），calculator 依据最小孔径细化 */
  cordDiameter: number;
}

/** BOM 行（按素材聚合；金额分） */
export interface CalcBomItem {
  materialId: string;
  code: string;
  name: string;
  /** 规格串，如 "8mm 主珠" */
  spec: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
}

export interface CalcBom {
  items: CalcBomItem[];
  totalCount: number;
  /** 分 */
  totalAmount: number;
  cord: { length: number; diameter: number; note: string } | null;
  geometry: Pick<CalcResult, 'innerCircumference' | 'feedback' | 'clearance'> | null;
}

/** 计算器统一输出 */
export interface CalculatorOutput {
  /** 几何/算量结论（sum 这类选择型计算器为 null） */
  calc: CalcResult | null;
  bom: CalcBom;
}

export type Calculator = (input: CalculatorInput) => CalculatorOutput;
```

- [ ] **Step 7: 创建 src/index.ts（桶导出）**

```ts
export * from './version';
export * from './types';
export * from './prng';
export * from './bracelet';
export * from './bracelet-calculator';
export * from './layout';
export * from './sum';
export * from './registry';
```

（Task 2 起逐个补齐 prng/bracelet 等文件；本任务先建 `src/prng.ts`、`src/sum.ts`、`src/bracelet.ts`、`src/bracelet-calculator.ts`、`src/layout.ts`、`src/registry.ts` 的**空占位会导致 index 编译失败**，因此本任务先写成只导出已存在文件：）

```ts
export * from './version';
export * from './types';
```

- [ ] **Step 8: 安装依赖并验证编译**

Run: `pnpm install`
Expected: `Packages: +N` 或 `Already up to date`，无 ERR。

Run: `pnpm --filter @diy/calc build`
Expected: 无错误；生成 `packages/diy-calc/lib/index.js`、`lib/index.d.ts`、`lib/src/version.d.ts`。

- [ ] **Step 9: 提交**

```powershell
git add packages/diy-calc/package.json packages/diy-calc/tsconfig.json packages/diy-calc/tsconfig.build.json packages/diy-calc/index.ts packages/diy-calc/src
git commit -m "feat(diy-calc): add @diy/calc pure-function package skeleton"
```

---

## Task 2：@diy/calc 确定性伪随机 + 内置 sum 计算器 + registry（TDD）

**Files:**
- Create: `packages/diy-calc/src/prng.ts`
- Create: `packages/diy-calc/src/sum.ts`
- Create: `packages/diy-calc/src/registry.ts`
- Test: `packages/diy-calc/src/__tests__/prng.spec.ts`
- Test: `packages/diy-calc/src/__tests__/sum.spec.ts`

- [ ] **Step 1: 写 prng 失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../prng';

describe('mulberry32 确定性伪随机', () => {
    it('同种子序列完全一致', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const seqA = Array.from({ length: 10 }, () => a());
        const seqB = Array.from({ length: 10 }, () => b());
        expect(seqA).toEqual(seqB);
    });
    it('不同种子序列不同', () => {
        const a = mulberry32(1);
        const b = mulberry32(2);
        expect(a()).not.toBe(b());
    });
    it('值域 [0,1)', () => {
        const rnd = mulberry32(7);
        for (let i = 0; i < 1000; i++) {
            const v = rnd();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
    it('整数溢出安全（负数/超大种子不抛错）', () => {
        expect(() => mulberry32(-1)()).not.toThrow();
        expect(() => mulberry32(2 ** 31)()).not.toThrow();
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/prng.spec.ts`
Expected: FAIL，`Cannot find module '../prng'`（或等价解析错误）。

- [ ] **Step 3: 实现 prng.ts**

```ts
/**
 * mulberry32：确定性伪随机数生成器（PRNG）。
 * 同 seed 必产生同一序列——随机混色/纹理旋转种子可复现的关键。
 */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/prng.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 写 sum 计算器失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { sumCalculator } from '../sum';
import { CalcMaterial, SlotSelection } from '../types';

const bead: CalcMaterial = {
    id: '1', code: 'A-AGS-08-N', name: '玛瑙玉髓猫眼 8mm', shape: 'round',
    diameter: 8, axialLength: 8, holeSize: 1, price: 150,
};
const spacer: CalcMaterial = {
    id: '2', code: 'M-SSP-06-SV', name: '圆隔片 6mm 银', shape: 'spacer',
    diameter: 6, axialLength: 2, holeSize: 1.5, price: 30,
};

function sel(key: string, role: SlotSelection['role'], materialId?: string, qtyOverride?: number): SlotSelection {
    return { key, role, materialId, qtyOverride };
}

describe('sum 内置计算器（选择型玩法兜底）', () => {
    it('BOM = Σ 槽位素材 × 数量，金额分为整数', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1', 4), sel('b', 'decor', '2', 6)],
            materials: [bead, spacer],
        });
        expect(out.calc).toBeNull();
        expect(out.bom.items).toHaveLength(2);
        expect(out.bom.totalCount).toBe(10);
        expect(out.bom.totalAmount).toBe(4 * 150 + 6 * 30);
    });
    it('qtyOverride 缺省为 1', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1')],
            materials: [bead],
        });
        expect(out.bom.items[0].qty).toBe(1);
        expect(out.bom.totalAmount).toBe(150);
    });
    it('未选槽位/未知素材跳过，不抛错', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main'), sel('b', 'decor', '999')],
            materials: [bead],
        });
        expect(out.bom.items).toHaveLength(0);
        expect(out.bom.totalAmount).toBe(0);
    });
    it('同素材多槽位合并为一行', () => {
        const out = sumCalculator({
            params: {},
            slots: [sel('a', 'main', '1', 2), sel('b', 'secondary', '1', 3)],
            materials: [bead],
        });
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0].qty).toBe(5);
    });
    it('cord/geometry 为 null（无几何语义）', () => {
        const out = sumCalculator({ params: {}, slots: [], materials: [] });
        expect(out.bom.cord).toBeNull();
        expect(out.bom.geometry).toBeNull();
    });
});
```

- [ ] **Step 6: 运行确认失败**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/sum.spec.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 7: 实现 sum.ts**

```ts
import { CalcBom, CalcBomItem, Calculator, CalcMaterial } from './types';

/**
 * 内置 sum 计算器：BOM = Σ 槽位素材 × 数量。
 * 选择型玩法（如汽车模型延后接入）零代码即用；calculatorKey 为 null/未知时的兜底。
 */
export function buildSumBom(
    slots: { materialId?: string; qtyOverride?: number }[],
    materials: CalcMaterial[],
): CalcBom {
    const byId = new Map(materials.map(m => [m.id, m]));
    const items: CalcBomItem[] = [];
    for (const slot of slots) {
        if (!slot.materialId) continue;
        const m = byId.get(slot.materialId);
        if (!m) continue;
        const qty = Math.max(0, Math.floor(slot.qtyOverride ?? 1));
        if (qty === 0) continue;
        const existing = items.find(i => i.materialId === m.id);
        if (existing) {
            existing.qty += qty;
            existing.subtotal += qty * m.price;
            continue;
        }
        items.push({
            materialId: m.id,
            code: m.code,
            name: m.name,
            spec: m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape,
            unitPrice: m.price,
            qty,
            subtotal: qty * m.price,
        });
    }
    return {
        items,
        totalCount: items.reduce((s, i) => s + i.qty, 0),
        totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
        cord: null,
        geometry: null,
    };
}

export const sumCalculator: Calculator = input => ({
    calc: null,
    bom: buildSumBom(input.slots, input.materials),
});
```

- [ ] **Step 8: 运行确认通过**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/sum.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: 实现 registry.ts（getCalculator 兜底语义）**

```ts
import { Calculator } from './types';
import { braceletCalculator } from './bracelet-calculator';
import { sumCalculator } from './sum';

const registry: Record<string, Calculator> = {
    sum: sumCalculator,
    bracelet: braceletCalculator,
};

/**
 * 按 calculatorKey 取计算器；null/未知 key 一律回退内置 sum（规格 §5.3）。
 * 新玩法注册新 key：registerCalculator('car-model', fn)。
 */
export function getCalculator(key?: string | null): Calculator {
    return (key != null && registry[key]) || registry.sum;
}

export function registerCalculator(key: string, fn: Calculator): void {
    registry[key] = fn;
}

export function listCalculators(): string[] {
    return Object.keys(registry);
}
```

注意：Task 2 时 `bracelet-calculator.ts` 尚不存在——本任务先建 `src/bracelet-calculator.ts` 为最小可用实现（bracelet 完整算法在 Task 10/11 实现，这里先用 sum 语义顶位，保证 registry 可编译）：

```ts
// src/bracelet-calculator.ts（Task 2 临时顶位；Task 11 替换为完整实现）
import { Calculator } from './types';
import { buildSumBom } from './sum';

export const braceletCalculator: Calculator = input => ({
    calc: null,
    bom: buildSumBom(input.slots, input.materials),
});
```

同时把 `src/index.ts` 恢复为全量桶导出（Task 1 Step 7 的完整版本）。

- [ ] **Step 10: 全量测试 + 提交**

Run: `pnpm vitest run packages/diy-calc`
Expected: PASS (9 tests)

```powershell
git add packages/diy-calc
git commit -m "feat(diy-calc): add mulberry32 prng, built-in sum calculator and calculator registry"
```

---

## Task 3：@vendure/diy-plugin 包骨架

**Files:**
- Create: `packages/diy-plugin/package.json`
- Create: `packages/diy-plugin/tsconfig.json`
- Create: `packages/diy-plugin/tsconfig.build.json`
- Create: `packages/diy-plugin/index.ts`
- Create: `packages/diy-plugin/vitest.config.mts`
- Create: `packages/diy-plugin/src/constants.ts`
- Create: `packages/diy-plugin/src/types.ts`
- Create: `packages/diy-plugin/src/permissions.ts`
- Create: `packages/diy-plugin/src/diy-plugin.ts`（骨架，Task 5/9/17/18 增量补齐）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@vendure/diy-plugin",
  "version": "0.0.1",
  "license": "GPL-3.0-or-later",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**/*"],
  "scripts": {
    "watch": "tsc -p ./tsconfig.build.json --watch",
    "build": "rimraf lib && tsc -p ./tsconfig.build.json",
    "lint": "eslint --fix .",
    "e2e": "cross-env PACKAGE=diy-plugin vitest --config vitest.config.mts --run"
  },
  "dependencies": {
    "@diy/calc": "workspace:*"
  },
  "peerDependencies": {
    "@vendure/common": "^3.6.0",
    "@vendure/core": "^3.6.0"
  },
  "devDependencies": {
    "@vendure/common": "workspace:*",
    "@vendure/core": "workspace:*",
    "@vendure/testing": "workspace:*",
    "cross-env": "^7.0.3",
    "graphql-tag": "^2.12.6",
    "rimraf": "^5.0.5",
    "typescript": "5.8.2"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json / tsconfig.build.json / index.ts / vitest.config.mts**

`tsconfig.json`：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`tsconfig.build.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./lib" },
  "files": ["./index.ts"]
}
```

`index.ts`：

```ts
export * from './src/diy-plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/permissions';
```

（**桶导出只写以上 4 个已存在文件**。其余导出随对应 Task 创建后逐个追加：实体 3 行 → Task 4 Step 4；`./src/localize` → Task 7；`./src/material-merge` → Task 8；`./src/template-config` → Task 9；`./src/entities/diy-plan.entity` 与 `./src/calc-bridge` → Task 14。这样每个 Task 结束时 `pnpm --filter @vendure/diy-plugin build` 都能通过。）

`vitest.config.mts`（e2e 用，仿 points-mall-plugin）：

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.e2e-spec.ts'],
        testTimeout: process.env.E2E_DEBUG ? 1800 * 1000 : process.env.CI ? 30 * 1000 : 15 * 1000,
        allowOnly: true,
    },
    plugins: [
        swc.vite({
            jsc: {
                transform: {
                    useDefineForClassFields: false,
                },
            },
        }),
    ],
});
```

- [ ] **Step 3: 创建 src/constants.ts**

```ts
export const loggerCtx = 'DiyPlugin';
export const PLUGIN_INIT_OPTIONS = Symbol('DIY_PLUGIN_OPTIONS');

/** 报价单默认有效期（天），quoteDiyPlan 时写入 expiresAt */
export const DEFAULT_QUOTE_TTL_DAYS = 7;

/** 载体商品/变体（Vendure OrderLine.productVariant 非空，DIY 成品行挂在它上面） */
export const CARRIER_PRODUCT_SLUG = 'diy-custom-carrier';
export const CARRIER_PRODUCT_NAME = 'DIY 定制成品';
export const CARRIER_VARIANT_SKU = 'DIY-CUSTOM';

/** 方案/报价/下单兜底租户端（与 ShopTemplatePlugin.init({app}) 同语义） */
export type DiyApp = 'nshop' | 'vshop';
```

- [ ] **Step 4: 创建 src/types.ts**

```ts
/** LocalizedText：jsonb 存储形态；键 zh-CN / en-US */
export type LocalizedText = string | Record<string, string>;

export interface DiyPluginOptions {
    /** 本实例租户端；缺省按环境变量 APP 推断，再缺省 nshop */
    app?: 'nshop' | 'vshop';
}

/* ------------------------- 模板 config（规格 §5.2，约定即接口） ------------------------- */

export interface SlotFilter {
    categoryCodes?: string[];
    shapes?: string[];
    diameterRange?: [number, number];
}

export interface TemplateSlot {
    key: string;
    name: LocalizedText;
    role: 'main' | 'secondary' | 'spacer' | 'focal' | 'decor';
    required: boolean;
    /** calculated=计算器算 | fixed | user */
    quantityMode: 'calculated' | 'fixed' | 'user';
    /** fixed 时的数量 */
    quantity?: number;
    /** user 时的 [min, max] */
    quantityRange?: [number, number];
    filter?: SlotFilter;
    defaultMaterialId?: string;
    /** 隔片：每隔几颗插一片 */
    defaultEvery?: number;
}

export interface TemplateParam {
    key: string;
    type: 'number' | 'enum' | 'boolean';
    unit?: string;
    min?: number;
    max?: number;
    default?: number | string | boolean;
    options?: string[];
    ui?: string;
    advanced?: boolean;
}

export type TemplateConstraint =
    | { type: 'mutuallyExclusive'; slots: string[] }
    | { type: 'dependency'; slot: string; requires: string }
    | { type: 'requiredWith'; slots: string[] }
    | { type: 'quantityLink'; a: string; b: string; ratio: number };

export interface TemplatePresentation {
    /** C 端渲染器组件 key */
    renderer: string;
    /** C 端设计器积木块 key 列表 */
    blocks: string[];
}

export interface DiyTemplateConfig {
    slots: TemplateSlot[];
    params: TemplateParam[];
    constraints: TemplateConstraint[];
    presentation: TemplatePresentation;
}

/* ------------------------- DiyPlan.spec（搭配参数快照，规格 §6.1） ------------------------- */

export interface DiyPlanSlotSelection {
    materialId: string;
    /** user 数量槽位覆盖 */
    qtyOverride?: number;
    /** 隔片：每隔几颗插一片 */
    every?: number;
}

export interface DiyPlanSpec {
    /** slotKey → 选择 */
    slots: Record<string, DiyPlanSlotSelection>;
    /** 模板 params 键值对（wristSize/fit/gap…） */
    params: Record<string, number | string>;
    /** 随机混色种子 */
    seed?: number;
}

/* ------------------------- DiyPlan.bom（BOM 快照，规格 §6.1） ------------------------- */

export interface DiyPlanBomItem {
    materialId: string;
    code: string;
    name: string;
    spec: string;
    /** 分 */
    unitPrice: number;
    qty: number;
    /** 分 */
    subtotal: number;
}

export interface DiyPlanBom {
    items: DiyPlanBomItem[];
    totalCount: number;
    /** 分 */
    totalAmount: number;
    cord?: { length: number; diameter: number; note?: string };
    geometry?: { innerCircumference?: number; feedback?: string; clearance?: number };
    /** 下单复算价 ≠ 报价价时，订单行同时记录报价参考价（规格 §6.3） */
    quoteRefAmount?: number;
}

/* ------------------------- 输入/过滤 ------------------------- */

export interface DiyCategoryInput {
    id?: string;
    app?: string;
    code?: string;
    parentId?: number | null;
    name?: LocalizedText;
    image?: string | null;
    sortOrder?: number;
    enabled?: boolean;
}

export interface DiyMaterialInput {
    id?: string;
    app?: string;
    code?: string;
    name?: LocalizedText;
    categoryId?: number;
    shape?: string;
    diameter?: number | null;
    axialLength?: number | null;
    holeSize?: number | null;
    attrs?: Record<string, any> | null;
    render?: Record<string, any> | null;
    price?: number;
    priceUnit?: string;
    currency?: string;
    stock?: number;
    images?: string[] | null;
    enabled?: boolean;
    sortOrder?: number;
}

export interface DiyTemplateInput {
    id?: string;
    app?: string;
    code?: string;
    name?: LocalizedText;
    description?: LocalizedText | null;
    thumb?: string | null;
    images?: string[] | null;
    config?: DiyTemplateConfig | null;
    calculatorKey?: string | null;
    status?: 'draft' | 'enabled' | 'disabled';
    sortOrder?: number;
}

export interface DiyMaterialFilter {
    categoryId?: number;
    categoryCode?: string;
    shapes?: string[];
    diameterMin?: number;
    diameterMax?: number;
    keyword?: string;
    onlyEnabled?: boolean;
    skip?: number;
    take?: number;
}

export interface DiyPlanListOptions {
    app?: string;
    status?: 'draft' | 'quoted' | 'ordered';
    userId?: number;
    skip?: number;
    take?: number;
}
```

- [ ] **Step 5: 创建 src/permissions.ts**

```ts
import { PermissionDefinition } from '@vendure/core';

export const DiyRead = new PermissionDefinition({
    name: 'DiyRead',
    description: 'Allows viewing DIY categories, materials, templates and plans',
});
export const DiyCreate = new PermissionDefinition({
    name: 'DiyCreate',
    description: 'Allows creating DIY categories, materials and templates',
});
export const DiyUpdate = new PermissionDefinition({
    name: 'DiyUpdate',
    description: 'Allows updating DIY categories, materials, templates and importing materials',
});
export const DiyDelete = new PermissionDefinition({
    name: 'DiyDelete',
    description: 'Allows deleting DIY categories, materials and templates',
});
```

- [ ] **Step 6: 创建 src/diy-plugin.ts 骨架**

```ts
import { Injectable, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyPluginOptions } from './types';

@Injectable()
export class DiyServiceStub {}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [],
    providers: [{ provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options }, DiyServiceStub],
    exports: [],
    compatibility: '^3.0.0',
})
export class DiyPlugin {
    private static options: DiyPluginOptions = {};

    static init(options?: DiyPluginOptions): Type<DiyPlugin> {
        DiyPlugin.options = options ?? {};
        return DiyPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('DiyPlugin initialized (skeleton)', loggerCtx);
    }
}
```

- [ ] **Step 7: 安装依赖并验证编译**

Run: `pnpm install`
Expected: 无 ERR（workspace 链接 @diy/calc）。

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误，生成 `packages/diy-plugin/lib/index.js`。

- [ ] **Step 8: 提交**

```powershell
git add packages/diy-plugin/package.json packages/diy-plugin/tsconfig.json packages/diy-plugin/tsconfig.build.json packages/diy-plugin/index.ts packages/diy-plugin/vitest.config.mts packages/diy-plugin/src
git commit -m "feat(diy-plugin): add plugin skeleton with options, permissions and types"
```

---

## Task 4：三实体 + 注册 dev-server + 迁移生成运行

**Files:**
- Create: `packages/diy-plugin/src/entities/diy-category.entity.ts`
- Create: `packages/diy-plugin/src/entities/diy-material.entity.ts`
- Create: `packages/diy-plugin/src/entities/diy-template.entity.ts`
- Modify: `packages/dev-server/package.json`（dependencies 增加一行）
- Modify: `packages/dev-server/dev-config.ts`（import + plugins 数组增加一行）
- Create: `packages/dev-server/migrations/<timestamp>-add_diy_entities.ts`（命令生成）

- [ ] **Step 1: 创建 diy-category.entity.ts**

```ts
import { VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

import { LocalizedText } from '../types';

/** DIY 分类：单表两层，app=null 平台分类（全局可见），非空=租户自建（并集，无覆盖） */
@Entity()
export class DiyCategory extends VendureEntity {
    constructor(input?: Partial<DiyCategory>) {
        super(input);
    }

    @Column({ nullable: true })
    app: string | null;

    /** slug：crystal/agate/wood/amber/pearl/metal/gemstone；槽位 filter.categoryCodes 按它过滤 */
    @Column({ nullable: true })
    code: string | null;

    @Column({ nullable: true })
    parentId: number | null;

    @Column('simple-json')
    name: LocalizedText;

    @Column({ nullable: true })
    image: string | null;

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ default: true })
    enabled: boolean;
}
```

- [ ] **Step 2: 创建 diy-material.entity.ts**

```ts
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { LocalizedText } from '../types';

/**
 * DIY 素材：单表两层（app=null 平台库 / 非空=租户库），层级唯一开关。
 * 金额分（整数）、长度 mm（double）。
 * 唯一键 (app, code) 在服务层校验（postgres 唯一索引对 NULL 视为互异，
 * 平台行无法用 DB 约束保唯一）；此处复合索引用于查询性能。
 */
@Entity()
@Index('idx_diy_material_app_code', ['app', 'code'])
export class DiyMaterial extends VendureEntity {
    constructor(input?: Partial<DiyMaterial>) {
        super(input);
    }

    @Column({ nullable: true })
    app: string | null;

    /** 货号：{大类码}-{材质码}-{直径两位}-{工艺码}，如 A-AGS-08-N */
    @Column('varchar', { length: 64 })
    code: string;

    @Column('simple-json')
    name: LocalizedText;

    @Column()
    categoryId: number;

    /** round / barrel / drum / faceted / spacer / cube / custom */
    @Column('varchar')
    shape: string;

    /** 径向直径 mm——渲染与筛选用 */
    @Column({ type: 'double', nullable: true })
    diameter: number | null;

    /** 轴向长度 mm——算量用它（隔片/桶珠远小于直径） */
    @Column({ type: 'double', nullable: true })
    axialLength: number | null;

    /** 孔径 mm——配线校验用 */
    @Column({ type: 'double', nullable: true })
    holeSize: number | null;

    /** 行业扩展属性（卡口型号/比例/色号/纹理种子…），计算器按约定 key 读取 */
    @Column('simple-json', { nullable: true })
    attrs: Record<string, any> | null;

    /** C 端演示渲染参数（bead-diy RenderSpec 同构） */
    @Column('simple-json', { nullable: true })
    render: Record<string, any> | null;

    /** 单价（分） */
    @Column('int')
    price: number;

    /** piece / gram / meter / cm；库存按此单位计整数 */
    @Column('varchar', { default: 'piece' })
    priceUnit: string;

    @Column('varchar', { length: 3, default: 'CNY' })
    currency: string;

    @Column('int', { default: 0 })
    stock: number;

    /** 图片 URL 数组（静态目录 + 动态 origin 由前端拼装） */
    @Column('simple-json', { nullable: true })
    images: string[] | null;

    /** 复制平台素材时的回链 */
    @Column({ nullable: true })
    sourceMaterialId: number | null;

    @Column({ default: true })
    enabled: boolean;

    @Column({ default: 0 })
    sortOrder: number;
}
```

- [ ] **Step 3: 创建 diy-template.entity.ts**

```ts
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { DiyTemplateConfig, LocalizedText } from '../types';

/** DIY 玩法模板：config=slots+params+constraints+presentation；calculatorKey=null 兜底内置 sum */
@Entity()
@Index('idx_diy_template_app_code', ['app', 'code'])
export class DiyTemplate extends VendureEntity {
    constructor(input?: Partial<DiyTemplate>) {
        super(input);
    }

    @Column({ nullable: true })
    app: string | null;

    /** slug，如 bracelet-classic；唯一键 (app, code) 服务层校验 */
    @Column('varchar', { length: 64 })
    code: string;

    @Column('simple-json')
    name: LocalizedText;

    @Column('simple-json', { nullable: true })
    description: LocalizedText | null;

    @Column({ nullable: true })
    thumb: string | null;

    @Column('simple-json', { nullable: true })
    images: string[] | null;

    @Column('simple-json')
    config: DiyTemplateConfig;

    @Column('varchar', { nullable: true })
    calculatorKey: string | null;

    /** draft / enabled / disabled */
    @Column('varchar', { default: 'draft' })
    status: 'draft' | 'enabled' | 'disabled';

    /** 每次发布（publish → enabled）+1；仅用于「再编辑」提示，不参与复算 */
    @Column({ default: 1 })
    version: number;

    @Column({ default: 0 })
    sortOrder: number;
}
```

- [ ] **Step 4: 注册到 dev-server**

修改 `packages/dev-server/package.json`，在 `"@vendure/shop-template-plugin": "0.0.1",` 一行后新增：

```json
        "@vendure/diy-plugin": "0.0.1",
```

修改 `packages/dev-server/dev-config.ts`：

在 `import { ShopTemplatePlugin } from '@vendure/shop-template-plugin';` 之后新增 import：

```ts
import { DiyPlugin } from '@vendure/diy-plugin';
```

在 plugins 数组中 `ShopTemplatePlugin.init({ app: ... }),` 一行之后新增：

```ts
        // DIY 商品：两层素材库 + 玩法模板 + 方案三链路（demo/quote/order）
        DiyPlugin.init({ app: (process.env.APP as 'nshop' | 'vshop') ?? 'nshop' }),
```

同时在 `packages/diy-plugin/index.ts` 末尾追加三行实体导出：

```ts
export * from './src/entities/diy-category.entity';
export * from './src/entities/diy-material.entity';
export * from './src/entities/diy-template.entity';
```

- [ ] **Step 5: 安装依赖并验证构建**

Run: `pnpm install ; pnpm --filter @vendure/diy-plugin build`
Expected: 无错误，`packages/diy-plugin/lib/index.js` 生成。

- [ ] **Step 6: 生成迁移**

确认本地 postgres 可用（`packages/dev-server/.env`：DB=postgres @127.0.0.1:5432 db=vendure）。然后在 `packages/dev-server` 目录执行：

```powershell
cd packages\dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts generate add_diy_entities
cd D:\zhao\vendure
```

Expected: 生成 `packages/dev-server/migrations/<timestamp>-add_diy_entities.ts`，内含 `diy_category` / `diy_material` / `diy_template` 三表的 createTable（及索引）。

> 生成器对线上库做 diff：由于 dev 库此前 synchronize:true 已与其余实体同步，新迁移应当**只含** diy_* 三表；若 diff 出无关变更，停下来检查是否有同事的未迁移实体，不要顺手带上。

- [ ] **Step 7: 运行迁移并验证表**

```powershell
cd packages\dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
node -r dotenv/config -e "const {Client}=require('pg');(async()=>{const c=new Client({host:'127.0.0.1',port:5432,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});await c.connect();const r=await c.query(`"select table_name from information_schema.tables where table_name like 'diy_%' order by 1`");console.log(r.rows.map(x=>x.table_name).join('\n'));await c.end();})()"
cd D:\zhao\vendure
```

Expected: 迁移执行成功；输出包含：

```
diy_category
diy_material
diy_template
```

- [ ] **Step 8: 提交（迁移文件一并入库）**

```powershell
git add packages/diy-plugin/src/entities packages/dev-server/package.json packages/dev-server/dev-config.ts packages/dev-server/migrations
git commit -m "feat(diy-plugin): add DiyCategory/DiyMaterial/DiyTemplate entities with migration and dev-server wiring"
```

---

## Task 5：admin-api CRUD（分类/素材/模板 + 导入/复制/发布）

**Files:**
- Create: `packages/diy-plugin/src/diy.service.ts`
- Create: `packages/diy-plugin/src/diy-admin.resolver.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（注册 adminApiExtensions）

- [ ] **Step 1: 创建 diy.service.ts（admin 服务）**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import {
    DiyCategoryInput,
    DiyMaterialInput,
    DiyPluginOptions,
    DiyTemplateInput,
    LocalizedText,
} from './types';

@Injectable()
export class DiyService {
    constructor(
        private connection: TransactionalConnection,
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
    ) {}

    /* ------------------------------ 分类 ------------------------------ */

    /** app 传 undefined = 全部（管理端），传 null = 仅平台 */
    async findCategories(ctx: RequestContext, app?: string | null): Promise<DiyCategory[]> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const qb = repo.createQueryBuilder('cat');
        if (app !== undefined) {
            qb.where('cat.app = :app', { app });
        }
        return qb.orderBy('cat.sortOrder', 'ASC').addOrderBy('cat.id', 'ASC').getMany();
    }

    async findOneCategory(ctx: RequestContext, id: ID): Promise<DiyCategory | null> {
        return this.connection.getRepository(ctx, DiyCategory).findOne({ where: { id: id as any } });
    }

    async createCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        if (input.code) {
            const dup = await repo.findOne({ where: { app: input.app ?? null, code: input.code } });
            if (dup) {
                throw new UserInputError(`分类 code 已存在: ${input.code}`);
            }
        }
        const cat = new DiyCategory({
            app: input.app ?? null,
            code: input.code ?? null,
            parentId: input.parentId ?? null,
            name: (input.name ?? {}) as LocalizedText,
            image: input.image ?? null,
            sortOrder: input.sortOrder ?? 0,
            enabled: input.enabled ?? true,
        });
        return repo.save(cat);
    }

    async updateCategory(ctx: RequestContext, input: DiyCategoryInput): Promise<DiyCategory> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cat = await repo.findOne({ where: { id: input.id as any } });
        if (!cat) {
            throw new UserInputError('分类不存在');
        }
        if (input.code !== undefined) cat.code = input.code;
        if (input.parentId !== undefined) cat.parentId = input.parentId;
        if (input.name !== undefined) cat.name = input.name as LocalizedText;
        if (input.image !== undefined) cat.image = input.image;
        if (input.sortOrder !== undefined) cat.sortOrder = input.sortOrder;
        if (input.enabled !== undefined) cat.enabled = input.enabled;
        return repo.save(cat);
    }

    async deleteCategory(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cat = await repo.findOne({ where: { id: id as any } });
        if (!cat) {
            return false;
        }
        const used = await this.connection
            .getRepository(ctx, DiyMaterial)
            .count({ where: { categoryId: Number(id) as any } });
        if (used > 0) {
            throw new UserInputError(`分类下存在 ${used} 个素材，禁止删除`);
        }
        await repo.remove(cat);
        return true;
    }

    /* ------------------------------ 素材 ------------------------------ */

    async findMaterials(
        ctx: RequestContext,
        app?: string | null,
        skip = 0,
        take = 100,
    ): Promise<DiyMaterial[]> {
        const qb = this.connection
            .getRepository(ctx, DiyMaterial)
            .createQueryBuilder('mat')
            .skip(skip)
            .take(Math.min(take, 500))
            .orderBy('mat.sortOrder', 'ASC')
            .addOrderBy('mat.id', 'ASC');
        if (app !== undefined) {
            qb.where('mat.app = :app', { app });
        }
        return qb.getMany();
    }

    async findOneMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial | null> {
        return this.connection.getRepository(ctx, DiyMaterial).findOne({ where: { id: id as any } });
    }

    /** (app, code) 唯一性服务层校验 */
    private async assertCodeFree(
        ctx: RequestContext,
        app: string | null,
        code: string,
        excludeId?: ID,
    ): Promise<void> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const existing = await repo.findOne({ where: { app, code } });
        if (existing && (!excludeId || String(existing.id) !== String(excludeId))) {
            throw new UserInputError(`货号已存在: ${code}（app=${app ?? 'platform'}）`);
        }
    }

    async createMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial> {
        if (!input.code || !input.name || input.categoryId == null || !input.shape || input.price == null) {
            throw new UserInputError('code/name/categoryId/shape/price 为必填');
        }
        const app = input.app ?? null;
        await this.assertCodeFree(ctx, app, input.code);
        const mat = new DiyMaterial({
            app,
            code: input.code,
            name: input.name as LocalizedText,
            categoryId: input.categoryId,
            shape: input.shape,
            diameter: input.diameter ?? null,
            axialLength: input.axialLength ?? null,
            holeSize: input.holeSize ?? null,
            attrs: input.attrs ?? null,
            render: input.render ?? null,
            price: Math.round(input.price),
            priceUnit: input.priceUnit ?? 'piece',
            currency: input.currency ?? 'CNY',
            stock: Math.round(input.stock ?? 0),
            images: input.images ?? null,
            enabled: input.enabled ?? true,
            sortOrder: input.sortOrder ?? 0,
        });
        return this.connection.getRepository(ctx, DiyMaterial).save(mat);
    }

    async updateMaterial(ctx: RequestContext, input: DiyMaterialInput): Promise<DiyMaterial> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const mat = await repo.findOne({ where: { id: input.id as any } });
        if (!mat) {
            throw new UserInputError('素材不存在');
        }
        if (input.code !== undefined && input.code !== mat.code) {
            await this.assertCodeFree(ctx, mat.app, input.code, mat.id);
            mat.code = input.code;
        }
        if (input.name !== undefined) mat.name = input.name as LocalizedText;
        if (input.categoryId !== undefined) mat.categoryId = input.categoryId;
        if (input.shape !== undefined) mat.shape = input.shape;
        if (input.diameter !== undefined) mat.diameter = input.diameter;
        if (input.axialLength !== undefined) mat.axialLength = input.axialLength;
        if (input.holeSize !== undefined) mat.holeSize = input.holeSize;
        if (input.attrs !== undefined) mat.attrs = input.attrs;
        if (input.render !== undefined) mat.render = input.render;
        if (input.price !== undefined) mat.price = Math.round(input.price);
        if (input.priceUnit !== undefined) mat.priceUnit = input.priceUnit;
        if (input.currency !== undefined) mat.currency = input.currency;
        if (input.stock !== undefined) mat.stock = Math.round(input.stock);
        if (input.images !== undefined) mat.images = input.images;
        if (input.enabled !== undefined) mat.enabled = input.enabled;
        if (input.sortOrder !== undefined) mat.sortOrder = input.sortOrder;
        return repo.save(mat);
    }

    async deleteMaterial(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const mat = await repo.findOne({ where: { id: id as any } });
        if (!mat) {
            return false;
        }
        await repo.remove(mat);
        return true;
    }

    /** 租户复制平台素材 = 完全接管价库存（sourceMaterialId 回链） */
    async copyMaterial(ctx: RequestContext, id: ID): Promise<DiyMaterial> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const source = await repo.findOne({ where: { id: id as any } });
        if (!source) {
            throw new UserInputError('素材不存在');
        }
        if (source.app !== null) {
            throw new UserInputError('仅平台素材可复制为租户素材');
        }
        const tenantApp = this.options.app ?? 'nshop';
        await this.assertCodeFree(ctx, tenantApp, source.code);
        const copy = new DiyMaterial({
            ...source,
            id: undefined,
            app: tenantApp,
            sourceMaterialId: Number(source.id),
        } as Partial<DiyMaterial>);
        return repo.save(copy);
    }

    /**
     * 批量导入/更新素材（首批珠子库 40+ 条走这里）。
     * input = { app?: string | null, items: DiyMaterialInput[] }；按 (app, code) upsert。
     * 返回处理条数。
     */
    async importMaterials(ctx: RequestContext, input: { app?: string | null; items: DiyMaterialInput[] }): Promise<number> {
        if (!Array.isArray(input.items) || input.items.length === 0) {
            throw new UserInputError('items 不能为空');
        }
        const app = input.app ?? null;
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        return this.connection.withTransaction(ctx, async txCtx => {
            const txRepo = txCtx.getRepository(DiyMaterial);
            let count = 0;
            for (const item of input.items) {
                if (!item.code) {
                    throw new UserInputError('导入项缺少 code');
                }
                const existing = await txRepo.findOne({ where: { app, code: item.code } });
                if (existing) {
                    if (item.name !== undefined) existing.name = item.name as LocalizedText;
                    if (item.categoryId !== undefined) existing.categoryId = item.categoryId;
                    if (item.shape !== undefined) existing.shape = item.shape;
                    if (item.diameter !== undefined) existing.diameter = item.diameter;
                    if (item.axialLength !== undefined) existing.axialLength = item.axialLength;
                    if (item.holeSize !== undefined) existing.holeSize = item.holeSize;
                    if (item.attrs !== undefined) existing.attrs = item.attrs;
                    if (item.render !== undefined) existing.render = item.render;
                    if (item.price !== undefined) existing.price = Math.round(item.price);
                    if (item.priceUnit !== undefined) existing.priceUnit = item.priceUnit;
                    if (item.currency !== undefined) existing.currency = item.currency;
                    if (item.stock !== undefined) existing.stock = Math.round(item.stock);
                    if (item.images !== undefined) existing.images = item.images;
                    if (item.enabled !== undefined) existing.enabled = item.enabled;
                    if (item.sortOrder !== undefined) existing.sortOrder = item.sortOrder;
                    await txRepo.save(existing);
                } else {
                    if (item.categoryId == null || !item.shape || item.price == null) {
                        throw new UserInputError(`新货号 ${item.code} 缺少 categoryId/shape/price`);
                    }
                    await txRepo.save(
                        new DiyMaterial({
                            app,
                            code: item.code,
                            name: (item.name ?? item.code) as LocalizedText,
                            categoryId: item.categoryId,
                            shape: item.shape,
                            diameter: item.diameter ?? null,
                            axialLength: item.axialLength ?? null,
                            holeSize: item.holeSize ?? null,
                            attrs: item.attrs ?? null,
                            render: item.render ?? null,
                            price: Math.round(item.price),
                            priceUnit: item.priceUnit ?? 'piece',
                            currency: item.currency ?? 'CNY',
                            stock: Math.round(item.stock ?? 0),
                            images: item.images ?? null,
                            enabled: item.enabled ?? true,
                            sortOrder: item.sortOrder ?? 0,
                        }),
                    );
                }
                count++;
            }
            Logger.info(`importMaterials app=${app ?? 'platform'} count=${count}`, loggerCtx);
            return count;
        });
    }

    /* ------------------------------ 模板 ------------------------------ */

    async findTemplates(ctx: RequestContext, app?: string | null): Promise<DiyTemplate[]> {
        const qb = this.connection
            .getRepository(ctx, DiyTemplate)
            .createQueryBuilder('tpl')
            .orderBy('tpl.sortOrder', 'ASC')
            .addOrderBy('tpl.id', 'ASC');
        if (app !== undefined) {
            qb.where('tpl.app = :app', { app });
        }
        return qb.getMany();
    }

    async findOneTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate | null> {
        return this.connection.getRepository(ctx, DiyTemplate).findOne({ where: { id: id as any } });
    }

    async createTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate> {
        if (!input.code || !input.name || !input.config) {
            throw new UserInputError('code/name/config 为必填');
        }
        const app = input.app ?? null;
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const dup = await repo.findOne({ where: { app, code: input.code } });
        if (dup) {
            throw new UserInputError(`模板 code 已存在: ${input.code}（app=${app ?? 'platform'}）`);
        }
        return repo.save(
            new DiyTemplate({
                app,
                code: input.code,
                name: input.name as LocalizedText,
                description: input.description ?? null,
                thumb: input.thumb ?? null,
                images: input.images ?? null,
                config: input.config,
                calculatorKey: input.calculatorKey ?? null,
                status: input.status ?? 'draft',
                sortOrder: input.sortOrder ?? 0,
            }),
        );
    }

    async updateTemplate(ctx: RequestContext, input: DiyTemplateInput): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: input.id as any } });
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        if (input.code !== undefined) tpl.code = input.code;
        if (input.name !== undefined) tpl.name = input.name as LocalizedText;
        if (input.description !== undefined) tpl.description = input.description;
        if (input.thumb !== undefined) tpl.thumb = input.thumb;
        if (input.images !== undefined) tpl.images = input.images;
        if (input.config !== undefined) tpl.config = input.config;
        if (input.calculatorKey !== undefined) tpl.calculatorKey = input.calculatorKey;
        if (input.status !== undefined) tpl.status = input.status;
        if (input.sortOrder !== undefined) tpl.sortOrder = input.sortOrder;
        return repo.save(tpl);
    }

    async deleteTemplate(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) {
            return false;
        }
        await repo.remove(tpl);
        return true;
    }

    /** 发布：status → enabled 且 version+1（规格 §5.1） */
    async publishTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tpl = await repo.findOne({ where: { id: id as any } });
        if (!tpl) {
            throw new UserInputError('模板不存在');
        }
        tpl.status = 'enabled';
        tpl.version = (tpl.version ?? 1) + 1;
        return repo.save(tpl);
    }

    /** 租户复制平台模板改配置（同素材库哲学） */
    async copyTemplate(ctx: RequestContext, id: ID): Promise<DiyTemplate> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const source = await repo.findOne({ where: { id: id as any } });
        if (!source) {
            throw new UserInputError('模板不存在');
        }
        if (source.app !== null) {
            throw new UserInputError('仅平台模板可复制为租户模板');
        }
        const tenantApp = this.options.app ?? 'nshop';
        const dup = await repo.findOne({ where: { app: tenantApp, code: source.code } });
        if (dup) {
            throw new UserInputError(`租户模板 code 已存在: ${source.code}`);
        }
        return repo.save(
            new DiyTemplate({
                ...source,
                id: undefined,
                app: tenantApp,
            } as Partial<DiyTemplate>),
        );
    }
}
```

- [ ] **Step 2: 创建 diy-admin.resolver.ts**

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext, Transaction } from '@vendure/core';

import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCreate, DiyDelete, DiyRead, DiyUpdate } from './permissions';
import { DiyService } from './diy.service';

@Resolver()
export class DiyAdminResolver {
    constructor(private service: DiyService) {}

    /* ------------------------------ 分类 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyCategories(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
    ): Promise<DiyCategory[]> {
        return this.service.findCategories(ctx, app === undefined ? undefined : app ?? null);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyCategory(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyCategory | null> {
        return this.service.findOneCategory(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyCategory(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyCategory> {
        return this.service.createCategory(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyCategory(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyCategory> {
        return this.service.updateCategory(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyCategory(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteCategory(ctx, id);
    }

    /* ------------------------------ 素材 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyMaterials(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ): Promise<DiyMaterial[]> {
        return this.service.findMaterials(ctx, app === undefined ? undefined : app ?? null, skip ?? 0, take ?? 100);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyMaterial | null> {
        return this.service.findOneMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyMaterial(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyMaterial> {
        return this.service.createMaterial(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyMaterial(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyMaterial> {
        return this.service.updateMaterial(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async copyDiyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyMaterial> {
        return this.service.copyMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async diyMaterialsImport(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<number> {
        return this.service.importMaterials(ctx, input);
    }

    /* ------------------------------ 模板 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyTemplates(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
    ): Promise<DiyTemplate[]> {
        return this.service.findTemplates(ctx, app === undefined ? undefined : app ?? null);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate | null> {
        return this.service.findOneTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyTemplate> {
        return this.service.createTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyTemplate> {
        return this.service.updateTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async publishDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate> {
        return this.service.publishTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async copyDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate> {
        return this.service.copyTemplate(ctx, id);
    }
}
```

- [ ] **Step 3: 重写 diy-plugin.ts（挂 admin 扩展与权限）**

```ts
import { Inject, Injectable, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyAdminResolver } from './diy-admin.resolver';
import { DiyService } from './diy.service';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCreate, DiyDelete, DiyRead, DiyUpdate } from './permissions';
import { seedDiy } from './seed';
import { DiyPluginOptions } from './types';

const adminSchema = gql`
    type DiyCategory implements Node {
        id: ID!
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int!
        enabled: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterial implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        sourceMaterialId: Int
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyTemplate implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    input DiyCategoryInput {
        id: ID
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int
        enabled: Boolean
    }
    input DiyMaterialInput {
        id: ID
        app: String
        code: String
        name: JSON
        categoryId: Int
        shape: String
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int
        priceUnit: String
        currency: String
        stock: Int
        images: JSON
        enabled: Boolean
        sortOrder: Int
    }
    input DiyTemplateInput {
        id: ID
        app: String
        code: String
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String
        sortOrder: Int
    }
    extend type Query {
        diyCategories(app: String): [DiyCategory!]!
        diyCategory(id: ID!): DiyCategory
        diyMaterials(app: String, skip: Int, take: Int): [DiyMaterial!]!
        diyMaterial(id: ID!): DiyMaterial
        diyTemplates(app: String): [DiyTemplate!]!
        diyTemplate(id: ID!): DiyTemplate
    }
    extend type Mutation {
        createDiyCategory(input: DiyCategoryInput!): DiyCategory!
        updateDiyCategory(input: DiyCategoryInput!): DiyCategory!
        deleteDiyCategory(id: ID!): Boolean!
        createDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        updateDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        deleteDiyMaterial(id: ID!): Boolean!
        copyDiyMaterial(id: ID!): DiyMaterial!
        diyMaterialsImport(input: JSON!): Int!
        createDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        updateDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        deleteDiyTemplate(id: ID!): Boolean!
        publishDiyTemplate(id: ID!): DiyTemplate!
        copyDiyTemplate(id: ID!): DiyTemplate!
    }
`;

@Injectable()
export class DiySeedRunner {
    constructor(private connection: TransactionalConnection) {}
    async run(): Promise<void> {
        await seedDiy(this.connection);
    }
}

// TransactionalConnection 需在顶部 import（与上面 @nestjs/core 一起）
import { TransactionalConnection } from '@vendure/core';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DiyCategory, DiyMaterial, DiyTemplate],
    providers: [
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options },
        DiyService,
        DiySeedRunner,
    ],
    exports: [DiyService],
    adminApiExtensions: {
        schema: () => adminSchema,
        resolvers: [DiyAdminResolver],
    },
    configuration: config => {
        config.authOptions.customPermissions.push(DiyRead, DiyCreate, DiyUpdate, DiyDelete);
        return config;
    },
    compatibility: '^3.0.0',
})
export class DiyPlugin implements OnApplicationBootstrap {
    private static options: DiyPluginOptions = {};

    static init(options?: DiyPluginOptions): Type<DiyPlugin> {
        DiyPlugin.options = options ?? {};
        return DiyPlugin;
    }

    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private seedRunner: DiySeedRunner,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.seedRunner.run();
        Logger.info('DiyPlugin initialized', loggerCtx);
    }
}
```

> 实现者注意：上面示例里把 `TransactionalConnection` 的 import 放了两处只为标注来源，实际写入时**合并为顶部一条 import**：`import { Logger, PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';`，删掉中间那行单独 import。`seed.ts` 本任务先建最小版（分类种子；手串模板种子在 Task 13 补进同一文件）：

```ts
// src/seed.ts
import { TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { DiyCategory } from './entities/diy-category.entity';

const SEED_CATEGORIES: Array<{ code: string; name: Record<string, string> }> = [
    { code: 'crystal', name: { 'zh-CN': '水晶', 'en-US': 'Crystal' } },
    { code: 'agate', name: { 'zh-CN': '玛瑙玉髓', 'en-US': 'Agate & Chalcedony' } },
    { code: 'wood', name: { 'zh-CN': '木质', 'en-US': 'Wood' } },
    { code: 'amber', name: { 'zh-CN': '蜜蜡琉璃', 'en-US': 'Amber & Glass' } },
    { code: 'pearl', name: { 'zh-CN': '珍珠贝珠', 'en-US': 'Pearl & Shell' } },
    { code: 'metal', name: { 'zh-CN': '金属配件', 'en-US': 'Metal' } },
    { code: 'gemstone', name: { 'zh-CN': '天然宝石', 'en-US': 'Gemstone' } },
];

/** 幂等种子：平台分类（app=null） */
export async function seedDiy(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyCategory);
    for (const [i, c] of SEED_CATEGORIES.entries()) {
        const existing = await repo.findOne({ where: { app: null as any, code: c.code } });
        if (!existing) {
            await repo.save(
                new DiyCategory({ app: null, code: c.code, name: c.name, sortOrder: i, enabled: true }),
            );
        }
    }
    Logger.info('[DiyPlugin] platform categories seeded', loggerCtx);
}
```

（`Logger` 从 `@vendure/core` import；`seed.ts` 顶部 import 行为 `import { Logger, TransactionalConnection } from '@vendure/core';`。）

- [ ] **Step 4: 构建验证**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/diy-plugin/src
git commit -m "feat(diy-plugin): add admin-api CRUD for categories/materials/templates with import, copy and publish"
```

---

## Task 6：dev-server 冒烟验证（P1 验收）

**Files:** 无新文件（验证任务）

- [ ] **Step 1: 起本地 dev server**

```powershell
pnpm --filter dev-server dev:server
```

后台运行，观察启动日志。

Expected（关键行）：
```
[DiyPlugin] platform categories seeded
DiyPlugin initialized
```
且无 TypeORM 实体错误、无 GraphQL schema 冲突报错。

- [ ] **Step 2: 验证 admin-api SDL 生效（无需登录的 introspection）**

server 起来后（默认 3000 端口），另开终端：

```powershell
$body = '{"query":"query { __type(name: \"Mutation\") { fields { name } } }"}'
Set-Content -Path "$env:TEMP\diy-introspect.json" -Value $body -Encoding utf8 -NoNewline
curl.exe -s -X POST http://localhost:3000/admin-api -H "Content-Type: application/json" --data-binary "@$env:TEMP\diy-introspect.json"
```

Expected: 返回 JSON 中 `fields` 包含 `createDiyMaterial`、`diyMaterialsImport`、`publishDiyTemplate`。

> 注意：admin-api 查询真实数据需要登录态，P1 只验证 SDL 装配；写操作在 Task 18 e2e 全量回归。

- [ ] **Step 3: 停掉 dev server，提交**

确认无回归后停进程。

```powershell
git add -A
git commit -m "chore(diy-plugin): smoke-verify P1 wiring on dev-server"
```

（若本次无文件变更则跳过提交。）

---

## Task 7：localize.ts —— 多语言回退纯函数

**Files:**
- Create: `packages/diy-plugin/src/localize.ts`
- Test: `packages/diy-plugin/src/__tests__/localize.spec.ts`
- Modify: `packages/diy-plugin/index.ts`（追加 1 行导出）

背景：jsonb 里的 LocalizedText 只存 `zh-CN` / `en-US` 两个键（规格 §8），而 Vendure `ctx.languageCode` 是 `LanguageCode` 枚举（`zh_Hans` / `en` 等）。两个纯函数负责映射与回退，后面 shop 查询面和 BOM 名称快照都要用。

- [ ] **Step 1: 写失败测试**

`packages/diy-plugin/src/__tests__/localize.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { localizeText, resolveLocaleKey } from '../localize';

describe('resolveLocaleKey', () => {
    it('maps zh_Hans to zh-CN', () => {
        expect(resolveLocaleKey('zh_Hans')).toBe('zh-CN');
    });

    it('maps zh_Hant to zh-TW', () => {
        expect(resolveLocaleKey('zh_Hant')).toBe('zh-TW');
    });

    it('maps plain zh to zh-CN', () => {
        expect(resolveLocaleKey('zh')).toBe('zh-CN');
    });

    it('maps en to en-US', () => {
        expect(resolveLocaleKey('en')).toBe('en-US');
    });

    it('maps extended code zh_Hans_CN by prefix', () => {
        expect(resolveLocaleKey('zh_Hans_CN')).toBe('zh-CN');
    });

    it('falls back to zh-CN for unknown codes', () => {
        expect(resolveLocaleKey('xx')).toBe('zh-CN');
    });
});

describe('localizeText', () => {
    it('returns the current locale value', () => {
        const text = { 'zh-CN': '水晶', 'en-US': 'Crystal' };
        expect(localizeText(text, 'zh-CN')).toBe('水晶');
        expect(localizeText(text, 'en-US')).toBe('Crystal');
    });

    it('falls back to default locale zh-CN', () => {
        expect(localizeText({ 'zh-CN': '水晶' }, 'en-US')).toBe('水晶');
    });

    it('zh_Hant request falls through zh-TW to zh-CN', () => {
        expect(localizeText({ 'zh-CN': '水晶' }, resolveLocaleKey('zh_Hant'))).toBe('水晶');
    });

    it('falls back to first non-empty value', () => {
        expect(localizeText({ 'en-US': 'Crystal' }, 'zh-CN')).toBe('Crystal');
    });

    it('uses fallback when empty everywhere', () => {
        expect(localizeText({ 'zh-CN': '' }, 'zh-CN', '未命名')).toBe('未命名');
        expect(localizeText(null, 'zh-CN', '未命名')).toBe('未命名');
        expect(localizeText(undefined, 'zh-CN')).toBe('');
    });

    it('passes plain strings through', () => {
        expect(localizeText('水晶', 'en-US')).toBe('水晶');
        expect(localizeText('', 'zh-CN', '未命名')).toBe('未命名');
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/localize.spec.ts`
Expected: FAIL，报 `Cannot find module '../localize'`。

- [ ] **Step 3: 实现 localize.ts**

`packages/diy-plugin/src/localize.ts`：

```ts
import { LocalizedText } from './types';

/** jsonb 键的默认 locale（主市场中文，规格 §8 回退链第二级） */
export const DEFAULT_LOCALE_KEY = 'zh-CN';

/**
 * Vendure LanguageCode → jsonb 键映射（规格 §8）。
 * jsonb 只存 zh-CN / en-US；zh_Hant 映射为 zh-TW 后 localizeText 会
 * 走回退链落到 zh-CN（未来要支持繁体时 jsonb 加 zh-TW 键即可，不用改代码）。
 */
const LOCALE_KEY_MAP: Record<string, string> = {
    zh: 'zh-CN',
    zh_Hans: 'zh-CN',
    zh_Hans_CN: 'zh-CN',
    zh_Hant: 'zh-TW',
    zh_Hant_TW: 'zh-TW',
    en: 'en-US',
    en_US: 'en-US',
};

export function resolveLocaleKey(languageCode: string): string {
    if (LOCALE_KEY_MAP[languageCode]) {
        return LOCALE_KEY_MAP[languageCode];
    }
    // 未收录的扩展码按语言主码前缀匹配（如 zh_Hans_MO）
    const underscore = languageCode.indexOf('_');
    const base = underscore === -1 ? languageCode : languageCode.slice(0, underscore);
    return LOCALE_KEY_MAP[base] ?? DEFAULT_LOCALE_KEY;
}

/**
 * LocalizedText 取值（规格 §8 回退链）：
 * 当前 localeKey → DEFAULT_LOCALE_KEY → 首个非空值 → fallback。
 */
export function localizeText(
    text: LocalizedText | null | undefined,
    localeKey: string,
    fallback = '',
): string {
    if (text == null) {
        return fallback;
    }
    if (typeof text === 'string') {
        return text === '' ? fallback : text;
    }
    for (const key of [localeKey, DEFAULT_LOCALE_KEY]) {
        const value = text[key];
        if (typeof value === 'string' && value !== '') {
            return value;
        }
    }
    const first = Object.values(text).find(v => typeof v === 'string' && v !== '');
    return first ?? fallback;
}
```

- [ ] **Step 4: 运行确认通过 + 导出**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/localize.spec.ts`
Expected: PASS（2 个 describe 全绿）。

修改 `packages/diy-plugin/index.ts`，在 `export * from './src/permissions';` 之后追加：

```ts
export * from './src/localize';
```

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/diy-plugin/src packages/diy-plugin/index.ts
git commit -m "feat(diy-plugin): add localized-text fallback helpers with language-code mapping"
```

---

## Task 8：material-merge.ts + C 端素材查询（两层合并）

**Files:**
- Create: `packages/diy-plugin/src/material-merge.ts`
- Test: `packages/diy-plugin/src/__tests__/material-merge.spec.ts`
- Create: `packages/diy-plugin/src/diy-shop.service.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（providers 注册 DiyShopService）
- Modify: `packages/diy-plugin/index.ts`（追加 1 行导出）

背景：C 端看到的素材 = 平台库 ∪ 租户库，其中**租户复制行（sourceMaterialId 回链）完全接管**对应平台行；无回链的租户行按 code 覆盖同货号平台行（规格 §4.2）。合并逻辑做成纯函数单测，DB 查询与过滤放 diy-shop.service.ts（Task 18 e2e 全链路验证）。

- [ ] **Step 1: 写失败测试**

`packages/diy-plugin/src/__tests__/material-merge.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { DiyMaterial } from '../entities/diy-material.entity';
import { mergeCategories, mergeMaterials } from '../material-merge';

function mat(p: Partial<DiyMaterial> & { id: number; code: string }): DiyMaterial {
    return {
        app: null,
        sourceMaterialId: null,
        name: { 'zh-CN': p.code },
        categoryId: 1,
        shape: 'round',
        diameter: 8,
        axialLength: null,
        holeSize: null,
        attrs: null,
        render: null,
        price: 100,
        priceUnit: 'piece',
        currency: 'CNY',
        stock: 0,
        images: null,
        enabled: true,
        sortOrder: 0,
        ...p,
    } as DiyMaterial;
}

describe('mergeMaterials', () => {
    const platform = [mat({ id: 1, code: 'A-AGS-08-N' }), mat({ id: 2, code: 'B-CRY-10-P' })];

    it('keeps all platform rows when tenant is empty', () => {
        expect(mergeMaterials(platform, [])).toHaveLength(2);
    });

    it('tenant copy shadows platform row by sourceMaterialId even if code differs', () => {
        const tenant = [mat({ id: 11, code: 'A-AGS-08-N2', sourceMaterialId: 1, app: 'nshop' })];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([2, 11]);
    });

    it('plain tenant row shadows platform row with the same code', () => {
        const tenant = [mat({ id: 12, code: 'B-CRY-10-P', app: 'nshop' })];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([1, 12]);
    });

    it('tenant-only rows are appended after kept platform rows', () => {
        const tenant = [
            mat({ id: 13, code: 'C-WOD-12-X', app: 'nshop' }),
            mat({ id: 11, code: 'A-AGS-08-N2', sourceMaterialId: 1, app: 'nshop' }),
        ];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([2, 13, 11]);
    });
});

describe('mergeCategories', () => {
    it('is a pure union without shadowing', () => {
        const platform = [{ id: 1, code: 'crystal' }, { id: 2, code: 'agate' }] as any[];
        const tenant = [{ id: 9, code: 'wood', app: 'nshop' }] as any[];
        const merged = mergeCategories(platform as any, tenant as any);
        expect(merged).toHaveLength(3);
        expect(merged.map(c => c.id)).toEqual([1, 2, 9]);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/material-merge.spec.ts`
Expected: FAIL，报 `Cannot find module '../material-merge'`。

- [ ] **Step 3: 实现 material-merge.ts**

`packages/diy-plugin/src/material-merge.ts`：

```ts
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';

/**
 * 两层素材合并（规格 §4.2）：
 * - 起点 = 平台库全集；
 * - 租户复制行按 sourceMaterialId 精确覆盖同源平台行（完全接管价/库存）；
 * - 无回链的租户行按 code 覆盖同货号平台行；
 * - 结果 = 未被覆盖的平台行 + 全部租户行（顺序：平台在前、租户在后）。
 */
export function mergeMaterials(platform: DiyMaterial[], tenant: DiyMaterial[]): DiyMaterial[] {
    const shadowedIds = new Set<number>();
    const shadowedCodes = new Set<string>();
    for (const t of tenant) {
        if (t.sourceMaterialId != null) {
            shadowedIds.add(t.sourceMaterialId);
        } else {
            shadowedCodes.add(t.code);
        }
    }
    const keptPlatform = platform.filter(p => !shadowedIds.has(p.id) && !shadowedCodes.has(p.code));
    return [...keptPlatform, ...tenant];
}

/** 两层分类合并（规格 §4.1）：纯并集、无覆盖；排序责任在查询侧（ORDER BY sortOrder） */
export function mergeCategories(platform: DiyCategory[], tenant: DiyCategory[]): DiyCategory[] {
    return [...platform, ...tenant];
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/material-merge.spec.ts`
Expected: PASS（5 个用例全绿）。

- [ ] **Step 5: 创建 diy-shop.service.ts（C 端素材查询）**

`packages/diy-plugin/src/diy-shop.service.ts`：

```ts
import { Inject, Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';

import { PLUGIN_INIT_OPTIONS } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { mergeMaterials } from './material-merge';
import { DiyMaterialFilter, DiyPluginOptions } from './types';

export interface DiyMaterialList {
    items: DiyMaterial[];
    total: number;
}

/**
 * C 端查询面（规格 §7 shop 部分）。
 * app 固定取插件 init 传入的租户端，不暴露给 C 端调用方。
 */
@Injectable()
export class DiyShopService {
    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private connection: TransactionalConnection,
    ) {}

    private get app(): string {
        return this.options.app ?? 'nshop';
    }

    /** C 端素材列表：两层合并去重后内存过滤 + 分页（素材量级千内，内存过滤足够） */
    async findShopMaterials(ctx: RequestContext, filter: DiyMaterialFilter = {}): Promise<DiyMaterialList> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: IsNull() }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        let items = mergeMaterials(platform, tenant);

        if (filter.categoryCode) {
            const allowed = (await this.categoryIdsByCode(ctx)).get(filter.categoryCode) ?? new Set<number>();
            items = items.filter(m => allowed.has(m.categoryId));
        }
        if (filter.categoryId != null) {
            items = items.filter(m => m.categoryId === filter.categoryId);
        }
        if (filter.shapes?.length) {
            items = items.filter(m => filter.shapes!.includes(m.shape));
        }
        if (filter.diameterMin != null || filter.diameterMax != null) {
            items = items.filter(
                m =>
                    m.diameter != null &&
                    (filter.diameterMin == null || m.diameter >= filter.diameterMin!) &&
                    (filter.diameterMax == null || m.diameter <= filter.diameterMax!),
            );
        }
        const kw = filter.keyword?.trim().toLowerCase();
        if (kw) {
            items = items.filter(m => this.matchKeyword(m, kw));
        }
        if (filter.onlyEnabled) {
            items = items.filter(m => m.enabled);
        }

        const total = items.length;
        const skip = filter.skip ?? 0;
        const take = filter.take ?? 50;
        return { items: items.slice(skip, skip + take), total };
    }

    private matchKeyword(m: DiyMaterial, kw: string): boolean {
        if (m.code.toLowerCase().includes(kw)) {
            return true;
        }
        const values = typeof m.name === 'string' ? [m.name] : Object.values(m.name ?? {});
        return values.some(v => typeof v === 'string' && v.toLowerCase().includes(kw));
    }

    /** categoryCode → 该码下两层分类 id 集合（分类并集、无覆盖） */
    private async categoryIdsByCode(ctx: RequestContext): Promise<Map<string, Set<number>>> {
        const repo = this.connection.getRepository(ctx, DiyCategory);
        const cats = await repo.find();
        const map = new Map<string, Set<number>>();
        for (const c of cats) {
            if (!c.code) {
                continue;
            }
            const set = map.get(c.code) ?? new Set<number>();
            set.add(c.id);
            map.set(c.code, set);
        }
        return map;
    }
}
```

- [ ] **Step 6: 注册 provider + 导出**

修改 `packages/diy-plugin/src/diy-plugin.ts`：

import 区追加：

```ts
import { DiyShopService } from './diy-shop.service';
```

providers 数组中 `DiyService,`（或 `DiyServiceStub` 若尚在）之后追加一行：

```ts
        DiyShopService,
```

修改 `packages/diy-plugin/index.ts`，在 `export * from './src/localize';` 之后追加：

```ts
export * from './src/material-merge';
```

- [ ] **Step 7: 构建验证 + 提交**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

```powershell
git add packages/diy-plugin/src packages/diy-plugin/index.ts
git commit -m "feat(diy-plugin): add two-layer material merge and shop material query service"
```

---

## Task 9：template-config.ts + C 端模板查询 + shopApiExtensions

**Files:**
- Create: `packages/diy-plugin/src/template-config.ts`
- Test: `packages/diy-plugin/src/__tests__/template-config.spec.ts`
- Modify: `packages/diy-plugin/src/diy-shop.service.ts`（追加模板查询两方法）
- Create: `packages/diy-plugin/src/diy-shop.resolver.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（shopApiExtensions + resolver 注册）
- Modify: `packages/diy-plugin/index.ts`（追加 1 行导出）

背景：模板 config 存 jsonb（`DiyTemplate.config`），坏 JSON / 缺关键字段必须返回 null 逐级回退（规格 §8 解析 SSR 友好）。C 端模板无复制回链列，同 code 以租户行为准。

- [ ] **Step 1: 写失败测试**

`packages/diy-plugin/src/__tests__/template-config.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { parseTemplateConfig } from '../template-config';

const validConfig = {
    slots: [
        {
            key: 'main',
            name: { 'zh-CN': '主珠', 'en-US': 'Main beads' },
            role: 'main',
            required: true,
            quantityMode: 'calculated',
            filter: { categoryCodes: ['crystal'], shapes: ['round'], diameterRange: [6, 12] },
        },
        {
            key: 'spacer',
            name: { 'zh-CN': '隔片' },
            role: 'spacer',
            required: false,
            quantityMode: 'user',
            quantityRange: [0, 34],
            defaultEvery: 2,
        },
    ],
    params: [{ key: 'wristSize', type: 'number', unit: 'mm', min: 120, max: 200, default: 155 }],
    constraints: [],
    presentation: { renderer: 'bracelet', blocks: ['gallery', 'price'] },
};

describe('parseTemplateConfig', () => {
    it('returns the config for a valid input', () => {
        const parsed = parseTemplateConfig(validConfig);
        expect(parsed).not.toBeNull();
        expect(parsed!.slots).toHaveLength(2);
        expect(parsed!.presentation.renderer).toBe('bracelet');
        expect(parsed!.presentation.blocks).toEqual(['gallery', 'price']);
    });

    it('defaults params/constraints/blocks when missing', () => {
        const parsed = parseTemplateConfig({
            slots: validConfig.slots,
            presentation: { renderer: 'bracelet' },
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.params).toEqual([]);
        expect(parsed!.constraints).toEqual([]);
        expect(parsed!.presentation.blocks).toEqual([]);
    });

    it('returns null for null/string/array input', () => {
        expect(parseTemplateConfig(null)).toBeNull();
        expect(parseTemplateConfig('oops')).toBeNull();
        expect(parseTemplateConfig([validConfig])).toBeNull();
        expect(parseTemplateConfig(undefined)).toBeNull();
    });

    it('returns null when slots missing or empty', () => {
        expect(parseTemplateConfig({ ...validConfig, slots: [] })).toBeNull();
        expect(parseTemplateConfig({ presentation: validConfig.presentation })).toBeNull();
    });

    it('returns null when a slot misses key fields', () => {
        const bad1 = { ...validConfig, slots: [{ ...validConfig.slots[0], key: '' }] };
        expect(parseTemplateConfig(bad1)).toBeNull();
        const bad2 = { ...validConfig, slots: [{ ...validConfig.slots[0], role: 'nope' }] };
        expect(parseTemplateConfig(bad2)).toBeNull();
        const bad3 = { ...validConfig, slots: [{ ...validConfig.slots[0], quantityMode: 'auto' }] };
        expect(parseTemplateConfig(bad3)).toBeNull();
        const bad4 = { ...validConfig, slots: [{ ...validConfig.slots[0], required: 'yes' }] };
        expect(parseTemplateConfig(bad4)).toBeNull();
    });

    it('returns null when presentation missing or renderer invalid', () => {
        const { presentation, ...noPresentation } = validConfig;
        expect(parseTemplateConfig(noPresentation)).toBeNull();
        expect(parseTemplateConfig({ ...validConfig, presentation: {} })).toBeNull();
        expect(parseTemplateConfig({ ...validConfig, presentation: { renderer: '' } })).toBeNull();
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/template-config.spec.ts`
Expected: FAIL，报 `Cannot find module '../template-config'`。

- [ ] **Step 3: 实现 template-config.ts**

`packages/diy-plugin/src/template-config.ts`：

```ts
import { DiyTemplateConfig, TemplateConstraint, TemplateParam, TemplateSlot } from './types';

const SLOT_ROLES = ['main', 'secondary', 'spacer', 'focal', 'decor'];
const QUANTITY_MODES = ['calculated', 'fixed', 'user'];

/**
 * 解析模板 config jsonb（规格 §5.2/§8）：
 * - 坏结构 / 缺关键字段（slots 非空数组且每个 slot 有 key/role/quantityMode/required、
 *   presentation.renderer 非空字符串）→ null，调用方逐级回退；
 * - params / constraints / presentation.blocks 缺省宽松补 []。
 */
export function parseTemplateConfig(input: unknown): DiyTemplateConfig | null {
    if (input == null || typeof input !== 'object' || Array.isArray(input)) {
        return null;
    }
    const raw = input as Record<string, unknown>;

    if (!Array.isArray(raw.slots) || raw.slots.length === 0) {
        return null;
    }
    const slots: TemplateSlot[] = [];
    for (const item of raw.slots) {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) {
            return null;
        }
        const s = item as Record<string, unknown>;
        if (typeof s.key !== 'string' || s.key === '') return null;
        if (typeof s.role !== 'string' || !SLOT_ROLES.includes(s.role)) return null;
        if (typeof s.quantityMode !== 'string' || !QUANTITY_MODES.includes(s.quantityMode)) return null;
        if (typeof s.required !== 'boolean') return null;
        slots.push(s as unknown as TemplateSlot);
    }

    if (raw.presentation == null || typeof raw.presentation !== 'object' || Array.isArray(raw.presentation)) {
        return null;
    }
    const renderer = (raw.presentation as Record<string, unknown>).renderer;
    if (typeof renderer !== 'string' || renderer === '') {
        return null;
    }
    const blocks = (raw.presentation as Record<string, unknown>).blocks;
    const presentation = {
        renderer,
        blocks: Array.isArray(blocks) ? (blocks as string[]) : [],
    };

    const params = Array.isArray(raw.params) ? (raw.params as TemplateParam[]) : [];
    const constraints = Array.isArray(raw.constraints) ? (raw.constraints as TemplateConstraint[]) : [];

    return { slots, params, constraints, presentation };
}
```

- [ ] **Step 4: 运行确认通过 + 导出**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/template-config.spec.ts`
Expected: PASS（6 个用例全绿）。

修改 `packages/diy-plugin/index.ts`，在 `export * from './src/material-merge';` 之后追加：

```ts
export * from './src/template-config';
```

- [ ] **Step 5: diy-shop.service.ts 追加模板查询**

import 区追加：

```ts
import { DiyTemplate } from './entities/diy-template.entity';
```

`DiyShopService` 类内（`categoryIdsByCode` 方法之后）追加：

```ts
    /** C 端模板列表：两层 enabled 模板，同 code 租户覆盖平台（模板无复制回链列） */
    async findShopTemplates(ctx: RequestContext): Promise<DiyTemplate[]> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const [platform, tenant] = await Promise.all([
            repo.find({ where: { app: IsNull(), status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
            repo.find({ where: { app: this.app, status: 'enabled' }, order: { sortOrder: 'ASC', id: 'ASC' } }),
        ]);
        const tenantCodes = new Set(tenant.map(t => t.code));
        return [...platform.filter(p => !tenantCodes.has(p.code)), ...tenant];
    }

    /** C 端单模板：租户优先、其次平台，仅 enabled；不存在/未启用返回 null */
    async findShopTemplateByCode(ctx: RequestContext, code: string): Promise<DiyTemplate | null> {
        const repo = this.connection.getRepository(ctx, DiyTemplate);
        const tenant = await repo.findOne({ where: { app: this.app, code, status: 'enabled' } });
        if (tenant) {
            return tenant;
        }
        return repo.findOne({ where: { app: IsNull(), code, status: 'enabled' } });
    }
```

- [ ] **Step 6: 创建 diy-shop.resolver.ts**

`packages/diy-plugin/src/diy-shop.resolver.ts`：

```ts
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { DiyMaterialList, DiyShopService } from './diy-shop.service';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';

@Resolver()
export class DiyShopResolver {
    constructor(private service: DiyShopService) {}

    @Query()
    @Allow(Permission.Public)
    async diyMaterials(
        @Ctx() ctx: RequestContext,
        @Args('filter', { nullable: true }) filter?: any,
    ): Promise<DiyMaterialList> {
        return this.service.findShopMaterials(ctx, filter ?? {});
    }

    @Query()
    @Allow(Permission.Public)
    async diyShopTemplates(@Ctx() ctx: RequestContext): Promise<DiyTemplate[]> {
        return this.service.findShopTemplates(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async diyShopTemplate(@Ctx() ctx: RequestContext, @Args('code') code: string): Promise<DiyTemplate | null> {
        return this.service.findShopTemplateByCode(ctx, code);
    }
}
```

（C 端全部走 `Permission.Public`；素材/模板内容本身无敏感字段，价格与库存本就是 C 端必需。）

- [ ] **Step 7: diy-plugin.ts 挂 shopApiExtensions**

import 区追加：

```ts
import { DiyShopResolver } from './diy-shop.resolver';
```

`adminSchema` 常量之后新增 shop schema 常量（shop 是独立 schema，实体类型需重新声明，不能复用 admin 的）：

```ts
const shopSchema = gql`
    type DiyMaterial {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterialList {
        items: [DiyMaterial!]!
        total: Int!
    }
    type DiyTemplate {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    extend type Query {
        diyMaterials(filter: JSON): DiyMaterialList!
        diyShopTemplates: [DiyTemplate!]!
        diyShopTemplate(code: String!): DiyTemplate
    }
`;
```

`@VendurePlugin` 装饰器：`adminApiExtensions` 之后新增一行 `shopApiExtensions`，providers 数组追加 `DiyShopResolver`。改后关键字段形如：

```ts
    adminApiExtensions: { schema: adminSchema },
    shopApiExtensions: { schema: shopSchema },
    providers: [
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options },
        DiyService,
        DiyShopService,
        DiySeedRunner,
        DiyShopResolver,
    ],
```

- [ ] **Step 8: 构建验证**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

- [ ] **Step 9: shop-api 冒烟（SDL 装配验证）**

```powershell
pnpm --filter dev-server dev:server
```

server 起来后另开终端：

```powershell
$body = '{"query":"query { __type(name: \"Query\") { fields { name } } }"}'
Set-Content -Path "$env:TEMP\diy-shop-introspect.json" -Value $body -Encoding utf8 -NoNewline
curl.exe -s -X POST http://localhost:3000/shop-api -H "Content-Type: application/json" --data-binary "@$env:TEMP\diy-shop-introspect.json"
```

Expected: 返回 JSON 中 `fields` 包含 `diyMaterials`、`diyShopTemplates`、`diyShopTemplate`，且启动日志无 schema 冲突报错。

真实数据查询（合并/过滤正确性）在 Task 18 e2e 全量回归；本步只验证 SDL 装配。

- [ ] **Step 10: 停 server + 提交**

确认无回归后停进程。

```powershell
git add packages/diy-plugin/src packages/diy-plugin/index.ts
git commit -m "feat(diy-plugin): add shop-api query surface for merged materials and enabled templates"
```

（P2 验收：localize / material-merge / template-config 三套单测全过。）

---

## Task 10：@diy/calc 手串算量核心（bracelet.ts，TDD）

**Files:**
- Create: `packages/diy-calc/src/bracelet.ts`
- Test: `packages/diy-calc/src/__tests__/bracelet.spec.ts`

背景：实现 bead-diy 设计文档 §7.1/§7.2 的算量与收敛（含 π·d 内径修正项）。§7.4 经验校准表 6 组数值已人工验算，直接写成断言；公式任何改动必须先过这张表。类型 `FitFeedback`/`CalcResult` 已在 Task 1 `types.ts` 定义。

- [ ] **Step 1: 写失败测试**

`packages/diy-calc/src/__tests__/bracelet.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { computeBraceletGeometry, feedbackOf, innerCircOf, MAX_COUNT, MIN_COUNT, pickBestCount } from '../bracelet';

// §7.4 经验校准表（ease=10，gap=0.5）：[手围 W, 直径 d, 轴长 t, N0, 收敛 N, 回算 innerCirc]
const CALIBRATION: Array<[number, number, number, number, number, number]> = [
    [150, 8, 8, 21, 21, 154.0],
    [160, 10, 10, 19, 19, 169.0],
    [170, 12, 12, 17, 17, 176.0],
    [155, 6, 6, 28, 28, 163.5],
    [180, 14, 14, 16, 16, 189.5],
    [145, 4, 4, 37, 36, 149.6],
];

describe('innerCircOf 反向验证（§7.4）', () => {
    it.each(CALIBRATION)('W=%d d=%d → N=%d 时 innerCirc≈%f', (_w, d, _t, _n0, n, inner) => {
        expect(innerCircOf(n, d + 0.5, d)).toBeCloseTo(inner, 1);
    });

    it('8mm×21 颗 → 适合 150mm 手腕（防止公式写反）', () => {
        expect(innerCircOf(21, 8.5, 8)).toBeCloseTo(154.0, 1);
    });
});

describe('feedbackOf 阈值（§7.1 ⑦）', () => {
    it('五级分类边界正确', () => {
        expect(feedbackOf(-1)).toBe('too-tight');
        expect(feedbackOf(0)).toBe('snug');
        expect(feedbackOf(3.9)).toBe('snug');
        expect(feedbackOf(4)).toBe('ok');
        expect(feedbackOf(11.9)).toBe('ok');
        expect(feedbackOf(12)).toBe('loose');
        expect(feedbackOf(24.9)).toBe('loose');
        expect(feedbackOf(25)).toBe('too-loose');
    });
});

describe('pickBestCount 收敛（§7.2）', () => {
    it('N0 已在推荐区间则不动', () => {
        expect(pickBestCount(150, 8, 8.5, 21)).toBe(21);
    });

    it('145/4 行：N0=37 收敛到 36', () => {
        expect(pickBestCount(145, 4, 4.5, 37)).toBe(36);
    });

    it('N0 兜不住手腕时向上加（170 手围配 8mm 珠但 N0 报小）', () => {
        expect(pickBestCount(170, 8, 8.5, 15)).toBe(24);
    });

    it('触及 MIN/MAX 兜底不越界', () => {
        expect(pickBestCount(60, 8, 8.5, MIN_COUNT)).toBeGreaterThanOrEqual(MIN_COUNT);
        expect(pickBestCount(400, 8, 8.5, MAX_COUNT)).toBeLessThanOrEqual(MAX_COUNT);
    });
});

describe('computeBraceletGeometry（§7.1 主算）', () => {
    it.each(CALIBRATION)('W=%d d=%d t=%d → N0=%d N=%d', (w, d, t, n0, n) => {
        const geo = computeBraceletGeometry({ wristSize: w, diameter: d, axialLength: t, gap: 0.5, ease: 10 });
        expect(geo.countInitial).toBe(n0);
        expect(geo.count).toBe(n);
        expect(geo.feedback).toBe('ok');
    });

    it('150/8mm：clearance≈+4.0，adjustHint 给出 ±1 颗建议', () => {
        const geo = computeBraceletGeometry({ wristSize: 150, diameter: 8, axialLength: 8, gap: 0.5, ease: 10 });
        expect(geo.clearance).toBeCloseTo(4.0, 1);
        expect(geo.innerCircumference).toBeCloseTo(154.0, 1);
        expect(geo.centerCircumference).toBeCloseTo(179.17, 1); // π·8.5/sin(π/21)
        expect(geo.adjustHint).toEqual([
            { delta: 1, feedback: 'loose' }, // innerCirc(22)=162.5 → +12.5
            { delta: -1, feedback: 'too-tight' }, // innerCirc(20)=145.6 → −4.4
        ]);
    });

    it('145/4mm：countInitial=37 与 count=36 分开暴露（公式与收敛分别验证）', () => {
        const geo = computeBraceletGeometry({ wristSize: 145, diameter: 4, axialLength: 4, gap: 0.5, ease: 10 });
        expect(geo.countInitial).toBe(37);
        expect(geo.count).toBe(36);
        expect(geo.innerCircumference).toBeCloseTo(149.6, 1);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/bracelet.spec.ts`
Expected: FAIL，`Cannot find module '../bracelet'`。

- [ ] **Step 3: 实现 bracelet.ts**

`packages/diy-calc/src/bracelet.ts`：

```ts
import { FitFeedback } from './types';

/** 颗数上下限（§7.2）：超出说明参数组合不合理 */
export const MIN_COUNT = 8;
export const MAX_COUNT = 120;

/** fit → 体感松量 ease（mm）：贴手 4 / 舒适 10 / 宽松 20（§7.1） */
export function easeOf(fit: string): number {
    switch (fit) {
        case 'snug':
            return 4;
        case 'loose':
            return 20;
        default:
            return 10;
    }
}

/** 单颗节距对应中心角（弦长近似，rad）：θ = 2·asin(pitch / (2R)) */
export function angleOf(pitch: number, R: number): number {
    return 2 * Math.asin(pitch / (2 * R));
}

/** N 颗节距 pitch 的珠连成正 N 边形后的内孔周长（mm）：π·pitch/sin(π/N) − π·d */
export function innerCircOf(n: number, pitch: number, d: number): number {
    return (Math.PI * pitch) / Math.sin(Math.PI / n) - Math.PI * d;
}

/** 相对手围余量的反馈分级（§7.1 ⑦） */
export function feedbackOf(clearance: number): FitFeedback {
    if (clearance < 0) return 'too-tight';
    if (clearance < 4) return 'snug';
    if (clearance < 12) return 'ok';
    if (clearance < 25) return 'loose';
    return 'too-loose';
}

export interface BraceletGeometry {
    count: number;
    countInitial: number;
    centerCircumference: number;
    innerCircumference: number;
    feedback: FitFeedback;
    clearance: number;
    adjustHint: { delta: number; feedback: FitFeedback }[];
}

/**
 * 手串几何主算（§7.1 + §7.2）：
 * - pitch = 轴长 + gap（算量用轴向长度，不是直径）
 * - L_center = W + ease + π·d（内径修正项——漏掉它珠子会全部偏少，手串戴不上）
 * - countInitial = floor(2π/θ)；count = pickBestCount 收敛值
 * - centerCircumference = 收敛后实际中心线周长 π·pitch/sin(π/count)
 */
export function computeBraceletGeometry(input: {
    wristSize: number;
    diameter: number;
    axialLength: number;
    gap: number;
    ease: number;
}): BraceletGeometry {
    const { wristSize: W, diameter: d, axialLength: t, gap, ease } = input;
    const pitch = t + gap;
    const LCenter = W + ease + Math.PI * d;
    const R = LCenter / (2 * Math.PI);
    const theta = angleOf(pitch, R);
    const countInitial = Math.floor((2 * Math.PI) / theta);
    const count = pickBestCount(W, d, pitch, countInitial);
    const centerCircumference = (Math.PI * pitch) / Math.sin(Math.PI / count);
    const innerCircumference = innerCircOf(count, pitch, d);
    const clearance = innerCircumference - W;
    const adjustHint: BraceletGeometry['adjustHint'] = [];
    if (count + 1 <= MAX_COUNT) {
        adjustHint.push({ delta: 1, feedback: feedbackOf(innerCircOf(count + 1, pitch, d) - W) });
    }
    if (count - 1 >= MIN_COUNT) {
        adjustHint.push({ delta: -1, feedback: feedbackOf(innerCircOf(count - 1, pitch, d) - W) });
    }
    return {
        count,
        countInitial,
        centerCircumference,
        innerCircumference,
        feedback: feedbackOf(clearance),
        clearance,
        adjustHint,
    };
}

/** §7.2 收敛：innerCirc(n) − W 落入 [4, 25)；兜不住手腕先加、过松则减 */
export function pickBestCount(W: number, d: number, pitch: number, n0: number): number {
    const innerOf = (n: number) => innerCircOf(n, pitch, d);
    let n = Math.min(Math.max(n0, MIN_COUNT), MAX_COUNT);
    while (n < MAX_COUNT && innerOf(n) < W + 4) n++;
    while (n > MIN_COUNT && innerOf(n - 1) >= W + 4) n--;
    return n;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/bracelet.spec.ts`
Expected: PASS（4 个 describe 全绿，含 6 组校准表断言）。

- [ ] **Step 5: 提交**

```powershell
git add packages/diy-calc/src
git commit -m "feat(diy-calc): add bracelet bead-count core with calibration-table assertions"
```

---

## Task 11：braceletCalculator 完整实现（替换 Task 2 顶位）

**Files:**
- Modify: `packages/diy-calc/src/bracelet-calculator.ts`（整文件替换）

背景：Task 2 的 braceletCalculator 是 sum 语义顶位。本任务换成完整手串计算器：主珠/焦点珠/隔片三种槽位、§7.3 二次收敛（≤3 轮）、§7.6 配线（线径按最小孔径取 1.0/0.8/0.6 档、长度 = 中心线周长 + 160mm 打结留量）。registry（Task 9 已注册 key `bracelet`）无需改动。

- [ ] **Step 1: 写失败测试**

`packages/diy-calc/src/__tests__/bracelet-calculator.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { braceletCalculator } from '../bracelet-calculator';
import { CalcMaterial, SlotSelection } from '../types';

const main: CalcMaterial = {
    id: '1', code: 'A-AGS-08-N', name: '玛瑙 8mm', shape: 'round',
    diameter: 8, axialLength: 8, holeSize: 1, price: 150,
};
const focal: CalcMaterial = {
    id: '2', code: 'A-AGS-14-F', name: '玛瑙焦点 14mm', shape: 'drum',
    diameter: 14, axialLength: 14, holeSize: 1.2, price: 600,
};
const spacer: CalcMaterial = {
    id: '3', code: 'M-SSP-06-SV', name: '银隔片 6mm', shape: 'spacer',
    diameter: 6, axialLength: 2, holeSize: 1.5, price: 30,
};

const params = { wristSize: 150, fit: 'comfortable', gap: 0.5 };

function sel(key: string, role: SlotSelection['role'], materialId?: string, extra?: Partial<SlotSelection>): SlotSelection {
    return { key, role, materialId, ...extra };
}

describe('braceletCalculator', () => {
    it('主珠缺失时返回空 BOM（纯函数不抛错）', () => {
        const out = braceletCalculator({ params, slots: [sel('focal', 'focal', '2')], materials: [main, focal] });
        expect(out.calc).toBeNull();
        expect(out.bom.items).toHaveLength(0);
        expect(out.bom.cord).toBeNull();
    });

    it('纯主珠：150/8mm → 21 颗，BOM/配线/几何自洽', () => {
        const out = braceletCalculator({ params, slots: [sel('main', 'main', '1')], materials: [main] });
        expect(out.calc!.count).toBe(21);
        expect(out.calc!.countInitial).toBe(21);
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0].qty).toBe(21);
        expect(out.bom.items[0].subtotal).toBe(21 * 150);
        expect(out.bom.totalCount).toBe(21);
        expect(out.bom.totalAmount).toBe(21 * 150);
        expect(out.calc!.cordDiameter).toBe(0.8); // min(孔径1−0.2, 1.0)
        expect(out.calc!.cordLength).toBeCloseTo(out.calc!.centerCircumference + 160, 6);
        expect(out.bom.cord!.diameter).toBe(0.8);
        expect(out.bom.geometry!.feedback).toBe('ok');
        expect(out.bom.geometry!.clearance).toBeCloseTo(out.calc!.clearance, 6);
    });

    it('带隔片 every=2：隔片数 = floor(总数/3)，BOM 聚合两行', () => {
        const out = braceletCalculator({
            params,
            slots: [sel('main', 'main', '1'), sel('spacer', 'spacer', '3', { every: 2 })],
            materials: [main, spacer],
        });
        const mainRow = out.bom.items.find(i => i.materialId === '1');
        const spacerRow = out.bom.items.find(i => i.materialId === '3');
        expect(mainRow).toBeDefined();
        expect(spacerRow).toBeDefined();
        expect(out.bom.items).toHaveLength(2);
        expect(spacerRow!.qty).toBe(Math.floor(out.calc!.count / 3));
        expect(out.calc!.count).toBe(mainRow!.qty + spacerRow!.qty);
        expect(out.bom.totalAmount).toBe(mainRow!.subtotal + spacerRow!.subtotal);
        expect(out.calc!.cordDiameter).toBe(0.8); // 最小孔径取 main 的 1mm
    });

    it('焦点珠模式：焦点珠恰 1 颗且计入 BOM', () => {
        const out = braceletCalculator({
            params,
            slots: [sel('main', 'main', '1'), sel('focal', 'focal', '2'), sel('spacer', 'spacer', '3', { every: 2 })],
            materials: [main, focal, spacer],
        });
        const focalRow = out.bom.items.find(i => i.materialId === '2');
        expect(focalRow).toBeDefined();
        expect(focalRow!.qty).toBe(1);
        expect(out.calc!.count).toBeGreaterThanOrEqual(2);
    });

    it('默认参数：无 params 时按 155/comfortable/0.5 → 22 颗', () => {
        const out = braceletCalculator({ params: {}, slots: [sel('main', 'main', '1')], materials: [main] });
        expect(out.calc!.count).toBe(22);
    });

    it('宽松 fit（ease=20）：150/8mm → 21 颗', () => {
        const out = braceletCalculator({
            params: { wristSize: 150, fit: 'loose', gap: 0.5 },
            slots: [sel('main', 'main', '1')],
            materials: [main],
        });
        expect(out.calc!.count).toBe(21);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/bracelet-calculator.spec.ts`
Expected: FAIL（顶位实现返回 `calc: null` / 空qty，断言不匹配）。

- [ ] **Step 3: 整文件替换 bracelet-calculator.ts**

`packages/diy-calc/src/bracelet-calculator.ts`：

```ts
import { angleOf, computeBraceletGeometry, easeOf, feedbackOf, innerCircOf } from './bracelet';
import { CalcBom, CalcBomItem, CalcMaterial, Calculator, CalculatorInput, CalcResult, SlotSelection } from './types';

/** 弹力线打结收尾留量（§7.6） */
const CORD_TAIL = 160;
/** 线径可选档（mm），按最小孔径从大到小取 */
const CORD_DIAMETERS = [1.0, 0.8, 0.6];

function byRole(slots: SlotSelection[], role: SlotSelection['role']): SlotSelection | undefined {
    return slots.find(s => s.role === role);
}

function specOf(m: CalcMaterial): string {
    return m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape;
}

function bomItem(m: CalcMaterial, qty: number): CalcBomItem {
    return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        spec: specOf(m),
        unitPrice: m.price,
        qty,
        subtotal: qty * m.price,
    };
}

function aggregate(items: CalcBomItem[]): CalcBomItem[] {
    const map = new Map<string, CalcBomItem>();
    for (const item of items) {
        const existing = map.get(item.materialId);
        if (existing) {
            existing.qty += item.qty;
            existing.subtotal += item.subtotal;
        } else {
            map.set(item.materialId, { ...item });
        }
    }
    return [...map.values()];
}

function pickCordDiameter(holeMin: number | null): number {
    if (holeMin == null) {
        return 1.0;
    }
    const max = Math.min(holeMin - 0.2, 1.0);
    return CORD_DIAMETERS.find(d => d <= max) ?? 0.6;
}

/**
 * 手串计算器（key: 'bracelet'）。
 * - 主珠缺失 → 空 BOM（纯函数不抛错，C 端演示热路径安全）
 * - 焦点珠/隔片按 §7.3 二次收敛：先把 k·(ts+gap) 与焦点珠角从可用周长扣掉再算配珠，≤3 轮
 * - 混合组成的几何展示值用颗数加权平均 pitch/d 套正多边形公式（近似；BOM 与计价不受影响）
 */
export const braceletCalculator: Calculator = (input: CalculatorInput) => {
    const mainSel = byRole(input.slots, 'main');
    const byId = new Map(input.materials.map(m => [m.id, m]));
    const main = mainSel?.materialId ? byId.get(mainSel.materialId) : undefined;
    if (!main) {
        return { calc: null, bom: { items: [], totalCount: 0, totalAmount: 0, cord: null, geometry: null } };
    }

    const W = Number(input.params.wristSize ?? 155);
    const fit = String(input.params.fit ?? 'comfortable');
    const gap = Number(input.params.gap ?? 0.5);
    const ease = easeOf(fit);

    const focalSel = byRole(input.slots, 'focal');
    const focal = focalSel?.materialId ? byId.get(focalSel.materialId) : undefined;
    const spacerSel = byRole(input.slots, 'spacer');
    const spacer = spacerSel?.materialId ? byId.get(spacerSel.materialId) : undefined;
    const every = Math.max(1, Math.floor(spacerSel?.every ?? 2));

    const dMain = main.diameter ?? main.axialLength ?? 8;
    const tMain = main.axialLength ?? dMain;
    const geo = computeBraceletGeometry({ wristSize: W, diameter: dMain, axialLength: tMain, gap, ease });

    // §7.3 二次收敛（≤3 轮）
    const LCenter = W + ease + Math.PI * dMain;
    const RTarget = LCenter / (2 * Math.PI);
    const tFocal = focal ? focal.axialLength ?? focal.diameter ?? 12 : 0;
    const tSpacer = spacer ? spacer.axialLength ?? 2 : 0;
    let total = geo.count;
    let mainQty = total;
    let spacerQty = 0;
    for (let round = 0; round < 3; round++) {
        spacerQty = spacer ? Math.floor(total / (every + 1)) : 0;
        let used = spacerQty * angleOf(tSpacer + gap, RTarget);
        if (focal) {
            used += angleOf(tFocal + gap, RTarget);
        }
        const thetaMain = angleOf(tMain + gap, RTarget);
        mainQty = Math.max(0, Math.floor((2 * Math.PI - used) / thetaMain));
        const next = mainQty + (focal ? 1 : 0) + spacerQty;
        if (next === total) {
            break;
        }
        total = next;
    }

    // 混合组成的几何展示值（加权平均近似）
    const dFocal = focal ? focal.diameter ?? 12 : 0;
    const dSpacer = spacer ? spacer.diameter ?? 6 : 0;
    const pitchAvg =
        total > 0
            ? (mainQty * (tMain + gap) + (focal ? tFocal + gap : 0) + spacerQty * (tSpacer + gap)) / total
            : tMain + gap;
    const dAvg =
        total > 0
            ? (mainQty * dMain + (focal ? dFocal : 0) + spacerQty * dSpacer) / total
            : dMain;
    const innerCircumference = total >= 2 ? innerCircOf(total, pitchAvg, dAvg) : 0;
    const clearance = innerCircumference - W;
    const centerCircumference = total >= 2 ? (Math.PI * pitchAvg) / Math.sin(Math.PI / total) : LCenter;

    // BOM（按素材聚合，金额分整数）
    const items: CalcBomItem[] = [];
    if (mainQty > 0) {
        items.push(bomItem(main, mainQty));
    }
    if (focal) {
        items.push(bomItem(focal, 1));
    }
    if (spacer && spacerQty > 0) {
        items.push(bomItem(spacer, spacerQty));
    }
    const aggregated = aggregate(items);
    const holes = items
        .map(i => byId.get(i.materialId)?.holeSize)
        .filter((h): h is number => h != null);
    const holeMin = holes.length ? Math.min(...holes) : null;
    const cordDiameter = pickCordDiameter(holeMin);

    const calc: CalcResult = {
        count: total,
        countInitial: geo.countInitial,
        centerCircumference,
        innerCircumference,
        feedback: feedbackOf(clearance),
        clearance,
        adjustHint: geo.adjustHint,
        cordLength: centerCircumference + CORD_TAIL,
        cordDiameter,
    };
    const bom: CalcBom = {
        items: aggregated,
        totalCount: aggregated.reduce((s, i) => s + i.qty, 0),
        totalAmount: aggregated.reduce((s, i) => s + i.subtotal, 0),
        cord: aggregated.length ? { length: calc.cordLength, diameter: cordDiameter, note: '弹力线，打结收尾留量 160mm' } : null,
        geometry: aggregated.length ? { innerCircumference, feedback: calc.feedback, clearance } : null,
    };
    return { calc, bom };
};
```

- [ ] **Step 4: 运行本套件 + @diy/calc 全量回归**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/bracelet-calculator.spec.ts`
Expected: PASS（6 个用例全绿）。

Run: `pnpm vitest run packages/diy-calc`
Expected: PASS（prng 4 + sum 5 + bracelet 全套 + bracelet-calculator 6，无回归）。

Run: `pnpm --filter @diy/calc build`
Expected: 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/diy-calc/src
git commit -m "feat(diy-calc): implement full bracelet calculator with focal/spacer reconvergence and cord sizing"
```

---

## Task 12：buildLayout 确定性排布（五种图案）

**Files:**
- Create: `packages/diy-calc/src/layout.ts`
- Test: `packages/diy-calc/src/__tests__/layout.spec.ts`

背景：bead-diy §7.5 的排布生成搬进 @diy/calc（C 端渲染 P5 消费）。五个模式：solid/ab/gradient/random/focal；rotation = `mulberry32(seed ^ (index·0x9E3779B1))·2π`（按珠序派生，确定性）；random 约束同材质不得连续 >3 颗；输出先按 angle 再按 depth 排。范围决策：`RenderLayout.rx/ry/center/cordSegments` 属画布像素细节，留给 C 端（P5）实现，本包只出珠子几何。

- [ ] **Step 1: 写失败测试**

`packages/diy-calc/src/__tests__/layout.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { buildLayout } from '../layout';

const base = { count: 21, seed: 42 };

describe('buildLayout 确定性', () => {
    it('同输入两次输出完全一致（快照语义）', () => {
        const input = { ...base, pattern: 'random' as const, palette: ['x', 'y'], weights: [3, 1], materials: { main: 'x' } };
        expect(buildLayout(input)).toEqual(buildLayout(input));
    });

    it('angle = index/N·2π 且输出按 angle 升序', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        expect(beads).toHaveLength(21);
        for (let i = 0; i < 21; i++) {
            expect(beads[i].angle).toBeCloseTo((i / 21) * 2 * Math.PI, 10);
        }
        for (let i = 1; i < 21; i++) {
            expect(beads[i].angle).toBeGreaterThanOrEqual(beads[i - 1].angle);
        }
        expect(beads[0].depth).toBeCloseTo(0.5, 10);
    });

    it('rotation 值域 [0, 2π) 且彼此不同（按珠序派生）', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        const rots = beads.map(b => b.rotation);
        for (const r of rots) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(2 * Math.PI);
        }
        expect(new Set(rots).size).toBeGreaterThan(15);
    });

    it('solid：全部主珠', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', materials: { main: 'x' } });
        expect(beads.every(b => b.materialId === 'x' && b.role === 'main')).toBe(true);
    });

    it('ab：ratio=2 时 [A,A,B] 周期', () => {
        const { beads } = buildLayout({ count: 6, seed: 1, pattern: 'ab', ratio: 2, materials: { main: 'a', secondary: 'b' } });
        expect(beads.map(b => b.materialId)).toEqual(['a', 'a', 'b', 'a', 'a', 'b']);
    });

    it('gradient：严格左右对称', () => {
        const { beads } = buildLayout({ count: 20, seed: 1, pattern: 'gradient', palette: ['deep', 'mid', 'light'], materials: { main: 'deep' } });
        for (let i = 0; i < 10; i++) {
            expect(beads[i].materialId).toBe(beads[19 - i].materialId);
        }
    });

    it('random：同材质不得连续 >3 颗', () => {
        const { beads } = buildLayout({ count: 60, seed: 7, pattern: 'random', palette: ['x', 'y'], weights: [5, 1], materials: { main: 'x' } });
        let run = 1;
        for (let i = 1; i < beads.length; i++) {
            run = beads[i].materialId === beads[i - 1].materialId ? run + 1 : 1;
            expect(run).toBeLessThanOrEqual(3);
        }
    });

    it('focal：index 0 是焦点珠且仅 1 颗', () => {
        const { beads } = buildLayout({ ...base, pattern: 'focal', materials: { main: 'x', focal: 'f' } });
        expect(beads[0].materialId).toBe('f');
        expect(beads.filter(b => b.materialId === 'f')).toHaveLength(1);
    });

    it('隔片：every=2 时隔片颗数 = floor(N/3) 且 role=spacer', () => {
        const { beads } = buildLayout({ ...base, pattern: 'solid', spacerEvery: 2, materials: { main: 'x', spacer: 's' } });
        const spacers = beads.filter(b => b.role === 'spacer');
        expect(spacers).toHaveLength(Math.floor(21 / 3));
        expect(spacers.every(b => b.materialId === 's')).toBe(true);
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/layout.spec.ts`
Expected: FAIL，`Cannot find module '../layout'`。

- [ ] **Step 3: 实现 layout.ts**

`packages/diy-calc/src/layout.ts`：

```ts
import { mulberry32 } from './prng';

export interface LayoutBead {
    index: number;
    /** 椭圆参数角（rad） */
    angle: number;
    /** 深度 0~1，1 = 最靠近观察者（前半圈） */
    depth: number;
    materialId: string;
    /** 纹理旋转（rad），来自按珠序派生的确定性伪随机，避免整圈纹理重复 */
    rotation: number;
    role: 'main' | 'secondary' | 'spacer';
}

export type LayoutPattern = 'solid' | 'ab' | 'gradient' | 'random' | 'focal';

export interface LayoutInput {
    count: number;
    seed: number;
    pattern: LayoutPattern;
    materials: {
        main?: string;
        secondary?: string;
        focal?: string;
        spacer?: string;
    };
    /** ab：A 连续颗数（周期 [A×ratio, B]，默认 1 = 纯交替） */
    ratio?: number;
    /** gradient：深→浅素材序列（≥2）；random：候选池 */
    palette?: string[];
    /** random：与 palette 对齐的轮盘赌权重 */
    weights?: number[];
    /** 隔片插入周期：每隔几颗插一片（0/缺省 = 不插） */
    spacerEvery?: number;
}

function pickWeighted(palette: string[], weights: number[], rng: () => number, history: string[]): string {
    // 同材质连续已达 3 颗时禁选；候选全被禁则退化为无约束
    const banned = history.length === 3 && history.every(m => m === history[0]) ? history[0] : null;
    const pool: string[] = [];
    const wpool: number[] = [];
    for (let i = 0; i < palette.length; i++) {
        if (palette[i] === banned) continue;
        pool.push(palette[i]);
        wpool.push(weights[i]);
    }
    const pickFrom = pool.length ? pool : palette;
    const pickW = pool.length ? wpool : weights;
    const total = pickW.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    let picked = pickFrom[pickFrom.length - 1];
    for (let i = 0; i < pickFrom.length; i++) {
        roll -= pickW[i];
        if (roll <= 0) {
            picked = pickFrom[i];
            break;
        }
    }
    history.push(picked);
    if (history.length > 3) history.shift();
    return picked;
}

/**
 * 确定性排布（§7.5）：
 * - angle = (index/count)·2π；depth = 0.5 + 0.5·sin(angle)（下半圈朝前）
 * - rotation = mulberry32(seed ^ (index·0x9E3779B1))·2π
 * - random 用独立随机流 mulberry32(seed ^ 0x51ED270B) 轮盘赌 + 连续同色约束
 * - 输出先按 angle 再按 depth 排，保证渲染稳定
 */
export function buildLayout(input: LayoutInput): { beads: LayoutBead[] } {
    const { count, seed, pattern, materials } = input;
    const every = Math.max(0, Math.floor(input.spacerEvery ?? 0));
    const ratio = Math.max(1, Math.floor(input.ratio ?? 1));
    const randomRng = mulberry32((seed ^ 0x51ed270b) | 0);
    const history: string[] = [];
    const beads: LayoutBead[] = [];

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        let materialId = materials.main ?? '';
        let role: LayoutBead['role'] = 'main';

        const isSpacer = every > 0 && !!materials.spacer && (i + 1) % (every + 1) === 0;
        if (pattern === 'focal' && i === 0 && materials.focal) {
            materialId = materials.focal;
        } else if (isSpacer) {
            materialId = materials.spacer!;
            role = 'spacer';
        } else {
            switch (pattern) {
                case 'ab': {
                    const a = materials.main ?? '';
                    const b = materials.secondary ?? a;
                    materialId = i % (ratio + 1) < ratio ? a : b;
                    break;
                }
                case 'gradient': {
                    const palette =
                        input.palette && input.palette.length >= 2
                            ? input.palette
                            : [materials.main ?? '', materials.secondary ?? ''];
                    const half = Math.floor(count / 2);
                    const dist = Math.min(i, count - 1 - i);
                    const t = half === 0 ? 0 : dist / half;
                    const gi = Math.min(palette.length - 1, Math.floor(t * palette.length));
                    materialId = palette[gi];
                    role = 'secondary';
                    break;
                }
                case 'random': {
                    const palette = input.palette && input.palette.length ? input.palette : [materials.main ?? ''];
                    const weights =
                        input.weights && input.weights.length === palette.length ? input.weights : palette.map(() => 1);
                    materialId = pickWeighted(palette, weights, randomRng, history);
                    break;
                }
                case 'solid':
                case 'focal':
                default:
                    materialId = materials.main ?? '';
                    break;
            }
        }

        beads.push({
            index: i,
            angle,
            depth: 0.5 + 0.5 * Math.sin(angle),
            materialId,
            rotation: mulberry32(seed ^ (i * 0x9e3779b1))() * 2 * Math.PI,
            role,
        });
    }

    beads.sort((a, b) => a.angle - b.angle || a.depth - b.depth);
    return { beads };
}
```

- [ ] **Step 4: 运行确认通过 + 全量回归**

Run: `pnpm vitest run packages/diy-calc/src/__tests__/layout.spec.ts`
Expected: PASS（9 个用例全绿）。

Run: `pnpm vitest run packages/diy-calc`
Expected: PASS（@diy/calc 全部套件无回归）。

- [ ] **Step 5: 提交**

```powershell
git add packages/diy-calc/src
git commit -m "feat(diy-calc): add deterministic layout builder with five patterns"
```

---

## Task 13：bracelet-classic 模板种子 + P3 冒烟验收

**Files:**
- Modify: `packages/diy-plugin/src/seed.ts`（追加模板种子）

背景：首发唯一玩法模板。calculatorKey `bracelet` 对应 @diy/calc registry（Task 2/11）；config 结构与 Task 9 `parseTemplateConfig` 校验规则一致。种子幂等：存在同 (app, code) 即跳过。

- [ ] **Step 1: seed.ts 追加模板种子**

import 区追加：

```ts
import { IsNull } from 'typeorm';

import { DiyTemplate } from './entities/diy-template.entity';
import { DiyTemplateConfig } from './types';
```

（`loggerCtx` 已从 `./constants` import；`DiyTemplateConfig` 若与现有 import 合并则写在一行。）

文件末尾（`seedDiy` 之外）追加常量与函数：

```ts
export const BRACELET_CLASSIC: DiyTemplateConfig = {
    slots: [
        {
            key: 'main',
            name: { 'zh-CN': '主珠', 'en-US': 'Main beads' },
            role: 'main',
            required: true,
            quantityMode: 'calculated',
            filter: { shapes: ['round'], diameterRange: [4, 16] },
        },
        {
            key: 'focal',
            name: { 'zh-CN': '焦点珠', 'en-US': 'Focal bead' },
            role: 'focal',
            required: false,
            quantityMode: 'fixed',
            quantity: 1,
            filter: { shapes: ['round', 'drum'], diameterRange: [10, 20] },
        },
        {
            key: 'spacer',
            name: { 'zh-CN': '隔片', 'en-US': 'Spacers' },
            role: 'spacer',
            required: false,
            quantityMode: 'user',
            quantityRange: [0, 40],
            defaultEvery: 2,
            filter: { shapes: ['spacer'] },
        },
    ],
    params: [
        { key: 'wristSize', type: 'number', unit: 'mm', min: 120, max: 200, default: 155 },
        { key: 'fit', type: 'enum', options: ['snug', 'comfortable', 'loose'], default: 'comfortable' },
        { key: 'gap', type: 'number', unit: 'mm', min: 0, max: 2, default: 0.5, advanced: true },
    ],
    constraints: [],
    presentation: { renderer: 'bracelet', blocks: ['gallery', 'params', 'slots', 'price'] },
};

async function seedBraceletTemplate(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyTemplate);
    const existing = await repo.findOne({ where: { app: IsNull(), code: 'bracelet-classic' } });
    if (existing) {
        return;
    }
    await repo.save(
        new DiyTemplate({
            app: null,
            code: 'bracelet-classic',
            name: { 'zh-CN': '经典手串', 'en-US': 'Classic bracelet' },
            description: {
                'zh-CN': '圆珠 + 焦点珠 + 隔片的标准手串玩法',
                'en-US': 'Standard bracelet with focal bead and spacers',
            },
            calculatorKey: 'bracelet',
            config: BRACELET_CLASSIC,
            status: 'enabled',
            version: 1,
            sortOrder: 0,
        }),
    );
    Logger.info('[DiyPlugin] bracelet-classic template seeded', loggerCtx);
}
```

并在 `seedDiy` 函数体内、分类种子日志之后追加一行调用：

```ts
    await seedBraceletTemplate(connection);
```

- [ ] **Step 2: 构建验证**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

- [ ] **Step 3: dev-server 冒烟**

```powershell
pnpm --filter dev-server dev:server
```

观察启动日志 Expected：

```
[DiyPlugin] platform categories seeded
[DiyPlugin] bracelet-classic template seeded
DiyPlugin initialized
```

另开终端验证 shop-api 能查到模板：

```powershell
$body = '{"query":"query { diyShopTemplate(code: \"bracelet-classic\") { id code status calculatorKey config } }"}'
Set-Content -Path "$env:TEMP\diy-tpl.json" -Value $body -Encoding utf8 -NoNewline
curl.exe -s -X POST http://localhost:3000/shop-api -H "Content-Type: application/json" --data-binary "@$env:TEMP\diy-tpl.json"
```

Expected: 返回 `status: "enabled"`、`calculatorKey: "bracelet"`，`config` JSON 含 3 个 slots（main/focal/spacer）与 params（wristSize/fit/gap）。重启一次 server 确认日志只剩 seeded 之前的分类行、模板行不重复打印（幂等）。

- [ ] **Step 4: 停 server + 提交（P3 收口）**

```powershell
git add packages/diy-plugin/src
git commit -m "feat(diy-plugin): seed bracelet-classic template with slots/params config"
```

（P3 验收：§7.4 经验表 6 组断言全过；layout 确定性快照；模板种子幂等。）

---

## Task 14：DiyPlan 实体 + calc-bridge（复算桥）+ C 端方案查询/创建

**Files:**
- Create: `packages/diy-plugin/src/entities/diy-plan.entity.ts`
- Create: `packages/diy-plugin/src/calc-bridge.ts`
- Test: `packages/diy-plugin/src/__tests__/calc-bridge.spec.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（entities 数组 + shopSchema 追加 DiyPlan）
- Modify: `packages/diy-plugin/src/diy-shop.service.ts`（追加 createDiyPlan/myDiyPlans/myDiyPlan）
- Modify: `packages/diy-plugin/src/diy-shop.resolver.ts`（追加 1 Mutation + 2 Query）
- Modify: `packages/diy-plugin/index.ts`（追加 2 行导出）
- Create: `packages/dev-server/migrations/<timestamp>-add_diy_plan.ts`（命令生成）

背景：方案三链路的载体（规格 §6.1）。`runDiyCalc` 是双端同构的复算入口——spec（slotKey→选择）+ 合并素材 → `@diy/calc` CalculatorInput → CalculatorOutput；创建方案（快照价）、报价（实时价）、下单（成交价）三个环节共用。

- [ ] **Step 1: 创建 diy-plan.entity.ts**

```ts
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

import { DiyPlanBom, DiyPlanSpec } from '../types';

/**
 * DIY 搭配方案（规格 §6.1）：draft / quoted / ordered 三态统一载体。
 * spec 与 bom 均为快照——模板/素材后续改版不影响存量方案；
 * quote/order 环节会以服务端实时价复算并覆盖 bom（quoteRefAmount 记录报价参考价）。
 */
@Entity()
@Index('idx_diy_plan_app_user', ['app', 'userId'])
export class DiyPlan extends VendureEntity {
    constructor(input?: Partial<DiyPlan>) {
        super(input);
    }

    /** 租户端（nshop/vshop）；方案恒归属某租户端，非空 */
    @Column()
    app: string;

    /** null = 未登录演示方案（不能报价/下单） */
    @Column({ nullable: true })
    userId: number | null;

    @Column()
    templateId: number;

    /** 创建时模板 version（再编辑提示用，不参与复算） */
    @Column({ default: 1 })
    templateVersion: number;

    /** draft / quoted / ordered */
    @Column('varchar', { default: 'draft' })
    status: 'draft' | 'quoted' | 'ordered';

    @Column('simple-json')
    spec: DiyPlanSpec;

    @Column('simple-json')
    bom: DiyPlanBom;

    /** 生成当前 bom 时使用的 @diy/calc 语义化版本 */
    @Column('varchar', { length: 16 })
    calcVersion: string;

    /** 报价单号 DIY-YYYYMMDD-XXXXXX，quoteDiyPlan 时写入 */
    @Column('varchar', { length: 32, nullable: true })
    quoteNo: string | null;

    @Column({ type: 'datetime', nullable: true })
    expiresAt: Date | null;

    /** 成单后的 Vendure OrderLine id */
    @Column({ nullable: true })
    orderLineId: number | null;

    /** 方案封面（C 端渲染截图，createDiyPlan 传入） */
    @Column({ nullable: true })
    thumb: string | null;

    /** 分享图（P5 使用，可空） */
    @Column({ nullable: true })
    shareImage: string | null;
}
```

- [ ] **Step 2: 注册实体 + 导出**

修改 `packages/diy-plugin/src/diy-plugin.ts`：

import 区追加：

```ts
import { DiyPlan } from './entities/diy-plan.entity';
```

entities 数组改为：

```ts
    entities: [DiyCategory, DiyMaterial, DiyTemplate, DiyPlan],
```

修改 `packages/diy-plugin/index.ts`，在 `export * from './src/template-config';` 之后追加：

```ts
export * from './src/entities/diy-plan.entity';
```

- [ ] **Step 3: 构建验证 + 迁移**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

```powershell
cd packages/dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts generate add_diy_plan
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
cd D:\zhao\vendure
```

Expected: 生成 `<timestamp>-add_diy_plan.ts`（新增 diy_plan 表 + 索引），run 无错误。

- [ ] **Step 4: 写 calc-bridge 失败测试**

`packages/diy-plugin/src/__tests__/calc-bridge.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { runDiyCalc } from '../calc-bridge';
import { DiyMaterial } from '../entities/diy-material.entity';
import { DiyTemplate } from '../entities/diy-template.entity';
import { DiyPlanSpec } from '../types';

function mat(p: Partial<DiyMaterial> & { id: number; code: string }): DiyMaterial {
    return {
        app: null,
        sourceMaterialId: null,
        name: { 'zh-CN': p.code },
        categoryId: 1,
        shape: 'round',
        diameter: 8,
        axialLength: 8,
        holeSize: 1,
        attrs: null,
        render: null,
        price: 100,
        priceUnit: 'piece',
        currency: 'CNY',
        stock: 100,
        images: null,
        enabled: true,
        sortOrder: 0,
        ...p,
    } as DiyMaterial;
}

const template = {
    calculatorKey: 'bracelet',
    config: {
        slots: [
            { key: 'main', name: { 'zh-CN': '主珠' }, role: 'main', required: true, quantityMode: 'calculated' },
        ],
        params: [],
        constraints: [],
        presentation: { renderer: 'bracelet', blocks: [] },
    },
} as unknown as DiyTemplate;

const spec: DiyPlanSpec = {
    slots: { main: { materialId: '11' } },
    params: { wristSize: 155, fit: 'comfortable', gap: 0.5 },
};

describe('runDiyCalc', () => {
    it('bridges spec + merged materials through the bracelet calculator', () => {
        const main = mat({ id: 11, code: 'A-AGS-08-N', name: { 'zh-CN': '猫眼玛瑙', 'en-US': 'Cat eye agate' } });
        const out = runDiyCalc(template, spec, [main], 'zh_Hans');
        // 155/comfortable/0.5 + 8mm 主珠 → 22 颗（与 @diy/calc bracelet-calculator 默认参数断言同源）
        expect(out.calc?.count).toBe(22);
        expect(out.bom.items).toHaveLength(1);
        expect(out.bom.items[0]).toMatchObject({
            materialId: '11',
            code: 'A-AGS-08-N',
            name: '猫眼玛瑙',
            qty: 22,
            unitPrice: 100,
        });
        expect(out.bom.totalAmount).toBe(2200);
    });

    it('falls back to the built-in sum calculator when calculatorKey is null', () => {
        const out = runDiyCalc(
            { ...template, calculatorKey: null },
            { slots: { main: { materialId: '11', qtyOverride: 3 } }, params: {} },
            [mat({ id: 11, code: 'X' })],
            'zh_Hans',
        );
        expect(out.calc).toBeNull();
        expect(out.bom.totalAmount).toBe(300);
    });

    it('localizes material names by languageCode (zh_Hans → zh-CN)', () => {
        const main = mat({ id: 11, code: 'A-AGS-08-N', name: { 'zh-CN': '猫眼玛瑙', 'en-US': 'Cat eye agate' } });
        const en = runDiyCalc(template, spec, [main], 'en_US');
        expect(en.bom.items[0].name).toBe('Cat eye agate');
    });

    it('throws on unknown slot key', () => {
        const bad = { slots: { nope: { materialId: '11' } }, params: {} } as DiyPlanSpec;
        expect(() => runDiyCalc(template, bad, [mat({ id: 11, code: 'X' })], 'zh_Hans')).toThrow('Unknown slot');
    });

    it('throws when a referenced material is missing', () => {
        expect(() => runDiyCalc(template, spec, [], 'zh_Hans')).toThrow('not found');
    });

    it('throws on invalid template config', () => {
        expect(() =>
            runDiyCalc({ ...template, config: { slots: [] } } as unknown as DiyTemplate, spec, [mat({ id: 11, code: 'X' })], 'zh_Hans'),
        ).toThrow('Invalid template config');
    });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/calc-bridge.spec.ts`
Expected: FAIL，报 `Cannot find module '../calc-bridge'`。

- [ ] **Step 6: 实现 calc-bridge.ts**

`packages/diy-plugin/src/calc-bridge.ts`：

```ts
import { CalcBom, CalcMaterial, CalculatorInput, CalculatorOutput, SlotSelection, getCalculator } from '@diy/calc';

import { localizeText, resolveLocaleKey } from './localize';
import { parseTemplateConfig } from './template-config';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPlanBom, DiyPlanSpec } from './types';

/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * spec.slots（slotKey → 选择）+ 合并素材 → @diy/calc CalculatorInput → CalculatorOutput。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
export function runDiyCalc(
    template: Pick<DiyTemplate, 'calculatorKey' | 'config'>,
    spec: DiyPlanSpec,
    materials: DiyMaterial[],
    languageCode: string,
): CalculatorOutput {
    const config = parseTemplateConfig(template.config);
    if (!config) {
        throw new Error(`Invalid template config`);
    }
    const keyToRole = new Map(config.slots.map(s => [s.key, s.role]));
    const materialsById = new Map(materials.map(m => [String(m.id), m]));
    const slots: SlotSelection[] = [];
    for (const [key, sel] of Object.entries(spec.slots)) {
        const role = keyToRole.get(key);
        if (!role) {
            throw new Error(`Unknown slot "${key}"`);
        }
        const material = materialsById.get(String(sel.materialId));
        if (!material) {
            throw new Error(`Slot "${key}" material ${sel.materialId} not found`);
        }
        slots.push({
            key,
            role,
            materialId: String(sel.materialId),
            qtyOverride: sel.qtyOverride,
            every: sel.every,
        });
    }
    const localeKey = resolveLocaleKey(languageCode);
    const calcMaterials: CalcMaterial[] = materials.map(m => ({
        id: String(m.id),
        code: m.code,
        name: localizeText(m.name, localeKey, m.code),
        shape: m.shape,
        diameter: m.diameter,
        axialLength: m.axialLength,
        holeSize: m.holeSize,
        price: m.price,
    }));
    const input: CalculatorInput = { params: spec.params, slots, materials: calcMaterials };
    return getCalculator(template.calculatorKey)(input);
}

/** CalcBom（cord/geometry 可为 null）→ DiyPlanBom（可选字段），落库前规范化 */
export function toPlanBom(bom: CalcBom): DiyPlanBom {
    return {
        items: bom.items,
        totalCount: bom.totalCount,
        totalAmount: bom.totalAmount,
        cord: bom.cord ?? undefined,
        geometry: bom.geometry ?? undefined,
    };
}
```

修改 `packages/diy-plugin/index.ts`，在上一行实体导出之后追加：

```ts
export * from './src/calc-bridge';
```

- [ ] **Step 7: 运行确认通过**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/calc-bridge.spec.ts`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 8: diy-shop.service.ts 追加方案方法**

import 区调整（替换原 `@vendure/core` 行并追加新行）：

```ts
import { Inject, Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CALC_VERSION } from '@diy/calc';
import { IsNull } from 'typeorm';

import { PLUGIN_INIT_OPTIONS } from './constants';
import { runDiyCalc, toPlanBom } from './calc-bridge';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { parseTemplateConfig } from './template-config';
import { mergeMaterials } from './material-merge';
import { DiyMaterialFilter, DiyPlanSpec, DiyPluginOptions } from './types';
```

`DiyMaterialList` 接口之后追加返回类型：

```ts
export interface DiyPlanList {
    items: DiyPlan[];
    total: number;
}
```

类末尾（`categoryIdsByCode` 方法之后）追加：

```ts
    /* ------------------------- 方案（规格 §6.2） ------------------------- */

    /** C 端创建方案（可匿名演示）：required 槽位校验 → 合并素材 → 服务端复算 → draft 落库（价格快照） */
    async createDiyPlan(
        ctx: RequestContext,
        input: { templateCode: string; spec: DiyPlanSpec; thumb?: string | null },
    ): Promise<DiyPlan> {
        const template = await this.findShopTemplateByCode(ctx, input.templateCode);
        if (!template) {
            throw new UserInputError(`Diy template not found: ${input.templateCode}`);
        }
        const parsed = parseTemplateConfig(template.config);
        if (!parsed) {
            throw new UserInputError(`Invalid template config: ${template.code}`);
        }
        for (const slot of parsed.slots) {
            if (slot.required && !input.spec.slots[slot.key]?.materialId) {
                throw new UserInputError(`Slot "${slot.key}" is required`);
            }
        }
        // 仅启用素材参与复算：素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = runDiyCalc(template, input.spec, materialList.items, ctx.languageCode);
        return this.connection.getRepository(ctx, DiyPlan).save(
            new DiyPlan({
                app: this.app,
                userId: ctx.activeUserId ?? null,
                templateId: template.id,
                templateVersion: template.version,
                status: 'draft',
                spec: input.spec,
                bom: toPlanBom(bom),
                calcVersion: CALC_VERSION,
                thumb: input.thumb ?? null,
            }),
        );
    }

    /** 我的方案列表（未登录返回空页） */
    async myDiyPlans(
        ctx: RequestContext,
        options: { status?: 'draft' | 'quoted' | 'ordered'; skip?: number; take?: number } = {},
    ): Promise<DiyPlanList> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return { items: [], total: 0 };
        }
        const [items, total] = await this.connection
            .getRepository(ctx, DiyPlan)
            .findAndCount({
                where: {
                    app: this.app,
                    userId,
                    ...(options.status ? { status: options.status } : {}),
                },
                order: { createdAt: 'DESC', id: 'DESC' },
                skip: options.skip ?? 0,
                take: options.take ?? 20,
            });
        return { items, total };
    }

    /** 我的方案详情（仅本人可见，他人/跨租户一律 null） */
    async myDiyPlan(ctx: RequestContext, id: string): Promise<DiyPlan | null> {
        const userId = ctx.activeUserId;
        if (!userId) {
            return null;
        }
        const plan = await this.connection
            .getRepository(ctx, DiyPlan)
            .findOne({ where: { app: this.app, id: Number(id) } });
        return plan && plan.userId === userId ? plan : null;
    }
```

- [ ] **Step 9: shopSchema 追加 DiyPlan + resolver 方法**

修改 `packages/diy-plugin/src/diy-plugin.ts`，在 `shopSchema` 常量字符串末尾追加（shop 是独立 schema，多段 `extend type` 会自动合并）：

```ts
    type DiyPlan {
        id: ID!
        status: String!
        spec: JSON
        bom: JSON
        calcVersion: String!
        quoteNo: String
        expiresAt: DateTime
        orderLineId: Int
        thumb: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyPlanList {
        items: [DiyPlan!]!
        total: Int!
    }
    extend type Query {
        myDiyPlans(status: String, skip: Int, take: Int): DiyPlanList!
        myDiyPlan(id: ID!): DiyPlan
    }
    extend type Mutation {
        createDiyPlan(templateCode: String!, spec: JSON!, thumb: String): DiyPlan!
    }
```

修改 `packages/diy-plugin/src/diy-shop.resolver.ts`：

import 区把 `@nestjs/graphql` 行扩为（追加 `Mutation`）：

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
```

并追加实体与类型 import：

```ts
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyPlanList } from './diy-shop.service';
```

（与现有 `DiyMaterialList` 的 import 合并为 `import { DiyMaterialList, DiyPlanList, DiyShopService } from './diy-shop.service';`。）

类末尾追加：

```ts
    @Mutation()
    @Allow(Permission.Public)
    async createDiyPlan(
        @Ctx() ctx: RequestContext,
        @Args('templateCode') templateCode: string,
        @Args('spec') spec: any,
        @Args('thumb', { nullable: true }) thumb?: string | null,
    ): Promise<DiyPlan> {
        return this.service.createDiyPlan(ctx, { templateCode, spec, thumb });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myDiyPlans(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: 'draft' | 'quoted' | 'ordered',
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ): Promise<DiyPlanList> {
        return this.service.myDiyPlans(ctx, { status, skip, take });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myDiyPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan | null> {
        return this.service.myDiyPlan(ctx, id);
    }
```

（createDiyPlan 允许匿名 → 演示方案 userId=null；quote/order 在 Task 15/17 用 `Permission.Authenticated` 收紧。）

- [ ] **Step 10: 构建验证**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

- [ ] **Step 11: 提交**

```powershell
git add packages/diy-plugin/src packages/diy-plugin/index.ts packages/dev-server/migrations
git commit -m "feat(diy-plugin): add DiyPlan entity, calc bridge and shop plan create/query"
```

---

## Task 15：报价单号工具（TDD）+ quoteDiyPlan

**Files:**
- Create: `packages/diy-plugin/src/quote-utils.ts`
- Test: `packages/diy-plugin/src/__tests__/quote-utils.spec.ts`
- Modify: `packages/diy-plugin/src/diy-shop.service.ts`（追加 quoteDiyPlan）
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（shopSchema 追加 quoteDiyPlan）
- Modify: `packages/diy-plugin/src/diy-shop.resolver.ts`（追加 1 Mutation）

- [ ] **Step 1: 写失败测试**

`packages/diy-plugin/src/__tests__/quote-utils.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { buildQuoteNo, quoteExpiresAt } from '../quote-utils';

describe('buildQuoteNo', () => {
    it('matches DIY-YYYYMMDD-XXXXXX', () => {
        const no = buildQuoteNo(new Date('2026-10-11T08:30:00'));
        expect(no).toMatch(/^DIY-20261011-[2-9A-HJ-NP-Z]{6}$/);
    });

    it('is deterministic under injected random', () => {
        expect(buildQuoteNo(new Date('2026-10-11'), () => 0)).toBe('DIY-20261011-222222');
        expect(buildQuoteNo(new Date('2026-10-11'), () => 0.9999999)).toBe('DIY-20261011-ZZZZZZ');
    });

    it('never contains confusable chars 0/O/1/I across many draws', () => {
        for (let i = 0; i < 500; i++) {
            const no = buildQuoteNo(new Date(), Math.random);
            expect(no.slice(-6)).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
        }
    });
});

describe('quoteExpiresAt', () => {
    it('adds ttl days preserving time-of-day', () => {
        const now = new Date('2026-10-11T12:00:00Z');
        expect(quoteExpiresAt(now, 7).toISOString()).toBe(new Date('2026-10-18T12:00:00Z').toISOString());
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/quote-utils.spec.ts`
Expected: FAIL，报 `Cannot find module '../quote-utils'`。

- [ ] **Step 3: 实现 quote-utils.ts**

`packages/diy-plugin/src/quote-utils.ts`：

```ts
/**
 * 报价单号与有效期（纯函数，规格 §6.3）。
 * 单号不含价格/批次语义（与素材货号同哲学）：改价不换规则，重报价生成新号。
 * 随机与时间注入以便单测；随机字符排除易混 0/O/1/I。
 */
const QUOTE_NO_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const QUOTE_NO_RANDOM_LEN = 6;

export function buildQuoteNo(now: Date, random: () => number = Math.random): string {
    const y = String(now.getFullYear()).padStart(4, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    let suffix = '';
    for (let i = 0; i < QUOTE_NO_RANDOM_LEN; i++) {
        suffix += QUOTE_NO_CHARS[Math.floor(random() * QUOTE_NO_CHARS.length)];
    }
    return `DIY-${y}${m}${d}-${suffix}`;
}

export function quoteExpiresAt(now: Date, ttlDays: number): Date {
    return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run packages/diy-plugin/src/__tests__/quote-utils.spec.ts`
Expected: PASS（4 个用例全绿）。

- [ ] **Step 5: diy-shop.service.ts 追加 quoteDiyPlan**

import 区追加（`@vendure/core` 行加入 `ForbiddenError`；新增 `DEFAULT_QUOTE_TTL_DAYS`）：

```ts
import { DEFAULT_QUOTE_TTL_DAYS } from './constants';
import { buildQuoteNo, quoteExpiresAt } from './quote-utils';
```

类末尾追加：

```ts
    /** 报价（规格 §6.3）：draft/quoted 可重复报价（每次以服务端实时价复算覆盖 bom，新号新效期）；ordered 不可 */
    async quoteDiyPlan(ctx: RequestContext, planId: string): Promise<DiyPlan> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const plan = await repo.findOne({ where: { app: this.app, id: Number(planId) } });
        if (!plan || plan.userId !== userId) {
            throw new UserInputError(`Diy plan not found: ${planId}`);
        }
        if (plan.status === 'ordered') {
            throw new UserInputError(`Diy plan ${plan.id} already ordered`);
        }
        const template = await this.connection
            .getRepository(ctx, DiyTemplate)
            .findOne({ where: { id: plan.templateId } });
        if (!template || template.status !== 'enabled') {
            throw new UserInputError(`Diy template not available`);
        }
        // 服务端实时价为唯一价格权威；素材禁用/删除 → 合并视图缺席 → runDiyCalc 抛错
        const materialList = await this.findShopMaterials(ctx, { onlyEnabled: true, take: 100000 });
        const { bom } = runDiyCalc(template, plan.spec, materialList.items, ctx.languageCode);
        const now = new Date();
        plan.status = 'quoted';
        plan.bom = toPlanBom(bom);
        plan.calcVersion = CALC_VERSION;
        plan.quoteNo = buildQuoteNo(now);
        plan.expiresAt = quoteExpiresAt(now, DEFAULT_QUOTE_TTL_DAYS);
        return repo.save(plan);
    }
```

- [ ] **Step 6: SDL + resolver**

`shopSchema` 常量字符串末尾追加：

```ts
    extend type Mutation {
        quoteDiyPlan(id: ID!): DiyPlan!
    }
```

`diy-shop.resolver.ts` 类末尾追加：

```ts
    @Mutation()
    @Allow(Permission.Authenticated)
    async quoteDiyPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan> {
        return this.service.quoteDiyPlan(ctx, id);
    }
```

- [ ] **Step 7: 构建验证 + 提交**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

```powershell
git add packages/diy-plugin/src
git commit -m "feat(diy-plugin): add quote number utils and requote flow with server-side recalc"
```

---

## Task 16：DiyStockService 原子扣减/回补

**Files:**
- Create: `packages/diy-plugin/src/diy-stock.service.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（providers 注册）

背景：库存扣减（偏差 3）。行为无独立单测（依赖 DB），由 Task 18 e2e 用例 5/6 验证「恰好一单成功」与「取消回补」；本任务以构建收口。

- [ ] **Step 1: 创建 diy-stock.service.ts**

`packages/diy-plugin/src/diy-stock.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { DiyMaterial } from './entities/diy-material.entity';

export interface StockItem {
    materialId: number;
    qty: number;
}

export interface StockShortage {
    materialId: number;
    code: string;
    required: number;
    available: number;
}

/**
 * 素材库存（偏差 3：DB 原子 UPDATE 替代 Redis 锁）：
 * `stock = stock - qty WHERE id = ? AND stock >= qty` 单语句原子，affected=0 即缺口。
 * deduct 全有或全无：任一缺口先回补已扣行，再返回缺口明细（不抛错，由调用方转 UserInputError）。
 * 库存归属：BOM.materialId 指向合并视图行——未复制的平台行扣平台库存，租户复制行扣租户库存（规格 §4.3）。
 * ctx 可传 undefined（事件订阅者等无 ctx 场景，走默认连接）。
 */
@Injectable()
export class DiyStockService {
    constructor(private connection: TransactionalConnection) {}

    async deduct(ctx: RequestContext | undefined, items: StockItem[]): Promise<StockShortage[]> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const deducted: StockItem[] = [];
        const shortages: StockShortage[] = [];
        for (const item of items) {
            const qty = Math.floor(item.qty);
            const result = await repo
                .createQueryBuilder()
                .update(DiyMaterial)
                .set({ stock: () => `stock - ${qty}` })
                .where('id = :id AND stock >= :qty', { id: item.materialId, qty })
                .execute();
            if (result.affected) {
                deducted.push(item);
            } else {
                const material = await repo.findOne({ where: { id: item.materialId } });
                shortages.push({
                    materialId: item.materialId,
                    code: material?.code ?? String(item.materialId),
                    required: qty,
                    available: material?.stock ?? 0,
                });
            }
        }
        if (shortages.length) {
            await this.restock(ctx, deducted);
        }
        return shortages;
    }

    async restock(ctx: RequestContext | undefined, items: StockItem[]): Promise<void> {
        if (!items.length) {
            return;
        }
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        for (const item of items) {
            const qty = Math.floor(item.qty);
            await repo
                .createQueryBuilder()
                .update(DiyMaterial)
                .set({ stock: () => `stock + ${qty}` })
                .where('id = :id', { id: item.materialId })
                .execute();
        }
    }
}
```

（`Math.floor` 先取整再拼入 SQL 片段——只可能是整数字面量，无注入面。）

- [ ] **Step 2: 注册 provider**

修改 `packages/diy-plugin/src/diy-plugin.ts`：

import 区追加：

```ts
import { DiyStockService } from './diy-stock.service';
```

providers 数组 `DiyShopResolver,` 之后追加一行：

```ts
        DiyStockService,
```

- [ ] **Step 3: 构建验证 + 提交**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

```powershell
git add packages/diy-plugin/src
git commit -m "feat(diy-plugin): add atomic stock deduct/restock service"
```

---

## Task 17：下单链路（OrderLine customFields + 价格包装 + 载体商品 + createOrderFromPlan + 取消回补 + admin diyPlans）

**Files:**
- Create: `packages/diy-plugin/src/diy-order.service.ts`
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（configuration 钩子 + 订阅者 + providers + bootstrap + shopSchema）
- Modify: `packages/diy-plugin/src/diy.service.ts`（追加 findPlans）
- Modify: `packages/diy-plugin/src/diy-admin.resolver.ts`（追加 diyPlans Query）
- Modify: `packages/diy-plugin/src/diy-plugin.ts`（adminSchema 追加 DiyPlan）
- Modify: `packages/diy-plugin/src/diy-shop.resolver.ts`（追加 createOrderFromPlan）
- Modify: `packages/dev-server/dev-config.ts`（核对插件顺序，见 Step 3）
- Create: `packages/dev-server/migrations/<timestamp>-add_diy_order_custom_fields.ts`（命令生成）

实现者注意（已实地核实的 core 事实，照此写）：
- `ProductVariant` 的 `price`/`listPrice`/`currencyCode` 是**运行时计算属性**（非列），构造器**不可**传（getter 无 setter，Object.assign 会抛 TypeError）；价格来自 `productVariantPrices` 关系（`ProductVariantPrice{price, currencyCode, variant}`）。
- Translation 实体回链字段名是 `base`（`ProductTranslation.base` / `ProductVariantTranslation.base`）。
- 默认渠道 code 为字面量 `'__default_channel__'`（core 未导出常量）。
- `TransactionalConnection.withTransaction(ctx, work)` 的回调参数是**绑定事务的 ctx**，内部一律用它，不得用外层 ctx。
- `OrderService.create(ctx, userId?)` 会挂 customer；`addItemToOrder(ctx, orderId, variantId, quantity, customFields?, relations?)` 第 6 参传 `['lines']` 以取回新行 id。

- [ ] **Step 1: 创建 diy-order.service.ts**

`packages/diy-plugin/src/diy-order.service.ts`：

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
    Channel,
    CurrencyCode,
    ForbiddenError,
    GlobalFlag,
    LanguageCode,
    Logger,
    Order,
    OrderItemPriceCalculationStrategy,
    OrderService,
    PriceCalculationResult,
    Product,
    ProductTranslation,
    ProductVariant,
    ProductVariantPrice,
    ProductVariantTranslation,
    RequestContext,
    TaxCategory,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CalcBom } from '@diy/calc';

import {
    CARRIER_PRODUCT_NAME,
    CARRIER_PRODUCT_SLUG,
    CARRIER_VARIANT_SKU,
    loggerCtx,
    PLUGIN_INIT_OPTIONS,
} from './constants';
import { runDiyCalc } from './calc-bridge';
import { DiyShopService } from './diy-shop.service';
import { DiyStockService, StockItem } from './diy-stock.service';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPluginOptions } from './types';

/**
 * DIY 成品行定价：OrderLine.customFields.diyUnitPrice > 0 时按它定价（BOM 金额为含税口径、单位分），
 * 否则委托原策略（sales-plugin 改价 / 默认标价）——包装委托式，不影响普通商品（与 sales-plugin 同哲学）。
 */
@Injectable()
export class DiyOrderItemPriceCalculationStrategy implements OrderItemPriceCalculationStrategy {
    constructor(private original?: OrderItemPriceCalculationStrategy) {}

    calculateUnitPrice(
        ctx: RequestContext,
        productVariant: ProductVariant,
        orderLineCustomFields: { [key: string]: any },
        order: Order,
        quantity: number,
    ): PriceCalculationResult | Promise<PriceCalculationResult> {
        const diyUnitPrice = orderLineCustomFields?.diyUnitPrice;
        if (diyUnitPrice != null && diyUnitPrice > 0) {
            return { price: diyUnitPrice, priceIncludesTax: true };
        }
        if (this.original) {
            return this.original.calculateUnitPrice(ctx, productVariant, orderLineCustomFields, order, quantity);
        }
        return { price: productVariant.listPrice, priceIncludesTax: productVariant.listPriceIncludesTax };
    }
}

/**
 * 载体商品（偏差 2）：bootstrap 幂等创建。enabled=true 才能过 addItemsToOrder 强校验；
 * 实际价格由 diyUnitPrice 覆盖；trackInventory=FALSE（库存由素材侧扣）；仅默认渠道。
 * 逐实体分步 save（不依赖级联）；价格行落 ProductVariantPrice，listPrice 运行时由它算出。
 */
export async function ensureCarrierProduct(connection: TransactionalConnection): Promise<void> {
    const variantRepo = connection.getRepository(ProductVariant);
    const existing = await variantRepo.findOne({ where: { sku: CARRIER_VARIANT_SKU } });
    if (existing) {
        return;
    }
    const taxCategory = await connection.getRepository(TaxCategory).findOne({ where: {} });
    const channel = await connection.getRepository(Channel).findOne({ where: { code: '__default_channel__' } });

    const product = await connection.getRepository(Product).save(
        new Product({ enabled: true, channels: channel ? [channel] : [] }),
    );
    await connection.getRepository(ProductTranslation).save(
        new ProductTranslation({
            languageCode: LanguageCode.zh_cn,
            name: CARRIER_PRODUCT_NAME,
            slug: CARRIER_PRODUCT_SLUG,
            description: 'DIY 定制成品载体，请通过 DIY 设计器下单',
            base: product,
        }),
    );

    const variant = await variantRepo.save(
        new ProductVariant({
            sku: CARRIER_VARIANT_SKU,
            enabled: true,
            trackInventory: GlobalFlag.FALSE,
            taxCategory: taxCategory ?? undefined,
            product,
            channels: channel ? [channel] : [],
        }),
    );
    await connection.getRepository(ProductVariantTranslation).save(
        new ProductVariantTranslation({ languageCode: LanguageCode.zh_cn, name: CARRIER_PRODUCT_NAME, base: variant }),
    );
    await connection.getRepository(ProductVariantPrice).save(
        new ProductVariantPrice({ price: 0, currencyCode: CurrencyCode.CNY, variant }),
    );
    Logger.info('[DiyPlugin] carrier product ensured', loggerCtx);
}

/**
 * 方案成单（规格 §6.3）：归属校验 → 服务端实时价复算 → 原子扣库存 → 建单挂 DIY 自定义订单行 → 回写 plan。
 * 全程包在事务里：任一步抛错整体回滚（含已扣库存），无需手动补偿。
 */
@Injectable()
export class DiyOrderService {
    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private shopService: DiyShopService,
        private stockService: DiyStockService,
    ) {}

    private get app(): string {
        return this.options.app ?? 'nshop';
    }

    async createOrderFromPlan(ctx: RequestContext, planId: string): Promise<DiyPlan> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        return this.connection.withTransaction(ctx, async tctx => {
            const planRepo = this.connection.getRepository(tctx, DiyPlan);
            const plan = await planRepo.findOne({ where: { app: this.app, id: Number(planId) } });
            if (!plan || plan.userId !== userId) {
                throw new UserInputError(`Diy plan not found: ${planId}`);
            }
            if (plan.status === 'ordered') {
                throw new UserInputError(`Diy plan ${plan.id} already ordered`);
            }
            const template = await this.connection
                .getRepository(tctx, DiyTemplate)
                .findOne({ where: { id: plan.templateId } });
            if (!template || template.status !== 'enabled') {
                throw new UserInputError(`Diy template not available`);
            }

            // 服务端实时价为唯一成交价；报价价（创建/最近一次报价时的快照）留作参考价
            const quoteRefAmount = plan.bom.totalAmount;
            const materialList = await this.shopService.findShopMaterials(tctx, { onlyEnabled: true, take: 100000 });
            let bom: CalcBom;
            try {
                bom = runDiyCalc(template, plan.spec, materialList.items, tctx.languageCode).bom;
            } catch (e) {
                throw new UserInputError((e as Error).message);
            }

            const stockItems: StockItem[] = bom.items.map(i => ({ materialId: Number(i.materialId), qty: i.qty }));
            const shortages = await this.stockService.deduct(tctx, stockItems);
            if (shortages.length) {
                // 抛错 → 事务回滚，已扣行自动还原（deduct 内部补偿在此场景是冗余但无害）
                throw new UserInputError(
                    `库存不足: ` +
                        shortages.map(s => `${s.code} 需 ${s.required} 现存 ${s.available}`).join('; '),
                );
            }

            const variant = await this.connection
                .getRepository(tctx, ProductVariant)
                .findOne({ where: { sku: CARRIER_VARIANT_SKU } });
            if (!variant) {
                throw new Error(`Carrier variant ${CARRIER_VARIANT_SKU} missing (ensureCarrierProduct 未运行?)`);
            }
            const order = await this.orderService.create(tctx, userId);
            const result = await this.orderService.addItemToOrder(
                tctx,
                order.id,
                variant.id,
                1,
                {
                    customFields: {
                        diyPlanId: plan.id,
                        diyUnitPrice: bom.totalAmount,
                        diyBom: JSON.stringify(bom),
                        diyQuoteRefAmount: quoteRefAmount,
                    },
                },
                ['lines'],
            );
            if (!(result instanceof Order)) {
                throw new UserInputError(result.errorCode);
            }
            plan.status = 'ordered';
            plan.orderLineId = Number(result.lines[result.lines.length - 1].id);
            await planRepo.save(plan);
            return plan;
        });
    }
}
```

- [ ] **Step 2: diy-plugin.ts —— configuration 钩子 + 订阅者 + providers + bootstrap + shopSchema**

import 区追加：

```ts
import {
    DiyOrderItemPriceCalculationStrategy,
    DiyOrderService,
    ensureCarrierProduct,
} from './diy-order.service';
import { DiyPlan } from './entities/diy-plan.entity';
```

并把现有 `@vendure/core` import 行扩为（追加 `OrderStateTransitionEvent`、`VendureEventSubscriber`，按字母序合并）：

```ts
import {
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    TransactionalConnection,
    VendureEventSubscriber,
    VendurePlugin,
} from '@vendure/core';
```

（订阅者类直接写在 diy-plugin.ts 内，见下方代码块——无需单独 subscriber 文件与对应 import 行。`OnApplicationBootstrap` Task 5 已 import，勿重复；`TransactionalConnection`/`DiyStockService` 也已在位。）

在 `@VendurePlugin({...})` 装饰器**之前**（与 `DiySeedRunner` 类同级位置）追加订阅者：

```ts
/**
 * 订单取消 → 回补 DIY 素材库存 + 方案回退 quoted（规格 §6.5）。
 * VendureEventSubscriber 自动注册，无需进 providers。
 */
@VendureEventSubscriber()
export class DiyOrderCancelSubscriber {
    constructor(
        private connection: TransactionalConnection,
        private stockService: DiyStockService,
    ) {}

    async onEvent(event: OrderStateTransitionEvent): Promise<void> {
        if (event.toState !== 'Cancelled') {
            return;
        }
        for (const line of event.order.lines) {
            const planId = (line.customFields as any)?.diyPlanId;
            const bomRaw = (line.customFields as any)?.diyBom;
            if (!planId || !bomRaw) {
                continue;
            }
            const bom = JSON.parse(bomRaw) as { items: { materialId: string; qty: number }[] };
            await this.stockService.restock(
                event.ctx,
                bom.items.map(i => ({ materialId: Number(i.materialId), qty: i.qty })),
            );
            await this.connection
                .getRepository(event.ctx, DiyPlan)
                .update({ id: Number(planId) }, { status: 'quoted', orderLineId: null });
        }
    }
}
```

`configuration` 钩子改为（追加 OrderLine customFields + 包装价格策略）：

```ts
    configuration: config => {
        config.authOptions.customPermissions.push(DiyRead, DiyCreate, DiyUpdate, DiyDelete);
        config.customFields.OrderLine.push(
            { name: 'diyPlanId', type: 'int', nullable: true },
            { name: 'diyUnitPrice', type: 'int', nullable: true },
            { name: 'diyBom', type: 'string', nullable: true },
            { name: 'diyQuoteRefAmount', type: 'int', nullable: true },
        );
        const original = config.orderOptions.orderItemPriceCalculationStrategy;
        config.orderOptions.orderItemPriceCalculationStrategy = new DiyOrderItemPriceCalculationStrategy(original);
        return config;
    },
```

（`type: 'string'` 存 JSON.stringify 后的 BOM——@vendure/common `CustomFieldType` 枚举无 'json' 项，这是可用类型中唯一可承载长 JSON 文本的。）

providers 数组追加 `DiyOrderService,`（`DiyStockService,` 之后）：

```ts
        DiyOrderService,
```

插件类改为注入 connection 并在 bootstrap 创建载体商品：

```ts
    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private seedRunner: DiySeedRunner,
        private connection: TransactionalConnection,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.seedRunner.run();
        await ensureCarrierProduct(this.connection);
        Logger.info('DiyPlugin initialized', loggerCtx);
    }
```

（类声明同步改为 `export class DiyPlugin implements OnApplicationBootstrap {`——Task 5 已是此形态，确认即可。）

`shopSchema` 常量字符串末尾追加：

```ts
    extend type Mutation {
        createOrderFromPlan(id: ID!): DiyPlan!
    }
```

- [ ] **Step 3: 核对 dev-config 插件顺序（价格策略包装的前提）**

打开 `packages/dev-server/dev-config.ts`：

- 若 `orderOptions.orderItemPriceCalculationStrategy` 在**顶层配置**直接设置（如 sales 策略）→ 满足（顶层先于插件 configuration 钩子合并，DiyPlugin 包装器捕获到的 original 即它）。
- 若由某插件（如 SalesPlugin）的 configuration 钩子设置 → `DiyPlugin.init(...)` 必须位于该插件**之后**（configuration 钩子按 plugins 数组顺序依次执行，后执行的才包得住先执行的）。顺序不符则调整 `DiyPlugin.init(...)` 位置。
- 两者皆无 → 也满足（包装器 original 为默认策略）。

改完在 plugins 数组 `DiyPlugin.init(...)` 行上方补一行注释：

```ts
        // 保持位于设置 orderItemPriceCalculationStrategy 的插件/配置之后（diy 价格包装器委托 original）
```

- [ ] **Step 4: admin 侧 diyPlans（service + schema + resolver）**

修改 `packages/diy-plugin/src/diy.service.ts`：

import 区追加：

```ts
import { FindOptionsWhere } from 'typeorm';

import { DiyPlan } from './entities/diy-plan.entity';
```

类末尾追加：

```ts
    /* ------------------------------ 方案 ------------------------------ */

    /** admin 方案列表（规格 §7 admin 面）；app 不传 = 全部租户端 */
    async findPlans(
        ctx: RequestContext,
        options: { app?: string; status?: string; skip?: number; take?: number } = {},
    ): Promise<{ items: DiyPlan[]; total: number }> {
        const repo = this.connection.getRepository(ctx, DiyPlan);
        const where: FindOptionsWhere<DiyPlan> = {};
        if (options.app !== undefined) {
            where.app = options.app;
        }
        if (options.status) {
            where.status = options.status as 'draft' | 'quoted' | 'ordered';
        }
        const [items, total] = await repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: options.skip ?? 0,
            take: options.take ?? 50,
        });
        return { items, total };
    }
```

修改 `packages/diy-plugin/src/diy-plugin.ts`，`adminSchema` 常量字符串末尾追加：

```ts
    type DiyPlan {
        id: ID!
        app: String!
        userId: Int
        templateId: Int!
        templateVersion: Int!
        status: String!
        spec: JSON
        bom: JSON
        calcVersion: String!
        quoteNo: String
        expiresAt: DateTime
        orderLineId: Int
        thumb: String
        shareImage: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyPlanList {
        items: [DiyPlan!]!
        total: Int!
    }
    extend type Query {
        diyPlans(app: String, status: String, skip: Int, take: Int): DiyPlanList!
    }
```

修改 `packages/diy-plugin/src/diy-admin.resolver.ts`：

import 区追加：

```ts
import { DiyPlan } from './entities/diy-plan.entity';
```

类末尾追加：

```ts
    @Query()
    @Allow(DiyRead)
    async diyPlans(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string,
        @Args('status', { nullable: true }) status?: string,
        @Args('skip', { nullable: true, defaultValue: 0 }) skip?: number,
        @Args('take', { nullable: true, defaultValue: 50 }) take?: number,
    ): Promise<{ items: DiyPlan[]; total: number }> {
        return this.service.findPlans(ctx, { app, status, skip, take });
    }
```

- [ ] **Step 5: shop resolver 追加 createOrderFromPlan**

修改 `packages/diy-plugin/src/diy-shop.resolver.ts`，类末尾追加：

```ts
    @Mutation()
    @Allow(Permission.Authenticated)
    async createOrderFromPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan> {
        return this.orderService.createOrderFromPlan(ctx, id);
    }
```

同时构造器追加注入与 import：

```ts
import { DiyOrderService } from './diy-order.service';

// 构造器改为：
    constructor(
        private service: DiyShopService,
        private orderService: DiyOrderService,
    ) {}
```

- [ ] **Step 6: 构建验证 + 迁移**

Run: `pnpm --filter @vendure/diy-plugin build`
Expected: 无错误。

```powershell
cd packages/dev-server
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts generate add_diy_order_custom_fields
node -r ts-node/register -r dotenv/config -r tsconfig-paths/register migration.ts run
cd D:\zhao\vendure
```

Expected: 生成迁移（order_line 表新增 4 个可空列），run 无错误。

- [ ] **Step 7: dev-server 冒烟**

```powershell
pnpm --filter dev-server dev:server
```

启动日志 Expected（在既有 seed 日志之后新增）：

```
[DiyPlugin] carrier product ensured
DiyPlugin initialized
```

另开终端验证 admin 面：

```powershell
$body = '{"query":"query { __type(name: \"Query\") { fields { name } } }"}'
Set-Content -Path "$env:TEMP\diy-admin-introspect.json" -Value $body -Encoding utf8 -NoNewline
curl.exe -s -X POST http://localhost:3000/admin-api -H "Content-Type: application/json" --data-binary "@$env:TEMP\diy-admin-introspect.json"
```

Expected: fields 包含 `diyPlans`，启动无 schema 冲突/迁移报错。行为正确性由 Task 18 e2e 全量验证。

- [ ] **Step 8: 停 server + 提交**

```powershell
git add packages/diy-plugin/src packages/dev-server/dev-config.ts packages/dev-server/migrations
git commit -m "feat(diy-plugin): add order chain from diy plan (custom order lines, carrier product, price override, cancel restock)"
```

---

## Task 18：e2e 全链路（quote→order→并发扣减→取消回补）

**Files:**
- Create: `packages/diy-plugin/e2e/diy.e2e-spec.ts`

背景：仿 points-mall-plugin e2e（sqljs 内存库 + @vendure/testing）。插件 onApplicationBootstrap 会在测试环境自动执行 seed（7 分类 + bracelet-classic 模板）与 ensureCarrierProduct，无需手工播种。算量断言值与 Task 11 bracelet-calculator.spec 同源：**155/comfortable/0.5 + 8mm 主珠 → 22 颗**；带隔片时 `count = mainQty + spacerQty`、`spacerQty = floor(count/(every+1))`。

- [ ] **Step 1: 写 e2e**

`packages/diy-plugin/e2e/diy.e2e-spec.ts`：

```ts
import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { DiyPlugin } from '../src/diy-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('DiyPlugin · DIY 商品（素材合并/方案/报价/下单/回补）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [DiyPlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let mainId = '';
    let spacerId = '';
    let planId = '';
    let planB = '';
    let planC = '';

    const params155 = { wristSize: 155, fit: 'comfortable', gap: 0.5 };

    /* ------------------------- helpers ------------------------- */

    async function adminStock(materialId: string): Promise<number> {
        const res = await adminClient.query(gql`
            query { diyMaterial(id: "${materialId}") { stock } }
        `) as any;
        return res.diyMaterial.stock as number;
    }

    async function shopPlan(id: string): Promise<any> {
        const res = await shopClient.query(gql`
            query { myDiyPlan(id: "${id}") { id status quoteNo orderLineId } }
        `) as any;
        return res.myDiyPlan;
    }

    async function createPlan(spec: object): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { createDiyPlan(templateCode: "bracelet-classic", spec: ${JSON.stringify(spec)}) { id status bom quoteNo expiresAt calcVersion } }
        `) as any;
        return res.createDiyPlan;
    }

    async function adminFindOrderWithPlan(planIds: string[]): Promise<any> {
        const res = await adminClient.query(gql`
            query { orders(options: { take: 20 }) { items { id state totalWithTax lines { id quantity linePriceWithTax customFields } } } }
        `) as any;
        return res.orders.items.find((o: any) =>
            o.lines.some((l: any) => planIds.includes(String(l.customFields?.diyPlanId))),
        );
    }

    async function waitFor(desc: string, probe: () => Promise<boolean>, tries = 20): Promise<void> {
        for (let i = 0; i < tries; i++) {
            if (await probe()) {
                return;
            }
            await new Promise(r => setTimeout(r, 250));
        }
        throw new Error(`condition not met: ${desc}`);
    }

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // bootstrap 已 seed 7 个平台分类 + bracelet-classic 模板 + 载体商品
        const cats = await adminClient.query(gql`
            query { diyCategories { id code } }
        `) as any;
        const agate = cats.diyCategories.find((c: any) => c.code === 'agate');
        const metal = cats.diyCategories.find((c: any) => c.code === 'metal');

        async function createMaterial(input: object): Promise<any> {
            const res = await adminClient.query(gql`
                mutation { createDiyMaterial(input: ${JSON.stringify(input)}) { id code stock enabled } }
            `) as any;
            return res.createDiyMaterial;
        }
        const main = await createMaterial({
            code: 'A-AGS-08-N',
            categoryId: Number(agate.id),
            name: { 'zh-CN': '猫眼玛瑙' },
            shape: 'round',
            diameter: 8,
            axialLength: 8,
            holeSize: 1,
            price: 100,
            stock: 100,
            enabled: true,
        });
        mainId = main.id;
        const spacer = await createMaterial({
            code: 'M-SSP-04-SV',
            categoryId: Number(metal.id),
            name: { 'zh-CN': '银色隔片' },
            shape: 'spacer',
            diameter: 4,
            axialLength: 1.5,
            holeSize: 1,
            price: 20,
            stock: 200,
            enabled: true,
        });
        spacerId = spacer.id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 模板与合并素材视图可见（两层合并 + 形状过滤）', async () => {
        const tpl = await shopClient.query(gql`
            query { diyShopTemplate(code: "bracelet-classic") { id code status calculatorKey } }
        `) as any;
        expect(tpl.diyShopTemplate.status).toBe('enabled');
        expect(tpl.diyShopTemplate.calculatorKey).toBe('bracelet');

        const all = await shopClient.query(gql`
            query { diyMaterials { items { id code stock enabled } total } }
        `) as any;
        expect(all.diyMaterials.total).toBe(2);

        const rounds = await shopClient.query(gql`
            query { diyMaterials(filter: { shapes: ["round"] }) { items { code } total } }
        `) as any;
        expect(rounds.diyMaterials.total).toBe(1);
        expect(rounds.diyMaterials.items[0].code).toBe('A-AGS-08-N');
    });

    it('2 createDiyPlan：服务端复算 22 颗，快照落库', async () => {
        const plan = await createPlan({
            slots: { main: { materialId: mainId } },
            params: params155,
        });
        planId = plan.id;
        expect(plan.status).toBe('draft');
        expect(plan.calcVersion).toBe('1.0.0');
        expect(plan.bom.totalCount).toBe(22);
        expect(plan.bom.totalAmount).toBe(22 * 100);
        expect(plan.quoteNo).toBeNull();

        const mine = await shopClient.query(gql`
            query { myDiyPlans { items { id status } total } }
        `) as any;
        expect(mine.myDiyPlans.total).toBe(1);
        expect(mine.myDiyPlans.items[0].id).toBe(planId);
    });

    it('3 quoteDiyPlan：报价单号 + 7 天有效期 + 实时价覆盖', async () => {
        const res = await shopClient.query(gql`
            mutation { quoteDiyPlan(id: "${planId}") { id status quoteNo expiresAt bom } }
        `) as any;
        const plan = res.quoteDiyPlan;
        expect(plan.status).toBe('quoted');
        expect(plan.quoteNo).toMatch(/^DIY-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
        expect(plan.bom.totalAmount).toBe(22 * 100);
        const expires = new Date(plan.expiresAt).getTime();
        const now = Date.now();
        expect(expires).toBeGreaterThan(now + 6.9 * 24 * 3600 * 1000);
        expect(expires).toBeLessThan(now + 7.1 * 24 * 3600 * 1000);
    });

    it('4 createOrderFromPlan：成交价 = 实时复算价，素材库存扣减', async () => {
        const res = await shopClient.query(gql`
            mutation { createOrderFromPlan(id: "${planId}") { id status orderLineId } }
        `) as any;
        expect(res.createOrderFromPlan.status).toBe('ordered');
        expect(res.createOrderFromPlan.orderLineId).toBeTruthy();

        const order = await adminFindOrderWithPlan([planId]);
        expect(order).toBeDefined();
        expect(order.state).toBe('Created');
        expect(order.totalWithTax).toBe(22 * 100);
        const line = order.lines.find((l: any) => String(l.customFields?.diyPlanId) === planId);
        expect(line.quantity).toBe(1);
        expect(line.linePriceWithTax).toBe(22 * 100);
        expect(line.customFields.diyQuoteRefAmount).toBe(22 * 100);
        expect(JSON.parse(line.customFields.diyBom).totalCount).toBe(22);

        expect(await adminStock(mainId)).toBe(100 - 22);
    });

    it('5 并发抢库存：恰好一单成功，缺口明细报错，失败方零残留', async () => {
        await adminClient.query(gql`
            mutation { updateDiyMaterial(input: { id: "${mainId}", stock: 25 }) { id stock } }
        `) as any;

        const spec = { slots: { main: { materialId: mainId } }, params: params155 };
        planB = (await createPlan(spec)).id;
        planC = (await createPlan(spec)).id;

        // 同一文档的顶层 mutation 字段按序执行：先者扣走 22（25→3），后者 WHERE stock >= 22 失败
        await expect(shopClient.query(gql`
            mutation {
                b: createOrderFromPlan(id: "${planB}") { id status }
                c: createOrderFromPlan(id: "${planC}") { id status }
            }
        `)).rejects.toThrow(/库存不足/);

        expect(await adminStock(mainId)).toBe(3);
        const ordered = [await shopPlan(planB), await shopPlan(planC)];
        expect(ordered.filter(p => p.status === 'ordered')).toHaveLength(1);
        expect(ordered.filter(p => p.status === 'quoted')).toHaveLength(1);
    });

    it('6 带隔片方案 BOM 聚合自洽（不变量断言）', async () => {
        const plan = await createPlan({
            slots: { main: { materialId: mainId }, spacer: { materialId: spacerId, every: 2 } },
            params: params155,
        });
        expect(plan.bom.items).toHaveLength(2);
        const mainRow = plan.bom.items.find((i: any) => i.code === 'A-AGS-08-N');
        const spacerRow = plan.bom.items.find((i: any) => i.code === 'M-SSP-04-SV');
        expect(spacerRow.qty).toBe(Math.floor(plan.bom.totalCount / 3));
        expect(mainRow.qty + spacerRow.qty).toBe(plan.bom.totalCount);
        expect(mainRow.subtotal + spacerRow.subtotal).toBe(plan.bom.totalAmount);
    });

    it('7 取消订单：库存回补 + 方案回退 quoted', async () => {
        // 找到用例 5 成单的那个订单并取消
        const planIds = [planB, planC];
        let orderId = '';
        await waitFor('ordered plan found in orders', async () => {
            const order = await adminFindOrderWithPlan(planIds);
            if (order) {
                orderId = order.id;
                return true;
            }
            return false;
        });
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Cancelled") { id state } }
        `) as any;

        const orderedPlanId = (await shopPlan(planB)).status === 'ordered' ? planB : planC;
        await waitFor('stock restored to 25', async () => (await adminStock(mainId)) === 25);
        await waitFor('plan back to quoted', async () => (await shopPlan(orderedPlanId)).status === 'quoted');
    });
});
```

- [ ] **Step 2: 运行**

Run: `pnpm --filter @vendure/diy-plugin e2e`
Expected: PASS（7 个用例）。首次运行若暴露链路接线问题（如 SDL/迁移/库存时序），按报错回改对应 Task 的实现代码后重跑；**不得为凑通过而修改用例的目标值**（22 颗/2200 分/库存数均为锁定值）。

- [ ] **Step 3: 提交**

```powershell
git add packages/diy-plugin/e2e
git commit -m "test(diy-plugin): add e2e for plan quote order chain with concurrent stock deduction"
```

---

## Task 19：收尾回归 + 推送

**Files:** 无新增（回归验证 + 推送）。

- [ ] **Step 1: 构建两包**

```powershell
pnpm --filter @diy/calc build
pnpm --filter @vendure/diy-plugin build
```
Expected: 均无错误，产物在各自 `lib/`（vendure-prod 树部署时引用，本期不同步）。

- [ ] **Step 2: 全量单测回归**

```powershell
pnpm vitest run packages/diy-calc packages/diy-plugin
```
Expected: 全部 PASS（prng/sum/bracelet/bracelet-calculator/layout + localize/material-merge/template-config/calc-bridge/quote-utils）。

- [ ] **Step 3: e2e 回归**

```powershell
pnpm --filter @vendure/diy-plugin e2e
```
Expected: PASS（7 用例）。

- [ ] **Step 4: 推送**

```powershell
git log --oneline -20
git push
```
Expected: 本期提交序列完整（Task 1–18 每任务一条），push 成功。（文档仓 vendure-prod 的计划/规格另行提交，源码仓此处只推代码。）

（P4 验收：quote→order e2e 全链路通过；并发扣减恰好一单成功；取消回补库存与方案状态正确；dev-server 冒烟无报错。）

---

## 执行说明

- **Subagent-Driven（推荐）**：按 superpowers:subagent-driven-development，每个 Task 派发独立 subagent 实现，主会话逐 Task 对照本计划代码块审查，快速迭代。
- **Inline Execution**：按 superpowers:executing-plans 在本会话内按 Task 批次执行，检查点暂停审查。
- 无论哪种方式：**严格按 Task 顺序执行**（calc-bridge 依赖 Task 7/9 纯函数与 Task 10/11 计算器；下单链依赖 Task 14/15/16）；每个 Task 结束先跑该 Task 的验证命令确认通过，再按给出的 git 命令提交。

---

