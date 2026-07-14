# 认证体系增强 设计文档

> 日期：2026-07-14
> 状态：已确认待实施
> 关联：扩展 WechatAuthPlugin / PhoneAuthPlugin，新增 AlipayAuthPlugin / DouyinAuthPlugin

## 背景与目标

### 背景

当前系统已有 4 种登录方式：账号密码（Vendure 内置）、手机验证码（PhoneAuthPlugin）、微信公众号 H5（WechatAuthPlugin）、微信小程序（WechatAuthPlugin）。但存在以下缺口：

1. **WeChat devBypass 不对称**：`DEV_BYPASS_SMS=true` 时手机验证码可用固定码 `123456` 真实登录；`DEV_BYPASS_WECHAT=true` 仅注册插件占位，无法真正完成登录（微信 API 返回 `invalid appid`）
2. **无独立注册页面**：新用户只能通过手机验证码或微信登录时自动创建，无传统"用户名+密码注册"流程
3. **支付宝登录缺失**：AlipayPlugin 是支付插件，非认证插件
4. **抖音登录缺失**：无任何抖音相关代码
5. **无环境侦测**：用户在微信/支付宝/抖音浏览器内访问 H5 时，需手动选择对应登录方式，体验差

### 目标

1. 完善 WechatAuthPlugin devBypass，与 SMS 的 `123456` 对称
2. 新增用户注册页面，支持手机号+验证码+密码
3. 新增 AlipayAuthPlugin，支持支付宝 H5 和小程序授权登录
4. 新增 DouyinAuthPlugin，支持抖音 H5 和小程序授权登录
5. 前端登录页增加环境侦测，自动推荐/触发对应三方登录

### 非目标

- 不修改现有 WechatAuthPlugin 的真实 appId 登录流程
- 不实现支付宝/抖音的支付能力（已有 AlipayPlugin 支付）
- 不实现邮箱验证、找回密码等扩展功能
- 不实现管理员后台的用户管理界面

## 现状

### 演示账号

| 类型 | identifier | 密码 | 所属 Channel | 备注 |
|------|------------|------|--------------|------|
| 管理员 | `superadmin@china.test` | `superadmin` | - | Super Admin |
| 客户1 | `zhangsan@test.cn` | `test` | default | 余额 0 |
| 客户2 | `lisi@test.cn` | `test` | default | 余额 500 元 |
| 客户3 | `wangwu@test.cn` | `test` | shop-a | 余额 200 元 |

> PhoneAuthPlugin 创建的用户 identifier 为手机号；WechatAuthPlugin 创建的 identifier 为 `wechat_mp_${openid}` 或 `wechat_mini_${openid}`。

### devBypass 现状

| 插件 | devBypass | 效果 |
|------|-----------|------|
| PhoneAuthPlugin | `DEV_BYPASS_SMS=true` | 真实可用：验证码打印到控制台，校验时固定码 `123456` 通过 |
| WechatAuthPlugin | `DEV_BYPASS_WECHAT=true` | 仅注册插件占位：GraphQL schema 可用，但调用微信 API 返回 `invalid appid` |

### 三方登录支持矩阵（现状）

| 平台 | 后端 | 前端 | devBypass |
|------|------|------|-----------|
| 手机验证码 | PhoneAuthPlugin | ✅ | 真实可用 |
| 微信公众号 H5 | WechatAuthPlugin | ✅ | 不可用 |
| 微信小程序 | WechatAuthPlugin | ✅ | 不可用 |
| 账号密码 | Vendure 内置 | ✅ | - |
| 支付宝登录 | ❌ | ❌ | - |
| 抖音登录 | ❌ | ❌ | - |

## 设计

### 架构

采用独立插件模式（方案 A），每个三方登录一个独立插件，复用 WechatAuthPlugin 的设计模式：

```
packages/
├── phone-auth-plugin/          # 已有：新增 registerCustomer mutation
├── wechat-auth-plugin/         # 已有：完善 devBypass
├── alipay-auth-plugin/         # 新增：支付宝认证插件
├── douyin-auth-plugin/         # 新增：抖音认证插件
└── dev-server/
    └── dev-config.ts           # 注册新插件
```

前端新增环境侦测工具，登录页根据环境自动推荐登录方式：

```
vshop/src/
├── utils/detect-env.ts         # 新增：环境侦测
├── pages/register/index.vue    # 新增：注册页面
├── pages/login/index.vue       # 修改：集成环境侦测和新登录方式
└── api/mutations/auth.ts       # 修改：新增 register、alipay、douyin 调用
```

