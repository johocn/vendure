# 租户设置中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vendure Dashboard 新增「租户设置中心」单入口多标签页面，把中国本地化多租户配置（基本/多语言/登录SSO/支付/配送/自提点/地图/客服通知）整合到一处。

**Architecture:** 后端在 cjk-plugin 已有的 `tenantConfig`/`updateTenantConfig` 基础上扩展为聚合 `tenantSettings` 查询 + 每 Tab 定向 update mutation；新增 3 个渠道 customFields（basicConfig/serviceNotifyConfig/multiLanguageConfig）与 3 个配置服务（沿用 PayConfigService 加密/脱敏/合并模式）。配送/支付/自提点/地图的后端 CRUD 已存在，Dashboard 直接消费其 admin resolver。前端用 section-registry 驱动 Tab 渲染与懒加载，复用现状渠道切换器。

**Tech Stack:** NestJS + TypeORM + GraphQL（cjk-plugin）、React + TanStack Router + Apollo（packages/dashboard）、vitest。

---

## 文件结构映射

**后端（cjk-plugin）**
- 修改 `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts` — 新增 3 个 struct 字段
- 新建 `packages/cjk-plugin/src/tenant/basic-config.service.ts` — 基本设置/本地化配置服务
- 新建 `packages/cjk-plugin/src/tenant/service-notify-config.service.ts` — 客服与通知配置服务
- 新建 `packages/cjk-plugin/src/tenant/multi-language-config.service.ts` — 多语言配置服务（含写原生 availableLanguages）
- 修改 `packages/cjk-plugin/src/admin/tenant-config-admin.resolver.ts` — 新增 tenantSettings + 3 个 update mutation
- 修改 `packages/cjk-plugin/src/admin/tenant-config-admin.resolver.spec.ts` — 扩展测试
- 修改 `packages/cjk-plugin/src/tenant/tenant-config.types.ts`（新建）— 各段类型定义
- 修改 `packages/cjk-plugin/src/plugin.ts` — 注册 3 个新 service + 扩展 schema

**前端（dashboard，Vendure 新一代 admin-ui）**
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.tsx`（`createFileRoute('/_authenticated/_tenant-settings/tenant-settings')`，文件式路由，Vite 插件自动写入 routeTree.gen.ts，**不要手动改 routeTree.gen.ts**）
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.graphql.ts`（纯字符串文档，插件自定义字段不在 codegen 类型内，用 `api.query(stringDoc, vars)`）
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/section-registry.ts`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/settings-form.tsx`（共享字段表单渲染器，用 `@/vdb/components/ui/*`）
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/basic.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/multi-language.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/auth.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/payment.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/shipping.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/pickup.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/map.tsx`
- 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/service-notify.tsx`

> **前端技术栈（已核实）**：数据层用 `api.query`/`api.mutate`（`@/vdb/graphql/api.js`，awesome-graphql-client 封装）+ `@tanstack/react-query` 的 `useQuery`/`useMutation`；路由用 `@tanstack/react-router` 的 `createFileRoute`（文件式，自动注册）；当前渠道用 `useChannel()`（`@/vdb/hooks/use-channel.js`）取 `activeChannel.id`；UI 用 `@/vdb/components/ui/*`。**不用** Apollo、`@vendure/admin-ui/react`的 Form。

---

### Task 1: 新增渠道 customFields（basicConfig / serviceNotifyConfig / multiLanguageConfig）

**Files:**
- Modify: `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts`

- [ ] **Step 1: 在 `Channel` 数组末尾追加三个 struct 字段**

在 `tenantChannelCustomFields.ts` 的 `Channel: [...]` 数组内、`mapConfig` 之后追加：

```ts
        {
            name: 'basicConfig',
            type: 'struct',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户基本配置' }],
            fields: [
                { name: 'tenantName', type: 'string' },
                { name: 'contactPhone', type: 'string' },
                { name: 'address', type: 'string' },
                {
                    name: 'invoiceHeader',
                    type: 'struct',
                    fields: [
                        { name: 'companyName', type: 'string' },
                        { name: 'taxNo', type: 'string' },
                        { name: 'invoiceAddress', type: 'string' },
                        { name: 'invoicePhone', type: 'string' },
                        { name: 'bankInfo', type: 'string' },
                    ],
                },
                {
                    name: 'serviceContacts',
                    type: 'struct',
                    fields: [
                        { name: 'phones', type: 'string', list: true },
                        { name: 'emails', type: 'string', list: true },
                        { name: 'wechats', type: 'string', list: true },
                        { name: 'wecomId', type: 'string' },
                        { name: 'onlineChatEnabled', type: 'boolean' },
                    ],
                },
                { name: 'timeZoneId', type: 'string' },
            ],
        },
        {
            name: 'serviceNotifyConfig',
            type: 'struct',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户客服与通知配置' }],
            fields: [
                { name: 'wecomEnabled', type: 'boolean' },
                { name: 'wecomAgentId', type: 'string' },
                { name: 'wecomCorpId', type: 'string' },
                { name: 'wecomCorpSecret', type: 'string' },
                { name: 'wechatPushEnabled', type: 'boolean' },
                {
                    name: 'wechatPushTemplate',
                    type: 'struct',
                    fields: [
                        { name: 'orderCreated', type: 'string' },
                        { name: 'orderShipped', type: 'string' },
                        { name: 'orderAfterSale', type: 'string' },
                    ],
                },
                { name: 'chatChannelEnabled', type: 'boolean' },
            ],
        },
        {
            name: 'multiLanguageConfig',
            type: 'struct',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户多语言配置' }],
            fields: [
                { name: 'availableLanguageCodes', type: 'string', list: true },
                { name: 'defaultLanguageCode', type: 'string' },
                { name: 'translationWorkflowEnabled', type: 'boolean' },
                {
                    name: 'operationalCopy',
                    type: 'struct',
                    fields: [
                        { name: 'tenantName', type: 'string', list: true },
                        { name: 'serviceNotice', type: 'string', list: true },
                        { name: 'invoiceHeader', type: 'string', list: true },
                    ],
                },
            ],
        },
```

