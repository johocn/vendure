# 中医馆医生工作台（uni-app H5）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 tcm-clinic-plugin 构建医生工作台 uni-app H5（B 速查式首页 + A 流程式接诊 + 康养规划/随访/病志管理），经 zhao-sso 登录换 Admin API 会话。

**Architecture:** 服务端（Task 1-2）在 `packages/tcm-clinic-plugin` 补齐工作台查询与 `TcmSsoAuthenticationStrategy`（Admin API zhao-sso 桥接）；前端（Task 3-9）新建独立项目 `d:\zhao\tcm-workbench`（Vue3 + uni-app H5，照抄 strapi-wealth 骨架），admin-api 走 GraphQL `Authorization: Bearer <vendure-auth-token>`。

**Tech Stack:** Vendure 3.6 插件（NestJS/GraphQL/TypeORM；e2e 用 vitest+sqljs）；uni-app 3.0.0-alpha-5020320260731001 + vue 3.4.21 + vite5 + pnpm；Playwright(Python) 390×844 dpr=2 截图。

---

## 环境须知（先读）

- Shell 是 **Windows PowerShell**：不支持 `&&`（用 `;` 或分两条）；无 `tail`/`ls -la`。
- vendure 包内测试：在 `packages/tcm-clinic-plugin` 下 `npx vitest --config vitest.config.mts --run`。
- e2e sqljs 缓存：schema 变更后删对应 `e2e/__data__*` 目录再跑。
- 测试环境实体 ID 带 `T_` 前缀（如 `T_1`），转数字用 `Number(String(id).replace('T_',''))`。
- ForbiddenError 固定文案不可自定义；UserInputError/IllegalOperationError 可自定义 message。
- 新仓库 git 身份：`git config user.name johocn; git config user.email johocn@163.com`。
- commit message 多行用临时文件时必须 `[IO.File]::WriteAllText($path, $msg, [Text.UTF8Encoding]::new($false))`（防 BOM）。

## 现状基线（零上下文必读）

**插件已有 Admin API**（`packages/tcm-clinic-plugin/src/plugin.ts` adminSchema + `src/resolvers/tcm-admin.resolver.ts`）：
mutations：`createClinic / createClinicStaff / createPatientProfile / createEncounter / startEncounter / completeEncounter / createMedicalRecord / updateMedicalRecord / createWellnessPlan / transitionWellnessPlan / addPlanItem / createFollowUp / completeFollowUp(id, followUpEncounterId) / cancelFollowUp`；
queries：`clinics / medicalRecords / auditLogs / wellnessPlans / followUpTasks`。
**缺**：`myStaff`、患者列表、接诊列表、各单条详情（本计划 Task 1 补齐）。

**服务层**：`TcmStaffService.assertStaffOfClinic(ctx, clinicId)`（非本馆员工抛 Forbidden）、`staffOf(ctx, administratorId)`。守卫模式：先取父实体拿 clinicId → assertStaff → 再操作（resolver 里已有大量示例）。`ctx.activeUserId` 即当前 Administrator 的 user id。

**登录/token 机制**（已验证）：Vendure Admin API 登录 = GraphQL `authenticate` mutation，会话 token 从**响应头 `vendure-auth-token`** 读取，后续请求带 `Authorization: Bearer <token>`。zhao-sso 桥接参照 cjk-plugin 的 `SsoAuthenticationStrategy`（`packages/cjk-plugin/src/auth/sso-authentication-strategy.ts`，mock 模式 accessToken 以 `mock-` 前缀构造身份；真实模式 GET `${baseUrl}/v1/user/me` + Bearer 校验）。策略注册参照 `packages/cjk-plugin/src/plugin.ts` L2237-2242 的 `configuration: config => {...}` 写法。

**zhao-sso 回调约定**（照抄 strapi-wealth）：H5 跳 `${ssoLoginUrl}?app_code=X&return_url=<回调页>&c_end_url=<回调页>`；SSO 中心 302 回回调页带 `token`（SSO access token）、`user`(base64 JSON)、`refresh_token`、`expires_in`；错误时带 `error`。

**uni-app 模板源**：`d:\zhao\strapi-wealth`（package.json 依赖版本、vite.config.ts、main.js、index.html、manifest.json、pages.json 结构、App.vue SSO 跳转、pages/auth-callback）。workbench 各文件以它为蓝本改写，**不要照抄其 Strapi REST 逻辑**。

**Encounter 状态**：创建后初始 `PENDING` → `startEncounter` → `ACTIVE` → `completeEncounter` → `COMPLETED`（字段 `status`、乐观锁 `version`，type 为自由 String，前端用 `FIRST`/`RETURN`/`HOUSE_CALL` 三码）。

---

### Task 1: 服务端查询补齐（myStaff/patientProfiles/encounters/详情）+ dev-config 接线

**Files:**
- Modify: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\plugin.ts`（adminSchema 增类型与查询）
- Modify: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\resolvers\tcm-admin.resolver.ts`（新 resolver + 私有助手）
- Modify: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\services\tcm-medical-record.service.ts`（新增 findOneView）
- Modify: `d:\zhao\vendure\packages\dev-server\dev-config.ts`（接线）
- Modify: `d:\zhao\vendure\packages\dev-server\package.json`（deps 加 @vendure/tcm-clinic-plugin）
- Test: `d:\zhao\vendure\packages\tcm-clinic-plugin\e2e\tcm-clinic.e2e-spec.ts`（追加用例）

- [ ] **Step 1: 读基线文件**。先读 `src/services/tcm-medical-record.service.ts`、`src/entities/tcm-medical-record-revision.entity.ts`，确认 revision 关联列名（下方代码按 `recordId` 假设，若实体列名不同以实体为准同步调整代码）、`MedicalRecordView/ListOptions` 现有形态与 `decryptView` 返回结构。dev-config.ts 既有插件 import 写法（L32-82）与 plugins 数组注册段落（L450 附近）也先读。

- [ ] **Step 2: 写失败 e2e**。在 `e2e/tcm-clinic.e2e-spec.ts` 同文件末尾追加用例（复用既有 server/adminClient；前面用例已建馆1并把超管绑定为馆1医生、建过患者档案）：

```ts
    it('workbench queries: myStaff/patientProfiles/encounters/details', async () => {
        const staffs = await adminClient.query(gql`
            query { myStaff { id clinicId displayName role } }
        `);
        expect(staffs.myStaff.length).toBeGreaterThanOrEqual(1);

        const profiles = await adminClient.query(gql`
            query { patientProfiles(options: { take: 10 }) { totalItems items { id customerId customerName customerPhone clinicId } } }
        `);
        expect(profiles.patientProfiles.totalItems).toBeGreaterThanOrEqual(1);
        expect(profiles.patientProfiles.items[0].customerName).toBeTruthy();

        const enc = await adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profiles.patientProfiles.items[0].id}, clinicId: 1, type: "FIRST" }) { id status version } }
        `);
        expect(enc.createEncounter.status).toBe('PENDING');
        const encs = await adminClient.query(gql`
            query { encounters(options: { take: 10 }) { totalItems items { id status type } } }
        `);
        expect(encs.encounters.totalItems).toBeGreaterThanOrEqual(1);
        const single = await adminClient.query(gql`
            query { encounter(id: "${enc.createEncounter.id}") { id status } }
        `);
        expect(single.encounter.status).toBe('PENDING');

        const rec = await adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${enc.createEncounter.id}, chiefComplaint: "咳嗽三日", diagnosis: "风寒袭肺", prescription: [{ name: "荆防败毒散", dosage: "7剂", frequency: "日一剂" }] }) { id version chiefComplaint } }
        `);
        expect(rec.createMedicalRecord.chiefComplaint).toBe('咳嗽三日');
        const recView = await adminClient.query(gql`
            query { medicalRecord(id: "${rec.createMedicalRecord.id}") { id version chiefComplaint diagnosis revisions { version } } }
        `);
        expect(recView.medicalRecord.version).toBe(1);
        expect(recView.medicalRecord.revisions.length).toBe(0);

        const plan = await adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profiles.patientProfiles.items[0].id}, clinicId: 1, title: "冬季温养方案" }) { id status } }
        `);
        await adminClient.query(gql`
            mutation { addPlanItem(input: { planId: ${plan.createWellnessPlan.id}, title: "艾灸足三里", frequency: "每周2次" }) { id } }
        `);
        await adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profiles.patientProfiles.items[0].id}, planId: ${plan.createWellnessPlan.id}, title: "一周后回访", dueAt: "2026-10-20T10:00:00.000Z", channel: "wechat" }) { id } }
        `);
        const planView = await adminClient.query(gql`
            query { wellnessPlan(id: "${plan.createWellnessPlan.id}") { id title items { title } followUps { title status } } }
        `);
        expect(planView.wellnessPlan.items.length).toBe(1);
        expect(planView.wellnessPlan.followUps.length).toBe(1);
        expect(planView.wellnessPlan.followUps[0].status).toBe('PENDING');
    });
```

- [ ] **Step 3: 跑测试确认失败**。`cd d:\zhao\vendure\packages\tcm-clinic-plugin; npx vitest --config vitest.config.mts --run`。Expected: FAIL（GraphQL 字段不存在）。

- [ ] **Step 4: adminSchema 增补**（`plugin.ts`，adminSchema 模板串内紧邻既有类型）：

```ts
    type TcmPatientProfileView {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        clinicId: ID!
        customerName: String
        customerPhone: String
        constitution: JSON
    }
    input TcmPatientProfileListOptions {
        skip: Int
        take: Int
    }
    type TcmPatientProfileList {
        items: [TcmPatientProfileView!]!
        totalItems: Int!
    }
    input TcmEncounterListOptions {
        skip: Int
        take: Int
        since: DateTime
    }
    type TcmEncounterList {
        items: [TcmEncounter!]!
        totalItems: Int!
    }
    type TcmWellnessPlanDetailView {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        patientProfileId: ID!
        clinicId: ID!
        title: String!
        status: WellnessPlanStatus!
        cycleStart: DateTime
        cycleEnd: DateTime
        items: [TcmPlanItem!]!
        followUps: [TcmFollowUpTask!]!
    }
```

Query extend 段增：

```ts
        myStaff: [TcmClinicStaff!]!
        patientProfiles(options: TcmPatientProfileListOptions): TcmPatientProfileList!
        patientProfile(id: ID!): TcmPatientProfileView
        encounters(options: TcmEncounterListOptions): TcmEncounterList!
        encounter(id: ID!): TcmEncounter
        medicalRecord(id: ID!): MedicalRecordView
        wellnessPlan(id: ID!): TcmWellnessPlanDetailView
