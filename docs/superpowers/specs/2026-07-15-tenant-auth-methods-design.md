# 租户登录方式配置

**日期**: 2026-07-15
**状态**: 已确认，待写实施计划
**关联**: cjk-plugin 多租户体系

## 背景与目标

当前系统有 5 套登录策略（native/phone/wechat/alipay/douyin），全部全局注册，无法按租户（Channel）启停。前端登录按钮按 `#ifdef` 条件编译和环境变量静态渲染，管理后台无配置 UI。

**目标**：
1. 每个租户可勾选启用的登录方式
2. 租户可覆盖平台默认凭证（混合凭证模式）
3. 支持通用 OAuth2 SSO（租户配置任意 OAuth2 IdP）
4. 管理后台提供配置 UI
5. 向后兼容：未配置的租户维持现状

## 数据模型

### Channel.customFields 新增字段

文件: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

```ts
{
    name: 'authConfig',
    type: 'json',
    nullable: true,
    public: true,  // C 端需读取以决定显示哪些登录按钮
    label: [{ languageCode: LanguageCode.zh_Hans, value: '租户登录方式配置' }],
}
```

### authConfig JSON 结构

定义在 `e:\code\vendure\packages\cjk-plugin\src\auth\auth-config.types.ts`：

```ts
type AuthMethod = 'native' | 'phone' | 'wechat' | 'alipay' | 'douyin' | 'sso';

interface TenantAuthConfig {
    /** 启用的登录方式列表 */
    enabledMethods: AuthMethod[];
    /** 租户自定义凭证覆盖（不填则用平台默认环境变量） */
    overrides?: Partial<{
        phone: { accessKeyId: string; accessKeySecret: string; signName: string; templateCode: string };
        wechat: { appId: string; appSecret: string; miniProgramAppId?: string; miniProgramAppSecret?: string };
        alipay: { appId: string; privateKey: string; miniProgramAppId?: string };
        douyin: { appId: string; appSecret: string; miniProgramAppId?: string; miniProgramAppSecret?: string };
    }>;
    /** SSO OAuth2 Provider 列表（数量不限） */
    ssoProviders?: SsoProvider[];
}

interface SsoProvider {
    name: string;           // 显示名，如 "企业SSO"
    providerKey: string;    // 唯一标识，如 "keycloak"
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    clientId: string;
    clientSecret: string;   // 存储前加密
    scopes: string[];       // 如 ['openid', 'profile']
    userInfoMapping?: {     // userInfo 响应字段到 Customer 字段的映射
        externalIdField?: string;   // 默认 'sub'
        emailField?: string;        // 默认 'email'
        nicknameField?: string;     // 默认 'name'
    };
}
```

### 默认值

- 新建 Channel 时 `authConfig` 为 null，表示"所有平台已注册的策略均启用"（向后兼容）
- `enabledMethods` 为空数组时，禁止所有 shop 端登录（admin 端 native 不受影响，防止锁死）

### 凭证加密

- 需加密的具体字段: `overrides.wechat.appSecret`、`overrides.wechat.miniProgramAppSecret`、`overrides.phone.accessKeySecret`、`overrides.alipay.privateKey`、`overrides.douyin.appSecret`、`overrides.douyin.miniProgramAppSecret`、`ssoProviders[].clientSecret`
- 不加密的字段: appId、accessKeyId、signName、templateCode、clientId、authorizeUrl、tokenUrl、userInfoUrl、scopes 等非敏感配置
- 算法: AES-256-GCM
- 存储格式: `enc:<iv-hex>:<tag-hex>:<ciphertext-hex>` 前缀标记
- 密钥来源: cjk-plugin init options 的 `authSecret` 或 `process.env.AUTH_SECRET`
- 加密实现: `e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts`
- 管理后台读取时脱敏（返回 `***` 表示非空，空字符串表示未设置）
- 保存时若字段值为 `***` 则保留原值不覆盖

## 后端策略拦截

### AuthMethodGuard

