# 租户统一配置中心设计

- **日期**: 2026-07-17
- **范围**: Vendure (cjk-plugin + wechat-auth-plugin + alipay-plugin + douyin-auth-plugin + wechatpay-plugin)
- **状态**: 已确认,待制定实现计划

## 1. 背景与目标

### 1.1 背景

Vendure 多租户应用的租户级配置当前散落在 `Channel.customFields` 三个独立 struct 字段(`payConfig` / `authConfig` / `mapConfig`),加密策略与可见性不一,Admin UI 无专用编辑面板(依赖 Vendure 默认 struct 表单,体验差且无掩码)。同时存在多处消费逻辑缺口:

1. 微信公众号 `token`/`encodingAESKey` 在 `wechat-auth-strategy.ts` 中**定义但未消费**(预留消息加解密,未实现)
2. `mapConfig.apiKey`/`securityJsCode` **明文存储**,与 `payConfig`/`authConfig` 加密策略不一致
3. zhao-sso 的 `SsoProvider` 契约已存在,但 Strapi 侧 `sso-app` 与 Vendure 侧 `ssoProvidersJson` 需手工对齐,且注册流程的邀请码衔接未实现
4. 支付侧**缺抖音支付**(`PaymentMethodCode` 仅 `alipay`/`wechatpay`)

### 1.2 目标

建立**租户统一配置中心**,在 Vendure Admin Channel 详情页提供聚合编辑界面,覆盖支付/微信登录/SSO/地图四类配置。Super-admin 可配置全部 Channel,租户管理员仅可配置关联 Channel。同步补全上述消费逻辑缺口。

### 1.3 非目标(范围外)

- Strapi 侧 zhao-sso 插件代码改动(仅 Vendure 侧消费)
- `InviteCodeService` 奖励发放/统计/上下级树(仅存 inviteCode + 框架)
- 自定义权限模型(复用 `Administrator.channels`)
- 动态 Provider 注册机制(枚举+JSON 模式)
- 配置变更通知/事件总线
- 配置版本控制/回滚
- 配置导入导出
- Strapi ↔ Vendure 配置双向同步(两侧独立管理,文档提示对齐)
- admin-ui 独立菜单页(嵌入式 pageBlock 已满足)

## 2. 现状调研

### 2.1 数据模型层(已完备)

文件 `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`:

```ts
Channel: [
    { name: 'couponStackable', type: 'boolean' },        // 保留,本次不动
    { name: 'maxStackableCount', type: 'int' },           // 保留
    { name: 'employeePickupMode', type: 'string' },       // 保留(企业职工自提)
    { name: 'defaultLocation', type: 'struct' },          // 保留(经纬度兜底)
    {
        name: 'authConfig', type: 'struct', public: true, // 已加密
        fields: [
            { name: 'enabledMethods', type: 'string', list: true },
            { name: 'overridesJson', type: 'text' },      // wechat/alipay/douyin/phone
            { name: 'ssoProvidersJson', type: 'text' },   // SsoProvider[]
        ],
    },
    {
        name: 'payConfig', type: 'struct',                // 已加密
        fields: [
            { name: 'alipayJson', type: 'text' },
            { name: 'wechatpayJson', type: 'text' },
            // 本次新增: { name: 'douyinpayJson', type: 'text' }
        ],
    },
    { name: 'customDomains', type: 'string', list: true },// 保留
    {
        name: 'mapConfig', type: 'struct', public: false, // 本次补加密
        fields: [
            { name: 'provider', type: 'string' },
            { name: 'apiKey', type: 'text' },
            { name: 'securityJsCode', type: 'text' },
        ],
    },
]
```

### 2.2 登录契约(已完整支持三平台)

文件 `e:\code\vendure\packages\cjk-plugin\src\auth\auth-config.types.ts`:

| AuthMethod | overrides 字段 | 加密字段 | 对接插件 |
|---|---|---|---|
| `wechat` | appId/appSecret/miniProgramAppId/miniProgramAppSecret/**token**/**encodingAESKey** | appSecret/miniProgramAppSecret/encodingAESKey | wechat-auth-plugin |
| `alipay` | appId/privateKey/miniProgramAppId | privateKey | alipay-plugin.auth |
| `douyin` | appId/appSecret/miniProgramAppId/miniProgramAppSecret | appSecret/miniProgramAppSecret | douyin-auth-plugin |
| `phone` | accessKeyId/accessKeySecret/signName/templateCode | accessKeySecret | phone-auth-plugin |
| `sso` | SsoProvider[] | clientSecret | sso-authentication-strategy |

