# 认证体系增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善认证体系：WeChat devBypass、用户注册、支付宝登录、抖音登录、环境侦测

**Architecture:** 独立插件模式（方案 A），复用 WechatAuthPlugin 设计模式。AlipayAuthPlugin 合并到 alipay-plugin 包复用 alipay-sdk。注册功能放在 PhoneAuthPlugin 内。

**Tech Stack:** Vendure v3.6.4 / NestJS / TypeScript / uni-app (Vue3 + Vite) / alipay-sdk

**Spec:** `docs/superpowers/specs/2026-07-14-auth-enhancement-design.md`

---

## Phase 1：完善 WechatAuthPlugin devBypass

### Task 1: WechatAuthStrategy 增加 devBypass 分支

**Files:**
- Modify: `packages/wechat-auth-plugin/src/types.ts`
- Modify: `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 扩展 WechatAuthPluginOptions 类型**

文件 `packages/wechat-auth-plugin/src/types.ts`，在接口中增加两个字段：

```typescript
export interface WechatAuthPluginOptions {
    appId: string;
    appSecret: string;
    miniProgramAppId?: string;
    miniProgramAppSecret?: string;
    devBypass?: boolean;        // 新增
    devBypassOpenid?: string;   // 新增，默认 'dev_test_openid'
}
```

- [ ] **Step 2: 在 authenticate 方法开头增加 devBypass 分支**

文件 `packages/wechat-auth-plugin/src/wechat-auth-strategy.ts`，在 `authenticate` 方法最开头（原有逻辑之前）插入：

```typescript
async authenticate(ctx: RequestContext, data: { code: string; type: 'mp' | 'mini' }): Promise<User | false | string> {
    // devBypass 分支：跳过微信 API，使用固定测试 openid
    if (this.options.devBypass) {
        const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
        const identifier = `wechat_${data.type}_${testOpenid}`;
        const user = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (user) return user;
        // 创建新用户
        const newUser = await this.userService.createCustomerUser(ctx, identifier);
        return newUser;
    }
    // === 原有逻辑保持不变 ===
    // ...existing code...
}
```

- [ ] **Step 3: 更新 dev-config.ts 传入 devBypass 配置**

文件 `packages/dev-server/dev-config.ts`，修改 WechatAuthPlugin.init 调用（约第 269-274 行）：

```typescript
...((process.env.WECHAT_AUTH_APP_ID || process.env.DEV_BYPASS_WECHAT === 'true') ? [WechatAuthPlugin.init({
    appId: process.env.WECHAT_AUTH_APP_ID || 'dev_test_app_id',
    appSecret: process.env.WECHAT_AUTH_APP_SECRET || 'dev_test_app_secret',
    miniProgramAppId: process.env.WECHAT_AUTH_MINI_APP_ID || '',
    miniProgramAppSecret: process.env.WECHAT_AUTH_MINI_APP_SECRET || '',
    devBypass: process.env.DEV_BYPASS_WECHAT === 'true',
    devBypassOpenid: 'dev_test_openid',
})] : []),
```

- [ ] **Step 4: 构建并验证**

```bash
cd e:\code\vendure\packages\wechat-auth-plugin && npm run build
```

启动 dev server，用 GraphQL playground 执行：

```graphql
mutation {
    authenticate(input: { wechat: { code: "test", type: "mp" } }) {
        ... on CurrentUser { identifier }
        ... on InvalidCredentialsError { message }
    }
}
```

预期：返回 `identifier: "wechat_mp_dev_test_openid"`

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure && git add packages/wechat-auth-plugin/src/types.ts packages/wechat-auth-plugin/src/wechat-auth-strategy.ts packages/dev-server/dev-config.ts && git commit -m "feat(wechat-auth): Add devBypass support for local testing"
```

---

## Phase 2：用户注册功能

### Task 2: 后端 registerCustomer mutation

**Files:**
- Modify: `packages/phone-auth-plugin/src/auth.resolver.ts`
- Modify: `packages/phone-auth-plugin/src/types.ts`

- [ ] **Step 1: 定义 RegisterCustomerInput 类型**

文件 `packages/phone-auth-plugin/src/types.ts`，新增：

```typescript
export interface RegisterCustomerInput {
    phoneNumber: string;
    code: string;
    password: string;
    emailAddress?: string;
}
```

- [ ] **Step 2: 在 PhoneAuthResolver 新增 registerCustomer mutation**

文件 `packages/phone-auth-plugin/src/auth.resolver.ts`，在类中新增方法。需注入 UserService 和 CustomerService：