新增文件: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-method-guard.ts`

工具函数:
```ts
export function isAuthMethodEnabled(ctx: RequestContext, method: AuthMethod): boolean {
    const config = (ctx.channel as any).customFields?.authConfig as TenantAuthConfig | null;
    if (!config) return true;  // 向后兼容
    return config.enabledMethods.includes(method);
}
```

### 拦截方式：策略自查 + Guard 兜底

**策略自查**：修改 4 个自定义策略文件（phone/wechat/alipay/douyin），在 `authenticate` 方法开头加检查:
```ts
if (!isAuthMethodEnabled(ctx, 'phone')) {
    throw new UnauthorizedError('error.login-method-disabled');
}
```

**Guard 兜底**：在 cjk-plugin 注册全局 NestJS Guard，拦截 shop API 的 `authenticate` mutation。根据 args.strategy 参数映射到 AuthMethod，校验白名单。覆盖 native 策略（Vendure 内置，无法改源码）。

**native 特殊处理**：Guard 对 native 方法特殊处理——若 enabledMethods 不含 native，仍允许 admin 端 native 登录，仅拦截 shop 端。

### SSO 认证策略

新增文件: `e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts`

- name: `'sso'`
- authenticate: Vendure 的 `AuthenticateInput` 是动态参数列表 `[{ name, value }]`，SSO 策略从 args 中提取 `providerKey` 和 `code` 两个参数。前端调用 `authenticate(input: { strategy: "sso", providerKey: "xxx", code: "xxx" })`，Vendure 会将额外参数传给 strategy。
- 执行 OAuth2 Authorization Code 流程:
  1. POST tokenUrl 换 access_token
  2. GET userInfoUrl 获取用户信息
  3. 按 userInfoMapping 映射 externalId/email/nickname
  4. 按 `sso_<providerKey>_<externalId>` 格式查找或创建 Customer
- 注册到 `config.authOptions.shopAuthenticationStrategy`

### 租户凭证覆盖

各策略执行时读取 `ctx.channel.customFields.authConfig.overrides[method]`，若存在则用租户凭证覆盖全局环境变量:
```ts
const override = getAuthOverride(ctx, 'wechat');
const appId = override?.appId || process.env.WECHAT_AUTH_APP_ID;
```

### Shop API 扩展

```graphql
extend type Query {
    authMethods: [String!]!        # 当前 Channel 启用的登录方式列表
    ssoProviders: [SsoProviderInfo!]!  # SSO Provider 列表（不含 secret）
}

type SsoProviderInfo {
    name: String!
    providerKey: String!
    authorizeUrl: String!          # 前端构建跳转 URL 需要
    clientId: String!              # 前端构建跳转 URL 需要
    scopes: [String!]!             # 前端构建跳转 URL 需要
}
```

### Admin API 扩展

```graphql
extend type Query {
    channelAuthConfig(channelId: ID!): TenantAuthConfigMasked  # 脱敏后的配置
}

type TenantAuthConfigMasked {
    enabledMethods: [String!]!
    overrides: JSON  # secret 字段返回 ***
    ssoProviders: [SsoProviderMasked!]!
}

type SsoProviderMasked {
    name: String!
    providerKey: String!
    authorizeUrl: String!
    tokenUrl: String!
    userInfoUrl: String!
    clientId: String!
    clientSecret: String!  # 返回 *** 或空
    scopes: [String!]!
    userInfoMapping: JSON
}
```

无需新增 mutation，复用 Vendure 内置 `updateChannel` 更新 customFields.authConfig。

## 前端登录页改造

### tenant store 扩展

文件: `e:\code\vshop\src\stores\tenant.ts`

新增:
```ts
const authMethods = ref<string[]>([]);
const ssoProviders = ref<{name: string; providerKey: string; authorizeUrl: string; clientId: string; scopes: string[]}[]>([]);

async function loadAuthMethods() {
    const res = await getAuthMethods();
    authMethods.value = res.authMethods || ['native'];
}
async function loadSsoProviders() {
    const res = await getSsoProviders();
    ssoProviders.value = res.ssoProviders || [];
}
```

### API 层

文件: `e:\code\vshop\src\api\queries\channel.ts`

```ts
export async function getAuthMethods() {
    return client.request(`query { authMethods }`);
}
export async function getSsoProviders() {
    return client.request(`query { ssoProviders { name providerKey authorizeUrl clientId scopes } }`);
}
```

文件: `e:\code\vshop\src\api\mutations\auth.ts`

新增 SSO 登录 mutation:
```ts
export async function ssoLogin(providerKey: string, code: string) {
    return client.request(`mutation {
        authenticate(input: { strategy: "sso", providerKey: "${providerKey}", code: "${code}" }) {
            ... on CurrentUser { id identifier }
            ... on InvalidCredentialsError { errorCode message }
        }
    }`);
}
```

### 登录页改造

文件: `e:\code\vshop\src\pages\login\index.vue`

移除静态条件编译（`#ifdef`），改为根据 `tenantStore.authMethods` 动态渲染:
- `v-if="authMethods.includes('wechat')"` 控制微信按钮
- `v-if="authMethods.includes('alipay')"` 控制支付宝按钮
- `v-if="authMethods.includes('douyin')"` 控制抖音按钮
- `v-if="authMethods.includes('phone')"` 控制手机号按钮
- `v-if="authMethods.includes('native')"` 控制账号密码按钮
- `v-for="p in ssoProviders"` 渲染 SSO 按钮

### SSO 登录流程

