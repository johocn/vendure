# 后续功能增强设计文档

> 日期：2026-06-02
> 版本：v1
> 状态：已确认

## 1. 概述

为 CJK 本地化插件体系增加 3 个生产级增强插件，解决高并发库存超卖、物流实时追踪、发票 PDF 生成三个核心问题。采用独立插件包方式，与现有 12 个插件风格一致。

## 2. 插件 1：RedisStockPlugin — Redis 库存预扣

### 2.1 问题

秒杀 `incrementSoldCount` 使用 DB `increment`，高并发下存在超卖风险。拼团也有类似问题。数据库行锁在高并发场景下性能瓶颈明显。

### 2.2 方案

使用 Redis `DECRBY` 原子操作预扣库存，`INCRBY` 回滚。

### 2.3 核心组件

**StockPrewarmService**：活动开始时将库存写入 Redis

- key 格式：`stock:flash-sale:{activityId}`、`stock:group-buy:{activityId}`
- `prewarm(key, stock)` → SET key stock
- `removePrewarm(key)` → DEL key

**StockReserveService**：库存预扣/回滚

- `reserveStock(key, quantity)` → DECRBY key quantity → 返回剩余库存（负数表示不足）
- `releaseStock(key, quantity)` → INCRBY key quantity
- `getStock(key)` → GET key

**RedisStockModule**：NestJS 模块，注册 ioredis 连接

- init 参数：`redisUrl`（可选，默认从 BullMQ 配置推断）
- 提供 `StockReserveService` 和 `StockPrewarmService`

### 2.4 核心流程

```
活动开始 → StockPrewarmService.prewarm(key, totalStock)
    ↓
下单请求 → StockReserveService.reserveStock(key, qty)
    ├→ 剩余 >= 0 → 允许下单
    └→ 剩余 < 0 → releaseStock(key, qty) 回滚 → 拒绝（库存不足）
    ↓
OrderPlacedEvent → 确认扣减（无需操作，Redis 已扣）
OrderCancelledEvent → StockReserveService.releaseStock(key, qty)
    ↓
活动结束 → StockPrewarmService.removePrewarm(key)
```

### 2.5 降级策略

`StockReserveService` 作为可选依赖注入。FlashSalePlugin 和 GroupBuyPlugin 通过 `init(injector)` 尝试获取：

- 有 RedisStockPlugin → 使用 Redis 原子操作
- 无 RedisStockPlugin → 降级为 DB `increment` 模式（现有行为）

### 2.6 Channel CustomFields

| 字段 | 类型 | 说明 |
|------|------|------|
| redisStockEnabled | boolean | 是否启用 Redis 库存预扣 |
| redisUrl | string | Redis 连接地址（可选，默认复用 BullMQ 配置） |

### 2.7 依赖

- ioredis（Vendure 已有间接依赖，通过 BullMQJobQueueStrategy）

### 2.8 文件结构

```
packages/redis-stock-plugin/
  src/
    plugin.ts
    stock-reserve.service.ts
    stock-prewarm.service.ts
    channel-custom-fields.ts
    types.ts
    constants.ts
  dashboard/
    index.tsx
    tsconfig.json
    channel-detail-forms.tsx
```

## 3. 插件 2：LogisticsApiPlugin — 快递100 物流查询

### 3.1 问题

当前物流追踪仅存储 trackingNumber/carrier，无法实时查询物流状态。

### 3.2 方案

对接快递100 API，实现实时物流轨迹查询。

### 3.3 核心组件

**LogisticsQueryService**：

- `queryTracking(ctx, carrierCode, trackingNumber)` → 调用快递100 API → 返回物流轨迹列表
- `detectCarrier(ctx, trackingNumber)` → 自动识别快递公司
- 缓存策略：Redis 缓存 30 分钟（有 Redis 时），内存缓存 10 分钟（无 Redis 时）

**LogisticsApiAdminResolver**：

- Query: `logisticsTracking(carrierCode: String!, trackingNumber: String!)` → 轨迹列表
- Query: `detectCarrier(trackingNumber: String!)` → 快递公司列表

### 3.4 快递100 API

- 实时查询：`https://poll.kuaidi100.com/poll/query.do`
  - 参数：customer（授权码）、key（API key）、num（运单号）、com（快递公司编码）
  - 返回：物流轨迹列表（时间、状态、描述）
- 自动识别：`https://auto.kuaidi100.com/autonumber/auto`
  - 参数：key、num
  - 返回：可能的快递公司列表

### 3.5 Channel CustomFields

| 字段 | 类型 | 说明 |
|------|------|------|
| kuaidi100Customer | string | 快递100 授权码 |
| kuaidi100Key | string | 快递100 API key |

### 3.6 Dashboard 扩展

在物流追踪 PageBlock 中添加"查询物流"按钮：

