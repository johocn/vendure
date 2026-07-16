# 租户独立域名设计文档

> **日期**：2026-07-16
> **范围**：为每个租户（Channel）配置独立域名，通过域名自动识别 channel，原 `?tenant=` 参数机制保留作为回退

---

## 1. 整体架构

### 影响范围

```
e:\code\vendure (后端)
├── packages/cjk-plugin/
│   ├── src/tenant/tenant-channel-custom-fields.ts  ← 追加 customDomains 字段
│   ├── src/tenant/domain-resolver.service.ts        ← 新增：域名→channel 查询服务
│   ├── src/tenant/domain-shop.resolver.ts           ← 新增：Shop API resolveChannelByDomain 查询
│   ├── src/plugin.ts                                ← 追加 shopApiExtensions schema + provider 注册
│   └── dashboard/channel-detail-forms.tsx           ← 追加 customDomains 字段查询
└── packages/dev-server/
    └── dev-config.ts                                ← 无需改动（customFields 自动注入）

e:\code\vshop (前端)
├── src/stores/tenant.ts                             ← 改造：initTenant 异步化 + 域名解析优先
├── src/core/tenant.ts                               ← 改造：新增 getTenantFromDomain 实现
├── src/api/queries/channel.ts                       ← 追加 resolveChannelByDomain 查询
└── src/api/client.ts                                ← 无需改动（已有 vendure-token header）
```

### 数据流

```
H5 用户访问 shop-a.com
        ↓
前端 initTenant() 检测 window.location.hostname
        ↓
调用 resolveChannelByDomain("shop-a.com") → 后端遍历 channel.customDomains
        ↓
返回 { token: "shop-a-token", code: "shop-a" }
        ↓
前端设置 tenantStore.token = "shop-a-token"，缓存到 sessionStorage
        ↓
后续所有 API 请求通过 vendure-token header 携带
        ↓
若域名未匹配 → 回退到 ?tenant= 参数 → localStorage → 默认 channel
```

### 优先级规则

```
1. 域名匹配（最高优先级）
2. ?tenant= URL 参数（域名未匹配时）
3. localStorage 缓存的 tenant_code
4. 默认 channel（兜底）
```

### 部署模型

前端 CDN + 后端统一 API。多个租户域名部署到同一前端 CDN，API 请求统一指向后端域名。前端运行时根据当前域名动态解析 channel token。

### 关键约束

1. **仅 H5 平台**：小程序通过 scene 参数传 tenant，App 通过配置传 tenant
2. **原 tenant 参数依然生效**：域名未匹配时回退到 `?tenant=` 参数机制
3. **保留 TENANT_CONFIGS 硬编码表**：作为 `?tenant=` 回退的兜底映射，避免一次性删除导致兼容性问题
4. **缓存**：域名解析结果缓存到 sessionStorage（页面刷新不重复请求，标签页关闭自动清除）
5. **公开查询**：resolveChannelByDomain 是 Shop API 公开查询，无需登录
6. **localhost 跳过**：本地开发环境（localhost / 127.0.0.1）不触发域名解析，直接走 `?tenant=` 机制

---

## 2. 后端 — customDomains 字段 + 解析服务

### customDomains 自定义字段

追加到 `tenant-channel-custom-fields.ts`：

```typescript
{
    name: 'customDomains',
    type: 'string',
    list: true,
    nullable: true,
    public: true,
    label: [{ languageCode: LanguageCode.zh_Hans, value: '自定义域名' }],
}
```

- `list: true`：支持多域名（如 `['shop-a.com', 'www.shop-a.com']`）
- `public: true`：Shop API 可查询
- 存储为 string 数组，不包含协议（`http://`/`https://`），仅存裸域名

### DomainResolverService

```typescript
// domain-resolver.service.ts
@Injectable()
export class DomainResolverService {
    constructor(private channelService: ChannelService) {}

    async resolveByDomain(ctx: RequestContext, host: string): Promise<{ token: string; code: string } | null> {
        // 标准化 host：去端口、转小写
        const normalizedHost = host.split(':')[0].toLowerCase();

        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const domains = (channel.customFields as any)?.customDomains as string[] | undefined;
            if (domains?.some(d => d.toLowerCase() === normalizedHost)) {
                return { token: channel.token, code: channel.code };
            }
        }
        return null;
    }
}
```

### Shop API 查询

```graphql
type DomainResolveResult {
    token: String!
    code: String!
}

extend type Query {
    resolveChannelByDomain(host: String!): DomainResolveResult
}
```