```

- [ ] **Step 5: resolver 增补**。`tcm-admin.resolver.ts`：import 增加 `Customer` from '@vendure/core'、`MoreThanOrEqual` from 'typeorm'。类内追加：

```ts
    @Transaction()
    @Query()
    async myStaff(@Ctx() ctx: RequestContext): Promise<TcmClinicStaff[]> {
        return this.staffService.staffOf(ctx, ctx.activeUserId as number);
    }

    @Transaction()
    @Query()
    async patientProfiles(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        const clinicIds = await this.currentClinicIds(ctx);
        if (!clinicIds.length) return { items: [], totalItems: 0 };
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmPatientProfile)
            .findAndCount({
                where: { clinicId: In(clinicIds) },
                skip: options?.skip,
                take: options?.take,
                order: { id: 'ASC' },
            });
        return { items: await this.enrichProfiles(ctx, items), totalItems };
    }

    @Transaction()
    @Query()
    async patientProfile(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string | number,
    ): Promise<any | null> {
        const profile = await this.clinicService.findPatientProfile(ctx, Number(String(id).replace('T_', '')));
        if (!profile) return null;
        await this.staffService.assertStaffOfClinic(ctx, Number(profile.clinicId));
        return (await this.enrichProfiles(ctx, [profile]))[0];
    }

    @Transaction()
    @Query()
    async encounters(
        @Ctx() ctx: RequestContext,
        @Args('options') options?: { skip?: number; take?: number; since?: Date },
    ): Promise<{ items: TcmEncounter[]; totalItems: number }> {
        const clinicIds = await this.currentClinicIds(ctx);
        if (!clinicIds.length) return { items: [], totalItems: 0 };
        const [items, totalItems] = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findAndCount({
                where: {
                    clinicId: In(clinicIds),
                    ...(options?.since ? { createdAt: MoreThanOrEqual(options.since) } : {}),
                },
                skip: options?.skip,
                take: options?.take,
                order: { id: 'DESC' },
            });
        return { items, totalItems };
    }

    @Transaction()
    @Query()
    async encounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter | null> {
        const enc = await this.connection
            .getRepository(ctx, TcmEncounter)
            .findOne({ where: { id: Number(String(id).replace('T_', '')) } });
        if (!enc) return null;
        await this.staffService.assertStaffOfClinic(ctx, Number(enc.clinicId));
        return enc;
    }

    @Transaction()
    @Query()
    async medicalRecord(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<any | null> {
        return this.recordService.findOneView(ctx, Number(String(id).replace('T_', '')));
    }

    @Transaction()
    @Query()
    async wellnessPlan(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<any | null> {
        const plan = await this.connection
            .getRepository(ctx, TcmWellnessPlan)
            .findOne({ where: { id: Number(String(id).replace('T_', '')) } });
        if (!plan) return null;
        await this.staffService.assertStaffOfClinic(ctx, Number(plan.clinicId));
        const items = await this.connection.getRepository(ctx, TcmPlanItem).find({ where: { planId: plan.id }, order: { id: 'ASC' } });
        const followUps = await this.connection.getRepository(ctx, TcmFollowUpTask).find({ where: { planId: plan.id }, order: { id: 'ASC' } });
        return { ...plan, items, followUps };
    }

    private async currentClinicIds(ctx: RequestContext): Promise<number[]> {
        const staffList = await this.staffService.staffOf(ctx, ctx.activeUserId as number);
        return staffList.map(s => Number(s.clinicId));
    }

    /** 患者档案视图增强：读时联查 Customer 姓名/手机号（无外键，仅 ID 关联） */
    private async enrichProfiles(ctx: RequestContext, profiles: TcmPatientProfile[]): Promise<any[]> {
        const customerIds = [...new Set(profiles.map(p => Number(p.customerId)))];
        const customers = customerIds.length
            ? await this.connection.getRepository(ctx, Customer).find({ where: { id: In(customerIds) } })
            : [];
        const byId = new Map(customers.map(c => [Number(c.id), c]));
        return profiles.map(p => {
            const c = byId.get(Number(p.customerId));
            return {
                id: p.id,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                customerId: p.customerId,
                clinicId: p.clinicId,
                constitution: (p as any).constitution,
                customerName: c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : `客户 ${p.customerId}`,
                customerPhone: c?.phoneNumber ?? null,
            };
        });
    }
```

- [ ] **Step 6: recordService.findOneView**。`tcm-medical-record.service.ts` 追加（关联列名以 Step 1 读到的实体为准）：

```ts
    /** 单条病志视图（含版本链），供工作台详情页 */
    async findOneView(ctx: RequestContext, recordId: number): Promise<MedicalRecordView | null> {
        const record = await this.connection.getRepository(ctx, TcmMedicalRecord).findOne({ where: { id: recordId } });
        if (!record) return null;
        const view = await this.decryptView(record);
        const revisions = await this.connection.getRepository(ctx, TcmMedicalRecordRevision).find({
            where: { recordId } as any,
            order: { version: 'ASC' },
        });
        return {
            id: Number(record.id),
            encounterId: record.encounterId,
            clinicId: record.clinicId,
            version: record.version,
            ...view,
            revisions: revisions.map(r => ({
                version: (r as any).version,
                editedByStaffId: (r as any).editedByStaffId,
                createdAt: (r as any).createdAt,
            })),
        };
    }
```

- [ ] **Step 7: dev-config 接线**。`packages/dev-server/package.json` dependencies 增 `"@vendure/tcm-clinic-plugin": "0.0.1"`（版本写法对齐同文件其他插件）。`dev-config.ts` 既有 import 区（L32-82 附近）加 `import { TcmClinicPlugin } from '@vendure/tcm-clinic-plugin';`，plugins 数组在 `DistributionPlugin.init(...)` 之后加一行 `TcmClinicPlugin.init({}),`。

- [ ] **Step 8: 跑测试确认通过 + 类型检查**。删 `e2e/__data__` 后 `npx vitest --config vitest.config.mts --run`。Expected: 全部 PASS。包内 `npx tsc --noEmit` 无错误。

- [ ] **Step 9: Commit**

```powershell
cd d:\zhao\vendure
git add packages/tcm-clinic-plugin packages/dev-server/dev-config.ts packages/dev-server/package.json
git commit -m "feat(tcm): workbench admin queries (myStaff/patientProfiles/encounters/details) + dev-config wiring"
```

---

### Task 2: TcmSsoAuthenticationStrategy（Admin API zhao-sso 桥接）+ e2e

**Files:**
- Create: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\auth\tcm-sso.strategy.ts`
- Modify: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\types.ts`
- Modify: `d:\zhao\vendure\packages\tcm-clinic-plugin\src\plugin.ts`（configuration 注册策略）
- Test: `d:\zhao\vendure\packages\tcm-clinic-plugin\e2e\tcm-sso.e2e-spec.ts`（新建）

- [ ] **Step 1: types.ts 增 sso 选项**

```ts
export interface TcmClinicPluginOptions {
    /** 病志保存年限（门诊病志法定 ≥15 年），默认 15 */
    retentionYears?: number;
    /** AES-256 密钥（64 位 hex）。生产必须提供，缺省回退环境变量 TCM_RECORD_KEY */
    encryptionKey?: string;
    /** zhao-sso 桥接（医生工作台 Admin API 登录）。baseUrl 指向 SSO 中心，策略将 GET {baseUrl}/v1/user/me 校验 accessToken */
    sso?: {
        baseUrl: string;
        /** e2e/本地联调 mock：accessToken 以 mock- 前缀直接构造身份（等价环境变量 SSO_MOCK=true） */
        mock?: boolean;
    };
}
```

- [ ] **Step 2: 写失败 e2e**（新建 `e2e/tcm-sso.e2e-spec.ts`，端口 3921 避免冲突）：

```ts
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TcmClinicPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__sso__')));

const ADMIN_API = 'http://localhost:3921/admin-api';

async function authenticate(accessToken: string): Promise<{ body: any; token: string | null }> {
    const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation($t: String!) { authenticate(input: { tcmSso: { accessToken: $t } }) {
                __typename
                ... on CurrentUser { id identifier }
                ... on ErrorResult { errorCode message }
            } }`,
            variables: { t: accessToken },
        }),
    });
    const body = await res.json();
    return { body: body.data?.authenticate, token: res.headers.get('vendure-auth-token') };
}

describe('TcmSsoAuthenticationStrategy', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: { port: 3921 },
            plugins: [TcmClinicPlugin.init({ sso: { baseUrl: 'http://127.0.0.1:9', mock: true } })],
        }),
    );

    beforeAll(async () => {
        TcmClinicPlugin.init({ sso: { baseUrl: 'http://127.0.0.1:9', mock: true } });
        await server.init({
            initialData: {
                defaultLanguage: LanguageCode.zh_Hans,
                defaultZone: 'Asia',
                countries: [{ code: 'CN', name: 'China', zone: 'Asia' }],
                taxRates: [{ name: 'Standard Tax', percentage: 13 }],
                shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
                paymentMethods: [],
                collections: [],
            },
            productsCsvPath: '',
            customerCount: 0,
        });
        await adminClient.asSuperAdmin();
        await adminClient.query(gql`mutation { createClinic(input: { name: "同德堂", licenseNo: "BA1101" }) { id } }`);
        const roles = await adminClient.query(gql`query { roles(options: { take: 20 }) { items { id code } } }`);
        const adminRole = roles.roles.items.find((r: any) => r.code === 'superadmin');
        const doctor = await adminClient.query(gql`
            mutation {
                createAdministrator(input: {
                    firstName: "张", lastName: "医生",
                    emailAddress: "13800000001@tcm.test",
                    password: "test", roleIds: [${adminRole.id}]
                }) { id }
            }
        `);
        // 医生绑定为馆1员工（后面 myStaff 断言用）
        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${Number(String(doctor.createAdministrator.id).replace('T_', ''))}, displayName: "张医生" }) { id } }
        `);
        // 非员工顾客账号（仅顾客角色）
        await shopClient.query(gql`
            mutation { register(input: { emailAddress: "13900000002@tcm.test", firstName: "患", lastName: "者", password: "test" }) }
        `);
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('mock token of a doctor email logs in and issues vendure-auth-token', async () => {
        const { body, token } = await authenticate('mock-13800000001');
        expect(body.__typename).toBe('CurrentUser');
        expect(body.identifier).toBe('13800000001@tcm.test');
        expect(token).toBeTruthy();
        const res = await fetch(ADMIN_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query: `query { myStaff { id clinicId displayName } }` }),
        });
        const data = await res.json();
        expect(data.data.myStaff.length).toBe(1);
        expect(data.data.myStaff[0].displayName).toBe('张医生');
    });

    it('second login reuses bound mapping (ExternalAuthenticationMethod)', async () => {
        const { body } = await authenticate('mock-13800000001');
        expect(body.__typename).toBe('CurrentUser');
    });

    it('non-staff SSO identity is rejected with SSO_ACCOUNT_NOT_STAFF', async () => {
        const { body } = await authenticate('mock-13900000002');
        expect(body.__typename).toBe('ErrorResult');
        expect(body.message).toBe('SSO_ACCOUNT_NOT_STAFF');
    });

    it('unknown identity is rejected with SSO_ACCOUNT_NOT_LINKED', async () => {
        const { body } = await authenticate('mock-19999999999');
        expect(body.__typename).toBe('ErrorResult');
        expect(body.message).toBe('SSO_ACCOUNT_NOT_LINKED');
    });

    it('non-mock invalid token is rejected with SSO_TOKEN_INVALID', async () => {
        // 不带 mock- 前缀 → 走真实校验路径 → baseUrl 不可达 → SSO_TOKEN_INVALID
        const { body } = await authenticate('real-invalid-token');
        expect(body.__typename).toBe('ErrorResult');
        expect(body.message).toBe('SSO_TOKEN_INVALID');
    });
});
```

- [ ] **Step 3: 跑测试确认失败**。删 `e2e/__data__sso__`（若存在）后 `npx vitest --config vitest.config.mts --run`。Expected: FAIL（`tcmSso` 输入字段不存在）。

- [ ] **Step 4: 实现策略**（新建 `src/auth/tcm-sso.strategy.ts`）：

```ts
// packages/tcm-clinic-plugin/src/auth/tcm-sso.strategy.ts
import {
    AuthenticationStrategy,
    ExternalAuthenticationMethod,
    ExternalAuthenticationService,
    Injector,
    Logger,
    RequestContext,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';

import { TCM_PLUGIN_OPTIONS } from '../constants';
import { TcmClinicPluginOptions } from '../types';

const loggerCtx = 'TcmSsoStrategy';

interface TcmSsoAuthData {
    accessToken: string;
}

/**
 * Admin API zhao-sso 桥接策略（医生工作台）。
 * H5 经 zhao-sso 统一认证拿到 access_token 后调
 * authenticate(input: { tcmSso: { accessToken } }) 换取管理员会话。
 *
 * 身份映射（命中即用，顺序如下）：
 * 1. ExternalAuthenticationMethod(strategy='tcmSso', externalIdentifier='sso:tcm:<uuid>') 已绑定 → 直接登录；
 * 2. 首登绑定：User.identifier == SSO 手机号，或 User.identifier == SSO 邮箱
 *    （约定：医生 Administrator 账号 identifier 用手机号，或邮箱与 zhao-sso 账号一致），
 *    且该 User 具有非顾客角色 → 自动绑定映射后登录；
 * 3. 都未命中 → 'SSO_ACCOUNT_NOT_LINKED'。
 * 顾客角色账号命中 → 'SSO_ACCOUNT_NOT_STAFF'（防止患者账号登管理端）。
 */
export class TcmSsoAuthenticationStrategy implements AuthenticationStrategy<TcmSsoAuthData> {
    readonly name = 'tcmSso';

    private externalAuthenticationService!: ExternalAuthenticationService;
    private connection!: TransactionalConnection;
    private options!: TcmClinicPluginOptions;

    async init(injector: Injector) {
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
        this.connection = injector.get(TransactionalConnection);
        this.options = injector.get(TCM_PLUGIN_OPTIONS);
    }

    defineInputType(): DocumentNode {
        return gql`
            input TcmSsoAuthInput {
                accessToken: String!
            }
        `;
    }

    async authenticate(ctx: RequestContext, data: TcmSsoAuthData): Promise<User | false | string> {
        const sso = this.options.sso;
        if (!sso?.baseUrl) {
            Logger.warn('tcm-clinic sso not configured', loggerCtx);
            return 'SSO_NOT_CONFIGURED';
        }
        const mockEnabled = sso.mock === true || process.env.SSO_MOCK === 'true';
        let userInfo: any | null = null;
        if (mockEnabled && data.accessToken.startsWith('mock-')) {
            const ident = data.accessToken.slice('mock-'.length);
            userInfo = { uuid: `u_${ident}`, mobile: ident, nickname: 'Mock', email: `${ident}@tcm.test` };
        } else {
            try {
                const res = await fetch(`${sso.baseUrl.replace(/\/$/, '')}/v1/user/me`, {
                    headers: { Authorization: `Bearer ${data.accessToken}` },
                });
                if (!res.ok) {
                    Logger.warn(`zhao-sso /v1/user/me failed: ${res.status}`, loggerCtx);
                    return 'SSO_TOKEN_INVALID';
                }
                userInfo = await res.json();
            } catch (e: any) {
                Logger.warn(`zhao-sso /v1/user/me error: ${e.message}`, loggerCtx);
                return 'SSO_TOKEN_INVALID';
            }
        }
        const uuid = String(userInfo?.uuid ?? '');
        const mobile = String(userInfo?.mobile ?? userInfo?.phone_number ?? '');
        const email = String(userInfo?.email ?? '');
        if (!uuid && !mobile && !email) {
            return 'SSO_IDENTITY_MISSING';
        }

        // 1) 已绑定映射直接登录
        if (uuid) {
            const mapped = await this.externalAuthenticationService.findUser(ctx, this.name, `sso:tcm:${uuid}`);
            if (mapped) {
                return this.assertStaff(mapped);
            }
        }

        // 2) 首登：手机号/邮箱 匹配 User.identifier
        const candidates = [mobile, email].filter(v => !!v);
        for (const identifier of candidates) {
            const user = await this.connection
                .getRepository(ctx, User)
                .findOne({ where: { identifier }, relations: ['roles'] });
            if (!user) continue;
            const staff = await this.assertStaff(user);
            if (typeof staff === 'string') {
                return staff; // NOT_STAFF：顾客账号，直接拒绝，不继续尝试
            }
            if (uuid) {
                await this.bind(ctx, user, `sso:tcm:${uuid}`);
            }
            return user;
        }
        return 'SSO_ACCOUNT_NOT_LINKED';
    }

    /** 校验 User 具备员工（非顾客）角色；否则拒绝 */
    private assertStaff(user: User): User | string {
        const isStaff = (user.roles || []).some(r => r.code !== '__customer_role__');
        return isStaff ? user : 'SSO_ACCOUNT_NOT_STAFF';
    }

    /** 幂等绑定外部认证方法 */
    private async bind(ctx: RequestContext, user: User, externalKey: string): Promise<void> {
        const methodRepo = this.connection.getRepository(ctx, ExternalAuthenticationMethod);
        const methods = await methodRepo.find({ where: { user: { id: user.id } as any } });
        if (methods.some(m => m.strategy === this.name && m.externalIdentifier === externalKey)) return;
        const authMethod = await methodRepo.save(
            new ExternalAuthenticationMethod({
                strategy: this.name,
                externalIdentifier: externalKey,
                user: user as any,
            }),
        );
        const userRepo = this.connection.getRepository(ctx, User);
        const fresh = await userRepo.findOne({ where: { id: user.id }, relations: ['authenticationMethods'] });
        if (fresh) {
            fresh.authenticationMethods = [...(fresh.authenticationMethods || []), authMethod];
            await userRepo.save(fresh);
        }
    }
}

/** 单例：plugin.ts configuration 注册用 */
export const tcmSsoAuthenticationStrategy = new TcmSsoAuthenticationStrategy();
```

- [ ] **Step 5: plugin.ts 注册**。`@VendurePlugin({...})` 装饰器内加 `configuration`（与 entities/providers 平级），并 import 策略单例：

```ts
import { tcmSsoAuthenticationStrategy } from './auth/tcm-sso.strategy';
```

```ts
    configuration: config => {
        // 医生工作台：Admin API zhao-sso 桥接策略（authenticate(input: { tcmSso: ... })）
        config.authOptions = config.authOptions || {};
        config.authOptions.adminAuthenticationStrategy = [
            ...(config.authOptions.adminAuthenticationStrategy || []),
            tcmSsoAuthenticationStrategy,
        ];
        return config;
    },
```

- [ ] **Step 6: 跑测试确认通过 + 类型检查**。删 `e2e/__data__sso__` 后 `npx vitest --config vitest.config.mts --run`。Expected: 全 PASS（两套 e2e 都绿）。`npx tsc --noEmit` 无错误。

- [ ] **Step 7: Commit**

```powershell
cd d:\zhao\vendure
git add packages/tcm-clinic-plugin
git commit -m "feat(tcm): admin-api zhao-sso authentication strategy for doctor workbench"
```

---

### Task 3: uni-app 项目骨架（d:\zhao\tcm-workbench）

**Files（全部新建于 `d:\zhao\tcm-workbench\`）:**
- Create: `package.json` / `vite.config.ts` / `main.js` / `index.html` / `manifest.json` / `pages.json` / `uni.scss` / `App.vue`
- Create: `config.ts` / `utils/storage.ts` / `utils/i18n.ts` / `utils/sso-guard.ts` / `services/gql.ts` / `services/api.ts`
- Create: `static/common.css` / `.env.development` / `.env.production`

- [ ] **Step 1: 初始化仓库与骨架文件**

`package.json`：

```json
{
  "name": "tcm-workbench",
  "version": "1.0.0",
  "description": "中医馆医生工作台 - uni-app H5（康养规划中心医生端）",
  "scripts": {
    "dev:h5": "set UNI_INPUT_DIR=%cd%&& uni",
    "build:h5": "set UNI_INPUT_DIR=%cd%&& uni build"
  },
  "dependencies": {
    "@dcloudio/uni-app": "3.0.0-alpha-5020320260731001",
    "@dcloudio/uni-components": "3.0.0-alpha-5020320260731001",
    "@dcloudio/uni-h5": "3.0.0-alpha-5020320260731001",
    "vue": "3.4.21"
  },
  "devDependencies": {
    "@dcloudio/types": "^3.4.8",
    "@dcloudio/vite-plugin-uni": "3.0.0-alpha-5020320260731001",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  },
  "packageManager": "pnpm@11.9.0"
}
```

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  // 部署子路径 /workbench/，产物资源引用 /workbench/assets/*
  base: '/workbench/',
  plugins: [uni()],
  server: {
    host: '0.0.0.0',
    port: 5177,
    strictPort: true,
    proxy: {
      // 本地联调：admin-api 代理到 dev-fixture（Task 9 起，端口 3930）；
      // 可用 VITE_API_TARGET 覆盖（如指向 dev-server 3050）
      '/admin-api': { target: process.env.VITE_API_TARGET || 'http://localhost:3930', changeOrigin: true },
    },
  },
  css: {
    preprocessorOptions: { scss: { additionalData: '@import "@/uni.scss";' } }
  }
})
```

`main.js`（照抄 strapi-wealth，仅 Vue3 分支）：

```js
import App from './App'

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif
```

`index.html`（title 改「医生工作台」）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <script>
      var coverSupport = 'CSS' in window && typeof CSS.supports === 'function' && (CSS.supports('top: env(a)') ||
        CSS.supports('top: constant(a)'))
      document.write(
        '<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0' +
        (coverSupport ? ', viewport-fit=cover' : '') + '" />')
    </script>
    <title>医生工作台</title>
  </head>
  <body>
    <div id="app"><!--app-html--></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

`manifest.json`：

```json
{
  "name": "tcm-workbench",
  "appid": "",
  "description": "中医馆医生工作台",
  "versionName": "1.0.0",
  "versionCode": "100",
  "transformPx": false,
  "vueVersion": "3",
  "h5": {
    "title": "医生工作台",
    "router": { "mode": "hash" }
  }
}
```

骨架版 `pages.json`（后续 Task 每建一组页面在此追加；tabBar 在 Task 7 页面齐后补）：

```json
{
  "pages": [
    { "path": "pages/home/index", "style": { "navigationBarTitleText": "医生工作台" } },
    { "path": "pages/mock-login/mock-login", "style": { "navigationBarTitleText": "登录", "navigationStyle": "custom" } }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarTitleText": "医生工作台",
    "navigationBarBackgroundColor": "#2f7d5f",
    "backgroundColor": "#f6f7f6"
  }
}
```

`uni.scss`：

```scss
$brand: #2f7d5f;
$brand-light: #e8f3ee;
$text: #303133;
$text-sec: #7a837f;
$bg: #f6f7f6;
$danger: #c0504d;
$radius: 16rpx;
```

`config.ts`：

```ts
// 运行配置：全部走环境变量，禁止硬编码域名
export const config = {
  // 'sso' = 线上 zhao-sso 统一认证；'mock' = 本地联调（手机号 → mock token）
  authMode: (import.meta.env.VITE_AUTH_MODE as 'sso' | 'mock') || 'mock',
  ssoLoginUrl: (import.meta.env.VITE_SSO_LOGIN_URL as string) || '',
  ssoAppCode: (import.meta.env.VITE_SSO_APP_CODE as string) || 'tcm-workbench',
  adminApiBase: (import.meta.env.VITE_ADMIN_API_BASE as string) || '/admin-api',
}
```

`.env.development`：

```
VITE_AUTH_MODE=mock
VITE_ADMIN_API_BASE=/admin-api
```

`.env.production`：

```
VITE_AUTH_MODE=sso
VITE_ADMIN_API_BASE=/admin-api
VITE_SSO_LOGIN_URL=
VITE_SSO_APP_CODE=tcm-workbench
```

- [ ] **Step 2: utils 与 services**

`utils/storage.ts`：

```ts
const KEY_TOKEN = 'tcm_vendure_token'
const KEY_SSO = 'tcm_sso_token'
const KEY_STAFF = 'tcm_staff'
const KEY_LOCALE = 'tcm_locale'

export function getVendureToken(): string { return uni.getStorageSync(KEY_TOKEN) || '' }
export function setVendureToken(v: string) { uni.setStorageSync(KEY_TOKEN, v) }
export function getSsoToken(): string { return uni.getStorageSync(KEY_SSO) || '' }
export function setSsoToken(v: string) { uni.setStorageSync(KEY_SSO, v) }
export function getStaff(): any { try { return JSON.parse(uni.getStorageSync(KEY_STAFF) || 'null') } catch { return null } }
export function setStaff(v: any) { uni.setStorageSync(KEY_STAFF, JSON.stringify(v)) }
export function getLocale(): string { return uni.getStorageSync(KEY_LOCALE) || 'zh-CN' }
export function setLocale(l: string) { uni.setStorageSync(KEY_LOCALE, l) }
export function isLoggedIn(): boolean { return !!getVendureToken() }
export function clearSession() {
  uni.removeStorageSync(KEY_TOKEN)
  uni.removeStorageSync(KEY_SSO)
  uni.removeStorageSync(KEY_STAFF)
}
```

`utils/i18n.ts`（轻量字典，zh-CN 与 en-US 必须同步）：

```ts
import { getLocale, setLocale as persistLocale } from './storage'

type Dict = Record<string, any>

const messages: Record<string, Dict> = {
  'zh-CN': {
    common: { networkError: '网络异常，请重试', sessionExpired: '登录已过期', confirm: '确认', cancel: '取消', save: '保存', submit: '提交', loading: '加载中...', empty: '暂无数据', success: '操作成功' },
    auth: { loggingIn: '登录中...', loginFailed: '登录失败', notLinked: '该 SSO 账号未绑定医生工作台，请联系管理员', notStaff: '该账号无医生权限', tokenInvalid: '登录凭证无效，请重新登录', notConfigured: 'SSO 未配置', mockLogin: '本地登录', phonePlaceholder: '请输入医生手机号', enter: '进入工作台', mockTip: '本地联调模式：输入已绑定的医生手机号' },
    home: { title: '医生工作台', todayPending: '待接诊', todayActive: '进行中', todayCompleted: '已完成', quickTitle: '快捷入口', newEncounter: '新建接诊', wellnessPlans: '康养规划', followUps: '随访任务', records: '病志档案', patients: '患者列表', searchPlaceholder: '搜索姓名/手机号', visit: '接诊', allClinics: '全部门店' },
    encounter: { type: '接诊类型', FIRST: '初诊', RETURN: '复诊', HOUSE_CALL: '上门', create: '建档接诊', pickPatient: '选择患者', step1: '问诊', step2: '辨证', step3: '医嘱', step4: '完成', chiefComplaint: '主诉', chiefComplaintPh: '患者主诉，如：咳嗽三日，加重伴恶寒', diagnosis: '辨证诊断', diagnosisPh: '辨证结论，如：风寒袭肺证', prescription: '处方', addPrescription: '+ 添加处方项', itemName: '药名/项目', dosage: '剂量', frequency: '频次', note: '备注', submitRecord: '提交病志', completeEncounter: '完成接诊', needStep: '请先完成当前步骤', startEncounter: '开始接诊' },
    plan: { create: '新建规划', title: '规划名称', titlePh: '如：冬季温养方案', cycle: '周期', status_DRAFT: '草稿', status_ACTIVE: '执行中', status_PAUSED: '暂停', status_CLOSED: '已结案', toActive: '开始执行', toPaused: '暂停', toClosed: '结案', items: '计划项', addItem: '添加计划项', itemTitle: '项目名称', frequency: '频次', variantId: '关联商品ID(可选)', followUps: '随访任务', pickPatient: '选择患者' },
    followup: { status_PENDING: '待随访', status_DONE: '已完成', status_CANCELED: '已取消', dueAt: '截止', channel: '渠道', sms: '短信', wechat: '微信', phone: '电话', complete: '完成随访', cancel: '取消任务', create: '新建随访', title: '任务名称', titlePh: '如：一周后回访', planId: '关联规划(可选)' },
    record: { list: '病志档案', version: '版本', chiefComplaint: '主诉', diagnosis: '诊断', prescription: '处方', revisions: '修改留痕', edit: '修改病志', encounter: '接诊', readonly: '已过保存期，只读' },
  },
  'en-US': {
    common: { networkError: 'Network error, please retry', sessionExpired: 'Session expired', confirm: 'Confirm', cancel: 'Cancel', save: 'Save', submit: 'Submit', loading: 'Loading...', empty: 'No data', success: 'Success' },
    auth: { loggingIn: 'Signing in...', loginFailed: 'Login failed', notLinked: 'This SSO account is not linked to the workbench, contact admin', notStaff: 'No doctor permission for this account', tokenInvalid: 'Invalid credential, please sign in again', notConfigured: 'SSO not configured', mockLogin: 'Local Login', phonePlaceholder: 'Doctor phone number', enter: 'Enter Workbench', mockTip: 'Local mock mode: enter a linked doctor phone number' },
    home: { title: 'Doctor Workbench', todayPending: 'Waiting', todayActive: 'In Progress', todayCompleted: 'Completed', quickTitle: 'Quick Actions', newEncounter: 'New Encounter', wellnessPlans: 'Wellness Plans', followUps: 'Follow-ups', records: 'Medical Records', patients: 'Patients', searchPlaceholder: 'Search name/phone', visit: 'Visit', allClinics: 'All Clinics' },
    encounter: { type: 'Type', FIRST: 'First Visit', RETURN: 'Return Visit', HOUSE_CALL: 'House Call', create: 'Create Encounter', pickPatient: 'Select Patient', step1: 'Inquiry', step2: 'Diagnosis', step3: 'Prescription', step4: 'Finish', chiefComplaint: 'Chief Complaint', chiefComplaintPh: 'e.g. Cough for 3 days', diagnosis: 'Syndrome Diagnosis', diagnosisPh: 'e.g. Wind-cold attacking lung', prescription: 'Prescription', addPrescription: '+ Add Item', itemName: 'Item', dosage: 'Dosage', frequency: 'Frequency', note: 'Note', submitRecord: 'Submit Record', completeEncounter: 'Complete Encounter', needStep: 'Please finish current step', startEncounter: 'Start Encounter' },
    plan: { create: 'New Plan', title: 'Plan Title', titlePh: 'e.g. Winter Care Plan', cycle: 'Cycle', status_DRAFT: 'Draft', status_ACTIVE: 'Active', status_PAUSED: 'Paused', status_CLOSED: 'Closed', toActive: 'Activate', toPaused: 'Pause', toClosed: 'Close', items: 'Plan Items', addItem: 'Add Item', itemTitle: 'Item Name', frequency: 'Frequency', variantId: 'Variant ID (optional)', followUps: 'Follow-ups', pickPatient: 'Select Patient' },
    followup: { status_PENDING: 'Pending', status_DONE: 'Done', status_CANCELED: 'Canceled', dueAt: 'Due', channel: 'Channel', sms: 'SMS', wechat: 'WeChat', phone: 'Phone', complete: 'Complete', cancel: 'Cancel', create: 'New Follow-up', title: 'Task Title', titlePh: 'e.g. Follow-up in 1 week', planId: 'Linked Plan (optional)' },
    record: { list: 'Medical Records', version: 'Version', chiefComplaint: 'Chief Complaint', diagnosis: 'Diagnosis', prescription: 'Prescription', revisions: 'Revision History', edit: 'Edit Record', encounter: 'Encounter', readonly: 'Read-only after retention' },
  },
}

export function t(path: string): string {
  const locale = getLocale()
  const dict = messages[locale] || messages['zh-CN']
  const val = path.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), dict)
  if (typeof val === 'string') return val
  const fallback = path.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), messages['zh-CN'])
  return typeof fallback === 'string' ? fallback : path
}

export function currentLocale(): string { return getLocale() }
export function switchLocale(l: 'zh-CN' | 'en-US') { persistLocale(l) }
```

`utils/sso-guard.ts`：

```ts
const KEY = 'tcm_sso_redirect_attempts'

/** 30 秒窗口内最多跳 3 次，防 SSO 循环重定向 */
export function guardSsoRedirect(): boolean {
  const now = Date.now()
  const arr: number[] = uni.getStorageSync(KEY) || []
  const recent = arr.filter((ts: number) => now - ts < 30000)
  recent.push(now)
  uni.setStorageSync(KEY, recent)
  return recent.length <= 3
}

export function clearSsoRedirectAttempts() { uni.removeStorageSync(KEY) }
```

`services/gql.ts`：

```ts
import { config } from '../config'
import { clearSession, getVendureToken, setVendureToken } from '../utils/storage'
import { t } from '../utils/i18n'

export class GqlError extends Error {
  constructor(public errorCode: string, message: string) { super(message) }
}

export async function gqlFetch<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getVendureToken()
  if (token) headers.authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(config.adminApiBase, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  } catch (e) {
    throw new GqlError('NETWORK_ERROR', t('common.networkError'))
  }
  // 认证类请求会经 vendure-auth-token 响应头下发会话 token
  const newToken = res.headers.get('vendure-auth-token')
  if (newToken) setVendureToken(newToken)
  if (res.status === 401) {
    clearSession()
    throw new GqlError('UNAUTHORIZED', t('common.sessionExpired'))
  }
  const json = await res.json()
  if (json.errors?.length) throw new GqlError('GRAPHQL_ERROR', json.errors[0].message)
  return json.data as T
}
```

`services/api.ts`（全部业务 GraphQL 操作，一处集中）：

```ts
import { gqlFetch } from './gql'

const Q_MY_STAFF = `query { myStaff { id clinicId displayName role } }`

const Q_PATIENT_PROFILES = `query($skip: Int, $take: Int) {
  patientProfiles(options: { skip: $skip, take: $take }) {
    totalItems
    items { id customerId clinicId customerName customerPhone constitution createdAt }
  }
}`

const Q_ENCOUNTERS = `query($skip: Int, $take: Int, $since: DateTime) {
  encounters(options: { skip: $skip, take: $take, since: $since }) {
    totalItems
    items { id patientProfileId clinicId staffId type status version createdAt updatedAt }
  }
}`

const Q_ENCOUNTER = `query($id: ID!) { encounter(id: $id) { id patientProfileId clinicId staffId type status version } }`

const M_CREATE_ENCOUNTER = `mutation($input: TcmEncounterInput!) { createEncounter(input: $input) { id status version } }`
const M_START_ENCOUNTER = `mutation($id: ID!) { startEncounter(id: $id) { id status } }`
const M_COMPLETE_ENCOUNTER = `mutation($id: ID!) { completeEncounter(id: $id) { id status } }`

const M_CREATE_RECORD = `mutation($input: MedicalRecordInput!) {
  createMedicalRecord(input: $input) { id encounterId clinicId version chiefComplaint diagnosis prescription }
}`
const Q_MEDICAL_RECORD = `query($id: ID!) {
  medicalRecord(id: $id) { id encounterId clinicId version chiefComplaint diagnosis prescription revisions { version editedByStaffId createdAt } }
}`
const Q_MEDICAL_RECORDS = `query($skip: Int, $take: Int) {
  medicalRecords(options: { skip: $skip, take: $take }) { totalItems items { id encounterId clinicId version chiefComplaint diagnosis } }
}`
const M_UPDATE_RECORD = `mutation($id: ID!, $input: UpdateMedicalRecordInput!) {
  updateMedicalRecord(id: $id, input: $input) { id version chiefComplaint diagnosis prescription revisions { version } }
}`

const Q_WELLNESS_PLANS = `query($skip: Int, $take: Int) {
  wellnessPlans(options: { skip: $skip, take: $take }) { totalItems items { id patientProfileId clinicId title status cycleStart cycleEnd } }
}`
const Q_WELLNESS_PLAN = `query($id: ID!) {
  wellnessPlan(id: $id) { id patientProfileId clinicId title status cycleStart cycleEnd items { id planId title frequency productVariantId orderId } followUps { id patientProfileId planId title dueAt channel status followUpEncounterId } }
}`
const M_CREATE_PLAN = `mutation($input: TcmWellnessPlanInput!) { createWellnessPlan(input: $input) { id status } }`
const M_TRANSITION_PLAN = `mutation($id: ID!, $to: WellnessPlanStatus!) { transitionWellnessPlan(id: $id, to: $to) { id status } }`
const M_ADD_PLAN_ITEM = `mutation($input: TcmPlanItemInput!) { addPlanItem(input: $input) { id } }`

const Q_FOLLOW_UPS = `query($skip: Int, $take: Int) {
  followUpTasks(options: { skip: $skip, take: $take }) { totalItems items { id patientProfileId planId title dueAt channel status followUpEncounterId } }
}`
const M_CREATE_FOLLOW_UP = `mutation($input: TcmFollowUpTaskInput!) { createFollowUp(input: $input) { id } }`
const M_COMPLETE_FOLLOW_UP = `mutation($id: ID!) { completeFollowUp(id: $id) { id status } }`
const M_CANCEL_FOLLOW_UP = `mutation($id: ID!) { cancelFollowUp(id: $id) { id status } }`

export const api = {
  myStaff: () => gqlFetch(Q_MY_STAFF).then(d => d.myStaff),
  patientProfiles: (skip = 0, take = 50) => gqlFetch(Q_PATIENT_PROFILES, { skip, take }).then(d => d.patientProfiles),
  encounters: (skip = 0, take = 100, since?: string) => gqlFetch(Q_ENCOUNTERS, { skip, take, since }).then(d => d.encounters),
  encounter: (id: string) => gqlFetch(Q_ENCOUNTER, { id }).then(d => d.encounter),
  createEncounter: (input: { patientProfileId: number; clinicId: number; type?: string }) =>
    gqlFetch(M_CREATE_ENCOUNTER, { input }).then(d => d.createEncounter),
  startEncounter: (id: string) => gqlFetch(M_START_ENCOUNTER, { id }).then(d => d.startEncounter),
  completeEncounter: (id: string) => gqlFetch(M_COMPLETE_ENCOUNTER, { id }).then(d => d.completeEncounter),
  createMedicalRecord: (input: { encounterId: number; chiefComplaint: string; diagnosis: string; prescription?: any }) =>
    gqlFetch(M_CREATE_RECORD, { input }).then(d => d.createMedicalRecord),
  medicalRecord: (id: string) => gqlFetch(Q_MEDICAL_RECORD, { id }).then(d => d.medicalRecord),
  medicalRecords: (skip = 0, take = 50) => gqlFetch(Q_MEDICAL_RECORDS, { skip, take }).then(d => d.medicalRecords),
  updateMedicalRecord: (id: string, input: { chiefComplaint?: string; diagnosis?: string; prescription?: any }) =>
    gqlFetch(M_UPDATE_RECORD, { id, input }).then(d => d.updateMedicalRecord),
  wellnessPlans: (skip = 0, take = 50) => gqlFetch(Q_WELLNESS_PLANS, { skip, take }).then(d => d.wellnessPlans),
  wellnessPlan: (id: string) => gqlFetch(Q_WELLNESS_PLAN, { id }).then(d => d.wellnessPlan),
  createWellnessPlan: (input: { patientProfileId: number; clinicId: number; title: string; cycleStart?: string; cycleEnd?: string }) =>
    gqlFetch(M_CREATE_PLAN, { input }).then(d => d.createWellnessPlan),
  transitionWellnessPlan: (id: string, to: string) => gqlFetch(M_TRANSITION_PLAN, { id, to }).then(d => d.transitionWellnessPlan),
  addPlanItem: (input: { planId: number; title: string; frequency?: string; productVariantId?: number }) =>
    gqlFetch(M_ADD_PLAN_ITEM, { input }).then(d => d.addPlanItem),
  followUpTasks: (skip = 0, take = 100) => gqlFetch(Q_FOLLOW_UPS, { skip, take }).then(d => d.followUpTasks),
  createFollowUp: (input: { patientProfileId: number; planId?: number; title: string; dueAt: string; channel?: string }) =>
    gqlFetch(M_CREATE_FOLLOW_UP, { input }).then(d => d.createFollowUp),
  completeFollowUp: (id: string) => gqlFetch(M_COMPLETE_FOLLOW_UP, { id }).then(d => d.completeFollowUp),
  cancelFollowUp: (id: string) => gqlFetch(M_CANCEL_FOLLOW_UP, { id }).then(d => d.cancelFollowUp),
}

export function todayStartIso(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
```

- [ ] **Step 3: App.vue（SSO 守卫 + 路由拦截 + 公共样式）与 static/common.css**

`App.vue`：

```vue
<script>
import { config } from './config'
import { isLoggedIn } from './utils/storage'
import { guardSsoRedirect } from './utils/sso-guard'
import './static/common.css'

function needAuthPage() {
  const hash = window.location.hash || ''
  if (hash.includes('pages/auth-callback') || hash.includes('pages/mock-login')) return false
  return true
}

function ensureLogin() {
  if (!needAuthPage() || isLoggedIn()) return
  if (config.authMode === 'sso' && config.ssoLoginUrl) {
    if (!guardSsoRedirect()) {
      uni.showModal({ title: '登录异常', content: 'SSO 跳转次数过多，请清除缓存重试', showCancel: false })
      return
    }
    const cb = window.location.origin + window.location.pathname + '#/pages/auth-callback/auth-callback'
    const params = new URLSearchParams({ app_code: config.ssoAppCode, return_url: cb, c_end_url: cb })
    const sep = config.ssoLoginUrl.includes('?') ? '&' : '?'
    window.location.href = `${config.ssoLoginUrl}${sep}${params.toString()}`
  } else {
    uni.reLaunch({ url: '/pages/mock-login/mock-login' })
  }
}

export default {
  onLaunch: function () {
    // #ifdef H5
    uni.addInterceptor('navigateTo', { invoke: ensureLogin })
    uni.addInterceptor('switchTab', { invoke: ensureLogin })
    ensureLogin()
    // #endif
  },
}
</script>

<style>
page { background-color: #f6f7f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; color: #303133; }
</style>
```

`static/common.css`：

```css
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 16rpx 24rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: #303133; margin: 24rpx 24rpx 8rpx; }
.btn-primary { background: #2f7d5f; color: #fff; border-radius: 44rpx; font-size: 30rpx; padding: 20rpx 0; text-align: center; }
.btn-ghost { background: #e8f3ee; color: #2f7d5f; border-radius: 44rpx; font-size: 26rpx; padding: 14rpx 28rpx; text-align: center; }
.btn-danger { background: #fdecec; color: #c0504d; border-radius: 44rpx; font-size: 26rpx; padding: 14rpx 28rpx; text-align: center; }
.tag { font-size: 22rpx; border-radius: 8rpx; padding: 4rpx 12rpx; }
.tag-green { background: #e8f3ee; color: #2f7d5f; }
.tag-gray { background: #f0f1f0; color: #7a837f; }
.tag-red { background: #fdecec; color: #c0504d; }
.input { background: #f6f7f6; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.textarea { background: #f6f7f6; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; width: 100%; min-height: 160rpx; box-sizing: border-box; }
.empty { text-align: center; color: #7a837f; font-size: 26rpx; padding: 60rpx 0; }
```

- [ ] **Step 4: 首页占位 + 安装依赖并构建验证**

先建最小占位 `pages/home/index.vue`（`<template><view>home</view></template>`，Task 5 覆盖）：

```powershell
cd d:\zhao\tcm-workbench
git init
git config user.name johocn
git config user.email johocn@163.com
pnpm install
pnpm build:h5
```

Expected: `dist/build/h5` 产物生成、无构建错误。

- [ ] **Step 5: Commit**

```powershell
cd d:\zhao\tcm-workbench
git add -A
git commit -m "chore: uni-app h5 skeleton (config/storage/i18n/gql services)"
```

---

### Task 4: 登录模块（auth-callback + mock-login）

**Files:**
- Create: `d:\zhao\tcm-workbench\pages\auth-callback\auth-callback.vue`
- Create: `d:\zhao\tcm-workbench\pages\mock-login\mock-login.vue`（骨架已登记）
- Modify: `d:\zhao\tcm-workbench\pages.json`（追加 auth-callback 登记）
- Create: `d:\zhao\tcm-workbench\services\auth.ts`

- [ ] **Step 1: services/auth.ts（认证换会话的共用逻辑）**

```ts
import { gqlFetch, GqlError } from './gql'
import { api } from './api'
import { clearSsoRedirectAttempts } from '../utils/sso-guard'
import { setSsoToken, setStaff } from '../utils/storage'

export type AuthFailureCode = 'NOT_LINKED' | 'NOT_STAFF' | 'TOKEN_INVALID' | 'NETWORK' | 'UNKNOWN'

const M_AUTH = `mutation($t: String!) {
  authenticate(input: { tcmSso: { accessToken: $t } }) {
    __typename
    ... on CurrentUser { id identifier }
    ... on ErrorResult { errorCode message }
  }
}`

/** 用 zhao-sso accessToken（或 mock token）换取 Admin API 会话；成功后预取员工身份 */
export async function loginWithSsoToken(accessToken: string): Promise<void> {
  setSsoToken(accessToken)
  let res: any
  try {
    res = await gqlFetch(M_AUTH, { t: accessToken })
  } catch (e: any) {
    if (e instanceof GqlError && e.errorCode === 'NETWORK_ERROR') { e.authCode = 'NETWORK'; throw e }
    throw e
  }
  const auth = res.authenticate
  if (auth.__typename !== 'CurrentUser') {
    const msg = String(auth.message || '')
    const err: any = new Error(msg || 'auth failed')
    if (msg.includes('SSO_ACCOUNT_NOT_LINKED')) err.authCode = 'NOT_LINKED'
    else if (msg.includes('SSO_ACCOUNT_NOT_STAFF')) err.authCode = 'NOT_STAFF'
    else if (msg.includes('SSO_')) err.authCode = 'TOKEN_INVALID'
    else err.authCode = 'UNKNOWN'
    throw err
  }
  clearSsoRedirectAttempts()
  // 预取员工身份（首页也要用；无身份不阻断）
  try {
    const staff = await api.myStaff()
    setStaff(staff)
  } catch (e) { /* 忽略 */ }
}
```

- [ ] **Step 2: auth-callback 页**（SSO 回调带 token → 换 Admin API 会话）

```vue
<template>
  <view class="auth-callback">
    <view class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">{{ statusText }}</text>
      <text v-if="errorText" class="error-text">{{ errorText }}</text>
      <view v-if="errorText" class="btn-primary retry-btn" @tap="retry">{{ t('common.confirm') }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { loginWithSsoToken } from '../../services/auth'
import { clearSession } from '../../utils/storage'
import { t } from '../../utils/i18n'

const statusText = ref(t('auth.loggingIn'))
const errorText = ref('')

onMounted(() => {
  // #ifdef H5
  handleSsoCallback()
  // #endif
})

async function handleSsoCallback() {
  const urlParams = new URLSearchParams(window.location.search)
  const hashQuery = window.location.hash.split('?')[1] || ''
  const hashParams = new URLSearchParams(hashQuery)
  const error = urlParams.get('error') || hashParams.get('error')
  const token = urlParams.get('token') || hashParams.get('token')
  if (error) {
    errorText.value = `${t('auth.loginFailed')}: ${decodeURIComponent(error)}`
    return
  }
  if (!token) {
    errorText.value = t('auth.tokenInvalid')
    return
  }
  try {
    await loginWithSsoToken(token)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (e) {
    clearSession()
    errorText.value = mapAuthError(e)
  }
}

function mapAuthError(e) {
  if (e.authCode === 'NOT_LINKED') return t('auth.notLinked')
  if (e.authCode === 'NOT_STAFF') return t('auth.notStaff')
  if (e.authCode === 'TOKEN_INVALID') return t('auth.tokenInvalid')
  if (e.authCode === 'NETWORK') return t('common.networkError')
  return t('auth.loginFailed')
}

function retry() {
  clearSession()
  uni.reLaunch({ url: '/pages/home/index' })
}
</script>

<style scoped>
.auth-callback { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f6f7f6; }
.loading-container { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding: 0 60rpx; }
.loading-spinner { width: 60rpx; height: 60rpx; border: 4rpx solid #e0e0e0; border-top-color: #2f7d5f; border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-text { font-size: 30rpx; color: #666; }
.error-text { font-size: 28rpx; color: #c0504d; text-align: center; }
.retry-btn { width: 320rpx; margin-top: 20rpx; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
```

`pages.json` pages 数组追加：

```json
    { "path": "pages/auth-callback/auth-callback", "style": { "navigationBarTitleText": "登录中", "navigationStyle": "custom" } }
```

- [ ] **Step 3: mock-login 页**

```vue
<template>
  <view class="mock-login">
    <view class="brand">中医馆 · 医生工作台</view>
    <view class="tip">{{ t('auth.mockTip') }}</view>
    <input class="input phone" type="number" :placeholder="t('auth.phonePlaceholder')" v-model="phone" />
    <view class="btn-primary enter" @tap="doLogin">{{ t('auth.enter') }}</view>
    <text v-if="errorText" class="error">{{ errorText }}</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { loginWithSsoToken } from '../../services/auth'
import { t } from '../../utils/i18n'

const phone = ref('')
const errorText = ref('')

async function doLogin() {
  if (!phone.value || phone.value.length < 11) return
  errorText.value = ''
  try {
    await loginWithSsoToken(`mock-${phone.value}`)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (e) {
    errorText.value = e.authCode === 'NOT_LINKED' ? t('auth.notLinked')
      : e.authCode === 'NOT_STAFF' ? t('auth.notStaff')
      : e.authCode === 'NETWORK' ? t('common.networkError')
      : t('auth.loginFailed')
  }
}
</script>

<style scoped>
.mock-login { min-height: 100vh; background: linear-gradient(160deg, #2f7d5f 0%, #245f49 100%); display: flex; flex-direction: column; align-items: center; padding-top: 220rpx; }
.brand { color: #fff; font-size: 40rpx; font-weight: 600; letter-spacing: 4rpx; }
.tip { color: rgba(255,255,255,0.75); font-size: 24rpx; margin: 24rpx 0 80rpx; }
.phone { width: 560rpx; background: #fff; }
.enter { width: 560rpx; margin-top: 36rpx; }
.error { color: #ffd7d7; font-size: 26rpx; margin-top: 24rpx; }
</style>
```

- [ ] **Step 4: 构建验证 + Commit**

```powershell
cd d:\zhao\tcm-workbench
pnpm build:h5
git add -A
git commit -m "feat: sso login flow (auth-callback + mock login + auth service)"
```

---

### Task 5: 首页（B 速查式：今日统计 + 患者列表 + 快捷入口）

**Files:**
- Modify: `d:\zhao\tcm-workbench\pages\home\index.vue`（覆盖骨架占位）

- [ ] **Step 1: 实现页面**（onShow 刷新；统计来自 `encounters(since=今日0点)` 按状态计数；患者列表支持姓名/手机号本地过滤；多馆时顶部横向切换）

```vue
<template>
  <view class="home">
    <!-- 馆切换（多馆） -->
    <scroll-view v-if="staffList.length > 1" scroll-x class="clinic-bar">
      <view v-for="s in staffList" :key="s.id" class="clinic-chip" :class="{ on: s.clinicId === currentClinicId }" @tap="switchClinic(s)">
        {{ s.displayName }} · 馆{{ s.clinicId }}
      </view>
    </scroll-view>

    <!-- 今日接诊统计 -->
    <view class="stat-row card">
      <view class="stat"><text class="num">{{ stat.pending }}</text><text class="lbl">{{ t('home.todayPending') }}</text></view>
      <view class="stat"><text class="num">{{ stat.active }}</text><text class="lbl">{{ t('home.todayActive') }}</text></view>
      <view class="stat"><text class="num">{{ stat.completed }}</text><text class="lbl">{{ t('home.todayCompleted') }}</text></view>
    </view>

    <!-- 快捷入口 -->
    <view class="section-title">{{ t('home.quickTitle') }}</view>
    <view class="quick-grid card">
      <view class="quick-item" @tap="go('/pages/encounter/create')"><text class="q-ico">🩺</text><text>{{ t('home.newEncounter') }}</text></view>
      <view class="quick-item" @tap="go('/pages/plan/list')"><text class="q-ico">🌿</text><text>{{ t('home.wellnessPlans') }}</text></view>
      <view class="quick-item" @tap="go('/pages/followup/list')"><text class="q-ico">📋</text><text>{{ t('home.followUps') }}</text></view>
      <view class="quick-item" @tap="go('/pages/record/list')"><text class="q-ico">📚</text><text>{{ t('home.records') }}</text></view>
    </view>

    <!-- 患者列表 -->
    <view class="section-title row-between">
      <text>{{ t('home.patients') }}</text>
      <input class="input search" :placeholder="t('home.searchPlaceholder')" v-model="keyword" />
    </view>
    <view class="card patient" v-for="p in filteredPatients" :key="p.id">
      <view class="row-between">
        <view>
          <view class="p-name">{{ p.customerName }}</view>
          <view class="p-phone">{{ p.customerPhone || '--' }}</view>
        </view>
        <view class="btn-ghost" @tap="goEncounter(p)">{{ t('home.visit') }}</view>
      </view>
    </view>
    <view v-if="!filteredPatients.length" class="empty">{{ t('common.empty') }}</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, todayStartIso } from '../../services/api'
import { t } from '../../utils/i18n'

const staffList = ref([])
const currentClinicId = ref(null)
const patients = ref([])
const encounters = ref([])
const keyword = ref('')

const stat = computed(() => ({
  pending: encounters.value.filter(e => e.status === 'PENDING').length,
  active: encounters.value.filter(e => e.status === 'ACTIVE').length,
  completed: encounters.value.filter(e => e.status === 'COMPLETED').length,
}))
const filteredPatients = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return patients.value
  return patients.value.filter(p => (p.customerName || '').includes(kw) || (p.customerPhone || '').includes(kw))
})

onShow(refresh)

async function refresh() {
  staffList.value = await api.myStaff()
  if (!currentClinicId.value && staffList.value.length) currentClinicId.value = staffList.value[0].clinicId
  const [profiles, encs] = await Promise.all([
    api.patientProfiles(0, 50),
    api.encounters(0, 100, todayStartIso()),
  ])
  patients.value = profiles.items
  encounters.value = encs.items
}

function switchClinic(s) { currentClinicId.value = s.clinicId }

function go(url) { uni.navigateTo({ url }) }

function goEncounter(p) {
  uni.navigateTo({ url: `/pages/encounter/create?patientId=${p.id}&clinicId=${p.clinicId}` })
}
</script>

<style scoped>
.home { padding-bottom: 40rpx; }
.clinic-bar { white-space: nowrap; padding: 16rpx 24rpx 0; }
.clinic-chip { display: inline-block; background: #fff; border-radius: 32rpx; padding: 12rpx 28rpx; font-size: 26rpx; margin-right: 16rpx; color: #7a837f; }
.clinic-chip.on { background: #2f7d5f; color: #fff; }
.stat-row { display: flex; justify-content: space-around; }
.stat { display: flex; flex-direction: column; align-items: center; }
.num { font-size: 44rpx; font-weight: 700; color: #2f7d5f; }
.lbl { font-size: 24rpx; color: #7a837f; margin-top: 6rpx; }
.quick-grid { display: flex; justify-content: space-between; }
.quick-item { display: flex; flex-direction: column; align-items: center; font-size: 24rpx; color: #303133; gap: 10rpx; width: 25%; }
.q-ico { font-size: 48rpx; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
.search { width: 320rpx; font-size: 26rpx; padding: 10rpx 16rpx; }
.p-name { font-size: 30rpx; font-weight: 600; }
.p-phone { font-size: 24rpx; color: #7a837f; margin-top: 6rpx; }
</style>
```

- [ ] **Step 2: 构建验证 + Commit**

```powershell
cd d:\zhao\tcm-workbench
pnpm build:h5
git add -A
git commit -m "feat: home dashboard (today stats + quick actions + patient list)"
```

---

### Task 6: 流程式接诊（A 分步：问诊→辨证→医嘱→完成）

**Files:**
- Create: `d:\zhao\tcm-workbench\pages\encounter\create.vue`
- Create: `d:\zhao\tcm-workbench\pages\encounter\flow.vue`
- Modify: `d:\zhao\tcm-workbench\pages.json`（登记两页）

- [ ] **Step 1: pages.json 登记**

```json
    { "path": "pages/encounter/create", "style": { "navigationBarTitleText": "新建接诊" } },
    { "path": "pages/encounter/flow", "style": { "navigationBarTitleText": "接诊录入" } }
```

- [ ] **Step 2: 新建接诊页**（从首页带入 patientId 时直接预选；未带则列表选择；选类型 → createEncounter → 进流程页）

```vue
<template>
  <view>
    <view class="section-title">{{ t('encounter.pickPatient') }}</view>
    <view class="card" v-if="selected">
      <view class="sel-name">{{ selected.customerName }}</view>
      <view class="sel-phone">{{ selected.customerPhone || '--' }}</view>
    </view>
    <input v-if="!preselected" class="input search-input" :placeholder="t('home.searchPlaceholder')" v-model="keyword" />
    <scroll-view scroll-y class="picker-list">
      <view class="card patient" v-for="p in filteredPatients" :key="p.id" @tap="pick(p)">
        <view class="p-name">{{ p.customerName }}</view>
        <view class="p-phone">{{ p.customerPhone || '--' }}</view>
      </view>
      <view v-if="!filteredPatients.length" class="empty">{{ t('common.empty') }}</view>
    </scroll-view>

    <view class="section-title">{{ t('encounter.type') }}</view>
    <view class="card type-row">
      <view v-for="tp in types" :key="tp.value" class="type-chip" :class="{ on: type === tp.value }" @tap="type = tp.value">
        {{ t('encounter.' + tp.value) }}
      </view>
    </view>

    <view class="btn-primary create-btn" :class="{ disabled: !selected }" @tap="create">
      {{ t('encounter.create') }}
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const types = [{ value: 'FIRST' }, { value: 'RETURN' }, { value: 'HOUSE_CALL' }]

const preselected = ref(false)
const selected = ref(null)
const patients = ref([])
const keyword = ref('')
const type = ref('FIRST')
const clinicId = ref(null)

const filteredPatients = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return patients.value
  return patients.value.filter(p => (p.customerName || '').includes(kw) || (p.customerPhone || '').includes(kw))
})

onLoad(async (q) => {
  const res = await api.patientProfiles(0, 100)
  patients.value = res.items
  if (q.patientId) {
    const found = patients.value.find(p => String(p.id) === String(q.patientId))
    if (found) { selected.value = found; preselected.value = true }
  }
  if (q.clinicId) clinicId.value = Number(q.clinicId)
})

function pick(p) { selected.value = p }

async function create() {
  if (!selected.value) return
  const enc = await api.createEncounter({
    patientProfileId: Number(selected.value.id),
    clinicId: Number(clinicId.value ?? selected.value.clinicId),
    type: type.value,
  })
  uni.redirectTo({ url: `/pages/encounter/flow?id=${enc.id}` })
}
</script>

<style scoped>
.picker-list { max-height: 640rpx; }
.search-input { margin: 0 24rpx; }
.sel-name { font-size: 32rpx; font-weight: 600; }
.sel-phone { font-size: 24rpx; color: #7a837f; margin-top: 6rpx; }
.p-name { font-size: 30rpx; font-weight: 600; }
.p-phone { font-size: 24rpx; color: #7a837f; margin-top: 6rpx; }
.type-row { display: flex; gap: 20rpx; }
.type-chip { flex: 1; text-align: center; background: #f6f7f6; border-radius: 12rpx; padding: 18rpx 0; font-size: 28rpx; color: #7a837f; }
.type-chip.on { background: #e8f3ee; color: #2f7d5f; font-weight: 600; }
.create-btn { margin: 40rpx 24rpx; }
.create-btn.disabled { opacity: 0.4; }
</style>
```

- [ ] **Step 3: 流程录入页**（四步状态机：步骤未完成禁止跳步；进入时若 status=PENDING 先 startEncounter；第 3 步 createMedicalRecord；第 4 步 completeEncounter）

```vue
<template>
  <view>
    <!-- 步骤条 -->
    <view class="steps card">
      <view v-for="(s, i) in steps" :key="s" class="step" :class="{ on: step === i + 1, done: step > i + 1 }" @tap="goStep(i + 1)">
        <text class="step-num">{{ step > i + 1 ? '✓' : i + 1 }}</text>
        <text class="step-label">{{ t('encounter.' + s) }}</text>
      </view>
    </view>

    <!-- 步骤1 问诊 -->
    <view v-if="step === 1" class="card">
      <view class="f-label">{{ t('encounter.chiefComplaint') }}</view>
      <textarea class="textarea" v-model="chiefComplaint" :placeholder="t('encounter.chiefComplaintPh')" />
      <view class="btn-primary mt" @tap="next1">{{ t('common.confirm') }}</view>
    </view>

    <!-- 步骤2 辨证 -->
    <view v-if="step === 2" class="card">
      <view class="f-label">{{ t('encounter.diagnosis') }}</view>
      <textarea class="textarea" v-model="diagnosis" :placeholder="t('encounter.diagnosisPh')" />
      <view class="btn-primary mt" @tap="next2">{{ t('common.confirm') }}</view>
    </view>

    <!-- 步骤3 医嘱 -->
    <view v-if="step === 3" class="card">
      <view class="row-between"><view class="f-label">{{ t('encounter.prescription') }}</view>
        <view class="btn-ghost" @tap="addItem">{{ t('encounter.addPrescription') }}</view></view>
      <view class="rx-item" v-for="(it, idx) in prescription" :key="idx">
        <input class="input" :placeholder="t('encounter.itemName')" v-model="it.name" />
        <input class="input" :placeholder="t('encounter.dosage')" v-model="it.dosage" />
        <input class="input" :placeholder="t('encounter.frequency')" v-model="it.frequency" />
        <input class="input" :placeholder="t('encounter.note')" v-model="it.note" />
        <view class="rx-del" @tap="prescription.splice(idx, 1)">×</view>
      </view>
      <view class="btn-primary mt" @tap="submitRecord">{{ t('encounter.submitRecord') }}</view>
    </view>

    <!-- 步骤4 完成 -->
    <view v-if="step === 4" class="card">
      <view class="done-tip">✓ {{ t('encounter.submitRecord') }} v{{ recordVersion }}</view>
      <view class="btn-primary mt" @tap="completeEncounter">{{ t('encounter.completeEncounter') }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'
import { GqlError } from '../../services/gql'

const steps = ['step1', 'step2', 'step3', 'step4']
const step = ref(1)
const encounterId = ref('')
const chiefComplaint = ref('')
const diagnosis = ref('')
const prescription = ref([{ name: '', dosage: '', frequency: '', note: '' }])
const recordVersion = ref(0)

onLoad(async (q) => {
  encounterId.value = String(q.id || '')
  const enc = await api.encounter(encounterId.value)
  if (enc && enc.status === 'PENDING') {
    await api.startEncounter(encounterId.value).catch(() => {})
  }
})

function goStep(n) {
  if (n <= step.value) step.value = n
}

function next1() {
  if (!chiefComplaint.value.trim()) { uni.showToast({ title: t('encounter.needStep'), icon: 'none' }); return }
  step.value = 2
}
function next2() {
  if (!diagnosis.value.trim()) { uni.showToast({ title: t('encounter.needStep'), icon: 'none' }); return }
  step.value = 3
}
function addItem() { prescription.value.push({ name: '', dosage: '', frequency: '', note: '' }) }

async function submitRecord() {
  const rx = prescription.value.filter(it => it.name.trim())
  if (!rx.length) { uni.showToast({ title: t('encounter.needStep'), icon: 'none' }); return }
  try {
    const rec = await api.createMedicalRecord({
      encounterId: Number(encounterId.value),
      chiefComplaint: chiefComplaint.value.trim(),
      diagnosis: diagnosis.value.trim(),
      prescription: rx,
    })
    recordVersion.value = rec.version
    step.value = 4
    uni.showToast({ title: t('common.success'), icon: 'success' })
  } catch (e) {
    if (e instanceof GqlError) uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function completeEncounter() {
  await api.completeEncounter(encounterId.value)
  uni.showToast({ title: t('common.success'), icon: 'success' })
  setTimeout(() => uni.switchTab({ url: '/pages/home/index' }), 600)
}
</script>

<style scoped>
.steps { display: flex; justify-content: space-between; }
.step { display: flex; flex-direction: column; align-items: center; gap: 8rpx; flex: 1; }
.step-num { width: 52rpx; height: 52rpx; border-radius: 50%; background: #f0f1f0; color: #7a837f; display: flex; align-items: center; justify-content: center; font-size: 26rpx; }
.step.on .step-num { background: #2f7d5f; color: #fff; }
.step.done .step-num { background: #e8f3ee; color: #2f7d5f; }
.step-label { font-size: 24rpx; color: #7a837f; }
.step.on .step-label { color: #2f7d5f; font-weight: 600; }
.f-label { font-size: 28rpx; font-weight: 600; margin-bottom: 16rpx; }
.mt { margin-top: 32rpx; }
.rx-item { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; padding: 16rpx; background: #fafbfa; border-radius: 12rpx; margin-bottom: 16rpx; }
.rx-del { position: absolute; right: 8rpx; top: 0; font-size: 40rpx; color: #c0504d; padding: 0 10rpx; }
.done-tip { font-size: 30rpx; color: #2f7d5f; font-weight: 600; text-align: center; padding: 30rpx 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
</style>
```

- [ ] **Step 4: 构建验证 + Commit**

```powershell
cd d:\zhao\tcm-workbench
pnpm build:h5
git add -A
git commit -m "feat: guided encounter flow (inquiry -> diagnosis -> prescription -> complete)"
```

---

### Task 7: 康养规划 + 随访（tabBar 两页 + 规划详情）

**Files:**
- Create: `d:\zhao\tcm-workbench\pages\plan\list.vue`
- Create: `d:\zhao\tcm-workbench\pages\plan\detail.vue`
- Create: `d:\zhao\tcm-workbench\pages\followup\list.vue`
- Modify: `d:\zhao\tcm-workbench\pages.json`（登记三页 + 补 tabBar）

- [ ] **Step 1: pages.json**：pages 数组追加

```json
    { "path": "pages/plan/list", "style": { "navigationBarTitleText": "康养规划" } },
    { "path": "pages/plan/detail", "style": { "navigationBarTitleText": "规划详情" } },
    { "path": "pages/followup/list", "style": { "navigationBarTitleText": "随访任务" } }
```

并补 tabBar：

```json
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#2f7d5f",
    "borderStyle": "black",
    "backgroundColor": "#ffffff",
    "list": [
      { "pagePath": "pages/home/index", "text": "工作台" },
      { "pagePath": "pages/plan/list", "text": "康养规划" },
      { "pagePath": "pages/followup/list", "text": "随访" }
    ]
  }
```

- [ ] **Step 2: plan/list.vue**（列表 + 新建表单 + 状态流转按钮；患者名从 patientProfiles 映射）

```vue
<template>
  <view>
    <view class="btn-ghost create-btn" @tap="showCreate = !showCreate">{{ t('plan.create') }}</view>

    <view v-if="showCreate" class="card">
      <picker :range="patientNames" @change="onPickPatient">
        <view class="input">{{ newPlan.patientName || t('plan.pickPatient') }}</view>
      </picker>
      <input class="input mt8" :placeholder="t('plan.titlePh')" v-model="newPlan.text" />
      <view class="date-row">
        <picker mode="date" @change="e => newPlan.start = e.detail.value"><view class="input">{{ newPlan.start || t('plan.cycle') + '起' }}</view></picker>
        <picker mode="date" @change="e => newPlan.end = e.detail.value"><view class="input">{{ newPlan.end || t('plan.cycle') + '止' }}</view></picker>
      </view>
      <view class="btn-primary mt8" @tap="createPlan">{{ t('common.submit') }}</view>
    </view>

    <view class="card" v-for="p in plans" :key="p.id" @tap="goDetail(p)">
      <view class="row-between">
        <view class="pl-title">{{ p.title }}</view>
        <text class="tag" :class="statusClass(p.status)">{{ t('plan.status_' + p.status) }}</text>
      </view>
      <view class="pl-patient">{{ patientName(p.patientProfileId) }}</view>
      <view class="pl-cycle">{{ (p.cycleStart || '').slice(0, 10) }} ~ {{ (p.cycleEnd || '').slice(0, 10) }}</view>
      <view class="actions" @tap.stop>
        <view v-if="p.status === 'DRAFT'" class="btn-ghost" @tap="transition(p, 'ACTIVE')">{{ t('plan.toActive') }}</view>
        <view v-if="p.status === 'ACTIVE'" class="btn-ghost" @tap="transition(p, 'PAUSED')">{{ t('plan.toPaused') }}</view>
        <view v-if="p.status === 'ACTIVE' || p.status === 'PAUSED'" class="btn-danger" @tap="transition(p, 'CLOSED')">{{ t('plan.toClosed') }}</view>
      </view>
    </view>
    <view v-if="!plans.length" class="empty">{{ t('common.empty') }}</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const showCreate = ref(false)
const plans = ref([])
const patients = ref([])
const newPlan = ref({ patientProfileId: null, patientName: '', text: '', start: '', end: '' })

const patientNames = ref([])
const patientName = (id) => {
  const p = patients.value.find(x => String(x.id) === String(id))
  return p ? p.customerName : `#${id}`
}