```typescript
import { Allow, UserService, CustomerService } from '@vendure/core';
import { Permission } from '@vendure/common/lib/generated-types';
import { InvalidCredentialsError, PasswordValidationError } from '@vendure/common/lib/generated-types';

// 构造函数增加注入
constructor(
    @Inject(PHONE_AUTH_PLUGIN_OPTIONS) private options: PhoneAuthPluginOptions,
    private smsService: SmsService,
    private userService: UserService,
    private customerService: CustomerService,
) {}

@Mutation()
@Allow(Permission.Public)
async registerCustomer(
    @Ctx() ctx: RequestContext,
    @Args() args: { input: RegisterCustomerInput },
): Promise<Result> {
    // 1. 校验验证码
    const verified = this.smsService.verifyCode(args.input.phoneNumber, args.input.code);
    if (!verified) {
        return new InvalidCredentialsError({ authenticationError: '验证码错误或已过期' });
    }

    // 2. 检查手机号是否已注册
    const existing = await this.userService.getUserByEmailAddress(ctx, args.input.phoneNumber);
    if (existing) {
        // 防账户枚举：不暴露用户存在
        return { success: true };
    }

    // 3. 创建 User（3 参数：ctx, identifier, password）
    const user = await this.userService.createCustomerUser(
        ctx,
        args.input.phoneNumber,
        args.input.password,
    );
    if (user instanceof PasswordValidationError) {
        return user;
    }

    // 4. 创建 Customer 并关联 User
    const customer = await this.customerService.create(ctx, {
        emailAddress: args.input.emailAddress || `${args.input.phoneNumber}@phone.local`,
        phoneNumber: args.input.phoneNumber,
    });

    return { success: true };
}
```

在 PhoneAuthResolver 的 shopApiExtensions schema 中增加（如果 resolver 用 gql 模板）：

```graphql
input RegisterCustomerInput {
    phoneNumber: String!
    code: String!
    password: String!
    emailAddress: String
}

type RegisterSuccess implements Result {
    success: Boolean!
}

union RegisterResult = RegisterSuccess | InvalidCredentialsError | PasswordValidationError

extend type Mutation {
    registerCustomer(input: RegisterCustomerInput!): RegisterResult!
}
```

- [ ] **Step 3: 确保 PhoneAuthModule 提供 UserService 和 CustomerService**

检查 `packages/phone-auth-plugin/src/plugin.ts`，确认 imports 包含 PluginCommonModule（已包含 UserService 和 CustomerService 的 provider）。

- [ ] **Step 4: 构建并验证**

```bash
cd e:\code\vendure\packages\phone-auth-plugin && npm run build
```

启动 dev server，先发送验证码：

```graphql
mutation { sendPhoneVerificationCode(phoneNumber: "13800139999") { success } }
```

再注册：

```graphql
mutation {
    registerCustomer(input: {
        phoneNumber: "13800139999"
        code: "123456"
        password: "test123"
    }) {
        ... on RegisterSuccess { success }
        ... on InvalidCredentialsError { message }
        ... on PasswordValidationError { message }
    }
}
```

预期：返回 `success: true`

验证登录：

```graphql
mutation {
    authenticate(input: { native: { username: "13800139999", password: "test123" } }) {
        ... on CurrentUser { identifier }
        ... on InvalidCredentialsError { message }
    }
}
```

预期：返回 `identifier: "13800139999"`

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure && git add packages/phone-auth-plugin/src/ && git commit -m "feat(phone-auth): Add registerCustomer mutation"
```

### Task 3: 前端注册页面

**Files:**
- Create: `vshop/src/pages/register/index.vue`
- Modify: `vshop/src/pages.json`
- Modify: `vshop/src/api/mutations/auth.ts`

- [ ] **Step 1: 新增 registerCustomer API 调用**

文件 `vshop/src/api/mutations/auth.ts`，新增：

```typescript
export async function registerCustomer(input: {
    phoneNumber: string;
    code: string;
    password: string;
    emailAddress?: string;
}) {
    const client = getGraphQLClient();
    const mutation = `
        mutation Register($input: RegisterCustomerInput!) {
            registerCustomer(input: $input) {
                ... on RegisterSuccess { success }
                ... on InvalidCredentialsError { errorCode message }
                ... on PasswordValidationError { errorCode message }
            }
        }
    `;
    return client.request(mutation, { input });
}
```

- [ ] **Step 2: 创建注册页面**

文件 `vshop/src/pages/register/index.vue`：

```vue
<template>
    <view class="register-page">
        <view class="form-group">
            <input v-model="form.phoneNumber" type="number" placeholder="请输入手机号" maxlength="11" />
        </view>
        <view class="form-group code-group">
            <input v-model="form.code" type="number" placeholder="验证码" maxlength="6" />
            <button :disabled="countdown > 0" @click="sendCode" class="code-btn">
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </button>
        </view>
        <view class="form-group">
            <input v-model="form.password" type="password" placeholder="设置密码（6-20位）" />
        </view>
        <button :disabled="loading" @click="handleRegister" class="register-btn">
            {{ loading ? '注册中...' : '注册' }}
        </button>
        <view class="login-link" @click="goLogin">已有账号？去登录</view>
    </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { sendPhoneVerificationCode, registerCustomer } from '@/api/mutations/auth';

