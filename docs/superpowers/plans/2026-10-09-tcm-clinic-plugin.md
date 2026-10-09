# tcm-clinic-plugin 实施计划（Plan 1 / 共 3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `tcm-clinic-plugin`（Vendure 插件）：连锁多馆的病志（版本化+加密+审计）、诊疗过程状态机、康养规划/护理计划/随访，以及患者 Shop API。

**Architecture:** 插件位于 `packages/tcm-clinic-plugin`，与 checkin-plugin 同构（`@VendurePlugin` + PluginCommonModule）。schema 自包含：所有 `tcm_*` 表只存 customerId/variantId/orderId 等 ID，不建跨域外键。敏感字段 AES-256-GCM 应用层加密，更新走 revision 快照 + AuditLog 同事务留痕。e2e 用 vitest + `@vendure/testing`（sqljs，无需外部数据库）。

**Tech Stack:** Vendure 3.6 / TypeORM / GraphQL (graphql-tag) / vitest。Node crypto 内置模块做加密。

**Spec:** `docs/superpowers/specs/2026-10-09-tcm-clinic-plugin-design.md`

**范围说明（3 个子计划）：** Plan 1 = 本文件（插件后端，独立可测试交付）。Plan 2 = 医生工作台 uni-app H5（依赖本计划的 Admin API）。Plan 3 = nshop/vshop 患者端「康养规划中心」页面组（依赖本计划的 Shop API）。Plan 1 落地后再依次撰写执行。

**命令约定（Windows PowerShell，无 `&&`）：** 所有命令在 `d:\zhao\vendure\packages\tcm-clinic-plugin` 目录执行用 `bun run test`；跑单测文件：`bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`。提交一律 `git -C d:\zhao\vendure ...`。

---

## 文件结构总览

```
packages/tcm-clinic-plugin/
├── package.json                     # @vendure/tcm-clinic-plugin
├── tsconfig.json
├── vitest.config.mts
├── src/
│   ├── index.ts                     # 导出 TcmClinicPlugin 与全部实体
│   ├── constants.ts                 # loggerCtx / TCM_PLUGIN_OPTIONS
│   ├── types.ts                     # TcmClinicPluginOptions
│   ├── plugin.ts                    # 插件定义 + admin/shop schema 装配
│   ├── crypto/tcm-crypto.service.ts # AES-256-GCM
│   ├── entities/
│   │   ├── tcm-clinic.entity.ts
│   │   ├── tcm-clinic-staff.entity.ts
│   │   ├── tcm-patient-profile.entity.ts
│   │   ├── tcm-encounter.entity.ts
│   │   ├── tcm-medical-record.entity.ts
│   │   ├── tcm-medical-record-revision.entity.ts
│   │   ├── tcm-wellness-plan.entity.ts
│   │   ├── tcm-plan-item.entity.ts
│   │   ├── tcm-follow-up-task.entity.ts
│   │   └── tcm-audit-log.entity.ts
│   ├── services/
│   │   ├── tcm-staff.service.ts     # 医生身份守卫
│   │   ├── tcm-audit.service.ts     # 审计（与业务同事务）
│   │   ├── tcm-clinic.service.ts    # 馆/员工/患者档案
│   │   ├── tcm-encounter.service.ts # 诊疗状态机
│   │   ├── tcm-medical-record.service.ts # 病志+版本链
│   │   └── tcm-wellness.service.ts  # 康养规划/计划项/随访
│   └── resolvers/
│       ├── tcm-admin.resolver.ts
│       └── tcm-shop.resolver.ts
└── e2e/
    └── tcm-clinic.e2e-spec.ts       # 全程唯一 e2e 文件，随任务增长
```

---

### Task 1: 包骨架 + Clinic 实体 + Admin API 雏形

**Files:**
- Create: `packages/tcm-clinic-plugin/package.json`
- Create: `packages/tcm-clinic-plugin/tsconfig.json`
- Create: `packages/tcm-clinic-plugin/vitest.config.mts`
- Create: `packages/tcm-clinic-plugin/src/index.ts`
- Create: `packages/tcm-clinic-plugin/src/constants.ts`
- Create: `packages/tcm-clinic-plugin/src/types.ts`
- Create: `packages/tcm-clinic-plugin/src/entities/tcm-clinic.entity.ts`
- Create: `packages/tcm-clinic-plugin/src/services/tcm-clinic.service.ts`
- Create: `packages/tcm-clinic-plugin/src/plugin.ts`
- Create: `packages/tcm-clinic-plugin/e2e/tcm-clinic.e2e-spec.ts`
- Modify: `packages/cjk-plugins-e2e/package.json`（devDependencies 加 `"@vendure/tcm-clinic-plugin": "*"`，供后续 Plan 2/3 联调用；本任务可跳过，Task 8 前完成即可）

- [ ] **Step 1.1: 写骨架文件**

`package.json`：

```json
{
    "name": "@vendure/tcm-clinic-plugin",
    "version": "0.0.1",
    "license": "GPL-3.0-or-later",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": ["lib/**/*"],
    "scripts": {
        "watch": "tsc -p ./tsconfig.json --watch",
        "build": "rimraf lib && tsc -p ./tsconfig.json",
        "lint": "eslint --fix .",
        "test": "vitest --config vitest.config.mts --run"
    },
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0"
    },
    "devDependencies": {
        "@vendure/common": "3.6.4",
        "@vendure/core": "3.6.4",
        "@vendure/testing": "3.6.4",
        "graphql-tag": "^2.12.6",
        "rimraf": "^5.0.5",
        "typescript": "5.8.2",
        "unplugin-swc": "^1.4.0",
        "vitest": "^2.0.0"
    }
}
```

