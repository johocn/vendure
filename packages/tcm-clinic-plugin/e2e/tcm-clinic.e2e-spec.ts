import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TcmClinicPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('TcmClinicPlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: { port: 3920 },
            plugins: [TcmClinicPlugin.init({})],
        }),
    );

    beforeAll(async () => {
        // retention describe 在模块加载时会重设插件静态 options，这里显式恢复本 describe 的默认配置
        TcmClinicPlugin.init({});
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

    it('staff guard + patient profile creation', async () => {
        // 建第二家馆
        await adminClient.query(gql`
            mutation {
                createClinic(input: { name: "仁济馆", licenseNo: "BA1102" }) { id }
            }
        `);
        // 当前超管绑定为馆1医生（测试环境 ID 带 T_ 前缀，需还原数字）
        const me = await adminClient.query(gql`
            query { me { id } }
        `);
        const adminId = Number(String(me.me.id).replace('T_', ''));
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
        expect(Number(String(staffRes.createClinicStaff.clinicId).replace('T_', ''))).toBe(1);
        // 馆2 未绑定 → 建档应被拒绝（守卫抛 ForbiddenError，固定文案）
        await expect(
            adminClient.query(gql`
                mutation {
                    createPatientProfile(input: { clinicId: 2, customerId: 1 }) { id }
                }
            `),
        ).rejects.toThrow(/not currently authorized/);
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
        expect(Number(String(okRes.createPatientProfile.customerId).replace('T_', ''))).toBe(1);
        expect(okRes.createPatientProfile.constitution.type).toBe('阳虚质');
    });

    it('encounter state machine with optimistic lock', async () => {
        const created = await adminClient.query(gql`
            mutation {
                createEncounter(input: { patientProfileId: 1, clinicId: 1, type: "initial" }) {
                    id
                    status
                    version
                }
            }
        `);
        expect(created.createEncounter.status).toBe('PENDING');
        const id = created.createEncounter.id;
        // 已有未完成接诊（PENDING）时重复创建 → 拒绝（UserInputError，message 可透传）
        await expect(
            adminClient.query(gql`
                mutation {
                    createEncounter(input: { patientProfileId: 1, clinicId: 1, type: "revisit" }) { id }
                }
            `),
        ).rejects.toThrow(/已有未完成接诊/);
        const started = await adminClient.query(gql`
            mutation { startEncounter(id: "${id}") { id status } }
        `);
        expect(started.startEncounter.status).toBe('ACTIVE');
        const completed = await adminClient.query(gql`
            mutation { completeEncounter(id: "${id}") { id status } }
        `);
        expect(completed.completeEncounter.status).toBe('COMPLETED');
        // 已完成再 start → 报错（IllegalOperationError）
        await expect(
            adminClient.query(gql`
                mutation { startEncounter(id: "${id}") { id } }
            `),
        ).rejects.toThrow(/非法状态迁移/);
    });

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
                updateMedicalRecord(id: "${id}", input: { diagnosis: "不寐·心脾两虚（加重）" }) { id version }
            }
        `);
        expect(updated.updateMedicalRecord.version).toBe(2);
        const detail = await adminClient.query(gql`
            query { medicalRecords(options: {}) {
                items { id clinicId version chiefComplaint diagnosis prescription revisions { version editedByStaffId } }
            } }
        `);
        // 跨馆隔离回归：当前超管只绑定馆1，馆2 无病志数据，medicalRecords 应全部 clinicId===1
        expect(detail.medicalRecords.items.length).toBeGreaterThan(0);
        expect(
            detail.medicalRecords.items.every(i => Number(String(i.clinicId).replace('T_', '')) === 1),
        ).toBe(true);
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

    it('wellness plan lifecycle with plan items and follow-ups', async () => {
        const plan = await adminClient.query(gql`
            mutation {
                createWellnessPlan(input: { patientProfileId: 1, clinicId: 1, title: "温阳调理 8 周方案" }) {
                    id
                    status
                }
            }
        `);
        expect(plan.createWellnessPlan.status).toBe('DRAFT');
        const planId = Number(String(plan.createWellnessPlan.id).replace('T_', ''));
        const item = await adminClient.query(gql`
            mutation {
                addPlanItem(input: { planId: ${planId}, title: "艾灸关元穴", frequency: "每周二/四", productVariantId: 1 }) {
                    id
                    title
                }
            }
        `);
        expect(item.addPlanItem.title).toBe('艾灸关元穴');
        const activated = await adminClient.query(gql`
            mutation { transitionWellnessPlan(id: "${plan.createWellnessPlan.id}", to: ACTIVE) { status } }
        `);
        expect(activated.transitionWellnessPlan.status).toBe('ACTIVE');
        const fu = await adminClient.query(gql`
            mutation {
                createFollowUp(input: { patientProfileId: 1, planId: ${planId}, title: "3天后复诊随访", dueAt: "2026-10-12T10:00:00.000Z" }) {
                    id
                    status
                }
            }
        `);
        expect(fu.createFollowUp.status).toBe('PENDING');
        const done = await adminClient.query(gql`
            mutation { completeFollowUp(id: "${fu.createFollowUp.id}") { status } }
        `);
        expect(done.completeFollowUp.status).toBe('DONE');
        // ACTIVE → ACTIVE 非法迁移（IllegalOperationError，message 可透传）
        await expect(
            adminClient.query(gql`
                mutation { transitionWellnessPlan(id: "${plan.createWellnessPlan.id}", to: ACTIVE) { status } }
            `),
        ).rejects.toThrow(/非法状态迁移/);
    });

    it('shop API returns only own data with masked summaries', async () => {
        // 种子客户（customerCount: 1 自动创建，faker seed(1) → hayden.zieme12@hotmail.com，密码 test）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const profile = await shopClient.query(gql`
            query { myPatientProfile { id customerId constitution } }
        `);
        expect(profile.myPatientProfile.customerId).toBeDefined(); // 非空即归属本人
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
        // 前序用例已把唯一随访完成（DONE），此处补一条 PENDING 随访供 myFollowUps 断言
        await adminClient.query(gql`
            mutation {
                createFollowUp(input: { patientProfileId: 1, planId: 1, title: "术后 7 天回访", dueAt: "2026-10-15T10:00:00.000Z" }) {
                    id
                    status
                }
            }
        `);
        const followUps = await shopClient.query(gql`
            query { myFollowUps { id title status dueAt } }
        `);
        expect(followUps.myFollowUps.length).toBe(1);
        // 未登录访问 → 报错（ForbiddenError 固定 i18n 文案）
        await shopClient.asAnonymousUser();
        await expect(
            shopClient.query(gql`
                query { myPatientProfile { id } }
            `),
        ).rejects.toThrow(/not currently authorized/);
    });

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

        // 测试环境 ID 带 T_ 前缀，Int! 输入字段需还原为数字
        const profileId = Number(String(profiles.patientProfiles.items[0].id).replace('T_', ''));
        const enc = await adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profileId}, clinicId: 1, type: "FIRST" }) { id status version } }
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

        const encounterId = Number(String(enc.createEncounter.id).replace('T_', ''));
        const rec = await adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${encounterId}, chiefComplaint: "咳嗽三日", diagnosis: "风寒袭肺", prescription: [{ name: "荆防败毒散", dosage: "7剂", frequency: "日一剂" }] }) { id version chiefComplaint } }
        `);
        expect(rec.createMedicalRecord.chiefComplaint).toBe('咳嗽三日');
        const recView = await adminClient.query(gql`
            query { medicalRecord(id: "${rec.createMedicalRecord.id}") { id version chiefComplaint diagnosis revisions { version } } }
        `);
        expect(recView.medicalRecord.version).toBe(1);
        expect(recView.medicalRecord.revisions.length).toBe(0);

        const plan = await adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profileId}, clinicId: 1, title: "冬季温养方案" }) { id status } }
        `);
        const planId = Number(String(plan.createWellnessPlan.id).replace('T_', ''));
        await adminClient.query(gql`
            mutation { addPlanItem(input: { planId: ${planId}, title: "艾灸足三里", frequency: "每周2次" }) { id } }
        `);
        await adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileId}, planId: ${planId}, title: "一周后回访", dueAt: "2026-10-20T10:00:00.000Z", channel: "wechat" }) { id } }
        `);
        const planView = await adminClient.query(gql`
            query { wellnessPlan(id: "${plan.createWellnessPlan.id}") { id title items { title } followUps { title status } } }
        `);
        expect(planView.wellnessPlan.items.length).toBe(1);
        expect(planView.wellnessPlan.followUps.length).toBe(1);
        expect(planView.wellnessPlan.followUps[0].status).toBe('PENDING');
    });

    /**
     * 跨馆隔离回归：medicalRecords / medicalRecord(id) / auditLogs 及关联列表（档案、接诊、
     * 康养计划、随访）按 clinicId 归属过滤。SuperAdmin 保留全量；无员工归属的账号返回空而非看全部。
     */
    it('跨馆隔离：馆A/馆B 员工各自只见本馆数据；无归属员工为空；superadmin 全量；匿名 FORBIDDEN', async () => {
        await adminClient.asSuperAdmin();
        const strip = (v: any) => Number(String(v).replace('T_', ''));

        // 建馆员工角色 + 三个管理员：A 绑馆1、B 绑馆2、C 故意不绑馆
        const roleRes = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "tcm-staff-e2e" description: "馆员工" permissions: [ReadCustomer, UpdateCustomer]
            }) { id } }
        `)) as any;
        const roleId = roleRes.createRole.id;
        const createStaffAdmin = async (firstName: string, lastName: string, email: string, password: string) => {
            const res = (await adminClient.query(gql`
                mutation { createAdministrator(input: {
                    firstName: "${firstName}" lastName: "${lastName}" emailAddress: "${email}" password: "${password}"
                    roleIds: ["${roleId}"]
                }) { id } }
            `)) as any;
            return strip(res.createAdministrator.id);
        };
        const adminAId = await createStaffAdmin('甲', '馆', 'tcm-a@test.com', 'tcm-a-123');
        const adminBId = await createStaffAdmin('乙', '馆', 'tcm-b@test.com', 'tcm-b-123');
        await createStaffAdmin('无', '归属', 'tcm-c@test.com', 'tcm-c-123');

        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${adminAId}, displayName: "馆A医生" }) { id } }
        `);
        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 2, administratorId: ${adminBId}, displayName: "馆B医生" }) { id } }
        `);

        // 患者档案按 customerId 全局唯一（跨馆共享一份），故另建一名客户供馆B建档
        const customerB = (await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "馆B", lastName: "患者", emailAddress: "tcm-patient-b@test.com" }) { ... on Customer { id } } }
        `)) as any;
        const customerBId = strip(customerB.createCustomer.id);

        // 馆B员工造馆B全套数据（档案/接诊/病志/康养计划/随访）
        await adminClient.asUserWithCredentials('tcm-b@test.com', 'tcm-b-123');
        const profileB = (await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 2, customerId: ${customerBId}, constitution: { type: "气虚质" } }) { id } }
        `)) as any;
        const profileBId = strip(profileB.createPatientProfile.id);
        const encB = (await adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profileBId}, clinicId: 2, type: "initial" }) { id } }
        `)) as any;
        const encBId = strip(encB.createEncounter.id);
        const recB = (await adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${encBId}, chiefComplaint: "B馆主诉", diagnosis: "B馆诊断" }) { id } }
        `)) as any;
        const recBId = strip(recB.createMedicalRecord.id);
        const planB = (await adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profileBId}, clinicId: 2, title: "B馆康养方案" }) { id } }
        `)) as any;
        const planBId = strip(planB.createWellnessPlan.id);
        const fuB = (await adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileBId}, planId: ${planBId}, title: "B馆随访", dueAt: "2026-11-05T10:00:00.000Z" }) { id } }
        `)) as any;
        const fuBId = strip(fuB.createFollowUp.id);

        // 馆B员工读取：只见馆2
        const bRecords = (await adminClient.query(gql`
            query { medicalRecords(options: {}) { totalItems items { id clinicId } } }
        `)) as any;
        expect(bRecords.medicalRecords.totalItems).toBe(1);
        expect(bRecords.medicalRecords.items.map((i: any) => strip(i.clinicId))).toEqual([2]);
        expect(bRecords.medicalRecords.items.map((i: any) => strip(i.id))).toEqual([recBId]);
        const bProfiles = (await adminClient.query(gql`
            query { patientProfiles(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(bProfiles.patientProfiles.items.every((i: any) => strip(i.clinicId) === 2)).toBe(true);
        const bEncounters = (await adminClient.query(gql`
            query { encounters(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(bEncounters.encounters.items.every((i: any) => strip(i.clinicId) === 2)).toBe(true);
        expect(bEncounters.encounters.totalItems).toBe(1);
        const bPlans = (await adminClient.query(gql`
            query { wellnessPlans(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(bPlans.wellnessPlans.items.map((i: any) => strip(i.clinicId))).toEqual([2]);
        const bFollowUps = (await adminClient.query(gql`
            query { followUpTasks(options: { take: 10 }) { totalItems items { id } } }
        `)) as any;
        expect(bFollowUps.followUpTasks.items.map((i: any) => strip(i.id))).toEqual([fuBId]);

        // 馆A员工读取：只见馆1，且拿不到馆B病志 / 档案 / 接诊 / 计划 / 随访
        await adminClient.asUserWithCredentials('tcm-a@test.com', 'tcm-a-123');
        const aRecords = (await adminClient.query(gql`
            query { medicalRecords(options: {}) { totalItems items { id clinicId } } }
        `)) as any;
        expect(aRecords.medicalRecords.totalItems).toBeGreaterThan(0);
        expect(aRecords.medicalRecords.items.every((i: any) => strip(i.clinicId) === 1)).toBe(true);
        expect(aRecords.medicalRecords.items.map((i: any) => strip(i.id))).not.toContain(recBId);
        const crossRecord = (await adminClient.query(gql`
            query { medicalRecord(id: "${recBId}") { id clinicId } }
        `)) as any;
        expect(crossRecord.medicalRecord).toBeNull();
        const aProfiles = (await adminClient.query(gql`
            query { patientProfiles(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(aProfiles.patientProfiles.items.every((i: any) => strip(i.clinicId) === 1)).toBe(true);
        expect(aProfiles.patientProfiles.items.map((i: any) => strip(i.id))).not.toContain(profileBId);
        const aEncounters = (await adminClient.query(gql`
            query { encounters(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(aEncounters.encounters.items.every((i: any) => strip(i.clinicId) === 1)).toBe(true);
        expect(aEncounters.encounters.items.map((i: any) => strip(i.id))).not.toContain(encBId);
        const aPlans = (await adminClient.query(gql`
            query { wellnessPlans(options: { take: 10 }) { totalItems items { id clinicId } } }
        `)) as any;
        expect(aPlans.wellnessPlans.items.every((i: any) => strip(i.clinicId) === 1)).toBe(true);
        expect(aPlans.wellnessPlans.items.map((i: any) => strip(i.id))).not.toContain(planBId);
        const aFollowUps = (await adminClient.query(gql`
            query { followUpTasks(options: { take: 10 }) { totalItems items { id } } }
        `)) as any;
        expect(aFollowUps.followUpTasks.items.map((i: any) => strip(i.id))).not.toContain(fuBId);

        // 无馆归属员工：返回空，不回退为「看全部」
        await adminClient.asUserWithCredentials('tcm-c@test.com', 'tcm-c-123');
        const cRecords = (await adminClient.query(gql`
            query { medicalRecords(options: {}) { totalItems items { id } } }
        `)) as any;
        expect(cRecords.medicalRecords.totalItems).toBe(0);
        expect(cRecords.medicalRecords.items).toEqual([]);
        const cProfiles = (await adminClient.query(gql`
            query { patientProfiles(options: { take: 10 }) { totalItems } }
        `)) as any;
        expect(cProfiles.patientProfiles.totalItems).toBe(0);
        const cEncounters = (await adminClient.query(gql`
            query { encounters(options: { take: 10 }) { totalItems } }
        `)) as any;
        expect(cEncounters.encounters.totalItems).toBe(0);

        // 审计日志：普通员工无权限（保持 SuperAdmin-only，故跨馆更无从泄漏）
        await adminClient.asUserWithCredentials('tcm-b@test.com', 'tcm-b-123');
        await expect(
            adminClient.query(gql`query { auditLogs(options: {}) { totalItems } }`),
        ).rejects.toThrow(/not currently authorized/);

        // SuperAdmin：病志全量（馆1 + 馆2），审计日志可读
        await adminClient.asSuperAdmin();
        const allRecords = (await adminClient.query(gql`
            query { medicalRecords(options: {}) { totalItems items { id clinicId } } }
        `)) as any;
        expect(allRecords.medicalRecords.totalItems).toBeGreaterThanOrEqual(2);
        const clinicIdsSeen = allRecords.medicalRecords.items.map((i: any) => strip(i.clinicId));
        expect(clinicIdsSeen).toContain(1);
        expect(clinicIdsSeen).toContain(2);
        expect(allRecords.medicalRecords.items.map((i: any) => strip(i.id))).toContain(recBId);
        const audits = (await adminClient.query(gql`
            query { auditLogs(options: {}) { totalItems } }
        `)) as any;
        expect(audits.auditLogs.totalItems).toBeGreaterThan(0);

        // 匿名：仍 FORBIDDEN
        await adminClient.asAnonymousUser();
        await expect(
            adminClient.query(gql`query { medicalRecords(options: {}) { totalItems } }`),
        ).rejects.toThrow(/not currently authorized/);
        await expect(
            adminClient.query(gql`query { auditLogs(options: {}) { totalItems } }`),
        ).rejects.toThrow(/not currently authorized/);
    });
});

describe('TcmClinicPlugin retention (years=0)', () => {
    const { server, adminClient } = createTestEnvironment(
        mergeConfig(testConfig, {
            apiOptions: { port: 3921 },
            plugins: [TcmClinicPlugin.init({ retentionYears: 0 })],
        }),
    );

    beforeAll(async () => {
        // 插件 options 为静态挂载：init 需在各 server bootstrap 前重新设置，避免与主 describe 互相覆盖
        TcmClinicPlugin.init({ retentionYears: 0 });
        // 独立数据目录，保证全新库；注册需在 server.init 之前生效
        registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__', 'retention')));
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
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('medical record becomes readonly once retention (years=0) expires', async () => {
        // 建馆 → 当前超管绑员工 → 建档 → 建接诊 → 建病志
        const clinic = await adminClient.query(gql`
            mutation { createClinic(input: { name: "存档馆", licenseNo: "BA2101" }) { id } }
        `);
        const clinicId = Number(String(clinic.createClinic.id).replace('T_', ''));
        const me = await adminClient.query(gql`
            query { me { id } }
        `);
        const adminId = Number(String(me.me.id).replace('T_', ''));
        await adminClient.query(gql`
            mutation {
                createClinicStaff(input: { clinicId: ${clinicId}, administratorId: ${adminId}, displayName: "钱医生", role: "doctor" }) { id }
            }
        `);
        const profile = await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: ${clinicId}, customerId: 1 }) { id } }
        `);
        const profileId = Number(String(profile.createPatientProfile.id).replace('T_', ''));
        const enc = await adminClient.query(gql`
            mutation {
                createEncounter(input: { patientProfileId: ${profileId}, clinicId: ${clinicId}, type: "initial" }) { id status }
            }
        `);
        expect(enc.createEncounter.status).toBe('PENDING');
        const encounterId = Number(String(enc.createEncounter.id).replace('T_', ''));
        const rec = await adminClient.query(gql`
            mutation {
                createMedicalRecord(input: { encounterId: ${encounterId}, chiefComplaint: "腰膝酸软", diagnosis: "肾虚腰痛" }) { id version }
            }
        `);
        expect(rec.createMedicalRecord.version).toBe(1);
        // retentionYears=0 → retentionUntil 即创建瞬间，立即更新应被拒绝（归档只读）
        await expect(
            adminClient.query(gql`
                mutation {
                    updateMedicalRecord(id: "${rec.createMedicalRecord.id}", input: { diagnosis: "肾虚腰痛（复诊）" }) { id }
                }
            `),
        ).rejects.toThrow(/归档只读/);
    });
});
