# DIY 商品功能 · 后端数据模型设计（diy-plugin）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0（设计已评审通过） |
| 创建日期 | 2026-10-11 |
| 落地位置 | `packages/diy-plugin`（vendure-prod，参照 shop-template-plugin 编码风格） |
| 关联文档 | `D:\zhao\bead-diy\docs\DIY串珠手串小程序设计文档.md`（C 端领域模型与算量公式出处） |
| 本期范围 | 后端 P1–P4（素材库 / 玩法模板 / 方案与交易链路）；C 端对接（P5）另起任务 |
| 首发玩法 | 手串（bracelet 计算器）；汽车模型作为通用性验证延后 |

---

## 1. 背景与目标

DIY 商品 = 用户在 C 端「选素材 + 定参数 + 实时看效果」后成单的商品形态。两类典型：

- **手串**：手围 + 珠子直径 → 算颗数，选材质/隔片/排布，Canvas 实时渲染成品
- **汽车模型（延后）**：底盘型号 → 可用配件清单，选配件/颜色，数量联动（1 底盘 : 4 轮毂）

要解决的三件事（沿用 bead-diy 文档）：**不知道买多少颗、不知道搭配效果、不知道总价**。本设计让这三件事在 Vendure 后端有统一的、可扩展的数据底座，C 端（bead-diy 小程序 RemoteRepository / 其他端）单独书写。

### 验收口径

- P3 算量单测通过 bead-diy 文档 §7.4 经验表 6 组断言（手围×直径 → 颗数）
- P4 含库存并发扣减测试 + quote→order 全链路 e2e
- 素材合并视图、多语言回退、价格快照语义各有单测

---

## 2. 关键决策记录

| # | 决策点 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | 交易模式 | **A 为基座（搭配结果直接下单）+ 叠加 B（演示 + 报价单）** | DIY 本身即商品；BOM 快照天生就是订单明细；报价单服务意向客户 |
| D2 | 素材库层级 | **两层：平台基础库（app=null）+ 租户库（app=X），单表单列区分** | 与 shop-template-plugin 多租户模式同哲学；合并/覆盖逻辑最简 |
| D3 | 与 Product 关系 | **完全自建实体，与 Product/ProductVariant 零耦合** | 素材按颗/按件计量，与常规商品差异大；避免隐形 Variant 污染商品列表；将来单卖素材走普通商品即可。升级路径无损（加可空 productId 列） |
| D4 | 算量位置 | **双端同构纯函数包 `@diy/calc`**：C 端实时演示 + 后端下单复算（服务端为唯一价格权威） | bead-diy 算量本就是零副作用纯函数；纯前端算有价格篡改风险，纯后端算演示体验差 |
| D5 | 玩法建模 | **通用骨架（slots + params + constraints，纯配置）+ 可插拔计算器（calculatorKey）** | 选择型玩法零代码配置；算量型玩法有干净扩展点；复杂度控制在「需要时才写计算器」 |
| D6 | 首发范围 | 手串先行，汽车模型延后 | 数据模型已按通用骨架设计，延后不改模型 |

---

## 3. 总体架构

