# 新增租户 SSO 对接指南

> 适用范围：Vendure 商城（多租户 Channel）接入 zhao-sso 统一登录服务（目标 h.joho.cn）。
> 核心结论：**两端均为数据驱动、可运行时动态定制，非硬编码**。新增租户无需改代码、无需重新 seed、无需重新编译。

---

## 一、架构总览

```
┌──────────────────────┐        ┌──────────────────────────────┐
│  Vendure 商城          │        │  zhao-sso 统一登录服务(h.joho.cn) │
│  (多租户 Channel)      │        │  (strapi-backend / strapi)     │
│                      │        │                              │
│  Channel.customFields │        │  sso_apps（数据库表）          │
│   .authConfig         │        │  sso_channels（数据库表）      │
│   ├─ enabledMethods   │        │                              │
│   ├─ overridesJson    │        │  admin REST CRUD             │
│   └─ ssoProviders[]   │        │  /api/zhao-sso/v1/admin/apps  │
│                      │        │                              │
│  admin GraphQL        │        │  OAuth2 端点                  │
│  updateChannelAuthConfig       │  /api/zhao-sso/v1/auth/token  │
│                      │        │  /api/zhao-sso/v1/user/me      │
└──────────────────────┘        └──────────────────────────────┘
```

**两端职责**
- **Vendure 端**：用 `authConfig` 描述"该租户用哪些登录方式、对接哪个 SSO 服务端"。存于 Channel 数据库字段，运行时可改。
- **SSO 服务端**：用 `sso_apps` 登记"哪些应用可以来换 token"。存于数据库，运行时可增删改。

---

## 二、核心原则

1. **数据驱动**：所有配置都存数据库，通过 API 写入，不写死在代码里。
2. **两端对齐**：Vendure 租户的 SSO Provider 与 SSO 服务端登记的 `sso_app` 必须"配对"（`clientId` = `app_code`，`clientSecret` = `app_secret` 明文）。
3. **零改码**：新增租户 = 两个 API 调用，无代码改动、无重新构建。

---

## 三、前置条件

- 拥有 zhao-sso 的 admin 权限（`sso.app-create` / `sso.app-update`），通过 zhao-auth 鉴权。
- 拥有 Vendure admin 权限（`Authenticated` + 该租户 Channel 访问权）。
- 已确定新租户的：
  - `channelCode`（Vendure 端 Channel code，如 `new-tenant`）
  - `app_code` / `clientId`（建议 `vendure-<channelCode>`，如 `vendure-new-tenant`）
  - `app_secret` / `clientSecret`（任选强随机串）
  - `redirect_uris`（该租户前端的登录回调域名白名单）

---

## 四、标准对接流程（两步）

### 步骤 1：SSO 服务端登记应用

在 h.joho.cn 的 zhao-sso 插件创建应用。`app_secret` 传**明文**，服务端自动 `bcrypt(10)` 存库。

```bash
curl -X POST https://h.joho.cn/api/zhao-sso/v1/admin/apps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "data": {
      "app_code": "vendure-new-tenant",
      "app_name": "新租户商城",
      "app_secret": "new-tenant-app-secret",
      "redirect_uris": ["https://shop.joho.cn/*", "http://localhost:*"],
      "allowed_grant_types": ["authorization_code", "refresh_token"],
      "is_active": true
    }
  }'
```

> 不传 `app_secret` 时，服务端会回退读取环境变量 `SSO_DEFAULT_APP_SECRET`。

### 步骤 2：Vendure 租户写入 SSO 配置

在 Vendure admin 对目标 Channel 调用 `updateChannelAuthConfig`，写入 `sso` 登录方式与 SSO Provider。

```graphql
mutation {
  updateChannelAuthConfig(
    channelId: "<新Channel的ID>"
    input: {
      enabledMethods: ["sso"]
      ssoProviders: [
        {
          name: "企业SSO"
          providerKey: "zhao-sso-new-tenant"
          protocol: "zhao-sso"
          baseUrl: "https://h.joho.cn/api/zhao-sso"
          clientId: "vendure-new-tenant"
          clientSecret: "new-tenant-app-secret"
          channelCode: "new-tenant"
        }
      ]
    }
  ) {
    enabledMethods
    ssoProviders { name providerKey baseUrl clientId channelCode }
  }
}
```

> 若该租户还想保留账号密码/手机号/微信等登录，把对应方式一并写进 `enabledMethods`（如 `["native","phone","sso"]`）。

---

## 五、字段说明

### 5.1 Vendure `ssoProviders[]` 字段

