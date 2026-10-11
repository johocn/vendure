# 订单查看配送档案过滤 + 新订单语音/横幅提醒 设计

日期：2026-10-11
状态：已评审（版式 A 已确认）
范围：d:\zhao\vendure（cjk-plugin 后端）+ d:\zhao\vshop\web-admin（管理后台前端）

## 1. 背景与现状检查结论

### 1.1 核销侧：已按配送档案约束（无需改动）

- `cjk-plugin/src/tenant/redeem-scope.service.ts`：受限核销员（持有 VerifyOrder 权限且非超管）读取
  `TenantMember.shippingProfileIds` 生成白名单；`orderInScope()` 要求订单**所有商品行**的
  `productVariant.customFields.shippingProfileId` 都在白名单内。
- `cjk-plugin/src/redemption/redemption.resolver.ts` 四个入口全覆盖（pendingPickupOrders /
  redemptionLookup / claim / reissue），均走 `inScope()`，范围外按「查不到」处理。
- web-admin 前端已有同模式判定先例：`pages/pickup/redeem/index.vue`、`pages/in-store/bills/index.vue`
  （`restricted = !isSuperAdmin && permissions.includes('VerifyOrder')`）。

### 1.2 订单查看侧：缺口（本设计补齐）

- web-admin 订单列表页（`pages/order/list/index.vue`）仅有「本店渠道单 / 本店商品单」店铺范围切换
  （`components/order-list/OrderListScope.vue`），无配送档案过滤；受限核销员可看到档案范围外订单。

### 1.3 新订单提醒：空白（本设计新增）

- web-admin 无任何轮询/推送/声音/文字提醒机制。

## 2. 已确认的产品决策

| 决策点 | 结论 |
|---|---|
| 订单查看约束方式 | 方案 A：受限核销员看到与普通列表相同的完整结构（状态分组/筛选/统计），数据按配送档案白名单过滤 |
| 提醒接收范围 | 按权限联动：受限核销员只收档案范围内新订单提醒；其他后台用户收本店渠道全部 |
| 提醒形式 | TTS 语音播报 + 文字横幅 + 未读角标 |
| 生效范围 | 登录后全局（任意页面），App.vue 启动，DOM 注入挂 body |
| 提醒 UI 版式 | 版式 A：横幅 + 常驻铃铛角标（语音开关在铃铛菜单内） |
| 实现路线 | 方案一：前端轮询（30s）+ 后端 scoped 查询；不做 WebSocket、不做通知落库 |

## 3. 功能 1：订单查看按配送档案过滤

### 3.1 后端（cjk-plugin 新增 `order-scope` 模块，目录 `packages/cjk-plugin/src/order-scope/`）

**OrderScopeService**
- `resolveScope(ctx)`：复用 `RedeemScopeService` 的判定逻辑——ctx 用户含 VerifyOrder 权限且非超管
  → `restricted=true`，白名单 = 该渠道下 `TenantMember.shippingProfileIds`；否则 `restricted=false`。
- `scopedOrders(ctx, options)`：
  - unrestricted：等价原生 orders 查询（TypeORM QB），支持 state 集合、下单时间范围、关键词
    （订单号/客户名/手机号）、`take/skip` 分页，返回 `{ items, totalItems }`。
  - restricted：在 unrestricted 条件上叠加 `NOT EXISTS` 子查询——订单存在**任一行**
    `productVariant.customFields->>'shippingProfileId'` 为空或不在白名单 → 整单排除
    （与核销 `orderInScope()` 的「所有行都在白名单」语义一致）。
- `scopedOrderCounts(ctx, filter)`：各状态分组计数，复用同一过滤条件。
- 返回行结构对齐 web-admin `apis/order.ts` 的 `OrderRow` 所需字段（id/code/state/totalWithTax/
  totalQuantity/createdAt/orderPlacedAt/customer/shippingAddress/lines/productVariant/featuredAsset/
  shippingLines/payments/customFields.deliveryType+pickupClaimed），前端渲染层零改动。

**OrderScopeResolver（admin-api）**
- `scopedOrders(options: ScopedOrderListOptions!): OrderList!` —— 复用 Vendure 原生 `OrderList` 类型。
- `scopedOrderCounts(filter: ScopedOrderFilterInput): ScopedOrderCounts!` —— 各状态计数 map。
- 入参对齐 web-admin `buildOrderFilter` 所需子集，不复制原生 orders 的全部 filter 能力（YAGNI）。
- 权限：SuperAdmin / ReadOrder；restricted 判定在 service 内进行（不依赖前端传参，防越权）。

### 3.2 前端（web-admin）