### Phase 1：完善 WechatAuthPlugin devBypass

**改动文件：** `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts`

在 `authenticate` 方法开头增加 devBypass 分支：

```typescript
async authenticate(ctx, input: { code: string; type: 'mp' | 'mini' }) {
    // devBypass 分支：跳过微信 API，使用固定测试 openid
    if (this.options.devBypass) {
        const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
        const identifier = `wechat_${input.type}_${testOpenid}`;
        return this.findOrCreateUserByIdentifier(ctx, identifier, input.type, testOpenid);
    }
    // 原有逻辑：调用微信 API 换 openid
    ...
}
```

**改动文件：** `packages/wechat-auth-plugin/src/types.ts`

`WechatAuthPluginOptions` 接口增加字段：

```typescript
export interface WechatAuthPluginOptions {
    appId: string;
    appSecret: string;
    miniProgramAppId?: string;
    miniProgramAppSecret?: string;
    devBypass?: boolean;        // 新增
    devBypassOpenid?: string;   // 新增，默认 'dev_test_openid'
}
```

**dev-config.ts 配置更新：**

```typescript
WechatAuthPlugin.init({
    appId: process.env.WECHAT_AUTH_APP_ID || 'dev_test_app_id',
    appSecret: process.env.WECHAT_AUTH_APP_SECRET || 'dev_test_app_secret',
    miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '',
    miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '',
    devBypass: process.env.DEV_BYPASS_WECHAT === 'true',
    devBypassOpenid: 'dev_test_openid',
})
```

**验证标准：** `DEV_BYPASS_WECHAT=true` 时，调用 `authenticate(wechat: {code:'any', type:'mp'})` 返回有效 token，用户 identifier 为 `wechat_mp_dev_test_openid`。

### Phase 2：用户注册功能

**后端改动文件：** `packages/phone-auth-plugin/src/auth.resolver.ts`

新增 `registerCustomer` mutation，复用现有 `smsService.verifyCode` 校验验证码：

```typescript
import { Allow } from '@vendure/core';
import { Permission } from '@vendure/common/lib/generated-types';

@Mutation()
@Allow(Permission.Public)
async registerCustomer(
    @Ctx() ctx: RequestContext,
    @Args() args: { input: RegisterCustomerInput },
): Promise<Result> {
    // 1. 校验验证码
    const verified = this.smsService.verifyCode(args.input.phoneNumber, args.input.code);
    if (!verified) return new InvalidCredentialsError({ authenticationError: '验证码错误或已过期' });
    
    // 2. 检查手机号是否已注册（getUserByEmailAddress 已支持非邮箱 identifier）
    const existing = await this.userService.getUserByEmailAddress(ctx, args.input.phoneNumber);
    if (existing) {
        // 防账户枚举：不暴露用户存在，直接返回 success（参考 registerCustomerAccount 模式）
        return { success: true };
    }
    
    // 3. 创建 User（3 参数：ctx, identifier, password）
    const user = await this.userService.createCustomerUser(
        ctx, args.input.phoneNumber, args.input.password,
    );
    if (user instanceof PasswordValidationError) return user;
    
    // 4. 创建 Customer 并关联 User
    const customer = await this.customerService.create(ctx, {
        emailAddress: args.input.emailAddress || `${args.input.phoneNumber}@phone.local`,
        phoneNumber: args.input.phoneNumber,
    });
    // 关联 user 到 customer
    customer.user = user;
    await this.customerService.update(ctx, { id: customer.id, user: { id: user.id } as any });
    
    return { success: true, userId: user.id };
}
```

**RegisterCustomerInput 定义：**

```graphql
input RegisterCustomerInput {
    phoneNumber: String!
    code: String!
    password: String!
    emailAddress: String
}
```

**前端新增文件：** `vshop/src/pages/register/index.vue`

注册流程：
1. 输入手机号 → 点击"获取验证码" → 调用 `sendPhoneVerificationCode`
2. 输入验证码 + 设置密码（可选输入 email）
3. 点击"注册" → 调用 `registerCustomer` mutation
4. 注册成功 → 跳转登录页或自动登录

**前端 API 新增：** `vshop/src/api/mutations/auth.ts`