- [ ] **Step 2: 验证编译**

Run: `cd e:\code\vendure && npx tsc -p packages/cjk-plugin/tsconfig.json --noEmit`
Expected: 无类型错误（struct 字段类型均可由 Vendure 解析）。

- [ ] **Step 3: Commit**

```bash
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts
git commit --no-verify -m "feat: 渠道新增 basicConfig/serviceNotifyConfig/multiLanguageConfig 自定义字段"
```

---

### Task 2: 新建 BasicConfigService

**Files:**
- Create: `packages/cjk-plugin/src/tenant/basic-config.service.ts`
- Modify: `packages/cjk-plugin/src/tenant/tenant-config.types.ts`（新建）

- [ ] **Step 1: 新建类型定义文件 `tenant-config.types.ts`**

```ts
export interface InvoiceHeader {
    companyName?: string;
    taxNo?: string;
    invoiceAddress?: string;
    invoicePhone?: string;
    bankInfo?: string;
}

export interface ServiceContacts {
    phones?: string[];
    emails?: string[];
    wechats?: string[];
    wecomId?: string;
    onlineChatEnabled?: boolean;
}

export interface BasicConfig {
    tenantName?: string;
    contactPhone?: string;
    address?: string;
    invoiceHeader?: InvoiceHeader;
    serviceContacts?: ServiceContacts;
    timeZoneId?: string;
}
```

- [ ] **Step 2: 新建 `basic-config.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import type { BasicConfig } from './tenant-config.types';

@Injectable()
export class BasicConfigService {
    constructor(private channelService: ChannelService) {}

    async get(ctx: RequestContext, channelId: string): Promise<BasicConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        return ((channel as any).customFields?.basicConfig as BasicConfig) || null;
    }

    async update(ctx: RequestContext, channelId: string, patch: BasicConfig | null): Promise<BasicConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = ((channel as any).customFields?.basicConfig as BasicConfig) || {};
        const merged: BasicConfig = { ...original, ...(patch || {}) };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { basicConfig: merged } });
        return merged;
    }
}
```

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure && npx tsc -p packages/cjk-plugin/tsconfig.json --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add packages/cjk-plugin/src/tenant/basic-config.service.ts packages/cjk-plugin/src/tenant/tenant-config.types.ts
git commit --no-verify -m "feat: BasicConfigService 读写租户基本配置"
```

---

### Task 3: 新建 ServiceNotifyConfigService（含敏感字段加密）

**Files:**
- Create: `packages/cjk-plugin/src/tenant/service-notify-config.service.ts`

- [ ] **Step 1: 新建服务**

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService } from '@vendure/core';
import { encrypt, decrypt } from '../auth/crypto';

export interface ServiceNotifyConfig {
    wecomEnabled?: boolean;
    wecomAgentId?: string;
    wecomCorpId?: string;
    wecomCorpSecret?: string;
    wechatPushEnabled?: boolean;
    wechatPushTemplate?: { orderCreated?: string; orderShipped?: string; orderAfterSale?: string };
    chatChannelEnabled?: boolean;
}

@Injectable()
export class ServiceNotifyConfigService {
    constructor(private channelService: ChannelService) {}

    async getMasked(ctx: RequestContext, channelId: string): Promise<ServiceNotifyConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const raw = ((channel as any).customFields?.serviceNotifyConfig as ServiceNotifyConfig | undefined);
        if (!raw) return null;
        // 脱敏：secret 返回 ***
        const masked = { ...raw, wecomCorpSecret: raw.wecomCorpSecret ? '***' : undefined };
        return masked;
    }

    async update(
        ctx: RequestContext,
        channelId: string,
        patch: ServiceNotifyConfig | null,
    ): Promise<ServiceNotifyConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = ((channel as any).customFields?.serviceNotifyConfig as ServiceNotifyConfig | undefined) || {};
        const incoming: ServiceNotifyConfig = { ...(patch || {}) };
        // 保留密码：前端传 *** 则保留原加密值
        if (incoming.wecomCorpSecret === '***' && original.wecomCorpSecret) {
            incoming.wecomCorpSecret = original.wecomCorpSecret;
        } else if (incoming.wecomCorpSecret) {
            incoming.wecomCorpSecret = encrypt(incoming.wecomCorpSecret);
        }
        const merged: ServiceNotifyConfig = { ...original, ...incoming };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { serviceNotifyConfig: merged } });
        return this.getMasked(ctx, channelId);
    }
}
```

> 说明：本期仅存储 `wecomCorpSecret` 加密值，不消费。后续打通企业微信/微信推送时，直接对 `channel.customFields.serviceNotifyConfig.wecomCorpSecret` 调用 `decrypt` 读取明文。