const form = reactive({
    phoneNumber: '',
    code: '',
    password: '',
});
const countdown = ref(0);
const loading = ref(false);

async function sendCode() {
    if (!/^1\d{10}$/.test(form.phoneNumber)) {
        uni.showToast({ title: '手机号格式错误', icon: 'none' });
        return;
    }
    try {
        await sendPhoneVerificationCode(form.phoneNumber);
        uni.showToast({ title: '验证码已发送', icon: 'success' });
        countdown.value = 60;
        const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) clearInterval(timer);
        }, 1000);
    } catch (e) {
        uni.showToast({ title: '发送失败', icon: 'none' });
    }
}

async function handleRegister() {
    if (!form.phoneNumber || !form.code || !form.password) {
        uni.showToast({ title: '请填写完整信息', icon: 'none' });
        return;
    }
    if (form.password.length < 6 || form.password.length > 20) {
        uni.showToast({ title: '密码长度6-20位', icon: 'none' });
        return;
    }
    loading.value = true;
    try {
        const result = await registerCustomer({
            phoneNumber: form.phoneNumber,
            code: form.code,
            password: form.password,
        });
        if (result?.registerCustomer?.success) {
            uni.showToast({ title: '注册成功', icon: 'success' });
            setTimeout(() => goLogin(), 1500);
        } else {
            uni.showToast({ title: result?.registerCustomer?.message || '注册失败', icon: 'none' });
        }
    } catch (e) {
        uni.showToast({ title: '注册失败', icon: 'none' });
    } finally {
        loading.value = false;
    }
}

function goLogin() {
    uni.redirectTo({ url: '/pages/login/index' });
}
</script>

