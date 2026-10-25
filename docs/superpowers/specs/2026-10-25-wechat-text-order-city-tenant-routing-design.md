# 微信公众号文字订购：城市识别 / 租户匹配 / 配送校验 全链路设计

- 日期：2026-10-25
- 状态：待评审
- 影响范围：`packages/wechat-shopping-assistant-plugin`（主要）、`packages/address-plugin`（复用）、`packages/cjk-plugin`（渠道字段）、`packages/merchant-plugin`（门店数据，只读）
- 提交基线：`663734f76`

## 1. 背景与目标

### 1.1 背景

当前微信公众号文字订购只能在一个渠道内完成：公众号携带的 `channelToken` 决定商品、价格、库存与下单渠道，助手侧没有城市维度，也不做配送范围校验。平台号（一个公众号服务多城市、多租户）上线后，用户可能在任何城市发起订购，现有链路无法回答「这单该由哪个租户履约」「这个地址能不能送」。

### 1.2 目标

1. 用户发文字订购时，系统能确定其所在城市（历史地址优先，其次主动询问，定位为补充）。
2. 按城市 + 地址匹配可服务的租户，并在需要时**切换渠道**完成搜索、下单、通知。
3. 下单前校验配送范围；超范围给出明确原因与可服务区域，不静默失败。
4. 地址、联系人、电话一次性文本采集，解析失败只补问缺失项。
5. 下单成功推送订单确认（订单号、商品、金额、预计送达、支付链接），后续状态变更主动推送。
6. 用户侧主路径不因城市识别多出强制步骤（延迟绑定渠道）。

### 1.3 非目标（本期不做）

- 合作快递兜底报价（首重/续重/时效）：超范围只提示范围，不承诺快递。
- 城市主数据运营后台（新建 city / city_channel 管理页）。
- 微信模板消息 / 订阅消息 / 短信通知。
- 跨租户购物车合并、跨租户优惠券。

## 2. 现状盘点与可复用能力

| 能力 | 位置 | 复用方式 |
|---|---|---|
| 配送范围模型 `DeliveryRange`（all/circle/district，含基础运费、包邮阈值） | `packages/address-plugin/src/delivery-range.entity.ts` | 直接读取，作为城市/范围判定依据 |
| 中国化地址 `DeliveryAddress`（province/city/district + 区划码 + 经纬度） | `packages/address-plugin/src/delivery-address.entity.ts` | 地址解析落库与历史地址复用 |
| 配送判定 `delivery.service.ts`（OK / BEYOND_RANGE / NOT_IN_RANGE 等） | `packages/address-plugin/src/delivery.service.ts` | 新增 guard 服务包装调用，不重复实现 |
| 门店履约能力 `supportsDelivery / deliveryRadiusKm / deliveryFee / minOrderAmount / deliveryMinutes` | `packages/merchant-plugin/src/merchant-store.entity.ts` | 租户排序与预计送达取值 |
| 门店结构化地址 `province/city/cityCode/district/lat/lng/geohash` | 同上 | 派生城市索引 |
| 渠道字段 `shopName / domain / basicConfig / servicePhone` | `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts` | 新增 `servingCities` |
| 会话状态机与 draft | `packages/wechat-shopping-assistant-plugin/src/types.ts` | 扩展字段与状态 |
| 附近门店匹配 | `packages/wechat-shopping-assistant-plugin/src/store-locator.service.ts` | 保留，作为半径内候选来源 |
| 下单落单 | `packages/wechat-shopping-assistant-plugin/src/order.service.ts` | 增加前置 guard，不改核心建单逻辑 |
| 客服消息回复 | `packages/wechat-shopping-assistant-plugin/src/card-builder.ts` | 扩展通知文案 |

**结论**：不需要新增业务主数据表；需要新增「城市 → 渠道」派生索引（内存缓存）与三个编排服务。

## 3. 断点与痛点评估

### 3.1 流程断点

