# WechatpayPlugin

微信支付插件，支持 JSAPI 支付、Native 支付、APP 支付和 H5 支付。

## 概述

`WechatpayPlugin` 为 Vendure 提供微信支付能力，支持以下交易类型：

- **JSAPI**：微信公众号/小程序内支付，需要用户的 openid。
- **NATIVE**：扫码支付，生成二维码链接，用户扫码完成支付。
- **APP**：APP 内支付，返回预支付 ID，客户端调起微信 SDK 完成支付。
- **H5**：手机浏览器内支付，返回支付链接，用户跳转至微信完成支付。

插件通过 Vendure 的 `PaymentMethodHandler` 机制接入，根据不同交易类型返回对应的支付参数，前端据此调起支付。支付结果通过微信支付异步通知回调确认。

## 安装

```bash
npm install @vendure/wechatpay-plugin
```

或

```bash
yarn add @vendure/wechatpay-plugin
```

## 前置准备

### 1. 注册微信商户平台

1. 前往 [微信商户平台](https://pay.weixin.qq.com/) 注册商户号。
2. 完成商户资质审核，获取 **mchId**（商户号）。

### 2. 注册微信开放平台 / 公众平台

根据支付场景选择对应平台：

| 支付类型 | 注册平台 | 需获取的信息 |
|---------|---------|------------|
| JSAPI | [微信公众平台](https://mp.weixin.qq.com/) | 公众号 appId、用户 openid |
| NATIVE | [微信公众平台](https://mp.weixin.qq.com/) 或 [微信开放平台](https://open.weixin.qq.com/) | appId |
| APP | [微信开放平台](https://open.weixin.qq.com/) | appId |
| H5 | [微信公众平台](https://mp.weixin.qq.com/) 或 [微信开放平台](https://open.weixin.qq.com/) | appId |

### 3. 绑定商户号

在对应平台中将 appId 与商户号 mchId 进行绑定。

### 4. 申请 API 证书

1. 登录微信商户平台，进入「账户中心」→「API 安全」。
2. 申请并下载 API 证书，获取：
   - **证书文件**（apiclient_cert.pem）
   - **证书序列号**（serialNo）
3. 设置 **APIv3 密钥**（apiKey），用于回调通知验签。

### 5. 获取密钥

1. 生成商户 RSA 密钥对（私钥由商户保管，公钥上传至微信商户平台）。
2. 下载微信平台公钥（用于验证微信回调签名）。
3. 记录以下信息，后续配置需要使用：
   - **appId**：应用 ID
   - **mchId**：商户号
   - **publicKey**：微信平台公钥（PEM 格式）
   - **privateKey**：商户私钥（PEM 格式）
   - **apiKey**：APIv3 密钥
   - **serialNo**：证书序列号

## 配置

插件配置分为两部分：**插件初始化配置**（代码层面）和 **PaymentMethod 配置**（Admin UI 层面）。

### 插件初始化配置

在 `vendure-config.ts` 中配置插件：

```ts
import { WechatpayPlugin } from '@vendure/wechatpay-plugin';

const config: VendureConfig = {
  plugins: [
    WechatpayPlugin.init({
      notifyUrl: 'https://your-domain.com/wechatpay/notify',
      certPath: '/path/to/apiclient_cert.pem',
      // 或者使用 certBuffer（与 certPath 二选一）
      // certBuffer: fs.readFileSync('/path/to/apiclient_cert.pem'),
    }),
  ],
};
```

#### 配置项说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `notifyUrl` | `string` | 是 | - | 支付结果异步通知地址，必须为公网可访问的 HTTPS 地址 |
| `certPath` | `string` | 否 | - | 证书文件路径（与 certBuffer 二选一） |
| `certBuffer` | `Buffer` | 否 | - | 证书 Buffer（与 certPath 二选一，适用于容器化部署） |

> **提示**：`certPath` 和 `certBuffer` 提供的是商户 API 证书，用于退款等需要双向认证的接口。如果仅使用支付功能，可以不配置证书，但退款功能将不可用。

### PaymentMethod 配置（Admin UI）

在 Vendure Admin UI 中创建 PaymentMethod 时，选择 `wechatpay` 处理器，并填写以下参数：

| 参数 | 说明 |
|------|------|
| `appId` | 微信应用 ID |
| `mchId` | 商户号 |
| `publicKey` | 微信平台公钥（PEM 格式） |
| `privateKey` | 商户私钥（PEM 格式） |
| `apiKey` | APIv3 密钥 |
| `serialNo` | 证书序列号 |
| `tradeType` | 交易类型：`JSAPI` / `NATIVE` / `APP` / `H5`，默认 `JSAPI` |

#### 操作步骤

1. 登录 Admin UI，进入「Settings」→「Payment Methods」。
2. 点击「Create new Payment Method」。
3. 填写名称（如「微信支付」）。
4. Handler 选择 `wechatpay`。
5. 填写 `appId`、`mchId`、`publicKey`、`privateKey`、`apiKey`、`serialNo`、`tradeType`。
6. 保存。

## 支付流程详解

### NATIVE 支付流程（扫码支付）

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端     │     │ Vendure  │     │  微信支付  │     │  微信支付  │
│  商城     │     │  服务器   │     │  API      │     │  异步通知  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                 │                │                │
     │ 1. addPayment   │                │                │
     │────────────────>│                │                │
     │                 │ 2. 统一下单(NATIVE)              │
     │                 │───────────────>│                │
     │                 │ 3. 返回 code_url                │
     │                 │<───────────────│                │
     │ 4. 返回 metadata│                │                │
     │  { payUrl, payType: 'native' }  │                │
     │<────────────────│                │                │
     │                 │                │                │
     │ 5. 生成二维码展示│                │                │
     │                 │                │                │
     │                 │                │ 6. 异步通知     │
     │                 │<───────────────────────────────│
     │                 │ 7. 验签 + 更新订单状态           │
     │                 │                │                │
```

### JSAPI 支付流程（公众号/小程序支付）

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端     │     │ Vendure  │     │  微信支付  │     │  微信支付  │
│  商城     │     │  服务器   │     │  API      │     │  异步通知  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                 │                │                │
     │ 1. addPayment   │                │                │
     │  (metadata含openid)              │                │
     │────────────────>│                │                │
     │                 │ 2. 统一下单(JSAPI)              │
     │                 │───────────────>│                │
     │                 │ 3. 返回 prepay_id               │
     │                 │<───────────────│                │
     │ 4. 返回 metadata│                │                │
     │  { prepayId, payType: 'jsapi', appId }           │
     │<────────────────│                │                │
     │                 │                │                │
     │ 5. 调用 WeixinJSBridge 唤起支付   │                │
     │                 │                │                │
     │                 │                │ 6. 异步通知     │
     │                 │<───────────────────────────────│
     │                 │ 7. 验签 + 更新订单状态           │
     │                 │                │                │
```

### 流程说明

1. **前端调用 `addPayment`**：用户在结算页确认支付，前端调用 Vendure Shop API 的 `addPaymentToOrder` mutation。
2. **服务端统一下单**：Vendure 调用微信支付统一下单接口（`/v3/pay/transactions/native` 或 `/v3/pay/transactions/jsapi` 等）。
3. **微信返回支付参数**：根据交易类型返回 `code_url`（NATIVE/H5）或 `prepay_id`（JSAPI/APP）。
4. **返回 metadata**：Vendure 将支付参数放入 Payment 的 metadata 返回给前端。
5. **前端调起支付**：
   - **NATIVE**：使用 `payUrl` 生成二维码，用户扫码支付。
   - **H5**：跳转至 `payUrl`，用户在微信中完成支付。
   - **JSAPI**：使用 `prepayId` 和 `appId` 调用 WeixinJSBridge 唤起支付。
   - **APP**：使用 `prepayId` 调起微信 SDK 完成支付。
6. **异步通知**：微信支付向 `notifyUrl` 发送支付结果通知。
7. **验签并更新订单**：Vendure 验证签名后，将订单状态更新为 `PaymentSettled`。

## GraphQL API 参考

### 创建支付

#### NATIVE / H5 支付

```graphql
mutation AddWechatpayPayment {
  addPaymentToOrder(
    input: {
      method: "wechatpay"
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

#### JSAPI 支付（需要传入 openid）

```graphql
mutation AddWechatpayJsapiPayment {
  addPaymentToOrder(
    input: {
      method: "wechatpay"
      metadata: {
        openid: "用户的微信openid"
      }
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

根据交易类型不同，Payment 的 `metadata` 结构如下：

#### NATIVE

```ts
{
  payUrl: string;      // 二维码链接（code_url）
  payType: 'native';   // 支付类型
}
```

#### H5

```ts
{
  payUrl: string;      // H5 支付链接（h5_url）
  payType: 'h5';       // 支付类型
}
```

#### APP

```ts
{
  prepayId: string;    // 预支付 ID（prepay_id）
  payType: 'app';      // 支付类型
}
```

#### JSAPI

```ts
{
  prepayId: string;    // 预支付 ID（prepay_id）
  payType: 'jsapi';    // 支付类型
  appId: string;       // 微信应用 ID，用于前端调起支付签名
}
```

## 前端集成示例

### NATIVE 支付（扫码支付）

```tsx
import QRCode from 'qrcode.react';

const [addPayment, { data }] = useMutation(ADD_PAYMENT_MUTATION);

const handlePay = async () => {
  const result = await addPayment({
    variables: {
      input: { method: 'wechatpay', metadata: {} },
    },
  });

  const payment = result.data.addPaymentToOrder.payments[0];
  const { payUrl, payType } = payment.metadata;

  if (payType === 'native' && payUrl) {
    // 使用 payUrl 生成二维码
    setQrCodeUrl(payUrl);
  }
};

// 渲染二维码
return (
  <div>
    {qrCodeUrl && <QRCode value={qrCodeUrl} size={256} />}
    <p>请使用微信扫码支付</p>
  </div>
);
```

### JSAPI 支付（微信公众号内）

```tsx
const handlePay = async () => {
  const result = await addPayment({
    variables: {
      input: {
        method: 'wechatpay',
        metadata: { openid: userOpenid },
      },
    },
  });

  const payment = result.data.addPaymentToOrder.payments[0];
  const { prepayId, payType, appId } = payment.metadata;

  if (payType === 'jsapi' && prepayId) {
    // 需要后端生成签名后调起微信支付，以下为示意
    // 实际项目中需要调用后端接口获取签名参数
    WeixinJSBridge.invoke(
      'getBrandWCPayRequest',
      {
        appId,
        timeStamp: String(Math.floor(Date.now() / 1000)),
        nonceStr: 'random-string',
        package: `prepay_id=${prepayId}`,
        signType: 'RSA',
        paySign: '签名值',  // 需要后端计算
      },
      (res) => {
        if (res.err_msg === 'get_brand_wcpay_request:ok') {
          // 支付成功，查询订单状态
        }
      }
    );
  }
};
```

> **重要**：JSAPI 支付的签名参数（`timeStamp`、`nonceStr`、`paySign`）需要由后端计算，前端不应自行计算签名。建议在插件或自定义 API 中提供签名接口。

### H5 支付

```tsx
const handlePay = async () => {
  const result = await addPayment({
    variables: {
      input: { method: 'wechatpay', metadata: {} },
    },
  });

  const payment = result.data.addPaymentToOrder.payments[0];
  const { payUrl, payType } = payment.metadata;

  if (payType === 'h5' && payUrl) {
    // 跳转至微信 H5 支付页面
    window.location.href = payUrl;
  }
};
```

### 轮询订单状态

由于前端无法直接感知支付结果，建议在支付页面轮询订单状态：

```ts
const pollOrderStatus = async (interval = 3000, maxAttempts = 20) => {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts++;
    const { data } = await apolloClient.query({ query: GET_ORDER_QUERY });
    if (data.activeOrder?.state === 'PaymentSettled' || data.activeOrder?.state === 'Complete') {
      clearInterval(timer);
      // 支付成功，跳转结果页
      navigate('/order/success');
    }
    if (attempts >= maxAttempts) {
      clearInterval(timer);
      // 超时，提示用户
    }
  }, interval);
};
```

## 异步通知说明

微信支付会在支付完成后向 `notifyUrl`（`POST /wechatpay/notify`）发送异步通知。

### 通知处理流程

1. 微信支付发送 POST 请求到 `notifyUrl`，请求体为 JSON 格式（加密）。
2. 插件使用 `publicKey`（微信平台公钥）验证签名，确保通知来自微信。
3. 使用 `apiKey`（APIv3 密钥）解密通知内容。
4. 根据 `trade_state` 判断支付结果：
   - `SUCCESS`：支付成功，更新订单状态。
5. 插件返回 `200` 状态码和 `{"code":"SUCCESS","message":"成功"}` 给微信，表示通知处理成功。

### 注意事项

- `notifyUrl` 必须为公网可访问的 HTTPS 地址。
- 微信支付会在一定时间内多次重发通知（频率：15s/15s/30s/3m/10m/20m/30m/30m/30m/60m/3h/3h/3h/6h/6h），直到收到成功响应。
- 插件已内置幂等处理，重复通知不会导致重复确认。
- 微信支付 V3 版本的通知数据为加密传输，插件会自动解密。

## 退款流程

退款通过 Vendure 原生退款流程触发，插件内部自动调用微信支付退款接口。

### 操作方式

1. 在 Admin UI 中进入订单详情页。
2. 点击「Refund」按钮，填写退款金额。
3. 确认退款后，Vendure 调用微信退款接口完成退款。

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

> **注意**：退款需要商户 API 证书（`certPath` 或 `certBuffer`），请确保插件初始化时已正确配置证书。

### 退款到账时间

- 余额支付：即时到账。
- 银行卡支付：1-3 个工作日。

## 注意事项

1. **HTTPS 要求**：`notifyUrl` 必须为 HTTPS，微信支付不支持 HTTP 回调地址。
2. **金额单位**：Vendure 内部金额以最小单位（分）存储，与微信支付金额单位一致，无需转换。
3. **JSAPI 的 openid**：JSAPI 支付必须传入用户的 `openid`，前端需要通过微信授权获取。建议在用户进入商城时完成授权，将 openid 存储在用户信息或订单 metadata 中。
4. **证书配置**：退款等需要双向认证的接口必须配置商户 API 证书。在容器化部署中，推荐使用 `certBuffer` 代替 `certPath`。
5. **H5 支付域名**：H5 支付需要在微信商户平台配置 H5 支付域名，否则会报「商家参数格式有误」错误。
6. **NATIVE 二维码有效期**：Native 支付的二维码（`code_url`）有效期为 2 小时，过期后需重新下单。
7. **多交易类型**：如果需要同时支持多种支付方式（如扫码 + 公众号），可以创建多个 PaymentMethod，分别配置不同的 `tradeType`。
8. **签名算法**：微信支付 V3 版本使用 RSA 签名（SHA256WithRSA），请确保密钥格式正确（PEM 格式）。
9. **订单号**：插件使用 Vendure Payment 的 `id` 作为微信支付的 `out_trade_no`，确保唯一性。