```typescript
export async function registerCustomer(input: {
    phoneNumber: string;
    code: string;
    password: string;
    emailAddress?: string;
}) {
    const client = getGraphQLClient();
    const mutation = `
        mutation Register($input: RegisterCustomerInput!) {
            registerCustomer(input: $input) { ... on Success { success } ... on ErrorResult { errorCode message } }
        }
    `;
    return client.request(mutation, { input });
}
```

**pages.json 新增路由：**

```json
{
    "path": "pages/register/index",
    "style": { "navigationBarTitleText": "注册" }
}
```

**登录方式：** Vendure 的 `NativeAuthenticationStrategy` 查询 `user.identifier` 字段，不限制格式。注册时 `createCustomerUser(ctx, phoneNumber, password)` 将 identifier 设为手机号并设置密码（3 参数签名，无 customer 参数），因此注册后用户可用 `native` 策略登录：`authenticate(native: {username: phoneNumber, password})`。

**前端登录页适配：** `pages/login/index.vue` 的 `local` 模式当前 placeholder 为"邮箱/手机号"，已兼容手机号登录，无需改动。

**验证标准：**
- 用 `13800139999` + 验证码 `123456` + 密码 `test123` 注册成功
- 重复注册返回 `{ success: true }`（防账户枚举，不暴露用户存在）
- 注册后可用 `13800139999` + `test123` 通过 `native` 策略登录，返回有效 token

### Phase 3：AlipayAuthPlugin（合并到 alipay-plugin 包）

> 卡点检查结论：alipay-sdk 已作为 `@vendure/alipay-plugin` 的 dependency 安装（`packages/alipay-plugin/package.json`），现有 `alipay-handler.ts` 已成功使用 `AlipaySdk` 类。为避免重复依赖，将认证功能合并到现有 `alipay-plugin` 包内。

**目录结构：** 在 `packages/alipay-plugin/src/` 下新增认证模块

```
packages/alipay-plugin/src/
├── plugin.ts                    # 修改：注册认证策略 + customFields
├── alipay-handler.ts            # 已有：支付处理
├── alipay-auth-strategy.ts      # 新增：认证策略（策略名 'alipay'）
├── alipay-auth.service.ts       # 新增：支付宝 OAuth API 调用（复用 alipay-sdk）
├── alipay-auth.controller.ts    # 新增：H5 OAuth 回调
├── alipay-auth-shop.resolver.ts # 新增：GraphQL 输入类型
├── customer-custom-fields.ts    # 新增：Customer.alipayOpenid
└── types.ts                     # 修改：增加 AlipayAuthPluginOptions
```

**AlipayAuthPluginOptions（合并到 AlipayPluginOptions）：**

```typescript
// packages/alipay-plugin/src/types.ts
export interface AlipayPluginOptions {
    // 已有：支付配置
    notifyUrl: string;
    alipayPublicKey: string;
    // 新增：认证配置
    auth?: {
        appId?: string;            // 认证专用 appId（如与支付不同，不填则复用支付 appId）
        privateKey?: string;       // 认证专用私钥（不填则复用支付私钥）
        miniProgramAppId?: string;
        devBypass?: boolean;
        devBypassOpenid?: string;  // 默认 'dev_test_openid'
    };
}
```

**认证策略：** 策略名 `alipay`，输入 `{ authCode: string; type: 'h5' | 'mini' }`

- **H5**：调用 `alipay.system.oauth.auth` 接口，用 authCode 换取 openid（user_id）
- **小程序**：前端通过 `my.getAuthCode` 获取 authCode，同样调 `alipay.system.oauth.auth` 换 openid

**Customer customFields 扩展：**

```typescript
// 在 dev-config.ts 的 customFields.Customer 中增加
{ name: 'alipayOpenid', type: 'string', public: true }
```

**devBypass 机制：**

```typescript
async authenticate(ctx, input: { authCode: string; type: 'h5' | 'mini' }) {
    if (this.options.devBypass) {
        const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
        const identifier = `alipay_${input.type}_${testOpenid}`;
        return this.findOrCreateUserByIdentifier(ctx, identifier, 'alipay', testOpenid);
    }
    // 原有逻辑：调用支付宝 API
    ...
}
```

**前端集成：**

- `api/mutations/auth.ts` 新增 `authenticateWithAlipay(authCode, type)`
- 登录页新增支付宝按钮（条件编译 `#ifdef H5 || MP-ALIPAY`）
- H5 流程：跳转 `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=XXX&scope=auth_user&redirect_uri=YYY`
- 小程序流程：`my.login({ scopes: 'auth_user' })` 获取 authCode