```ts
function loginWithSso(provider: SsoProvider) {
    const redirectUri = `${window.location.origin}/pages/login/index`;
    const state = generateState();
    sessionStorage.setItem('sso_state', state);
    sessionStorage.setItem('sso_provider', provider.providerKey);
    window.location.href = `${provider.authorizeUrl}?` +
        `client_id=${provider.clientId}&redirect_uri=${redirectUri}` +
        `&response_type=code&scope=${provider.scopes.join(' ')}&state=${state}`;
}
```

onMounted 回调新增 SSO code 处理:
```ts
const ssoCode = getUrlParam('code');
const ssoState = getUrlParam('state');
const ssoProviderKey = sessionStorage.getItem('sso_provider');
if (ssoCode && ssoProviderKey) {
    await ssoLogin(ssoProviderKey, ssoCode);
}
```

### onMounted 流程

1. `tenant.loadAuthMethods()`
2. `tenant.loadSsoProviders()`
3. `detectPlatform()` — 保留原有自动跳转逻辑，但增加 authMethods 校验
4. 处理 OAuth 回调（wechat/alipay/douyin/sso）

## 管理后台配置 UI

### 位置

文件: `e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx`

替换当前空壳，实现真正的表单组件。

### UI 结构

```
┌─ 登录方式配置 ─────────────────────────────┐
│                                            │
│ 启用的登录方式：                           │
│  [✓] 账号密码 (native)                     │
│  [✓] 手机号 (phone)                        │
│  [✓] 微信 (wechat)                         │
│  [ ] 支付宝 (alipay)                       │
│  [ ] 抖音 (douyin)                         │
│  [✓] SSO                                   │
│                                            │
│ ─── 凭证覆盖（可选，留空用平台默认）───── │
│                                            │
│ 微信凭证：                                 │
│   appId:     [_______________]             │
│   appSecret: [_______________]             │
│   小程序appId: [_____________]             │
│                                            │
│ ─── SSO Providers ──────────────────────── │
│                                            │
│ [+ 添加 SSO Provider]                      │
│                                            │
│ ┌ Provider: keycloak ────────────────────┐ │
│ │ 显示名: [企业SSO]                      │ │
│ │ 标识:   [keycloak]                     │ │
│ │ Authorize URL: [https://...]           │ │
│ │ Token URL:     [https://...]           │ │
│ │ UserInfo URL:  [https://...]           │ │
│ │ Client ID:     [____________]          │ │
│ │ Client Secret: [********]              │ │
│ │ Scopes:        [openid,profile]        │ │
│ │ 字段映射:                              │ │
│ │   外部ID字段: [sub]                    │ │
│ │   邮箱字段:   [email]                  │ │
│ │   昵称字段:   [name]                   │ │
│ │ [删除]                                 │ │
│ └────────────────────────────────────────┘ │
│                                            │
│           [保存配置]                       │
└────────────────────────────────────────────┘
```

### 实现方式

使用 Dashboard 的 `DashboardDetailFormExtensionDefinition`，定义自定义 React 表单组件 `AuthConfigForm`:
- 读取当前 Channel 的 `customFields.authConfig`（通过 `channelAuthConfig` query 获取脱敏数据）
- checkbox 列表控制 `enabledMethods`
- 折叠面板编辑各方式 `overrides` 凭证
- 动态列表管理 SSO Providers（增删改）
- 保存时调用 `updateChannel` mutation 更新 `customFields.authConfig`
- 凭证字段值为 `***` 时保留原值不覆盖

## 安全与向后兼容

### 凭证加密

- 算法: AES-256-GCM
- 密钥来源: cjk-plugin init options 的 `authSecret` 或 `process.env.AUTH_SECRET`
- 加密范围: `overrides.*` 中的 secret 字段 + `ssoProviders[].clientSecret`
- 存储格式: `enc:<iv-hex>:<tag-hex>:<ciphertext-hex>`

### 向后兼容

| 场景 | authConfig 值 | 行为 |
|---|---|---|
| 旧 Channel（未配置） | null | 所有已注册策略均启用（等同现状） |
| 新建 Channel | null | 同上 |
| enabledMethods 为空 | `{ enabledMethods: [] }` | 禁止 shop 端所有登录，admin 端 native 仍可用 |
| 租户凭证覆盖为空 | `overrides: {}` | 用平台环境变量凭证 |
| SSO 未启用 | `ssoProviders: []` 或缺省 | 不显示 SSO 按钮 |

### native 方法保护

Guard 对 native 方法特殊处理：若 enabledMethods 不含 native，仅拦截 shop 端，admin 端 native 登录不受影响，防止管理员锁死。

## 错误处理

| 场景 | 处理 |
|---|---|
| authConfig JSON 解析失败 | 日志告警，降级为"所有策略启用" |
| SSO Provider 配置缺失字段 | 返回 `error.sso-config-incomplete` |
| OAuth2 token 换取失败 | 返回 `error.sso-token-exchange-failed` |
| userInfo 获取失败 | 返回 `error.sso-user-info-failed` |
| userInfo 映射字段缺失 | externalId 兜底用 `sub`，email/nickname 可空 |
| 凭证解密失败 | 日志告警，该方式禁用 |

