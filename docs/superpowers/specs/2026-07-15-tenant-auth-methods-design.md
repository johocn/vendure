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
    type: 'struct',  // Vendure 无 'json' 类型，用 'struct'（DB 存 json，GraphQL 暴露为 JSON 标量）
    nullable: true,
    public: true,  // C 端需读取以决定显示哪些登录按钮
    label: [{ languageCode: LanguageCode.zh_Hans, value: '租户登录方式配置' }],
    schema: {
        enabledMethods: { type: 'string', list: true },
        overrides: { type: 'json' },
        ssoProviders: { type: 'json' },
    },
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
        wechat: {
            appId: string;
            appSecret: string;
            miniProgramAppId?: string;
            miniProgramAppSecret?: string;
            /** 公众号消息校验 token（用于公众号服务器配置校验） */
            token?: string;
            /** 公众号通信加密密钥（EncodingAESKey，43 位） */
            encodingAESKey?: string;
        };
        alipay: { appId: string; privateKey: string; miniProgramAppId?: string };
        douyin: { appId: string; appSecret: string; miniProgramAppId?: string; miniProgramAppSecret?: string };
    }>;
    /** SSO Provider 列表（数量不限）。默认协议适配 zhao-sso（e:\code\basic\plugins\zhao-sso），也支持标准 OAuth2 */
    ssoProviders?: SsoProvider[];
}