**环境变量：**

```env
# 复用支付配置或单独配置认证
ALIPAY_AUTH_APP_ID=xxx          # 可选，不填则复用 ALIPAY_APP_ID
ALIPAY_AUTH_PRIVATE_KEY=xxx     # 可选，不填则复用 ALIPAY_PRIVATE_KEY
DEV_BYPASS_ALIPAY=true
```

**验证标准：**
- `DEV_BYPASS_ALIPAY=true` 时，`authenticate(alipay: {authCode:'any', type:'h5'})` 返回有效 token
- 用户 identifier 为 `alipay_h5_dev_test_openid`
- Customer 的 `alipayOpenid` 字段被填充

### Phase 4：DouyinAuthPlugin

**目录结构：** `packages/douyin-auth-plugin/src/`

结构与 AlipayAuthPlugin 一致：

```
├── plugin.ts
├── douyin-auth-strategy.ts     # 策略名 'douyin'，输入 { code, type: 'h5'|'mini' }
├── douyin-auth.service.ts      # 调用 https://developer.toutiao.com/api/apps/v2/jscode2session
├── douyin-auth.controller.ts   # H5 OAuth 回调
├── douyin-auth-shop.resolver.ts
├── customer-custom-fields.ts   # Customer.douyinOpenid
└── types.ts
```

**DouyinAuthPluginOptions：**

```typescript
export interface DouyinAuthPluginOptions {
    appId: string;
    appSecret: string;
    miniProgramAppId?: string;
    miniProgramAppSecret?: string;
    devBypass?: boolean;
    devBypassOpenid?: string;
}
```

**认证策略：**

- **小程序**：`tt.login()` 获取 code → 调用 `jscode2session` 换 openid
- **H5**：跳转 `https://developer.toutiao.com/openapi/oauth2/auth/v2/?app_id=XXX&response_type=code&scope=user_info&redirect_uri=YYY` → 回调获取 code → 换 openid

**Customer customFields：**

```typescript
{ name: 'douyinOpenid', type: 'string', public: true }
```

**devBypass 机制：** 同 AlipayAuthPlugin，固定返回 `dev_test_openid`

**前端集成：**

- `api/mutations/auth.ts` 新增 `authenticateWithDouyin(code, type)`
- 登录页新增抖音按钮（条件编译 `#ifdef H5 || MP-TOUTIAO`）

**环境变量：**

```env
DOUYIN_AUTH_APP_ID=xxx
DOUYIN_AUTH_APP_SECRET=xxx
DEV_BYPASS_DOUYIN=true
```

**验证标准：**
- `DEV_BYPASS_DOUYIN=true` 时，`authenticate(douyin: {code:'any', type:'mini'})` 返回有效 token
- 用户 identifier 为 `douyin_mini_dev_test_openid`

### Phase 5：环境侦测 + 智能默认登录

**新增文件：** `vshop/src/utils/detect-env.ts`

```typescript
export type Platform = 'wechat' | 'alipay' | 'douyin' | 'browser';

export function detectPlatform(): Platform {
    // #ifdef MP-WEIXIN
    return 'wechat';
    // #endif
    // #ifdef MP-ALIPAY
    return 'alipay';
    // #endif
    // #ifdef MP-TOUTIAO
    return 'douyin';
    // #endif
    // #ifdef H5
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('micromessenger')) return 'wechat';
    if (ua.includes('alipayclient')) return 'alipay';
    if (ua.includes('newsclient') || ua.includes('bytedance')) return 'douyin';
    return 'browser';
    // #endif
    // 默认兜底（条件编译未匹配时）
    return 'browser';
}
```

> 卡点检查补充：需同步扩展 `vshop/src/utils/platform.ts` 的 `PlatformType` 类型，加入 `'mp-alipay'`，并在 `redirectPayment` 等函数中新增 `// #ifdef MP-ALIPAY` 分支。

**登录页重构：** `vshop/src/pages/login/index.vue`

```typescript
onMounted(() => {
    const platform = detectPlatform();
    switch (platform) {
        case 'wechat':
            // 微信环境：自动静默登录
            loginWithWechatH5('snsapi_base');
            break;
        case 'alipay':
            // 支付宝环境：自动支付宝授权
            loginWithAlipayH5();
            break;
        case 'douyin':
            // 抖音环境：自动抖音授权
            loginWithDouyinH5();
            break;
        default:
            // 普通浏览器：显示登录方式选择
            mode.value = 'select';
    }
});
```