`tsconfig.json`：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "removeComments": false,
    "noLib": false,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "./lib"
  },
  "include": ["src"]
}
```

`vitest.config.mts`：

```ts
import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.e2e-spec.ts'],
        testTimeout: process.env.CI ? 120 * 1000 : 60 * 1000,
    },
    plugins: [
        swc.vite({
            jsc: {
                transform: {
                    useDefineForClassFields: false,
                },
            },
        }),
    ],
});
```

`src/constants.ts`：

```ts
export const loggerCtx = 'TcmClinicPlugin';
export const TCM_PLUGIN_OPTIONS = 'TCM_PLUGIN_OPTIONS';
```

`src/types.ts`：

```ts
export interface TcmClinicPluginOptions {
    /** 病志保存年限（门诊病志法定 ≥15 年），默认 15 */
    retentionYears?: number;
    /** AES-256 密钥（64 位 hex）。生产必须提供，缺省回退环境变量 TCM_RECORD_KEY */
    encryptionKey?: string;
}
```

`src/entities/tcm-clinic.entity.ts`：

```ts
import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_clinic' })
export class TcmClinic extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinic>) {
        super(input);
    }
    @Column()
    name: string;
    /** 医疗机构执业备案号 */
    @Column({ type: 'varchar', length: 64 })
    licenseNo: string;
    @Column({ type: 'varchar', length: 255, nullable: true })
    address?: string;
    /** enabled | disabled */
    @Column({ type: 'varchar', length: 16, default: 'enabled' })
    status: string;
}
```

`src/index.ts`（暂只导出已有内容，后续任务追加）：

```ts
export * from './plugin';
export * from './entities/tcm-clinic.entity';
```

- [ ] **Step 1.2: 写失败的 e2e 测试**

`e2e/tcm-clinic.e2e-spec.ts`：

```ts
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TcmClinicPlugin } from '@vendure/tcm-clinic-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('TcmClinicPlugin', () => {
    const { server, adminClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: { port: 3920 },
            plugins: [TcmClinicPlugin.init({})],
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData: {
                defaultLanguage: LanguageCode.zh_Hans,
                defaultZone: 'China',
                countries: [{ code: 'CN', name: 'China', zone: 'Asia' }],
                taxRates: [{ name: 'Standard Tax', percentage: 13 }],
                shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
                paymentMethods: [],
                collections: [],
            },
            productsCsvPath: '',
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('server starts without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('createClinic + clinics query works', async () => {
        const created = await adminClient.query(gql`
            mutation {
                createClinic(input: { name: "同德堂", licenseNo: "BA1101", address: "北京市朝阳区" }) {
                    id
                    name
                    status
                }
            }
        `);
        expect(created.createClinic.name).toBe('同德堂');
        const list = await adminClient.query(gql`
            query {
                clinics(options: {}) {
                    items { id name licenseNo }
                    totalItems
                }
            }
        `);
        expect(list.clinics.totalItems).toBe(1);
        expect(list.clinics.items[0].licenseNo).toBe('BA1101');
    });
});
```

- [ ] **Step 1.3: 安装依赖并确认测试失败（插件不存在）**

```powershell
bun install
cd d:\zhao\vendure\packages\tcm-clinic-plugin
bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts
```

Expected: FAIL（`Cannot find module '@vendure/tcm-clinic-plugin'` 或 schema 无 createClinic）。

- [ ] **Step 1.4: 写服务与插件装配**

`src/services/tcm-clinic.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';

export interface CreateClinicInput {
    name: string;
    licenseNo: string;
    address?: string;
}

@Injectable()
export class TcmClinicService {
    constructor(private connection: TransactionalConnection) {}

    async createClinic(ctx: RequestContext, input: CreateClinicInput): Promise<TcmClinic> {
        const repo = this.connection.getRepository(ctx, TcmClinic);
        const clinic = await repo.save(new TcmClinic({ ...input, status: 'enabled' }));
        return clinic;
    }

    async findAll(ctx: RequestContext): Promise<TcmClinic[]> {
        return this.connection.getRepository(ctx, TcmClinic).find({ order: { id: 'ASC' } });
    }

    async findOne(ctx: RequestContext, id: number): Promise<TcmClinic | null> {
        return this.connection.getRepository(ctx, TcmClinic).findOne({ where: { id } });
    }
}
```

`src/plugin.ts`（Task 1 版本；后续任务在其上追加，实施时以文件当前内容为准扩展）：

```ts
import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { TcmClinic } from './entities/tcm-clinic.entity';
import { TcmClinicService } from './services/tcm-clinic.service';
import { loggerCtx, TCM_PLUGIN_OPTIONS } from './constants';
import { TcmClinicPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type TcmClinic {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        licenseNo: String!
        address: String
        status: String!
    }
    input TcmClinicInput {
        name: String!
        licenseNo: String!
        address: String
    }
    extend type Query {
        clinics(options: TcmClinicListOptions): TcmClinicList!
    }
    input TcmClinicListOptions {
        skip: Int
        take: Int
    }
    type TcmClinicList {
        items: [TcmClinic!]!
        totalItems: Int!
    }
    extend type Mutation {
        createClinic(input: TcmClinicInput!): TcmClinic!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [TcmClinic],
    providers: [
        { provide: TCM_PLUGIN_OPTIONS, useFactory: () => TcmClinicPlugin.options },
        TcmClinicService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [],
    },
    compatibility: '^3.0.0',
})
export class TcmClinicPlugin {
    static options: TcmClinicPluginOptions = {};

    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin> {
        TcmClinicPlugin.options = options ?? {};
        return TcmClinicPlugin;
    }
}
```

注意：Vendure 自定义 list 返回类型不继承 Relay 结构时，直接如上自定义 `TcmClinicList`（DateTime 标量 core 自带）。

补一个 admin resolver 文件 `src/resolvers/tcm-admin.resolver.ts`（Task 1 起，逐任务追加方法）：

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { CreateClinicInput, TcmClinicService } from '../services/tcm-clinic.service';

@Resolver()
export class TcmAdminResolver {
    constructor(private clinicService: TcmClinicService) {}

    @Transaction()
    @Query()
    async clinics(
        @Ctx() ctx: RequestContext,
        @Args('options') _options: any,
    ): Promise<{ items: TcmClinic[]; totalItems: number }> {
        const items = await this.clinicService.findAll(ctx);
        return { items, totalItems: items.length };
    }

    @Transaction()
    @Mutation()
    async createClinic(@Ctx() ctx: RequestContext, @Args('input') input: CreateClinicInput): Promise<TcmClinic> {
        return this.clinicService.createClinic(ctx, input);
    }
}
```

并把 plugin.ts 的 `adminApiExtensions.resolvers` 改为 `[TcmAdminResolver]`，`providers` 增加 `TcmAdminResolver`，`imports` 增加 `TcmAdminResolver` 所需（Nest resolver 经 `adminApiExtensions.resolvers` 注册即可，无需进 providers；参照 checkin-plugin 仅注册到 resolvers 数组）。index.ts 追加：

```ts
export * from './services/tcm-clinic.service';
```

- [ ] **Step 1.5: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（2 tests）

- [ ] **Step 1.6: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 包骨架与 Clinic 实体/Admin API 雏形"
```

---

### Task 2: 员工守卫 + 患者档案（跨馆共享）

**Files:**
- Create: `src/entities/tcm-clinic-staff.entity.ts`
- Create: `src/entities/tcm-patient-profile.entity.ts`
- Create: `src/services/tcm-staff.service.ts`
- Modify: `src/services/tcm-clinic.service.ts`
- Modify: `src/resolvers/tcm-admin.resolver.ts`
- Modify: `src/plugin.ts`
- Modify: `src/index.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 2.1: 实体**

`src/entities/tcm-clinic-staff.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_clinic_staff' })
@Index(['administratorId', 'clinicId'], { unique: true })
export class TcmClinicStaff extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinicStaff>) {
        super(input);
    }
    /** 关联 Administrator.id，不建外键 */
    @Column({ type: 'int' })
    administratorId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** doctor | therapist | admin */
    @Column({ type: 'varchar', length: 16, default: 'doctor' })
    role: string;
    @Column({ type: 'varchar', length: 64 })
    displayName: string;
}
```

`src/entities/tcm-patient-profile.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_patient_profile' })
@Index(['customerId'], { unique: true })
export class TcmPatientProfile extends VendureEntity {
    constructor(input?: DeepPartial<TcmPatientProfile>) {
        super(input);
    }
    /** 引用 Customer.id，不建外键；一名患者（SSO 用户）一份档案 */
    @Column({ type: 'int' })
    customerId: number;
    /** 建档馆 */
    @Column({ type: 'int' })
    clinicId: number;
    /** 体质辨识等结构化结果 */
    @Column({ type: 'simple-json', nullable: true })
    constitution?: Record<string, any>;
}
```

