# 阶段42 SSO互通 — 实施与验收记录

> 目标：解决「电商系统孤立」结构性风险，打通 zhao-sso 统一认证与本地电商账号体系，实现跨平台统一登录。
> 范围：统一映射表 + SSO↔本地账号互认（按手机/邮箱合并 + 本地登录绑定 SSO）+ e2e 验收。不扩展真实 zhao-sso 对接细节（沿用既有 zhao-sso/OAuth2 协议）。

## 1. 统一映射表

- 以 Vendure 内置 `ExternalAuthenticationMethod` 作为标准化映射表：`strategy='sso'` + `externalIdentifier='sso:<providerKey>:<externalId>'` ↔ `userId` ↔ `customerId`。
- 规范化外部键 `externalKey = sso:<providerKey>:<externalId>`，确保同一 SSO 用户跨 provider 稳定。
- 见 [sso-authentication-strategy.ts](packages/cjk-plugin/src/auth/sso-authentication-strategy.ts) `resolveSsoUser`：映射命中→直接返回；未命中→按手机/邮箱合并本地账号或标准建档（落映射 + Customer + 历史）。

## 2. 绑定互认（双向）

- **方向A（自动互认）**：SSO 登录时按手机号优先（`Customer.phoneNumber`）合并已有本地账号、其次按邮箱；绑定 SSO 身份并同步资料。
- **方向B（主动绑定）**：已登录本地账号可调用新增 shop mutation `bindSsoIdentity(providerKey, code, redirectUri)` 校验 SSO code 后把外部身份挂到当前 User；映射表已被其他账号占用时拒绝冲突。
- 见 `bindIdentityToUser` 与 [auth-shop.resolver.ts](packages/cjk-plugin/src/auth/auth-shop.resolver.ts)。

## 3. 关键实现改动

- 策略改为**单例**导出 `ssoAuthenticationStrategy`（迁移前 plugin.ts 用 `new SsoAuthenticationStrategy()`，resolver 无法访问 bind 能力），见 [plugin.ts](packages/cjk-plugin/src/plugin.ts)。
- shop schema 新增 `SsoBindResult + bindSsoIdentity` mutation。
- 修复 `updateChannelAuthConfig` 返回值类型不匹配：schema 由 `Boolean!` 改为 `TenantAuthConfigMasked!`（resolver 实际返回脱敏配置对象，原声明导致该管理变更必失败）。
- e2e mock 取号：`SSO_MOCK=true` 时 `mock-loc__<phone>` 走手机合并、`mock-oauth__<id>` 走建档路径，生产默认关闭。

## 4. 验收（e2e-sso.mjs）

本地以 `SSO_MOCK=true` 重启 dev-server 后 `node tools/e2e-sso.mjs`，11 项断言全部通过：

- 渠道配置 SSO provider 成功（enabledMethods 含 sso）；
- 方向A：`mock-loc__<phone>` 按手机号归并到既有本地账号 id=79；
- 统一映射表生效：再次 SSO 登录仍归 id=79（稳定性）；
- SSO 建档新账号 id=80，且同外部身份重复登录稳定映射；
- 方向B：本地账号2 主动 `bindSsoIdentity` 成功（bound=true, userId=81）；
- 互认达成：绑定后以同一 SSO 外部身份登录命中 id=81。

## 5. 非目标

- 不新增真实 zhao-sso 服务端对接代码；沿用既有协议字段映射（externalIdField / emailField / nicknameField / mobileField / avatarField）。
- 不动 admin/商户侧 SSO 管理 UI。