**关键**: `token`(公众号消息校验)明文存储(校验语义所需),`encodingAESKey`(通信加密密钥)加密存储。

### 2.3 支付契约(缺抖音)

文件 `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.types.ts`:

| PaymentMethodCode | 字段 | 现状 |
|---|---|---|
| `alipay` | appId/privateKey/tradeType | ✅ |
| `wechatpay` | appId/mchId/publicKey/privateKey/apiKey/serialNo/tradeType | ✅ |
| `douyinpay` | — | ❌ 本次新增 |

### 2.4 加密机制(已存在)

文件 `e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts`:

- 算法: `aes-256-gcm`,前缀 `enc:`
- 密钥来源优先级: `CjkPlugin.options.authSecret` > `process.env.AUTH_SECRET` > `'default-dev-key-change-in-prod'`
- 已提供: `encrypt`/`decrypt`/`isEncrypted`/`encryptAuthConfig`/`decryptAuthConfig`/`maskAuthConfig`/`mergeAuthConfig`/`parseAndDecryptStruct`/`readChannelAuthConfig`/`getAuthOverride`/`serializeAuthConfigToStruct`
- 合并语义: `***` = 保留原值,空字符串 = 清空,其他 = 覆盖

### 2.5 Admin UI 扩展机制

- cjk-plugin 使用 Vendure 3.6.4 全新 React-based Dashboard 扩展体系(`@vendure/dashboard`),入口 `dashboard/index.tsx` 通过 `defineDashboardExtension({ routes, detailForms })` 注册
- **Vendure Dashboard 不提供原生「Channel 详情页 Tab 注入」API**(Channel 详情页是 PageBlock 垂直堆叠,无 tab 容器)
- 已有先例: `channel-detail-forms.tsx` 用 `detailForms` 字段级输入组件替换
- 变通路径: 用 `pageBlocks` + `position.order: 'after'` 在 `custom-fields` block 之后插入独立 block,block 内部用 `@vendure/dashboard` 导出的 `Tabs` 组件渲染 tab UI

### 2.6 zhao-sso 边界

- zhao-sso 是 Strapi 插件(`e:\code\plugins\zhao-sso`),其 `sso-app` 数据(app_code/app_secret/redirect_uris)存在 Strapi 库
- cjk-plugin `SsoAuthenticationStrategy` 中 `protocol === 'zhao-sso'` 分支硬编码拼接 `${baseUrl}/v1/auth/token` 与 `${baseUrl}/v1/user/me`,body 用 `app_code`/`app_secret`,`Content-Type: application/json`
- **本次仅管 Vendure 侧 SsoProvider 配置**;Strapi 侧 sso-app 由 zhao-sso 插件自带 admin 面板管理,两侧手工对齐(UI 提示)
- 邀请码由 Strapi 注册接口返回,Vendure 独自处理

## 3. 架构设计

### 3.1 三层架构

```
┌─────────────────────────────────────────────────────┐
│  UI 层 (dashboard/)                                 │
│  pageBlocks after 'custom-fields'                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ TenantConfigTabs                            │    │
│  │  ├─ 支付(微信/抖音/支付宝)                  │    │
│  │  ├─ 微信登录(token/encodingAESKey 等)      │    │
│  │  ├─ SSO(zhao-sso/oauth2 Provider)          │    │
│  │  └─ 地图(amap/tencent/baidu)               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                          ↕ GraphQL
┌─────────────────────────────────────────────────────┐
│  Resolver 层 (src/admin/)                           │
│  TenantConfigAdminResolver (单一聚合入口)           │
│   ├─ Query.tenantConfig(channelId)  → 掩码聚合读取  │
│   ├─ Mutation.updateTenantConfig    → 统一写入+加密 │
│   ├─ Mutation.testSsoConnection     → 连通性测试    │
│   └─ 权限校验:ctx.user.channels ∋ channelId        │
│      (super-admin 跳过;否则抛 PermissionError)     │
└─────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│  Service 层 (src/ 现有,接口对齐)                    │
│  ├─ AuthConfigService    (复用 crypto.ts)           │
│  ├─ PayConfigService     (新增 maskPayConfig/mergePayConfig) │
│  ├─ MapConfigService     (新增 map-crypto.ts)       │
│  └─ SsoProviderService   (新增 testConnection)      │
└─────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│  数据层 (Channel.customFields,schema 最小扩展)      │
│  ├─ payConfig      struct (新增 douyinpayJson)      │
│  ├─ authConfig     struct (不动)                    │
│  └─ mapConfig      struct (本次补加密)              │
└─────────────────────────────────────────────────────┘
```

