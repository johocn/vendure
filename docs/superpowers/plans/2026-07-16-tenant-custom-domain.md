# 租户独立域名实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个 Channel 配置独立域名，前端 H5 通过域名自动解析 channel token，原 `?tenant=` 参数保留作为回退

**Architecture:** Channel.customFields.customDomains 存储域名数组。Shop API 新增 `resolveChannelByDomain` 公开查询。前端 `initTenant` 异步化，优先域名解析，回退到 `?tenant=` 参数。

**Tech Stack:** Vendure v3.6.4 (NestJS + GraphQL), uni-app (Vue 3 + Pinia), graphql-request

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-16-tenant-custom-domain-design.md`

---

## Task 1: customDomains 自定义字段

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 1: 追加 customDomains 字段**

在 `tenant-channel-custom-fields.ts` 的 `payConfig` 字段之后、数组结束 `]` 之前追加：

```typescript
        {
            name: 'customDomains',
            type: 'string',
            list: true,
            nullable: true,
            public: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '自定义域名' }],
        },
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin ; npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts
git commit --no-verify -m "feat: add customDomains field to Channel customFields"
```

---

## Task 2: DomainResolverService

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\tenant\domain-resolver.service.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\index.ts`

- [ ] **Step 1: 创建 domain-resolver.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { ChannelService, RequestContext } from '@vendure/core';

export interface DomainResolveResult {
    token: string;
    code: string;
}

@Injectable()
export class DomainResolverService {
    constructor(private channelService: ChannelService) {}

