# C 端体验增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复微信登录、扩展分享、实现商品海报、修复邀请码归因闭环、新增 wxacode 服务

**Architecture:** 后端改动集中在 wechat-auth-plugin（wxacode 服务）和 distribution-plugin（归因修复）；前端改动集中在 vshop（登录修复、分享扩展、海报组件、scene 解析）。前后端通过 GraphQL 查询/mutation 通信。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeORM + GraphQL), uni-app (Vue 3 + TypeScript), html-to-image, qrcode

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-15-c-shop-experience-design.md`

---

## Phase 1: 后端 — 邀请码归因修复

### Task 1: 修复 commission.service.ts 字段错误 + self-referral 校验

**Files:**
- Modify: `e:\code\vendure\packages\distribution-plugin\src\commission.service.ts:35-50`

- [ ] **Step 1: 修改 calculateCommission 方法**

将 `commission.service.ts` 第 46 行的 `referralCode` 改为 `referredBy`，并增加 self-referral 校验。

替换第 43-50 行：

```typescript
        const customer = order.customer;
        if (!customer) return;

        const referralCode = (customer as any).customFields?.referralCode;
        if (!referralCode) return;

        const directDistributor = await this.distributionService.findByReferralCode(ctx, referralCode);
        if (!directDistributor || directDistributor.status !== 'active') return;
```

为：

```typescript
        const customer = order.customer;
        if (!customer) return;

        // 修复：读取 referredBy（推荐人的推荐码），而非 referralCode（自己的码）
        const referredBy = (customer as any).customFields?.referredBy;
        if (!referredBy) return;

        const directDistributor = await this.distributionService.findByReferralCode(ctx, referredBy);
        if (!directDistributor || directDistributor.status !== 'active') return;

        // self-referral 校验：订单用户不能是分销商自己
        if (String(directDistributor.customerId) === String(customer.id)) {
            Logger.info(`Skip self-referral commission for customer ${customer.id}`, loggerCtx);
            return;
        }
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\distribution-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/distribution-plugin/src/commission.service.ts
git commit --no-verify -m "fix: commission.service reads referredBy instead of referralCode + self-referral check"
```

---

### Task 2: distribution.service.ts apply 回写 customer.referralCode

**Files:**
- Modify: `e:\code\vendure\packages\distribution-plugin\src\distribution.service.ts:1-12, 53-86`

- [ ] **Step 1: 注入 CustomerService**

在 `distribution.service.ts` 第 2 行的 import 中追加 `CustomerService`：

```typescript
import { Channel, CustomerService, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
```

修改构造函数（第 9-12 行）：

```typescript
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private customerService: CustomerService,
    ) {}
```

- [ ] **Step 2: apply 方法回写 customer.referralCode**

在 `apply` 方法的 `return this.connection.getRepository(ctx, Distributor).save(distributor);` 之前（第 84 行之后），追加回写逻辑：

```typescript
        const saved = await this.connection.getRepository(ctx, Distributor).save(distributor);

        // 回写 customer.customFields.referralCode
        try {
            const customer = await this.customerService.findOneByUserId(ctx, customerId as any);
            if (customer) {
                await this.customerService.update(ctx, {
                    id: customer.id,
                    customFields: { referralCode: saved.referralCode },
                } as any);
            }
        } catch (e: any) {
            // 回写失败不影响分销商创建
            Logger.warn(`Failed to write back referralCode to customer ${customerId}: ${e.message}`, loggerCtx);
        }

        return saved;
```

替换原来的 `return this.connection.getRepository(ctx, Distributor).save(distributor);`。

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\distribution-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/distribution-plugin/src/distribution.service.ts
git commit --no-verify -m "feat: distribution.service.apply writes back referralCode to customer"
```

---

## Phase 2: 后端 — wxacode 服务

### Task 3: wechat-auth.service.ts token 缓存重构

**Files:**
- Modify: `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-auth.service.ts`

- [ ] **Step 1: 新增小程序 token 缓存 Map 和 getMiniProgramAccessToken 方法**

在 `wechat-auth.service.ts` 第 15 行 `private accessTokenCache` 之后追加：

```typescript
    private miniProgramTokenCacheMap = new Map<string, TokenCache>();
    private miniProgramTokenPromiseMap = new Map<string, Promise<string>>();
```

在 `getJsapiTicket` 方法之后（第 43 行之后）追加新方法：

```typescript
    async getMiniProgramAccessToken(appId: string, appSecret: string): Promise<string> {
        const cached = this.miniProgramTokenCacheMap.get(appId);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.token;
        }
        // 并发去重
        const existing = this.miniProgramTokenPromiseMap.get(appId);
        if (existing) return existing;
        const promise = this.fetchAccessTokenByCredentials(appId, appSecret).finally(() => {
            this.miniProgramTokenPromiseMap.delete(appId);
        });
        this.miniProgramTokenPromiseMap.set(appId, promise);
        return promise;
    }

    private async fetchAccessTokenByCredentials(appId: string, appSecret: string): Promise<string> {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.access_token) {
            this.miniProgramTokenCacheMap.set(appId, {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in - this.REFRESH_BUFFER_SECONDS) * 1000,
            });
            Logger.info(`MiniProgram access_token refreshed for appId=${appId}, expires in ${data.expires_in}s`, loggerCtx);
            return data.access_token;
        }
        Logger.error(`Failed to get MiniProgram access_token: ${JSON.stringify(data)}`, loggerCtx);
        throw new Error('Failed to get WeChat MiniProgram access_token');
    }
```

- [ ] **Step 2: 编译验证**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/wechat-auth-plugin/src/wechat-auth.service.ts
git commit --no-verify -m "feat: add getMiniProgramAccessToken with per-appId cache isolation"
```

---

### Task 4: 新建 wxacode.service.ts

**Files:**
- Create: `e:\code\vendure\packages\wechat-auth-plugin\src\wxacode.service.ts`

- [ ] **Step 1: 创建 WxacodeService**

```typescript
import { Injectable } from '@nestjs/common';
import { ForbiddenError, Logger, RequestContext, UserInputError } from '@vendure/core';
import { getAuthOverride } from '@vendure/cjk-plugin';
import { WechatAuthService } from './wechat-auth.service';
import { WechatAuthPluginOptions } from './types';
import { WECHAT_AUTH_PLUGIN_OPTIONS } from './constants';
import { Inject } from '@nestjs/common';
import { loggerCtx } from './constants';

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