### 3.2 关键设计决策

1. **UI 路径**: 用 `pageBlocks` + `order: 'after'` 在 `custom-fields` block 之后插入独立 block,内部用 `Tabs` 渲染 4 tab。**完全不动原有 customFields block**(保留 employeePickupMode/defaultLocation/customDomains/couponStackable 等)
2. **单一聚合 Resolver**: 所有写入走 `updateTenantConfig`,加密/掩码/权限校验集中一处
3. **复用现有 widget**: `auth-config-widget.tsx`/`payment-config-widget.tsx` 已存在,本次整合进 tab
4. **schema 最小扩展**: 仅 payConfig 新增 `douyinpayJson` 字段,其余三类不动
5. **zhao-sso 边界**: 仅管 Vendure 侧 SsoProvider;Strapi 侧独立管理;邀请码由 Strapi 返回后 Vendure 独自处理
6. **预留扩展**: 用枚举+JSON 字段模式,未来新增平台需加枚举值+Json 字段+加密分支(三处改动,模式一致);SsoProvider 已支持 `protocol: 'zhao-sso' | 'oauth2'`,天然预留任意 OAuth2 兼容 IdP

## 4. 数据层改动

### 4.1 扩展支付契约支持抖音支付

文件 `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.types.ts`:

```ts
export type PaymentMethodCode = 'alipay' | 'wechatpay' | 'douyinpay';

export interface DouyinpayCredentials {
    appId: string;
    appSecret: string;
    mchId: string;
    privateKey: string;
    salt?: string;
    tradeType?: 'QR' | 'WAP' | 'APP' | 'MINI';
}

export interface PayConfig {
    alipay?: AlipayCredentials;
    wechatpay?: WechatpayCredentials;
    douyinpay?: DouyinpayCredentials;
}

export interface PayConfigStruct {
    alipayJson: string;
    wechatpayJson: string;
    douyinpayJson: string;   // 新增
}
```

### 4.2 扩展 Channel.customFields.payConfig schema

文件 `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`,payConfig struct fields 增加:

```ts
{ name: 'douyinpayJson', type: 'text' },
```

### 4.3 扩展 payment-config.ts 解析逻辑

`readChannelPayConfig` 增加 douyinpayJson 解析分支(与 alipayJson/wechatpayJson 同模式)。

### 4.4 支付加密补齐一致性

新增 `src/payment/pay-config-crypto.ts`,提供 `encryptPayConfig`/`decryptPayConfig`/`maskPayConfig`/`mergePayConfig`,复用 `crypto.ts` 的 `encrypt`/`decrypt` 原语。加密字段:

- alipay: privateKey
- wechatpay: privateKey / apiKey
- douyinpay: appSecret / privateKey

`readChannelPayConfig` 读取后调 `decryptPayConfig`;`PayConfigService.getMasked` 返回前调 `maskPayConfig`;Resolver 写入前调 `encryptPayConfig`。

### 4.5 mapConfig 加密

新增 `src/map/map-crypto.ts`,提供 `encryptMapConfig`/`decryptMapConfig`/`maskMapConfig`/`mergeMapConfig`,复用 `crypto.ts` 原语。加密字段:

- apiKey
- securityJsCode

`MapService.getConfigForChannel` 读取后调 `decryptMapConfig`;`MapAdminResolver.channelMapConfig` 返回前调 `maskMapConfig`;Resolver 写入前调 `encryptMapConfig`。

## 5. 数据迁移

### 5.1 mapConfig 加密迁移(一次性)