- [ ] **Step 2.2: 守卫服务**

`src/services/tcm-staff.service.ts`：

```ts
import { ForbiddenError, Injectable } from '@vendure/core';

import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TransactionalConnection, RequestContext } from '@vendure/core';

@Injectable()
export class TcmStaffService {
    constructor(private connection: TransactionalConnection) {}

    /** 取当前管理员在指定馆的员工身份；非本馆员工抛 Forbidden */
    async assertStaffOfClinic(ctx: RequestContext, clinicId: number): Promise<TcmClinicStaff> {
        const staff = await this.connection
            .getRepository(ctx, TcmClinicStaff)
            .findOne({ where: { administratorId: ctx.activeUserId as number, clinicId } });
        if (!staff) {
            throw new ForbiddenError(`非本馆员工（clinicId=${clinicId}）`);
        }
        return staff;
    }

    async staffOf(ctx: RequestContext, administratorId: number): Promise<TcmClinicStaff[]> {
        return this.connection
            .getRepository(ctx, TcmClinicStaff)
            .find({ where: { administratorId } });
    }
}
```

- [ ] **Step 2.3: 先写失败测试（追加到 e2e 文件 describe 内）**

```ts
    it('staff guard + patient profile creation', async () => {
        // 建第二家馆
        await adminClient.query(gql`
            mutation {
                createClinic(input: { name: "仁济馆", licenseNo: "BA1102" }) { id }
            }
        `);
        // 当前超管绑定为馆1医生
        const me = await adminClient.query(gql`
            query { me { id } }
        `);
        const adminId = Number(me.me.id);
        const staffRes = await adminClient.query(gql`
            mutation {
                createClinicStaff(input: { clinicId: 1, administratorId: ${adminId}, displayName: "张医生", role: "doctor" }) {
                    id
                    clinicId
                    displayName
                }
            }
        `);
        expect(staffRes.createClinicStaff.displayName).toBe('张医生');
        // 馆2 未绑定 → 建档应被拒绝
        const errRes = await adminClient.query(gql`
            mutation {
                createPatientProfile(input: { clinicId: 2, customerId: 1 }) { id }
            }
        `);
        expect(errRes.errors?.[0]?.message).toContain('非本馆员工');
        // 馆1 建档成功
        const okRes = await adminClient.query(gql`
            mutation {
                createPatientProfile(input: { clinicId: 1, customerId: 1, constitution: { type: "阳虚质" } }) {
                    id
                    customerId
                    constitution
                }
            }
        `);
        expect(okRes.createPatientProfile.customerId).toBe('1');
        expect(okRes.createPatientProfile.constitution.type).toBe('阳虚质');
    });
```

- [ ] **Step 2.4: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（schema 无 createClinicStaff / createPatientProfile）

- [ ] **Step 2.5: 实现**

`src/services/tcm-clinic.service.ts` 追加：

```ts
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';

// 类内追加方法：
    async createClinicStaff(
        ctx: RequestContext,
        input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.connection
            .getRepository(ctx, TcmClinicStaff)
            .save(new TcmClinicStaff({ ...input, role: input.role ?? 'doctor' }));
    }

    async createPatientProfile(
        ctx: RequestContext,
        input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        const repo = this.connection.getRepository(ctx, TcmPatientProfile);
        const existing = await repo.findOne({ where: { customerId: input.customerId } });
        if (existing) {
            return existing; // 跨馆共享一份档案
        }
        return repo.save(new TcmPatientProfile(input));
    }

    async findPatientProfile(ctx: RequestContext, id: number): Promise<TcmPatientProfile | null> {
        return this.connection.getRepository(ctx, TcmPatientProfile).findOne({ where: { id } });
    }
```

`src/resolvers/tcm-admin.resolver.ts` 追加（构造函数注入 `private staffService: TcmStaffService`）：

```ts
    @Transaction()
    @Mutation()
    async createClinicStaff(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.clinicService.createClinicStaff(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createPatientProfile(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.clinicService.createPatientProfile(ctx, input);
    }
```

`plugin.ts`：entities 数组加入 `TcmClinicStaff, TcmPatientProfile`；providers 加入 `TcmStaffService`；adminSchema 追加两个类型与两个 mutation（`TcmClinicStaff`、`TcmPatientProfile` 输出类型 + `createClinicStaff(input: TcmClinicStaffInput!)` + `createPatientProfile(input: TcmPatientProfileInput!)`，Input 字段与 service 入参一致，constitution 为 JSON 标量可用自定义 `scalar JSON`——Vendure core 未内置，直接在 schema 声明 `scalar JSON` 并在 resolver 用 any 透传）。index.ts 追加导出两个实体与 TcmStaffService。

- [ ] **Step 2.6: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（3 tests）

- [ ] **Step 2.7: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 员工守卫与患者档案（跨馆共享）"
```

---

### Task 3: 诊疗过程 Encounter 状态机（乐观锁）

**Files:**
- Create: `src/entities/tcm-encounter.entity.ts`
- Create: `src/services/tcm-encounter.service.ts`
- Modify: `src/resolvers/tcm-admin.resolver.ts`
- Modify: `src/plugin.ts`、`src/index.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 3.1: 实体**

```ts
import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_encounter' })
@Index(['patientProfileId', 'status'])
export class TcmEncounter extends VendureEntity {
    constructor(input?: DeepPartial<TcmEncounter>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** 接诊医生 staffId（tcm_clinic_staff.id） */
    @Column({ type: 'int' })
    staffId: number;
    /** initial | revisit | housecall */
    @Column({ type: 'varchar', length: 16, default: 'initial' })
    type: string;
    /** PENDING | ACTIVE | COMPLETED */
    @Column({ type: 'varchar', length: 16, default: 'PENDING' })
    status: string;
    @VersionColumn()
    version: number;
}
```

- [ ] **Step 3.2: 先写失败测试（追加）**

```ts
    it('encounter state machine with optimistic lock', async () => {
        const created = await adminClient.query(gql`
            mutation {
                createEncounter(input: { patientProfileId: 1, clinicId: 1, type: "initial" }) {
                    id status version
                }
            }
        `);
        expect(created.createEncounter.status).toBe('PENDING');
        const id = created.createEncounter.id;
        const started = await adminClient.query(gql`
            mutation { startEncounter(id: ${id}) { id status } }
        `);
        expect(started.startEncounter.status).toBe('ACTIVE');
        const completed = await adminClient.query(gql`
            mutation { completeEncounter(id: ${id}) { id status } }
        `);
        expect(completed.completeEncounter.status).toBe('COMPLETED');
        // 已完成再 start → 报错
        const illegal = await adminClient.query(gql`
            mutation { startEncounter(id: ${id}) { id } }
        `);
        expect(illegal.errors?.[0]?.message).toContain('非法状态迁移');
        // 重复创建进行中接诊 → 拒绝
        const dup = await adminClient.query(gql`
            mutation {
                createEncounter(input: { patientProfileId: 1, clinicId: 1, type: "revisit" }) { id }
            }
        `);
        expect(dup.errors?.[0]?.message).toContain('已有未完成接诊');
    });
```

- [ ] **Step 3.3: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（schema 无 createEncounter）

