# 中国化多租户测试数据填充设计

- **日期**: 2026-07-14
- **项目**: vendure (dev-server)
- **作者**: brainstorming session
- **状态**: 待实现

## 1. 背景与目标

### 1.1 背景

Vendure dev-server 现有的填充脚本 [populate-dev-server.ts](file:///e:/code/vendure/packages/dev-server/populate-dev-server.ts) 使用 [initial-data.ts](file:///e:/code/vendure/packages/core/mock-data/data-sources/initial-data.ts) 填充英文/欧洲导向的数据（Electronics/Home & Garden 类目、USD 货币、Standard/Express Shipping、dummy Payment）。

项目已通过 cjk-plugin 启用中国化多租户能力（tenant / cod / storePickup / pickupPoint / promotionPolicy 模块），但缺少配套的中文测试数据，无法端到端验证 VShop 切换租户后的完整下单流程。

### 1.2 目标

新增独立填充脚本，生成符合中国电商习惯的测试数据，覆盖：

- 多租户 Channel（default + shop-a 生鲜店）
- 中国化商品类目与定价（CNY）
- 中国习惯的支付方式（测试支付/货到付款/余额支付）
- 中国习惯的物流方式（门店自提/菜鸟驿站自提点/满99包邮/顺丰标准快递）
- 优惠券叠加策略验证（shop-a 启用 couponStackable）
- 测试客户 + 充值卡余额账户
- 历史订单（多状态覆盖）

### 1.3 非目标

- 不修改 [initial-data.ts](file:///e:/code/vendure/packages/core/mock-data/data-sources/initial-data.ts) 与 products.csv（避免污染 vendure 原生 e2e 测试数据）
- 不创建 wechatpay/alipay 支付方式（环境变量未配置，避免脚本失败）
- 不填充 200+ 国家数据（精简为仅中国）
- 不做幂等性判断（每次清库后从零填充）

## 2. 实现方案

### 2.1 方案选择

**选定方案：纯 Service 调用 + 全量清库（方案 A）**

新增独立脚本 `populate-china-dev.ts`，`clearAllTables` 后 `bootstrap`，顺序调用各 Service 创建实体。

**理由**：
- 完全可控，可在创建时直接设置 cjk-plugin 自定义字段
- 不依赖 products.csv 格式，商品数据内联在 TS 数据源中
- 与 vendure fork 解耦，不污染原 mock-data，e2e 测试不受影响
- 单次执行完成所有数据创建，无需服务运行中

**否决方案**：
- 方案 B（populate + Service 补充）：需修改 initial-data.ts 和写中文 products.csv，且 populate 不支持多 Channel 创建与商品分配
- 方案 C（GraphQL Admin API）：需服务运行、认证复杂、大数量级慢

### 2.2 文件结构

```
packages/dev-server/
├── populate-china-dev.ts          # 入口：编排各阶段
└── china-data/
    ├── index.ts                   # 导出各阶段函数
    ├── 01-base.ts                 # Zone/Country/TaxRate/Facet/Collection
    ├── 02-default-channel.ts      # default Channel 商品/配送/支付/自提点
    ├── 03-shop-a-channel.ts       # shop-a 创建+配置+商品分配
    ├── 04-promotions.ts           # 优惠券 + couponStackable
    ├── 05-customers.ts            # 客户 + 充值卡余额
    ├── 06-orders.ts               # 历史订单
    └── sources/
        ├── products.ts            # 商品/变体/类目数据源
        ├── shipping.ts            # 配送方式数据源
        ├── payments.ts            # 支付方式数据源
        ├── pickup-locations.ts    # 自提点数据源
        ├── customers.ts           # 客户数据源
        └── promotions.ts          # 优惠券数据源
```

### 2.3 npm script

在 [packages/dev-server/package.json](file:///e:/code/vendure/packages/dev-server/package.json) 添加：

```json
{
  "scripts": {
    "populate:china": "ts-node populate-china-dev.ts"
  }
}
```

### 2.4 执行流程

```
clearAllTables (清库)
  → bootstrap(devConfig) + JobQueueService.start()
  → 阶段1: 基础设置 (superadmin 用户 / Zone / Country / TaxRate / Facet / Collection)
  → 阶段2: default Channel 中国化 (商品+图片 / 配送 / 支付 / 自提点)
  → 阶段3: 创建 shop-a Channel (生鲜租户)
  → 阶段4: shop-a 配置 (配送 / 支付 / 自提点 / 商品分配 / 价格)
  → 阶段5: 优惠券 + 测试客户(含地址) + 余额账户
  → 阶段6: 历史订单 (default + shop-a)
  → 验收验证 (查询确认)
  → app.close() + exit(0)
```

## 3. 数据内容详细规格

### 3.1 Channel 配置

| Channel | code | token | 货币 | 语言 | couponStackable | maxStackableCount | defaultShippingZone | defaultTaxZone |
|---------|------|-------|------|------|-----------------|-------------------|---------------------|----------------|
| default | `__default__` | `__default__` (保留) | CNY | zh_Hans | false | null | Asia | Asia |
| 生鲜店 | `shop-a` | `shop-a-token` | CNY | zh_Hans | true | 3 | Asia | Asia |

default Channel 的默认货币/语言通过 `ChannelService.update` 改为 CNY + zh_Hans（原为 USD/en），同时设置 defaultShippingZone/defaultTaxZone 为 Asia。

### 3.1.1 Admin 用户

clearAllTables 后无 superadmin，需在阶段1创建：

| 用户 | identifier | password | role |
|------|-----------|----------|------|
| 超级管理员 | `superadmin@china.test` | `superadmin` | SuperAdmin (Vendure 内置) |

通过 `UserService.createAdminUser` 创建。

### 3.2 Zone / Country / TaxRate

- **Zone**: `Asia`
- **Country**: 仅 `China (CN)` 归入 Asia Zone（精简，避免 200+ 国家）
- **TaxRate**:
  - `普通税率 13%`（Standard Tax，适用大多数商品）
  - `优惠税率 9%`（Reduced Tax，图书/农产品等）
  - `零税率 0%`（Zero Tax，出口/免税商品）

### 3.3 Facet / FacetValue

| Facet | FacetValues |
|-------|-------------|
| 类目 | 食品生鲜, 数码电器 |
| 品牌 | 农夫山泉, 三只松鼠, 小米, 华为 |
| 规格 | 500ml, 1kg, 标准版, Pro版 |

### 3.4 Collection（商品集合）

default Channel:
```
食品生鲜
数码电器
```

通过 facet-value-filter 关联对应 FacetValue。

### 3.5 商品清单（共 8 SPU / 9 SKU）

**食品生鲜类（4 SPU）:**

| 商品名 | 品牌 | 变体 | 价格(元) | 库存 | 图片资源(复用 mock-data/assets) |
|--------|------|------|---------|------|------|
| 农夫山泉天然水 | 农夫山泉 | 500ml | 2 | 1000 | nathan-fertig-249917-unsplash.jpg |
| 三只松鼠坚果礼盒 | 三只松鼠 | 1kg | 99 | 200 | neonbrand-428982-unsplash.jpg |
| 五常稻花香大米 | 农夫山泉 | 5kg | 49 | 300 | nathan-fertig-249917-unsplash.jpg |
| 内蒙古牛肉卷 | 三只松鼠 | 500g | 59 | 150 | brandi-redd-104140-unsplash.jpg |

**数码电器类（4 SPU）:**

| 商品名 | 品牌 | 变体 | 价格(元) | 库存 | 图片资源 |
|--------|------|------|---------|------|---------|
| 小米手环8 | 小米 | 标准版 | 199 | 100 | chuttersnap-324234-unsplash.jpg |
| 小米手环8 | 小米 | Pro版 | 299 | 80 | chuttersnap-324234-unsplash.jpg |
| 华为路由器 | 华为 | 标准版 | 159 | 120 | alexandru-acea-686569-unsplash.jpg |
| 小米充电宝 | 小米 | 10000mAh | 99 | 200 | chuttersnap-584518-unsplash.jpg |
| 华为蓝牙耳机 | 华为 | 标准版 | 399 | 60 | chuttersnap-584518-unsplash.jpg |

> 图片通过 `AssetService.create` 导入，复用 [packages/core/mock-data/assets/](file:///e:/code/vendure/packages/core/mock-data/assets) 中现有文件路径，避免下载。
> 商品变体的 `taxCategoryId` 默认关联"普通税率 13%"（Standard Tax）。

### 3.6 shop-a Channel 商品分配

- 全部 8 个 SPU 分配到 shop-a（含数码类，便于跨类目凑单验证满99包邮）
- 价格差异化：shop-a 上五常大米便宜 5 元（44 元），其余同 default

### 3.7 配送方式（default Channel）

| 名称 | code | checker | calculator | 参数 |
|------|------|---------|-----------|------|
| 门店自提 | `store-pickup` | `store-pickup-eligibility` | `store-pickup-calculator` | 免费 |
| 菜鸟驿站自提 | `pickup-point` | `pickup-point-eligibility` | `pickup-point-calculator` | 3元 (300 单位) |
| 满99包邮 | `free-shipping-99` | `order-total` (min=9900) | `shipping-by-price` (rate=0) | 满99免运费 |
| 顺丰标准快递 | `sf-express` | `order-total` (min=0) | `shipping-by-price` (rate=1200) | 12元 |

> Vendure 价格内部以最小单位存储，CNY 1元 = 100 单位。

### 3.8 配送方式（shop-a Channel）

精简为 2 个：

| 名称 | code | checker | calculator |
|------|------|---------|-----------|
| 门店自提 | `store-pickup` | `store-pickup-eligibility` | `store-pickup-calculator` |
| 满99包邮 | `free-shipping-99` | `order-total` (min=9900) | `shipping-by-price` (rate=0) |

### 3.9 支付方式

| 名称 | code | handler | enabled | Channel |
|------|------|---------|---------|---------|
| 测试支付 | `dummy-payment` | `dummy-payment-handler` | true | default + shop-a |
| 货到付款 | `cash-on-delivery` | `cash-on-delivery` | true | default + shop-a |
| 余额支付 | `balance-pay` | `balance-pay` | true | default + shop-a |

> 不创建 wechatpay/alipay（环境变量未配，避免脚本失败）。

### 3.10 自提点 PickupLocation

**default Channel:**

| name | type | address | phoneNumber | businessHours |
|------|------|---------|-------------|---------------|
| 中关村门店 | store | 北京市海淀区中关村大街1号 | 010-12345678 | 09:00-22:00 |
| 望京SOHO店 | store | 北京市朝阳区望京街10号 | 010-87654321 | 09:00-21:00 |
| 菜鸟驿站(五道口店) | point | 北京市海淀区成府路28号 | 010-66668888 | 08:00-22:00 |

**shop-a Channel:**

| name | type | address | businessHours |
|------|------|---------|---------------|
| 生鲜自提点(国贸店) | store | 北京市朝阳区建国门外大街1号 | 07:00-21:00 |

### 3.11 优惠券（Promotion）

**default Channel（不叠加）:**

| 名称 | code | condition | action | 优惠 |
|------|------|-----------|--------|------|
| 满100减10 | `SAVE10` | `order-total` (min=10000) | `order-fixed-discount` (amount=1000) | 满100减10元 |

**shop-a Channel（couponStackable=true）:**

| 名称 | code | condition | action | 优惠 | stackable | stackableGroup | maxStackableWith |
|------|------|-----------|--------|------|-----------|----------------|------------------|
| 新人9折 | `NEW90` | `order-total` (min=0) | `order-percentage-discount` (discount=10) | 9折 | true | null | null |
| 满50减5 | `SAVE5` | `order-total` (min=5000) | `order-fixed-discount` (amount=500) | 满50减5元 | true | null | null |

> Promotion 是 Channel-aware 实体，shop-a 的优惠券需在 shop-a Channel ctx 下创建。

### 3.12 客户与余额

| 姓名 | 手机号 | 邮箱 | Channel | 充值余额 | 地址 |
|------|--------|------|---------|---------|------|
| 张三 | 13800138001 | zhangsan@test.cn | default | 0 | 北京市海淀区中关村大街1号 |
| 李四 | 13800138002 | lisi@test.cn | default | 500 元 | 北京市朝阳区望京街10号 |
| 王五 | 13800138003 | wangwu@test.cn | shop-a | 200 元 | 北京市朝阳区建国门外大街1号 |

> 每个客户创建时绑定 1 个地址（用于历史订单 shippingAddress）。
> 余额通过 RechargeCardPlugin 的服务或直接操作 `recharge_card_balance` 表写入。

### 3.13 历史订单（共 8 笔）

**default Channel:**

| 订单 | 客户 | 商品 | 状态 | 配送 | 支付 |
|------|------|------|------|------|------|
| #1001 | 张三 | 农夫山泉 × 5 | ArrangingPayment | 顺丰 | - |
| #1002 | 张三 | 三只松鼠坚果礼盒 × 1 | PaymentSettled | 满99包邮 | dummy |
| #1003 | 李四 | 五常大米 × 2 + 牛肉卷 × 1 | Shipped | 顺丰 | dummy |
| #1004 | 李四 | 小米手环8 标准版 × 1 | Completed | 满99包邮 | balance |
| #1005 | 张三 | 华为路由器 × 1 | Cancelled | - | - |

**shop-a Channel:**

| 订单 | 客户 | 商品 | 状态 | 配送 | 支付 | 优惠券 |
|------|------|------|------|------|------|--------|
| #2001 | 王五 | 三只松鼠坚果礼盒 × 1 | ArrangingPayment | 门店自提 | - | - |
| #2002 | 王五 | 五常大米 × 2 | PaymentSettled | 满99包邮 | COD | NEW90 + SAVE5 |
| #2003 | 王五 | 小米充电宝 × 1 | Shipped | 满99包邮 | balance | - |

## 4. 技术实现细节

### 4.1 脚本入口

```typescript
import { bootstrap, JobQueueService, Logger } from '@vendure/core';
import { clearAllTables } from '@vendure/testing';
import { devConfig } from './dev-config';
import { populateBase } from './china-data/01-base';
import { populateDefaultChannel } from './china-data/02-default-channel';
import { populateShopAChannel } from './china-data/03-shop-a-channel';
import { populatePromotions } from './china-data/04-promotions';
import { populateCustomers } from './china-data/05-customers';
import { populateOrders } from './china-data/06-orders';

if (require.main === module) {
    clearAllTables(devConfig, true)
        .then(() => bootstrap(devConfig))
        .then(async app => {
            await app.get(JobQueueService).start();
            await populateBase(app);
            await populateDefaultChannel(app);
            await populateShopAChannel(app);
            await populatePromotions(app);
            await populateCustomers(app);
            await populateOrders(app);
            return app.close();
        })
        .then(() => process.exit(0))
        .catch(err => { console.error(err); process.exit(1); });
}
```

### 4.2 RequestContext 构造模式

每个 stage 函数内构造目标 Channel 的 ctx：

```typescript
// 创建 Channel-aware 实体前，先切换到目标 Channel
const ctx = await ctxService.create({ apiType: 'admin', channel: targetChannel });
```

商品分配使用 `ProductService.assignProductsToChannel(channelId, productIds)`。

### 4.3 自定义字段写入

cjk-plugin 的 Channel 自定义字段通过 `ChannelService.update(ctx, { id, customFields: { couponStackable: true, maxStackableCount: 3 } })` 写入。

Promotion 自定义字段同理：`PromotionService.update(ctx, { id, customFields: { stackable: true, stackableGroup: null, maxStackableWith: null } })`。

### 4.4 PickupLocation 创建

cjk-plugin 导出 `PickupLocationService`，通过 `app.get('PickupLocationService')` 拿到（NestJS DI by token）。如果直接 `app.get(PickupLocationService)` 拿不到，使用字符串 token。

### 4.5 余额写入（RechargeCardPlugin）

脚本内直接调用 RechargeCardPlugin 的服务或 repository 写入充值记录。如果服务未导出，回退到直接操作 `recharge_card_balance` 表（Knex/QueryBuilder）。

### 4.6 历史订单创建

通过 `OrderService` 创建 draft order，addItem → transitionToState 走流程：

- PaymentSettled：先 `OrderService.addPaymentToOrder` 走 dummy 或 balance handler
- Shipped：创建 Fulfillment
- Cancelled：`OrderService.cancelOrder`

> 订单创建是最复杂的部分，如果某个状态转换失败，log 警告但不中断脚本（其余数据已创建）。

### 4.7 幂等性策略

- 脚本开头 `clearAllTables` 清库，保证每次运行从零开始
- 单次执行内各 Service 调用顺序依赖明确（商品先于订单、客户先于订单）
- 不做"已存在则跳过"判断，保持脚本简洁

### 4.8 错误处理

- 每个阶段包裹 try/catch，记录失败阶段与错误，但**不中断**（订单/余额这种依赖复杂的允许失败）
- 关键阶段（Channel/商品/配送/支付）失败则抛出中断
- 结束时打印 summary：成功/失败计数

### 4.9 日志输出格式

```
[1/6] 基础设置: superadmin + Zone/Country/TaxRate/Facet/Collection ... OK (1.2s)
[2/6] default Channel: 8 SPU + 4 配送 + 3 支付 + 3 自提点 ... OK (3.4s)
[3/6] shop-a Channel: 创建 + 8 商品分配 + 2 配送 + 3 支付 + 1 自提点 ... OK (2.1s)
[4/6] 优惠券: default 1 + shop-a 2 ... OK (0.8s)
[5/6] 客户: 3 + 余额账户 2 ... OK (1.0s)
[6/6] 历史订单: default 5 + shop-a 3 ... 8/8 OK (4.2s)
完成! 总耗时: 12.7s
  - default Channel token: __default__
  - shop-a Channel token: shop-a-token
  - 测试客户: 张三/李四/王五
```

### 4.10 验收验证

脚本完成后自动调用：

1. `ChannelService.findAll()` 确认 2 个 Channel
2. `ProductService.findAll()` 各 Channel 确认商品数量
3. `EligibleShippingMethods` shop API 查询（需构造 shop ctx）确认配送
4. `EligiblePaymentMethods` shop API 查询确认支付

输出验证结果到日志。

## 5. 关键依赖 Service

| Service | 用途 |
|---------|------|
| `UserService` | 创建 superadmin 用户 |
| `RoleService` | 确认 SuperAdmin 角色存在 |
| `ChannelService` | 创建/更新 Channel，写入 customFields，设置 defaultZone |
| `ZoneService` / `CountryService` | 创建 Asia Zone + China Country |
| `TaxRateService` / `TaxCategoryService` | 创建税率 |
| `FacetService` | 创建 Facet 和 FacetValue |
| `CollectionService` | 创建商品集合 |
| `AssetService` | 导入商品图片（复用 mock-data/assets） |
| `ProductService` | 创建商品/变体，分配到 Channel，设置价格，关联 FacetValue |
| `StockMovementService` | 调整库存 |
| `ShippingMethodService` | 创建配送方式 |
| `PaymentMethodService` | 创建支付方式 |
| `PickupLocationService` (cjk-plugin) | 创建自提点 |
| `CustomerService` | 创建客户（含地址） |
| `PromotionService` | 创建优惠券，写入 customFields |
| `OrderService` | 创建历史订单 |
| `RequestContextService` | 构造各阶段 ctx |

## 6. 测试验证

### 6.1 脚本执行验证

```bash
cd packages/dev-server
npm run populate:china
```

预期：日志显示 6 阶段全部 OK，无关键阶段失败。

### 6.2 Admin UI 验证

1. 打开 `http://localhost:3000/admin`，用 `superadmin@china.test` / `superadmin` 登录
2. Channel 选择器应显示 `default` + `shop-a`
3. 切换到 shop-a → Settings → Channels → 自定义字段显示 `couponStackable=true`, `maxStackableCount=3`
4. Catalog → Products：default 显示 8 SPU，shop-a 显示 8 SPU（同商品不同价）
5. Settings → Shipping Methods：default 4 个，shop-a 2 个
6. Settings → Payment Methods：每个 Channel 各 3 个
7. Promotions：default 1 张，shop-a 2 张（stackable=true）

### 6.3 Shop API 验证（GraphiQL）

```graphql
# HTTP Header: { "vendure-token": "shop-a-token" }
query {
  products(options: { take: 10 }) {
    items { id name slug priceWithTax }
    totalItems
  }
  eligibleShippingMethods { id name priceWithTax }
  eligiblePaymentMethods { id code name isEligible }
}
```

预期：
- `totalItems` = 8
- 配送方式 = 2 个（门店自提 + 满99包邮）
- 支付方式 = 3 个（dummy/cod/balance）

### 6.4 VShop 前端验证

1. 打开 `http://localhost:5174/?tenant=shop-a`
2. 首页使用 fresh 模板
3. 商品列表显示 8 个商品（中文）
4. 加入购物车 → 进入结算页
5. 配送方式显示"门店自提"+"满99包邮"
6. 支付方式显示"测试支付/货到付款/余额支付"
7. 应用 `NEW90` + `SAVE5` 优惠券，确认叠加成功

## 7. 风险与限制

| 风险 | 缓解 |
|------|------|
| `PickupLocationService` token 未导出 | 用 `app.get('PickupLocationService')` 字符串 token；若失败回退直接操作表 |
| RechargeCardPlugin 余额写入 API 未暴露 | 回退到直接操作 `recharge_card_balance` 表 |
| 历史订单状态转换复杂（Shipped/Completed） | 允许失败，log 警告不中断；订单非关键阶段 |
| cjk-plugin checker/calculator code 拼写错误 | 参照 [多租户使用手册](file:///e:/code/vendure/doc/多租户使用手册.md) 中的 code 表格 |
| default Channel 货币从 USD 改 CNY 可能影响已有 Order | 清库后从零开始，无影响 |

## 8. 未来扩展

- 若需多租户演示更多场景，可扩展 `shop-b`（数码店）等 Channel
- 若需压测数据，可扩展商品数据源至 50+ SKU
- 脚本可参数化（如 `CHANNEL_COUNT=3 npm run populate:china`）

## 9. 验收标准

- [ ] `npm run populate:china` 执行成功，6 阶段全部 OK
- [ ] superadmin 用户创建，可用 `superadmin@china.test` / `superadmin` 登录 Admin UI
- [ ] default Channel 货币为 CNY，语言为 zh_Hans，defaultShippingZone/defaultTaxZone 为 Asia
- [ ] shop-a Channel 创建成功，customFields 正确写入，defaultZone 为 Asia
- [ ] 8 SPU / 9 SKU 商品在两个 Channel 都可见，shop-a 五常大米价格为 44 元
- [ ] 商品图片已导入（复用 mock-data/assets）
- [ ] default Channel 4 个配送方式，shop-a 2 个
- [ ] 3 个支付方式在两个 Channel 都创建
- [ ] PickupLocation 在两个 Channel 分别创建（default 3 个，shop-a 1 个）
- [ ] 3 张优惠券创建（default 1 + shop-a 2），shop-a 优惠券 stackable=true，含 condition/action
- [ ] 3 个客户创建（含地址），李四余额 500 元，王五余额 200 元
- [ ] 8 笔历史订单创建（default 5 + shop-a 3），覆盖 5 种状态
- [ ] VShop 切换到 shop-a 后可正常下单并应用叠加优惠券