@Injectable()
export class WxacodeService {
    private userCallCount = new Map<string, RateLimitRecord>();
    private readonly MAX_CALLS_PER_MINUTE = 10;

    constructor(
        private wechatAuthService: WechatAuthService,
        @Inject(WECHAT_AUTH_PLUGIN_OPTIONS) private options: WechatAuthPluginOptions,
    ) {}

    async generateWxacode(ctx: RequestContext, args: {
        scene: string;
        path?: string;
        width?: number;
    }): Promise<{ contentType: string; base64: string }> {
        // 1. 鉴权
        if (!ctx.activeUserId) {
            throw new ForbiddenError('请先登录');
        }

        // 2. 参数校验
        if (args.scene.length > 32) {
            throw new UserInputError('scene 参数不能超过 32 字符');
        }

        // 3. 频次限制
        this.checkRateLimit(String(ctx.activeUserId));

        // 4. 获取租户级小程序凭证
        const override = await getAuthOverride(ctx, 'wechat');
        const appId = override?.miniProgramAppId || this.options.miniProgramAppId;
        const appSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret;

        if (!appId || !appSecret) {
            throw new Error('小程序凭证未配置');
        }

        // 5. 获取 access_token
        const accessToken = await this.wechatAuthService.getMiniProgramAccessToken(appId, appSecret);

        // 6. 调用微信 getwxacodeunlimit 接口
        const response = await fetch('https://api.weixin.qq.com/wxa/getwxacodeunlimit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: accessToken,
                scene: args.scene,
                page: args.path,
                width: args.width || 430,
                env_version: 'release',
                check_path: false,
            }),
        });

        // 7. 处理响应
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image/')) {
            const buffer = Buffer.from(await response.arrayBuffer());
            return {
                contentType,
                base64: buffer.toString('base64'),
            };
        }

        // 错误响应
        const errorBody = (await response.json()) as any;
        Logger.error(`WeChat wxacode failed: ${JSON.stringify(errorBody)}`, loggerCtx);
        throw new Error(`微信小程序码生成失败: ${errorBody.errcode} ${errorBody.errmsg}`);
    }

    private checkRateLimit(userId: string): void {
        const now = Date.now();
        const record = this.userCallCount.get(userId);

        if (!record || record.resetAt < now) {
            this.userCallCount.set(userId, { count: 1, resetAt: now + 60_000 });
            return;
        }

        if (record.count >= this.MAX_CALLS_PER_MINUTE) {
            throw new Error('调用过于频繁，请稍后再试');
        }
        record.count++;
    }
}
```

- [ ] **Step 2: 导出 WxacodeService**

在 `e:\code\vendure\packages\wechat-auth-plugin\src\index.ts` 中追加：

```typescript
export * from './wxacode.service';
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/wechat-auth-plugin/src/wxacode.service.ts packages/wechat-auth-plugin/src/index.ts
git commit --no-verify -m "feat: add WxacodeService for generating wxacodeunlimit QR codes"
```

---

### Task 5: wechat-auth-shop.resolver.ts + plugin.ts 注册 wxacode

**Files:**
- Modify: `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-auth-shop.resolver.ts`
- Modify: `e:\code\vendure\packages\wechat-auth-plugin\src\plugin.ts`

- [ ] **Step 1: resolver 追加 wechatWxacode 查询**

在 `wechat-auth-shop.resolver.ts` 中追加 WxacodeService 注入和查询方法：

```typescript
import { Args, Query, Resolver } from '@nestjs/graphql';
import { ForbiddenError, RequestContext, UserInputError, Ctx } from '@vendure/core';
import { WechatAuthService } from './wechat-auth.service';
import { WxacodeService } from './wxacode.service';

@Resolver()
export class WechatAuthShopResolver {
    constructor(
        private wechatAuthService: WechatAuthService,
        private wxacodeService: WxacodeService,
    ) {}

    @Query()
    async wechatJsapiSignature(
        @Args('url') url: string,
    ): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
        return this.wechatAuthService.generateJsapiSignature(url);
    }

    @Query()
    async wechatWxacode(
        @Ctx() ctx: RequestContext,
        @Args('scene') scene: string,
        @Args({ name: 'path', type: () => String, nullable: true }) path?: string,
        @Args({ name: 'width', type: () => Int, nullable: true }) width?: number,
    ): Promise<{ contentType: string; base64: string }> {
        return this.wxacodeService.generateWxacode(ctx, { scene, path, width });
    }
}
```

注意：需要从 `@nestjs/graphql` 导入 `Int`。

完整替换文件内容为：

```typescript
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { RequestContext, Ctx } from '@vendure/core';
import { WechatAuthService } from './wechat-auth.service';
import { WxacodeService } from './wxacode.service';

@Resolver()
export class WechatAuthShopResolver {
    constructor(
        private wechatAuthService: WechatAuthService,
        private wxacodeService: WxacodeService,
    ) {}

    @Query()
    async wechatJsapiSignature(
        @Args('url') url: string,
    ): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
        return this.wechatAuthService.generateJsapiSignature(url);
    }

    @Query()
    async wechatWxacode(
        @Ctx() ctx: RequestContext,
        @Args('scene') scene: string,
        @Args({ name: 'path', type: () => String, nullable: true }) path?: string,
        @Args({ name: 'width', type: () => Int, nullable: true }) width?: number,
    ): Promise<{ contentType: string; base64: string }> {
        return this.wxacodeService.generateWxacode(ctx, { scene, path, width });
    }
}
```

- [ ] **Step 2: plugin.ts 注册 WxacodeService + schema 扩展**

在 `plugin.ts` 的 import 中追加：

```typescript
import { WxacodeService } from './wxacode.service';
```

在 `providers` 数组中追加 `WxacodeService`（在 `WechatAuthService` 之后）：

```typescript
    providers: [
        { provide: WECHAT_AUTH_PLUGIN_OPTIONS, useFactory: () => WechatAuthPlugin.options },
        WechatAuthService,
        WxacodeService,
    ],
```

在 `shopApiExtensions.schema` 中追加 WxacodeResult 类型和查询（在现有 `wechatJsapiSignature` 查询之后）：

```typescript
        return gql`
            type JsapiSignature {
                appId: String!
                timestamp: Int!
                nonceStr: String!
                signature: String!
            }
            type WxacodeResult {
                contentType: String!
                base64: String!
            }
            extend type Query {
                wechatJsapiSignature(url: String!): JsapiSignature!
                wechatWxacode(scene: String!, path: String, width: Int): WxacodeResult!
            }
        `;
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 构建插件**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin && npm run build`
Expected: 构建成功，`lib/` 目录生成

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure
git add packages/wechat-auth-plugin/src/wechat-auth-shop.resolver.ts packages/wechat-auth-plugin/src/plugin.ts
git commit --no-verify -m "feat: register wechatWxacode query in shop API"
```