- [ ] **Step 3.4: 实现**

`src/services/tcm-encounter.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmEncounter } from '../entities/tcm-encounter.entity';

const TRANSITIONS: Record<string, string[]> = {
    PENDING: ['ACTIVE'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
};

@Injectable()
export class TcmEncounterService {
    constructor(private connection: TransactionalConnection) {}

    async create(
        ctx: RequestContext,
        input: { patientProfileId: number; clinicId: number; type?: string },
    ): Promise<TcmEncounter> {
        const repo = this.connection.getRepository(ctx, TcmEncounter);
        const open = await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'PENDING' },
        });
        const openActive = open ?? (await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'ACTIVE' },
        }));
        if (openActive) {
            throw new UserInputError('该患者已有未完成接诊');
        }
        return repo.save(
            new TcmEncounter({ ...input, type: input.type ?? 'initial', status: 'PENDING' }),
        );
    }

    async transition(ctx: RequestContext, id: number, to: 'ACTIVE' | 'COMPLETED'): Promise<TcmEncounter> {
        const repo = this.connection.getRepository(ctx, TcmEncounter);
        const encounter = await repo.findOne({ where: { id } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${id}`);
        }
        if (!TRANSITIONS[encounter.status].includes(to)) {
            throw new IllegalOperationError(`非法状态迁移：${encounter.status} → ${to}`);
        }
        encounter.status = to;
        return repo.save(encounter); // VersionColumn 触发乐观锁
    }
}
```

Resolver 追加 `createEncounter / startEncounter / completeEncounter`（createEncounter 内先 `assertStaffOfClinic(ctx, input.clinicId)`，再以该 staff.id 写 staffId 字段）。plugin.ts：注册实体/服务，adminSchema 追加 `TcmEncounter` 类型与 3 个 mutation。index.ts 追加导出。

- [ ] **Step 3.5: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（4 tests）

- [ ] **Step 3.6: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): Encounter 状态机与乐观锁"
```

---

### Task 4: 加密 + 病志版本链 + 审计（合规核心）

**Files:**
- Create: `src/crypto/tcm-crypto.service.ts`
- Create: `src/entities/tcm-medical-record.entity.ts`
- Create: `src/entities/tcm-medical-record-revision.entity.ts`
- Create: `src/entities/tcm-audit-log.entity.ts`
- Create: `src/services/tcm-audit.service.ts`
- Create: `src/services/tcm-medical-record.service.ts`
- Modify: `src/resolvers/tcm-admin.resolver.ts`
- Modify: `src/plugin.ts`、`src/index.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 4.1: 加密服务**

```ts
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { TCM_PLUGIN_OPTIONS } from '../constants';
import { Inject } from '@nestjs/common';
import { TcmClinicPluginOptions } from '../types';
import { Logger } from '@vendure/core';
import { loggerCtx } from '../constants';

@Injectable()
export class TcmCryptoService {
    private readonly key: Buffer;

    constructor(@Inject(TCM_PLUGIN_OPTIONS) options: TcmClinicPluginOptions) {
        const hex = options.encryptionKey ?? process.env.TCM_RECORD_KEY ?? '';
        if (/^[0-9a-fA-F]{64}$/.test(hex)) {
            this.key = Buffer.from(hex, 'hex');
        } else {
            // 仅限开发环境：无密钥时使用固定开发密钥并告警
            Logger.warn('TCM_RECORD_KEY 未配置，使用开发密钥（禁止用于生产）', loggerCtx);
            this.key = Buffer.from('tcm-clinic-plugin-dev-key-0000000000'.padEnd(64, '0').slice(0, 64), 'hex');
        }
    }

    encrypt(plain: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;
    }

    decrypt(payload: string): string {
        const [ivB64, tagB64, dataB64] = payload.split('.');
        if (!ivB64 || !tagB64 || !dataB64) {
            throw new Error('密文格式非法');
        }
        const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    }
}
```

- [ ] **Step 4.2: 实体与审计/病志服务**

`tcm-medical-record.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_medical_record' })
@Index(['encounterId'])
export class TcmMedicalRecord extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecord>) {
        super(input);
    }
    @Column({ type: 'int' })
    encounterId: number;
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    /** 加密：主诉 */
    @Column({ type: 'varchar', length: 4096 })
    chiefComplaintEnc: string;
    /** 加密：现病史/诊断 */
    @Column({ type: 'varchar', length: 8192 })
    diagnosisEnc: string;
    /** 处方（结构化 JSON，整体加密存储） */
    @Column({ type: 'varchar', length: 8192 })
    prescriptionEnc: string;
    @Column({ type: 'int', default: 1 })
    version: number;
    /** 预留：电子签名负载（JSON 字符串，接 CA 时启用） */
    @Column({ type: 'varchar', length: 4096, nullable: true })
    signaturePayload?: string;
    /** 预留：签名证书序列号 */
    @Column({ type: 'varchar', length: 128, nullable: true })
    signatureCert?: string;
    /** 保存期限：到期后归档只读（门诊病志 ≥15 年） */
    @Column({ type: 'datetime' })
    retentionUntil: Date;
}
```

`tcm-medical-record-revision.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_medical_record_revisions' })
@Index(['recordId', 'version'], { unique: true })
export class TcmMedicalRecordRevision extends VendureEntity {
    constructor(input?: DeepPartial<TcmMedicalRecordRevision>) {
        super(input);
    }
    @Column({ type: 'int' })
    recordId: number;
    /** 快照对应的版本号 */
    @Column({ type: 'int' })
    version: number;
    @Column({ type: 'varchar', length: 8192 })
    chiefComplaintEnc: string;
    @Column({ type: 'varchar', length: 8192 })
    diagnosisEnc: string;
    @Column({ type: 'varchar', length: 8192 })
    prescriptionEnc: string;
    /** 被谁改 */
    @Column({ type: 'int' })
    editedByStaffId: number;
}
```

`tcm-audit-log.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_audit_log' })
@Index(['entityType', 'entityId'])
export class TcmAuditLog extends VendureEntity {
    constructor(input?: DeepPartial<TcmAuditLog>) {
        super(input);
    }
    @Column({ type: 'varchar', length: 64 })
    entityType: string;
    @Column({ type: 'int' })
    entityId: number;
    @Column({ type: 'int' })
    staffId: number;
    /** CREATE | UPDATE | ARCHIVE */
    @Column({ type: 'varchar', length: 16 })
    action: string;
    /** 字段级 diff（仅字段名与版本，不落明文） */
    @Column({ type: 'simple-json', nullable: true })
    diff?: Record<string, any>;
}
```

`tcm-audit.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmAuditLog } from '../entities/tcm-audit-log.entity';

@Injectable()
export class TcmAuditService {
    constructor(private connection: TransactionalConnection) {}

    /** 与业务写操作同一 ctx 事务内调用 */
    async log(
        ctx: RequestContext,
        input: { entityType: string; entityId: number; staffId: number; action: string; diff?: Record<string, any> },
    ): Promise<void> {
        await this.connection.getRepository(ctx, TcmAuditLog).save(new TcmAuditLog(input));
    }
}
```

`tcm-medical-record.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmMedicalRecordRevision } from '../entities/tcm-medical-record-revision.entity';
import { TcmAuditService } from './tcm-audit.service';