- 新增 `src/migrations/migrate-mapconfig-encryption.ts`
- bootstrap 启动时调用,幂等
- 逻辑: 遍历所有 Channel,读 `customFields.mapConfig`,若 `apiKey` 非空且不以 `enc:` 开头,则加密回写 `apiKey`/`securityJsCode`
- 完成后写一条 HistoryEntry `MAP_CONFIG_MIGRATION_DONE`,避免重复扫描

### 5.2 payConfig 加密迁移(一次性)

**现状**: `readChannelPayConfig`(`e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.ts`)仅 `JSON.parse`,无 decrypt 调用,确认 payConfig 当前**明文存储**。

- 新增 `src/migrations/migrate-payconfig-encryption.ts`
- 逻辑同上,遍历 Channel,若 alipayJson/wechatpayJson 中的 privateKey/apiKey 未加密则加密回写
- 完成后写 HistoryEntry `PAY_CONFIG_MIGRATION_DONE`

### 5.3 payConfig.douyinpayJson 新增字段

- schema 新增字段默认 null,无需数据迁移
- `readChannelPayConfig` 解析空 douyinpayJson 返回 undefined

## 6. Resolver 层 + 权限校验

### 6.1 GraphQL Schema(admin)

```graphql
extend type Query {
    tenantConfig(channelId: ID!): TenantConfigPayload!
}

extend type Mutation {
    updateTenantConfig(input: UpdateTenantConfigInput!): TenantConfigPayload!
    testSsoConnection(input: TestSsoInput!): TestSsoResult!
}

type TenantConfigPayload {
    channelId: ID!
    auth: TenantAuthConfigMasked!
    pay: PayConfigMasked!
    map: MapConfigMasked!
    canEdit: Boolean!
}

input UpdateTenantConfigInput {
    channelId: ID!
    authPatch: TenantAuthConfigInput
    payPatch: PayConfigInput
    mapPatch: MapConfigInput
}

input TestSsoInput {
    channelId: ID!
    providerKey: String!
    newClientSecret: String
}

type TestSsoResult {
    success: Boolean!
    latencyMs: Int!
    error: String
}
```

### 6.2 权限校验

**校验位置**: Resolver 层,Service 层不重复校验。

**规则**:
1. **Super-admin**(Role code = `super-admin`): 可访问任意 channelId,`canEdit = true`
2. **租户管理员**: `ctx.user.channels` 必须包含目标 channelId,否则抛 `PermissionError { code: 'TENANT_CONFIG_FORBIDDEN' }`,`canEdit = true`
3. **无关联**: 抛 `PermissionError`,前端展示"无权访问此租户配置"

**实现要点**:
- Vendure 已有 `ctx.user.channels`(Administrator.channels 关联),Resolver 直接读
- 用 Vendure `PermissionDefinition` 注册自定义权限 `ManageTenantConfig`,super-admin 角色默认拥有
- 租户管理员通过 channel 关联隐式获得权限(不写 Role permission 表,运行时 channel 校验)

### 6.3 Service 层契约

三个 Service 接口对齐:

| Service | getMasked(id) | update(id, patch) | testConnection? |
|---|---|---|---|
| AuthConfigService | 复用 maskAuthConfig | 复用 mergeAuthConfig | — |
| PayConfigService | 新增 maskPayConfig | 新增 mergePayConfig | — |
| MapConfigService | 新增 maskMapConfig | 新增 mergeMapConfig | — |
| SsoProviderService | (属 AuthConfigService) | — | 新增 testConnection |

**合并语义** (三 Service 一致): `***` = 保留原值,空字符串 = 清空,其他 = 覆盖。

### 6.4 SSO 连通性测试

`testSsoConnection` 实现:
1. 读 Channel 的 SsoProvider(若 newClientSecret 提供则用新值,否则用已存储解密值)
2. 模拟 cjk-plugin SsoAuthenticationStrategy 的 zhao-sso 协议:
   - 优先尝试 POST `${baseUrl}/v1/auth/token`,body `{ grant_type: 'client_credentials', app_code, app_secret }`(若 zhao-sso 支持 client_credentials)
   - 若不支持(返回 400/unsupported_grant_type),降级为 GET `${baseUrl}/v1/health` 或 `/v1/auth/authorize` 端点连通性
3. 返回 `{ success, latencyMs, error? }`
4. 不落库,不记录 secret

**实现时需确认 zhao-sso 是否支持 client_credentials**,若不支持则降级。

### 6.5 审计日志