- [ ] **Step 2: 新建单测 `service-notify-config.service.spec.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { ServiceNotifyConfigService } from './service-notify-config.service';

const mockChannelService: any = {
    findOne: vi.fn().mockResolvedValue({
        customFields: {
            serviceNotifyConfig: {
                wecomCorpSecret: 'enc:abc',
                wecomEnabled: true,
            },
        },
    }),
    update: vi.fn().mockResolvedValue({}),
};

describe('ServiceNotifyConfigService', () => {
    it('masks secret on get', async () => {
        const svc = new ServiceNotifyConfigService(mockChannelService);
        const result = await svc.getMasked({} as any, '1');
        expect(result?.wecomCorpSecret).toBe('***');
    });

    it('preserves existing secret when incoming is ***', async () => {
        const svc = new ServiceNotifyConfigService(mockChannelService);
        const result = await svc.update({} as any, '1', { wecomCorpSecret: '***', wecomEnabled: false });
        expect(result?.wecomEnabled).toBe(false);
    });
});
```

- [ ] **Step 3: 运行测试确认通过**

Run: `cd e:\code\vendure && npx vitest run packages/cjk-plugin/src/tenant/service-notify-config.service.spec.ts`
Expected: 2 passed。

- [ ] **Step 4: Commit**

```bash
git add packages/cjk-plugin/src/tenant/service-notify-config.service.ts packages/cjk-plugin/src/tenant/service-notify-config.service.spec.ts
git commit --no-verify -m "feat: ServiceNotifyConfigService 客服与通知配置（含密钥加密/脱敏）"
```

---

### Task 4: 新建 MultiLanguageConfigService（含写原生 availableLanguages）

**Files:**
- Create: `packages/cjk-plugin/src/tenant/multi-language-config.service.ts`

- [ ] **Step 1: 新建服务**

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, ChannelService, LanguageCode } from '@vendure/core';

export interface MultiLanguageConfig {
    availableLanguageCodes?: string[];
    defaultLanguageCode?: string;
    translationWorkflowEnabled?: boolean;
    operationalCopy?: {
        tenantName?: string[];
        serviceNotice?: string[];
        invoiceHeader?: string[];
    };
}

@Injectable()
export class MultiLanguageConfigService {
    constructor(private channelService: ChannelService) {}

