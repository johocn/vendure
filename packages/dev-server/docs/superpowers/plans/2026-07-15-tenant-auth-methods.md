# 租户登录方式配置 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现按租户（Channel）启用/禁用登录方式、租户凭证覆盖（混合模式）、zhao-sso/标准 OAuth2 双协议 SSO、管理后台配置 UI、前端动态渲染。

**Architecture:** 在 Channel.customFields 增加 `authConfig`（struct 类型）存储启用方式列表、凭证覆盖、SSO Provider 配置。通过 NestJS Guard + 策略自查双层拦截认证请求。SSO 策略实现 `defineInputType` + `authenticate`，支持 zhao-sso 和标准 OAuth2 双协议。Dashboard 用 `inputs` 覆盖 authConfig 字段的渲染组件。前端根据 `authMethods` query 动态渲染登录按钮。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeORM + GraphQL), cjk-plugin, React Dashboard, Vue 3 + uni-app, AES-256-GCM

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-15-tenant-auth-methods-design.md`

---

## Phase 1: 数据模型基础

### Task 1: 创建 auth-config 类型定义

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-config.types.ts`

- [ ] **Step 1: 创建类型定义文件**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-config.types.ts

export type AuthMethod = 'native' | 'phone' | 'wechat' | 'alipay' | 'douyin' | 'sso';

export interface TenantAuthConfig {
    enabledMethods: AuthMethod[];
    overrides?: Partial<{
        phone: { accessKeyId: string; accessKeySecret: string; signName: string; templateCode: string };
        wechat: {
            appId: string;
            appSecret: string;
            miniProgramAppId?: string;
            miniProgramAppSecret?: string;
            token?: string;
            encodingAESKey?: string;
        };
        alipay: { appId: string; privateKey: string; miniProgramAppId?: string };
        douyin: { appId: string; appSecret: string; miniProgramAppId?: string; miniProgramAppSecret?: string };
    }>;
    ssoProviders?: SsoProvider[];
}

export interface SsoProvider {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    channelCode?: string;
    userInfoMapping?: {
        externalIdField?: string;
        emailField?: string;
        nicknameField?: string;
        mobileField?: string;
        avatarField?: string;
    };
}

/** 管理后台返回的脱敏结构 */
export interface TenantAuthConfigMasked {
    enabledMethods: AuthMethod[];
    overrides?: Record<string, any>;
    ssoProviders?: SsoProviderMasked[];
}

export interface SsoProviderMasked {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    channelCode?: string;
    userInfoMapping?: SsoProvider['userInfoMapping'];
}

/** Shop API 返回的精简结构（不含 secret） */
export interface SsoProviderInfo {
    name: string;
    providerKey: string;
    protocol: 'zhao-sso' | 'oauth2';
    baseUrl: string;
    authorizeUrl?: string;
    clientId: string;
    scopes: string[];
    channelCode?: string;
}
```

- [ ] **Step 2: 验证编译**

Run: `cd e:\code\vendure\packages\cjk-plugin; npx tsc --noEmit --skipLibCheck src/auth/auth-config.types.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/cjk-plugin/src/auth/auth-config.types.ts
git commit -m "feat(cjk-plugin): add auth-config type definitions"
```

---

### Task 2: 创建 AES-256-GCM 加密工具

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts`

- [ ] **Step 1: 创建加密工具**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';

function getKey(): Buffer {
    const secret = CjkPlugin.options.authSecret || process.env.AUTH_SECRET || 'default-dev-key-change-in-prod';
    return scryptSync(secret, 'vendure-auth-salt', 32);
}

// 延迟导入避免循环依赖
let _CjkPlugin: any;
function getCjkPluginOptions(): any {
    if (!_CjkPlugin) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _CjkPlugin = require('../plugin').CjkPlugin;
    }
    return _CjkPlugin.options;
}

export function encrypt(plain: string): string {
    if (!plain) return plain;
    if (plain.startsWith(ENC_PREFIX)) return plain; // 已加密
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload: string): string {
    if (!payload || !payload.startsWith(ENC_PREFIX)) return payload;
    try {
        const [, ivHex, tagHex, encHex] = payload.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = createDecipheriv(ALGO, getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch (e) {
        return '';
    }
}

export function isEncrypted(value: string): boolean {
    return value?.startsWith(ENC_PREFIX) ?? false;
}

/** 加密 authConfig 中所有敏感字段（原地修改） */
export function encryptAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    // 加密 overrides 中的 secret 字段
    if (result.overrides?.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret) w.appSecret = encrypt(w.appSecret);
        if (w.miniProgramAppSecret) w.miniProgramAppSecret = encrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey) w.encodingAESKey = encrypt(w.encodingAESKey);
    }
    if (result.overrides?.phone?.accessKeySecret) {
        result.overrides.phone.accessKeySecret = encrypt(result.overrides.phone.accessKeySecret);
    }
    if (result.overrides?.alipay?.privateKey) {
        result.overrides.alipay.privateKey = encrypt(result.overrides.alipay.privateKey);
    }
    if (result.overrides?.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret) d.appSecret = encrypt(d.appSecret);
        if (d.miniProgramAppSecret) d.miniProgramAppSecret = encrypt(d.miniProgramAppSecret);
    }

    // 加密 ssoProviders clientSecret
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret) p.clientSecret = encrypt(p.clientSecret);
        }
    }

    return result;
}