- 点击后调用 `logisticsTracking` Query
- 弹窗展示物流轨迹时间线
- 自动识别快递公司（carrierCode 为空时调用 `detectCarrier`）

### 3.7 依赖

- 无额外 npm 依赖（使用 Node.js 内置 fetch）

### 3.8 文件结构

```
packages/logistics-api-plugin/
  src/
    plugin.ts
    logistics-query.service.ts
    logistics-api-admin.resolver.ts
    channel-custom-fields.ts
    types.ts
    constants.ts
  dashboard/
    index.tsx
    tsconfig.json
    logistics-tracking-dialog.tsx
    logistics-block-enhanced.tsx
```

## 4. 插件 3：InvoicePdfPlugin — 发票 PDF 生成

### 4.1 问题

当前仅存储发票信息，无法生成 PDF 发票。

### 4.2 方案

使用 pdfkit 生成 PDF 发票，存储到 Vendure AssetStorageStrategy。

### 4.3 核心组件

**InvoicePdfService**：

- `generatePdf(ctx, order)` → 生成 PDF Buffer
- `generateAndStore(ctx, order)` → 生成并存储 PDF，返回 URL
- 模板：普通发票模板、增值税专用发票模板

**InvoicePdfAdminResolver**：

- Query: `invoicePdfUrl(orderId: ID!)` → 获取 PDF 下载 URL
- Mutation: `generateInvoicePdf(orderId: ID!)` → 生成并存储 PDF

### 4.4 PDF 模板内容

**普通发票**：
- 发票编号（自动生成：INV-{orderId}-{timestamp}）
- 开票日期
- 发票类型：普通发票
- 发票抬头、纳税人识别号
- 订单号、下单时间
- 商品明细（名称、数量、单价、小计）
- 合计金额
- 接收邮箱

**增值税专用发票**（额外信息）：
- 注册地址、注册电话
- 开户银行、银行账号

### 4.5 Order CustomFields

| 字段 | 类型 | 说明 |
|------|------|------|
| invoicePdfUrl | string | PDF 文件 URL |
| invoiceNumber | string | 发票编号（自动生成） |

### 4.6 存储方式

复用 Vendure AssetStorageStrategy：

- OSS 插件已配置 → 存储到阿里云 OSS
- 未配置 → 存储到本地文件系统（AssetServerPlugin 默认行为）

文件路径：`invoices/{channelId}/{orderId}/{invoiceNumber}.pdf`

### 4.7 Dashboard 扩展

在发票信息 PageBlock 中添加操作按钮：

- "生成发票" → 调用 `generateInvoicePdf` Mutation
- "下载发票" → 链接到 `invoicePdfUrl`（仅当 PDF 已生成时显示）

### 4.8 依赖

- pdfkit（纯 Node.js PDF 生成库）

### 4.9 文件结构

```
packages/invoice-pdf-plugin/
  src/
    plugin.ts
    invoice-pdf.service.ts
    invoice-pdf-admin.resolver.ts
    templates/
      ordinary-invoice.ts
      special-invoice.ts
    order-custom-fields.ts
    types.ts
    constants.ts
  dashboard/
    index.tsx
    tsconfig.json
    invoice-block-enhanced.tsx
```

## 5. 与现有插件的集成

### 5.1 RedisStockPlugin 集成

**FlashSalePlugin 修改**：

- `FlashSaleService.checkEligibility()` → 先调用 `StockReserveService.reserveStock()`
- `FlashSaleService.incrementSoldCount()` → 有 Redis 时跳过 DB increment
- 监听 `OrderCancelledEvent` → `StockReserveService.releaseStock()`
- `FlashSaleJob` 活动开始时 → `StockPrewarmService.prewarm()`

**GroupBuyPlugin 修改**：

- `GroupBuyService.joinGroupBuy()` → 先调用 `StockReserveService.reserveStock()`
- 监听 `OrderCancelledEvent` → `StockReserveService.releaseStock()`
- `GroupBuyJob` 活动开始时 → `StockPrewarmService.prewarm()`

### 5.2 LogisticsApiPlugin 集成

- 替换 LogisticsPlugin 的 logistics-block 为增强版（添加查询按钮）
- 复用 LogisticsPlugin 的 fulfillment CustomFields（trackingNumber/carrier/carrierCode）

### 5.3 InvoicePdfPlugin 集成

- 替换 InvoicePlugin 的 invoice-block 为增强版（添加生成/下载按钮）
- 复用 InvoicePlugin 的 Order CustomFields
- 新增 invoicePdfUrl 和 invoiceNumber CustomFields

## 6. 实施顺序

1. **RedisStockPlugin**（最高优先级，生产防超卖）
2. **LogisticsApiPlugin**（中等优先级，用户体验提升）
3. **InvoicePdfPlugin**（中等优先级，合规需求）

每个插件独立开发、独立测试、独立提交。
