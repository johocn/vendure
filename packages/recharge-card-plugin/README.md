# @vendure/recharge-card-plugin

会员储值余额钱包（Phase 33：本地电商就近履约）。

## 能力

- **充值卡兑充**：`createRechargeCardBatch`（批量卡 + 明文 PIN）+ `redeemRechargeCard(code, pin)` 充值入余额。
- **充值单**：`createRechargeOrder` / `payRechargeOrder` / `cancelRechargeOrder`，状态机 `pending → paid | cancelled`，支付**幂等**（重复 pay 返回当前状态，不重复入账）。
- **余额支付**：注册 `balance-pay` 支付方式，订单结算时扣减余额并记流水。
- **流水**：`myBalanceTransactions`（shop）/ `customerBalanceTransactions`（admin）全量余额变动。
- **余额管理**（admin）：`customerBalances` 列表 + `adminAdjustBalance` 手工加/扣（余额不足原子拦截）。
- **支付安全**：`isOrderBalancePaid` 防重复扣减；退款受 `getOrderBalanceConsumed` 上限约束；余额不足抛 `Insufficient balance`。

## customerId 口径约定（重要）

余额所有入口一律使用 **`Customer.id`**（统一经 `resolveCustomerId` 解析），**禁止**直接用 `ctx.activeUserId`（`User.id`）落余额，避免同一账户余额碎片化。源码索引 `grep -rn "activeUserId" packages/recharge-card-plugin/src` 应为空（除 `resolveCustomerId` 内用于解析顾客）。

## 网关接入点

`RechargeOrder` 预留 `paymentMethod` 字段（alipay/wechat 等网关联调）。

- **入账**：第三方网关回调成功后，调用 `payRechargeOrder`（幂等，原子 claim `pending → paid`）完成入账。
- **下单**：前端先 `createRechargeOrder(amount)` 建单，再用 `order.id` 发起网关支付。
- **取消**：未支付前可 `cancelRechargeOrder`。

## 在线充值（微信支付网关，Phase 34）

前置：根 `plugins` 数组需同时注册 `RechargeCardPlugin.init()` 与 `WechatpayPlugin.init({...})`。recharge 插件**不** import 网关模块，而是在 bootstrap 用 `ModuleRef` + `new Injector(...)` + try/catch 可选取到 `WechatpayService` / `WechatpaySettlementRegistry`（未注册网关时充值支付提示「Payment gateway not configured」，卡密/余额功能不受影响）。

- **建支付**：`createWechatRechargePayment(rechargeOrderId, tradeType?, openid?)`，仅本人 **pending** 单可建；回写 `paymentMethod='wechatpay'` + `externalRef`（`RC-<id>`），返回 `{ rechargeOrderId, outTradeNo, pay }` 支付参数（JSAPI 需传 `openid`）。
- **入账**：微信回调落到网关 → 按 `out_trade_no` 前缀 `RC-` 命中结算注册表 → `settleRechargeOrderByOutTradeNo` 原子 `pending → paid` + 记 `RECHARGE` 流水 + 余额到账（admin ctx 无 activeUser，用单归属 `customerId` 显式入账）。
- **幂等**：重复回调/重复结算被 `UPDATE ... WHERE status='pending'` 拦截，余额不重复增加。
- **越权**：他人单 / 已支付单再次建支付被拒。

## 测试

```powershell
$env:PACKAGE = 'recharge-card-plugin'
npx vitest run --config packages/recharge-card-plugin/vitest.config.mts packages/recharge-card-plugin/e2e/recharge-card.e2e-spec.ts
```

## 部署铁律

**本地构建**后提交 `lib/` 产物入库；服务器只执行 `git pull` + `pm2 restart`，**绝不在服务器构建**（内存不足会失败）。

```powershell
# 本地重建 lib（在仓库根）
npx tsc -p packages/recharge-card-plugin/tsconfig.build.json
```