**登录方式选择页：** 根据条件编译显示按钮

```vue
<!-- #ifdef H5 || MP-WEIXIN -->
<button @click="loginWithWechat">微信登录</button>
<!-- #endif -->
<!-- #ifdef H5 || MP-ALIPAY -->
<button @click="loginWithAlipay">支付宝登录</button>
<!-- #endif -->
<!-- #ifdef H5 || MP-TOUTIAO -->
<button @click="loginWithDouyin">抖音登录</button>
<!-- #endif -->
<button @click="mode='phone'">手机验证码登录</button>
<button @click="mode='local'">账号密码登录</button>
```

**验证标准：**
- 微信浏览器内访问 H5 → 自动触发微信静默登录
- 支付宝浏览器内访问 H5 → 自动触发支付宝授权
- 抖音浏览器内访问 H5 → 自动触发抖音授权
- 普通浏览器 → 显示登录方式选择，包含所有可用的三方登录按钮

## 数据流

### 注册流程

```
用户输入手机号 → 前端 sendPhoneVerificationCode(phoneNumber)
    → 后端 smsService.sendCode（devBypass 时打印控制台）
用户输入验证码+密码 → 前端 registerCustomer({phoneNumber, code, password})
    → 后端 auth.resolver.registerCustomer
        → smsService.verifyCode（devBypass 时 '123456' 通过）
        → userService.getUserByIdentifier 检查重复
        → customerService.create 创建客户
        → userService.createCustomerUser 创建用户（带密码）
    → 返回 success
前端跳转登录页
```

### 三方登录流程（以支付宝 H5 为例）

```
用户点击"支付宝登录" → 前端跳转支付宝授权页
支付宝回调 → 前端检测 URL 参数 auth_code
    → 前端 authenticateWithAlipay(authCode, 'h5')
    → 后端 alipay-auth-strategy.authenticate
        → devBypass? 用固定 openid
        → 否则调 alipay.system.oauth.auth 换 openid
        → findOrCreateUserByIdentifier（identifier=alipay_h5_${openid}）
    → 返回 token
前端存储 token，跳转首页
```

## 错误处理

| 场景 | 错误类型 | 处理 |
|------|----------|------|
| 注册时验证码错误 | `InvalidCredentialsError` | 前端 toast "验证码错误" |
| 注册时手机号已存在 | `UserExistsError` | 前端 toast "手机号已注册" |
| 三方登录 API 调用失败 | `InvalidCredentialsError` | 前端 toast "登录失败，请重试" |
| 三方登录 openid 已绑定其他用户 | 正常返回（同一 identifier 复用） | 无需特殊处理 |

## 测试策略

### devBypass 测试（无需真实 appId）

1. `DEV_BYPASS_SMS=true` → 手机号 `13800139999` + 验证码 `123456` 注册并登录
2. `DEV_BYPASS_WECHAT=true` → `authenticate(wechat: {code:'test', type:'mp'})` 返回 token
3. `DEV_BYPASS_ALIPAY=true` → `authenticate(alipay: {authCode:'test', type:'h5'})` 返回 token
4. `DEV_BYPASS_DOUYIN=true` → `authenticate(douyin: {code:'test', type:'mini'})` 返回 token

### 真实环境测试（需配置真实 appId）

- 微信公众号 H5：配置 `WECHAT_AUTH_APP_ID` 后，在微信浏览器内访问前端测试静默登录
- 支付宝 H5：配置 `ALIPAY_AUTH_APP_ID` 后，在支付宝浏览器内测试授权
- 抖音小程序：配置 `DOUYIN_AUTH_APP_ID` 后，编译到抖音小程序测试

## 实施阶段

| 阶段 | 内容 | 改动范围 |
|------|------|----------|
| Phase 1 | 完善 WeChat devBypass | `wechat-auth-plugin/src/wechat-auth-strategy.ts` + `types.ts` + `dev-config.ts` |
| Phase 2 | 用户注册功能 | `phone-auth-plugin/src/auth.resolver.ts` + 前端 `pages/register/index.vue` + `api/mutations/auth.ts` + `pages.json` |
| Phase 3 | AlipayAuthPlugin | 新增 `packages/alipay-auth-plugin/` + `dev-config.ts` 注册 + 前端登录页集成 |
| Phase 4 | DouyinAuthPlugin | 新增 `packages/douyin-auth-plugin/` + `dev-config.ts` 注册 + 前端登录页集成 |
| Phase 5 | 环境侦测 + 智能默认 | 前端 `utils/detect-env.ts` + `pages/login/index.vue` 重构 |