1. **渠道与城市冲突**：会话锁定 `channelToken`，切换城市后旧搜索结果（含编号、价格、库存）不可复用，否则会跨店下单。
2. **缺城市→租户索引**：`DeliveryRange` 按 `shopId + channelId` 存储，无城市维度，逐条判定成本高且无法先选租户。
3. **地址无法驱动校验**：自由文本地址没有区划码/坐标，`DeliveryService` 无法判定。
4. **下单无配送守卫**：现有 `placeOrder()` 不做范围校验，超范围地址可以直接下单。
5. **确认通知不完整**：缺预计送达；支付后无状态推送。
6. **未校验起送价**：`minOrderAmount` 有数据但下单前未用。

### 3.2 体验痛点

- 前置询问城市会打断购买意图 → 延迟绑定：先搜，地址确定后再选租户。
- 超范围无出口 → 给可服务区县清单 + 最近可服务租户 + 客服/留言入口。
- 重复输入地址 → 复用历史地址；绑定后记住默认地址。
- 多租户命中无排序规则 → 区县精确 > 半径最近 > 全城。

### 3.3 业务逻辑漏洞

- `DeliveryRange` 与 `merchant-store.deliveryRadiusKm` 两套口径 → 定优先级：显式 `DeliveryRange` 优先，门店半径作为无 Range 时的兜底。
- 同名区县跨城市（如朝阳区）→ 必须要求 cityCode 消歧，禁止只用区县名匹配。
- 目标渠道无该商品 → 明确提示 + 替代建议，不静默失败。
- 校验服务异常 → fail closed（不自动下单），提示稍后重试 + 客服。

## 4. 方案选型

| 方案 | 说明 | 结论 |
|---|---|---|
| A. 延迟绑定 + 派生城市索引 | 搜索先用会话默认渠道，地址确认后反推城市/租户；换租户时用原关键词重搜并重编号 | **采用** |
| B. 前置选城市 | 每条会话先选城市再搜索 | 不采用：转化损耗大 |
| C. 显式城市-租户配置表 | 新建 city / city_channel 表 | 本期不采用：与 DeliveryRange 重复维护；保留 `servingCities` 作为轻量显式配置 |

## 5. 架构设计

### 5.1 组件与职责

| 组件 | 职责 | 输入 | 输出 | 依赖 |
|---|---|---|---|---|
| `city-catalog.service` | 聚合「城市 → 可服务渠道」，内存缓存 5 分钟 | 无 | `Map<cityCode, ChannelCandidate[]>` | Channel、MerchantStore、DeliveryRange |
| `tenant-router.service` | 按地址/区划/坐标选租户并排序 | 地址或 `{cityCode,districtCode,lat,lng}` | `TenantRouteResult` | `city-catalog`、`delivery-guard` |
| `delivery-guard.service` | 判定地址是否可配送，产出可读文案 | ctx、channelId、地址 | `{ status, serviceAreaText }` | address-plugin `DeliveryService` |
| `address-parser.service` | 自由文本 → 结构化地址 | 文本 | `ParsedAddress` + `missing[]` | 区划字典（address-plugin） |
| `order-notify.service` | 订单确认与状态变更推送 | 订单、openid | 无 | WeChat 客服消息、EventBus |

每个服务单一职责、纯函数优先，便于单测；`assistant.service` 只做编排。

### 5.2 城市索引来源与优先级

1. `channel.customFields.servingCities`（新增，字符串数组，元素为 **cityCode**）——运营显式声明，优先级最高；运营填城市名时由 `address-parser` 在启动/配置变更时映射为 cityCode。
2. 该渠道下 `MerchantStore.supportsDelivery = true` 且 `cityCode` 有值的门店。
3. 该渠道 `DeliveryRange.type = 'all'` → 标记 `allCities`；`type = 'district'` → 白名单区县的上级城市。

索引结构：`cityCode → [{ channelId, channelToken, precision: 'explicit'|'district'|'circle'|'all', minOrderAmount, deliveryMinutes, storeId }]`。

