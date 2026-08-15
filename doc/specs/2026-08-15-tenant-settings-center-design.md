# 租户设置中心设计文档

> 日期：2026-08-15
> 状态：已评审通过（信息架构 / 数据模型 / GraphQL API / Dashboard UI / 风险测试 五节逐节确认）

## 1. 目标

为 Vendure 电商系统在 Dashboard（`packages/dashboard`）中新增一个**单入口多标签的「租户设置中心」**，把中国本地化多租户运营所需的全部配置整合到一处，覆盖：

- 多租户（独立域名、租户名称）
- 多语言（展示语言开关 / 默认语言 / 商品内容翻译工作流 / 运营文案多语言）
- 多种配送方式、支付方式（配送模板 / 配送档案、支付档案、自提点）
- 灵活的中国本地化方案（联系电话、地址、客服联系方式、单据抬头、企业微信客服/通知、微信消息推送）
- SSO 登录配置

**在线客服聊天系统（实时会话）本期不实现**，设置中心仅预留「客服渠道配置位」，聊天系统后续独立立项。

## 2. 现状分析

后端（cjk-plugin）数据层与 GraphQL 已就绪，但 Dashboard **没有对应页面**：

| 能力 | 后端现状 | Dashboard 页面 |
|---|---|---|
| 渠道自定义字段 | `couponStackable` / `employeePickupMode` / `defaultLocation` / `customDomains` / `mapConfig` | 无 |
| 认证 / SSO | `authConfig`（enabledMethods + overrides + ssoProviders）+ `testSsoConnection` | 无 |
| 支付配置 | `payConfig`（支付宝 / 微信 / 抖音）加密存储 | 无 |
| 配送 | ShippingTemplate / Profile + 阶梯计价 | 无管理 UI |
| 自提点 | PickupLocation + Profile 约束 | 无管理 UI |
| 域名解析 | `DomainResolverService.resolveByDomain` 按 `customDomains` 找渠道 | 无 |
| 后端 GraphQL | `TenantConfigAdminResolver`：`tenantConfig` / `updateTenantConfig` / `testSsoConnection` 已存在 | 未接入 UI |

关键结论：**后端数据层 + GraphQL 已就绪，缺的是把「中国本地化多租户配置」整合成一个可用页面的设计。**

## 3. 实现路径（已确认：方案 A）

**聚合查询 + 配置驱动 Tab**：

- 扩展 `TenantConfigAdminResolver` 为聚合的 `tenantSettings`，一次拉取所有段。
- 新增字段（联系电话 / 地址 / 客服 / 企微 / 消息推送 / 多语言 / 单据抬头）作为**增量 struct 存进渠道 customFields**，复用现有加密 + 审计机制。
- Dashboard 新增 `/tenant-settings` 路由，Tab 由 section registry 配置驱动。
- 配送 / 支付 / 自提点复用已就绪的后端 service，仅补 admin resolver + UI。

不使用「独立 TenantSettings 实体表」（引入新表 + 迁移、脱离原生渠道字段能力）也不使用「全字段单体 customField」（字段爆炸、审计分散）。

## 4. 信息架构（8 个 Tab）

单入口 `/tenant-settings`，顶部挂渠道切换器，内部 8 个 Tab：

| # | Tab | 承载内容 |
|---|---|---|
| 1 | 基本设置 | 租户名称 / code、自定义域名、默认语言、货币、时区、联系电话、地址、客服联系方式集合、单据抬头信息 |
| 2 | 多语言 | availableLanguages 开关、默认语言、商品内容翻译工作流（翻译状态 / 缺译提醒）、运营文案多语言 |
| 3 | 登录认证 & SSO | 登录方式开关（手机 / 微信 / 支付宝 / 抖音 / native）、各渠道密钥、SSO provider 管理（zhao-sso / oauth2）+ 连接测试 |
| 4 | 支付方式 | 支付宝 / 微信支付 / 抖音支付密钥（加密）、PaymentProfile 管理 |
| 5 | 配送方式 | 阶梯计价 ShippingTemplate 管理、ShippingProfile 管理 |
| 6 | 自提点 | 自提点增删改查、Profile 约束、员工自提模式 |
| 7 | 地图服务 | 高德 / 百度 / 腾讯 provider 选择 + API key / 安全码 |
| 8 | 客服与通知 | 客服联系方式、企业微信客服 / 通知、微信消息推送开关、在线客服聊天入口（本期仅占位配置） |

每个 Tab 统一模式：**读取 `tenantSettings` 对应段 → 左表单 / 右列表 → 保存走定向 update mutation → 审计日志**。

## 5. 数据模型（新增渠道 customFields）

在 `tenant-channel-custom-fields.ts` 增量追加三个 struct 字段，复用现有加密与审计：

```
Channel.customFields 新增：
├─ basicConfig: struct          // 基本设置 + 本地化
│   ├─ tenantName       string
│   ├─ contactPhone     string   // 联系电话
│   ├─ address          string   // 地址
│   ├─ invoiceHeader    struct   // 单据抬头：companyName/taxNo/address/phone/bankInfo
│   ├─ serviceContacts  struct   // 客服联系方式集合：phones[]/emails[]/wechat[]/wecomId/onlineChatEnabled
│   └─ timeZoneId       string   // 独立时区（区别于原生 timeZone）
└─ serviceNotifyConfig: struct   // 客服与通知
    ├─ wecomEnabled       boolean // 企业微信客服/通知
    ├─ wecomAgentId       string
    ├─ wecomCorpId        string
    ├─ wecomCorpSecret    string  // 加密存储
    ├─ wechatPushEnabled  boolean // 微信消息推送
    ├─ wechatPushTemplate struct  // 下单/发货/售后模板
    └─ chatChannelEnabled boolean // 在线客服聊天入口（本期仅占位）
```