`updateTenantConfig` 成功后,写 Vendure HistoryEntry:
- `type: 'TENANT_CONFIG_UPDATE'`
- `data: { channelId, sections: ['auth','pay','map'], operator: ctx.user.identifier }`
- 不记录具体值(避免 secret 泄露)

## 7. UI 层

### 7.1 组件结构

```
dashboard/
├─ index.tsx                              # 注册 pageBlocks
├─ tenant-config-center.tsx               # 顶层 pageBlock 容器
├─ tenant-config-tabs.tsx                 # Tabs 组件
└─ tenant-config/
   ├─ payment-tab.tsx                     # 支付 tab(微信/抖音/支付宝)
   ├─ wechat-auth-tab.tsx                 # 微信登录 tab(复用 auth-config-widget)
   ├─ sso-tab.tsx                         # SSO tab(新建)
   ├─ map-tab.tsx                         # 地图 tab(新建)
   └─ shared/
      ├─ masked-input.tsx                 # 掩码输入组件
      ├─ section-card.tsx                 # 平台分组卡片
      └─ use-tenant-config.ts             # GraphQL hook
```

### 7.2 pageBlock 注册

`dashboard/index.tsx` 扩展为 `defineDashboardExtension({ routes, detailForms, pageBlocks })`:

```ts
pageBlocks: [
    {
        location: {
            pageId: 'channel-detail',
            blockId: 'custom-fields',
            position: { order: 'after' },
        },
        component: () => import('./tenant-config-center'),
    },
],
```

`tenant-config-center.tsx`:
- 通过 `useDetailPage()` 获取当前 channelId
- 调 `useTenantConfig(channelId)` Query 加载
- 渲染 `<TenantConfigTabs>`,传入三段配置 + `canEdit`
- `canEdit === false` 时所有输入禁用 + 顶部提示"无权编辑此租户配置"

### 7.3 Tabs 布局

```
[支付] [微信登录] [SSO] [地图]

支付 tab
├─ 微信支付卡片(wechatpay: appId/mchId/publicKey/privateKey/apiKey/serialNo/tradeType)
├─ 抖音支付卡片(douyinpay: appId/appSecret/mchId/privateKey/salt/tradeType)  ← 新增
└─ 支付宝卡片(alipay: appId/privateKey/tradeType)

微信登录 tab
├─ enabledMethods 开关(wechat)
├─ 公众号配置(appId/appSecret/token/encodingAESKey)  ← token/encodingAESKey 必填可编辑
└─ 小程序配置(miniProgramAppId/miniProgramAppSecret)

SSO tab
├─ Provider 列表(可增删,每项: name/providerKey/protocol/baseUrl/clientId/clientSecret/scopes/channelCode/userInfoMapping)
├─ [测试连通性] 按钮(调 testSsoConnection)
└─ 提示: "Strapi 侧 sso-app 需在 zhao-sso 插件管理面板同步配置 app_code/app_secret/redirect_uris"

地图 tab
├─ provider 选择(amap/tencent/baidu)
├─ apiKey(掩码)
├─ securityJsCode(掩码,仅 amap 显示)
└─ [测试逆地理](可选,用当前坐标调 reverseGeocode 验证)
```

### 7.4 掩码输入交互

`MaskedInput` 组件:
- 已有值 → 显示 `********`(或前 4 + 后 4)
- 输入新值 → 覆盖
- 留空提交 → 提交 `***`(表示保留原值)
- 显式清空按钮 → 提交空字符串(清空)
- 提示文案: "留空保存表示保留原值"

## 8. 公众号消息加解密(消费逻辑补全)

### 8.1 现状缺口

`token`/`encodingAESKey` 在 `wechat-auth-plugin/src/types.ts` 定义,在 `wechat-auth-strategy.ts` 通过 override 读取,但**未消费**。微信公众号服务端推送的消息(用户关注/菜单点击/消息等)会用 EncodingAESKey 加密,token 用于签名校验。

### 8.2 补全方案

新增 `wechat-auth-plugin/src/wechat-message-crypto.ts`:
- 实现 AES-CBC-256 解密(微信公众号消息加解密协议,用 encodingAESKey Base64 解码为 32 字节密钥)
- 实现 SHA1 签名校验(排序 token/timestamp/nonce/encrypted,比对 msg_signature)
- 暴露 `decryptMessage(token, encodingAESKey, encrypted)` 与 `verifySignature(token, timestamp, nonce, signature)`