```
 C 端应用          共享算量包            管理后台
 (小程序/H5)      @diy/calc 纯函数      (admin-api)
     │  shop-api   │       ↑ 下单复算        │ admin-api 配置
     ▼              └──────┐                ▼
┌──────────────── diy-plugin（Vendure 后端插件）────────────────┐
│                                                              │
│  ┌─ 两层素材库 ────────────┐    ┌──────────────────────────┐ │
│  │ 平台素材库 app=null      │───▶│ DiyTemplate 玩法模板      │ │
│  │        │ 引用/复制       │    │ config=slots+params+     │ │
│  │ 租户素材层 覆盖价/私有    │    │ constraints+presentation │ │
│  └─────────────────────────┘    │ calculatorKey 引用计算器  │ │
│                                 └────────────┬─────────────┘ │
│  ┌──────────────────────────┐                │ 实例化         │
│  │ DiyPlan 搭配方案          │◀───────────────┘               │
│  │ spec + BOM 快照           │   ┌──────────────────────┐   │
│  │ 演示/报价/下单 三态        │──▶│ Vendure 订单体系       │   │
│  └──────────────────────────┘   │ 自定义订单行 × BOM     │   │
│                                 └──────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

要点：

1. diy-plugin 与 Product 零耦合；DIY 成品走 Vendure 原生 Order 的**自定义订单行**（挂 planId + BOM 快照），支付/发货复用原生流程
2. DiyPlan 是「演示 / 报价 / 下单」三态统一载体，报价能力不另建实体
3. `@diy/calc` 不属于后端——独立 TS 纯函数包，后端仅在创建订单/报价时引用复算

---

## 4. 素材库数据模型

平台库与租户库**共用一张表**，`app` 列区分层级（与 shop-template-plugin 多租户模式一致）。

### 4.1 DiyCategory（分类，单表两层）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| app | varchar, nullable | null=平台分类；非空=租户自建分类 |
| parentId | FK, nullable | 树形结构 |
| name | jsonb | LocalizedText `{zh-CN, en-US}` |
| image / sortOrder / enabled | varchar / int / bool | |

### 4.2 DiyMaterial（素材）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | 内部稳定 ID，不随改名变化 |
| `app` | varchar, **nullable** | null=平台库（全租户共享，货权在平台）；非空=租户库。层级唯一开关 |
| code | varchar(64) | 货号（见 4.4）；唯一键 `(app, code)` |
| name | jsonb | LocalizedText，逐级回退（见 §8.1） |
| categoryId | FK → DiyCategory | |
| shape | varchar | 通用形状：`round / barrel / drum / faceted / spacer / cube / custom` |
| `diameter` | decimal(mm), nullable | 径向直径——渲染与筛选用 |
| `axialLength` | decimal(mm), nullable | 轴向长度——**算量用它**（隔片/桶珠远小于直径） |
| `holeSize` | decimal(mm), nullable | 孔径——配线校验用 |
| attrs | jsonb | 行业扩展属性（卡口型号、比例、色号、纹理种子…），计算器按约定 key 读取 |
| render | jsonb | C 端演示渲染参数（即 bead-diy `RenderSpec`：baseColor/gloss/textureType 等） |
| price | int | **分**（整数存储，展示层 /100） |
| priceUnit | enum | `piece / gram / meter / cm`…定义「数量」的语义；连续量按最小整数单位存 |
| currency | char(3) | 默认 CNY |
| stock | int | 按 priceUnit 计的整数库存 |
| images | jsonb | 图片 URL 数组（走静态目录，见 §8.2） |
| sourceMaterialId | FK, nullable | 复制平台素材时的回链 |
| enabled / sortOrder | bool / int | 租户对复制素材 `enabled=false` = 屏蔽该平台素材 |
| createdAt / updatedAt | timestamptz | |

> 三个物理尺寸字段**提升为列**（nullable）而非塞进 attrs：它们是算量器的类型安全输入，且跨行业通用（汽车配件同样有直径/长度概念）。其余行业属性全部进 `attrs` JSON。

### 4.3 两层合并逻辑（shop-api 素材查询）

```
查询 app=X 的素材：
  result = 平台素材(app=null, enabled)
          ∪ 租户素材(app=X, enabled)
  去重：同一 code 若租户存在复制行（sourceMaterialId 指向平台行），
       则以租户行为准（完全接管价/库存），平台行不再出现
