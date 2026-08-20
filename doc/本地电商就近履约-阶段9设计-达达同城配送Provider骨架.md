# 本地电商就近履约 · 阶段9设计：达达同城配送 Provider 骨架对接

> 承接：阶段8（每包独立发货）边界项之「真实配送平台对接（达达/蜂鸟等）」。
> 目标：在既有 `delivery-gateway` 抽象下新增 `DadaDeliveryProvider`，落地达达开放平台契约层（签名/计价/下单/取消/订单推送），凭据配置化占位——**无账号即可验证契约正确性与入站回调全链路**，后续填入凭据即可上线。

## 1. 背景与要解决的问题

当前 [delivery-gateway-plugin](file:///d:/zhao/vendure/packages/delivery-gateway-plugin) 已具备抽象网关能力：

- `DeliveryProvider` 接口（`quote` / `createDelivery` / `cancelDelivery` / `parseWebhook`）已定义；
- `DeliveryGatewayService` 按 `providerCode` 注册分发 Provider，`createDelivery` 落库 `DeliveryOrder` 并回写 `OrderPackage`；
- `applyStatusEvent` 驱动配送状态机（`pending→accepted→pickup→delivered`，含 `cancelled`/`exception`），终态回写 `OrderPackage`；
- 当前仅有 `MockDeliveryProvider`，状态流转由后台 `mockDeliveryEvent` 手动触发，**无法对接真实配送平台**。

Vendure 插件原生支持 Nest `Controller`（[vendure-plugin.ts](file:///d:/zhao/vendure/packages/core/src/plugin/vendure-plugin.ts#L138-L160) 文档示例），可直接暴露 HTTP webhook 端点，无需额外基础设施。

**要解决的问题**：把「模拟配送商」替换为「达达开放平台」真实对接，同时保证无账号阶段契约层（签名、报文、状态映射）可完整验证、有账号后零改动上线。

## 2. 方案对比与选型

| 方案 | 说明 | 权衡 |
|---|---|---|
| **A. 契约层 + Provider + Webhook 控制器（推荐）** | 签名工具（纯函数可单测）+ DadaProvider（出站 HTTP 走可注入适配器）+ Nest Webhook 控制器（入站验签） | 契约与入站链路无账号即可全测；真实出站仅差凭据；生产就绪度高 |
| B. 仅 Provider 实现 | 只做四方法，webhook 仍复用 `mockDeliveryEvent` 手动触发 | 最小改动，但达达无法真实推送，回调路径缺失 |
| C. 完整 SDK + 管理端配置界面 | 额外加 admin UI 配置凭据/查看配送单 | 范围大、含前端工作，骨架阶段 YAGNI |

**选型：方案 A**。理由：复用既有 Provider 抽象与状态机，入站（webhook）链路完全不依赖账号即可端到端验证；出站只差凭据，具备账号后无需改契约；控制器方式被 Vendure 原生支持，无额外基础设施。

## 3. 设计详述

### 3.1 达达开放平台 API 契约（已核实）

**环境地址**（配置切换，仅换 baseUrl）：
- 沙箱测试环境：`https://newopen.qa.imdada.cn`
- 正式环境：`https://newopen.imdada.cn`

**通用请求参数**：`app_key`、`body`（业务参数 JSON 字符串）、`format=json`、`timestamp`（秒）、`v=1.0`、`source_id`（可选）、`signature`。

**签名算法**：
1. 除 `signature` 外的请求参数按 key ASCII 升序排序；
2. 按 `key1value1key2value2...` 直连拼接（官方新开放平台规则；历史存在 `key=value&` 拼接样式，本设计采用官方直连样式并在单测中固化）；
3. `signature = MD5(app_secret + 拼接串 + app_secret).toUpperCase()`。

**接口映射**：

| Provider 方法 | 达达接口 | body 关键参数 |
|---|---|---|
| `quote` | `/api/order/queryDeliverFee` | `shop_no`, `origin_id`, `cargo_type`, `cargo_weight`, `receiver_lat`, `receiver_lng`, ... |
| `createDelivery` | `/api/order/addOrder` | `shop_no`, `origin_id`(本地唯一), `cargo_price`, `is_prepay=0`, `receiver_name/address/lat/lng/phone`, `cargo_weight`, `callback`(必传), `cargo_num`, `tips`, `info`(备注) |
| `cancelDelivery` | `/api/order/formalCancel` | `order_id`(达达单号), `cancel_reason_id`, `cancel_reason` |
| 状态查询（兜底） | `/api/order/status/query` | `order_id`(达达单号) |

**订单状态码 → 本地 `DeliveryStatus` 映射**：

| 达达状态码 | 含义 | 本地状态 |
|---|---|---|
| 1 | 待接单 | `pending` |
| 2 | 已接单 | `accepted` |
| 3 / 4 | 取货中 / 配送中 | `pickup` |
| 5 | 已完成 | `delivered` |
| 7 / 10 | 已过期 / 已取消 | `cancelled` |
| 1000 | 异常/创建失败 | `exception` |

**订单推送（webhook）**：达达 POST 到 `callback_url`；商户须返回 `{"status": "ok"}` 否则达达重试；报文含 `signature` 需验签通过才落库。

### 3.2 架构与文件结构（均新增于 `packages/delivery-gateway-plugin/src/`）

| 文件 | 职责 |
|---|---|
| `dada-signature.ts` | 纯函数：`buildSignedParams(appKey, appSecret, body, sourceId)` 生成带签名的请求参数；`verifyCallbackSignature(payload, appSecret)` 校验回调签名 |
| `dada-http.adapter.ts` | 出站 HTTP 适配器接口 `DadaHttpAdapter { post(path, params): Promise<any> }` + `FetchDadaHttpAdapter` 实现（基于 fetch）；测试可注入 fake |
| `dada-delivery-provider.ts` | 实现 `DeliveryProvider`：`code='dada'`；`quote`→queryDeliverFee；`createDelivery`→addOrder；`cancelDelivery`→formalCancel；`parseWebhook`→状态码映射 |
| `dada-webhook.controller.ts` | Nest `Controller('delivery-gateway/dada/webhook')`，`POST`：验签→`provider.parseWebhook`→`gateway.applyStatusEvent`→返回 `{"status":"ok"}`；验签失败 401 不落库 |
| 修改 `plugin.ts` | `init` 读取 `dada` 配置：有 `appKey` 才 `registerProvider(new DadaDeliveryProvider(cfg))`，否则 `Logger.warn` 跳过 |
| 修改 `dev-config.ts` | 注入占位配置（凭据留空/从环境变量读取，不落 git） |

### 3.3 单号映射（关键设计点）

- `DeliveryOrder.code` = `origin_id`（本地第三方单号）。达达回调报文 `order_id` 原样回传 `origin_id` → `applyStatusEvent` 按 `code` 精确定位配送单。
- `DeliveryOrder.thirdPartyNo` = 达达返回的 `deliveryNo`（达达单号），用于 `formalCancel` / `status/query` 出站调用。
- `createDelivery` 返回：`{ deliveryOrderNo: origin_id, thirdPartyNo: deliveryNo, status: 'pending', fee }`。
- **webhook 定位健壮性**：达达回调报文同时含 `order_id`（第三方单号）与 `client_id`（达达单号）。`parseWebhook` 优先按 `order_id` 映射 `deliveryOrderNo`（= `code`）；若缺失，兜底按 `client_id` 映射为 `deliveryOrderNo` 的候选键（实现时由 `applyStatusEvent` 先按 `code` 查、未命中再按 `thirdPartyNo` 查，保证两种报文都能定位）。

### 3.4 配置与安全

- `DeliveryGatewayPlugin.init({ dada: { appKey, appSecret, shopNo, sourceId, environment: 'sandbox' | 'production', callbackUrl } })`。
- `environment` 决定 baseUrl（沙箱/正式仅换地址）。
- 凭据不进 git：`dev-config.ts` 用占位 + 注释说明从环境变量注入（如 `process.env.DADA_APP_KEY`）。

### 3.5 错误处理

| 场景 | 行为 |
|---|---|
| `quote` 出站失败 | 返回 `{ available: false }`，不阻断下单流程 |
| `createDelivery` 出站失败 | 抛错 → `createDelivery` mutation 报错，不落 `DeliveryOrder` |
| webhook 验签失败 | 返回 401，不落库、不驱动状态机 |
| 非法状态流转 | 既有 `TRANSITIONS` 守卫忽略并告警 |
| 重复回调（终态） | 状态机终态幂等，`deliveredAt`/`cancelledAt` 不重置 |

## 4. 数据流示例

```
后台 createDelivery(providerCode=dada, orderId, packageId, pickup, dropoff, items)
  → DadaProvider.createDelivery
    → 签名(origin_id=本地单号) → POST /api/order/addOrder
    → 返回 deliveryNo + fee → DeliveryOrder{ code=origin_id, thirdPartyNo=deliveryNo, status=pending }
  → OrderPackage.linkDeliveryOrder + transition('shipped')

达达接单/取货/送达 → POST callback_url（带 signature）
  → DadaWebhookController 验签 → parseWebhook → applyStatusEvent
    → 状态机 pending→accepted→pickup→delivered
    → delivered 终态回写 OrderPackage.delivered
```

## 5. 测试方案

**单元测试**（`delivery-gateway-plugin` 内新增）：
- `dada-signature`：签名生成（固化拼接样式）、回调验签（正确/篡改/缺参）；
- `dada-delivery-provider.parseWebhook`：达达状态码 → 本地状态映射全表。

**e2e**（`tools/e2e-phase9-dada-webhook.mjs`，无账号可全测）：
- 前置：mock 默认 provider 仍在（本地回归不受影响）；DadaProvider 以占位配置注册；
- 入站全链路：构造带正确签名的达达回调报文 POST webhook → 断言 `DeliveryOrder` 状态机推进（pending→accepted→pickup→delivered）+ `OrderPackage` 回写 + 返回 `{"status":"ok"}`；
- 验签失败用例：错误签名 → 401 且不落库；
- 兜底定位用例：回调报文缺 `order_id` 仅含 `client_id` → 仍能按 `thirdPartyNo` 定位并推进状态机；
- 非法流转用例：delivered 后重复回调 → 忽略/终态幂等；
- 出站真实调用：无凭据 → SKIP（占位配置下不发起真实请求）；
- 全量回归 9 套保持全绿。

## 6. 本期不做（边界项，留待后续）

- 申请达达开发者账号、真实沙箱/正式联调（填入凭据即可用，无需改契约）。
- 骑手实时位置/地图展示。
- admin 配置界面（凭据改由 `init` 配置/环境变量，YAGNI）。
- 达达高级参数：预约单/垫付/保价/收货码/直拿直送等（`addOrder` body 预留扩展点，按需追加）。

## 7. 成功标准

1. `DadaDeliveryProvider` 实现四方法，`code='dada'`，经既有 `registerProvider` 注册。
2. 签名算法正确：单测固化 `signature = MD5(app_secret + 升序拼接串 + app_secret)`。
3. 状态码映射正确：达达 1/2/3/4/5/7/10/1000 → pending/accepted/pickup/delivered/cancelled/exception。
4. webhook 入站链路无账号可端到端验证：验签 → 状态机推进 → OrderPackage 回写 → 返回 `{"status":"ok"}`。
5. 配置化环境切换：`environment: sandbox/production` 仅换 baseUrl。
6. 无凭据时出站 SKIP、有凭据零改动上线；mock provider 仍是本地默认，全量回归 9 套全绿。