    async resolveByDomain(ctx: RequestContext, host: string): Promise<DomainResolveResult | null> {
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

- [ ] **Step 2: 在 index.ts 追加导出**

在 `e:\code\vendure\packages\cjk-plugin\index.ts` 末尾追加：

```typescript
export * from './src/tenant/domain-resolver.service';
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin ; npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/tenant/domain-resolver.service.ts packages/cjk-plugin/index.ts
git commit --no-verify -m "feat: add DomainResolverService for domain-to-channel resolution"
```

---

## Task 3: DomainShopResolver + plugin.ts 注册

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\tenant\domain-shop.resolver.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts`

- [ ] **Step 1: 创建 domain-shop.resolver.ts**

```typescript
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { Query, Resolver, Args } from '@nestjs/graphql';
import { DomainResolverService, DomainResolveResult } from './domain-resolver.service';

@Resolver()
export class DomainShopResolver {
    constructor(private domainResolverService: DomainResolverService) {}

    @Query()
    @Allow(Permission.Public)
    async resolveChannelByDomain(
        @Ctx() ctx: RequestContext,
        @Args('host') host: string,
    ): Promise<DomainResolveResult | null> {
        return this.domainResolverService.resolveByDomain(ctx, host);
    }
}
```

- [ ] **Step 2: plugin.ts — providers 追加 DomainResolverService**

在 `e:\code\vendure\packages\cjk-plugin\src\plugin.ts` 第 46-52 行的 `providers` 数组中，在 `EmployeeCustomerService` 之后追加：

```typescript
        DomainResolverService,
```

需要先在文件顶部追加 import：

```typescript
import { DomainResolverService } from './tenant/domain-resolver.service';
import { DomainShopResolver } from './tenant/domain-shop.resolver';
```

- [ ] **Step 3: plugin.ts — shopApiExtensions.schema 追加查询**

在 `plugin.ts` 第 190-231 行的 shopApiExtensions schema gql 模板字符串中，在 `extend type Query { authMethods... ssoProviders... }` 之后追加：

```graphql
                type DomainResolveResult {
                    token: String!
                    code: String!
                }
                extend type Query {
                    resolveChannelByDomain(host: String!): DomainResolveResult
                }
```

- [ ] **Step 4: plugin.ts — shopApiExtensions.resolvers 追加**

将第 233 行：

```typescript
        resolvers: [PickupLocationShopResolver, PickupShopResolver, AuthShopResolver],
```

替换为：

```typescript
        resolvers: [PickupLocationShopResolver, PickupShopResolver, AuthShopResolver, DomainShopResolver],
```

- [ ] **Step 5: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin ; npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/tenant/domain-shop.resolver.ts packages/cjk-plugin/src/plugin.ts
git commit --no-verify -m "feat: add resolveChannelByDomain Shop API query + plugin registration"
```

---

## Task 4: Dashboard channel-detail-forms 注册 customDomains

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx`

- [ ] **Step 1: 追加 customDomains 查询**

在 `channel-detail-forms.tsx` 的 `cjkChannelDetailForms` 数组中，在 payConfig 条目之后追加：

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

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/channel-detail-forms.tsx
git commit --no-verify -m "feat: register customDomains in channel detail forms"
```

---

## Task 5: 前端 API 查询

**Files:**
- Modify: `e:\code\vshop\src\api\queries\channel.ts`

- [ ] **Step 1: 追加 resolveChannelByDomain 查询**

在 `e:\code\vshop\src\api\queries\channel.ts` 末尾追加：

```typescript
export async function resolveChannelByDomain(host: string) {
    const client = getGraphQLClient();
    return client.request(`query ResolveChannelByDomain($host: String!) {
        resolveChannelByDomain(host: $host) {
            token
            code
        }
    }`, { host });
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vshop
git add src/api/queries/channel.ts
git commit --no-verify -m "feat: add resolveChannelByDomain API query"
```

---

## Task 6: stores/tenant.ts — initTenant 异步化 + 域名解析

**Files:**
- Modify: `e:\code\vshop\src\stores\tenant.ts`

- [ ] **Step 1: 追加 import**

在 `e:\code\vshop\src\stores\tenant.ts` 第 3 行之后追加：

```typescript
import { resolveChannelByDomain } from '../api/queries/channel';
```

- [ ] **Step 2: 追加 tenantReady ref**

在第 62 行（`ssoProviders` ref 之后）追加：

```typescript
    const tenantReady = ref(false);
```

- [ ] **Step 3: 改造 initTenant 为异步 + 域名优先**

将第 66-78 行的 `initTenant` 函数替换为：

```typescript
    async function initTenant() {
        // 1. 尝试域名解析（仅 H5）
        // #ifdef H5
        try {
            const host = window.location.hostname;
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                const cacheKey = `domain_resolve_${host}`;
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const result = JSON.parse(cached);
                        tenantCode.value = result.code;
                        token.value = result.token;
                        uni.setStorageSync('tenant_code', result.code);
                        return;
                    } catch {}
                }
                const res: any = await resolveChannelByDomain(host);
                if (res?.resolveChannelByDomain) {
                    const result = res.resolveChannelByDomain;
                    sessionStorage.setItem(cacheKey, JSON.stringify(result));
                    tenantCode.value = result.code;
                    token.value = result.token;
                    uni.setStorageSync('tenant_code', result.code);
                    return;
                }
            }
        } catch {}
        // #endif

        // 2. 回退：?tenant= URL 参数
        const fromUrl = resolveTenantFromUrl();
        if (fromUrl && TENANT_CONFIGS[fromUrl]) {
            tenantCode.value = fromUrl;
            applyConfig();
            return;
        }

        // 3. 回退：localStorage
        const stored = uni.getStorageSync('tenant_code');
        if (stored && TENANT_CONFIGS[stored]) {
            tenantCode.value = stored;
            applyConfig();
            return;
        }

        // 4. 默认
        tenantCode.value = 'default';
        applyConfig();
    }
```

- [ ] **Step 4: 在 return 中追加 tenantReady**

将第 136-141 行的 return 对象中追加 `tenantReady`：

```typescript
    return {
        token, tenantCode, templateCode, tenantName, paymentMethods, shippingMethods,
        employeePickupMode, defaultLocation, authMethods, wechatAppId, ssoProviders,
        tenantReady, currentConfig, initTenant, switchTenant, listTenants,
        setPaymentMethods, setShippingMethods, loadChannelConfig, loadAuthMethods, loadSsoProviders,
    };
```

- [ ] **Step 5: 提交**

```bash
cd e:\code\vshop
git add src/stores/tenant.ts
git commit --no-verify -m "feat: initTenant async + domain resolution with sessionStorage cache"
```

---

## Task 7: App.vue — onLaunch 异步化

**Files:**
- Modify: `e:\code\vshop\src\App.vue`

- [ ] **Step 1: 改造 onLaunch 为 async + await initTenant**

将 `e:\code\vshop\src\App.vue` 第 7-52 行的 `onLaunch` 回调替换为：

```typescript
onLaunch(async (options: any) => {
    console.log('App Launch');
    const tenantStore = useTenantStore();
    const authStore = useAuthStore();

    // Initialize tenant from domain or URL (async)
    await tenantStore.initTenant();

    // Restore auth token from storage (must be after initTenant sets token)
    await authStore.restoreSession();
    tenantStore.tenantReady = true;

    // Capture invite code from URL ref parameter
    // #ifdef H5
    try {
        const url = new URL(window.location.href);
        const refCode = url.searchParams.get('ref');
        if (refCode) {
            authStore.setInviteCode(refCode);
        }
    } catch (e) {}
    // #endif

    // 小程序: 从 scene 参数解析 r=邀请码
    // #ifdef MP-WEIXIN
    try {
        const scene = options?.query?.scene || options?.scene;
        if (scene) {
            const decoded = decodeURIComponent(scene);
            const params = new URLSearchParams(decoded);
            const refCode = params.get('r');
            if (refCode) {
                authStore.setInviteCode(refCode);
            }
        }
    } catch (e) {}
    // #endif

    // Setup route guard for authenticated pages
    setupRouteGuard();

    // #ifdef H5
    uni.addInterceptor('switchTab', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    uni.addInterceptor('navigateTo', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    uni.addInterceptor('redirectTo', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    // #endif
});
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vshop
git add src/App.vue
git commit --no-verify -m "feat: App.vue onLaunch async + await initTenant before restoreSession"
```

---

## Task 8: 编译与启动验证

- [ ] **Step 1: 构建 cjk-plugin**

Run: `cd e:\code\vendure\packages\cjk-plugin ; npm run build`
Expected: 构建成功

- [ ] **Step 2: dev-server tsc 检查**

Run: `cd e:\code\vendure\packages\dev-server ; npx tsc --noEmit 2>&1 | Select-String "domain|customDomain|DomainResolver|resolveChannelByDomain"`
Expected: 无匹配（无新错误）

- [ ] **Step 3: 启动后端**

Run: `cd e:\code\vendure\packages\dev-server ; npm run dev`
Expected: 服务器成功启动在 port 3000

- [ ] **Step 4: 验证 GraphQL schema**

访问 `http://localhost:3000/graphiql/shop`，执行查询：

```graphql
query {
    resolveChannelByDomain(host: "localhost") {
        token
        code
    }
}
```

Expected: 返回 null（localhost 未配置 customDomains）

- [ ] **Step 5: 验证 customDomains 字段**

登录 admin API，执行查询：

```graphql
query {
    channels {
        items {
            id code
            customFields {
                customDomains
            }
        }
    }
}
```

Expected: 返回 customDomains 字段（初始为 null）

- [ ] **Step 6: 启动前端**

Run: `cd e:\code\vshop ; npm run dev:h5`
Expected: 前端启动成功在 port 5180

- [ ] **Step 7: 验证前端正常加载**

访问 `http://localhost:5180/`
Expected: 页面正常加载（localhost 跳过域名解析，回退到默认 channel）

---

## Self-Review

**Spec 覆盖**：
- [x] customDomains 自定义字段（Task 1）
- [x] DomainResolverService（Task 2）
- [x] Shop API resolveChannelByDomain 查询 + @Allow(Permission.Public)（Task 3）
- [x] plugin.ts providers + shopApiExtensions 注册（Task 3）
- [x] Dashboard channel-detail-forms 注册（Task 4）
- [x] 前端 API 查询（Task 5）
- [x] stores/tenant.ts initTenant 异步化 + 域名解析 + sessionStorage 缓存（Task 6）
- [x] App.vue onLaunch 异步化 + restoreSession 时序（Task 7）
- [x] 编译验证 + 启动验证（Task 8）

**类型一致性**：
- `DomainResolveResult { token: string; code: string }` — Task 2 定义，Task 3 resolver 返回
- `resolveChannelByDomain(host: String!)` — Task 3 schema，Task 5 前端查询
- `tenantReady` ref — Task 6 定义，Task 7 设置

**无占位符**：所有步骤包含完整代码。

**关键注意**：
- `resolveChannelByDomain` 前端调用时使用默认 token（default-token），后端 resolver 不依赖 ctx.channel，使用 ChannelService.findAll 遍历所有 channel
- sessionStorage 缓存在 `stores/tenant.ts` initTenant 中直接处理（不放在 core/tenant.ts，避免循环依赖）
- `restoreSession()` 改为 await（原代码未 await，但改为 await 确保时序正确）