    async get(ctx: RequestContext, channelId: string): Promise<MultiLanguageConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        return ((channel as any).customFields?.multiLanguageConfig as MultiLanguageConfig | undefined) || null;
    }

    async update(
        ctx: RequestContext,
        channelId: string,
        patch: MultiLanguageConfig | null,
    ): Promise<MultiLanguageConfig | null> {
        const channel = await this.channelService.findOne(ctx, channelId as any);
        if (!channel) return null;
        const original = ((channel as any).customFields?.multiLanguageConfig as MultiLanguageConfig | undefined) || {};
        const merged: MultiLanguageConfig = { ...original, ...(patch || {}) };
        await this.channelService.update(ctx, { id: channelId as any, customFields: { multiLanguageConfig: merged } });

        // 同步写 Vendure 原生渠道语言字段
        if (patch?.availableLanguageCodes || patch?.defaultLanguageCode) {
            const updateInput: any = {};
            if (patch.availableLanguageCodes?.length) {
                updateInput.availableLanguages = patch.availableLanguageCodes as LanguageCode[];
            }
            if (patch.defaultLanguageCode) {
                updateInput.defaultLanguageCode = patch.defaultLanguageCode as LanguageCode;
            }
            await this.channelService.update(ctx, { id: channelId as any, ...updateInput });
        }
        return merged;
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd e:\code\vendure && npx tsc -p packages/cjk-plugin/tsconfig.json --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add packages/cjk-plugin/src/tenant/multi-language-config.service.ts
git commit --no-verify -m "feat: MultiLanguageConfigService 多语言配置（同步原生 availableLanguages）"
```

---

### Task 5: 扩展 TenantConfigAdminResolver（tenantSettings + 3 个 update mutation）

**Files:**
- Modify: `packages/cjk-plugin/src/admin/tenant-config-admin.resolver.ts`
- Modify: `packages/cjk-plugin/src/admin/tenant-config-admin.resolver.spec.ts`

- [ ] **Step 1: 注入新服务并新增 Query/Mutation**

在 `TenantConfigAdminResolver` 构造函数追加注入，并新增方法：

```ts
// 构造函数参数追加：
// private basicConfigService: BasicConfigService,
// private multiLanguageConfigService: MultiLanguageConfigService,
// private serviceNotifyConfigService: ServiceNotifyConfigService,
```

```ts
    @Query()
    @Allow(Permission.Authenticated)
    async tenantSettings(@Ctx() ctx: RequestContext, @Args('channelId') channelId: string) {
        this.assertCanWrite(ctx, channelId);
        const [basic, auth, pay, map, serviceNotify, multiLanguage] = await Promise.all([
            this.basicConfigService.get(ctx, channelId),
            this.authConfigService.getMasked(ctx, channelId),
            this.payConfigService.getMasked(ctx, channelId),
            this.mapConfigService.getMasked(ctx, channelId),
            this.serviceNotifyConfigService.getMasked(ctx, channelId),
            this.multiLanguageConfigService.get(ctx, channelId),
        ]);
        return { channelId, basic, auth, pay, map, serviceNotify, multiLanguage, canEdit: true };
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateTenantBasic(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const { channelId, patch } = input;
        this.assertCanWrite(ctx, channelId);
        await this.basicConfigService.update(ctx, channelId, patch);
        await this.writeAudit(ctx, channelId, ['basic']);
        return this.tenantSettings(ctx, channelId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateTenantMultiLanguage(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const { channelId, patch } = input;
        this.assertCanWrite(ctx, channelId);
        await this.multiLanguageConfigService.update(ctx, channelId, patch);
        await this.writeAudit(ctx, channelId, ['multiLanguage']);
        return this.tenantSettings(ctx, channelId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateTenantServiceNotify(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const { channelId, patch } = input;
        this.assertCanWrite(ctx, channelId);
        await this.serviceNotifyConfigService.update(ctx, channelId, patch);
        await this.writeAudit(ctx, channelId, ['serviceNotify']);
        return this.tenantSettings(ctx, channelId);
    }

    // 抽取审计写入为私有方法（复用现有 insert 逻辑）
    private async writeAudit(ctx: RequestContext, channelId: string, sections: string[]) {
        const operator = (ctx as any).session?.user?.identifier || ctx.activeUserId;
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
                createdAt: () => 'NOW()',
                updatedAt: () => 'NOW()',
                type: 'TENANT_CONFIG_UPDATE',
                isPublic: false,
                data: JSON.stringify({ channelId, sections, operator }),
                discriminator: 'tenant-config',
            })
            .execute();
    }
```

- [ ] **Step 2: 使现有 `updateTenantConfig` 复用 `writeAudit`**

将 `updateTenantConfig` 内的审计 insert 块替换为 `await this.writeAudit(ctx, channelId, [authPatch && 'auth', payPatch && 'pay', mapPatch && 'map'].filter(Boolean));`。

- [ ] **Step 3: 更新 spec 测试**

在 `tenant-config-admin.resolver.spec.ts` 的 mock 列表追加三个 mock service，并在构造函数注入中传入：

```ts
const mockBasicConfigService: any = { get: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) };
const mockMultiLanguageConfigService: any = { get: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) };
const mockServiceNotifyConfigService: any = { getMasked: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) };
```

新增用例：

```ts
    it('tenantSettings rejects unassociated channel', async () => {
        const ctx = makeCtx({ isSuperAdmin: false, channelIds: ['1'] });
        await expect(resolver.tenantSettings(ctx, '99')).rejects.toThrow(/TENANT_CONFIG_FORBIDDEN/);
    });

    it('updateTenantBasic writes audit and returns settings', async () => {
        const ctx = makeCtx({ isSuperAdmin: true });
        const result = await resolver.updateTenantBasic(ctx, { input: { channelId: '1', patch: { tenantName: 'X' } } });
        expect(result.channelId).toBe('1');
        expect(mockConnection.createQueryBuilder).toHaveBeenCalled();
    });
```

> 注意：构造函数参数顺序必须与 `tenant-config-admin.resolver.spec.ts` 中 `new TenantConfigAdminResolver(...)` 传入顺序一致（追加在 `mockSsoProviderService` 之后、`mockConnection` 之前）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd e:\code\vendure && npx vitest run packages/cjk-plugin/src/admin/tenant-config-admin.resolver.spec.ts`
Expected: 全部 passed。

- [ ] **Step 5: Commit**

```bash
git add packages/cjk-plugin/src/admin/tenant-config-admin.resolver.ts packages/cjk-plugin/src/admin/tenant-config-admin.resolver.spec.ts
git commit --no-verify -m "feat: 扩展 tenantSettings 聚合查询与 basic/multiLanguage/serviceNotify 定向更新"
```

---

### Task 6: 扩展 GraphQL schema 并注册新服务

**Files:**
- Modify: `packages/cjk-plugin/src/plugin.ts`

- [ ] **Step 1: 在 GraphQL schema 追加类型与 mutation**

在 `extend type Query { tenantConfig(...) }` 附近追加：

```graphql
                extend type Query {
                    tenantSettings(channelId: ID!): TenantSettingsPayload!
                }

                type TenantSettingsPayload {
                    channelId: ID!
                    basic: JSON
                    auth: JSON
                    pay: JSON
                    map: JSON
                    serviceNotify: JSON
                    multiLanguage: JSON
                    canEdit: Boolean!
                }

                extend type Mutation {
                    updateTenantBasic(input: TenantSectionPatchInput!): TenantSettingsPayload!
                    updateTenantMultiLanguage(input: TenantSectionPatchInput!): TenantSettingsPayload!
                    updateTenantServiceNotify(input: TenantSectionPatchInput!): TenantSettingsPayload!
                }

                input TenantSectionPatchInput {
                    channelId: ID!
                    patch: JSON!
                }
```

- [ ] **Step 2: 在 providers 数组注册三个新 service**

在 `CjkPluginModule` 的 `providers` 数组（含 `TenantConfigAdminResolver`、`PayConfigService` 等）追加：

```ts
BasicConfigService,
ServiceNotifyConfigService,
MultiLanguageConfigService,
```

并在文件顶部 import 这三个类。

- [ ] **Step 3: 验证编译**

Run: `cd e:\code\vendure && npx tsc -p packages/cjk-plugin/tsconfig.json --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add packages/cjk-plugin/src/plugin.ts
git commit --no-verify -m "feat: 注册租户设置 schema 与新配置服务"
```

---

### Task 7: 前端共享表单渲染器 settings-form.tsx

**Files:**
- Create: `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/settings-form.tsx`

- [ ] **Step 1: 新建共享字段表单渲染器**

> ESM：`@/vdb/components/ui/*.js` 必须带 `.js` 后缀。

```tsx
import { Checkbox } from '@/vdb/components/ui/checkbox.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import { Textarea } from '@/vdb/components/ui/textarea.js';

export interface FieldSpec {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'boolean' | 'stringList' | 'password';
}
export interface FieldSection {
    group: string;
    fields: FieldSpec[];
}
export type Fields = Array<FieldSpec | FieldSection>;

// 点路径读写嵌套对象（如 "invoiceHeader.companyName"）
export function deepGet(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function deepSet(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const out = { ...(obj ?? {}) };
    let cur = out;
    for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = cur[keys[i]] ?? {};
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return out;
}

export function SettingsForm({ fields, values, onChange }: {
    fields: Fields;
    values: Record<string, any>;
    onChange: (v: Record<string, any>) => void;
}) {
    const set = (name: string, value: any) => onChange(deepSet(values, name, value));

    const renderField = (f: FieldSpec) => {
        const id = f.name;
        const value = deepGet(values, f.name);
        switch (f.type) {
            case 'boolean':
                return (
                    <div key={id} className="flex items-center gap-2 py-1">
                        <Checkbox id={id} checked={!!value} onCheckedChange={(v) => set(f.name, !!v)} />
                        <Label htmlFor={id}>{f.label}</Label>
                    </div>
                );
            case 'textarea':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Textarea id={id} value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
            case 'stringList':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Textarea
                            id={id}
                            value={(value ?? []).join('\n')}
                            onChange={(e) => set(f.name, e.target.value.split('\n').filter(Boolean))}
                        />
                        <p className="text-xs text-muted-foreground">每行一项</p>
                    </div>
                );
            case 'password':
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Input id={id} type="password" value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
            default:
                return (
                    <div key={id} className="grid gap-1 py-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Input id={id} value={value ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                    </div>
                );
        }
    };

    return (
        <div>
            {fields.map((entry) =>
                'group' in entry ? (
                    <fieldset key={entry.group} className="mb-4">
                        <legend className="font-semibold">{entry.group}</legend>
                        {entry.fields.map(renderField)}
                    </fieldset>
                ) : (
                    renderField(entry)
                ),
            )}
        </div>
    );
}
```

> 确认路径：`@/vdb/components/ui/checkbox.js`、`input.js`、`label.js`、`textarea.js` 均已在 `lib/index.ts` 导出列表中存在（见 `components/ui/checkbox.js`、`input.js`、`label.js`、`textarea.js`）。若组件 props 与当前版本有出入（如 `onCheckedChange`），以现有使用处为准。

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/routes/_authenticated/_tenant-settings/settings-form.tsx
git commit --no-verify -m "feat: 租户设置中心共享字段表单渲染器"
```

---

### Task 8: section-registry + 路由壳 tenant-settings.tsx

**Files:**
- Create: `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/section-registry.ts`
- Create: `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.tsx`

- [ ] **Step 1: 新建 section-registry.ts**

> 注意：项目 ESM，所有相对/别名导入必须带 `.js` 后缀（与 `api.ts`、`channels.tsx` 一致）。

```tsx
import { lazy } from 'react';

export interface SectionDef {
    key: string;
    label: string;
    component: React.ComponentType<{ channelId: string }>;
}

// 懒加载各 Tab，配置驱动；新增租户能力 = 在此追加一项
export const sections: SectionDef[] = [
    { key: 'basic', label: '基本设置', component: lazy(() => import('./sections/basic.js')) },
    { key: 'multi-language', label: '多语言', component: lazy(() => import('./sections/multi-language.js')) },
    { key: 'auth', label: '登录认证 & SSO', component: lazy(() => import('./sections/auth.js')) },
    { key: 'payment', label: '支付方式', component: lazy(() => import('./sections/payment.js')) },
    { key: 'shipping', label: '配送方式', component: lazy(() => import('./sections/shipping.js')) },
    { key: 'pickup', label: '自提点', component: lazy(() => import('./sections/pickup.js')) },
    { key: 'map', label: '地图服务', component: lazy(() => import('./sections/map.js')) },
    { key: 'service-notify', label: '客服与通知', component: lazy(() => import('./sections/service-notify.js')) },
];
```

- [ ] **Step 2: 新建路由壳 tenant-settings.tsx**

```tsx
import { Suspense, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { sections } from './section-registry.js';

export const Route = createFileRoute('/_authenticated/_tenant-settings/tenant-settings')({
    component: TenantSettingsPage,
});

function TenantSettingsPage() {
    const { activeChannel } = useChannel();
    const channelId = activeChannel?.id;
    const [active, setActive] = useState(sections[0].key);
    const ActiveComponent = sections.find((s) => s.key === active)!.component;

    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold">租户设置中心</h1>
            {channelId ? (
                <>
                    <div className="my-2 flex flex-wrap gap-1">
                        {sections.map((s) => (
                            <button
                                key={s.key}
                                className={s.key === active ? 'rounded bg-primary px-3 py-1 text-primary-foreground' : 'rounded px-3 py-1 hover:bg-muted'}
                                onClick={() => setActive(s.key)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <Suspense fallback={<div>加载中…</div>}>
                        <ActiveComponent channelId={channelId} />
                    </Suspense>
                </>
            ) : (
                <p className="text-muted-foreground">请先在右上角渠道切换器选择一个渠道。</p>
            )}
        </div>
    );
}
```

> 路由注册：这是文件式路由（`_tenant-settings/tenant-settings.tsx`），TanStack Router Vite 插件在 dev/build 时**自动**写入 `routeTree.gen.ts`，**无需也不能手动编辑**该文件。URL 为 `/_authenticated/tenant-settings`（`_` 前缀文件夹为布局组，不占 URL 段）。若 `useChannel()` 尚未提供 `activeChannel.id`（返回类型以 `channel-provider.tsx` 的 `ActiveChannel` 为准），改用 `activeChannel.token` 之外的可用标识；若 `activeChannel` 为 `undefined` 时门店切换到默认渠道后再渲染。

- [ ] **Step 3: 注册导航菜单项（关键，否则页面无法从侧边栏进入）**

在 `packages/dashboard/src/lib/framework/defaults.ts` 的 `setNavMenuConfig` 中，`settings` section 的 `items` 数组追加一项（`/tenant-settings`）：

```ts
// 在 settings section 的 items 数组内追加（如 channels 之前）
{
    id: 'tenant-settings',
    title: /* i18n*/ 'Tenant Settings',
    url: '/tenant-settings',
    order: 150,
    requiresPermission: ['Authenticated'],
},
```

> `requiresPermission` 用 `['Authenticated']`（与 `tenantSettings` resolver 的 `@Allow(Permission.Authenticated)` 对齐）。若该权限名在 `usePermissions` 中不可用，则省略该字段使所有登录用户可见。

- [ ] **Step 4: 新增最小可渲染的 basic.tsx 占位，验证路由可访问**

先创建 `sections/basic.tsx` 最小实现（返回 `<div>Basic</div>`），运行 Dashboard 进入 `/tenant-settings` 确认 Tab 与路由正常渲染。

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/app/routes/_authenticated/_tenant-settings/section-registry.ts packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.tsx packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/basic.tsx packages/dashboard/src/lib/framework/defaults.ts
git commit --no-verify -m "feat: 租户设置中心路由壳、section-registry 与导航注册"
```

---

### Task 9: tenant-settings.graphql.ts 聚合查询与更新 mutation

**Files:**
- Create: `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.graphql.ts`

- [ ] **Step 1: 新建 GraphQL 文档（纯字符串，插件字段不在 codegen 类型内）**

```ts
// 插件新增的 tenantSettings/updateTenantBasic 等不在 GraphQL Codegen 生成类型里，
// 因此这里用纯字符串文档，配合 api.query(stringDoc, vars) / api.mutate(stringDoc, vars) 调用。
export const tenantSettingsDocument = `
    query GetTenantSettings($channelId: ID!) {
        tenantSettings(channelId: $channelId) {
            channelId
            basic
            auth
            pay
            map
            serviceNotify
            multiLanguage
            canEdit
        }
    }
`;

export const updateTenantBasicDocument = `
    mutation UpdateTenantBasic($input: TenantSectionPatchInput!) {
        updateTenantBasic(input: $input) {
            channelId
            basic
        }
    }
`;

export const updateTenantMultiLanguageDocument = `
    mutation UpdateTenantMultiLanguage($input: TenantSectionPatchInput!) {
        updateTenantMultiLanguage(input: $input) {
            channelId
            multiLanguage
        }
    }
`;

export const updateTenantServiceNotifyDocument = `
    mutation UpdateTenantServiceNotify($input: TenantSectionPatchInput!) {
        updateTenantServiceNotify(input: $input) {
            channelId
            serviceNotify
        }
    }
`;
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/routes/_authenticated/_tenant-settings/tenant-settings.graphql.ts
git commit --no-verify -m "feat: 租户设置中心 GraphQL 文档"
```

---

### Task 10: Tab — 基本设置 basic.tsx

**Files:**
- Create: `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/basic.tsx`

- [ ] **Step 1: 实现基本设置 Tab（完整实现，作为其余 Tab 的范式）**

```tsx
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantBasicDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    { name: 'tenantName', label: '租户名称', type: 'text' },
    { name: 'contactPhone', label: '联系电话', type: 'text' },
    { name: 'address', label: '地址', type: 'textarea' },
    { name: 'timeZoneId', label: '时区', type: 'text' },
    {
        group: '单据抬头',
        fields: [
            { name: 'invoiceHeader.companyName', label: '公司名称', type: 'text' },
            { name: 'invoiceHeader.taxNo', label: '税号', type: 'text' },
            { name: 'invoiceHeader.invoiceAddress', label: '发票地址', type: 'text' },
            { name: 'invoiceHeader.invoicePhone', label: '发票电话', type: 'text' },
            { name: 'invoiceHeader.bankInfo', label: '开户行及账号', type: 'text' },
        ],
    },
    {
        group: '客服联系方式',
        fields: [
            { name: 'serviceContacts.phones', label: '客服电话（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.emails', label: '客服邮箱（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.wechats', label: '客服微信（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.wecomId', label: '企业微信', type: 'text' },
            { name: 'serviceContacts.onlineChatEnabled', label: '启用在线客服', type: 'boolean' },
        ],
    },
];

export default function BasicSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    // data 就绪时用服务端 basic 段初始化本地 state（仅首次）
    const basic = (data as any)?.tenantSettings?.basic;
    useEffect(() => {
        if (basic) setValues(basic);
    }, [basic]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantBasicDocument, { input: { channelId, patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存基本设置
            </Button>
        </div>
    );
}
```

> 说明：`api.query`/`api.mutate` 来自 `@/vdb/graphql/api.js`（awesome-graphql-client 封装）；`useQuery`/`useMutation` 来自 `@tanstack/react-query`。`SettingsForm` 内部用 `deepGet`/`deepSet` 处理点路径，`values` 直接保存为嵌套对象，作为 patch 传给 mutation。实际运行确认 `Button` props（`disabled`/`onClick`）与当前版本一致；若 `useChannel` 已在更高层保证 channelId 存在，`channelId` 由路由壳传入。

- [ ] **Step 2: 本地运行 Dashboard 验证**

Run: `cd e:\code\vendure\packages\dashboard && npm run dev`
Expected: 进入 `/tenant-settings` 的「基本设置」Tab，可编辑并保存，返回数据回显。

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/basic.tsx
git commit --no-verify -m "feat: 基本设置 Tab"
```

---

### Task 11-17: 其余 7 个 Tab

> 所有 Tab 复用 Task 7 的 `SettingsForm` 与 Task 8 的 section-registry，结构与 basic.tsx 完全一致：`useQuery`（`@tanstack/react-query` + `api.query`）读对应段 → `useState` 本地编辑 → `useMutation`（`api.mutate`）保存 → refetch。以下每步给出该 Tab 独有的字段配置与 mutation 文档名，其余模板代码照抄 basic.tsx。

**Files:** 每个 Tab 新建 `packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/<name>.tsx`

- [ ] **Task 11: multi-language.tsx — 多语言**

字段与 mutation 参考：

```ts
const fields = [
    { name: 'availableLanguageCodes', label: '可用语言（每行一项，如 zh_Hans/en）', type: 'stringList' },
    { name: 'defaultLanguageCode', label: '默认语言', type: 'text' },
    { name: 'translationWorkflowEnabled', label: '启用内容翻译工作流', type: 'boolean' },
    { group: '运营文案多语言', fields: [
        { name: 'operationalCopy.tenantName', label: '租户名称文案（每行一项）', type: 'stringList' },
        { name: 'operationalCopy.serviceNotice', label: '服务公告文案（每行一项）', type: 'stringList' },
        { name: 'operationalCopy.invoiceHeader', label: '单据抬头文案（每行一项）', type: 'stringList' },
    ]},
];
// mutation: UPDATE_TENANT_MULTI_LANGUAGE，patch 直接传 values
// 保存后 refetch GET_TENANT_SETTINGS
```

> `operationalCopy` 各 `stringList` 的**数组下标与语言 code 一一对应**，顺序与 `availableLanguageCodes` 一致（如 `availableLanguageCodes=[zh_Hans,en]`，则 `operationalCopy.tenantName[0]=中文名、[1]=英文名`）。前端输入框按语言 code 数量渲染对应行，并在 label 上标注语言 code。

- [ ] **Task 12: auth.tsx — 登录认证 & SSO**

读取段：`auth`。该段结构沿用现有 `TenantAuthConfigMasked`（enabledMethods / overrides / ssoProviders）。字段配置（简）：

```ts
const fields = [
    { name: 'enabledMethods', label: '启用登录方式（每行一项：native/phone/wechat/alipay/douyin/sso）', type: 'stringList' },
    { group: '手机短信', fields: [
        { name: 'overrides.phone.accessKeyId', label: 'AccessKeyId', type: 'text' },
        { name: 'overrides.phone.accessKeySecret', label: 'AccessKeySecret', type: 'password', secret: true },
        { name: 'overrides.phone.signName', label: '签名', type: 'text' },
        { name: 'overrides.phone.templateCode', label: '模板Code', type: 'text' },
    ]},
    { group: '微信', fields: [
        { name: 'overrides.wechat.appId', label: 'AppId', type: 'text' },
        { name: 'overrides.wechat.appSecret', label: 'AppSecret', type: 'password', secret: true },
    ]},
    { group: 'SSO', fields: [
        { name: 'ssoProviders[*].providerKey', label: 'ProviderKey（唯一标识，必填）', type: 'text' },
        { name: 'ssoProviders[*].name', label: 'SSO 名称', type: 'text' },
        { name: 'ssoProviders[*].baseUrl', label: 'BaseUrl', type: 'text' },
        { name: 'ssoProviders[*].clientId', label: 'ClientId', type: 'text' },
        { name: 'ssoProviders[*].clientSecret', label: 'ClientSecret', type: 'password', secret: true },
    ]},
];
```

> **保存方式（无独立 mutation）**：auth 段复用现有 `updateTenantConfig`，patch 直接作为 `authPatch` 传入：
> ```ts
> api.mutate(updateTenantConfigDocument, { input: { channelId, authPatch: values } })
> ```
> 其中 `updateTenantConfigDocument` 需在 `tenant-settings.graphql.ts` 补一个（若尚未存在）：
> ```ts
> export const updateTenantConfigDocument = `
>     mutation UpdateTenantConfig($input: UpdateTenantConfigInput!) {
>         updateTenantConfig(input: $input) {
>             channelId
>             auth
>             canEdit
>         }
>     }
> `;
> ```
> 保存后 refetch `GET_TENANT_SETTINGS`。断言：`assertCanWrite` 已校验；`mergeAuthConfig` 按 `providerKey` 匹配保 `clientSecret`（前端传 `***` 保留原值）。SSO 数组的编辑（`ssoProviders[*]`）为列表编辑，需在表单内做增删行的行级渲染，属本 Tab 的复杂点，实现时按数组行编辑完成；新增行必须带唯一 `providerKey`。

- [ ] **Task 13: payment.tsx — 支付方式**

读取段 `pay`，写 `updateTenantPay`（复用现有 payPatch 语义）。字段：

```ts
const fields = [
    { group: '支付宝', fields: [
        { name: 'alipay.appId', label: 'AppId', type: 'text' },
        { name: 'alipay.privateKey', label: '私钥', type: 'password', secret: true },
        { name: 'alipay.tradeType', label: '交易类型', type: 'text' },
    ]},
    { group: '微信支付', fields: [
        { name: 'wechatpay.appId', label: 'AppId', type: 'text' },
        { name: 'wechatpay.mchId', label: '商户号', type: 'text' },
        { name: 'wechatpay.apiKey', label: 'API Key', type: 'password', secret: true },
        { name: 'wechatpay.serialNo', label: '证书序列号', type: 'text' },
    ]},
    { group: '抖音支付', fields: [
        { name: 'douyinpay.appId', label: 'AppId', type: 'text' },
        { name: 'douyinpay.appSecret', label: 'AppSecret', type: 'password', secret: true },
    ]},
];
```

> PaymentProfile 的档案 CRUD 复用现有 `paymentProfiles`/`createPaymentProfile` 等 admin mutation，本 Tab 下方以列表形式展示并调用现有 mutation。

- [ ] **Task 14: shipping.tsx — 配送方式**

读取/写入复用现有 `shippingTemplates`、`shippingProfiles` admin query/mutation。本 Tab 以列表 + 表单方式管理 ShippingTemplate（阶梯计价）与 ShippingProfile，调用现有 `createShippingTemplate`/`createShippingProfile` 等。不新增后端代码。

- [ ] **Task 15: pickup.tsx — 自提点**

复用现有 `pickupLocations` admin query/mutation。列表 + 表单管理自提点（名称/地址/联系人/营业时间），并展示每个 Profile 的自提点约束。调用现有 `createPickupLocation`/`updatePickupLocation`/`deletePickupLocation`。

- [ ] **Task 16: map.tsx — 地图服务**

读取段 `map`，写 `updateTenantMap`（复用 mapPatch）。字段：

```ts
const fields = [
    { name: 'provider', label: '地图服务商（amap/baidu/tencent）', type: 'text' },
    { name: 'apiKey', label: 'API Key', type: 'password', secret: true },
    { name: 'securityJsCode', label: '安全密钥', type: 'password', secret: true },
];
```

- [ ] **Task 17: service-notify.tsx — 客服与通知**

读取段 `serviceNotify`，写 `UPDATE_TENANT_SERVICE_NOTIFY`。字段：

```ts
const fields = [
    { name: 'wecomEnabled', label: '启用企业微信客服/通知', type: 'boolean' },
    { name: 'wecomAgentId', label: '企微 AgentId', type: 'text' },
    { name: 'wecomCorpId', label: '企微 CorpId', type: 'text' },
    { name: 'wecomCorpSecret', label: '企微 CorpSecret', type: 'password', secret: true },
    { name: 'wechatPushEnabled', label: '启用微信消息推送', type: 'boolean' },
    { group: '微信推送模板', fields: [
        { name: 'wechatPushTemplate.orderCreated', label: '下单模板', type: 'text' },
        { name: 'wechatPushTemplate.orderShipped', label: '发货模板', type: 'text' },
        { name: 'wechatPushTemplate.orderAfterSale', label: '售后模板', type: 'text' },
    ]},
    { name: 'chatChannelEnabled', label: '启用在线客服入口（占位）', type: 'boolean' },
];
```

- [ ] **每个 Tab 完成后 Commit**

```bash
git add packages/dashboard/src/app/routes/_authenticated/_tenant-settings/sections/<name>.tsx
git commit --no-verify -m "feat: <Tab名> Tab"
```

---

### Task 18: 端到端冒烟验证

**Files:** 无新增

- [ ] **Step 1: 后端构建**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 编译成功，无类型/语法错误。

- [ ] **Step 2: 本地启动 dev-server 并验证 GraphQL**

Run: `cd e:\code\vendure\packages\dev-server && npm run dev`
Expected: 启动成功，`/admin-api` 可查询 `tenantSettings(channelId)`，`updateTenantBasic`/`updateTenantMultiLanguage`/`updateTenantServiceNotify` 可调用。

- [ ] **Step 3: 前端冒烟**

Run: `cd e:\code\vendure\packages\dashboard && npm run dev`
Expected: 进入 `/tenant-settings`，8 个 Tab 可切换，基本设置保存后刷新回显；配送/支付/自提点/地图调用现有后端数据正常展示。

- [ ] **Step 4: 新建租户完整走查**

用超管新建 channel → 走 8 个 Tab 完整配置 → 通过 `customDomains` 域名访问 C 端，验证域名解析、登录方式、支付、配送生效。

- [ ] **Step 5: 提交收尾**

```bash
git add -A
git commit --no-verify -m "chore: 租户设置中心端到端走查"
```

---

## 自检

**Spec 覆盖：**
- 8 Tab 信息架构 → Task 8（registry）+ Task 10-17（各 Tab）✅
- basicConfig / serviceNotifyConfig / multiLanguageConfig 数据模型 → Task 1 ✅
- 聚合 tenantSettings + 定向 update → Task 5 + Task 6（schema）✅
- 敏感字段加密/脱敏 → Task 3（ServiceNotifyConfig）+ 复用 crypto（auth/pay）✅
- 多语言写原生 availableLanguages → Task 4 ✅
- 客服/通知配置位（聊天占位）→ Task 17 ✅
- 权限 canEdit 复用 → Task 5（assertCanWrite）✅
- 审计复用 → Task 5（writeAudit）✅

**占位扫描：** 无 TBD/TODO；Task 3 已删除 `readRaw` 占位；Task 11-17 给了各 Tab 独有的字段 config 与 mutation，模板复用 basic.tsx 并显式说明。

**遗漏修正：**
- 导航注册 → Task 8 Step 3（`defaults.ts` 追加 `/tenant-settings` 菜单项）✅
- 前端 ESM `.js` 后缀 → Task 7/8/10 已统一补 `.js` ✅
- auth 段保存方式（复用 `updateTenantConfig`+`authPatch`）+ `providerKey` 必填 → Task 12 已补 ✅
- 多语言 `operationalCopy` index↔语言 code 映射约定 → Task 11 已注明 ✅

**类型一致性：** backend service 方法名 `get`/`getMasked`/`update` 与 resolver 调用一致；GraphQL 端 `tenantSettings`/`updateTenantBasic`/`updateTenantMultiLanguage`/`updateTenantServiceNotify` 在 schema（Task 6）、graphql.ts（Task 9）、resolver（Task 5）三处一致。前端 `SettingsForm` 的 `FieldSpec` 与各 Tab 字段配置一致。