新增 `wechat-auth-plugin/src/wechat-message.controller.ts`:
- 暴露 `GET /wechat/message`(微信公众号接入校验,echostr)
- 暴露 `POST /wechat/message`(接收加密消息,解密后路由到内部 handler)

### 8.3 租户级凭证读取

复用现有 override 机制:

```ts
const override = getAuthOverride(ctx, 'wechat');
const token = override?.token || this.options.token;
const encodingAESKey = override?.encodingAESKey || this.options.encodingAESKey;
if (!token || !encodingAESKey) throw new Error('WECHAT_MESSAGE_CRYPTO_NOT_CONFIGURED');
```

### 8.4 路由多租户隔离

- 微信公众号回调 URL 含 channelId 参数(如 `/wechat/message?channel=<id>`)
- Controller 从 query 取 channelId,构造 ctx,再读该 Channel 的 token/encodingAESKey

## 9. SSO 邀请码衔接

### 9.1 流程

```
1. 用户从 SSO authorize 跳回 Vendure,带 code + invite_code(如 URL query 携带)
2. cjk-plugin SsoAuthenticationStrategy.authenticate(ctx, { code, providerKey, inviteCode? })
3. 调 zhao-sso /v1/auth/token 换 access_token
4. 调 zhao-sso /v1/user/me 取用户信息
5. 若 inviteCode 存在:Vendure 侧独立处理(绑定/奖励/统计),不依赖 Strapi
   - Strapi 仅在注册时返回 invite_code 字段(若用户首次注册)
   - Vendure 检测到响应含 invite_code 则落地为本地邀请关系
6. 创建/更新 Vendure Customer,关联 externalId(uuid)
```

### 9.2 衔接契约

- `SsoAuthenticationStrategy.authenticate` 入参增加 `inviteCode?: string`
- zhao-sso `/v1/user/me` 响应若含 `invite_code` 字段,Vendure 读取并处理
- Vendure 侧新增 `InviteCodeService`(独立模块,不在 zhao-sso 边界内)

### 9.3 InviteCodeService 契约(本次仅框架)

```ts
class InviteCodeService {
    async bindIfPresent(ctx, customerId, inviteCode): Promise<{ bound: boolean; reason?: string }>;
    async validate(ctx, inviteCode): Promise<boolean>;
    // 后续:reward / stats / tree 等(本次不做)
}
```

本次仅实现 `bindIfPresent` 框架:存 inviteCode 到 Customer.customFields 预留字段(若不存在则新增 `inviteCode` 字段),记一条 HistoryEntry,奖励发放标 TODO。

## 10. 测试策略

### 10.1 单元测试(Vitest)

| 模块 | 测试要点 |
|---|---|
| `crypto.ts` 已有 | 加密/解密/掩码/合并 round-trip |
| `map-crypto.ts` 新增 | 同上,覆盖三平台字段 |
| `pay-config-crypto.ts` 新增 | 同上,覆盖 alipay/wechatpay/douyinpay |
| `payment-config.ts` 扩展 | douyinpayJson 解析 + 三平台加密合并 |
| `tenant-config-admin.resolver.ts` | 权限校验三路径(super-admin / channel 关联 / 无关联抛错) |
| `wechat-message-crypto.ts` 新增 | 用微信公众号官方测试向量验证 AES-CBC + SHA1 |

### 10.2 E2E 测试(Vendure e2e)

- 配置写入: super-admin 写 Channel A,租户管理员写 Channel A(成功),租户管理员写 Channel B(抛 TENANT_CONFIG_FORBIDDEN)
- 掩码合并: 首次写 appSecret,二次更新留空,验证保留原值
- SSO 连通性: mock zhao-sso `/v1/auth/token`,验证 success/latency/error
- 公众号消息: GET echostr 校验 + POST 加密消息解密(用测试 encodingAESKey)

### 10.3 Dashboard E2E(Playwright)

按 `e:\code\vendure\AGENTS.md` 约定,在 `packages/cjk-plugin/e2e/` 新增:
- Channel 详情页租户配置 tab 渲染
- 支付 tab 三平台卡片切换
- 掩码输入留空保存保留原值
- canEdit=false 时输入禁用