```

分类查询同样合并：平台分类（app=null）全局可见，租户自建分类（app=X）仅本租户可见（分类无覆盖关系，只做并集）。

- **库存归属**：引用平台素材（未复制）下单 → 扣**平台库存**（货权在平台）；租户复制素材下单 → 扣租户库存。对应「平台供货 vs 租户自供货」
- 租户复制后改价改库存 = 完全接管；不复制 = 直接消费平台行的价与库存
- 合并查询实现为可复用的服务方法/QueryBuilder，纯函数化的合并规则单测覆盖

### 4.4 货号规则（沿用 bead-diy §3.4）

```
{大类码}-{材质码}-{直径两位补零}-{花色/工艺码}
例：A-AGS-08-N（玛瑙-玉髓猫眼-8mm-素面）、M-SSP-06-SV（金属-圆隔片-6mm-银色）
```

- 货号只由类目与规格决定，不含价格/批次；改价不改号；同一货号永远同一外观
- 大类码按行业扩充（汽车配件行业码另行定义）；唯一键为 `(app, code)`

### 4.5 内嵌决策

1. **价格快照在 DiyPlan**：素材改价不影响已生成的方案/订单（与 bead-diy WorkRecord 同哲学）
2. 物理尺寸三字段提升为列（见 4.2 注）
3. 素材图片走静态目录而非 uploads；URL 基于访问域名动态 origin

---

## 5. DiyTemplate 玩法模板

一张模板 = 一类 DIY 玩法的完整定义。C 端拿到模板 JSON 即可渲染整个设计器，无需为每个玩法写后端。

### 5.1 字段表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id / code | uuid / slug | code 如 `bracelet-classic`；唯一键 `(app, code)` |
| app | varchar, nullable | null=平台模板库；租户可复制改配置（同素材库哲学） |
| name / description | jsonb | LocalizedText |
| thumb / images | jsonb | 模板封面 |
| `config` | jsonb | **核心**：slots + params + constraints + presentation（见 5.2） |
| `calculatorKey` | varchar, nullable | null → 自动用内置 `sum`；`bracelet` → 手串算量；新玩法注册新 key |
| status | enum | `draft / enabled / disabled` |
| version | int | 每次发布（draft→enabled）+1；仅用于「再编辑」提示，不参与复算 |
| sortOrder | int | |

### 5.2 config JSON 结构（约定即接口）

```jsonc
{
  "slots": [{
    "key": "mainBeads",
    "name": { "zh-CN": "主珠", "en-US": "Main beads" },   // LocalizedText
    "role": "main",              // main / secondary / spacer / focal / decor —— C 端渲染分层
    "required": true,
    "quantityMode": "calculated",// calculated=计算器算 | fixed | user
    "quantity": 1,               // fixed 时
    "quantityRange": [8, 120],   // user 时
    "filter": {                  // 可选素材范围（SQL 可表达的过滤）
      "categoryCodes": ["crystal", "agate", "wood", "amber", "pearl", "gemstone"],
      "shapes": ["round", "barrel"],
      "diameterRange": [4, 16]
    },
    "defaultMaterialId": "…"
  }],
  "params": [{                   // 算量输入声明：C 端渲染表单 + 计算器消费同一声明
    "key": "wristSize", "type": "number", "unit": "mm",
    "min": 120, "max": 220, "default": 155, "ui": "slider+input"
  }, {
    "key": "fit", "type": "enum",
    "options": ["tight", "comfort", "loose"], "default": "comfort"
  }, {
    "key": "gap", "type": "number", "unit": "mm",
    "min": 0.3, "max": 0.8, "default": 0.5, "advanced": true
  }],
  "constraints": [               // 只内置 4 种通用约束（见 5.4）
    { "type": "mutuallyExclusive", "slots": ["mainBeads", "focal"] },
    { "type": "quantityLink", "a": "wheels", "b": "chassis", "ratio": 4 }
  ],
  "presentation": {              // 积木式：C 端按声明拼装设计器
    "renderer": "bracelet-2d",   // C 端渲染器组件 key
    "blocks": ["wristInput", "materialPicker", "canvas", "bomList"]
  }
}
```

config 解析规则：**SSR/服务端友好的纯函数**，坏 JSON / 缺关键字段返回 null 并逐级退回默认（与 detail-config 同一套防御哲学）。

### 5.3 计算器机制

- 计算器 = 纯函数 `(params, slots 选择, 素材数据) → CalcResult + BOM`，注册在 `@diy/calc` 的 registry：`{ [calculatorKey]: fn }`
- **内置 `sum`（兜底）**：BOM = Σ 槽位素材 × 数量。选择型玩法（汽车模型）零代码即用
- **`bracelet`（首发）**：从 bead-diy 文档 §7 移植——手围/直径/轴向长度/间隙 → 颗数（含内径修正项 π·d）、回算校验、松紧反馈、配线建议；焦点珠/隔片二次收敛（§7.3）
- 复算**不依赖模板**：DiyPlan 存完整 spec + BOM 快照，下单复算 = 素材实时价 × spec 数量；模板改版不影响存量方案。素材被删/禁用 → 下单校验失败报「素材已下架」

### 5.4 内置约束类型（仅 4 种，行业特殊校验归计算器内部）

| type | 语义 |
| --- | --- |
| `mutuallyExclusive` | 槽位互斥（如主珠排布 vs 焦点珠） |
| `dependency` | 槽位启用依赖（如选隔片必须已选主珠） |
| `requiredWith` | 联动必填 |
| `quantityLink` | 数量联动（`a = b × ratio`，如 1 底盘 : 4 轮毂） |

---

## 6. DiyPlan 与交易链路

### 6.1 字段表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | |
| app | varchar | 归属租户 |
| userId | int, nullable | **游客可匿名演示**；保存/报价/下单时要求登录 |
| templateId / templateVersion | FK / int | 来源模板（version 仅再编辑提示） |
| status | enum | `draft`（演示稿）→ `quoted`（报价单）→ `ordered`（已落单） |
| `spec` | jsonb | 搭配参数快照：`{ slots: {slotKey: materialId}, qtyOverride?, params: {wristSize, fit, gap…}, seed }` |
| `bom` | jsonb | **BOM 快照**：按货号聚合 `[{materialId, code, name, spec, unitPrice, qty, subtotal}]` + totalAmount + 几何结论（内径/松紧/配线建议） |
| thumb / shareImage | varchar | C 端 canvas 导出成品图，上传走静态目录 |
| calcVersion | varchar | `@diy/calc` 版本号，算量公式升级时追踪存量方案 |
| quoteNo / expiresAt | varchar / timestamptz | quoted 态生成报价单号 + 有效期（默认 7 天） |
| orderLineId | FK, nullable | 落单后回链 Vendure 订单行 |
| createdAt / updatedAt | timestamptz | |

### 6.2 三条链路

1. **演示（零服务端）**：C 端全程 `@diy/calc` 本地算 + 本地渲染，匿名可玩；仅保存/分享/报价时 `createDiyPlan` 落 draft
2. **报价**：`quoteDiyPlan(planId)` → 服务端 `@diy/calc` 复算 BOM（**以服务端素材实时价为权威**）→ status=quoted + quoteNo + expiresAt → 生成分享链接/海报
3. **下单**：`createOrderFromPlan(planId)` →
   ① 服务端复算 BOM（防篡改）→ ② 校验素材 enabled + 库存 → ③ 按货号聚合原子扣库存 → ④ 创建 Vendure Order **自定义订单行**（customFields 挂 planId + BOM 快照，行价 = 复算 totalAmount）→ ⑤ status=ordered → 原生支付/发货

### 6.3 一致性规则

1. 报价单是意向参考，**下单永远以服务端复算价成交**；复算价 ≠ 报价价时订单行同时记录两价（成交价 + 报价参考价），不做价格确认弹层（YAGNI）
2. 报价过期（expiresAt）后仍可下单，按复算价成交
3. 库存不足：下单失败并返回缺口明细（货号 × 需求 vs 现存）

### 6.4 库存扣减

- 按 BOM 聚合后逐货号原子扣减（如 `A-AGS-08-N × 21`），复用 redis-stock-plugin 的扣减模式（Redis 原子操作 + 回补）
- 扣减归属：平台素材扣平台 stock；租户素材扣租户 stock（见 4.3）

---

## 7. GraphQL API 面

| 端 | 操作 | 说明 |
| --- | --- | --- |
| admin-api | `diyCategory` / `diyMaterial` / `diyTemplate` CRUD | 管理后台配置素材库与玩法模板；模板发布 version+1 |
| admin-api | `diyMaterialsImport(input)` | 批量导入（JSON/CSV），首批珠子库 40+ 条 |
| admin-api | `diyPlans(filter, paging)` | 运营查看方案/报价转化数据 |
| shop-api | `diyCategories(app)` / `diyMaterials(app, filter)` | **合并视图**；filter：category / shape / diameterRange / keyword |
| shop-api | `diyTemplate(app, code)` | 返回完整 config，C 端据此渲染设计器 |
| shop-api | `createDiyPlan(spec)` / `quoteDiyPlan(planId)` / `myDiyPlans` | draft 落库 / 复算报价 / 我的作品 |
| shop-api | `createOrderFromPlan(planId)` | 复算 → 扣库存 → 自定义订单行 → 原生支付 |

鉴权：shop-api 写操作（createDiyPlan 保存、quote、createOrder）要求登录（复用现有 auth 体系）；查询类开放。

---

## 8. 横切规范

### 8.1 多语言

- 实体 name/description、模板 config 内槽位名一律 jsonb **LocalizedText**（`string | Record<locale, string>`）
- 回退链：当前 locale → defaultLocale → 首个值 → 内建占位（`localizeText()` 纯函数）
- shop-api 按 `Accept-Language`（或 `languageCode` 参数）解析后返回；注意前端 locale 与 Vendure `LanguageCode` 枚举映射（如 `zh-CN → zh_Hans`）在客户端完成，后端不做映射

### 8.2 静态资源

- 素材图/成品图走**静态目录**（不用 uploads 目录，禁止直接访问 uploads）
- URL 基于当前访问域名**动态 origin**，禁止硬编码域名
- 上传通道复用现有 oss-plugin 能力

### 8.3 单位铁律

金额一律**分**（整数），长度一律 **mm**（整数或 1 位小数）；连续计量（米/克）按最小整数单位存储（厘米/克）。UI 层负责换算展示。

### 8.4 `@diy/calc` 共享算量包

- 纯函数（calc / layout / types / prng / color），**禁止 import Taro / React / Vendure / IO**
- 交付形态：vendure 仓库内 package（monorepo 工作区引用），C 端以 npm 私有包或源码拷贝引入（P5 定）
- 版本号语义化，写入 DiyPlan.calcVersion

---

## 9. 实施切分

| 阶段 | 交付物 | 验收 |
| --- | --- | --- |
| P1 插件骨架 | diy-plugin 包骨架；DiyCategory/DiyMaterial/DiyTemplate 实体 + 迁移；admin-api CRUD | 迁移可跑；后台可配素材/分类/模板 |
| P2 查询面 | shop-api 合并视图 + 模板查询 + 多语言解析 | 合并/去重/回退单测 |
| P3 算量包 | `@diy/calc`（bracelet 计算器 + types）+ 手串模板种子数据 | §7.4 经验表 6 组断言全过；layout 确定性快照 |
| P4 三链路 | DiyPlan 实体 + draft/quote/order 链路 + 库存原子扣减 + 自定义订单行 | quote→order e2e；并发扣减测试 |
| P5 C 端对接（另起任务） | bead-diy RemoteRepository → shop-api；mapper DTO → BeadMaterial | C 端设计器全流程走真实后端 |

汽车模型延后：届时仅新增「模板配置数据 + `sum` 计算器（已内置）」，验证零代码扩展。

---

## 10. 风险与待确认

| # | 风险/待确认 | 影响 | 应对 |
| --- | --- | --- | --- |
| R1 | bead-diy C 端目前为 mock 数据，字段与后端 DTO 有出入 | P5 对接返工 | C 端 mapper.ts 集中转换（文档已预留）；DTO 即本设计的 API 契约 |
| R2 | 模板 config JSON 演进（加字段）导致旧模板不可用 | 存量方案异常 | config 解析纯函数 + 缺字段回退默认；version 提示再编辑 |
| R3 | 按颗扣库存的并发热点（爆款素材） | 超卖/少卖 | redis-stock-plugin 模式原子扣减 + 回补；P4 并发测试 |
| R4 | 自定义订单行与现有订单流程（退款/发票/报表）兼容性 | 下游功能异常 | P4 e2e 覆盖 quote→order→payment 全链路；订单行 customFields 结构在实施计划中细化 |
| Q1 | `@diy/calc` 分发方式（monorepo package vs 私有 npm vs 源码拷贝） | P5 接入方式 | P3 时定，默认 monorepo package + C 端源码拷贝（Taro 无 monorepo 依赖时） |

---

## 附录 A · 与 bead-diy 领域模型的映射

| bead-diy（C 端 TS 接口） | 本设计（Vendure 实体/字段） | 说明 |
| --- | --- | --- |
| `BeadMaterial` | `DiyMaterial` | materialId→id、code→code、category→categoryId、diameter/axialLength/holeSize 同名提升为列、tags→attrs.tags、price/currency 同名（单位分一致） |
| `RenderSpec` | `DiyMaterial.render` (jsonb) | 结构原样迁移，painter 类型即 textureType |
| `BeadRepository.listMaterials(filter)` | shop-api `diyMaterials(filter)` | RemoteRepository + mapper.ts 转换 |
| `BraceletSpec` | `DiyPlan.spec` + 模板 params | spec 快照进方案；参数声明进模板 config.params |
| `BraceletBOM` / `BomItem` | `DiyPlan.bom` (jsonb) | 结构一致；服务端为价格权威 |
| `WorkRecord` | `DiyPlan`（draft 态） | 本地存档 → 云端方案，thumb 上传静态目录 |
| `CalcResult` | `@diy/calc` 返回值 | 纯函数双端共用；§7.4 经验表为单测断言 |