<style scoped>
.register-page { padding: 40rpx; }
.form-group { margin-bottom: 30rpx; }
.form-group input { border: 1px solid #ddd; border-radius: 8rpx; padding: 20rpx; width: 100%; }
.code-group { display: flex; align-items: center; }
.code-group input { flex: 1; }
.code-btn { margin-left: 20rpx; white-space: nowrap; font-size: 24rpx; padding: 0 20rpx; height: 80rpx; line-height: 80rpx; }
.register-btn { background: #007aff; color: #fff; border-radius: 8rpx; margin-top: 40rpx; }
.login-link { text-align: center; margin-top: 30rpx; color: #007aff; font-size: 28rpx; }
</style>
```

- [ ] **Step 3: 在 pages.json 注册路由**

文件 `vshop/src/pages.json`，在 pages 数组中新增：

```json
{
    "path": "pages/register/index",
    "style": { "navigationBarTitleText": "注册" }
}
```

- [ ] **Step 4: 验证**

访问 `http://localhost:5180/#/pages/register/index`，输入手机号、获取验证码（控制台查看或用 123456）、设置密码、点击注册。

- [ ] **Step 5: 提交**

```bash
cd e:\code\vshop && git add src/pages/register/index.vue src/pages.json src/api/mutations/auth.ts && git commit -m "feat(vshop): Add register page with phone+code+password"
```

---

## Phase 3：AlipayAuthPlugin（合并到 alipay-plugin）

### Task 4: AlipayAuthStrategy 认证策略

**Files:**
- Modify: `packages/alipay-plugin/src/types.ts`
- Create: `packages/alipay-plugin/src/alipay-auth-strategy.ts`
- Create: `packages/alipay-plugin/src/alipay-auth.service.ts`
- Create: `packages/alipay-plugin/src/customer-custom-fields.ts`

- [ ] **Step 1: 扩展 AlipayPluginOptions 增加认证配置**

文件 `packages/alipay-plugin/src/types.ts`：

```typescript
export interface AlipayPluginOptions {
    // 已有：支付配置
    notifyUrl: string;
    alipayPublicKey: string;
    // 新增：认证配置
    auth?: {
        appId?: string;
        privateKey?: string;
        miniProgramAppId?: string;
        devBypass?: boolean;
        devBypassOpenid?: string;
    };
}
```

- [ ] **Step 2: 创建 customer-custom-fields.ts**

文件 `packages/alipay-plugin/src/customer-custom-fields.ts`：

```typescript
import { CustomFields } from '@vendure/core';

export const alipayCustomerCustomFields: CustomFields = {
    Customer: [
        { name: 'alipayOpenid', type: 'string', nullable: true, public: true },
    ],
};
```

- [ ] **Step 3: 创建 alipay-auth.service.ts**

文件 `packages/alipay-plugin/src/alipay-auth.service.ts`：

```typescript
import { Injectable } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { AlipayPluginOptions } from './types';

@Injectable()
export class AlipayAuthService {
    private sdk: AlipaySdk | null = null;

    constructor(private options: AlipayPluginOptions) {}

    private getSdk(): AlipaySdk {
        if (!this.sdk) {
            const authConfig = this.options.auth || {};
            this.sdk = new AlipaySdk({
                appId: authConfig.appId || '',
                privateKey: authConfig.privateKey || '',
                signType: 'RSA2',
                alipayPublicKey: this.options.alipayPublicKey,
            });
        }
        return this.sdk;
    }

    /**
     * 用 authCode 换取支付宝用户 openid（user_id）
     */
    async getOpenidByAuthCode(authCode: string): Promise<string> {
        const sdk = this.getSdk();
        const result = await sdk.exec('alipay.system.oauth.auth', {
            grantType: 'authorization_code',
            code: authCode,
        });
        return result.userId || result.openId;
    }
}
```

- [ ] **Step 4: 创建 alipay-auth-strategy.ts**

文件 `packages/alipay-plugin/src/alipay-auth-strategy.ts`：

```typescript
import { Injector, RequestContext, User, UserService, AuthenticationStrategy, ID } from '@vendure/core';
import { gql } from 'graphql-tag';
import { AlipayAuthService } from './alipay-auth.service';
import { AlipayPluginOptions } from './types';

export interface AlipayAuthData {
    authCode: string;
    type: 'h5' | 'mini';
}

export class AlipayAuthenticationStrategy implements AuthenticationStrategy<AlipayAuthData> {
    readonly name = 'alipay';
    private userService: UserService;
    private alipayAuthService: AlipayAuthService;

    constructor(private options: AlipayPluginOptions) {}

    init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.alipayAuthService = new AlipayAuthService(this.options);
    }

    defineInputType() {
        return gql`
            input AlipayAuthInput {
                authCode: String!
                type: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: AlipayAuthData): Promise<User | false | string> {
        const authConfig = this.options.auth || {};

        // devBypass 分支
        if (authConfig.devBypass) {
            const testOpenid = authConfig.devBypassOpenid || 'dev_test_openid';
            const identifier = `alipay_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }

        // 真实分支：调用支付宝 API 换 openid
        try {
            const openid = await this.alipayAuthService.getOpenidByAuthCode(data.authCode);
            const identifier = `alipay_${data.type}_${openid}`;
            return this.findOrCreateUser(ctx, identifier);
        } catch (e) {
            return false;
        }
    }

    private async findOrCreateUser(ctx: RequestContext, identifier: string): Promise<User | false> {
        const existing = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (existing) return existing;
        const newUser = await this.userService.createCustomerUser(ctx, identifier);
        return newUser instanceof Object ? newUser : false;
    }
}
```

- [ ] **Step 5: 提交**

```bash
cd e:\code\vendure && git add packages/alipay-plugin/src/ && git commit -m "feat(alipay-plugin): Add AlipayAuthStrategy with devBypass support"
```

### Task 5: AlipayPlugin 注册认证策略

**Files:**
- Modify: `packages/alipay-plugin/src/plugin.ts`
- Create: `packages/alipay-plugin/src/alipay-auth-shop.resolver.ts`
- Create: `packages/alipay-plugin/src/alipay-auth.controller.ts`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 创建 shop resolver（空壳，仅注册 schema）**

文件 `packages/alipay-plugin/src/alipay-auth-shop.resolver.ts`：

```typescript
import { Resolver } from '@nestjs/graphql';

@Resolver()
export class AlipayAuthShopResolver {}
```

- [ ] **Step 2: 创建 H5 OAuth 回调 controller**

文件 `packages/alipay-plugin/src/alipay-auth.controller.ts`：

```typescript
import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('alipay-auth')
export class AlipayAuthController {
    @Get('callback')
    async callback(@Req() req: Request, @Res() res: Response) {
        const authCode = req.query.auth_code as string;
        const redirectUrl = `/?alipay_auth_code=${authCode}`;
        res.redirect(redirectUrl);
    }
}
```

- [ ] **Step 3: 修改 plugin.ts 注册认证策略和 customFields**

文件 `packages/alipay-plugin/src/plugin.ts`，在 @VendurePlugin 装饰器中增加：

```typescript
import { AlipayAuthenticationStrategy } from './alipay-auth-strategy';
import { AlipayAuthController } from './alipay-auth.controller';
import { AlipayAuthShopResolver } from './alipay-auth-shop.resolver';
import { alipayCustomerCustomFields } from './customer-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [..., AlipayAuthController],  // 新增
    providers: [...],
    configuration: config => {
        // 已有：支付 handler 注册
        // ...

        // 新增：注册认证策略
        if (AlipayPlugin.options.auth) {
            const strategy = new AlipayAuthenticationStrategy(AlipayPlugin.options);
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                strategy,
            ];
        }

        // 新增：注册 Customer customFields
        config.customFields = {
            ...config.customFields,
            Customer: [
                ...(config.customFields?.Customer || []),
                ...(alipayCustomerCustomFields.Customer ?? []),
            ],
        };

        return config;
    },
    shopApiExtensions: {
        schema: () => gql`
            ${alipayAuthInputSchema}
        `,
        resolvers: [..., AlipayAuthShopResolver],
    },
    // ...
})
```

- [ ] **Step 4: 更新 dev-config.ts 注册认证配置**

文件 `packages/dev-server/dev-config.ts`，修改 AlipayPlugin.init 调用（约第 248-251 行）：

```typescript
...(process.env.ALIPAY_NOTIFY_URL ? [AlipayPlugin.init({
    notifyUrl: process.env.ALIPAY_NOTIFY_URL,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
    auth: process.env.DEV_BYPASS_ALIPAY === 'true' ? {
        devBypass: true,
        devBypassOpenid: 'dev_test_openid',
    } : undefined,
})] : []),
```

- [ ] **Step 5: 构建并验证**

```bash
cd e:\code\vendure\packages\alipay-plugin && npm run build
```

GraphQL 验证：

```graphql
mutation {
    authenticate(input: { alipay: { authCode: "test", type: "h5" } }) {
        ... on CurrentUser { identifier }
        ... on InvalidCredentialsError { message }
    }
}
```

预期：返回 `identifier: "alipay_h5_dev_test_openid"`

- [ ] **Step 6: 提交**

```bash
cd e:\code\vendure && git add packages/alipay-plugin/src/ packages/dev-server/dev-config.ts && git commit -m "feat(alipay-plugin): Register AlipayAuthStrategy in plugin"
```

---

## Phase 4：DouyinAuthPlugin

### Task 6: DouyinAuthPlugin 完整插件

**Files:**
- Create: `packages/douyin-auth-plugin/src/plugin.ts`
- Create: `packages/douyin-auth-plugin/src/douyin-auth-strategy.ts`
- Create: `packages/douyin-auth-plugin/src/douyin-auth.service.ts`
- Create: `packages/douyin-auth-plugin/src/douyin-auth.controller.ts`
- Create: `packages/douyin-auth-plugin/src/douyin-auth-shop.resolver.ts`
- Create: `packages/douyin-auth-plugin/src/customer-custom-fields.ts`
- Create: `packages/douyin-auth-plugin/src/types.ts`
- Modify: `packages/dev-server/dev-config.ts`

- [ ] **Step 1: 创建 types.ts**

文件 `packages/douyin-auth-plugin/src/types.ts`：

```typescript
export interface DouyinAuthPluginOptions {
    appId: string;
    appSecret: string;
    miniProgramAppId?: string;
    miniProgramAppSecret?: string;
    devBypass?: boolean;
    devBypassOpenid?: string;
}
```

- [ ] **Step 2: 创建 customer-custom-fields.ts**

```typescript
import { CustomFields } from '@vendure/core';

export const douyinCustomerCustomFields: CustomFields = {
    Customer: [
        { name: 'douyinOpenid', type: 'string', nullable: true, public: true },
    ],
};
```

- [ ] **Step 3: 创建 douyin-auth.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DouyinAuthPluginOptions } from './types';

@Injectable()
export class DouyinAuthService {
    constructor(private options: DouyinAuthPluginOptions) {}

    /**
     * 小程序：用 code 换 openid
     * 文档：https://developer.toutiao.com/api/apps/v2/jscode2session
     */
    async getOpenidByCode(code: string): Promise<string> {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid: appId, secret, code }),
        });
        const data = await response.json();
        return data.openid;
    }
}
```

- [ ] **Step 4: 创建 douyin-auth-strategy.ts**

```typescript
import { Injector, RequestContext, User, UserService, AuthenticationStrategy } from '@vendure/core';
import { gql } from 'graphql-tag';
import { DouyinAuthService } from './douyin-auth.service';
import { DouyinAuthPluginOptions } from './types';