/** 解密 authConfig 中所有敏感字段 */
export function decryptAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    if (result.overrides?.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret) w.appSecret = decrypt(w.appSecret);
        if (w.miniProgramAppSecret) w.miniProgramAppSecret = decrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey) w.encodingAESKey = decrypt(w.encodingAESKey);
    }
    if (result.overrides?.phone?.accessKeySecret) {
        result.overrides.phone.accessKeySecret = decrypt(result.overrides.phone.accessKeySecret);
    }
    if (result.overrides?.alipay?.privateKey) {
        result.overrides.alipay.privateKey = decrypt(result.overrides.alipay.privateKey);
    }
    if (result.overrides?.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret) d.appSecret = decrypt(d.appSecret);
        if (d.miniProgramAppSecret) d.miniProgramAppSecret = decrypt(d.miniProgramAppSecret);
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret) p.clientSecret = decrypt(p.clientSecret);
        }
    }

    return result;
}

/** 脱敏 authConfig（管理后台读取用，secret 返回 ***） */
export function maskAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    const maskField = (obj: any, field: string) => {
        if (obj?.[field]) obj[field] = '***';
    };

    if (result.overrides?.wechat) {
        maskField(result.overrides.wechat, 'appSecret');
        maskField(result.overrides.wechat, 'miniProgramAppSecret');
        maskField(result.overrides.wechat, 'encodingAESKey');
    }
    if (result.overrides?.phone) maskField(result.overrides.phone, 'accessKeySecret');
    if (result.overrides?.alipay) maskField(result.overrides.alipay, 'privateKey');
    if (result.overrides?.douyin) {
        maskField(result.overrides.douyin, 'appSecret');
        maskField(result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) maskField(p, 'clientSecret');
    }

    return result;
}