| 字段 | 必填 | 说明 |
|------|:---:|------|
| `name` | 是 | 登录页展示名称 |
| `providerKey` | 是 | 租户内唯一标识，前端调用 `authenticate(sso,{providerKey,...})` 时使用 |
| `protocol` | 是 | 固定 `zhao-sso` |
| `baseUrl` | 是 | SSO 服务端地址，**必须含 `/api/zhao-sso` 前缀**（见注意事项） |
| `clientId` | 是 | 必须等于 SSO 服务端登记的 `app_code` |
| `clientSecret` | 是 | 必须等于 SSO 服务端登记的 `app_secret` 明文 |
| `channelCode` | 否 | 该租户的 Channel code，用于服务端渠道归属 |

### 5.2 SSO 服务端 `sso_app` 字段

| 字段 | 说明 |
|------|------|
| `app_code` | 应用编码，即 Vendure 端的 `clientId` |
| `app_name` | 应用名称 |
| `app_secret` | **明文传入**，服务端自动 bcrypt(10) 存储 |
| `redirect_uris` | 回调域名白名单，支持 `*` 通配（如 `https://shop.joho.cn/*`、`http://localhost:*`） |
| `allowed_grant_types` | 授权类型，默认 `["authorization_code","refresh_token"]` |
| `is_active` | 是否启用 |

---

## 六、常用管理 API

### 6.1 SSO 服务端（zhao-sso admin REST，前缀 `/api/zhao-sso/v1/admin`）

| 方法 | 路径 | 作用 | 权限 action |
|------|------|------|------|
| GET | `/apps` | 应用列表 | `sso.app-read` |
| POST | `/apps` | 创建应用 | `sso.app-create` |
| GET | `/apps/:id` | 应用详情 | `sso.app-read` |
| PUT | `/apps/:id` | 更新应用（含重置 secret） | `sso.app-update` |
| DELETE | `/apps/:id` | 删除应用 | `sso.app-delete` |
| POST | `/channels` | 创建 SSO 渠道 | `sso.channel-create` |
| PUT | `/channels/:id` | 更新频道 | `sso.channel-update` |

### 6.2 Vendure（admin GraphQL）

| 查询/变更 | 作用 |
|------|------|
| `updateChannelAuthConfig(channelId, input)` | 写入/更新租户登录配置 |
| `channelAuthConfig(channelId)` | 读取租户登录配置（脱敏，secret 返回 `***`） |
| shop 端 `authMethods` / `ssoProviders` | 前端动态读取登录方式与 SSO 入口 |

---

## 七、验证方法

1. **SSO 服务端**：`GET /api/zhao-sso/v1/admin/apps` 确认新应用已登记。
2. **Vendure 端**：admin 查询 `channelAuthConfig(channelId)` 确认 `enabledMethods` 含 `sso`、`ssoProviders` 已写入。
3. **shop 端**：以该租户域名访问，查询 `authMethods` 应返回 `sso`，`ssoProviders` 应返回对应 Provider。
4. **端到端**：前端发起 SSO 登录 → h.joho.cn 授权 → 回调拿 `code` → Vendure `authenticate(sso,...)` 换 token 成功。

---

## 八、注意事项 / 踩坑

1. **`baseUrl` 必须带 `/api/zhao-sso` 前缀**：Vendure 策略用 `${baseUrl}/v1/auth/token` 拼接换 token 地址，而 Strapi 插件实际挂载在 `/api/zhao-sso/v1/...`。`baseUrl` 写成 `https://h.joho.cn/api/zhao-sso`，否则会请求到不存在的 `/v1/auth/token`。
2. **`providerKey` 在同一租户内唯一**；改名会破坏前端已保存的引用，变更需前后端同步。
3. **`app_secret` 与 `clientSecret` 必须一致**：token 交换时服务端用 `bcrypt.compareSync(clientSecret, app.app_secret)` 校验，明文要一致。
4. **`redirect_uris` 用通配**：回调用 `https://shop.joho.cn/*`、开发用 `http://localhost:*`，避免精确路径不匹配导致 `invalid_redirect_uri`。
5. **权限管控**：admin 接口走 zhao-auth 的 `has-permission`（action 粒度），不是公开接口。
6. **删除/停用**：`DELETE /apps/:id` 或 `PUT` 置 `is_active:false` 即可回收；Vendure 端同步移除对应 `ssoProviders` 项。

---

## 九、现有已注册应用清单

| app_code | 对应租户 | 说明 |
|------|------|------|
| `course` | 课程应用 | zhao-common 默认 SSO 应用 |
| `default` | 默认应用 | 通用 |
| `wealth` | 理财应用 | 财富端 |
| `e-joho-app` | e.joho.cn | 后台/门户 |
| `vendure-default` | default channel | Vendure 默认租户（本次开通） |
| `vendure-shop-a` | shop-a channel | Vendure shop-a 租户 |

> 以上为 bootstrap 初始化兜底创建的应用；新增租户一律走 admin API 动态登记，无需改 bootstrap。