## 风险点

1. **支付宝 API 签名复杂**：支付宝开放平台 API 需 RSA 签名，比微信复杂。建议用 `alipay-sdk` npm 包处理签名
2. **抖音小程序兼容性**：`tt.login` API 在不同抖音版本表现不一，需测试
3. **Customer customFields 冲突**：新增 `alipayOpenid`、`douyinOpenid` 需确保不与现有字段冲突
4. **dev-config.ts 插件条件加载**：现有 `...(condition ? [Plugin.init({})] : [])` 模式需保持，devBypass 时不依赖真实凭证
5. **注册用户密码登录**：已确认 `NativeAuthenticationStrategy` 不限制 identifier 格式，注册用户用手机号+密码通过 `native` 策略登录即可。无需扩展认证策略

## 文件结构总览

### 后端改动

| 操作 | 路径 | 阶段 |
|------|------|------|
| 修改 | `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts` | P1 |
| 修改 | `packages/wechat-auth-plugin/src/types.ts` | P1 |
| 修改 | `packages/dev-server/dev-config.ts` | P1, P2, P3, P4 |
| 修改 | `packages/phone-auth-plugin/src/auth.resolver.ts` | P2 |
| 修改 | `packages/alipay-plugin/src/plugin.ts` | P3 |
| 修改 | `packages/alipay-plugin/src/types.ts` | P3 |
| 创建 | `packages/alipay-plugin/src/alipay-auth-*.ts`（4 文件） | P3 |
| 创建 | `packages/alipay-plugin/src/customer-custom-fields.ts` | P3 |
| 创建 | `packages/douyin-auth-plugin/src/*.ts`（6 文件） | P4 |

### 前端改动

| 操作 | 路径 | 阶段 |
|------|------|------|
| 创建 | `src/pages/register/index.vue` | P2 |
| 修改 | `src/pages/login/index.vue` | P3, P4, P5 |
| 修改 | `src/api/mutations/auth.ts` | P2, P3, P4 |
| 修改 | `src/pages.json` | P2 |
| 创建 | `src/utils/detect-env.ts` | P5 |

## 卡点检查记录

> 2026-07-14 完成 10 项卡点深度核查，修正 4 个硬阻塞点，1 个设计决策。

### 已修正的硬阻塞点

| 卡点 | 原假设 | 实际情况 | 修正 |
|------|--------|----------|------|
| 2 | `createCustomerUser(ctx, identifier, password, customer)` 4 参数 | 实际 3 参数 `(ctx, identifier, password?)`，无 customer 参数 | 改为分两步：先 createCustomerUser 创建 user，再 customerService.create 创建 customer 并关联 |
| 3 | `userService.getUserByIdentifier` 存在 | 不存在 | 改用 `getUserByEmailAddress(ctx, identifier)`（已支持非邮箱 identifier） |
| 7 | `UserExistsError` 存在 | 不存在 | 改用防账户枚举模式：用户已存在时返回 `{ success: true }` |
| 9 | `@Public()` 装饰器 | 不存在 | 改用 `@Allow(Permission.Public)`，导入 `Allow` from `@vendure/core`、`Permission` from `@vendure/common/lib/generated-types` |

### 设计决策

- **AlipayAuthPlugin 合并到 alipay-plugin 包**：alipay-sdk 已作为 alipay-plugin 的 dependency 安装，合并可避免重复依赖，复用 AlipaySdk 类

### 已确认无问题

| 卡点 | 结论 |
|------|------|
| 1 smsService.verifyCode 可访问性 | ✅ public 方法，resolver 已注入 |
| 4 alipay-sdk 依赖 | ✅ 已在 alipay-plugin 内安装 |
| 5 Customer customFields 冲突 | ✅ 命名 alipayOpenid/douyinOpenid 与 wechat 模式一致 |
| 6 AuthenticationStrategy 接口 | ✅ 实现 name/defineInputType/authenticate 即可 |
| 8 uni-app `#ifdef H5 \|\| MP-ALIPAY` | ✅ 语法支持，需扩展 PlatformType |
| 10 Plugin 定义模式 | ✅ 参照 WechatAuthPlugin 即可 |