onShow(refresh)

async function refresh() {
  const [plansRes, profilesRes] = await Promise.all([api.wellnessPlans(0, 50), api.patientProfiles(0, 100)])
  plans.value = plansRes.items
  patients.value = profilesRes.items
  patientNames.value = patients.value.map(p => p.customerName)
}

function onPickPatient(e) {
  const p = patients.value[e.detail.value]
  newPlan.value.patientProfileId = Number(p.id)
  newPlan.value.patientName = p.customerName
}

async function createPlan() {
  if (!newPlan.value.patientProfileId || !newPlan.value.text.trim()) return
  const src = patients.value.find(x => Number(x.id) === newPlan.value.patientProfileId)
  await api.createWellnessPlan({
    patientProfileId: newPlan.value.patientProfileId,
    clinicId: Number(src?.clinicId ?? 0),
    title: newPlan.value.text.trim(),
    cycleStart: newPlan.value.start || undefined,
    cycleEnd: newPlan.value.end || undefined,
  })
  showCreate.value = false
  newPlan.value = { patientProfileId: null, patientName: '', text: '', start: '', end: '' }
  refresh()
}

async function transition(p, to) {
  await api.transitionWellnessPlan(String(p.id), to)
  refresh()
}

function goDetail(p) { uni.navigateTo({ url: `/pages/plan/detail?id=${p.id}` }) }
function statusClass(s) { return { DRAFT: 'tag-gray', ACTIVE: 'tag-green', PAUSED: 'tag-gray', CLOSED: 'tag-red' }[s] }
</script>