## i18n 消息

新增文件: `e:\code\vendure\packages\cjk-plugin\src\auth\i18n-messages.ts`

错误码:
- `LOGIN_METHOD_DISABLED`: "该登录方式未启用"
- `SSO_CONFIG_INCOMPLETE`: "SSO 配置不完整"
- `SSO_TOKEN_EXCHANGE_FAILED`: "SSO 授权失败"
- `SSO_USER_INFO_FAILED`: "SSO 用户信息获取失败"

四语支持: zh_Hans / en / ja / ko

## dev-server 测试数据

### Default channel（平台默认）

文件: `e:\code\vendure\packages\dev-server\china-data\02-default-channel.ts`

```ts
authConfig: {
    enabledMethods: ['native', 'phone', 'wechat', 'alipay', 'douyin'],
    // 无 overrides，用平台环境变量凭证
}
```

### Shop-A channel（租户 A，自定义 SSO）

文件: `e:\code\vendure\packages\dev-server\china-data\03-shop-a-channel.ts`

```ts
authConfig: {
    enabledMethods: ['native', 'phone', 'wechat', 'sso'],
    overrides: {
        wechat: { appId: 'wx-tenant-a', appSecret: 'secret-a', miniProgramAppId: 'mini-a' }
    },
    ssoProviders: [
        {
            name: '企业SSO',
            providerKey: 'keycloak-dev',
            authorizeUrl: 'http://localhost:8080/realms/test/protocol/openid-connect/auth',
            tokenUrl: 'http://localhost:8080/realms/test/protocol/openid-connect/token',
            userInfoUrl: 'http://localhost:8080/realms/test/protocol/openid-connect/userinfo',
            clientId: 'vendure-test',
            clientSecret: 'test-secret',
            scopes: ['openid', 'profile', 'email'],
        }
    ]
}
```

## 涉及文件清单

### 后端（vendure）

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts` | 修改 | 新增 authConfig 字段 |
| `packages/cjk-plugin/src/auth/auth-config.types.ts` | 新增 | TS 类型定义 |
| `packages/cjk-plugin/src/auth/crypto.ts` | 新增 | AES-256-GCM 加密 |
| `packages/cjk-plugin/src/auth/auth-method-guard.ts` | 新增 | Guard + 工具函数 |
| `packages/cjk-plugin/src/auth/sso-authentication-strategy.ts` | 新增 | SSO 策略 |
| `packages/cjk-plugin/src/auth/i18n-messages.ts` | 新增 | 错误消息 |
| `packages/cjk-plugin/src/auth/auth-shop.resolver.ts` | 新增 | authMethods/ssoProviders query |
| `packages/cjk-plugin/src/auth/auth-admin.resolver.ts` | 新增 | channelAuthConfig query |
| `packages/cjk-plugin/src/plugin.ts` | 修改 | 注册新模块 |
| `packages/cjk-plugin/index.ts` | 修改 | 导出新模块 |
| `packages/cjk-plugin/dashboard/channel-detail-forms.tsx` | 修改 | AuthConfigForm 组件 |
| `packages/phone-auth-plugin/src/phone-authentication-strategy.ts` | 修改 | 加 isAuthMethodEnabled 检查 |
| `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts` | 修改 | 同上 |
| `packages/alipay-plugin/src/alipay-auth-strategy.ts` | 修改 | 同上 |
| `packages/douyin-auth-plugin/src/douyin-auth-strategy.ts` | 修改 | 同上 |
| `packages/dev-server/china-data/02-default-channel.ts` | 修改 | 测试数据 |
| `packages/dev-server/china-data/03-shop-a-channel.ts` | 修改 | 测试数据 |
| `packages/dev-server/dev-config.ts` | 修改 | CjkPlugin.init 加 authSecret |

### 前端（vshop）

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/stores/tenant.ts` | 修改 | authMethods/ssoProviders state |
| `src/api/queries/channel.ts` | 修改 | getAuthMethods/getSsoProviders |
| `src/api/mutations/auth.ts` | 修改 | ssoLogin mutation |
| `src/pages/login/index.vue` | 修改 | 动态渲染登录按钮 |

## 范围边界

**本次实现**:
- per-Channel 登录方式开关
- 租户凭证覆盖（混合模式）
- 通用 OAuth2 SSO
- 管理后台配置 UI
- 前端动态渲染
- 4 语 i18n

**本次不做**:
- SAML 协议支持（仅 OAuth2）
- 管理端 SSO 登录（仅 shop 端）
- 登录方式排序配置
- 登录方式 A/B 测试