export interface DouyinAuthData {
    code: string;
    type: 'h5' | 'mini';
}

export class DouyinAuthenticationStrategy implements AuthenticationStrategy<DouyinAuthData> {
    readonly name = 'douyin';
    private userService: UserService;
    private douyinAuthService: DouyinAuthService;

    constructor(private options: DouyinAuthPluginOptions) {}

    init(injector: Injector) {
        this.userService = injector.get(UserService);
        this.douyinAuthService = new DouyinAuthService(this.options);
    }

    defineInputType() {
        return gql`
            input DouyinAuthInput {
                code: String!
                type: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: DouyinAuthData): Promise<User | false | string> {
        // devBypass 分支
        if (this.options.devBypass) {
            const testOpenid = this.options.devBypassOpenid || 'dev_test_openid';
            const identifier = `douyin_${data.type}_${testOpenid}`;
            return this.findOrCreateUser(ctx, identifier);
        }

        // 真实分支
        try {
            const openid = await this.douyinAuthService.getOpenidByCode(data.code);
            const identifier = `douyin_${data.type}_${openid}`;
            return this.findOrCreateUser(ctx, identifier);
        } catch (e) {
            return false;
        }
    }

    private async findOrCreateUser(ctx: RequestContext, identifier: string): Promise<User | false> {
        const existing = await this.userService.getUserByEmailAddress(ctx, identifier);
        if (existing) return existing;
        const newUser = await this.userService.createCustomerUser(ctx, identifier);
        return newUser instanceof Object ? newUser : false;
    }
}
```

- [ ] **Step 5: 创建 controller 和 shop resolver**

`packages/douyin-auth-plugin/src/douyin-auth.controller.ts`：

```typescript
import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('douyin-auth')
export class DouyinAuthController {
    @Get('callback')
    async callback(@Req() req: Request, @Res() res: Response) {
        const code = req.query.code as string;
        res.redirect(`/?douyin_code=${code}`);
    }
}
```

`packages/douyin-auth-plugin/src/douyin-auth-shop.resolver.ts`：

```typescript
import { Resolver } from '@nestjs/graphql';

@Resolver()
export class DouyinAuthShopResolver {}
```

- [ ] **Step 6: 创建 plugin.ts**

```typescript
import { Type } from '@nestjs/common';
import {
    VendurePlugin,
    PluginCommonModule,
    CustomFields,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { DouyinAuthPluginOptions } from './types';
import { DouyinAuthenticationStrategy } from './douyin-auth-strategy';
import { DouyinAuthController } from './douyin-auth.controller';
import { DouyinAuthShopResolver } from './douyin-auth-shop.resolver';
import { douyinCustomerCustomFields } from './customer-custom-fields';

@VendurePlugin({
    imports: [PluginCommonModule],
    controllers: [DouyinAuthController],
    providers: [],
    configuration: config => {
        if (DouyinAuthPlugin.options) {
            const strategy = new DouyinAuthenticationStrategy(DouyinAuthPlugin.options);
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                strategy,
            ];
            config.customFields = {
                ...config.customFields,
                Customer: [
                    ...(config.customFields?.Customer || []),
                    ...(douyinCustomerCustomFields.Customer ?? []),
                ],
            };
        }
        return config;
    },
    shopApiExtensions: {
        schema: () => gql`
            input DouyinAuthInput {
                code: String!
                type: String!
            }
        `,
        resolvers: [DouyinAuthShopResolver],
    },
    compatibility: '^3.0.0',
})
export class DouyinAuthPlugin {
    static options: DouyinAuthPluginOptions;
    constructor() {}
    static init(options: DouyinAuthPluginOptions): Type<DouyinAuthPlugin> {
        DouyinAuthPlugin.options = options;
        return DouyinAuthPlugin;
    }
}
```

- [ ] **Step 7: 在 dev-config.ts 注册**

```typescript
import { DouyinAuthPlugin } from '@vendure/douyin-auth-plugin';

// 在 plugins 数组中新增
...((process.env.DOUYIN_AUTH_APP_ID || process.env.DEV_BYPASS_DOUYIN === 'true') ? [DouyinAuthPlugin.init({
    appId: process.env.DOUYIN_AUTH_APP_ID || 'dev_test_app_id',
    appSecret: process.env.DOUYIN_AUTH_APP_SECRET || 'dev_test_app_secret',
    devBypass: process.env.DEV_BYPASS_DOUYIN === 'true',
    devBypassOpenid: 'dev_test_openid',
})] : []),
```

- [ ] **Step 8: 构建并验证**

```bash
cd e:\code\vendure\packages\douyin-auth-plugin && npm run build
```

GraphQL 验证：

```graphql
mutation {
    authenticate(input: { douyin: { code: "test", type: "mini" } }) {
        ... on CurrentUser { identifier }
        ... on InvalidCredentialsError { message }
    }
}
```

预期：返回 `identifier: "douyin_mini_dev_test_openid"`

- [ ] **Step 9: 提交**

```bash
cd e:\code\vendure && git add packages/douyin-auth-plugin/ packages/dev-server/dev-config.ts && git commit -m "feat(douyin-auth): Add DouyinAuthPlugin with devBypass support"
```

---

## Phase 5：环境侦测 + 智能默认登录

### Task 7: 前端环境侦测工具

**Files:**
- Create: `vshop/src/utils/detect-env.ts`
- Modify: `vshop/src/utils/platform.ts`

- [ ] **Step 1: 创建 detect-env.ts**

文件 `vshop/src/utils/detect-env.ts`：

```typescript
export type Platform = 'wechat' | 'alipay' | 'douyin' | 'browser';

export function detectPlatform(): Platform {
    // #ifdef MP-WEIXIN
    return 'wechat';
    // #endif
    // #ifdef MP-ALIPAY
    return 'alipay';
    // #endif
    // #ifdef MP-TOUTIAO
    return 'douyin';
    // #endif
    // #ifdef H5
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('micromessenger')) return 'wechat';
    if (ua.includes('alipayclient')) return 'alipay';
    if (ua.includes('newsclient') || ua.includes('bytedance')) return 'douyin';
    return 'browser';
    // #endif
    return 'browser';
}
```

- [ ] **Step 2: 扩展 platform.ts 的 PlatformType**

文件 `vshop/src/utils/platform.ts`，在 PlatformType 类型中加入 `'mp-alipay'`：

```typescript
export type PlatformType = 'mp-weixin' | 'h5' | 'app' | 'mp-alipay';
```

- [ ] **Step 3: 提交**

```bash
cd e:\code\vshop && git add src/utils/detect-env.ts src/utils/platform.ts && git commit -m "feat(vshop): Add detect-env utility for platform detection"
```

### Task 8: 登录页集成环境侦测和三方登录

**Files:**
- Modify: `vshop/src/pages/login/index.vue`
- Modify: `vshop/src/api/mutations/auth.ts`

- [ ] **Step 1: 新增支付宝和抖音 API 调用**

文件 `vshop/src/api/mutations/auth.ts`，新增：

```typescript
export async function authenticateWithAlipay(authCode: string, type: 'h5' | 'mini') {
    const client = getGraphQLClient();
    const mutation = `
        mutation Auth($authCode: String!, $type: String!) {
            authenticate(input: { alipay: { authCode: $authCode, type: $type } }) {
                ... on CurrentUser { id identifier }
                ... on InvalidCredentialsError { message }
            }
        }
    `;
    return client.request(mutation, { authCode, type });
}

export async function authenticateWithDouyin(code: string, type: 'h5' | 'mini') {
    const client = getGraphQLClient();
    const mutation = `
        mutation Auth($code: String!, $type: String!) {
            authenticate(input: { douyin: { code: $code, type: $type } }) {
                ... on CurrentUser { id identifier }
                ... on InvalidCredentialsError { message }
            }
        }
    `;
    return client.request(mutation, { code, type });
}
```

- [ ] **Step 2: 登录页增加环境侦测和三方登录按钮**

文件 `vshop/src/pages/login/index.vue`，在 `<script setup>` 中新增：

```typescript
import { detectPlatform } from '@/utils/detect-env';
import { authenticateWithAlipay, authenticateWithDouyin } from '@/api/mutations/auth';

onMounted(() => {
    const platform = detectPlatform();
    switch (platform) {
        case 'wechat':
            // 微信环境：自动静默登录
            // #ifdef H5
            loginWithWechatH5('snsapi_base');
            // #endif
            break;
        case 'alipay':
            // #ifdef H5
            loginWithAlipayH5();
            // #endif
            break;
        case 'douyin':
            // #ifdef H5
            loginWithDouyinH5();
            // #endif
            break;
        default:
            mode.value = 'select';
    }
});

async function loginWithAlipayH5() {
    const appId = import.meta.env.VITE_ALIPAY_APP_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/#/pages/login/index');
    window.location.href = `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${appId}&scope=auth_user&redirect_uri=${redirectUri}`;
}

async function loginWithDouyinH5() {
    const appId = import.meta.env.VITE_DOUYIN_APP_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/#/pages/login/index');
    window.location.href = `https://developer.toutiao.com/openapi/oauth2/auth/v2/?app_id=${appId}&response_type=code&scope=user_info&redirect_uri=${redirectUri}`;
}

// 处理支付宝/抖音回调
onMounted(() => {
    // 支付宝回调
    const alipayAuthCode = new URLSearchParams(window.location.search).get('alipay_auth_code');
    if (alipayAuthCode) {
        authenticateWithAlipay(alipayAuthCode, 'h5').then(handleAuthResult);
    }
    // 抖音回调
    const douyinCode = new URLSearchParams(window.location.search).get('douyin_code');
    if (douyinCode) {
        authenticateWithDouyin(douyinCode, 'h5').then(handleAuthResult);
    }
});

function handleAuthResult(result: any) {
    if (result?.authenticate?.id) {
        // 登录成功
        uni.switchTab({ url: '/pages/home/index' });
    } else {
        uni.showToast({ title: '登录失败', icon: 'none' });
        mode.value = 'select';
    }
}
```

- [ ] **Step 3: 登录方式选择页增加支付宝和抖音按钮**

在 template 的 `mode === 'select'` 区域新增：

```vue
<!-- #ifdef H5 || MP-WEIXIN -->
<button @click="loginWithWechat" class="third-btn wechat-btn">微信登录</button>
<!-- #endif -->
<!-- #ifdef H5 || MP-ALIPAY -->
<button @click="loginWithAlipayH5" class="third-btn alipay-btn">支付宝登录</button>
<!-- #endif -->
<!-- #ifdef H5 || MP-TOUTIAO -->
<button @click="loginWithDouyinH5" class="third-btn douyin-btn">抖音登录</button>
<!-- #endif -->
```

- [ ] **Step 4: 验证**

访问 `http://localhost:5180/?tenant=shop-a`，登录页应显示：
- 微信登录、支付宝登录、抖音登录按钮（H5 环境）
- 手机验证码登录、账号密码登录按钮
- 注册入口链接

- [ ] **Step 5: 提交**

```bash
cd e:\code\vshop && git add src/pages/login/index.vue src/api/mutations/auth.ts && git commit -m "feat(vshop): Add env detection and Alipay/Douyin login buttons"
```

### Task 9: 端到端验证

- [ ] **Step 1: devBypass 全量验证**

```bash
# 确保 .env 中
DEV_BYPASS_SMS=true
DEV_BYPASS_WECHAT=true
DEV_BYPASS_ALIPAY=true
DEV_BYPASS_DOUYIN=true
```

GraphQL 验证 4 种登录：

```graphql
# 1. 手机验证码
mutation { sendPhoneVerificationCode(phoneNumber: "13800138888") { success } }
mutation { authenticate(input: { phone: { phoneNumber: "13800138888", code: "123456" } }) { ... on CurrentUser { identifier } } }

# 2. 微信
mutation { authenticate(input: { wechat: { code: "test", type: "mp" } }) { ... on CurrentUser { identifier } } }

# 3. 支付宝
mutation { authenticate(input: { alipay: { authCode: "test", type: "h5" } }) { ... on CurrentUser { identifier } } }

# 4. 抖音
mutation { authenticate(input: { douyin: { code: "test", type: "mini" } }) { ... on CurrentUser { identifier } } }
```

预期全部返回有效 identifier。

- [ ] **Step 2: 注册功能验证**

访问 `http://localhost:5180/#/pages/register/index`：
- 输入 `13800137777` → 获取验证码 → 输入 `123456` → 密码 `test123` → 注册
- 跳转登录页 → 账号密码模式 → `13800137777` + `test123` → 登录成功

- [ ] **Step 3: 前端登录页验证**

访问 `http://localhost:5180/?tenant=shop-a`：
- 登录方式选择页显示微信、支付宝、抖音、手机、账号密码 5 种按钮
- 点击"注册"链接可跳转注册页

- [ ] **Step 4: 提交最终验证**

```bash
cd e:\code\vendure && git log --oneline -10
```

确认 8 个提交全部存在。

---

## 自检

### Spec 覆盖

| Spec 要求 | 对应 Task |
|-----------|-----------|
| Phase 1: WeChat devBypass | Task 1 |
| Phase 2: 注册功能（后端） | Task 2 |
| Phase 2: 注册功能（前端） | Task 3 |
| Phase 3: AlipayAuthStrategy | Task 4 |
| Phase 3: AlipayPlugin 注册 | Task 5 |
| Phase 4: DouyinAuthPlugin | Task 6 |
| Phase 5: 环境侦测工具 | Task 7 |
| Phase 5: 登录页集成 | Task 8 |
| 端到端验证 | Task 9 |

### 类型一致性

- `AlipayAuthData { authCode, type }` — Task 4 定义，Task 8 前端使用一致
- `DouyinAuthData { code, type }` — Task 6 定义，Task 8 前端使用一致
- `RegisterCustomerInput { phoneNumber, code, password, emailAddress? }` — Task 2 定义，Task 3 前端使用一致
- `devBypassOpenid` 默认值 `'dev_test_openid'` — 所有 Task 一致

### 已知简化点

1. AlipayAuthPlugin 的 `plugin.ts` 修改未展示完整代码（因未读取原文件），实施时需先 Read 原文件再合并
2. 抖音 H5 OAuth 的 scope 和回调参数可能需根据抖音开放平台实际文档调整
3. 注册页 UI 为最简实现，可后续优化样式