## 11. 风险与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| pageBlocks after 扩展点在 Vendure 3.6.4 行为不符预期 | 中 | 已验证 cjk-plugin 现有 `channel-detail-forms.tsx` 用 detailForms 先例;pageBlocks 是同级 API。若失败退回 detailForms 模式(字段级替换,体验略差) |
| mapConfig 加密后前端 map-picker 无法读 apiKey | 高 | `mapConfig` 字段 `public: false`,仅 admin 可见;shop 侧通过 `mapSdkConfig` Query 读取(已有 MapAdminResolver 逻辑),迁移后该 Query 解密返回,前端无感 |
| 公众号消息加解密协议实现错误 | 高 | 用微信官方测试向量单测;先在 dev 环境用测试公众号验证一轮再上线 |
| SSO 连通性测试若 zhao-sso 不支持 client_credentials | 低 | 降级 health 端点;已在 6.4 标注,需实现时确认 |
| 多租户管理员 channel 关联校验绕过 | 中 | Resolver 层强制校验,所有 Mutation 入口走 `assertCanWrite`;Service 不暴露未校验的写入方法 |
| 邀请码字段在 Customer.customFields 未定义 | 低 | 迁移阶段检查,若无则新增 `inviteCode` 字段 |

## 12. 实现顺序建议

供 writing-plans 参考:

1. 数据层: 扩展 `payment-config.types.ts` / `tenant-channel-custom-fields.ts` / `payment-config.ts`
2. 加密层: 新增 `map-crypto.ts` / `pay-config-crypto.ts`
3. 迁移: `mapConfig`/`payConfig` 加密迁移脚本 + bootstrap 调用
4. Service 层: `PayConfigService` / `MapConfigService` 接口对齐(getMasked/update)
5. Resolver 层: `TenantConfigAdminResolver` + 权限校验 + 审计
6. 公众号消息加解密: `wechat-message-crypto.ts` + controller
7. SSO 连通性测试 + 邀请码衔接
8. UI 层: pageBlock 注册 + 4 tab 组件 + 掩码输入
9. 测试: 单元 + E2E + Dashboard E2E

## 13. 关键文件路径速查

**数据层**:
- `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`
- `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.types.ts`
- `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.ts`
- `e:\code\vendure\packages\cjk-plugin\src\auth\auth-config.types.ts`

**加密层**:
- `e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts`(已有,复用)
- `e:\code\vendure\packages\cjk-plugin\src\map\map-crypto.ts`(新增)
- `e:\code\vendure\packages\cjk-plugin\src\payment\pay-config-crypto.ts`(新增)

**Resolver/Service**:
- `e:\code\vendure\packages\cjk-plugin\src\admin\tenant-config-admin.resolver.ts`(新增)
- `e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts`(已有,改)
- `e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts`(已有,改)

**公众号消息加解密**:
- `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-message-crypto.ts`(新增)
- `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-message.controller.ts`(新增)
- `e:\code\vendure\packages\wechat-auth-plugin\src\types.ts`(已有,token/encodingAESKey 已定义)
- `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-auth-strategy.ts`(已有,override 优先级)

**SSO/邀请码**:
- `e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts`(改,加 inviteCode)
- `e:\code\vendure\packages\cjk-plugin\src\auth\invite-code.service.ts`(新增,框架)

**UI**:
- `e:\code\vendure\packages\cjk-plugin\dashboard\index.tsx`(改,注册 pageBlocks)
- `e:\code\vendure\packages\cjk-plugin\dashboard\tenant-config-center.tsx`(新增)
- `e:\code\vendure\packages\cjk-plugin\dashboard\tenant-config-tabs.tsx`(新增)
- `e:\code\vendure\packages\cjk-plugin\dashboard\tenant-config\*.tsx`(新增)
- `e:\code\vendure\packages\cjk-plugin\dashboard\auth-config-widget.tsx`(已有,复用)
- `e:\code\vendure\packages\cjk-plugin\dashboard\payment-config-widget.tsx`(已有,复用)

**迁移**:
- `e:\code\vendure\packages\cjk-plugin\src\migrations\migrate-mapconfig-encryption.ts`(新增)
- `e:\code\vendure\packages\cjk-plugin\src\migrations\migrate-payconfig-encryption.ts`(新增)
