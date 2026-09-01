# 到店自提核销闭环与商户订单可见性 · 设计文档

> **日期**：2026-09-01
> **版本**：v1
> **范围**：完善「到店自提」从下单 → 支付/收款 → 发货 → 扫码核销 → 商户可见 的完整闭环

---

## 0. 背景与三个待解决项

1. **订单归属租户 / 商户订单可见性**：商户商品经平台审批挂到默认商城后，在默认商城下单的订单归属「默认商城渠道」，不属于商户自身渠道；而 web-admin 订单列表用当前登录租户的渠道 token 做过滤，导致「商户在后台订单里看不见自己商品在商场卖出的订单」。
2. **扫码核销入口缺失**：核销页 `web-admin/src/pages/pickup/redeem/index.vue` 只有手动输入核销码，没有扫码。扫码工具 `scanner.ts` 已就绪但未复用。
3. **到店支付 / 线上支付未区分**：系统只区分了「自提/配送」与核销码状态（`generated/redeemed/void`）、核销来源（`customer/shop`），**没有记录「这笔单是否已收款」**。

> 用户对支付环节的硬性要求：
> - 我当前用的是**支付档案**（payment profile），设计上自提走「到店付款」；
> - **支付名称不重要**，重要的是「**是否已收款**」必须反映清楚；
> - 该状态是**发货环节是否收费的依据**，同时**防止忘记收款**。

因此本设计把「**收款状态（isCollected）**」作为自提单上的唯一事实来源，其余一切（发货闸门、核销录入、商户视角）都围绕它展开。

---

## 1. 核心概念：收款状态 = 唯一事实来源

对每一笔自提（pickup）订单，定义并维护一句话即可表达的字段：

```
收款状态 isCollected : boolean   // true=已收款；false=未收款（待到店收款）
```

**判定来源（issuer of truth，二者取其一，不冲突）：**

| 支付类型 paymentType | isCollected 判定 | 说明 |
|---|---|---|
| `online`（微信/支付宝/余额等线上支付） | = 订单支付已 **Settled**（真实扣款成功） | 下单即付款，无需到店收银 |
| `cod`（到店付款，如现金/扫码当面收） | = 订单记录中「到店已收款」标记为 true | 下单不致付款，到店/发货时收 |

**关键约定：**
- `paymentType` 来自**支付档案**（PaymentMethod/配送档案所绑支付档案白名单），**不依赖支付名称**（名称可随意叫「到店付款/货到付款/店内支付」等）。
- web-admin 发货、核销、C 端订单详情，一律**先读 `isCollected`** 判断是否需要收费。
- **防漏收**：凡是 `cod` 且 `isCollected=false` 的单，在「发货」与「核销完成」两个动作上强制停留提示，只有收款完成（或显式确认）才放行。

---

## 2. 前端扫码核销入口（项 2）

**目标**：核销页在「手动输入核销码」基础上，增加「扫一扫」扫码核销。

**改动**：`web-admin/src/pages/pickup/redeem/index.vue`
- 新增「扫一扫」按钮，点击调用 `scanner.ts` 的 `scanCode()`。
- `scanCode()` 语义（已具备）：
  - H5：自管理摄像头 + zxing 解码（可识别二维码/一维码）；
  - 小程序/App：`uni.scanCode` 原生；
  - 微信内置 / 无摄像头 / 取消 / 失败 → `reject ScannerError{code}`，代码分流：
    - `MANUAL` → 提示并聚焦到手动输入框；
    - `CANCEL` → 无操作返回；
    - `FAILED` → toast「无法打开相机，请允许权限或改用输入」。
- 识别到码：`code.value = result`，自动触发 `onClaim()` 核销（成功 toast + 刷新列表）。

**核销动作顺带钩住收款**（见 §3）：扫码/手动核销时，若该自提 `paymentType=cod && !isCollected`，弹出「收款确认」，确认后写 `isCollected=true` 并完成核销（防漏收）。

---

## 3. 到店支付 / 线上支付区分 + 收款状态（项 3 · 核心）

### 3.1 支付类型标注（后端）

- 给支付方式/支付档案补充 `paymentType` 标注：`online` | `cod`。
- `cash-on-delivery`（货到付款）handler 已在 `cjk-plugin/src/payment/cod-handler.ts`，其 `createPayment` 生成 `Authorized`（不真实扣款），`settlePayment` 待门店确认后 Settled——**正好作为「到店付款」的正式入口**。
- 线上支付（微信/支付宝/余额）标 `online`。

> 注意：**不改支付名称**，仅新增类型标注与「是否已收款」驱动逻辑。此标注挂在支付档案/方法元数据上供上层读取。

