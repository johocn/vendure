# AlipayPlugin

支付宝支付插件，支持 PC 页面支付和手机网站支付。

## 概述

`AlipayPlugin` 为 Vendure 提供支付宝支付能力，支持以下交易类型：

- **PAGE**（PC 页面支付）：用户在电脑浏览器中完成支付，支付宝返回 HTML 表单，前端提交后跳转至支付宝收银台。
- **WAP**（手机网站支付）：用户在手机浏览器中完成支付，同样通过 HTML 表单跳转。

插件通过 Vendure 的 `PaymentMethodHandler` 机制接入，创建支付时返回 `payForm`（HTML 表单字符串），前端直接提交即可跳转至支付宝完成支付。支付结果通过支付宝异步通知回调确认。

## 安装

```bash
npm install @vendure/alipay-plugin
```

或

```bash
yarn add @vendure/alipay-plugin
```

## 前置准备

### 1. 注册支付宝开放平台账号

前往 [支付宝开放平台](https://open.alipay.com/) 注册企业账号并完成认证。

### 2. 创建应用

1. 登录支付宝开放平台，进入「开发者中心」→「网页/移动应用」。
2. 点击「创建应用」，选择「网页应用」或「移动应用」。
3. 填写应用名称等信息，提交审核。

### 3. 签约支付产品

1. 在应用详情页，点击「添加能力」→ 选择「电脑网站支付」（PAGE）或「手机网站支付」（WAP）。
2. 填写商户信息，提交签约审核。
3. 审核通过后，应用即可调用对应支付接口。

### 4. 配置密钥

1. 在应用详情页，点击「设置」→「开发设置」。
2. 使用 [支付宝密钥工具](https://opendocs.alipay.com/common/02kipk) 生成 RSA2 密钥对。
3. 上传应用公钥，获取支付宝公钥（用于验签）。
4. 记录以下信息，后续配置需要使用：
   - **APPID**：应用 ID
   - **应用私钥**：生成的 RSA2 私钥
   - **支付宝公钥**：上传应用公钥后获取

## 配置

插件配置分为两部分：**插件初始化配置**（代码层面）和 **PaymentMethod 配置**（Admin UI 层面）。

### 插件初始化配置

在 `vendure-config.ts` 中配置插件：

```ts
import { AlipayPlugin } from '@vendure/alipay-plugin';

const config: VendureConfig = {
  plugins: [
    AlipayPlugin.init({
      notifyUrl: 'https://your-domain.com/alipay/notify',
      returnUrl: 'https://your-domain.com/order/result',
      signType: 'RSA2',
      alipayPublicKey: '支付宝公钥',
    }),
  ],
};
```

#### 配置项说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `notifyUrl` | `string` | 是 | - | 支付结果异步通知地址，必须为公网可访问的 HTTPS 地址 |
| `returnUrl` | `string` | 否 | - | 支付完成后前端跳转地址 |
| `signType` | `'RSA2' \| 'RSA'` | 否 | `'RSA2'` | 签名类型，推荐使用 RSA2 |
| `alipayPublicKey` | `string` | 是 | - | 支付宝公钥，用于验签异步通知 |

### PaymentMethod 配置（Admin UI）

在 Vendure Admin UI 中创建 PaymentMethod 时，选择 `alipay` 处理器，并填写以下参数：

| 参数 | 说明 |
|------|------|
| `appId` | 支付宝应用 ID（APPID） |
| `privateKey` | 应用私钥（RSA2 私钥） |
| `tradeType` | 交易类型：`PAGE`（PC 页面支付）或 `WAP`（手机网站支付），默认 `PAGE` |

#### 操作步骤

1. 登录 Admin UI，进入「Settings」→「Payment Methods」。
2. 点击「Create new Payment Method」。
3. 填写名称（如「支付宝支付」）。
4. Handler 选择 `alipay`。
5. 填写 `appId`、`privateKey`、`tradeType`。
6. 保存。

## 支付流程详解

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端     │     │ Vendure  │     │  支付宝   │     │  支付宝   │
│  商城     │     │  服务器   │     │  开放平台  │     │  异步通知  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                 │                │                │
     │ 1. addPayment   │                │                │
     │────────────────>│                │                │
     │                 │ 2. alipay.trade.page.pay / wap.pay
     │                 │───────────────>│                │
     │                 │                │                │
     │                 │ 3. 返回 HTML 表单 (payForm)      │
     │                 │<───────────────│                │
     │ 4. 返回 metadata│                │                │
     │  { payForm, payType }           │                │
     │<────────────────│                │                │
     │                 │                │                │
     │ 5. 提交表单跳转支付宝收银台       │                │
     │────────────────────────────────>│                │
     │                 │                │                │
     │ 6. 用户完成支付  │                │                │
     │                 │                │                │
     │                 │                │ 7. 异步通知     │
     │                 │<───────────────────────────────│
     │                 │ 8. 验签 + 更新订单状态           │
     │                 │                │                │
     │ 9. returnUrl 跳转（可选）        │                │
     │<────────────────────────────────│                │
```

### 流程说明

1. **前端调用 `addPayment`**：用户在结算页确认支付，前端调用 Vendure Shop API 的 `addPaymentToOrder` mutation。
2. **服务端创建支付**：Vendure 调用支付宝 `alipay.trade.page.pay`（PAGE）或 `alipay.trade.wap.pay`（WAP）接口。
3. **支付宝返回表单**：支付宝返回一段 HTML 表单字符串。
4. **返回 metadata**：Vendure 将 `payForm` 和 `payType` 放入 Payment 的 metadata 返回给前端。
5. **前端提交表单**：前端将 `payForm` 写入页面并提交，用户跳转至支付宝收银台。
6. **用户完成支付**：用户在支付宝收银台完成付款。
7. **异步通知**：支付宝向 `notifyUrl` 发送支付结果通知。
8. **验签并更新订单**：Vendure 验证签名后，将订单状态更新为 `PaymentSettled`。
9. **跳转回商城**：用户支付完成后，支付宝引导用户跳转至 `returnUrl`。

## GraphQL API 参考

### 创建支付

```graphql
mutation AddAlipayPayment {
  addPaymentToOrder(
    input: {
      method: "alipay"
      metadata: {}
    }
  ) {
    ... on Order {
      id
      state
      payments {
        id
        metadata
      }
    }
    ... on PaymentFailed {
      errorCode
      message
    }
  }
}
```

### 返回的 metadata 结构

创建支付成功后，Payment 的 `metadata` 中包含以下字段：

```ts
{
  payForm: string;   // 支付宝返回的 HTML 表单字符串
  payType: 'page' | 'wap';  // 支付类型
}
```

- `payForm`：一段完整的 HTML 表单，包含自动提交脚本，前端写入页面即可自动跳转。
- `payType`：`page` 对应 PC 页面支付，`wap` 对应手机网站支付。

## 前端集成示例

### React 示例

```tsx
const [addPayment, { data }] = useMutation(ADD_PAYMENT_MUTATION);

const handlePay = async () => {
  const result = await addPayment({
    variables: {
      input: { method: 'alipay', metadata: {} },
    },
  });

  const payment = result.data.addPaymentToOrder.payments[0];
  const { payForm, payType } = payment.metadata;

  if (payForm) {
    // 将 HTML 表单写入页面并提交
    const div = document.createElement('div');
    div.innerHTML = payForm;
    document.body.appendChild(div);
    const form = div.querySelector('form');
    if (form) {
      form.submit();
    }
  }
};
```

### Vue 示例

```vue
<script setup>
const handlePay = async () => {
  const result = await addPayment({
    variables: { input: { method: 'alipay', metadata: {} } },
  });

  const { payForm, payType } = result.data.addPaymentToOrder.payments[0].metadata;

  if (payForm) {
    const div = document.createElement('div');
    div.innerHTML = payForm;
    document.body.appendChild(div);
    const form = div.querySelector('form');
    if (form) form.submit();
  }
};
</script>
```

### 处理支付结果

用户支付完成后，支付宝会引导跳转至 `returnUrl`。前端在 `returnUrl` 页面查询订单状态：

```graphql
query GetOrder {
  activeOrder {
    id
    state
    payments {
      state
    }
  }
}
```

> **注意**：`returnUrl` 仅用于前端跳转，不能作为支付成功的判断依据。必须以异步通知的结果为准。

## 异步通知说明

支付宝会在支付完成后向 `notifyUrl`（`POST /alipay/notify`）发送异步通知。

### 通知处理流程

1. 支付宝发送 POST 请求到 `notifyUrl`，请求体包含支付结果参数。
2. 插件使用 `alipayPublicKey` 验证签名，确保通知来自支付宝。
3. 验签通过后，根据 `trade_status` 判断支付结果：
   - `TRADE_SUCCESS`：支付成功，更新订单状态。
   - `TRADE_FINISHED`：交易完结（退款期限过后），不触发状态变更。
4. 插件返回 `success` 字符串给支付宝，表示通知处理成功。

### 注意事项

- `notifyUrl` 必须为公网可访问的 HTTPS 地址。
- 支付宝会在 24 小时内多次重发通知（频率：4m、10m、10m、1h、2h、6h、15h），直到收到 `success` 响应。
- 插件已内置幂等处理，重复通知不会导致重复确认。

## 退款流程

退款通过 Vendure 原生退款流程触发，插件内部自动调用支付宝 `alipay.trade.refund` 接口。

### 操作方式

1. 在 Admin UI 中进入订单详情页。
2. 点击「Refund」按钮，填写退款金额。
3. 确认退款后，Vendure 调用支付宝退款接口完成退款。

### GraphQL 退款

```graphql
mutation Refund {
  refundOrder(input: {
    orderId: "1",
    lines: [],
    shipping: 0,
    adjustment: 0,
    paymentId: "1",
    reason: "用户申请退款"
  }) {
    ... on Refund {
      id
      state
      total
    }
    ... on Payment {
      id
      refunds {
        id
        state
        total
      }
    }
  }
}
```

> 退款会原路返回至用户支付宝账户，一般即时到账。

## 注意事项

1. **沙箱环境**：开发阶段可使用支付宝沙箱环境进行测试，沙箱地址为 `openapi.alipaydev.com`，需在插件配置中切换网关地址（如有支持）。
2. **HTTPS 要求**：`notifyUrl` 必须为 HTTPS，支付宝不支持 HTTP 回调地址。
3. **金额单位**：Vendure 内部金额以最小单位（分）存储，插件会自动转换为支付宝要求的元单位。
4. **订单号**：插件使用 Vendure Payment 的 `id` 作为支付宝 `out_trade_no`，确保唯一性。
5. **签名类型**：推荐使用 `RSA2`（SHA256WithRSA），`RSA`（SHA1WithRSA）已不推荐。
6. **交易类型选择**：`PAGE` 适用于 PC 端，`WAP` 适用于移动端。如果移动端使用 `PAGE` 类型，支付宝会自动适配，但体验不如 `WAP`。
7. **多渠道配置**：如果需要同时支持 PC 和移动端支付，可以创建两个 PaymentMethod，分别配置 `tradeType` 为 `PAGE` 和 `WAP`。