**复用不新增**：`customDomains`（域名）、`authConfig`（登录 / SSO）、`payConfig`（支付密钥）、`mapConfig`（地图）、`defaultLocation`（经纬度）、`employeePickupMode`（员工自提）。

**多语言**：展示语言开关 / 默认语言写 Vendure 原生 `channel.availableLanguages` + `defaultLanguageCode`；翻译工作流与运营文案用 `multiLanguageConfig: struct`（新增）。

**敏感字段**（企微 secret、支付 key、SSO secret）沿用 `crypto.ts` 加解密，`getMasked` 脱敏返回。

## 6. GraphQL API

扩展 `TenantConfigAdminResolver` 为聚合 + 定向更新：

```
Query:
  tenantSettings(channelId): TenantSettings   // 一次拉全部段
    { basic, auth, pay, map, serviceNotify, multiLanguage }

Mutation（每 Tab 一个定向更新，避免整包覆盖丢字段）:
  updateTenantBasic(channelId, input)         // 基本设置 + 本地化
  updateTenantMultiLanguage(channelId, input) // 多语言（含 availableLanguages/defaultLanguageCode）
  updateTenantAuth(channelId, input)          // 复用现有 authPatch
  updateTenantPay(channelId, input)           // 复用现有 payPatch
  updateTenantServiceNotify(channelId, input) // 客服与通知（企微 / 微信推送 / 聊天占位）
  updateTenantMap(channelId, input)           // 复用现有 mapPatch
  testSsoConnection(channelId, providerKey, newClientSecret)  // 已存在

配送/支付/自提点档案 CRUD：
  新增 ShippingProfile / PaymentProfile / PickupLocation / ShippingTemplate 的 admin resolver + GraphQL
  （后端 service 已就绪，仅补 schema 与权限）
```

**三段式返回**：`tenantSettings` 复用现有 `auth` / `pay` / `map` 段（脱敏），新增 `basic` / `serviceNotify` / `multiLanguage` 段。所有 update 走统一 `TENANT_CONFIG_UPDATE` 审计（现有 insert 逻辑）。

**多语言写入**：`updateTenantMultiLanguage` 除写 `multiLanguageConfig` 外，调用 `ChannelService.update` 更新 `availableLanguages` / `defaultLanguageCode`。

## 7. Dashboard UI

在 `packages/dashboard` 新建：

```
src/app/routes/_authenticated/_tenant-settings/
  ├─ tenant-settings.tsx             // 路由壳：渠道切换器 + Tab 导航
  ├─ sections/
  │   ├─ basic.tsx                   // Tab1 基本设置
  │   ├─ multi-language.tsx          // Tab2 多语言
  │   ├─ auth.tsx                    // Tab3 登录&SSO
  │   ├─ payment.tsx                 // Tab4 支付
  │   ├─ shipping.tsx                // Tab5 配送
  │   ├─ pickup.tsx                  // Tab6 自提点
  │   ├─ map.tsx                     // Tab7 地图
  │   └─ service-notify.tsx          // Tab8 客服与通知
  ├─ section-registry.ts             // Tab 清单 + 图标 + 权限码，配置驱动
  └─ tenant-settings.graphql.ts      // 聚合 query + 各 update mutation
```

**关键机制**：
- **section registry** 驱动侧边 Tab 渲染与懒加载；新增租户能力 = 注册一个新 section。
- **渠道切换器**：复用 `channel-switcher`，设置中心只编辑当前选中渠道；`tenantSettings` 用 `channelId` 参数，后端 `canEdit` 校验（超管或 channelPermissions 含该渠道）。
- **表单**：复用现有 `Form` / `FormFieldWrapper` / `struct-form-input`；敏感字段用密码输入 + 「测试连接」按钮（复用 `testSsoConnection`，支付 / 企微同理）。
- **暂存策略**：每个 Tab 独立「保存」按钮，定向 update mutation，避免切 Tab 丢未保存改动。
- **权限**：菜单项挂 `TenantSettings` 权限码，与 section 级权限联动。

## 8. 风险点

1. **渠道 customFields 字段爆炸**：新增 3 个 struct 已收敛，`basicConfig` 内部字段多用层级化结构，只存设置不存业务数据。
2. **敏感密钥泄露**：payConfig / wecom / SSO secret 明文不可出现在前端。`getMasked` 仅返回脱敏，保存时前端传明文、后端加密；日志不含密钥。
3. **多语言写入与原生渠道冲突**：`updateTenantMultiLanguage` 改 `availableLanguages` 可能影响 Vendure 原生语言选择器。只写设置中心的语言，原生全局语言仍走 Global Settings。
4. **配送 / 支付 / 自提点 CRUD 无 UI 历史**：后端 service 已就绪但未经 UI 调用。复用现有 spec 测试，新增 admin resolver 单测 + 冒烟。
5. **权限越权**：租户管理员可能越权改其他租户。复用 `canEdit` 后端强校验，前端仅做菜单隐藏。

## 9. 测试

- **后端**：`tenantConfig` resolver spec 扩展（basic / serviceNotify / multiLanguage 段）；新增 shipping / payment / pickup admin resolver 单测。
- **前端**：section registry 渲染、敏感字段脱敏显示、渠道切换后配置隔离。
- **冒烟**：新建租户 → 走 8 Tab 完整配置 → C 端验证域名解析 / 登录 / 支付 / 配送生效。

## 10. 后续（另立项）

在线客服聊天系统（实时会话）：WebSocket 长连接、消息持久化、客服工作台、图片 / 表情上传、会话状态机。本期仅预留 `chatChannelEnabled` 配置位。