interface SsoProvider {
    name: string;           // 显示名，如 "企业SSO"
    providerKey: string;    // 唯一标识，如 "zhao-sso-prod"
    /**
     * SSO 协议类型：
     * - 'zhao-sso'（默认）: 适配 e:\code\basic\plugins\zhao-sso 插件
     * - 'oauth2': 标准 OAuth2 Authorization Code 流程
     */
    protocol: 'zhao-sso' | 'oauth2';
    /** SSO 服务基础 URL，如 "https://sso.example.com"。zhao-sso 协议下自动派生各端点路径 */
    baseUrl: string;
    /** OAuth2 协议下需显式指定；zhao-sso 协议下可留空（自动派生 /v1/auth/authorize） */
    authorizeUrl?: string;
    /** OAuth2 协议下需显式指定；zhao-sso 协议下可留空（自动派生 /v1/auth/token） */
    tokenUrl?: string;
    /** OAuth2 协议下需显式指定；zhao-sso 协议下可留空（自动派生 /v1/user/me） */
    userInfoUrl?: string;
    /** zhao-sso 协议下为 appCode；OAuth2 协议下为 clientId */
    clientId: string;
    /** zhao-sso 协议下为 appSecret；OAuth2 协议下为 clientSecret。存储前加密 */
    clientSecret: string;
    /** OAuth2 scopes；zhao-sso 协议下可留空 */
    scopes?: string[];
    /** 渠道编码，zhao-sso 协议专用（传入 channel_code 字段），可用于租户识别 */
    channelCode?: string;
    userInfoMapping?: {     // userInfo 响应字段到 Customer 字段的映射
        externalIdField?: string;   // 默认 'uuid'（zhao-sso）或 'sub'（oauth2）
        emailField?: string;        // 默认 'email'
        nicknameField?: string;     // 默认 'nickname'（zhao-sso）或 'name'（oauth2）
        mobileField?: string;       // 默认 'mobile'（zhao-sso）
        avatarField?: string;       // 默认 'avatar_url'（zhao-sso）
    };
}
```

### 默认值

- 新建 Channel 时 `authConfig` 为 null，表示"所有平台已注册的策略均启用"（向后兼容）
- `enabledMethods` 为空数组时，禁止所有 shop 端登录（admin 端 native 不受影响，防止锁死）

### 凭证加密

- 需加密的具体字段: `overrides.wechat.appSecret`、`overrides.wechat.miniProgramAppSecret`、`overrides.wechat.encodingAESKey`、`overrides.phone.accessKeySecret`、`overrides.alipay.privateKey`、`overrides.douyin.appSecret`、`overrides.douyin.miniProgramAppSecret`、`ssoProviders[].clientSecret`
- 不加密的字段: appId、accessKeyId、signName、templateCode、token（公众号消息 token 视为非敏感，需传给微信服务器明文校验）、clientId、baseUrl、authorizeUrl、tokenUrl、userInfoUrl、scopes、channelCode 等非敏感配置
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

**策略自查**：修改 4 个自定义策略文件（phone/wechat/alipay/douyin），在 `authenticate` 方法开头加检查。注意 Vendure 认证策略契约：`authenticate` 应返回 `false | string` 表示认证失败，不抛异常。但"方法未启用"属于权限错误，抛 `ForbiddenError`（来自 `@vendure/core`）:
```ts
if (!isAuthMethodEnabled(ctx, 'phone')) {
    throw new ForbiddenError();  // error.forbidden
}
```

**Guard 兜底**：在 cjk-plugin 注册全局 NestJS Guard（通过 `providers: [{ provide: APP_GUARD, useClass: AuthMethodGuard }]`），拦截 shop API 的 `authenticate` mutation。

Guard 实现要点：
```ts
@Injectable()
export class AuthMethodGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const gqlCtx = GqlExecutionContext.create(context);
        const info = gqlCtx.getInfo<GraphQLResolveInfo>();
        // 仅拦截 shop 端 authenticate mutation
        if (info?.fieldName !== 'authenticate') return true;
        const args = gqlCtx.getArgs();
        // AuthenticationInput 是 map: { native?: {...}, phone?: {...}, sso?: {...} }
        const method = Object.keys(args.input)[0];  // 如 'native'/'phone'/'wechat'/'sso'
        const req = gqlCtx.getContext().req;
        const ctx = internal_getRequestContext(req);  // 从 req 提取 RequestContext
        if (!isAuthMethodEnabled(ctx, method as AuthMethod)) {
            throw new ForbiddenError();
        }
        return true;
    }
}
```

**native 特殊处理**：Guard 仅注册到 shop API 模块（不拦截 admin API），这样 native 方法被禁用时仅影响 shop 端，admin 端 native 登录不受影响，防止管理员锁死。

**Guard 执行顺序**：Vendure Core 的 AuthGuard 在 ApiModule 注册，先于插件 Guard 执行，确保 `RequestContext` 已写入 `req`。

### SSO 认证策略

新增文件: `e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts`

- name: `'sso'`
- **defineInputType()**: 必须实现此方法定义 GraphQL input 类型。Vendure 的 `AuthenticationInput` 是动态 map，每个策略名作为 key，value 是该策略定义的 input 类型:
```ts
defineInputType() {
    return gql`
        input SsoAuthInput {
            providerKey: String!
            code: String!
        }
    `;
}
```
- authenticate(ctx, data): data 类型为 `SsoAuthInput`，即 `{ providerKey, code }`。
- 前端调用方式: `authenticate(input: { sso: { providerKey: "xxx", code: "xxx" } })`（不是 `authenticate(input: { strategy: "sso", ... })`）。
- 根据 `provider.protocol` 分支处理:

**zhao-sso 协议**（默认，适配 `e:\code\basic\plugins\zhao-sso`）:
1. POST `${baseUrl}/v1/auth/token` body `{ grant_type: "authorization_code", code, app_code: clientId, app_secret: clientSecret, redirect_uri }`，返回 `{ access_token, refresh_token, expires_in, token_type }`
2. GET `${baseUrl}/v1/user/me` 带 `Authorization: Bearer <access_token>`，返回 SsoUser（含 uuid/username/mobile/email/nickname/avatar_url）
3. 按 userInfoMapping 映射（默认 externalIdField='uuid'、emailField='email'、nicknameField='nickname'、mobileField='mobile'、avatarField='avatar_url'）
4. 按 `sso_<providerKey>_<externalId>` 格式查找或创建 Customer

**标准 OAuth2 协议**:
1. POST `${tokenUrl}` body `{ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri }`，返回 `{ access_token, ... }`
2. GET `${userInfoUrl}` 带 `Authorization: Bearer <access_token>`
3. 按 userInfoMapping 映射（默认 externalIdField='sub'、emailField='email'、nicknameField='name'）
4. 按 `sso_<providerKey>_<externalId>` 格式查找或创建 Customer

- 认证失败时返回 `false`（不是抛异常），Vendure 会包装为 `InvalidCredentialsError`。
- 注册到 `config.authOptions.shopAuthenticationStrategy`

### 租户凭证覆盖

各策略当前从 `this.options`（插件全局 options）读取凭证，不从 `process.env` 读取。改为优先读取 `ctx.channel.customFields.authConfig.overrides[method]`，回退到 `this.options`:
```ts
// 在各策略文件内内联此函数（避免依赖 cjk-plugin 造成循环依赖）
function getAuthOverride(ctx: RequestContext, method: string) {
    const config = (ctx.channel as any).customFields?.authConfig;
    if (!config?.overrides) return null;
    return config.overrides[method] || null;
}

