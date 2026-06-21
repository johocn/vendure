# WechatAuthPlugin

微信登录认证插件，支持微信公众号 H5 OAuth 登录和微信小程序登录。

## 概述

WechatAuthPlugin 为 Vendure 商店提供微信生态下的 OAuth 认证能力。支持两种登录方式：

- **公众号 H5 登录**：用户在微信内置浏览器中通过公众号授权登录
- **小程序登录**：用户通过微信小程序 `wx.login` 获取 code 后登录

插件会自动处理微信 OAuth 流程，获取用户 openid 并关联到 Vendure 用户体系。如果 openid 对应的用户不存在，系统会自动创建新用户并关联 Customer。

**核心特性：**
- 支持公众号 H5 OAuth2.0 授权登录
- 支持微信小程序登录
- 自动创建用户并关联 Customer
- 标准 Vendure AuthenticationStrategy，无缝集成现有认证体系
- 提供 OAuth 回调 Controller，处理微信重定向
- Customer 自定义字段存储微信 openid

## 安装

```bash
yarn add @vendure/wechat-auth-plugin
```

或

```bash
npm install @vendure/wechat-auth-plugin
```

## 前置准备

### 获取微信公众号配置

1. **注册微信公众号**
   - 访问 [微信公众平台](https://mp.weixin.qq.com/) 注册账号
   - **注意**：H5 OAuth 登录需要**已认证的服务号**，订阅号不支持网页授权

2. **获取 AppID 和 AppSecret**
   - 登录微信公众平台 → "开发" → "基本配置"
   - 记录 **AppID** 和 **AppSecret**

3. **配置网页授权域名**
   - 在 "开发" → "接口权限" → "网页授权" 中设置授权回调域名
   - 域名填写你的服务器域名（如 `shop.example.com`），不含 `http://` 和路径
   - 需要将验证文件上传到域名根目录下完成域名验证

4. **设置 IP 白名单**
   - 在 "开发" → "基本配置" 中设置 IP 白名单
   - 添加你的服务器公网 IP

### 获取微信小程序配置（可选）

1. **注册微信小程序**
   - 访问 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序账号

2. **获取 AppID 和 AppSecret**
   - 登录小程序管理后台 → "开发" → "开发管理" → "开发设置"
   - 记录 **AppID** 和 **AppSecret**

3. **配置服务器域名**
   - 在 "开发" → "开发管理" → "开发设置" → "服务器域名" 中
   - 将你的 API 域名添加到 "request 合法域名"

## 配置说明

### WechatAuthPluginOptions

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `appId` | `string` | 是 | - | 微信公众号 AppID |
| `appSecret` | `string` | 是 | - | 微信公众号 AppSecret |
| `miniProgramAppId` | `string` | 否 | 使用 `appId` | 小程序 AppID |
| `miniProgramAppSecret` | `string` | 否 | 使用 `appSecret` | 小程序 AppSecret |

> 如果小程序与公众号使用不同的 AppID，需分别配置 `miniProgramAppId` 和 `miniProgramAppSecret`。如果未配置，小程序登录将使用公众号的 `appId` 和 `appSecret`。

### 配置示例

**仅公众号登录：**

```ts
import { WechatAuthPlugin } from '@vendure/wechat-auth-plugin';

const config: VendureConfig = {
  plugins: [
    WechatAuthPlugin.init({
      appId: 'wx1234567890abcdef',
      appSecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    }),
  ],
};
```

**公众号 + 小程序登录：**

```ts
import { WechatAuthPlugin } from '@vendure/wechat-auth-plugin';

const config: VendureConfig = {
  plugins: [
    WechatAuthPlugin.init({
      appId: 'wx1234567890abcdef',
      appSecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      miniProgramAppId: 'wx9876543210fedcba',
      miniProgramAppSecret: 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
    }),
  ],
};
```

### 环境变量推荐

```ts
WechatAuthPlugin.init({
  appId: process.env.WECHAT_APP_ID!,
  appSecret: process.env.WECHAT_APP_SECRET!,
  miniProgramAppId: process.env.WECHAT_MINI_APP_ID,
  miniProgramAppSecret: process.env.WECHAT_MINI_APP_SECRET,
}),
```

### Customer 自定义字段

插件会在 Customer 实体上添加以下自定义字段，用于存储微信 openid：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `wechatOpenid` | `string` | 微信公众号 openid |
| `wechatMiniOpenid` | `string` | 微信小程序 openid |

> 这两个字段由插件自动注册，无需手动添加自定义字段配置。

## GraphQL API 参考

### 认证

使用 `authenticate` Mutation 进行微信登录：

#### 公众号 H5 登录

```graphql
mutation WechatMpLogin {
  authenticate(wechat: { code: "061xKlll2Cc0a44D3nol2Cx9ll2xKlll", type: "mp" }) {
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

#### 小程序登录

```graphql
mutation WechatMiniLogin {
  authenticate(wechat: { code: "0a3xKlll2Cc0a44D3nol2Cx9ll2xKlll", type: "mini" }) {
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

**认证策略名：** `wechat`

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | `String!` | 是 | 微信授权 code（公众号 OAuth code 或小程序 wx.login code） |
| `type` | `String!` | 是 | 登录类型：`"mp"` 公众号 H5 登录，`"mini"` 小程序登录 |

### REST Controller

#### GET /wechat-auth/callback

微信 OAuth 授权回调端点，由微信服务器在用户授权后重定向调用。

**请求参数（微信自动附加）：**

| 参数 | 说明 |
|------|------|
| `code` | 微信授权码 |
| `state` | 自定义状态参数（用于防 CSRF） |

**响应：** 重定向到前端页面，并携带 `code` 和 `openid` 参数。

示例重定向 URL：
```
https://shop.example.com/wechat-login?code=061xKlll2Cc0a44&openid=o6_bmasdasdsad6e2
```

## 认证流程图解

### 公众号 H5 登录流程

```
┌──────────┐                          ┌──────────────┐
│   用户    │                          │   前端页面    │
└────┬─────┘                          └──────┬───────┘
     │ 1. 点击"微信登录"                      │
     │ ──────────────────────────────────→ │
     │                                      │
     │ 2. 重定向到微信授权页面                   │
     │ ←────────────────────────────────── │
     │                                      │
     │ 3. 用户在微信中确认授权                   │
     │                                      │
     ▼                                      │
┌──────────┐                               │
│  微信服务器 │                               │
└────┬─────┘                               │
     │ 4. 重定向到 /wechat-auth/callback?code=xxx
     │                                      │
     ▼                                      ▼
┌──────────────────────────────────────────────┐
│              Vendure 后端                      │
│  /wechat-auth/callback                        │
│  ├─ 用 code 换取 access_token + openid        │
│  └─ 重定向到前端 ?code=xxx&openid=xxx          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
               ┌──────────────┐
               │   前端页面    │
               └──────┬───────┘
                      │ 5. authenticate(wechat: { code, type: "mp" })
                      │
                      ▼
               ┌──────────────┐
               │  Vendure API  │
               │  ├─ 校验 code  │
               │  ├─ 获取 openid│
               │  ├─ 查找/创建用户│
               │  └─ 返回 Session│
               └──────┬───────┘
                      │
                      ▼
               ┌──────────────┐
               │  登录成功 ✅   │
               └──────────────┘
```

### 小程序登录流程

```
┌──────────┐                          ┌──────────────┐
│   用户    │                          │   小程序       │
└────┬─────┘                          └──────┬───────┘
     │ 1. 点击"微信登录"                      │
     │ ──────────────────────────────────→ │
     │                                      │
     │                                      │ 2. wx.login() 获取 code
     │                                      │
     │                                      │ 3. authenticate(wechat: { code, type: "mini" })
     │                                      │
     │                                      ▼
     │                               ┌──────────────┐
     │                               │  Vendure API  │
     │                               │  ├─ 用 code 换取 openid  │
     │                               │  ├─ 查找/创建用户        │
     │                               │  └─ 返回 Session        │
     │                               └──────┬───────┘
     │                                      │
     │ 4. 登录成功                            │
     │ ←────────────────────────────────── │
     ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│   用户 ✅     │                    │   小程序 ✅   │
└──────────────┘                    └──────────────┘
```

## 前端集成示例

### 公众号 H5 登录（React）

```tsx
import { useEffect } from 'react';
import { gql, useMutation } from '@apollo/client';

const WECHAT_LOGIN = gql`
  mutation WechatLogin($code: String!, $type: String!) {
    authenticate(wechat: { code: $code, type: $type }) {
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

export function WechatLoginPage() {
  const [login] = useMutation(WECHAT_LOGIN);

  useEffect(() => {
    // 从 URL 参数中获取 code（由 /wechat-auth/callback 重定向带来）
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      handleLogin(code);
    }
  }, []);

  const handleLogin = async (code: string) => {
    const { data } = await login({
      variables: { code, type: 'mp' },
    });
    if (data?.authenticate?.id) {
      window.location.href = '/';
    }
  };

  const handleWechatRedirect = () => {
    const appId = 'wx1234567890abcdef';
    const redirectUri = encodeURIComponent('https://api.example.com/wechat-auth/callback');
    const state = 'random_state_string';
    // 微信授权页面 URL
    const authUrl =
      `https://open.weixin.qq.com/connect/oauth2/authorize` +
      `?appid=${appId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=snsapi_userinfo` +
      `&state=${state}#wechat_redirect`;
    window.location.href = authUrl;
  };

  return (
    <div>
      <h2>微信登录</h2>
      <button onClick={handleWechatRedirect}>微信授权登录</button>
    </div>
  );
}
```

### 小程序登录

```js
// 小程序端代码
Page({
  data: {
    loading: false,
  },

  async handleWechatLogin() {
    this.setData({ loading: true });

    try {
      // 1. 调用 wx.login 获取 code
      const { code } = await wx.login();

      // 2. 将 code 发送到后端进行认证
      const res = await wx.request({
        url: 'https://api.example.com/shop-api',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: {
          query: `
            mutation WechatMiniLogin($code: String!, $type: String!) {
              authenticate(wechat: { code: $code, type: $type }) {
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
          variables: { code, type: 'mini' },
        },
      });

      const result = res.data?.data?.authenticate;
      if (result?.id) {
        // 登录成功，保存 token
        wx.setStorageSync('token', res.header['vendure-auth-token']);
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '登录异常', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
```

### 小程序登录（uni-app 版本）

```js
// uni-app 中使用
async function wechatMiniLogin() {
  // 1. 获取 code
  const [, loginRes] = await uni.login({ provider: 'weixin' });
  const code = loginRes.code;

  // 2. 调用后端认证
  const [, requestRes] = await uni.request({
    url: 'https://api.example.com/shop-api',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: {
      query: `
        mutation WechatMiniLogin($code: String!, $type: String!) {
          authenticate(wechat: { code: $code, type: $type }) {
            ... on CurrentUser {
              id
              identifier
            }
          }
        }
      `,
      variables: { code, type: 'mini' },
    },
  });

  const user = requestRes.data?.data?.authenticate;
  if (user?.id) {
    uni.setStorageSync('token', requestRes.header['vendure-auth-token'] || '');
    uni.switchTab({ url: '/pages/index/index' });
  }
}
```

## 注意事项

1. **公众号类型要求**：H5 OAuth 网页授权需要**已认证的服务号**，未认证的订阅号无法使用网页授权接口。如仅需小程序登录，则无需公众号认证。

2. **授权域名配置**：公众号网页授权回调域名必须与你的服务器域名一致，且需在微信公众平台提前配置并通过验证。

3. **code 有效期**：微信授权 code 仅可使用一次，且有效期为 5 分钟。请确保在获取 code 后尽快调用 `authenticate` 完成登录。

4. **openid 与 unionid**：
   - 同一用户在公众号和小程序中的 openid 不同
   - 如需打通公众号和小程序的用户体系，需使用 unionid（需绑定微信开放平台账号）
   - 当前插件分别存储 `wechatOpenid`（公众号）和 `wechatMiniOpenid`（小程序），两者关联需自行实现

5. **自动注册用户**：当 openid 不存在对应用户时，插件会自动创建 User 和 Customer。创建的用户 identifier 为 openid，密码为空。

6. **HTTPS 要求**：微信 OAuth 回调地址必须为 HTTPS。

7. **AppSecret 安全**：
   - 切勿将 AppSecret 提交到版本控制系统
   - 推荐使用环境变量或密钥管理服务存储
   - 定期更换 AppSecret

8. **小程序 session_key**：小程序登录时微信会返回 `session_key`，用于解密用户敏感数据（如手机号）。如需获取用户手机号等信息，需自行实现 `session_key` 的存储与解密逻辑。

9. **回调路径**：OAuth 回调路径默认为 `/wechat-auth/callback`，确保该路径未被其他中间件或路由拦截。如需自定义路径，请参考插件高级配置。