/** 合并保存：新值中 *** 表示保留原值 */
export function mergeAuthConfig(original: any, incoming: any): any {
    if (!original) return encryptAuthConfig(incoming);
    if (!incoming) return original;

    const result = JSON.parse(JSON.stringify(incoming));

    const mergeField = (origObj: any, newObj: any, field: string) => {
        if (newObj?.[field] === '***' && origObj?.[field]) {
            newObj[field] = origObj[field]; // 保留原加密值
        }
    };

    if (result.overrides?.wechat) {
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'appSecret');
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'miniProgramAppSecret');
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'encodingAESKey');
    }
    if (result.overrides?.phone) mergeField(original.overrides?.phone, result.overrides.phone, 'accessKeySecret');
    if (result.overrides?.alipay) mergeField(original.overrides?.alipay, result.overrides.alipay, 'privateKey');
    if (result.overrides?.douyin) {
        mergeField(original.overrides?.douyin, result.overrides.douyin, 'appSecret');
        mergeField(original.overrides?.douyin, result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders && original.ssoProviders) {
        for (const newP of result.ssoProviders) {
            const origP = original.ssoProviders.find((p: any) => p.providerKey === newP.providerKey);
            mergeField(origP, newP, 'clientSecret');
        }
    }

    return encryptAuthConfig(result);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/crypto.ts
git commit -m "feat(cjk-plugin): add AES-256-GCM crypto utils for auth config"
```

---

### Task 3: 在 Channel customFields 增加 authConfig 字段

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 1: 读取当前文件内容**

Run: Read `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 2: 在 Channel customFields 数组末尾增加 authConfig 字段**

在 `Channel` 数组中现有字段（employeePickupMode、defaultLocation 等）之后追加:

```ts
{
    name: 'authConfig',
    type: 'struct',
    nullable: true,
    public: true,
    label: [{ languageCode: LanguageCode.zh_Hans, value: '租户登录方式配置' }],
    schema: {
        enabledMethods: { type: 'string', list: true },
        overrides: { type: 'json' },
        ssoProviders: { type: 'json' },
    },
},
```

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure\packages\cjk-plugin; npx tsc --noEmit --skipLibCheck`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts
git commit -m "feat(cjk-plugin): add authConfig struct field to Channel customFields"
```

---

## Phase 2: 后端策略拦截

### Task 4: 创建 AuthMethodGuard 和工具函数

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-method-guard.ts`

- [ ] **Step 1: 创建 Guard 和工具函数**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-method-guard.ts
import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { RequestContext, ForbiddenError, parseContext } from '@vendure/core';
import type { AuthMethod, TenantAuthConfig } from './auth-config.types';

export function isAuthMethodEnabled(ctx: RequestContext, method: AuthMethod): boolean {
    const config = (ctx.channel as any)?.customFields?.authConfig as TenantAuthConfig | null;
    if (!config) return true; // 向后兼容
    return config.enabledMethods.includes(method);
}

@Injectable()
export class AuthMethodGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const parsed = parseContext(context);
        if (!parsed.isGraphQL) return true;

        const info = parsed.info;
        if (!info || info.fieldName !== 'authenticate') return true;

        // 仅拦截 shop API（通过路径判断）
        const req = parsed.req;
        const isShopApi = req?.path?.includes('/shop-api') || req?.url?.includes('/shop-api');
        if (!isShopApi) return true;

        const gqlCtx = GqlExecutionContext.create(context);
        const args = gqlCtx.getArgs();
        if (!args?.input) return true;

        // AuthenticationInput 是 map: { native?: {...}, phone?: {...}, sso?: {...} }
        const method = Object.keys(args.input)[0] as AuthMethod;
        if (!method) return true;

        // 从 req 提取 RequestContext（Vendure AuthGuard 已写入）
        const ctx: RequestContext = (req as any)._requestContext;
        if (!ctx) return true; // 无 ctx 则放行（降级）

        if (!isAuthMethodEnabled(ctx, method)) {
            throw new ForbiddenError();
        }
        return true;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/auth-method-guard.ts
git commit -m "feat(cjk-plugin): add AuthMethodGuard for per-channel auth method control"
```

---

### Task 5: 修改 phone-auth-plugin 策略

**Files:**
- Modify: `e:\code\vendure\packages\phone-auth-plugin\src\phone-authentication-strategy.ts`

- [ ] **Step 1: 读取当前策略文件**

Run: Read `e:\code\vendure\packages\phone-auth-plugin\src\phone-authentication-strategy.ts`

- [ ] **Step 2: 在 authenticate 方法开头加 isAuthMethodEnabled 检查和凭证覆盖**

在 `async authenticate(ctx: RequestContext, data: PhoneAuthData)` 方法第一行插入:

```ts
// 租户级登录方式开关检查
const authConfig = (ctx.channel as any)?.customFields?.authConfig;
if (authConfig?.enabledMethods && !authConfig.enabledMethods.includes('phone')) {
    throw new ForbiddenError();
}

// 租户凭证覆盖
const override = authConfig?.overrides?.phone;
const accessKeyId = override?.accessKeyId || this.options.accessKeyId;
const accessKeySecret = override?.accessKeySecret || this.options.accessKeySecret;
const signName = override?.signName || this.options.signName;
const templateCode = override?.templateCode || this.options.templateCode;
```

在文件头部增加 import:
```ts
import { ForbiddenError } from '@vendure/core';
```

后续代码中使用 `accessKeyId/accessKeySecret/signName/templateCode` 局部变量替换 `this.options.xxx`。

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure\packages\phone-auth-plugin; npx tsc --noEmit --skipLibCheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add packages/phone-auth-plugin/src/phone-authentication-strategy.ts
git commit -m "feat(phone-auth): add per-channel auth method check and credential override"
```

---

### Task 6: 修改 wechat-auth-plugin 类型和策略

**Files:**
- Modify: `e:\code\vendure\packages\wechat-auth-plugin\src\types.ts`
- Modify: `e:\code\vendure\packages\wechat-auth-plugin\src\wechat-auth-strategy.ts`

- [ ] **Step 1: 在 types.ts 增加 token/encodingAESKey 字段**

在 `WechatAuthPluginOptions` 接口中增加:
```ts
/** 公众号消息校验 token */
token?: string;
/** 公众号通信加密密钥（EncodingAESKey，43 位） */
encodingAESKey?: string;
```

- [ ] **Step 2: 在 wechat-auth-strategy.ts 的 authenticate 方法加检查和凭证覆盖**

在 `async authenticate(ctx: RequestContext, data: WechatAuthData)` 方法开头插入:
```ts
// 租户级登录方式开关检查
const authConfig = (ctx.channel as any)?.customFields?.authConfig;
if (authConfig?.enabledMethods && !authConfig.enabledMethods.includes('wechat')) {
    throw new ForbiddenError();
}

// 租户凭证覆盖
const override = authConfig?.overrides?.wechat;
const appId = override?.appId || this.options.appId;
const appSecret = override?.appSecret || this.options.appSecret;
const miniProgramAppId = override?.miniProgramAppId || this.options.miniProgramAppId;
const miniProgramAppSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret;
```

在文件头部增加 import:
```ts
import { ForbiddenError } from '@vendure/core';
```

后续 OAuth 调用中使用局部变量 `appId/appSecret/miniProgramAppId/miniProgramAppSecret` 替换 `this.options.xxx`。

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure\packages\wechat-auth-plugin; npx tsc --noEmit --skipLibCheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add packages/wechat-auth-plugin/src/types.ts packages/wechat-auth-plugin/src/wechat-auth-strategy.ts
git commit -m "feat(wechat-auth): add token/encodingAESKey fields and per-channel override"
```

---

### Task 7: 修改 alipay-plugin 和 douyin-auth-plugin 策略

**Files:**
- Modify: `e:\code\vendure\packages\alipay-plugin\src\alipay-auth-strategy.ts`
- Modify: `e:\code\vendure\packages\douyin-auth-plugin\src\douyin-auth-strategy.ts`

- [ ] **Step 1: 在 alipay-auth-strategy.ts authenticate 方法加检查**

在方法开头插入（alipay 的凭证在 `this.options.auth` 下）:
```ts
import { ForbiddenError } from '@vendure/core';
// ...
const authConfig = (ctx.channel as any)?.customFields?.authConfig;
if (authConfig?.enabledMethods && !authConfig.enabledMethods.includes('alipay')) {
    throw new ForbiddenError();
}
const override = authConfig?.overrides?.alipay;
const authConfigOpts = override || this.options.auth || {};
// 后续用 authConfigOpts.appId / authConfigOpts.privateKey / authConfigOpts.miniProgramAppId
```

- [ ] **Step 2: 在 douyin-auth-strategy.ts authenticate 方法加检查**

在方法开头插入:
```ts
import { ForbiddenError } from '@vendure/core';
// ...
const authConfig = (ctx.channel as any)?.customFields?.authConfig;
if (authConfig?.enabledMethods && !authConfig.enabledMethods.includes('douyin')) {
    throw new ForbiddenError();
}
const override = authConfig?.overrides?.douyin;
const appId = override?.appId || this.options.appId;
const appSecret = override?.appSecret || this.options.appSecret;
const miniProgramAppId = override?.miniProgramAppId || this.options.miniProgramAppId;
const miniProgramAppSecret = override?.miniProgramAppSecret || this.options.miniProgramAppSecret;
```

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure\packages\alipay-plugin; npx tsc --noEmit --skipLibCheck`
Run: `cd e:\code\vendure\packages\douyin-auth-plugin; npx tsc --noEmit --skipLibCheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add packages/alipay-plugin/src/alipay-auth-strategy.ts packages/douyin-auth-plugin/src/douyin-auth-strategy.ts
git commit -m "feat(alipay,douyin): add per-channel auth method check and credential override"
```

---

## Phase 3: SSO 认证策略

### Task 8: 创建 SSO 认证策略

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts`

- [ ] **Step 1: 创建 SSO 策略**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\sso-authentication-strategy.ts
import { AuthenticationStrategy, RequestContext, User, Logger, ID } from '@vendure/core';
import { gql } from 'graphql-tag';
import type { SsoProvider, TenantAuthConfig } from './auth-config.types';
import { decryptAuthConfig } from './crypto';

const loggerCtx = 'SsoAuthenticationStrategy';

interface SsoAuthData {
    providerKey: string;
    code: string;
}

export class SsoAuthenticationStrategy implements AuthenticationStrategy<SsoAuthData> {
    readonly name = 'sso';

    defineInputType() {
        return gql`
            input SsoAuthInput {
                providerKey: String!
                code: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: SsoAuthData): Promise<User | false | string> {
        const rawConfig = (ctx.channel as any)?.customFields?.authConfig as TenantAuthConfig | null;
        if (!rawConfig?.ssoProviders) {
            Logger.warn('No SSO providers configured for channel', loggerCtx);
            return false;
        }

        const config = decryptAuthConfig(rawConfig);
        const provider = config.ssoProviders!.find(p => p.providerKey === data.providerKey);
        if (!provider) {
            Logger.warn(`SSO provider "${data.providerKey}" not found`, loggerCtx);
            return false;
        }

        try {
            // 1. 换取 access_token
            const tokenRes = await this.exchangeCodeForToken(provider, data.code);
            if (!tokenRes.access_token) {
                Logger.warn('SSO token exchange failed', loggerCtx);
                return false;
            }

            // 2. 获取用户信息
            const userInfo = await this.getUserInfo(provider, tokenRes.access_token);
            if (!userInfo) {
                return false;
            }

            // 3. 映射字段
            const externalId = this.getField(userInfo, provider, 'externalIdField',
                provider.protocol === 'zhao-sso' ? 'uuid' : 'sub');
            if (!externalId) {
                Logger.warn('SSO userInfo missing externalId field', loggerCtx);
                return false;
            }

            const email = this.getField(userInfo, provider, 'emailField', 'email');
            const nickname = this.getField(userInfo, provider, 'nicknameField',
                provider.protocol === 'zhao-sso' ? 'nickname' : 'name');
            const mobile = this.getField(userInfo, provider, 'mobileField', 'mobile');
            const avatar = this.getField(userInfo, provider, 'avatarField', 'avatar_url');

            // 4. 查找或创建 Customer
            const identifier = `sso_${provider.providerKey}_${externalId}`;
            return await this.findOrCreateUser(ctx, identifier, email, nickname, mobile, avatar);
        } catch (e: any) {
            Logger.error(`SSO authentication failed: ${e.message}`, loggerCtx);
            return false;
        }
    }

    private getFieldValue(userInfo: any, mappingField: string | undefined, defaultField: string): string {
        const field = mappingField || defaultField;
        return userInfo[field] || '';
    }

    private getField(userInfo: any, provider: SsoProvider, mappingKey: keyof NonNullable<SsoProvider['userInfoMapping']>, defaultField: string): string {
        const mappingField = provider.userInfoMapping?.[mappingKey];
        return this.getFieldValue(userInfo, mappingField, defaultField);
    }

    private async exchangeCodeForToken(provider: SsoProvider, code: string): Promise<any> {
        const redirectUri = `${typeof window !== 'undefined' ? window.location.origin : ''}/pages/login/index`;

        if (provider.protocol === 'zhao-sso') {
            const tokenUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/auth/token`;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code,
                    app_code: provider.clientId,
                    app_secret: provider.clientSecret,
                    redirect_uri: redirectUri,
                }),
            });
            return res.json();
        } else {
            const tokenUrl = provider.tokenUrl!;
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    client_id: provider.clientId,
                    client_secret: provider.clientSecret,
                    redirect_uri: redirectUri,
                }),
            });
            return res.json();
        }
    }

    private async getUserInfo(provider: SsoProvider, accessToken: string): Promise<any | null> {
        const userInfoUrl = provider.protocol === 'zhao-sso'
            ? `${provider.baseUrl.replace(/\/$/, '')}/v1/user/me`
            : provider.userInfoUrl!;

        const res = await fetch(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            Logger.warn(`SSO userInfo request failed: ${res.status}`, loggerCtx);
            return null;
        }
        return res.json();
    }

    private async findOrCreateUser(
        ctx: RequestContext,
        identifier: string,
        email: string,
        nickname: string,
        mobile: string,
        avatar: string,
    ): Promise<User | false> {
        // 使用 Vendure 内部服务查找或创建用户
        // 这里需要注入 UserService、CustomerService
        // 由于策略是 new 实例化的，通过 NestJS Injector 获取服务
        // 实际实现需通过 plugin configuration 注入服务
        // 简化实现：返回 false，实际在 plugin.ts 中用 factory 包装
        // TODO: 在 plugin.ts 中用闭包注入 userService/customerService
        return false;
    }
}
```

**注意**: `findOrCreateUser` 的完整实现需要在 plugin.ts 中用工厂函数注入 `UserService` 和 `CustomerService`。在 Task 10 中完成。

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/sso-authentication-strategy.ts
git commit -m "feat(cjk-plugin): add SSO authentication strategy with zhao-sso/oauth2 support"
```