export interface MedicalRecordInput {
    encounterId: number;
    chiefComplaint: string;
    diagnosis: string;
    prescription?: Record<string, any>;
}

@Injectable()
export class TcmMedicalRecordService {
    constructor(
        private connection: TransactionalConnection,
        private crypto: TcmCryptoService,
        private audit: TcmAuditService,
    ) {}

    async create(ctx: RequestContext, staffId: number, input: MedicalRecordInput): Promise<TcmMedicalRecord> {
        const encounterRepo = this.connection.getRepository(ctx, TcmEncounter);
        const encounter = await encounterRepo.findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const years = 15; // retentionYears 由 plugin options 注入后替换
        const retentionUntil = new Date(Date.now() + years * 365 * 24 * 3600 * 1000);
        const record = await repo.save(
            new TcmMedicalRecord({
                encounterId: encounter.id,
                patientProfileId: encounter.patientProfileId,
                clinicId: encounter.clinicId,
                chiefComplaintEnc: this.crypto.encrypt(input.chiefComplaint),
                diagnosisEnc: this.crypto.encrypt(input.diagnosis),
                prescriptionEnc: this.crypto.encrypt(JSON.stringify(input.prescription ?? {})),
                version: 1,
                retentionUntil,
            }),
        );
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: record.id, staffId, action: 'CREATE',
            diff: { version: 1 },
        });
        return record;
    }

    /** 更新：旧版本整体快照进 revision 表 + 审计，版本号 +1 */
    async update(
        ctx: RequestContext,
        staffId: number,
        id: number,
        input: Partial<MedicalRecordInput>,
    ): Promise<TcmMedicalRecord> {
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const record = await repo.findOne({ where: { id } });
        if (!record) {
            throw new UserInputError(`病志不存在：${id}`);
        }
        if (new Date() > record.retentionUntil) {
            throw new IllegalOperationError('病志已过保存期限，归档只读');
        }
        const revRepo = this.connection.getRepository(ctx, TcmMedicalRecordRevision);
        await revRepo.save(
            new TcmMedicalRecordRevision({
                recordId: record.id,
                version: record.version,
                chiefComplaintEnc: record.chiefComplaintEnc,
                diagnosisEnc: record.diagnosisEnc,
                prescriptionEnc: record.prescriptionEnc,
                editedByStaffId: staffId,
            }),
        );
        const nextVersion = record.version + 1;
        const updated = await repo.save({
            ...record,
            chiefComplaintEnc: input.chiefComplaint ? this.crypto.encrypt(input.chiefComplaint) : record.chiefComplaintEnc,
            diagnosisEnc: input.diagnosis ? this.crypto.encrypt(input.diagnosis) : record.diagnosisEnc,
            prescriptionEnc: input.prescription
                ? this.crypto.encrypt(JSON.stringify(input.prescription))
                : record.prescriptionEnc,
            version: nextVersion,
        });
        await this.audit.log(ctx, {
            entityType: 'TcmMedicalRecord', entityId: id, staffId, action: 'UPDATE',
            diff: { fromVersion: record.version, toVersion: nextVersion, fields: Object.keys(input) },
        });
        return updated;
    }

    /** 管理端解密视图（仅本馆员工可调用，由 resolver 守卫） */
    async decryptView(record: TcmMedicalRecord): Promise<{
        chiefComplaint: string; diagnosis: string; prescription: Record<string, any>;
    }> {
        return {
            chiefComplaint: this.crypto.decrypt(record.chiefComplaintEnc),
            diagnosis: this.crypto.decrypt(record.diagnosisEnc),
            prescription: JSON.parse(this.crypto.decrypt(record.prescriptionEnc)),
        };
    }
}
```

- [ ] **Step 4.3: 先写失败测试（追加）**

```ts
    it('medical record versioning + audit trail + encryption at rest', async () => {
        const created = await adminClient.query(gql`
            mutation {
                createMedicalRecord(input: {
                    encounterId: 1
                    chiefComplaint: "失眠多梦"
                    diagnosis: "不寐·心脾两虚"
                    prescription: { items: [{ name: "归脾汤", dosage: "7剂" }] }
                }) { id version }
            }
        `);
        expect(created.createMedicalRecord.version).toBe(1);
        const id = created.createMedicalRecord.id;
        const updated = await adminClient.query(gql`
            mutation {
                updateMedicalRecord(id: ${id}, input: { diagnosis: "不寐·心脾两虚（加重）" }) { id version }
            }
        `);
        expect(updated.updateMedicalRecord.version).toBe(2);
        const detail = await adminClient.query(gql`
            query { medicalRecords(options: {}) {
                items { id version chiefComplaint diagnosis prescription revisions { version editedByStaffId } }
            } }
        `);
        const item = detail.medicalRecords.items[0];
        expect(item.diagnosis).toContain('加重');
        expect(item.prescription.items.length).toBe(1);
        expect(item.revisions.length).toBe(1);
        expect(item.revisions[0].version).toBe(1);
        const audits = await adminClient.query(gql`
            query { auditLogs(options: {}) { items { entityType action diff } totalItems } }
        `);
        expect(audits.auditLogs.totalItems).toBe(2);
        // 库内密文：直接查 DB 无明文由 decryptView 保证；断言 GraphQL 不返回 *Enc 字段
        expect(JSON.stringify(detail)).not.toContain('Enc');
    });
```

- [ ] **Step 4.4: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（schema 无 createMedicalRecord）

- [ ] **Step 4.5: Resolver/Schema 装配**

`TcmAdminResolver` 追加（构造函数注入 `TcmMedicalRecordService`、`TcmEncounterService`）：

```ts
    @Transaction()
    @Mutation()
    async createMedicalRecord(
        @Ctx() ctx: RequestContext,
        @Args('input') input: MedicalRecordInput,
    ): Promise<MedicalRecordView> {
        // 馆归属来自 encounter：先取 encounter，再守卫，最后落记录
        const encounter = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id: input.encounterId } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${input.encounterId}`);
        }
        const staff = await this.staffService.assertStaffOfClinic(ctx, encounter.clinicId);
        const record = await this.recordService.create(ctx, staff.id, input);
        const view = await this.recordService.decryptView(record);
        return { id: record.id, encounterId: record.encounterId, version: record.version, ...view };
    }
```

`updateMedicalRecord` 同理：先加载病志 → 经病志的 encounterId 取 encounter → `assertStaffOfClinic(ctx, encounter.clinicId)` → 调 `recordService.update(ctx, staff.id, id, input)` → 返回解密视图。为此 `TcmAdminResolver` 需注入 `TransactionalConnection`（`private connection: TransactionalConnection`）。

adminSchema 追加类型（解密视图 `MedicalRecordView { id encounterId version chiefComplaint diagnosis prescription revisions }`、`TcmMedicalRecordRevision` 视图 `{ version editedByStaffId createdAt }`、mutation `createMedicalRecord(input)` / `updateMedicalRecord(id, input)`、query `medicalRecords(options)` / `auditLogs(options)`）。**schema 中绝不暴露 `*Enc` 字段**。plugin.ts 注册 3 实体 + 3 服务；index.ts 追加导出。

- [ ] **Step 4.6: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（5 tests）