// wechat-auth-strategy.ts 内使用:
const override = getAuthOverride(ctx, 'wechat');
const appId = override?.appId || this.options.appId;
const appSecret = override?.appSecret || this.options.appSecret;
const token = override?.token || this.options.token;
const encodingAESKey = override?.encodingAESKey || this.options.encodingAESKey;
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
    protocol: String!              # 'zhao-sso' 或 'oauth2'
    baseUrl: String!               # zhao-sso 协议下前端构建 authorizeUrl 需要
    authorizeUrl: String           # oauth2 协议下前端跳转需要；zhao-sso 下为 null（前端自动派生 /v1/auth/authorize）
    clientId: String!              # zhao-sso 下为 appCode，oauth2 下为 clientId
    scopes: [String!]!             # oauth2 协议前端构建跳转 URL 需要
    channelCode: String            # zhao-sso 协议专用
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
    protocol: String!
    baseUrl: String!
    authorizeUrl: String
    tokenUrl: String
    userInfoUrl: String
    clientId: String!
    clientSecret: String!  # 返回 *** 或空
    scopes: [String!]!
    channelCode: String
    userInfoMapping: JSON
}
```

无需新增 mutation，复用 Vendure 内置 `updateChannel` 更新 customFields.authConfig。

## 前端登录页改造

### tenant store 扩展

文件: `e:\code\vshop\src\stores\tenant.ts`

新增:
```ts
interface SsoProviderInfo {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string | null;
    clientId: string;
    scopes: string[];
    channelCode?: string | null;
}

