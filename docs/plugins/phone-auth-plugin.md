# PhoneAuthPlugin

手机验证码认证插件，基于阿里云短信服务实现手机号 + 验证码登录。

## 概述

PhoneAuthPlugin 为 Vendure 商店提供手机号验证码认证能力。用户通过手机号接收短信验证码完成登录，无需记忆密码。如果手机号对应的用户不存在，系统会自动创建新用户并关联 Customer。

**核心特性：**
- 手机号 + 验证码登录，无需密码
- 基于阿里云短信服务发送验证码
- 验证码长度与过期时间可配置
- 新用户自动注册（自动创建 User 和 Customer）
- 标准 Vendure AuthenticationStrategy，无缝集成现有认证体系

## 安装

```bash
yarn add @vendure/phone-auth-plugin
```

或

```bash
npm install @vendure/phone-auth-plugin
```

## 前置准备

### 获取阿里云短信服务配置

使用本插件前，你需要先在阿里云控制台完成以下准备：

1. **开通短信服务**
   - 登录 [阿里云控制台](https://www.aliyun.com/)
   - 搜索"短信服务"并开通

2. **创建 AccessKey**
   - 进入 [AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
   - 创建 AccessKey，记录 `AccessKey ID` 和 `AccessKey Secret`
   - **安全建议**：使用 RAM 子账号的 AccessKey，仅授权短信服务权限

3. **申请短信签名**
   - 在短信服务控制台，进入"国内消息" → "签名管理"
   - 点击"添加签名"，填写签名名称（如你的公司名或产品名）
   - 等待审核通过，记录**签名名称**（即配置中的 `signName`）

4. **创建短信模板**
   - 在短信服务控制台，进入"国内消息" → "模板管理"
   - 点击"添加模板"，模板类型选择"验证码"
   - 模板内容示例：`您的验证码为${code}，${expiry}分钟内有效，请勿泄漏给他人。`
   - 审核通过后，记录**模板代码**（即配置中的 `templateCode`）

> **注意**：模板中的变量名 `code` 和 `expiry` 由插件自动填充，你只需确保模板中包含这两个变量即可。

## 配置说明

### PhoneAuthPluginOptions

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `accessKeyId` | `string` | 是 | - | 阿里云 AccessKey ID |
| `accessKeySecret` | `string` | 是 | - | 阿里云 AccessKey Secret |
| `signName` | `string` | 是 | - | 短信签名名称 |
| `templateCode` | `string` | 是 | - | 短信模板代码 |
| `codeLength` | `number` | 否 | `6` | 验证码长度 |
| `codeExpirySeconds` | `number` | 否 | `300` | 验证码过期时间（秒） |

### 配置示例

```ts
import { PhoneAuthPlugin } from '@vendure/phone-auth-plugin';

const config: VendureConfig = {
  plugins: [
    PhoneAuthPlugin.init({
      accessKeyId: 'LTAI5txxxxxxxxxxxxx',
      accessKeySecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
      signName: '我的商城',
      templateCode: 'SMS_123456789',
      codeLength: 6,
      codeExpirySeconds: 300,
    }),
  ],
};
```

### 环境变量推荐

建议将敏感配置通过环境变量注入，不要硬编码在源码中：

```ts
PhoneAuthPlugin.init({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  signName: process.env.ALIYUN_SMS_SIGN_NAME!,
  templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE!,
}),
```

## GraphQL API 参考

### Mutation

#### sendPhoneVerificationCode

发送验证码到指定手机号。

```graphql
mutation SendPhoneVerificationCode {
  sendPhoneVerificationCode(phoneNumber: "13800138000")
}
```

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phoneNumber` | `String!` | 是 | 手机号码 |

**返回值：** `Boolean!` — 是否发送成功

### 认证

使用 `authenticate` Mutation 进行手机验证码登录：

```graphql
mutation PhoneLogin {
  authenticate(
    phoneNumber: "13800138000",
    verificationCode: "123456"
  ) {
    ... on CurrentUser {
      id
      identifier
    }
    ... on InvalidCredentialsError {
      errorCode
      message
    }
  }
}
```

**认证策略名：** `phone`

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phoneNumber` | `String!` | 是 | 手机号码 |
| `verificationCode` | `String!` | 是 | 短信验证码 |

## 认证流程图解

```
┌──────────┐     1. 输入手机号      ┌──────────────┐
│   用户    │ ──────────────────→  │   前端页面    │
└──────────┘                      └──────┬───────┘
                                         │
                          2. sendPhoneVerificationCode(phoneNumber)
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Vendure API  │
                                  └──────┬───────┘
                                         │
                          3. 调用阿里云短信 API 发送验证码
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  阿里云短信    │
                                  └──────┬───────┘
                                         │
                          4. 短信送达用户手机
                                         │
                                         ▼
┌──────────┐     5. 输入验证码      ┌──────────────┐
│   用户    │ ──────────────────→  │   前端页面    │
└──────────┘                      └──────┬───────┘
                                         │
                          6. authenticate(phoneNumber, verificationCode)
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Vendure API  │
                                  └──────┬───────┘
                                         │
                          7. 校验验证码 → 查找/创建用户 → 返回 Session
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  登录成功 ✅   │
                                  └──────────────┘
```

**流程说明：**

1. 用户在登录页输入手机号
2. 前端调用 `sendPhoneVerificationCode` 发送验证码
3. Vendure 后端调用阿里云短信 API 发送短信
4. 用户手机收到验证码短信
5. 用户在页面输入验证码
6. 前端调用 `authenticate` 进行验证码校验
7. 后端校验验证码：若正确且用户存在则登录，若用户不存在则自动创建后登录

## 前端集成示例

### React 示例

```tsx
import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';

const SEND_CODE = gql`
  mutation SendCode($phoneNumber: String!) {
    sendPhoneVerificationCode(phoneNumber: $phoneNumber)
  }
`;

const LOGIN = gql`
  mutation PhoneLogin($phoneNumber: String!, $code: String!) {
    authenticate(phoneNumber: $phoneNumber, verificationCode: $code) {
      ... on CurrentUser {
        id
        identifier
      }
      ... on InvalidCredentialsError {
        errorCode
        message
      }
    }
  }
`;

export function PhoneLoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [sendCode] = useMutation(SEND_CODE);
  const [login] = useMutation(LOGIN);

  const handleSendCode = async () => {
    if (!phone) return;
    await sendCode({ variables: { phoneNumber: phone } });
    // 启动倒计时
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    const { data } = await login({
      variables: { phoneNumber: phone, code },
    });
    if (data?.authenticate?.id) {
      // 登录成功，跳转首页
      window.location.href = '/';
    }
  };

  return (
    <div>
      <h2>手机验证码登录</h2>
      <input
        placeholder="请输入手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button onClick={handleSendCode} disabled={countdown > 0}>
        {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
      </button>
      <input
        placeholder="请输入验证码"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button onClick={handleLogin}>登录</button>
    </div>
  );
}
```

### 原生 fetch 示例

```js
// 1. 发送验证码
async function sendCode(phoneNumber) {
  const res = await fetch('/shop-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation SendCode($phoneNumber: String!) {
          sendPhoneVerificationCode(phoneNumber: $phoneNumber)
        }
      `,
      variables: { phoneNumber },
    }),
  });
  const { data } = await res.json();
  return data.sendPhoneVerificationCode;
}