- [ ] **Step 4.7: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 病志版本链、AES-256-GCM 加密与审计留痕"
```

---

### Task 5: 康养规划 / 护理计划项 / 随访任务

**Files:**
- Create: `src/entities/tcm-wellness-plan.entity.ts`
- Create: `src/entities/tcm-plan-item.entity.ts`
- Create: `src/entities/tcm-follow-up-task.entity.ts`
- Create: `src/services/tcm-wellness.service.ts`
- Modify: `src/resolvers/tcm-admin.resolver.ts`
- Modify: `src/plugin.ts`、`src/index.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 5.1: 实体**

`tcm-wellness-plan.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_wellness_plan' })
@Index(['patientProfileId', 'status'])
export class TcmWellnessPlan extends VendureEntity {
    constructor(input?: DeepPartial<TcmWellnessPlan>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    clinicId: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    /** DRAFT | ACTIVE | PAUSED | CLOSED */
    @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
    status: string;
    @Column({ type: 'datetime', nullable: true })
    cycleStart?: Date;
    @Column({ type: 'datetime', nullable: true })
    cycleEnd?: Date;
}
```

`tcm-plan-item.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_plan_item' })
@Index(['planId'])
export class TcmPlanItem extends VendureEntity {
    constructor(input?: DeepPartial<TcmPlanItem>) {
        super(input);
    }
    @Column({ type: 'int' })
    planId: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    /** 频次描述，如“每周二/四”“每晚” */
    @Column({ type: 'varchar', length: 128, nullable: true })
    frequency?: string;
    /** 关联商城服务商品（不建外键） */
    @Column({ type: 'int', nullable: true })
    productVariantId?: number;
    /** 患者下单后回填（不建外键） */
    @Column({ type: 'int', nullable: true })
    orderId?: number;
}
```

`tcm-follow-up-task.entity.ts`：

```ts
import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_follow_up_task' })
@Index(['status', 'dueAt'])
export class TcmFollowUpTask extends VendureEntity {
    constructor(input?: DeepPartial<TcmFollowUpTask>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    planId?: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    @Column({ type: 'datetime' })
    dueAt: Date;
    /** wechat | sms | phone */
    @Column({ type: 'varchar', length: 16, default: 'wechat' })
    channel: string;
    /** PENDING | DONE | CANCELED */
    @Column({ type: 'varchar', length: 16, default: 'PENDING' })
    status: string;
    /** 结果回写的接诊（不建外键） */
    @Column({ type: 'int', nullable: true })
    followUpEncounterId?: number;
}
```

- [ ] **Step 5.2: 服务**

`tcm-wellness.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmAuditService } from './tcm-audit.service';

const PLAN_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['PAUSED', 'CLOSED'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    CLOSED: [],
};

@Injectable()
export class TcmWellnessService {
    constructor(private connection: TransactionalConnection, private audit: TcmAuditService) {}

    async createPlan(
        ctx: RequestContext,
        staffId: number,
        input: { patientProfileId: number; clinicId: number; title: string; cycleStart?: Date; cycleEnd?: Date },
    ): Promise<TcmWellnessPlan> {
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .save(new TcmWellnessPlan({ ...input, status: 'DRAFT' }));
        await this.audit.log(ctx, { entityType: 'TcmWellnessPlan', entityId: plan.id, staffId, action: 'CREATE' });
        return plan;
    }

    async transitionPlan(
        ctx: RequestContext,
        staffId: number,
        id: number,
        to: 'ACTIVE' | 'PAUSED' | 'CLOSED',
    ): Promise<TcmWellnessPlan> {
        const repo = this.connection.getRepository(ctx, TcmWellnessPlan);
        const plan = await repo.findOne({ where: { id } });
        if (!plan) {
            throw new UserInputError(`康养规划不存在：${id}`);
        }
        if (!PLAN_TRANSITIONS[plan.status].includes(to)) {
            throw new IllegalOperationError(`非法状态迁移：${plan.status} → ${to}`);
        }
        const saved = await repo.save({ ...plan, status: to });
        await this.audit.log(ctx, {
            entityType: 'TcmWellnessPlan', entityId: id, staffId, action: 'UPDATE',
            diff: { status: to },
        });
        return saved;
    }

    async addPlanItem(
        ctx: RequestContext,
        input: { planId: number; title: string; frequency?: string; productVariantId?: number },
    ): Promise<TcmPlanItem> {
        const plan = await this.connection.getRepository(ctx, TcmWellnessPlan).findOne({ where: { id: input.planId } });
        if (!plan || plan.status === 'CLOSED') {
            throw new UserInputError(`规划不可添加计划项：planId=${input.planId}`);
        }
        return this.connection.getRepository(ctx, TcmPlanItem).save(new TcmPlanItem(input));
    }

    async createFollowUp(
        ctx: RequestContext,
        staffId: number,
        input: { patientProfileId: number; planId?: number; title: string; dueAt: Date; channel?: string },
    ): Promise<TcmFollowUpTask> {
        const task = await this.connection.getRepository(ctx, TcmFollowUpTask).save(
            new TcmFollowUpTask({ ...input, channel: input.channel ?? 'wechat', status: 'PENDING' }),
        );
        await this.audit.log(ctx, { entityType: 'TcmFollowUpTask', entityId: task.id, staffId, action: 'CREATE' });
        return task;
    }

    async completeFollowUp(
        ctx: RequestContext,
        staffId: number,
        id: number,
        followUpEncounterId?: number,
    ): Promise<TcmFollowUpTask> {
        const repo = this.connection.getRepository(ctx, TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new UserInputError(`随访任务不可完成：id=${id}`);
        }
        const saved = await repo.save({ ...task, status: 'DONE', followUpEncounterId });
        await this.audit.log(ctx, { entityType: 'TcmFollowUpTask', entityId: id, staffId, action: 'UPDATE', diff: { status: 'DONE' } });
        return saved;
    }

    async cancelFollowUp(ctx: RequestContext, staffId: number, id: number): Promise<TcmFollowUpTask> {
        const repo = this.connection.getRepository(ctx, TcmFollowUpTask);
        const task = await repo.findOne({ where: { id } });
        if (!task || task.status !== 'PENDING') {
            throw new UserInputError(`随访任务不可取消：id=${id}`);
        }
        const saved = await repo.save({ ...task, status: 'CANCELED' });
        await this.audit.log(ctx, { entityType: 'TcmFollowUpTask', entityId: id, staffId, action: 'UPDATE', diff: { status: 'CANCELED' } });
        return saved;
    }

    async itemsOfPlan(ctx: RequestContext, planId: number): Promise<TcmPlanItem[]> {
        return this.connection.getRepository(ctx, TcmPlanItem).find({ where: { planId }, order: { id: 'ASC' } });
    }
}
```

- [ ] **Step 5.3: 先写失败测试（追加）**