const authMethods = ref<string[]>([]);
const ssoProviders = ref<SsoProviderInfo[]>([]);

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
    return client.request(`query { ssoProviders { name providerKey protocol baseUrl authorizeUrl clientId scopes channelCode } }`);
}
```

文件: `e:\code\vshop\src\api\mutations\auth.ts`

新增 SSO 登录 mutation:
```ts
export async function ssoLogin(providerKey: string, code: string) {
    // AuthenticationInput 是 map: { sso: { providerKey, code } }
    return client.request(`mutation {
        authenticate(input: { sso: { providerKey: "${providerKey}", code: "${code}" } }) {
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

根据 provider.protocol 构建不同的跳转 URL:

```ts
function loginWithSso(provider: SsoProviderInfo) {
    const redirectUri = `${window.location.origin}/pages/login/index`;
    const state = generateState();
    sessionStorage.setItem('sso_state', state);
    sessionStorage.setItem('sso_provider', provider.providerKey);

    let authorizeUrl: string;
    let params: Record<string, string>;

    if (provider.protocol === 'zhao-sso') {
        // zhao-sso 协议: GET /v1/auth/authorize?app_code=&redirect_uri=&response_type=code&state=&channel_code=
        authorizeUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/auth/authorize`;
        params = {
            app_code: provider.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
        };
        if (provider.channelCode) params.channel_code = provider.channelCode;
    } else {
        // 标准 OAuth2 协议
        authorizeUrl = provider.authorizeUrl!;
        params = {
            client_id: provider.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: provider.scopes.join(' '),
            state,
        };
    }

    const query = new URLSearchParams(params).toString();
    window.location.href = `${authorizeUrl}?${query}`;
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

文件: `e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx` 和 `e:\code\vendure\packages\cjk-plugin\dashboard\auth-config-widget.tsx`

**重要**: Dashboard 的 `DashboardDetailFormExtensionDefinition` 无 `form` 字段，`inputs` 只能替换已存在字段。自定义配置区需用 `pageBlocks`（添加新区块到页面）或 `widgets`。

实际方案：channel-detail 页面有 `CustomFieldsPageBlock` 自动渲染 customFields。`authConfig` 作为 `struct` 类型 customField 会被自动渲染为 JSON 编辑器（可用但体验差）。如需友好 UI，用 `inputs` 覆盖 `authConfig` 字段的渲染组件:

```tsx
// channel-detail-forms.tsx
import { AuthConfigInput } from './auth-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
        // 扩展 detail query 以确保 authConfig 字段被查询
        extendDetailDocument: `
            query ExtendChannelAuthConfig {
                channel {
                    customFields {
                        authConfig
                    }
                }
            }
        `,
        inputs: [
            {
                blockId: 'custom-fields',  // CustomFieldsPageBlock 的 blockId
                field: 'authConfig',       // 要覆盖的 customField 名
                component: AuthConfigInput, // 自定义 React 组件
            },
        ],
    },
];
```

`AuthConfigInput` 组件接收 `DashboardFormComponentProps`（基于 react-hook-form 的 ControllerRenderProps），value 是 authConfig JSON 对象，onChange 更新表单值。

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
│   appId:          [_______________]        │
│   appSecret:      [_______________]        │
│   小程序appId:    [_____________]          │
│   小程序appSecret:[_____________]          │
│   公众号Token:    [____________]           │
│   EncodingAESKey: [____________]           │
│                                            │
│ ─── SSO Providers ──────────────────────── │
│                                            │
│ [+ 添加 SSO Provider]                      │
│                                            │
│ ┌ Provider: zhao-sso-prod ───────────────┐ │
│ │ 显示名: [企业SSO]                      │ │
│ │ 标识:   [zhao-sso-prod]                │ │
│ │ 协议:   [zhao-sso ▼] / [oauth2]        │ │
│ │                                         │ │
│ │ (zhao-sso 协议显示)                    │ │
│ │ BaseUrl:     [https://sso.example.com]  │ │
│ │ AppCode:     [____________]             │ │
│ │ AppSecret:   [********]                 │ │
│ │ ChannelCode: [shop-a]                   │ │
│ │                                         │ │
│ │ (oauth2 协议显示)                      │ │
│ │ AuthorizeUrl:[https://...]              │ │
│ │ TokenUrl:    [https://...]              │ │
│ │ UserInfoUrl: [https://...]              │ │
│ │ ClientId:    [____________]             │ │
│ │ ClientSecret:[********]                 │ │
│ │ Scopes:      [openid,profile]           │ │
│ │                                         │ │
│ │ 字段映射（可选，留空用默认）:          │ │
│ │   外部ID字段: [uuid/sub]                │ │
│ │   邮箱字段:   [email]                   │ │
│ │   昵称字段:   [nickname/name]           │ │
│ │   手机号字段: [mobile]                  │ │
│ │   头像字段:   [avatar_url]              │ │
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
| 登录方式未启用 | 策略自查抛 `ForbiddenError`（error.forbidden）；Guard 兜底也抛 `ForbiddenError` |
| SSO Provider 配置缺失字段 | 策略返回 `false`（Vendure 包装为 InvalidCredentialsError） |
| OAuth2 token 换取失败 | 策略返回 `false` |
| userInfo 获取失败 | 策略返回 `false` |
| userInfo 映射字段缺失 | externalId 兜底用默认字段，email/nickname 可空 |
| 凭证解密失败 | 日志告警，该方式凭证回退到全局 options |

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

### Shop-A channel（租户 A，自定义 SSO，zhao-sso 协议）

文件: `e:\code\vendure\packages\dev-server\china-data\03-shop-a-channel.ts`

```ts
authConfig: {
    enabledMethods: ['native', 'phone', 'wechat', 'sso'],
    overrides: {
        wechat: {
            appId: 'wx-tenant-a',
            appSecret: 'secret-a',
            miniProgramAppId: 'mini-a',
            token: 'tenant-a-msg-token',
            encodingAESKey: 'tenant-a-43-char-encoding-aes-key-herexxxxxxxx',
        }
    },
    ssoProviders: [
        {
            name: '企业SSO',
            providerKey: 'zhao-sso-dev',
            protocol: 'zhao-sso',
            baseUrl: 'http://localhost:1337',
            clientId: 'vendure-shop-a',
            clientSecret: 'shop-a-app-secret',
            channelCode: 'shop-a',
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
| `packages/cjk-plugin/dashboard/channel-detail-forms.tsx` | 修改 | 注册 authConfig 字段的自定义 input 组件 |
| `packages/cjk-plugin/dashboard/auth-config-widget.tsx` | 新增 | AuthConfigInput React 组件（checkbox+凭证+SSO Provider 编辑） |
| `packages/phone-auth-plugin/src/phone-authentication-strategy.ts` | 修改 | 加 isAuthMethodEnabled 检查 |
| `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts` | 修改 | 加 isAuthMethodEnabled 检查 + 读取 overrides 中 token/encodingAESKey |
| `packages/wechat-auth-plugin/src/types.ts` | 修改 | WechatAuthPluginOptions 增加 token/encodingAESKey 字段 |
| `packages/alipay-plugin/src/alipay-auth-strategy.ts` | 修改 | 加 isAuthMethodEnabled 检查 |
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
- 微信公众号 token + EncodingAESKey 凭证支持
- SSO 双协议支持: zhao-sso（默认，适配 `e:\code\basic\plugins\zhao-sso`）+ 标准 OAuth2
- 管理后台配置 UI
- 前端动态渲染
- 4 语 i18n

**本次不做**:
- SAML 协议支持（仅 OAuth2/zhao-sso）
- 管理端 SSO 登录（仅 shop 端）
- 登录方式排序配置
- 登录方式 A/B 测试