### 5.3 租户排序规则

1. `explicit`（渠道显式声明该城市）
2. `district`（区县白名单精确命中）
3. `circle`（门店半径内，按距离升序）
4. `all`（全城覆盖）

同精度内：`minOrderAmount` 升序 → `deliveryMinutes` 升序 → 距离升序。命中多个且无法区分时，不自动选，进入 `awaiting_city_pick` 列前 3 个候选。

### 5.4 地址解析规则

- 输入单条文本：`省 市 区 详细地址 联系人 电话`（顺序可乱）。
- 输出：`{ province, city, cityCode, district, districtCode, streetLine1, fullName, phoneNumber, missing[] }`。
- `missing` 仅允许 `city | district | street | phone | name` 五项；每次只追问缺失的第一项，最多追问 2 次，超过则转客服。
- 只写区县不写城市时，若该区县在多个城市存在 → 返回城市候选，不猜测。

## 6. 数据模型变更

### 6.1 渠道字段（`cjk-plugin`）

```ts
servingCities?: string[] | null; // 该渠道显式服务的城市（cityCode；城市名会被映射为 cityCode）
```

### 6.2 会话 draft（`types.ts`）

```ts
cityCode?: string | null;            // 已确认城市
resolvedChannelId?: string | null;   // 实际履约渠道（可能与公众号默认渠道不同）
resolvedChannelToken?: string | null;
addressCandidate?: ParsedAddress | null;
addressFixField?: 'city' | 'district' | 'street' | 'phone' | 'name' | null;
addressFixCount?: number | null;
pendingQuery?: string | null;        // 切渠道后用于重搜的原始关键词
```

### 6.3 新增会话状态

- `awaiting_address_fix`：地址缺字段补问。
- `awaiting_city_pick`：城市多候选或租户多候选时选择。
- `out_of_range` 不落状态，仅回复文案（避免用户被困住）。

## 7. 关键流程（延迟绑定）

1. 用户发 `买袋面`：
   - 会话有 `cityCode` → 在该城市默认租户搜；
   - 无 → 用公众号默认渠道搜，**不问城市**。
2. 用户回编号 → 选定商品，进入地址环节。
3. 地址来源优先级：
   1. `draft.addressCandidate`（本轮刚补录）
   2. 历史 `DeliveryAddress` 默认地址
   3. 请用户发一条文本地址
4. 解析成功 → 城市确认 → `tenant-router` 选租户：
   - 与当前渠道相同：继续；
   - 不同：用 `pendingQuery` 在新渠道重搜 → 重建结果与编号 → 提示「已为你切换到 XX 店，价格已更新」→ 用户重新回编号。
5. `delivery-guard` 校验：
   - `OK` → 校验 `minOrderAmount` → 确认卡（商品/数量/收货人/电话/地址/支付方式/预计送达）→ 回复 1 下单。
   - `BEYOND_RANGE / NOT_IN_RANGE` → 超范围卡：当前地址不可配送 + 可服务区县清单 + 最近可服务租户 + 客服/留言。
   - 服务异常 → fail closed，提示稍后重试 + 客服。
6. 下单成功 → 立即推送订单确认（订单号/商品/金额/预计送达/支付链接）。
7. 支付与状态变更 → 客服消息推送「已接单 / 配送中 / 已完成」。

**预计送达**：`deliveryMinutes` 存在时展示「约 X 分钟送达」，否则展示「下单后门店会电话确认送达时间」。

## 8. 异常与降级