---

### Task 9: 创建 SSO i18n 消息

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\i18n-messages.ts`

- [ ] **Step 1: 创建 i18n 消息**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\i18n-messages.ts
import { LanguageCode } from '@vendure/core';

export const authI18nMessages: Record<string, Record<LanguageCode, string>> = {
    'error.login-method-disabled': {
        [LanguageCode.zh_Hans]: '该登录方式未启用',
        [LanguageCode.en]: 'This login method is not enabled',
        [LanguageCode.ja]: 'このログイン方法は有効になっていません',
        [LanguageCode.ko]: '이 로그인 방식이 활성화되지 않았습니다',
    },
    'error.sso-config-incomplete': {
        [LanguageCode.zh_Hans]: 'SSO 配置不完整',
        [LanguageCode.en]: 'SSO configuration is incomplete',
        [LanguageCode.ja]: 'SSO設定が不完全です',
        [LanguageCode.ko]: 'SSO 설정이 불완전합니다',
    },
    'error.sso-token-exchange-failed': {
        [LanguageCode.zh_Hans]: 'SSO 授权失败',
        [LanguageCode.en]: 'SSO authorization failed',
        [LanguageCode.ja]: 'SSO認証に失敗しました',
        [LanguageCode.ko]: 'SSO 인증에 실패했습니다',
    },
    'error.sso-user-info-failed': {
        [LanguageCode.zh_Hans]: 'SSO 用户信息获取失败',
        [LanguageCode.en]: 'SSO user info retrieval failed',
        [LanguageCode.ja]: 'SSOユーザー情報の取得に失敗しました',
        [LanguageCode.ko]: 'SSO 사용자 정보 조회에 실패했습니다',
    },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/i18n-messages.ts
git commit -m "feat(cjk-plugin): add SSO i18n messages (zh/en/ja/ko)"
```