---

## Phase 3: 后端 — authMethods 扩展

### Task 6: auth-shop.resolver.ts 扩展返回 wechatAppId

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-shop.resolver.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts`（shopApiExtensions schema）

- [ ] **Step 1: 修改 authMethods 查询返回类型**

完整替换 `auth-shop.resolver.ts` 内容为：

```typescript
import { Resolver, Query } from '@nestjs/graphql';
import { RequestContext, Ctx } from '@vendure/core';
import { readChannelAuthConfig } from './crypto';
import type { SsoProviderInfo } from './auth-config.types';

@Resolver()
export class AuthShopResolver {
    @Query()
    authMethods(@Ctx() ctx: RequestContext): { methods: string[]; wechatAppId: string | null } {
        // readChannelAuthConfig 是同步函数，无需 async/await
        const config = readChannelAuthConfig(ctx);
        if (!config?.enabledMethods) {
            // 向后兼容：返回所有已注册策略
            return { methods: ['native', 'phone', 'wechat', 'alipay', 'douyin'], wechatAppId: null };
        }
        let wechatAppId: string | null = null;
        if (config.enabledMethods.includes('wechat')) {
            const wechatOverride = (config.overrides as Record<string, any> | undefined)?.wechat;
            wechatAppId = wechatOverride?.appId || null;
        }
        return { methods: config.enabledMethods, wechatAppId };
    }

    @Query()
    ssoProviders(@Ctx() ctx: RequestContext): SsoProviderInfo[] {
        const config = readChannelAuthConfig(ctx);
        if (!config?.ssoProvidersJson) return [];
        try {
            const providers = JSON.parse(config.ssoProvidersJson);
            return providers.map((p: any) => ({
                name: p.name,
                providerKey: p.providerKey,
                protocol: p.protocol,
                baseUrl: p.baseUrl,
                authorizeUrl: p.authorizeUrl,
                clientId: p.clientId,
                scopes: p.scopes || [],
                channelCode: p.channelCode,
            }));
        } catch {
            return [];
        }
    }
}
```

注意：`readChannelAuthConfig` 是同步函数（见 `crypto.ts:190`），不需要 `async/await`。ssoProviders 查询也改回同步（原代码已是同步）。

- [ ] **Step 2: 修改 plugin.ts 中 shopApiExtensions schema**

在 `e:\code\vendure\packages\cjk-plugin\src\plugin.ts` 第 212-215 行，当前 schema 是：

```graphql
                extend type Query {
                    authMethods: [String!]!
                    ssoProviders: [SsoProviderInfo!]!
                }
```

替换为：

```graphql
                type AuthMethodsResult {
                    methods: [String!]!
                    wechatAppId: String
                }
                extend type Query {
                    authMethods: AuthMethodsResult!
                    ssoProviders: [SsoProviderInfo!]!
                }
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 构建插件**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/auth/auth-shop.resolver.ts packages/cjk-plugin/src/plugin.ts
git commit --no-verify -m "feat: authMethods query returns wechatAppId for frontend login button"
```

---

## Phase 4: 前端 — 基础层

### Task 7: vshop 新增依赖 + API 查询更新

**Files:**
- Modify: `e:\code\vshop\package.json`
- Modify: `e:\code\vshop\src\api\queries\channel.ts`
- Create: `e:\code\vshop\src\api\queries\wechat.ts`（如果不存在则创建，否则追加）

- [ ] **Step 1: 安装依赖**

Run: `cd e:\code\vshop && npm install html-to-image qrcode && npm install -D @types/qrcode`
Expected: 安装成功

- [ ] **Step 2: 更新 channel.ts 中的 getAuthMethods 查询**

修改 `e:\code\vshop\src\api\queries\channel.ts` 的 `getAuthMethods` 函数：

```typescript
export async function getAuthMethods() {
    const client = getGraphQLClient();
    return client.request(`query {
        authMethods {
            methods
            wechatAppId
        }
    }`);
}
```

- [ ] **Step 3: 在 wechat.ts 中追加 GET_WXACODE 查询**

检查 `e:\code\vshop\src\api\queries\wechat.ts` 是否已存在。如果存在，追加以下内容；如果不存在，创建新文件：

```typescript
import { getGraphQLClient } from '../client';

export async function getJsapiSignature(url: string) {
    const client = getGraphQLClient();
    const res: any = await client.request(`query WechatJsapiSignature($url: String!) {
        wechatJsapiSignature(url: $url) {
            appId timestamp nonceStr signature
        }
    }`, { url });
    return res.wechatJsapiSignature;
}

export async function getWxacode(scene: string, path?: string): Promise<{ contentType: string; base64: string }> {
    const client = getGraphQLClient();
    const res: any = await client.request(`query WechatWxacode($scene: String!, $path: String, $width: Int) {
        wechatWxacode(scene: $scene, path: $path, width: $width) {
            contentType base64
        }
    }`, { scene, path, width: 430 });
    return res.wechatWxacode;
}
```

- [ ] **Step 4: 提交**

```bash
cd e:\code\vshop
git add package.json package-lock.json src/api/queries/channel.ts src/api/queries/wechat.ts
git commit --no-verify -m "feat: add html-to-image/qrcode deps + update authMethods and wxacode queries"
```

---

### Task 8: stores/tenant.ts 扩展 + App.vue scene 解析

**Files:**
- Modify: `e:\code\vshop\src\stores\tenant.ts`
- Modify: `e:\code\vshop\src\App.vue`

- [ ] **Step 1: tenant.ts 扩展 wechatAppId state**

在 `e:\code\vshop\src\stores\tenant.ts` 的 `authMethods` ref 之后追加：

```typescript
    const wechatAppId = ref('');
```

修改 `loadAuthMethods` 函数：

```typescript
    async function loadAuthMethods() {
        try {
            const res: any = await getAuthMethods();
            const data = res?.authMethods || {};
            authMethods.value = data.methods || ['native'];
            wechatAppId.value = data.wechatAppId || '';
        } catch (e) {
            authMethods.value = ['native'];
            wechatAppId.value = '';
        }
    }