// 2. 验证码登录
async function phoneLogin(phoneNumber, code) {
  const res = await fetch('/shop-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation PhoneLogin($phoneNumber: String!, $code: String!) {
          authenticate(phoneNumber: $phoneNumber, verificationCode: $code) {
            ... on CurrentUser {
              id
              identifier
            }
            ... on InvalidCredentialsError {
              errorCode
              message
            }
          }
        }
      `,
      variables: { phoneNumber, code },
    }),
  });
  const { data } = await res.json();
  return data.authenticate;
}
```

## 注意事项

1. **短信费用**：阿里云短信服务按条计费，请注意控制发送频率，避免因恶意请求产生高额费用。建议在前端实现发送间隔限制（如 60 秒倒计时），并在后端配置频率限制。

2. **验证码安全**：
   - 验证码过期后自动失效，默认 5 分钟
   - 验证码校验后立即失效，不可重复使用
   - 建议设置合理的 `codeLength`（默认 6 位已足够安全）

3. **手机号格式**：目前支持中国大陆手机号（11 位数字），如需支持其他地区号码，需自行扩展验证逻辑。

4. **自动注册用户**：当手机号不存在对应用户时，插件会自动创建 User 和 Customer。创建的用户 identifier 为手机号，密码为空。如需用户后续设置密码，请自行实现密码设置功能。

5. **AccessKey 安全**：
   - 切勿将 AccessKey 提交到版本控制系统
   - 推荐使用环境变量或密钥管理服务存储
   - 使用 RAM 子账号并仅授权短信服务最小权限

6. **短信模板审核**：阿里云短信模板和签名需要审核通过后才能使用，审核通常需要 1-2 个工作日，请提前申请。