- `apis/order.ts`：新增 `fetchScopedOrders(options)` / `fetchScopedOrderCounts(filter)`，
  返回与现有 `fetchOrders` / `fetchOrderCounts` 同构。
- `pages/order/list/index.vue`：
  - restricted 判定复用既有模式（`!auth.isSuperAdmin && auth.permissions.includes('VerifyOrder')`）。
  - restricted 时：数据源切到 `fetchScopedOrders / fetchScopedOrderCounts`；**隐藏「本店渠道单/商品单」
    切换条**（商品单走 myShopOrders 跨渠道归集，无法按档案过滤，必须关闭该越权入口）；
    顶部显示「已按配送档案过滤」胶囊提示（i18n 文案）。
  - 列表结构（状态分组 tab、筛选、统计块、行操作）完全不变，统计数字自然为档案范围内的值。
  - 普通管理员/超管视图与现状完全一致。
- i18n：zh-Hans / en（及其他既有语言包）同步新增胶囊等词条。

## 4. 功能 2：新订单全局提醒

### 4.1 后端（同一 `order-scope` 模块）

- `newOrderSignal(since: DateTime!): NewOrderSignal!` → `{ count: Int!, latestPlacedAt: DateTime }`。
- 统计 `orderPlacedAt > since` 的订单数；restricted 按与 scopedOrders 相同的白名单过滤，
  unrestricted 为本店渠道全部——提醒范围与列表过滤天然一致。
- 无事件监听、无落库（轻量信号查询）。

### 4.2 前端（web-admin 全局提醒 Hub）

- 新增 `utils/orderAlertHub.ts`；`App.vue onLaunch`（H5 环境且已登录）启动。
  复用 `utils/h5Nav.ts` 的 DOM 注入模式把提醒 UI（横幅 + 铃铛）挂到 body，任意页面全局生效。
- 轮询策略：
  - 每 30s 调 `newOrderSignal(since=lastPlacedAt)`；
  - `document.hidden` 时暂停；`visibilitychange` 恢复可见时立即查一次；
  - `localStorage` 记 `orderAlertLastPlacedAt`，刷新后不重播旧订单。
- 触发动作（count 增长时）：
  - TTS 语音播报（`window.speechSynthesis`，zh-CN）：「您有新的订单，请及时处理」；
    首次用户交互时预解锁以规避浏览器自动播放限制；TTS 不可用时降级为仅横幅。
  - 顶部横幅滑入：「您有 N 笔新订单」+「查看」（跳订单列表）+ 关闭按钮；8 秒自动收起。
  - 右下角常驻铃铛角标：未读计数；点击弹小菜单——「语音播报 开/关」「前往订单列表」。
- 静音开关：`localStorage` 持久化 `orderAlertMuted`；静音时只弹横幅+角标，不播语音。
- 生命周期：登出/切换账号时重置 Hub（清 timer、清 lastPlacedAt、移除 DOM）。
- 多语言：横幅/菜单文案走 i18n，zh-Hans / en 等语言包同步补词条。

## 5. 边界与错误处理

- 白名单为空的受限核销员：列表与提醒均为空（与核销现状一致）。
- 订单含多商品行且跨档案：整单排除（与 `orderInScope()` 语义一致）。
- 轮询请求失败：静默重试下一轮，不打扰用户；连续失败不弹错误。
- TTS 队列：播报前 `speechSynthesis.cancel()`，避免堆积。
- 多标签页：各自独立轮询（不做 BroadcastChannel 去重，YAGNI；未来可加）。
- since 窗口：以服务端返回 `latestPlacedAt` 滑动推进，时钟偏差不影响正确性（首次以本地当前时间起查）。

## 6. 测试与验收

- 后端单测（`OrderScopeService`）：混合档案订单排除 / 全白名单保留 / 空白名单全排除 /
  unrestricted 透传 / 分页 totalItems 正确。
- 后端 e2e：`scopedOrders`、`scopedOrderCounts`、`newOrderSignal` 三查询 × restricted/unrestricted 双角色。
- 前端验收：手机视口 390×844 dpr=2 截图 + 桌面截图，补充到操作手册；
  手工验证真实下单 → ≤30s 内横幅 + 语音；静音开关生效；刷新不重播。
- 回归：现有核销四入口、普通管理员订单列表、in-store 流水页不受影响。

## 7. 明确不做（YAGNI）

- WebSocket / SSE 实时推送（30s 轮询满足后台场景）。
- 通知中心实体与历史通知列表。
- 多标签页去重、提醒已读同步。
- 提醒范围的自定义配置（按权限自动决定）。