- 公开查询（无需登录），在 `shopApiExtensions` 中注册
- 返回 null 时前端回退到 `?tenant=` 机制
- 需注册到 plugin `providers` 中（因为依赖 ChannelService 注入）

### CORS 考量

当前 vendure 默认 CORS 配置 `origin: true`（反射任意 Origin），多域名场景下无需额外配置。前端 CDN 部署的域名请求 API 时，CORS 会自动放行。

### Host 标准化规则

`DomainResolverService.resolveByDomain` 中标准化 host：
- 去端口：`shop-a.com:443` → `shop-a.com`
- 转小写：`Shop-A.com` → `shop-a.com`
- 不做协议解析（存储时就不含 `http://`/`https://`）

不添加后端校验规则（如格式验证、DNS 验证），管理员自行确保域名正确。

---

## 3. 前端 — 域名解析与 tenant 初始化改造

### API 查询

`api/queries/channel.ts` 追加：

```graphql
query ResolveChannelByDomain($host: String!) {
    resolveChannelByDomain(host: $host) {
        token
        code
    }
}
```

### core/tenant.ts 改造

新增 `getTenantFromDomain` 函数，调用后端 API 解析域名：

```typescript
export async function getTenantFromDomain(): Promise<{ token: string; code: string } | null> {
    // #ifdef H5
    const host = window.location.hostname
    if (!host || host === 'localhost' || host === '127.0.0.1') return null

    // sessionStorage 缓存
    const cacheKey = `domain_resolve_${host}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
        try { return JSON.parse(cached) } catch {}
    }

    try {
        const result = await apiClient.request(RESOLVE_CHANNEL_BY_DOMAIN, { host })
        if (result.resolveChannelByDomain) {
            sessionStorage.setItem(cacheKey, JSON.stringify(result.resolveChannelByDomain))
            return result.resolveChannelByDomain
        }
    } catch {}

    return null
    // #endif

    // 非 H5 平台直接返回 null
    return null
}
```

### stores/tenant.ts 改造

`initTenant` 从同步变异步，优先级变为：`域名` > `?tenant=` > `localStorage` > `默认`：

```typescript
async function initTenant() {
    // 1. 尝试域名解析（仅 H5）
    const domainResult = await getTenantFromDomain()
    if (domainResult) {
        tenantCode.value = domainResult.code
        token.value = domainResult.token
        uni.setStorageSync('tenant_code', domainResult.code)
        return
    }

    // 2. 回退：?tenant= URL 参数
    const urlTenant = resolveTenantFromUrl()
    if (urlTenant && TENANT_CONFIGS[urlTenant]) {
        tenantCode.value = urlTenant
        token.value = TENANT_CONFIGS[urlTenant]
        uni.setStorageSync('tenant_code', urlTenant)
        return
    }

    // 3. 回退：localStorage
    const stored = uni.getStorageSync('tenant_code')
    if (stored && TENANT_CONFIGS[stored]) {
        tenantCode.value = stored
        token.value = TENANT_CONFIGS[stored]
        return
    }

    // 4. 默认
    tenantCode.value = 'default'
    token.value = TENANT_CONFIGS['default']
}
```

### 保留 TENANT_CONFIGS

`TENANT_CONFIGS` 硬编码表暂时保留作为兜底，原因：
- 域名未配置的租户仍可通过 `?tenant=` 访问
- 本地开发环境（localhost）无法走域名解析
- 避免一次性删除导致兼容性问题

### initTenant 调用方改造

`initTenant` 从同步变异步，需检查所有调用点：
- `App.vue` `onLaunch` — 改为 `await initTenant()`
- `main.ts` — 确保初始化完成后再挂载

### sessionStorage 缓存策略

- 缓存 key：`domain_resolve_{hostname}`
- 缓存值：`{ token, code }` 的 JSON
- 过期策略：无显式过期，但 sessionStorage 随标签页关闭而清除
- 失效场景：管理员修改域名配置后，用户关闭并重新打开标签页即可刷新缓存

---

## 4. Dashboard 域名管理 UI

### 接入方式

customDomains 是简单的 `string list` 字段，Dashboard 框架会自动渲染 list 字段的基础编辑器。在 `channel-detail-forms.tsx` 中追加 `extendDetailDocument` 查询即可，无需自定义 widget 组件。

```typescript
{
    pageId: 'channel-detail',
    extendDetailDocument: `
        query ExtendChannelCustomDomains {
            channel {
                customFields {
                    customDomains
                }
            }
        }
    `,
},
```

### 管理体验

Dashboard 原生的 string list 编辑器提供：
- 添加/删除条目
- 文本输入框
- 保存/取消

管理员只需在 Channel 详情页的 customFields 区域填入域名（如 `shop-a.com`、`www.shop-a.com`），保存即生效。

### 不做自定义 widget 的理由

- customDomains 是简单字符串数组，原生编辑器足够
- 避免过度设计（YAGNI）
- authConfig/payConfig 需要自定义 widget 是因为 struct + JSON 嵌套结构复杂

---

## 5. 错误处理与测试

### 错误处理策略

| 场景 | 处理方式 | 用户感知 |
|---|---|---|
| 域名解析 API 请求失败（网络错误） | catch → 返回 null → 回退到 `?tenant=` 机制 | 页面正常加载（使用 tenant 参数或默认 channel） |
| 域名解析返回 null（未配置） | 回退到 `?tenant=` → localStorage → 默认 | 页面正常加载 |
| 域名解析 API 返回错误 | catch → 返回 null → 回退 | 页面正常加载 |
| sessionStorage 缓存解析失败 | catch → 清除缓存 → 重新请求 API | 用户无感知 |
| initTenant 超时 | 无显式超时，但 API 请求失败即回退 | 页面可能短暂白屏后正常加载 |
| localhost / 127.0.0.1 | 跳过域名解析，直接走 `?tenant=` 机制 | 本地开发不受影响 |
| 非 H5 平台 | `getTenantFromDomain` 直接返回 null | 小程序/App 不受影响 |

### 关键原则

1. **域名解析失败不阻断页面加载**：任何异常都静默降级到原有 `?tenant=` 机制
2. **前端 try/catch 包裹**：`getTenantFromDomain` 内部 catch 所有异常
3. **后端无需错误处理**：`resolveByDomain` 遍历找不到就返回 null，不抛异常

### 测试策略

#### 后端单元测试

**DomainResolverService**：

```typescript
describe('DomainResolverService', () => {
  it('匹配已配置域名: 返回 token 和 code')
  it('匹配 www 变体: www.shop-a.com 和 shop-a.com 独立匹配')
  it('大小写不敏感: Shop-A.COM 匹配 shop-a.com')
  it('去端口: shop-a.com:443 匹配 shop-a.com')
  it('未配置域名: 返回 null')
  it('多 channel 域名不交叉匹配')
  it('channel.customDomains 为空数组: 返回 null')
})
```

**domain-shop.resolver e2e**：

```typescript
describe('resolveChannelByDomain query', () => {
  it('未登录可调用: 返回 channel token')
  it('域名匹配: 返回 { token, code }')
  it('域名未匹配: 返回 null')
  it('host 含端口: 正确匹配')
})
```

#### 前端手动测试

```
测试用例 1：域名解析
  1. 配置 Channel A customDomains = ['shop-a.localhost']
  2. 访问 http://shop-a.localhost:5180/
  3. 验证 tenantStore.token === 'shop-a-token'