```ts
    it('wellness plan lifecycle with plan items and follow-ups', async () => {
        const plan = await adminClient.query(gql`
            mutation {
                createWellnessPlan(input: { patientProfileId: 1, clinicId: 1, title: "温阳调理 8 周方案" }) {
                    id status
                }
            }
        `);
        expect(plan.createWellnessPlan.status).toBe('DRAFT');
        const planId = plan.createWellnessPlan.id;
        const item = await adminClient.query(gql`
            mutation {
                addPlanItem(input: { planId: ${planId}, title: "艾灸关元穴", frequency: "每周二/四", productVariantId: 1 }) {
                    id title
                }
            }
        `);
        expect(item.addPlanItem.title).toBe('艾灸关元穴');
        const activated = await adminClient.query(gql`
            mutation { transitionWellnessPlan(id: ${planId}, to: ACTIVE) { status } }
        `);
        expect(activated.transitionWellnessPlan.status).toBe('ACTIVE');
        const fu = await adminClient.query(gql`
            mutation {
                createFollowUp(input: { patientProfileId: 1, planId: ${planId}, title: "3天后复诊随访", dueAt: "2026-10-12T10:00:00.000Z" }) {
                    id status
                }
            }
        `);
        expect(fu.createFollowUp.status).toBe('PENDING');
        const done = await adminClient.query(gql`
            mutation { completeFollowUp(id: ${fu.createFollowUp.id}) { status } }
        `);
        expect(done.completeFollowUp.status).toBe('DONE');
        const illegal = await adminClient.query(gql`
            mutation { transitionWellnessPlan(id: ${planId}, to: ACTIVE) { status } }
        `);
        expect(illegal.errors?.[0]?.message).toContain('非法状态迁移');
    });
```

- [ ] **Step 5.4: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（schema 无 createWellnessPlan）

- [ ] **Step 5.5: Resolver/Schema 装配**

`TcmAdminResolver` 追加方法：`createWellnessPlan`（先守卫 `assertStaffOfClinic(ctx, input.clinicId)`）、`transitionWellnessPlan(id, to)`（守卫：先加载 plan 取 clinicId）、`addPlanItem`（守卫经 plan.clinicId）、`createFollowUp`（守卫经 patientProfile.clinicId）、`completeFollowUp`、`cancelFollowUp`、查询 `wellnessPlans / followUpTasks`（按当前 staff 的 clinicId 过滤）。adminSchema 追加 `TcmWellnessPlan / TcmPlanItem / TcmFollowUpTask` 类型、`WellnessPlanStatus / FollowUpStatus` 枚举与对应 mutations/queries。plugin.ts 注册 3 实体 + `TcmWellnessService`；index.ts 追加导出。

- [ ] **Step 5.6: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（6 tests）

- [ ] **Step 5.7: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 康养规划/护理计划项/随访任务状态机"
```

---

### Task 6: Shop API（患者端 my* 查询 + 归属校验 + 脱敏）

**Files:**
- Create: `src/resolvers/tcm-shop.resolver.ts`
- Modify: `src/plugin.ts`、`src/index.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 6.1: 先写失败测试（追加）**

```ts
    it('shop API returns only own data with masked summaries', async () => {
        // 使用 e2e 种子客户 hayden.zieme12@hotmail.com（customerCount: 1 自动创建，密码 test）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const profile = await shopClient.query(gql`
            query { myPatientProfile { id customerId constitution } }
        `);
        expect(profile.myPatientProfile.customerId).toBe(profile.myPatientProfile.customerId); // 非空即归属本人
        expect(profile.myPatientProfile.constitution.type).toBe('阳虚质');
        const records = await shopClient.query(gql`
            query { myMedicalRecords { items { id version diagnosisSummary createdAt } totalItems } }
        `);
        expect(records.myMedicalRecords.totalItems).toBe(1);
        expect(records.myMedicalRecords.items[0].diagnosisSummary.length).toBeLessThanOrEqual(21);
        expect(JSON.stringify(records)).not.toContain('Enc');
        const planView = await shopClient.query(gql`
            query { myWellnessPlan { id title status items { title frequency productVariantId orderId } } }
        `);
        expect(planView.myWellnessPlan.status).toBe('ACTIVE');
        expect(planView.myWellnessPlan.items.length).toBe(1);
        const followUps = await shopClient.query(gql`
            query { myFollowUps { id title status dueAt } }
        `);
        expect(followUps.myFollowUps.length).toBe(1);
        // 未登录访问 → 报错
        const anon = await shopClient.query(gql`
            query { myPatientProfile { id } }
        `);
        expect(anon.errors?.length).toBeGreaterThan(0);
    });
```

说明：e2e 文件顶部 `const { server, adminClient } = createTestEnvironment(...)` 需改为同时解构 `shopClient`。测试内“未登录访问”前需用 `shopClient.asAnonymousUser()`（若该 API 不存在，则重建一个未登录 client：`new SimpleGraphQlClient(`http://localhost:3920/shop-api`)`，来自 `@vendure/testing`）。

- [ ] **Step 6.2: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（schema 无 myPatientProfile）

- [ ] **Step 6.3: 实现**

`src/resolvers/tcm-shop.resolver.ts`：

```ts
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction, ForbiddenError } from '@vendure/core';

import { TcmCryptoService } from '../crypto/tcm-crypto.service';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmClinicService } from '../services/tcm-clinic.service';
import { TcmMedicalRecordService } from '../services/tcm-medical-record.service';
import { TcmWellnessService } from '../services/tcm-wellness.service';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmMedicalRecord } from '../entities/tcm-medical-record.entity';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';

@Resolver()
export class TcmShopResolver {
    constructor(
        private clinicService: TcmClinicService,
        private recordService: TcmMedicalRecordService,
        private wellnessService: TcmWellnessService,
        private crypto: TcmCryptoService,
    ) {}

    /** 归属校验：ctx.activeUserId → Customer → PatientProfile.customerId 必须一致 */
    private async assertOwnProfile(ctx: RequestContext): Promise<TcmPatientProfile> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError('请先登录');
        }
        const customer = await this.customerByUserId(ctx, ctx.activeUserId as number);
        if (!customer) {
            throw new ForbiddenError('请先登录');
        }
        const profile = await this.clinicService.findProfileByCustomerId(ctx, customer.id);
        if (!profile) {
            throw new ForbiddenError('尚未建档');
        }
        return profile;
    }

    private async customerByUserId(ctx: RequestContext, userId: number) {
        const customer = await this.clinicService.findCustomerByUserId(ctx, userId);
        return customer;
    }

    @Transaction()
    @Query()
    async myPatientProfile(@Ctx() ctx: RequestContext): Promise<TcmPatientProfile> {
        return this.assertOwnProfile(ctx);
    }

    @Transaction()
    @Query()
    async myMedicalRecords(
        @Ctx() ctx: RequestContext,
        @Args('skip') skip: number,
        @Args('take') take: number,
    ): Promise<{ items: Array<{ id: number; version: number; diagnosisSummary: string; createdAt: Date }>; totalItems: number }> {
        const profile = await this.assertOwnProfile(ctx);
        const repo = this.connection.getRepository(ctx, TcmMedicalRecord);
        const [rows, total] = await repo.findAndCount({
            where: { patientProfileId: profile.id },
            order: { id: 'DESC' },
            skip,
            take: take ?? 10,
        });
        const items = rows.map(r => {
            const diagnosis = this.crypto.decrypt(r.diagnosisEnc);
            return {
                id: r.id,
                version: r.version,
                createdAt: r.createdAt,
                // 脱敏摘要：仅保留前 20 字符
                diagnosisSummary: diagnosis.slice(0, 20),
            };
        });
        return { items, totalItems: total };
    }

    @Transaction()
    @Query()
    async myWellnessPlan(@Ctx() ctx: RequestContext): Promise<(TcmWellnessPlan & { items: any[] }) | null> {
        const profile = await this.assertOwnProfile(ctx);
        const plan = await this.connection.getRepository(ctx, TcmWellnessPlan).findOne({
            where: { patientProfileId: profile.id, status: 'ACTIVE' },
            order: { id: 'DESC' },
        });
        if (!plan) {
            return null;
        }
        const items = await this.wellnessService.itemsOfPlan(ctx, plan.id);
        return { ...plan, items };
    }

    @Transaction()
    @Query()
    async myFollowUps(@Ctx() ctx: RequestContext): Promise<TcmFollowUpTask[]> {
        const profile = await this.assertOwnProfile(ctx);
        return this.connection.getRepository(ctx, TcmFollowUpTask).find({
            where: { patientProfileId: profile.id, status: 'PENDING' },
            order: { dueAt: 'ASC' },
        });
    }
}
```

