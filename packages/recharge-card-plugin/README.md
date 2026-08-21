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