| 场景 | 处理 | 用户可见文案要点 |
|---|---|---|
| 城市无法识别 | 追问一次城市，仍失败转客服 | 「您在哪个城市？回复城市名即可」 |
| 城市多候选 | 列前 3 个城市让选 | 「朝阳区有多个城市，请回复 1/2/3」 |
| 地址解析缺字段 | 只补问缺失项，最多 2 次 | 「还差门牌号，请补充」 |
| 地址超范围 | 提示范围 + 可服务区县 + 最近租户 | 不出现「下单失败」 |
| 目标租户无该商品 | 保留原渠道结果，提示可换店/换品 | 「该店暂无此商品，可回复「客服」」 |
| 配送校验服务异常 | fail closed | 「配送校验暂时不可用，请稍后再试」 |
| 重复消息 | 沿用 MsgId 幂等 | 不重复建单 |
| 切渠道后支付方式不同 | 重新拉取目标渠道支付方式 | 确认卡展示新支付方式 |

## 9. 通知设计

- 通道：微信客服消息（文本），复用现有回复链路，无需模板 ID。
- 订单确认：订单号、商品 × 数量、合计、预计送达、支付链接。
- 状态推送：订阅 Vendure `OrderStateTransition` 事件，按 `orderId + toState` 幂等，仅推送 `ArrangingPayment→PaymentSettled`（已接单）、`Shipped`（配送中）、`Delivered`（已完成）。
- 失败重试：推送失败记日志，不阻断订单状态流转。

## 10. 配置与运营前置

上线前每个渠道需确认：

1. `servingCities`（推荐，至少覆盖主力城市）。
2. 门店 `cityCode/districtCode` 与 `supportsDelivery`。
3. `DeliveryRange`（区县白名单或半径），否则只能落到 `all`。
4. `minOrderAmount`、`deliveryMinutes`。
5. 店铺 `domain`、`shopName`（已有）。

## 11. 分期

| 阶段 | 内容 |
|---|---|
| P0 | 城市目录、租户路由、配送守卫、地址解析、下单前 guard、订单确认通知增强 |
| P1 | 订单状态推送、最近可服务租户推荐、默认地址复用与地址簿联动 |
| P2 | 城市主数据后台、快递兜底报价、模板消息/短信 |

## 12. 验收标准

1. 用户发 `买袋面`，无城市上下文时**不被打断**，能拿到默认渠道结果。
2. 回复编号后，若历史地址可服务 → 直接进确认卡；不可服务 → 收到含「可服务区县 + 最近租户」的超范围卡。
3. 首次用户发一条完整地址文本 → 一次解析成功并进确认卡；缺门牌时只追问门牌。
4. 地址属于另一城市时，自动切换租户、按新渠道重搜、编号重建，并提示切换。
5. 下单成功消息包含订单号、商品、金额、预计送达、支付链接。
6. `minOrderAmount` 不足时阻止下单并给出差额。
7. 配送校验异常时不下单，返回可重试文案。
8. 同一 MsgId 重复投递不重复建单。
9. 全部新增纯函数单测通过；`assistant-flow` 覆盖 4 条主路径与 4 条异常路径。

## 13. 测试计划

- 单测：`address-parser`（10 组文本）、`tenant-router`（精度排序/多候选）、`city-catalog`（三来源优先级）。
- 流程测试（stub）：本渠道命中、跨渠道切换、超范围、缺字段补问、起送价不足、校验异常。
- 线上冒烟：三城市（含一个超范围地址）各 1 次完整下单，核对渠道归属、编号重建、通知文案。
- 回归：现有搜索/地址簿/客服/留言用例全部通过。

## 14. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| 城市索引数据缺失（渠道/门店未配） | 无法匹配租户 | 回退到公众号默认渠道，仅做范围提示 |
| 切渠道重搜导致编号变化，用户困惑 | 体验下降 | 文案明确「已切换店铺，请重新回复编号」 |
| `DeliveryRange` 与门店半径口径冲突 | 判定不一致 | 明确优先级并记录判定来源到日志 |
| 状态推送打扰 | 用户投诉 | 只推关键三态，失败不重试刷屏 |
| 回滚 | — | 新增逻辑集中在守卫与路由服务，可通过开关 `ASSISTANT_CITY_ROUTING=off` 回退到原流程 |