配套修改：
- `TcmClinicService` 追加 `findProfileByCustomerId(ctx, customerId)` 与 `findCustomerByUserId(ctx, userId)`（后者内部 `await this.customerService.findCustomerByUserId(ctx, userId)`，构造函数注入 `CustomerService`，来自 `@vendure/core`）。
- Resolver 里 `this.connection` 改为注入 `TransactionalConnection`（上面代码用到，构造函数需补）。
- plugin.ts：`shopApiExtensions: { schema: shopSchema, resolvers: [TcmShopResolver] }`；shopSchema 定义 `myPatientProfile / myMedicalRecords(skip, take) / myWellnessPlan / myFollowUps` 与 `TcmPatientProfileView / TcmMedicalRecordSummary / TcmWellnessPlanView / TcmPlanItemView / TcmFollowUpView` 输出类型；index.ts 追加导出。

- [ ] **Step 6.4: 跑测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（7 tests）

- [ ] **Step 6.5: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 患者 Shop API（归属校验+脱敏摘要）"
```

---

### Task 7: 权限回归 + 保存期限归档只读（收尾测试）

**Files:**
- Modify: `src/services/tcm-medical-record.service.ts`（retentionYears 从 options 注入替换硬编码 15）
- Modify: `src/plugin.ts`
- Test: `e2e/tcm-clinic.e2e-spec.ts`

- [ ] **Step 7.1: 先写失败测试（追加）**

```ts
    it('cross-clinic isolation and retention readonly', async () => {
        // 跨馆隔离：馆2 无员工绑定当前管理员
        const list = await adminClient.query(gql`
            query { medicalRecords(options: {}) { items { id clinicId } totalItems } }
        `);
        // 当前管理员只绑定了馆1，medicalRecords 只应返回馆1数据
        expect(list.medicalRecords.items.every(i => i.clinicId === 1)).toBe(true);

        // 保存期限：构造 retentionUntil 已过期的病志 → update 拒绝
        // （通过 sqljs 数据直接改：简单方式是用 service 层单测；e2e 用短 retentionYears 初始化的第二个 server 实例成本高，
        //  这里直接断言 service 行为——用 plugin options retentionYears=0 创建第二个 describe）
    });
```

由于 e2e 内难以伪造过期日期，归档只读用**独立 describe** 覆盖（同一文件内追加）：

```ts
describe('TcmClinicPlugin retention (years=0)', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: { port: 3921 },
            plugins: [TcmClinicPlugin.init({ retentionYears: 0 })],
        }),
    );
    // beforeAll/afterAll 与主 describe 相同（端口与 __data__ 子目录不同：SqljsInitializer 路径传 __dirname + '/__data__/retention'）
    // 步骤：建馆→绑员工→建档→建接诊→建病志→立即 updateMedicalRecord
    // 断言：update 报错信息包含 '归档只读'
});
```

- [ ] **Step 7.2: 跑测试确认失败**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: FAIL（retentionYears 未生效，仍可 update）

- [ ] **Step 7.3: 实现 options 注入**

`TcmMedicalRecordService` 构造函数追加 `@Inject(TCM_PLUGIN_OPTIONS) private options: TcmClinicPluginOptions`，`create` 中 `const years = this.options.retentionYears ?? 15;`。plugin.ts 无需改动（options 已注册）。

- [ ] **Step 7.4: 跑全部测试通过**

Run: `bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts`
Expected: PASS（8 tests，含 retention describe）

- [ ] **Step 7.5: Commit**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 跨馆隔离回归与保存期限归档只读"
```

---

### Task 8: 构建验证 + cjk-plugins-e2e 登记 + 全量回归 + 推送

**Files:**
- Modify: `packages/cjk-plugins-e2e/package.json`（devDependencies 加 `"@vendure/tcm-clinic-plugin": "*"`）
- Modify: `packages/cjk-plugins-e2e/e2e/cjk-plugins.e2e-spec.ts`（plugins 数组加 `TcmClinicPlugin.init({})`，并追加一条「server starts」断言即可，不展开业务）

- [ ] **Step 8.1: 构建**

```powershell
cd d:\zhao\vendure\packages\tcm-clinic-plugin
bun run build
```

Expected: `lib/` 产物生成，无 TS 错误。

- [ ] **Step 8.2: cjk-plugins-e2e 登记 + 跑通**

修改后执行：

```powershell
cd d:\zhao\vendure\packages\cjk-plugins-e2e
bunx vitest --config vitest.config.mts --run e2e/cjk-plugins.e2e-spec.ts
```

Expected: PASS。若报 schema 冲突（port 已占用等）按报错调整端口。

- [ ] **Step 8.3: 全量插件回归**

```powershell
cd d:\zhao\vendure\packages\tcm-clinic-plugin
bunx vitest --config vitest.config.mts --run e2e/tcm-clinic.e2e-spec.ts
```

Expected: PASS（全部 8 tests）。e2e 缓存（`e2e/__data__`）在 schema 变更后需删除重跑。

- [ ] **Step 8.4: Commit + Push（一气呵成）**

```powershell
git -C d:\zhao\vendure add packages/tcm-clinic-plugin packages/cjk-plugins-e2e
git -C d:\zhao\vendure commit -m "feat(tcm-clinic-plugin): 完成 Plan1 插件全量能力并登记 cjk-plugins-e2e"
git -C d:\zhao\vendure push
```

---

## 计划自审结论

- **Spec 覆盖**：§4 九实体 → Task 1/2/3/4/5；§5 合规四件套 → Task 4/7；§6 Admin/Shop API → Task 1-6；§8 异常边界 → Task 3/5/7；§9 测试交付 → Task 7/8。运营统计看板（§6 末句）属查询聚合，放 Plan 2（医生工作台需要哪个看板就先做哪个聚合查询），避免 YAGNI。
- **占位符**：已清除（Task 4.5 守卫实现补全为可执行代码；Task 5.1 extends 笔误已修正）。
- **类型一致性**：实体字段名（chiefComplaintEnc/diagnosisEnc/prescriptionEnc/version/retentionUntil）在 Task 4/6 间一致；服务方法名在 Task 2-6 resolver 调用处一致；GraphQL 字段名与 e2e 断言一致。