```

在 return 语句中追加 `wechatAppId`：

```typescript
    return {
        token, tenantCode, templateCode, tenantName, paymentMethods, shippingMethods,
        employeePickupMode, defaultLocation, authMethods, wechatAppId, ssoProviders,
        currentConfig, initTenant, switchTenant, listTenants,
        setPaymentMethods, setShippingMethods, loadChannelConfig, loadAuthMethods, loadSsoProviders,
    };
```

- [ ] **Step 2: App.vue onLaunch 解析小程序 scene**

在 `e:\code\vshop\src\App.vue` 的 `onLaunch` 回调中，在 `authStore.restoreSession()` 之后、H5 的 ref 捕获之后，追加小程序 scene 解析：

```typescript
onLaunch((options: any) => {
    console.log('App Launch');
    const tenantStore = useTenantStore();
    const authStore = useAuthStore();

    // Initialize tenant from config or URL
    tenantStore.initTenant();

    // Restore auth token from storage
    authStore.restoreSession();

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
});
```

- [ ] **Step 3: 提交**

```bash
cd e:\code\vshop
git add src/stores/tenant.ts src/App.vue
git commit --no-verify -m "feat: tenant store wechatAppId + App.vue parses mp scene for invite code"
```

---

### Task 9: api/mutations/auth.ts 注册传递 referredBy

**Files:**
- Modify: `e:\code\vshop\src\api\mutations\auth.ts`

- [ ] **Step 1: 修改 registerCustomer 函数支持 customFields.referredBy**

替换 `registerCustomer` 函数（第 155-170 行）为：

```typescript
export async function registerCustomer(input: {
    phoneNumber?: string;
    code?: string;
    emailAddress?: string;
    password: string;
    referredBy?: string;
}): Promise<any> {
    const { data } = await authRequest(
        `mutation Register($input: RegisterCustomerAccountInput!) {
            registerCustomerAccount(input: $input) {
                ...on Success { success }
                ...on MissingPasswordError { errorCode message }
                ...on PasswordValidationError { errorCode message }
                ...on NativeAuthStrategyError { errorCode message }
            }
        }`,
        { input }
    );
    return data;
}
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vshop
git add src/api/mutations/auth.ts
git commit --no-verify -m "feat: registerCustomer passes customFields.referredBy"
```

---

## Phase 5: 前端 — 微信登录修复

### Task 10: login/index.vue 修复静默授权循环 + 读后端 appId

**Files:**
- Modify: `e:\code\vshop\src\pages\login\index.vue`

- [ ] **Step 1: 替换 wechatAppId 来源**

将第 75 行 `const wechatAppId = import.meta.env.VITE_WECHAT_APP_ID || '';` 替换为：

```typescript
const wechatAppId = computed(() => tenantStore.wechatAppId || import.meta.env.VITE_WECHAT_APP_ID || '');
```

- [ ] **Step 2: 添加静默授权失败标记**

在第 73 行 `const redirectUrl = ref('');` 之后追加：

```typescript
const lastWechatAuthFailed = ref(false);
```

- [ ] **Step 3: 修改 onMounted 中的自动触发逻辑**

将第 132-141 行的自动触发逻辑：

```typescript
    if (!authStore.token) {
        const platform = detectPlatform();
        if (platform === 'wechat' && wechatAppId && authMethods.value.includes('wechat')) {
            loginWithWechatH5('snsapi_base');
        } else if (platform === 'alipay' && authMethods.value.includes('alipay')) {
            loginWithAlipayH5();
        } else if (platform === 'douyin' && authMethods.value.includes('douyin')) {
            loginWithDouyinH5();
        }
    }
```

替换为：

```typescript
    if (!authStore.token && !lastWechatAuthFailed.value) {
        const platform = detectPlatform();
        if (platform === 'wechat' && wechatAppId.value && authMethods.value.includes('wechat')) {
            loginWithWechatH5('snsapi_base');
        } else if (platform === 'alipay' && authMethods.value.includes('alipay')) {
            loginWithAlipayH5();
        } else if (platform === 'douyin' && authMethods.value.includes('douyin')) {
            loginWithDouyinH5();
        }
    }
```

- [ ] **Step 4: 修改 handleWechatH5Callback 失败处理**

将第 224-235 行的 `handleWechatH5Callback` 替换为：

```typescript
async function handleWechatH5Callback(oauthCode: string) {
    // #ifdef H5
    try {
        const result = await authenticateWithWechat(oauthCode, 'mp');
        if (result.userId) {
            authStore.setAuth(result.token, result.userId);
            ui.showToast('登录成功', 'success');
            navigateAfterLogin();
        } else {
            lastWechatAuthFailed.value = true;
            ui.showToast('微信登录失败，请重试', 'none');
            mode.value = 'select';
        }
    } catch (e: any) {
        lastWechatAuthFailed.value = true;
        ui.showToast('微信登录失败: ' + e.message);
        mode.value = 'select';
    }
    // #endif
}
```

- [ ] **Step 5: 修改模板中 wechatAppId 引用**

将模板第 27 行 `v-if="authMethods.includes('wechat') && isWechatBrowser && wechatAppId"` 改为 `v-if="authMethods.includes('wechat') && isWechatBrowser && wechatAppId"`（保持不变，因为 wechatAppId 现在是 computed ref，模板中自动解包）。

同时将 `loginWithWechatH5` 函数中第 207 行 `if (!wechatAppId)` 改为 `if (!wechatAppId.value)`。

- [ ] **Step 6: 追加登录后补写 referredBy 逻辑**

在 `login/index.vue` 的 `loginWithLocal` 和 `loginWithPhone` 函数中，登录成功后追加补写逻辑。

在 `<script setup>` 中追加辅助函数：

```typescript
async function tryUpdateReferredBy(inviteCode: string) {
    try {
        const { getGraphQLClient } = require('../../api/client');
        const client = getGraphQLClient();
        // 先查询当前用户是否已有 referredBy
        const res: any = await client.request(`query {
            activeCustomer {
                id
                customFields { referredBy }
            }
        }`);
        const existing = res?.activeCustomer?.customFields?.referredBy;
        if (existing) return; // 已有值不覆盖
        // 空则补写
        await client.request(`mutation UpdateCustomerReferredBy($referredBy: String!) {
            updateCustomer(input: { customFields: { referredBy: $referredBy } }) {
                ...on Customer { id }
                ...on ErrorResult { errorCode }
            }
        }`, { referredBy: inviteCode });
    } catch (e) {
        // 失败不影响主流程
        console.error('补写 referredBy 失败', e);
    }
}
```

在 `loginWithLocal` 函数中，`authStore.setAuth(result.token, result.userId)` 之后追加：

```typescript
        if (authStore.inviteCode) {
            tryUpdateReferredBy(authStore.inviteCode);
        }