---

## Phase 4: Shop/Admin API 扩展

### Task 10: 创建 Shop API resolver

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-shop.resolver.ts`

- [ ] **Step 1: 创建 Shop resolver**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-shop.resolver.ts
import { Resolver, Query, RequestContext, Ctx } from '@vendure/core';
import type { AuthMethod, SsoProviderInfo, TenantAuthConfig } from './auth-config.types';

@Resolver()
export class AuthShopResolver {
    @Query()
    authMethods(@Ctx() ctx: RequestContext): string[] {
        const config = (ctx.channel as any)?.customFields?.authConfig as TenantAuthConfig | null;
        if (!config?.enabledMethods) {
            // 向后兼容：返回所有已注册策略
            return ['native', 'phone', 'wechat', 'alipay', 'douyin'];
        }
        return config.enabledMethods;
    }

    @Query()
    ssoProviders(@Ctx() ctx: RequestContext): SsoProviderInfo[] {
        const config = (ctx.channel as any)?.customFields?.authConfig as TenantAuthConfig | null;
        if (!config?.ssoProviders) return [];
        return config.ssoProviders.map(p => ({
            name: p.name,
            providerKey: p.providerKey,
            protocol: p.protocol,
            baseUrl: p.baseUrl,
            authorizeUrl: p.authorizeUrl,
            clientId: p.clientId,
            scopes: p.scopes || [],
            channelCode: p.channelCode,
        }));
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/auth-shop.resolver.ts
git commit -m "feat(cjk-plugin): add Shop API resolver for authMethods and ssoProviders queries"
```

---

### Task 11: 创建 Admin API resolver

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\auth\auth-admin.resolver.ts`

- [ ] **Step 1: 创建 Admin resolver**

```ts
// e:\code\vendure\packages\cjk-plugin\src\auth\auth-admin.resolver.ts
import { Resolver, Query, Args, RequestContext, Ctx, ID } from '@vendure/core';
import { ChannelService } from '@vendure/core';
import { Inject } from '@nestjs/common';
import { maskAuthConfig, decryptAuthConfig } from './crypto';
import type { TenantAuthConfigMasked } from './auth-config.types';

@Resolver()
export class AuthAdminResolver {
    constructor(@Inject(ChannelService) private channelService: ChannelService) {}