测试用例 2：回退到 tenant 参数
  1. 访问 http://localhost:5180/?tenant=shop-a
  2. 验证 tenantStore.token === 'shop-a-token'（域名未匹配，回退成功）

测试用例 3：sessionStorage 缓存
  1. 访问匹配域名的页面
  2. 检查 sessionStorage 中有 domain_resolve_{host} 缓存
  3. 刷新页面，验证不再发起 resolveChannelByDomain 请求

测试用例 4：localhost 跳过
  1. 访问 http://localhost:5180/
  2. 验证不调用 resolveChannelByDomain API
  3. 验证回退到 ?tenant= 或默认

测试用例 5：域名优先级
  1. 配置 Channel A customDomains = ['shop-a.com']
  2. 修改 hosts 文件将 shop-a.com 指向 127.0.0.1
  3. 访问 http://shop-a.com:5180/?tenant=default
  4. 验证使用 shop-a channel（域名优先于 tenant 参数）

测试用例 6：Dashboard 配置
  1. 打开 Channel 详情页
  2. 在 customDomains 字段添加域名
  3. 保存
  4. 用该域名访问前端
  5. 验证正确解析到该 channel
```

---

## 6. 已知限制与后续项目

1. **TENANT_CONFIGS 未删除**：作为兜底保留，后续可考虑完全由后端 API 提供映射
2. **无 DNS 验证**：管理员可能填入无效域名，后端不做格式校验
3. **无 HTTPS 证书管理**：HTTPS 由 CDN/反代层处理，不在应用层范围
4. **sessionStorage 无显式过期**：管理员修改域名配置后，用户需关闭标签页重新打开才刷新缓存。若需即时刷新，可后续添加 TTL 机制