<style scoped>
.create-btn { margin: 20rpx 24rpx; text-align: center; }
.mt8 { margin-top: 16rpx; }
.date-row { display: flex; gap: 16rpx; margin-top: 16rpx; }
.date-row > picker { flex: 1; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
.pl-title { font-size: 30rpx; font-weight: 600; }
.pl-patient { font-size: 26rpx; color: #303133; margin-top: 10rpx; }
.pl-cycle { font-size: 24rpx; color: #7a837f; margin-top: 6rpx; }
.actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
</style>
```

- [ ] **Step 3: plan/detail.vue**（计划项增补 + 随访创建 + 计划随访列表操作）

```vue
<template>
  <view v-if="plan">
    <view class="card">
      <view class="row-between">
        <view class="pl-title">{{ plan.title }}</view>
        <text class="tag" :class="{ DRAFT: 'tag-gray', ACTIVE: 'tag-green', PAUSED: 'tag-gray', CLOSED: 'tag-red' }[plan.status]">{{ t('plan.status_' + plan.status) }}</text>
      </view>
      <view class="pl-cycle">{{ (plan.cycleStart || '').slice(0, 10) }} ~ {{ (plan.cycleEnd || '').slice(0, 10) }}</view>
    </view>

    <view class="section-title row-between">
      <text>{{ t('plan.items') }}</text>
      <view class="btn-ghost" @tap="showItem = !showItem">{{ t('plan.addItem') }}</view>
    </view>
    <view v-if="showItem" class="card">
      <input class="input" :placeholder="t('plan.itemTitle')" v-model="itemForm.title" />
      <input class="input mt8" :placeholder="t('plan.frequency')" v-model="itemForm.frequency" />
      <input class="input mt8" type="number" :placeholder="t('plan.variantId')" v-model="itemForm.variantId" />
      <view class="btn-primary mt8" @tap="addItem">{{ t('common.submit') }}</view>
    </view>
    <view class="card" v-for="it in plan.items" :key="it.id">
      <view class="it-title">{{ it.title }}</view>
      <view class="it-meta">{{ it.frequency || '--' }}<text v-if="it.productVariantId"> · variant {{ it.productVariantId }}</text></view>
    </view>

    <view class="section-title row-between">
      <text>{{ t('plan.followUps') }}</text>
      <view class="btn-ghost" @tap="showFu = !showFu">{{ t('followup.create') }}</view>
    </view>
    <view v-if="showFu" class="card">
      <input class="input" :placeholder="t('followup.titlePh')" v-model="fuForm.title" />
      <picker mode="date" @change="e => fuForm.date = e.detail.value">
        <view class="input mt8">{{ fuForm.date || t('followup.dueAt') }}</view>
      </picker>
      <view class="ch-row">
        <view v-for="c in ['sms', 'wechat', 'phone']" :key="c" class="type-chip" :class="{ on: fuForm.channel === c }" @tap="fuForm.channel = c">{{ t('followup.' + c) }}</view>
      </view>
      <view class="btn-primary mt8" @tap="createFu">{{ t('common.submit') }}</view>
    </view>
    <view class="card" v-for="f in plan.followUps" :key="f.id">
      <view class="row-between">
        <view class="it-title">{{ f.title }}</view>
        <text class="tag" :class="{ PENDING: 'tag-red', DONE: 'tag-green', CANCELED: 'tag-gray' }[f.status]">{{ t('followup.status_' + f.status) }}</text>
      </view>
      <view class="it-meta">{{ (f.dueAt || '').slice(0, 10) }} · {{ t('followup.' + f.channel) }}</view>
      <view class="actions" v-if="f.status === 'PENDING'">
        <view class="btn-ghost" @tap="completeFu(f)">{{ t('followup.complete') }}</view>
        <view class="btn-danger" @tap="cancelFu(f)">{{ t('followup.cancel') }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const planId = ref('')
const plan = ref(null)
const showItem = ref(false)
const showFu = ref(false)
const itemForm = ref({ title: '', frequency: '', variantId: '' })
const fuForm = ref({ title: '', date: '', channel: 'wechat' })

onLoad(q => { planId.value = String(q.id || '') })
onShow(refresh)

async function refresh() {
  plan.value = await api.wellnessPlan(planId.value)
}

async function addItem() {
  if (!itemForm.value.title.trim()) return
  await api.addPlanItem({
    planId: Number(planId.value),
    title: itemForm.value.title.trim(),
    frequency: itemForm.value.frequency || undefined,
    productVariantId: itemForm.value.variantId ? Number(itemForm.value.variantId) : undefined,
  })
  itemForm.value = { title: '', frequency: '', variantId: '' }
  showItem.value = false
  refresh()
}

async function createFu() {
  if (!fuForm.value.title.trim() || !fuForm.value.date) return
  await api.createFollowUp({
    patientProfileId: Number(plan.value.patientProfileId),
    planId: Number(planId.value),
    title: fuForm.value.title.trim(),
    dueAt: `${fuForm.value.date}T09:00:00.000Z`,
    channel: fuForm.value.channel,
  })
  fuForm.value = { title: '', date: '', channel: 'wechat' }
  showFu.value = false
  refresh()
}

async function completeFu(f) { await api.completeFollowUp(String(f.id)); refresh() }
async function cancelFu(f) { await api.cancelFollowUp(String(f.id)); refresh() }
</script>

<style scoped>
.row-between { display: flex; justify-content: space-between; align-items: center; }
.pl-title { font-size: 32rpx; font-weight: 600; }
.pl-cycle { font-size: 24rpx; color: #7a837f; margin-top: 8rpx; }
.mt8 { margin-top: 16rpx; }
.it-title { font-size: 28rpx; font-weight: 600; }
.it-meta { font-size: 24rpx; color: #7a837f; margin-top: 8rpx; }
.ch-row { display: flex; gap: 16rpx; margin-top: 16rpx; }
.type-chip { flex: 1; text-align: center; background: #f6f7f6; border-radius: 12rpx; padding: 14rpx 0; font-size: 26rpx; color: #7a837f; }
.type-chip.on { background: #e8f3ee; color: #2f7d5f; font-weight: 600; }
.actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
</style>
```

- [ ] **Step 4: followup/list.vue**（全量随访任务，按状态分组 + 完成/取消）

```vue
<template>
  <view>
    <view v-for="group in groups" :key="group.status">
      <view class="section-title">{{ t('followup.status_' + group.status) }}（{{ group.items.length }}）</view>
      <view class="card" v-for="f in group.items" :key="f.id">
        <view class="row-between">
          <view class="fu-title">{{ f.title }}</view>
          <text class="tag" :class="{ PENDING: 'tag-red', DONE: 'tag-green', CANCELED: 'tag-gray' }[f.status]">{{ t('followup.status_' + f.status) }}</text>
        </view>
        <view class="fu-meta">{{ (f.dueAt || '').slice(0, 10) }} · {{ t('followup.' + f.channel) }}</view>
        <view class="actions" v-if="f.status === 'PENDING'">
          <view class="btn-ghost" @tap="complete(f)">{{ t('followup.complete') }}</view>
          <view class="btn-danger" @tap="cancel(f)">{{ t('followup.cancel') }}</view>
        </view>
      </view>
    </view>
    <view v-if="!tasks.length" class="empty">{{ t('common.empty') }}</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const tasks = ref([])
const groups = computed(() => ['PENDING', 'DONE', 'CANCELED']
  .map(status => ({ status, items: tasks.value.filter(x => x.status === status) }))
  .filter(g => g.items.length))

onShow(refresh)

async function refresh() {
  const res = await api.followUpTasks(0, 100)
  tasks.value = res.items
}

async function complete(f) { await api.completeFollowUp(String(f.id)); refresh() }
async function cancel(f) { await api.cancelFollowUp(String(f.id)); refresh() }
</script>

<style scoped>
.row-between { display: flex; justify-content: space-between; align-items: center; }
.fu-title { font-size: 28rpx; font-weight: 600; }
.fu-meta { font-size: 24rpx; color: #7a837f; margin-top: 8rpx; }
.actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
</style>
```

- [ ] **Step 5: 构建验证 + Commit**

```powershell
cd d:\zhao\tcm-workbench
pnpm build:h5
git add -A
git commit -m "feat: wellness plans + follow-up management (tab pages)"
```

---

### Task 8: 病志档案（列表 + 详情/版本链/修改留痕）

**Files:**
- Create: `d:\zhao\tcm-workbench\pages\record\list.vue`
- Create: `d:\zhao\tcm-workbench\pages\record\detail.vue`
- Modify: `d:\zhao\tcm-workbench\pages.json`（登记两页）

- [ ] **Step 1: pages.json 登记**

```json
    { "path": "pages/record/list", "style": { "navigationBarTitleText": "病志档案" } },
    { "path": "pages/record/detail", "style": { "navigationBarTitleText": "病志详情" } }
```

- [ ] **Step 2: record/list.vue**

```vue
<template>
  <view>
    <view class="card" v-for="r in records" :key="r.id" @tap="goDetail(r)">
      <view class="row-between">
        <view class="r-diag">{{ r.diagnosis }}</view>
        <text class="tag tag-green">v{{ r.version }}</text>
      </view>
      <view class="r-cc">{{ r.chiefComplaint }}</view>
    </view>
    <view v-if="!records.length" class="empty">{{ t('common.empty') }}</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const records = ref([])
onShow(refresh)
async function refresh() {
  const res = await api.medicalRecords(0, 50)
  records.value = res.items
}
function goDetail(r) { uni.navigateTo({ url: `/pages/record/detail?id=${r.id}` }) }
</script>

<style scoped>
.row-between { display: flex; justify-content: space-between; align-items: center; }
.r-diag { font-size: 30rpx; font-weight: 600; }
.r-cc { font-size: 26rpx; color: #7a837f; margin-top: 8rpx; }
</style>
```

- [ ] **Step 3: record/detail.vue**（字段展示 + 版本链时间线 + 修改弹层走 updateMedicalRecord）

```vue
<template>
  <view v-if="record">
    <view class="card">
      <view class="row-between">
        <view class="f-label">{{ t('record.version') }} v{{ record.version }}</view>
        <view class="btn-ghost" @tap="openEdit">{{ t('record.edit') }}</view>
      </view>
      <view class="f-label mt16">{{ t('record.chiefComplaint') }}</view>
      <view class="f-value">{{ record.chiefComplaint }}</view>
      <view class="f-label mt16">{{ t('record.diagnosis') }}</view>
      <view class="f-value">{{ record.diagnosis }}</view>
      <view class="f-label mt16">{{ t('record.prescription') }}</view>
      <view class="f-value" v-for="(it, i) in record.prescription" :key="i">
        {{ it.name }} · {{ it.dosage || '--' }} · {{ it.frequency || '--' }}
      </view>
    </view>

    <view class="section-title">{{ t('record.revisions') }}</view>
    <view class="card">
      <view class="rev" v-for="r in record.revisions" :key="r.version">
        <text class="rev-dot"></text>
        <text>v{{ r.version }} · {{ (r.createdAt || '').slice(0, 19).replace('T', ' ') }} · staff {{ r.editedByStaffId }}</text>
      </view>
      <view v-if="!record.revisions.length" class="empty">{{ t('common.empty') }}</view>
    </view>

    <view v-if="editing" class="mask" @tap="editing = false">
      <view class="editor" @tap.stop>
        <view class="f-label">{{ t('record.chiefComplaint') }}</view>
        <textarea class="textarea" v-model="editForm.chiefComplaint" />
        <view class="f-label mt16">{{ t('record.diagnosis') }}</view>
        <textarea class="textarea" v-model="editForm.diagnosis" />
        <view class="f-label mt16">{{ t('record.prescription') }}(JSON)</view>
        <textarea class="textarea" v-model="editForm.prescriptionJson" />
        <view class="btn-primary mt16" @tap="save">{{ t('common.save') }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../services/api'
import { t } from '../../utils/i18n'

const record = ref(null)
const editing = ref(false)
const editForm = ref({ chiefComplaint: '', diagnosis: '', prescriptionJson: '' })
const id = ref('')

onLoad(q => { id.value = String(q.id || ''); refresh() })

async function refresh() {
  record.value = await api.medicalRecord(id.value)
}

function openEdit() {
  editForm.value = {
    chiefComplaint: record.value.chiefComplaint,
    diagnosis: record.value.diagnosis,
    prescriptionJson: JSON.stringify(record.value.prescription, null, 2),
  }
  editing.value = true
}

async function save() {
  let prescription
  try { prescription = JSON.parse(editForm.value.prescriptionJson) } catch { uni.showToast({ title: 'JSON invalid', icon: 'none' }); return }
  await api.updateMedicalRecord(id.value, {
    chiefComplaint: editForm.value.chiefComplaint,
    diagnosis: editForm.value.diagnosis,
    prescription,
  })
  editing.value = false
  uni.showToast({ title: t('common.success'), icon: 'success' })
  refresh()
}
</script>

<style scoped>
.row-between { display: flex; justify-content: space-between; align-items: center; }
.f-label { font-size: 26rpx; color: #7a837f; }
.mt16 { margin-top: 20rpx; }
.f-value { font-size: 30rpx; color: #303133; margin-top: 8rpx; }
.rev { display: flex; align-items: center; gap: 12rpx; font-size: 26rpx; color: #303133; padding: 10rpx 0; }
.rev-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #2f7d5f; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 99; }
.editor { width: 640rpx; background: #fff; border-radius: 16rpx; padding: 32rpx; }
</style>
```

- [ ] **Step 4: 构建验证 + Commit**

```powershell
cd d:\zhao\tcm-workbench
pnpm build:h5
git add -A
git commit -m "feat: medical record archive (list + detail with revision timeline and edit)"
```

---

### Task 9: 联调 fixture + 手机截图 + 操作手册 + 全量回归 + 收尾

**Files:**
- Create: `d:\zhao\vendure\packages\tcm-clinic-plugin\scripts\dev-fixture.mts`
- Create: `d:\zhao\tcm-workbench\scripts\shoot.py`
- Create: `d:\zhao\tcm-workbench\docs\manual.md`（操作手册，含截图）
- Create: `d:\zhao\tcm-workbench\docs\shots\*.png`（截图产物）

- [ ] **Step 1: dev-fixture.mts**（独立联调后端：sqljs 内存库 + mock SSO，无需真实 DB；种子数据含 1 馆 1 医生 2 患者）

```ts
/**
 * 医生工作台联调 fixture：standalone vendure + tcm-clinic-plugin（mock SSO）
 * 运行：cd packages/tcm-clinic-plugin && npx tsx scripts/dev-fixture.mts
 * 医生账号：mock 手机号 13800000001（identifier=13800000001@tcm.test）
 */
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import { TcmClinicPlugin } from '../src/plugin';
import path from 'path';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '../e2e/__data__fixture__')));

const { server, adminClient, shopClient } = createTestEnvironment(
    mergeConfig(testConfig, {
        apiOptions: { port: 3930 },
        plugins: [TcmClinicPlugin.init({ sso: { baseUrl: 'http://127.0.0.1:9', mock: true } })],
    }),
);

async function seed() {
    await adminClient.asSuperAdmin();
    await adminClient.query(`mutation { createClinic(input: { name: "同德堂中医馆", licenseNo: "BA1101", address: "北京市朝阳区杏林路 1 号" }) { id } }`);
    const roles = await adminClient.query(`query { roles(options: { take: 20 }) { items { id code } } }`);
    const adminRole = roles.roles.items.find((r: any) => r.code === 'superadmin');
    const doctor = await adminClient.query(`mutation {
        createAdministrator(input: { firstName: "张", lastName: "医生", emailAddress: "13800000001@tcm.test", password: "test", roleIds: [${adminRole.id}] }) { id }
    }`);
    await adminClient.query(`mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${Number(String(doctor.createAdministrator.id).replace('T_', ''))}, displayName: "张医生" }) { id } }`);
    for (const [name, phone] of [['李患者', '13900000002'], ['王患者', '13900000003']] as const) {
        await shopClient.query(`mutation { register(input: { emailAddress: "${phone}@p.test", firstName: "${name}", lastName: "", password: "test" }) }`);
        const customers = await adminClient.query(`query { customers(options: { take: 20 }) { items { id firstName } } }`);
        const c = customers.customers.items.find((x: any) => x.firstName === name);
        await adminClient.query(`mutation { createPatientProfile(input: { clinicId: 1, customerId: ${Number(String(c.id).replace('T_', ''))}, constitution: { type: "平和质" } }) { id } }`);
    }
}

async function main() {
    await server.init({
        initialData: {
            defaultLanguage: LanguageCode.zh_Hans,
            defaultZone: 'Asia',
            countries: [{ code: 'CN', name: 'China', zone: 'Asia' }],
            taxRates: [{ name: 'Standard Tax', percentage: 13 }],
            shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
            paymentMethods: [],
            collections: [],
        },
        productsCsvPath: '',
        customerCount: 0,
    });
    await seed();
    console.log('=== TCM fixture ready ===');
    console.log('admin-api: http://localhost:3930/admin-api');
    console.log('doctor mock login: phone 13800000001');
}

main();
```

运行：`cd d:\zhao\vendure\packages\tcm-clinic-plugin; npx tsx scripts/dev-fixture.mts`（后台运行，保持进程存活）。tsx 若未安装会由 npx 自动拉取；失败则 `pnpm add -D tsx` 到该包。

- [ ] **Step 2: 本地联调冒烟**。`pnpm dev:h5` 起 5177（vite proxy 已指向 3930）。浏览器 mock-login 输入 13800000001 登录 → 能看到首页统计与两位患者。手工验证不过不进下一步。

- [ ] **Step 3: shoot.py 手机视口截图**（Playwright 390×844 dpr=2，走 UI 驱动全流程）

```python
# d:\zhao\tcm-workbench\scripts\shoot.py
# 运行前提：dev-fixture(3930) + pnpm dev:h5(5177) 已启动
# pip install playwright; playwright install chromium
from playwright.sync_api import sync_playwright
import pathlib

BASE = "http://localhost:5177"
OUT = pathlib.Path(__file__).parent.parent / "docs" / "shots"
OUT.mkdir(parents=True, exist_ok=True)

def shot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"))
    print("shot:", name)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(f"{BASE}/#/pages/mock-login/mock-login")
    page.wait_for_timeout(1200)
    page.fill("input[type=number]", "13800000001")
    page.get_by_text("进入工作台").click()
    page.wait_for_timeout(2000)
    shot(page, "01-home")

    # 新建接诊（选患者）
    page.get_by_text("新建接诊").click()
    page.wait_for_timeout(1500)
    shot(page, "02-encounter-create")
    page.get_by_text("李患者").first.click()
    page.get_by_text("建档接诊").click()
    page.wait_for_timeout(1500)

    # 流程四步
    shot(page, "03-flow-step1")
    page.locator("textarea").fill("咳嗽三日，恶寒无汗")
    page.locator(".btn-primary").first.click()
    page.wait_for_timeout(800)
    page.locator("textarea").fill("风寒袭肺证")
    page.locator(".btn-primary").first.click()
    page.wait_for_timeout(800)
    shot(page, "04-flow-step3")
    page.locator(".rx-item input").nth(0).fill("荆防败毒散")
    page.locator(".rx-item input").nth(1).fill("7剂")
    page.locator(".rx-item input").nth(2).fill("日一剂")
    page.get_by_text("提交病志").click()
    page.wait_for_timeout(1500)
    shot(page, "05-flow-step4")
    page.get_by_text("完成接诊").click()
    page.wait_for_timeout(1500)

    # 康养规划
    page.goto(f"{BASE}/#/pages/plan/list")
    page.wait_for_timeout(1500)
    shot(page, "06-plan-list")
    page.get_by_text("新建规划").click()
    page.wait_for_timeout(500)
    page.locator("picker").first.click()
    page.wait_for_timeout(400)
    page.get_by_text("李患者").first.click()
    page.get_by_text("确定").first.click()
    page.locator("input").first.fill("冬季温养方案")
    page.get_by_text("提交").click()
    page.wait_for_timeout(1200)
    page.get_by_text("冬季温养方案").first.click()
    page.wait_for_timeout(1500)
    shot(page, "07-plan-detail")
    page.get_by_text("添加计划项").click()
    page.locator("input").nth(0).fill("艾灸足三里")
    page.locator("input").nth(1).fill("每周2次")
    page.get_by_text("提交").click()
    page.wait_for_timeout(1000)
    page.get_by_text("新建随访").click()
    page.locator("input").first.fill("一周后回访")
    page.get_by_text("提交").click()
    page.wait_for_timeout(1000)
    shot(page, "08-plan-detail-filled")

    # 随访页
    page.goto(f"{BASE}/#/pages/followup/list")
    page.wait_for_timeout(1500)
    shot(page, "09-followups")

    # 病志
    page.goto(f"{BASE}/#/pages/record/list")
    page.wait_for_timeout(1500)
    shot(page, "10-records")
    page.get_by_text("风寒袭肺证").first.click()
    page.wait_for_timeout(1500)
    shot(page, "11-record-detail")

    browser.close()
print("done ->", OUT)
```

（uni picker 选择器结构不稳，允许跑两次修 selector，产物以最后一轮为准。）

- [ ] **Step 4: 操作手册** `docs/manual.md`：含 ①访问方式与部署路径（base /workbench/）；②登录（SSO 流程 + 医生账号绑定约定：Administrator identifier=手机号 或邮箱与 SSO 一致；本地 mock 模式说明）；③功能操作（引用 docs/shots 截图，逐页说明）；④环境变量清单（VITE_AUTH_MODE/VITE_SSO_LOGIN_URL/VITE_SSO_APP_CODE/VITE_ADMIN_API_BASE/VITE_API_TARGET、服务端 TcmClinicPlugin.init({ sso }) 与 SSO_MOCK）；⑤测试账号与联调 fixture 用法。

- [ ] **Step 5: 全量回归**。

```powershell
cd d:\zhao\vendure\packages\tcm-clinic-plugin
npx tsc --noEmit
Remove-Item -Recurse -Force e2e\__data__, e2e\__data__sso__, e2e\__data__fixture__ -ErrorAction SilentlyContinue
npx vitest --config vitest.config.mts --run
cd d:\zhao\tcm-workbench
pnpm build:h5
```

Expected: tsc 零错误、e2e 两套全绿、h5 构建成功。

- [ ] **Step 6: 生产配置核查**。搜索 vendure 仓库内是否存在 dev-config 之外的插件注册点（`Grep "CjkPlugin" --glob *.ts` 除 dev-config 外的命中；pm2 启动脚本/部署文档指向哪个 config）。若存在独立生产 config，把 `TcmClinicPlugin.init({ sso: { baseUrl: process.env.ZHAO_SSO_BASE_URL } })` 同样注册进去；若 dev-config 即 pm2 运行入口则无需动作。**结论写进 manual.md 部署节**。

- [ ] **Step 7: 收尾提交推送**。

```powershell
cd d:\zhao\vendure
git add packages/tcm-clinic-plugin
git commit -m "feat(tcm): dev fixture for workbench e2e integration"
git push origin master

cd d:\zhao\tcm-workbench
git add -A
git commit -m "docs: manual + mobile screenshots; chore: playwright shoot script"
# 远端：gh repo create johocn/tcm-workbench --private --source . --push（gh 不可用则本地保留并在收尾报告中说明）
```

部署例外说明：workbench 首次部署需服务器 nginx 站点目录与域名（参照 nshop/web-admin 的 scripts/deploy.mjs 机制），服务器路径信息不在本仓库内——此为「需要补充」事项，收尾时向用户提出，不擅自部署。

---

## Self-Review 结论

- 规格覆盖：spec §7 医生工作台 A/B 混合（Task 5 B 速查首页 / Task 6 A 流程录入）、§9 手机截图+手册（Task 9）、i18n 双语（Task 3 字典、各页 t() 全覆盖）、合规留痕展示（Task 8 版本链）；患者端双页属 Plan 3，不在本计划。
- 类型一致性：api.ts 字段名与 Task 1 schema（TcmPatientProfileView.customerName/customerPhone、TcmEncounterListOptions.since、TcmWellnessPlanDetailView.items/followUps）、Task 2 策略输入（tcmSso.accessToken）逐一对齐；完整接诊闭环 createEncounter→startEncounter→createMedicalRecord→completeEncounter 与既有状态机一致。
- 已知风险已在步骤内固化：revision 关联列名（Task 1 Step 1 先读后写）、uni picker 选择器（Task 9 允许二次修）、tsx 运行时（fallback pnpm add -D tsx）。