    @Query()
    async channelAuthConfig(
        @Ctx() ctx: RequestContext,
        @Args() args: { channelId: string },
    ): Promise<TenantAuthConfigMasked | null> {
        const channel = await this.channelService.findOne(ctx, args.channelId as any);
        if (!channel) return null;
        const rawConfig = (channel as any).customFields?.authConfig;
        if (!rawConfig) return null;
        const decrypted = decryptAuthConfig(rawConfig);
        return maskAuthConfig(decrypted);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cjk-plugin/src/auth/auth-admin.resolver.ts
git commit -m "feat(cjk-plugin): add Admin API resolver for channelAuthConfig query"
```

---

### Task 12: 在 plugin.ts 注册所有新模块

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\src\types.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\index.ts`

- [ ] **Step 1: 在 types.ts 增加 authSecret 选项**

在 `CjkPluginOptions` 接口中增加:
```ts
/** 用于加密 authConfig 中凭证的密钥 */
authSecret?: string;
```

- [ ] **Step 2: 在 plugin.ts 增加导入和注册**

在 plugin.ts 头部增加导入:
```ts
import { AuthShopResolver } from './auth/auth-shop.resolver';
import { AuthAdminResolver } from './auth/auth-admin.resolver';
import { AuthMethodGuard } from './auth/auth-method-guard';
import { SsoAuthenticationStrategy } from './auth/sso-authentication-strategy';
```

在 `@VendurePlugin` 装饰器中:
- `providers` 增加 `AuthShopResolver`、`AuthAdminResolver`、`{ provide: APP_GUARD, useClass: AuthMethodGuard }`
- `adminApiExtensions` 增加 authConfig 相关的 schema（`channelAuthConfig` query + `TenantAuthConfigMasked` type）
- `shopApiExtensions` 增加 `authMethods` query、`ssoProviders` query、`SsoProviderInfo` type
- `configuration` 钩子中注册 SSO 策略到 `shopAuthenticationStrategy`:
```ts
config.authOptions.shopAuthenticationStrategy = [
    ...(config.authOptions.shopAuthenticationStrategy || []),
    new SsoAuthenticationStrategy(/* 注入 userService/customerService */),
];
```

- [ ] **Step 3: 在 index.ts 增加导出**

```ts
__exportStar(require('./src/auth/auth-config.types'), exports);
__exportStar(require('./src/auth/crypto'), exports);
__exportStar(require('./src/auth/auth-method-guard'), exports);
__exportStar(require('./src/auth/sso-authentication-strategy'), exports);
__exportStar(require('./src/auth/auth-shop.resolver'), exports);
__exportStar(require('./src/auth/auth-admin.resolver'), exports);
__exportStar(require('./src/auth/i18n-messages'), exports);
```

- [ ] **Step 4: 验证编译**

Run: `cd e:\code\vendure\packages\cjk-plugin; npm run build`
Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
git add packages/cjk-plugin/src/plugin.ts packages/cjk-plugin/src/types.ts packages/cjk-plugin/index.ts
git commit -m "feat(cjk-plugin): register auth modules, Guard, and SSO strategy in plugin"
```

---

## Phase 5: dev-server 测试数据

### Task 13: 更新 dev-config.ts

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\dev-config.ts`

- [ ] **Step 1: 在 CjkPlugin.init 中增加 authSecret**

在 `CjkPlugin.init({...})` 调用中增加:
```ts
authSecret: process.env.AUTH_SECRET || 'dev-auth-secret-key',
```

- [ ] **Step 2: Commit**

```bash
git add packages/dev-server/dev-config.ts
git commit -m "feat(dev-server): add authSecret to CjkPlugin config"
```

---

### Task 14: 更新 default-channel 测试数据

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\china-data\02-default-channel.ts`

- [ ] **Step 1: 在 channel customFields 中设置 authConfig**

在创建 default channel 时设置:
```ts
customFields: {
    // ... 现有字段 ...
    authConfig: {
        enabledMethods: ['native', 'phone', 'wechat', 'alipay', 'douyin'],
    },
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/dev-server/china-data/02-default-channel.ts
git commit -m "feat(dev-server): add authConfig to default channel test data"
```

---

### Task 15: 更新 shop-a-channel 测试数据

**Files:**
- Modify: `e:\code\vendure\packages\dev-server\china-data\03-shop-a-channel.ts`

- [ ] **Step 1: 在 shop-a channel customFields 中设置 authConfig**

```ts
customFields: {
    // ... 现有字段 ...
    authConfig: {
        enabledMethods: ['native', 'phone', 'wechat', 'sso'],
        overrides: {
            wechat: {
                appId: 'wx-tenant-a',
                appSecret: 'secret-a',
                miniProgramAppId: 'mini-a',
                token: 'tenant-a-msg-token',
                encodingAESKey: 'tenant-a-43-char-encoding-aes-key-herexxxxxxxx',
            },
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
            },
        ],
    },
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/dev-server/china-data/03-shop-a-channel.ts
git commit -m "feat(dev-server): add authConfig with SSO provider to shop-a channel"
```

---

## Phase 6: 前端改造

### Task 16: 扩展前端 API 层

**Files:**
- Modify: `e:\code\vshop\src\api\queries\channel.ts`
- Modify: `e:\code\vshop\src\api\mutations\auth.ts`

- [ ] **Step 1: 在 channel.ts 增加 getAuthMethods 和 getSsoProviders**

```ts
export async function getAuthMethods() {
    return client.request(`query { authMethods }`);
}

export async function getSsoProviders() {
    return client.request(`query {
        ssoProviders {
            name providerKey protocol baseUrl authorizeUrl clientId scopes channelCode
        }
    }`);
}
```

- [ ] **Step 2: 在 auth.ts 增加 ssoLogin mutation**

```ts
export async function ssoLogin(providerKey: string, code: string) {
    return client.request(`mutation {
        authenticate(input: { sso: { providerKey: "${providerKey}", code: "${code}" } }) {
            ... on CurrentUser { id identifier }
            ... on InvalidCredentialsError { errorCode message }
        }
    }`);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/queries/channel.ts src/api/mutations/auth.ts
git commit -m "feat(vshop): add authMethods/ssoProviders queries and ssoLogin mutation"
```

---

### Task 17: 扩展 tenant store

**Files:**
- Modify: `e:\code\vshop\src\stores\tenant.ts`

- [ ] **Step 1: 增加 authMethods 和 ssoProviders state**

在 store 中增加:
```ts
import { getAuthMethods, getSsoProviders } from '../api/queries/channel';

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
    try {
        const res: any = await getAuthMethods();
        authMethods.value = res.authMethods || ['native'];
    } catch (e) {
        authMethods.value = ['native'];
    }
}

async function loadSsoProviders() {
    try {
        const res: any = await getSsoProviders();
        ssoProviders.value = res.ssoProviders || [];
    } catch (e) {
        ssoProviders.value = [];
    }
}
```

在 return 中暴露 `authMethods`、`ssoProviders`、`loadAuthMethods`、`loadSsoProviders`。

- [ ] **Step 2: Commit**

```bash
git add src/stores/tenant.ts
git commit -m "feat(vshop): add authMethods and ssoProviders to tenant store"
```

---

### Task 18: 改造登录页

**Files:**
- Modify: `e:\code\vshop\src\pages\login\index.vue`

- [ ] **Step 1: 改造登录页为动态渲染**

在 `<script setup>` 中增加:
```ts
import { useTenantStore } from '../../stores/tenant';
import { ssoLogin } from '../../api/mutations/auth';

const tenantStore = useTenantStore();
const authMethods = computed(() => tenantStore.authMethods);
const ssoProviders = computed(() => tenantStore.ssoProviders);

// SSO 登录
function loginWithSso(provider: any) {
    const redirectUri = `${window.location.origin}/pages/login/index`;
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem('sso_state', state);
    sessionStorage.setItem('sso_provider', provider.providerKey);

    let authorizeUrl: string;
    let params: Record<string, string>;

    if (provider.protocol === 'zhao-sso') {
        authorizeUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/auth/authorize`;
        params = {
            app_code: provider.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
        };
        if (provider.channelCode) params.channel_code = provider.channelCode;
    } else {
        authorizeUrl = provider.authorizeUrl;
        params = {
            client_id: provider.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: (provider.scopes || []).join(' '),
            state,
        };
    }

    const query = new URLSearchParams(params).toString();
    window.location.href = `${authorizeUrl}?${query}`;
}

// 处理 SSO 回调
async function handleSsoCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const providerKey = sessionStorage.getItem('sso_provider');
    if (code && providerKey) {
        try {
            const res: any = await ssoLogin(providerKey, code);
            if (res.authenticate?.id) {
                // 登录成功
                sessionStorage.removeItem('sso_provider');
                uni.switchTab({ url: '/pages/index/index' });
            }
        } catch (e) { console.error(e); }
    }
}
```

在 `onMounted` 开头增加:
```ts
await tenantStore.loadAuthMethods();
await tenantStore.loadSsoProviders();
await handleSsoCallback();
```

在 template 中用 `v-if="authMethods.includes('wechat')"` 等替换静态条件编译。

- [ ] **Step 2: Commit**

```bash
git add src/pages/login/index.vue
git commit -m "feat(vshop): dynamic login method rendering based on tenant authMethods"
```

---

## Phase 7: Dashboard 配置 UI

### Task 19: 创建 AuthConfigInput React 组件

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\auth-config-widget.tsx`
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx`

- [ ] **Step 1: 创建 AuthConfigInput 组件**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\auth-config-widget.tsx
import React, { useState, useEffect } from 'react';

interface AuthConfigData {
    enabledMethods: string[];
    overrides?: any;
    ssoProviders?: any[];
}

interface AuthConfigInputProps {
    value?: AuthConfigData | null;
    onChange: (value: AuthConfigData | null) => void;
    disabled?: boolean;
}

const ALL_METHODS = [
    { key: 'native', label: '账号密码' },
    { key: 'phone', label: '手机号' },
    { key: 'wechat', label: '微信' },
    { key: 'alipay', label: '支付宝' },
    { key: 'douyin', label: '抖音' },
    { key: 'sso', label: 'SSO' },
];

export function AuthConfigInput({ value, onChange, disabled }: AuthConfigInputProps) {
    const [config, setConfig] = useState<AuthConfigData>(value || { enabledMethods: [], ssoProviders: [] });

    useEffect(() => { setConfig(value || { enabledMethods: [], ssoProviders: [] }); }, [value]);

    const updateConfig = (newConfig: AuthConfigData) => {
        setConfig(newConfig);
        onChange(newConfig);
    };

    const toggleMethod = (method: string) => {
        const methods = config.enabledMethods || [];
        const newMethods = methods.includes(method)
            ? methods.filter(m => m !== method)
            : [...methods, method];
        updateConfig({ ...config, enabledMethods: newMethods });
    };

    const updateOverride = (method: string, field: string, val: string) => {
        const overrides = { ...(config.overrides || {}) };
        overrides[method] = { ...(overrides[method] || {}), [field]: val };
        updateConfig({ ...config, overrides });
    };

    const addSsoProvider = () => {
        const providers = [...(config.ssoProviders || [])];
        providers.push({
            name: '', providerKey: '', protocol: 'zhao-sso',
            baseUrl: '', clientId: '', clientSecret: '', scopes: [],
        });
        updateConfig({ ...config, ssoProviders: providers });
    };

    const updateSsoProvider = (index: number, field: string, val: any) => {
        const providers = [...(config.ssoProviders || [])];
        providers[index] = { ...providers[index], [field]: val };
        updateConfig({ ...config, ssoProviders: providers });
    };

    const removeSsoProvider = (index: number) => {
        const providers = (config.ssoProviders || []).filter((_, i) => i !== index);
        updateConfig({ ...config, ssoProviders: providers });
    };

    return (
        <div style={{ padding: '16px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <h3>登录方式配置</h3>
            <div>
                <label>启用的登录方式：</label>
                {ALL_METHODS.map(m => (
                    <label key={m.key} style={{ marginRight: '12px' }}>
                        <input
                            type="checkbox"
                            checked={config.enabledMethods?.includes(m.key) || false}
                            onChange={() => toggleMethod(m.key)}
                            disabled={disabled}
                        /> {m.label} ({m.key})
                    </label>
                ))}
            </div>

            {/* 微信凭证覆盖 */}
            {config.enabledMethods?.includes('wechat') && (
                <details style={{ marginTop: '12px' }}>
                    <summary>微信凭证覆盖</summary>
                    <div style={{ padding: '8px' }}>
                        <input placeholder="appId" value={config.overrides?.wechat?.appId || ''}
                            onChange={e => updateOverride('wechat', 'appId', e.target.value)} disabled={disabled} />
                        <input placeholder="appSecret (*** 保留原值)" value={config.overrides?.wechat?.appSecret || ''}
                            onChange={e => updateOverride('wechat', 'appSecret', e.target.value)} disabled={disabled} />
                        <input placeholder="小程序appId" value={config.overrides?.wechat?.miniProgramAppId || ''}
                            onChange={e => updateOverride('wechat', 'miniProgramAppId', e.target.value)} disabled={disabled} />
                        <input placeholder="公众号Token" value={config.overrides?.wechat?.token || ''}
                            onChange={e => updateOverride('wechat', 'token', e.target.value)} disabled={disabled} />
                        <input placeholder="EncodingAESKey (*** 保留原值)" value={config.overrides?.wechat?.encodingAESKey || ''}
                            onChange={e => updateOverride('wechat', 'encodingAESKey', e.target.value)} disabled={disabled} />
                    </div>
                </details>
            )}

            {/* SSO Providers */}
            {config.enabledMethods?.includes('sso') && (
                <div style={{ marginTop: '12px' }}>
                    <h4>SSO Providers</h4>
                    {config.ssoProviders?.map((p, i) => (
                        <div key={i} style={{ padding: '8px', border: '1px solid #ccc', marginBottom: '8px' }}>
                            <input placeholder="显示名" value={p.name} onChange={e => updateSsoProvider(i, 'name', e.target.value)} />
                            <input placeholder="标识" value={p.providerKey} onChange={e => updateSsoProvider(i, 'providerKey', e.target.value)} />
                            <select value={p.protocol} onChange={e => updateSsoProvider(i, 'protocol', e.target.value)}>
                                <option value="zhao-sso">zhao-sso</option>
                                <option value="oauth2">oauth2</option>
                            </select>
                            <input placeholder="BaseUrl" value={p.baseUrl} onChange={e => updateSsoProvider(i, 'baseUrl', e.target.value)} />
                            <input placeholder="clientId/appCode" value={p.clientId} onChange={e => updateSsoProvider(i, 'clientId', e.target.value)} />
                            <input placeholder="clientSecret/appSecret (*** 保留原值)" value={p.clientSecret} onChange={e => updateSsoProvider(i, 'clientSecret', e.target.value)} />
                            {p.protocol === 'zhao-sso' && (
                                <input placeholder="channelCode" value={p.channelCode || ''} onChange={e => updateSsoProvider(i, 'channelCode', e.target.value)} />
                            )}
                            <button onClick={() => removeSsoProvider(i)}>删除</button>
                        </div>
                    ))}
                    <button onClick={addSsoProvider}>+ 添加 SSO Provider</button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: 修改 channel-detail-forms.tsx**

```tsx
// e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';
import { AuthConfigInput } from './auth-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
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
                blockId: 'custom-fields',
                field: 'authConfig',
                component: AuthConfigInput,
            },
        ],
    },
];
```

- [ ] **Step 3: Commit**

```bash
git add packages/cjk-plugin/dashboard/auth-config-widget.tsx packages/cjk-plugin/dashboard/channel-detail-forms.tsx
git commit -m "feat(cjk-plugin): add AuthConfigInput dashboard widget for channel auth config"
```

---

## Phase 8: 端到端验证

### Task 20: 编译验证

- [ ] **Step 1: 编译 cjk-plugin**

Run: `cd e:\code\vendure\packages\cjk-plugin; npm run build`
Expected: 编译成功，无错误

- [ ] **Step 2: 验证导出**

Run: `cd e:\code\vendure\packages\cjk-plugin; node -e "const m = require('./lib/index'); console.log(Object.keys(m).filter(k => k.toLowerCase().includes('auth')))"` 
Expected: 包含 auth 相关导出

- [ ] **Step 3: tsc 检查 dev-server**

Run: `cd e:\code\vendure\packages\dev-server; npx tsc --noEmit --skipLibCheck`
Expected: 无新增错误

---

### Task 21: 启动验证

- [ ] **Step 1: 启动后端**

Run: `cd e:\code\vendure\packages\dev-server; npm run dev`
Expected: 服务器启动，日志中无 auth 相关错误

- [ ] **Step 2: 启动前端**

Run: `cd e:\code\vshop; npm run dev`
Expected: Vite 启动成功

- [ ] **Step 3: 测试 shop-a 登录页**

访问 `http://localhost:5180/?tenant=shop-a#/pages/login/index`
Expected: 仅显示 native/phone/wechat/SSO 登录按钮（不显示 alipay/douyin）

- [ ] **Step 4: 测试 default 登录页**

访问 `http://localhost:5180/#/pages/login/index`
Expected: 显示全部 5 种登录方式

- [ ] **Step 5: 测试管理后台**

访问 Dashboard channel-detail 页面
Expected: 自定义配置区块可编辑 authConfig

---

## 自审清单

**Spec 覆盖检查**:
- [x] per-Channel 登录方式开关 → Task 3, 4, 5, 6, 7
- [x] 租户凭证覆盖（混合模式）→ Task 5, 6, 7
- [x] 微信公众号 token + EncodingAESKey → Task 6
- [x] SSO 双协议（zhao-sso + oauth2）→ Task 8
- [x] 管理后台配置 UI → Task 19
- [x] 前端动态渲染 → Task 16, 17, 18
- [x] 4 语 i18n → Task 9
- [x] 凭证加密 → Task 2
- [x] dev-server 测试数据 → Task 13, 14, 15

**已知需完善**:
- Task 8 中 `findOrCreateUser` 需在 Task 12 plugin.ts 中用工厂函数注入 UserService/CustomerService 完成完整实现
- Task 19 的 Dashboard widget 需实际运行验证 `blockId: 'custom-fields'` 是否正确（可能需要调整为实际 blockId）