### 3.2 数据模型

- `PickupRedemption`（`pickup-plugin/src/pickup-redemption.entity.ts`）新增：
  - `paymentType?: 'online' | 'cod' | null`（快照下单时的支付类型）
  - `collected?: boolean`（= 该单是否已收款；`online` 恒为 true，`cod` 由收银确认写入）
- `PaymentMethod` 元数据加 `paymentType`（或行为版本定义的 handler 级常量）。
- 订单/核销凭据对外下发 `isCollected` 与 `paymentType`（web-admin API + C 端 order query）。

### 3.3 发货环节收费闸门（防漏收的核心）

- `web-admin` 订单发货/履约动作（`order/ship`）与后端 fulfillment 转换前，读取该自提单 `isCollected`：
  - `online` → 已收款，正常发货；
  - `cod && !isCollected` → **阻断/醒目提示**：
    - 单据标记「待到店收款」；
    - 提供「收款并发货」（点击弹收款确认 → 写 `isCollected=true` → 放行发货）与「先发货并提醒」（显式确认，提单提示未收款、防遗忘）两条路径，默认推荐前者。
- 该逻辑同时覆盖「发货即履约」的普通物流自提，确保不因漏收款而白发货。

### 3.4 核销即确认收款

- 核销完成（`commitRedeem`）时，若 `paymentType=cod && !collected`：
  - 同一动作内弹出「到店收款确认」；
  - 确认后写 `collected=true`，再完成核销与 fulfillment Delivered。
- 确保「核销完了却没收钱」永远不会静默发生。

### 3.5 展示

- **web-admin 核销页 / 订单详情**：每条自提单显示「已收款 ✓ / 待到店收款」，`cod` 单突出「待收款」徽标。
- **C 端订单详情**（`OrderMetaCard`）：显示「线上支付」或「待到店支付」及收款状态。

---

## 4. 商户订单可见性（项 1）

**目标**：让商户在自己后台能看到「本店商品在默认商城售出」的订单，并能核销、发货。

**方案**：web-admin 订单列表增加「本店商品订单」维度，按订单行商品 `productVariant.product.shopId` 归集——与核销 `orderBelongsToShop`、结算按店拆账**同一判据**。

**改动要点（后端为主）**
- 在 merchant/admin 侧新增（或扩展现有 order 查询）「归属本店」过滤：`orders(filter: { 含本店 shopId 商品 })`，返回订单行中含本店商品的订单。
- web-admin 订单列表加 tab/筛选项「本店商品」，默认还是「本店渠道单」，二者并存：
  - 本店渠道单：现状（含普通自营/本店销售）；
  - 本店商品单：含本店商品的行（含默认商城售出单）。
- 与 `myPickupOrders` 待核销对齐，保证商户核销待办里能看到这些单的提货码。

> 说明：这是「商户视图归集」，**不改动默认商城订单的真实归属**（订单仍属默认商城渠道，用于结算/对账）；仅把「含本店商品的订单」在商户后台可见、可操作。

---

## 5. 数据流 / 错误处理 / 测试

### 数据流（cod + pickup）
```
下单(pickup, 支付档案→paymentType=cod)
  → Payment createPayment → Authorized（不真实扣款，paymentType=cod 记录）
  → isCollected = false，生成提货码 PickupRedemption(paymentType=cod, collected=false)
  → 备货 → Shipped
  → 商家发货前读 isCollected=false → 提示「待到店收款」→ 收款确认 → collected=true
  → 扫码/手输核销 → commitRedeem 校验已收款（cod 未收先弹收银）→ Delivered
```

### 错误处理
- 扫码 `scanner.ts` 各类失败按 `ScannerError.code` 分流（MANUAL/CANCEL/FAILED），不回退成诡异状态。
- 收款确认超时/取消：不行驶发货，保持 `isCollected=false`，提示「未收款订单不可发货」。
- 跨店核销：沿用 `orderBelongsToShop` Forbidden 拦截。
- 收藏状态写入失败按事务回滚，避免「已收款未核销」或「已核销未收款」不一致。

### 测试/回归
- 扫码核销：H5 摄像头识别 & 手输回落；识别后自动核销正确。
- cod pickup：发货前未收款被拦 → 收款后可发货；核销时自动收银确认。
- online pickup：下单即已收款，发货/核销不再重复收费。
- 商户订单可见性：默认商城售出的本店商品单，在商户后台「本店商品单」列表可见且可核销。

---

## 6. 交付边界（YAGNI）
- 不做支付名称改造（名称不重要）。
- 不做「分单/拆账」重构，商户可见性为归集视图，不改订单归属。
- 不做在线支付回调重构（沿用现状）。