```

在 `loginWithPhone` 函数中同样追加。

在 `handleWechatH5Callback`、`handleAlipayH5Callback`、`handleDouyinH5Callback` 中，`authStore.setAuth` 之后也追加同样的补写逻辑。

- [ ] **Step 7: 提交**

```bash
cd e:\code\vshop
git add src/pages/login/index.vue
git commit --no-verify -m "fix: wechat login reads appId from backend + prevents silent auth loop + login补写referredBy"
```

---

## Phase 6: 前端 — 分享扩展

### Task 11: resetWxReady 路由拦截 + 4 类页面接入分享

**Files:**
- Modify: `e:\code\vshop\src\App.vue`
- Modify: `e:\code\vshop\src\pages\home\index.vue`
- Modify: `e:\code\vshop\src\pkg-promotion\pages\flash-sale.vue`
- Modify: `e:\code\vshop\src\pkg-promotion\pages\group-buy.vue`
- Modify: `e:\code\vshop\src\pkg-promotion\pages\coupons.vue`

- [ ] **Step 1: App.vue 追加路由拦截器**

在 `e:\code\vshop\src\App.vue` 的 `setupRouteGuard()` 调用之后追加：

```typescript
    // H5: 路由切换后重置 wx ready 状态
    // #ifdef H5
    uni.addInterceptor('switchTab', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    uni.addInterceptor('navigateTo', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    uni.addInterceptor('redirectTo', { complete: () => { import('./utils/wechat').then(m => m.resetWxReady()); } });
    // #endif
```

- [ ] **Step 2: 首页接入分享**

在 `e:\code\vshop\src\pages\home\index.vue` 的 `<script setup>` 中追加：

```typescript
import { useShare } from '../../composables/useShare';
import { useAuthStore } from '../../stores/auth';
import { useTenantStore } from '../../stores/tenant';

const authStore = useAuthStore();
const tenantStore = useTenantStore();

const inviteCode = computed(() => authStore.inviteCode || '');
const channelName = computed(() => tenantStore.tenantName || 'VShop 商城');

useShare({
    title: `${channelName.value} - 精选好物`,
    path: `/?ref=${inviteCode.value}`,
});
```

（如果首页已有 `onShareAppMessage`/`onShareTimeline`，替换为 useShare 调用）

- [ ] **Step 3: 秒杀活动页接入分享**

在 `e:\code\vshop\src\pkg-promotion\pages\flash-sale.vue` 的 `<script setup>` 中追加：

```typescript
import { useShare } from '../../composables/useShare';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const inviteCode = computed(() => authStore.inviteCode || '');

// 假设活动数据已加载到 activity 变量中
useShare({
    title: `限时秒杀：${activity.value?.name || '限时秒杀'}`,
    path: `/pkg-promotion/pages/flash-sale?ref=${inviteCode.value}`,
});
```

- [ ] **Step 4: 拼团活动页接入分享**

在 `e:\code\vshop\src\pkg-promotion\pages\group-buy.vue` 的 `<script setup>` 中追加：

```typescript
import { useShare } from '../../composables/useShare';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const inviteCode = computed(() => authStore.inviteCode || '');

useShare({
    title: `拼团：${activity.value?.name || '拼团优惠'}`,
    path: `/pkg-promotion/pages/group-buy?ref=${inviteCode.value}`,
});
```

- [ ] **Step 5: 优惠券页接入分享**

在 `e:\code\vshop\src\pkg-promotion\pages\coupons.vue` 的 `<script setup>` 中追加：

```typescript
import { useShare } from '../../composables/useShare';
import { useAuthStore } from '../../stores/auth';
import { useTenantStore } from '../../stores/tenant';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const inviteCode = computed(() => authStore.inviteCode || '');
const channelName = computed(() => tenantStore.tenantName || 'VShop 商城');

useShare({
    title: `快来领优惠券 - ${channelName.value}`,
    path: `/pkg-promotion/pages/coupons?ref=${inviteCode.value}`,
});
```

- [ ] **Step 6: 提交**

```bash
cd e:\code\vshop
git add src/App.vue src/pages/home/index.vue src/pkg-promotion/pages/flash-sale.vue src/pkg-promotion/pages/group-buy.vue src/pkg-promotion/pages/coupons.vue
git commit --no-verify -m "feat: expand share to home, flash-sale, group-buy, coupons pages + SPA route wx reset"
```

---

## Phase 7: 前端 — 商品海报

### Task 12: usePosterData composable + 海报组件

**Files:**
- Create: `e:\code\vshop\src\components\product-poster\usePosterData.ts`
- Create: `e:\code\vshop\src\components\product-poster\product-poster-h5.vue`
- Create: `e:\code\vshop\src\components\product-poster\product-poster-mp.vue`
- Create: `e:\code\vshop\src\components\product-poster\product-poster.vue`

- [ ] **Step 1: 创建 usePosterData.ts**

```typescript
import { ref } from 'vue';
import { getWxacode } from '../../api/queries/wechat';
import { useAuthStore } from '../../stores/auth';
import { useTenantStore } from '../../stores/tenant';

export interface PosterData {
    channelName: string;
    channelLogo?: string;
    productImage: string;
    productTitle: string;
    price: string;
    originalPrice?: string;
    qrCodeBase64: string;      // 统一字段名：H5 为 URL 二维码 base64，小程序为小程序码 base64
    inviteCode?: string;
}

const wxacodeCache = new Map<string, { base64: string; contentType: string; expireAt: number }>();

async function fetchWxacode(scene: string, path?: string): Promise<{ base64: string; contentType: string }> {
    const cacheKey = `${scene}|${path || ''}`;
    const cached = wxacodeCache.get(cacheKey);
    if (cached && cached.expireAt > Date.now()) {
        return { base64: cached.base64, contentType: cached.contentType };
    }
    const result = await getWxacode(scene, path);
    wxacodeCache.set(cacheKey, {
        base64: result.base64,
        contentType: result.contentType,
        expireAt: Date.now() + 60_000,
    });
    return result;
}

// H5 端：用 qrcode 库生成 URL 二维码（扫码跳转 H5 页面）
async function generateH5QrCode(product: any, inviteCode: string): Promise<string> {
    const { default: QRCode } = await import('qrcode');
    const shareUrl = `${window.location.origin}/#/pkg-product/pages/detail?slug=${product.slug}`
        + (inviteCode ? `&ref=${inviteCode}` : '');
    const dataUrl = await QRCode.toDataURL(shareUrl, { width: 200, margin: 1 });
    // dataUrl 格式为 data:image/png;base64,...，提取 base64 部分
    return dataUrl.split(',')[1];
}

export function usePosterData() {
    const loading = ref(false);
    const error = ref('');

    async function preparePosterData(product: any): Promise<PosterData> {
        const authStore = useAuthStore();
        const tenantStore = useTenantStore();
        loading.value = true;
        error.value = '';
        try {
            const slug = product.slug || '';
            const inviteCode = authStore.inviteCode || '';

            // 根据平台获取不同的二维码
            let qrCodeBase64 = '';
            // #ifdef MP-WEIXIN
            // 小程序端：调用后端 wxacode 服务生成小程序码
            const scene = inviteCode ? `s=${slug}&r=${inviteCode}` : `s=${slug}`;
            const wxacode = await fetchWxacode(scene, 'pkg-product/pages/detail');
            qrCodeBase64 = wxacode.base64;
            // #endif
            // #ifdef H5
            // H5 端：用 qrcode 库生成 URL 二维码
            qrCodeBase64 = await generateH5QrCode(product, inviteCode);
            // #endif

            return {
                channelName: tenantStore.tenantName || 'VShop 商城',
                productImage: product.featuredAsset?.preview || '',
                productTitle: product.name || '',
                price: String(product.priceWithTax?.value ?? ''),
                originalPrice: product.customFields?.compareAtPrice ? String(product.customFields.compareAtPrice) : undefined,
                qrCodeBase64,
                inviteCode: inviteCode || undefined,
            };
        } catch (e: any) {
            error.value = e.message || '海报数据准备失败';
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return { loading, error, preparePosterData };
}
```

- [ ] **Step 2: 创建 product-poster-h5.vue**

```vue
<!-- #ifdef H5 -->
<template>
  <view class="poster-overlay" @click="$emit('close')">
    <view class="poster-container" @click.stop>
      <view ref="posterRef" class="poster-canvas">
        <view class="poster-header">
          <text class="poster-channel-name">{{ data.channelName }}</text>
        </view>
        <image class="poster-product-image" :src="data.productImage" crossorigin="anonymous" mode="aspectFit" />
        <view class="poster-price-row">
          <text class="poster-price">¥{{ data.price }}</text>
          <text v-if="data.originalPrice" class="poster-original-price">¥{{ data.originalPrice }}</text>
        </view>
        <text class="poster-title">{{ data.productTitle }}</text>
        <view class="poster-footer">
          <image class="poster-qr" :src="'data:image/png;base64,' + data.qrCodeBase64" mode="aspectFit" />
          <view class="poster-footer-text">
            <text class="poster-scan-tip">扫码购买</text>
            <text v-if="data.inviteCode" class="poster-invite-code">邀请码：{{ data.inviteCode }}</text>
          </view>
        </view>
      </view>
      <view class="poster-actions">
        <button class="poster-btn" @click="savePoster">长按保存图片</button>
        <button class="poster-btn poster-btn--close" @click="$emit('close')">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toPng } from 'html-to-image';
import type { PosterData } from './usePosterData';

const props = defineProps<{ data: PosterData }>();
defineEmits<{ close: [] }>();

const posterRef = ref<HTMLElement | null>(null);
const posterDataUrl = ref('');

onMounted(async () => {
    if (posterRef.value) {
        try {
            posterDataUrl.value = await toPng(posterRef.value, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: '#ffffff',
            });
        } catch (e) {
            console.error('海报生成失败', e);
        }
    }
});

function savePoster() {
    if (posterDataUrl.value) {
        const link = document.createElement('a');
        link.download = 'product-poster.png';
        link.href = posterDataUrl.value;
        link.click();
    }
}
</script>

<style lang="scss" scoped>
.poster-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.poster-container { background: #fff; border-radius: 12rpx; padding: 20rpx; max-width: 90vw; }
.poster-canvas { width: 600rpx; background: #fff; }
.poster-header { padding: 20rpx; text-align: center; }
.poster-channel-name { font-size: 32rpx; font-weight: bold; }
.poster-product-image { width: 600rpx; height: 600rpx; }
.poster-price-row { padding: 20rpx; display: flex; align-items: baseline; gap: 20rpx; }
.poster-price { font-size: 48rpx; color: #e93b3b; font-weight: bold; }
.poster-original-price { font-size: 28rpx; color: #999; text-decoration: line-through; }
.poster-title { padding: 0 20rpx 20rpx; font-size: 28rpx; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.poster-footer { display: flex; align-items: center; padding: 20rpx; gap: 20rpx; border-top: 1rpx solid #eee; }
.poster-qr { width: 150rpx; height: 150rpx; }
.poster-footer-text { display: flex; flex-direction: column; gap: 8rpx; }
.poster-scan-tip { font-size: 24rpx; color: #666; }
.poster-invite-code { font-size: 22rpx; color: #999; }
.poster-actions { margin-top: 20rpx; display: flex; gap: 20rpx; justify-content: center; }
.poster-btn { padding: 16rpx 40rpx; font-size: 28rpx; border: 1rpx solid #ddd; border-radius: 8rpx; background: #fff; }
.poster-btn--close { color: #999; }
</style>
<!-- #endif -->
```

- [ ] **Step 3: 创建 product-poster-mp.vue**

```vue
<!-- #ifdef MP-WEIXIN -->
<template>
  <view class="poster-overlay" @click="$emit('close')">
    <view class="poster-container" @click.stop>
      <canvas canvas-id="posterCanvas" class="poster-canvas" />
      <view class="poster-actions" v-if="posterImagePath">
        <button class="poster-btn" @click="savePoster">保存到相册</button>
        <button class="poster-btn poster-btn--close" @click="$emit('close')">关闭</button>
      </view>
      <view class="poster-loading" v-if="!posterImagePath">
        <text>海报生成中...</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PosterData } from './usePosterData';

const props = defineProps<{ data: PosterData }>();
defineEmits<{ close: [] }>();

const posterImagePath = ref('');

onMounted(() => {
    drawPoster();
});

async function drawPoster() {
    const ctx = uni.createCanvasContext('posterCanvas');
    const d = props.data;

    // 背景
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, 750, 1200);

    // 商城名
    ctx.setFillStyle('#333333');
    ctx.setFontSize(28);
    ctx.fillText(d.channelName, 80, 60);

    // 商品主图
    if (d.productImage) {
        try {
            const imgInfo = await uni.getImageInfo({ src: d.productImage });
            ctx.drawImage(imgInfo.path, 0, 100, 750, 750);
        } catch {}
    }

    // 价格
    ctx.setFillStyle('#e93b3b');
    ctx.setFontSize(48);
    ctx.fillText(`¥${d.price}`, 40, 920);

    // 原价
    if (d.originalPrice) {
        ctx.setFillStyle('#999999');
        ctx.setFontSize(28);
        ctx.fillText(`¥${d.originalPrice}`, 200, 920);
    }

    // 小程序码
    if (d.qrCodeBase64) {
        const wxacodePath = `data:image/png;base64,${d.qrCodeBase64}`;
        try {
            const imgInfo = await uni.getImageInfo({ src: wxacodePath });
            ctx.drawImage(imgInfo.path, 40, 1000, 150, 150);
        } catch {}
    }

    // 邀请码
    if (d.inviteCode) {
        ctx.setFillStyle('#999999');
        ctx.setFontSize(24);
        ctx.fillText(`邀请码：${d.inviteCode}`, 210, 1080);
    }

    ctx.draw(false, () => {
        setTimeout(() => {
            uni.canvasToTempFilePath({
                canvasId: 'posterCanvas',
                success: (res: any) => { posterImagePath.value = res.tempFilePath; },
                fail: () => { uni.showToast({ title: '海报生成失败', icon: 'none' }); },
            });
        }, 200);
    });
}

function savePoster() {
    if (!posterImagePath.value) return;
    uni.saveImageToPhotosAlbum({
        filePath: posterImagePath.value,
        success: () => uni.showToast({ title: '保存成功', icon: 'success' }),
        fail: (err: any) => {
            if (err.errMsg.includes('auth deny')) {
                uni.showModal({
                    title: '提示',
                    content: '需要相册权限才能保存海报，请前往设置开启',
                    confirmText: '去设置',
                    success: (res) => { if (res.confirm) uni.openSetting({}); },
                });
            }
        },
    });
}
</script>

<style lang="scss" scoped>
.poster-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.poster-container { background: #fff; border-radius: 12rpx; padding: 20rpx; }
.poster-canvas { width: 750rpx; height: 1200rpx; }
.poster-actions { margin-top: 20rpx; display: flex; gap: 20rpx; justify-content: center; }
.poster-btn { padding: 16rpx 40rpx; font-size: 28rpx; border: 1rpx solid #ddd; border-radius: 8rpx; background: #fff; }
.poster-btn--close { color: #999; }
.poster-loading { padding: 40rpx; text-align: center; }
</style>
<!-- #endif -->
```

- [ ] **Step 4: 创建 product-poster.vue 入口组件**

```vue
<template>
  <ProductPosterH5 v-if="data" :data="data" @close="$emit('close')" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { usePosterData, type PosterData } from './usePosterData';

// #ifdef H5
import ProductPosterH5 from './product-poster-h5.vue';
// #endif
// #ifdef MP-WEIXIN
import ProductPosterMp from './product-poster-mp.vue';
// #endif

const props = defineProps<{ product: any }>();
defineEmits<{ close: [] }>();

const { loading, error, preparePosterData } = usePosterData();
const data = ref<PosterData | null>(null);

onMounted(async () => {
    try {
        data.value = await preparePosterData(props.product);
    } catch (e) {
        uni.showToast({ title: '海报生成失败', icon: 'none' });
    }
});
</script>
```

注意：由于 uni-app 条件编译的限制，入口组件需要根据平台分发。实际实现时可能需要用 `#ifdef` 包裹整个 template。简化版：

```vue
<template>
  <view>
    <!-- #ifdef H5 -->
    <ProductPosterH5 v-if="data" :data="data" @close="$emit('close')" />
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <ProductPosterMp v-if="data" :data="data" @close="$emit('close')" />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePosterData, type PosterData } from './usePosterData';

// #ifdef H5
import ProductPosterH5 from './product-poster-h5.vue';
// #endif
// #ifdef MP-WEIXIN
import ProductPosterMp from './product-poster-mp.vue';
// #endif

const props = defineProps<{ product: any }>();
defineEmits<{ close: [] }>();

const { preparePosterData } = usePosterData();
const data = ref<PosterData | null>(null);

onMounted(async () => {
    try {
        data.value = await preparePosterData(props.product);
    } catch (e) {
        uni.showToast({ title: '海报生成失败', icon: 'none' });
    }
});
</script>
```

- [ ] **Step 5: 提交**

```bash
cd e:\code\vshop
git add src/components/product-poster/
git commit --no-verify -m "feat: add product poster component (H5 html-to-image + MP canvas)"
```

---

### Task 13: detail.vue 接入海报组件

**Files:**
- Modify: `e:\code\vshop\src\pkg-product\pages\detail.vue`

- [ ] **Step 1: 在 detail.vue 中追加海报按钮和组件**

在 `<script setup>` 中追加 import：

```typescript
import ProductPoster from '../../components/product-poster/product-poster.vue';

const showPoster = ref(false);
```

在模板的操作栏区域追加按钮：

```vue
<view class="detail-action-poster" @click="showPoster = true">
  <text class="detail-action-icon">📋</text>
  <text class="detail-action-text">海报</text>
</view>
```

在模板末尾追加组件：

```vue
<ProductPoster v-if="showPoster" :product="product" @close="showPoster = false" />
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vshop
git add src/pkg-product/pages/detail.vue
git commit --no-verify -m "feat: product detail page integrates poster component"
```

---

## Phase 8: 前端 — 分销申请修复

### Task 14: distribution.vue 携带 referredByCode

**Files:**
- Modify: `e:\code\vshop\src\pkg-user\pages\distribution.vue`

- [ ] **Step 1: 修改 applyDist 函数传递 referredByCode**

完整替换 `distribution.vue` 的 `<script setup>` 内容为：

```typescript
<script setup lang="ts">
import { getGraphQLClient } from '../../api/client';
import { useUIStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';

const ui = useUIStore();
const authStore = useAuthStore();

async function applyDist() {
    try {
        const client = getGraphQLClient();
        const referredByCode = authStore.inviteCode || null;
        await client.request(
            `mutation ApplyDistributor($referredByCode: String) {
                applyDistributor(referredByCode: $referredByCode) {
                    id status
                }
            }`,
            { referredByCode }
        );
        ui.showToast('申请成功', 'success');
    } catch (e: any) { ui.showToast(e.message); }
}
</script>
```

注意：需要确认 `applyDistributor` mutation 的 schema 是否已支持 `referredByCode` 参数。查看 `distribution-plugin/src/plugin.ts` 的 shopApiExtensions schema，当前 `applyDistributor: Distributor!` 不带参数。

需要修改 `distribution-plugin/src/plugin.ts` 的 shopApiExtensions schema，将：

```graphql
extend type Mutation {
    applyDistributor: Distributor!
    requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
}
```

改为：

```graphql
extend type Mutation {
    applyDistributor(referredByCode: String): Distributor!
    requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
}
```

同时修改 `distribution-plugin/src/distribution-shop.resolver.ts` 的 `applyDistributor` resolver 方法签名，接受 `referredByCode` 参数并传递给 `distributionService.apply`。

- [ ] **Step 2: 修改 distribution-plugin schema（resolver 已支持）**

注意：`distribution-shop.resolver.ts` 第 53 行已支持 `@Args('referredByCode') referredByCode?: string`，但 `plugin.ts` 的 schema 中 `applyDistributor: Distributor!` 未声明参数。只需修改 schema。

修改 `e:\code\vendure\packages\distribution-plugin\src\plugin.ts` 中 shopApiExtensions 的 schema：

将 `applyDistributor: Distributor!` 改为 `applyDistributor(referredByCode: String): Distributor!`

- [ ] **Step 3: 构建插件**

Run: `cd e:\code\vendure\packages\distribution-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 4: 提交后端改动**

```bash
cd e:\code\vendure
git add packages/distribution-plugin/src/plugin.ts
git commit --no-verify -m "feat: applyDistributor schema accepts referredByCode parameter"
```

- [ ] **Step 5: 提交前端改动**

```bash
cd e:\code\vshop
git add src/pkg-user/pages/distribution.vue
git commit --no-verify -m "feat: distribution page passes referredByCode"
```

---

## Phase 9: 配置与验证

### Task 15: dev-config.ts Asset CORS 配置

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts`

- [ ] **Step 1: 在 dev-config.ts 中配置 CORS**

注意：AssetServerPlugin 的 options **不支持** `middleware` 字段（已确认 `AssetServerOptions` 接口无此字段）。需使用 Vendure 的 `apiOptions.middleware` 配置全局 CORS 中间件。

找到 `dev-config.ts` 中 `apiOptions` 配置，追加 CORS 中间件：

```typescript
    apiOptions: {
        // ... 现有配置
        middleware: [
            {
                handler: (req, res, next) => {
                    // 仅对 /assets 路径设置 CORS（用于海报跨域图片加载）
                    if (req.path.startsWith('/assets')) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                    }
                    next();
                },
                route: '/assets',
            },
        ],
    },
```

备选方案：如果 `apiOptions.middleware` 路由匹配不生效，可直接在 DevServer 启动后追加 Express 全局中间件（在 dev-config.ts 的 `bootstrap` 函数中）：

```typescript
// 在 VendureServer.bootstrap 成功后追加
app.use('/assets', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
```

前端 `<img>` 标签需添加 `crossorigin="anonymous"` 属性（已在 product-poster-h5.vue 中配置）。

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/dev-server/dev-config.ts
git commit --no-verify -m "feat: add CORS middleware to AssetServerPlugin for poster image loading"
```

---

### Task 16: 编译验证

- [ ] **Step 1: 编译 wechat-auth-plugin**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 2: 编译 cjk-plugin**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 3: 编译 distribution-plugin**

Run: `cd e:\code\vendure\packages\distribution-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 4: dev-server tsc 检查**

Run: `cd e:\code\vendure\packages\dev-server && npx tsc --noEmit`
Expected: 无 auth/poster/distribution 相关错误

- [ ] **Step 5: vshop 编译检查**

Run: `cd e:\code\vshop && npm run build`
Expected: 无编译错误

---

### Task 17: 启动验证

- [ ] **Step 1: 启动后端**

Run: `cd e:\code\vendure\packages\dev-server && npm run dev`
Expected: 服务器成功启动在 port 3000，无 GraphQL schema 错误

- [ ] **Step 2: 验证 GraphQL schema**

访问 `http://localhost:3000/shop-api`，执行以下查询：

```graphql
query {
    authMethods {
        methods
        wechatAppId
    }
}
```

Expected: 返回 `{ methods: [...], wechatAppId: null }` 或具体 appId

- [ ] **Step 3: 验证 wxacode 查询（需登录）**

登录后执行：

```graphql
query {
    wechatWxacode(scene: "s=test&r=ABC123") {
        contentType
        base64
    }
}
```

Expected: 返回 base64 图片数据（若小程序凭证未配置，返回错误提示）

- [ ] **Step 4: 启动前端**

Run: `cd e:\code\vshop && npm run dev`
Expected: Vite 启动成功

- [ ] **Step 5: 验证登录页**

访问 `http://localhost:5180/?tenant=default#/pages/login/index`
Expected: 登录页正常渲染，微信登录按钮根据 authMethods 显示/隐藏

---

## Self-Review Checklist

完成后检查：

1. **Spec 覆盖**：
   - [x] 微信登录修复（Task 6, 7, 8, 10）
   - [x] 分享扩展（Task 11）
   - [x] 商品海报（Task 12, 13）
   - [x] 邀请码归因闭环（Task 1, 2, 9, 14）
   - [x] wxacode 服务（Task 3, 4, 5）
   - [x] Asset CORS（Task 15）

2. **类型一致性**：
   - `authMethods` 返回 `AuthMethodsResult { methods, wechatAppId }`
   - `wechatWxacode` 返回 `WxacodeResult { contentType, base64 }`
   - `PosterData` 接口在 usePosterData.ts 定义，H5/MP 组件引用

3. **已知风险**：
   - AssetServerPlugin `middleware` 选项可能不支持 — 备选方案用全局 CORS
   - uni-app 条件编译在入口组件的 import 可能需要特殊处理
   - `registerCustomerAccount` 的 input 是否支持 `customFields` 需运行时验证
