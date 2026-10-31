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
        const strip = (v: any) => Number(String(v).replace('T_', ''));
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
        const superAdminId = strip(me.me.id);
        await adminClient.query(gql`
            mutation {
                createClinicStaff(input: { clinicId: 1, administratorId: ${superAdminId}, displayName: "张医生", role: "doctor" }) {
                    id
                    clinicId
                    displayName
                }
            }
        `);
        // 另建一名真实馆1员工（非 SuperAdmin）用于验证写守卫
        const roleRes = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "tcm-guard-e2e" description: "馆1员工" permissions: [ReadCustomer, UpdateCustomer]
            }) { id } }
        `)) as any;
        const roleId = roleRes.createRole.id;
        const guardRes = (await adminClient.query(gql`
            mutation { createAdministrator(input: {
                firstName: "守卫" lastName: "员工" emailAddress: "tcm-guard@test.com" password: "tcm-guard-123"
                roleIds: ["${roleId}"]
            }) { id } }
        `)) as any;
        const guardAdminId = strip(guardRes.createAdministrator.id);
        const staffRes = await adminClient.query(gql`
            mutation {
                createClinicStaff(input: { clinicId: 1, administratorId: ${guardAdminId}, displayName: "李医生", role: "doctor" }) {
                    id
                    clinicId
                    displayName
                }
            }
        `);
        expect(staffRes.createClinicStaff.displayName).toBe('李医生');
        expect(strip(staffRes.createClinicStaff.clinicId)).toBe(1);

        await adminClient.asUserWithCredentials('tcm-guard@test.com', 'tcm-guard-123');
        // 馆2 未绑定 → 建档应被拒绝（FORBIDDEN，文案区分「不属于该馆」）
        await expect(
            adminClient.query(gql`
                mutation {
                    createPatientProfile(input: { clinicId: 2, customerId: 1 }) { id }
                }
            `),
        ).rejects.toThrow(/not bound to clinic 2|无权操作该诊所/);
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
        expect(strip(okRes.createPatientProfile.customerId)).toBe(1);
        expect(okRes.createPatientProfile.constitution.type).toBe('阳虚质');
        await adminClient.asSuperAdmin();
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

    /**
     * C：写路径馆归属校验。
     * 覆盖：A馆员工写A馆成功；A馆员工写/改B馆记录被拒；无绑定员工写被拒（文案明确）；
     * SuperAdmin 跨馆可写；匿名 FORBIDDEN。
     */
    it('写路径馆归属校验：A馆成功、跨馆写改被拒、无绑定被拒、SuperAdmin 全量、匿名 FORBIDDEN', async () => {
        await adminClient.asSuperAdmin();
        const strip = (v: any) => Number(String(v).replace('T_', ''));
        const codeOf = (err: any) => err?.response?.errors?.[0]?.extensions?.code;
        const expectForbidden = async (promise: Promise<any>, msgPattern?: RegExp) => {
            const err: any = await promise.then(() => null, (e: any) => e);
            expect(err, 'expected the operation to be rejected').toBeTruthy();
            expect(codeOf(err)).toBe('FORBIDDEN');
            if (msgPattern) {
                expect(String(err?.message ?? '')).toMatch(msgPattern);
            }
            return err;
        };

        // 角色 + 三名管理员：WA 绑馆1、WB 绑馆2、WC 不绑任何馆
        const roleRes = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "tcm-write-e2e" description: "写路径校验" permissions: [ReadCustomer, UpdateCustomer]
            }) { id } }
        `)) as any;
        const roleId = roleRes.createRole.id;
        const createAdmin = async (first: string, last: string, email: string, password: string) => {
            const res = (await adminClient.query(gql`
                mutation { createAdministrator(input: {
                    firstName: "${first}" lastName: "${last}" emailAddress: "${email}" password: "${password}"
                    roleIds: ["${roleId}"]
                }) { id } }
            `)) as any;
            return strip(res.createAdministrator.id);
        };
        const waId = await createAdmin('写', '甲', 'tcm-wa@test.com', 'tcm-wa-123');
        const wbId = await createAdmin('写', '乙', 'tcm-wb@test.com', 'tcm-wb-123');
        await createAdmin('写', '丙', 'tcm-wc@test.com', 'tcm-wc-123');
        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${waId}, displayName: "写甲医生" }) { id } }
        `);
        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 2, administratorId: ${wbId}, displayName: "写乙医生" }) { id } }
        `);

        // 三名新客户：A/B 各用于本馆建档，S 用于 SuperAdmin 跨馆建档
        const mkCustomer = async (first: string, last: string, email: string) => {
            const res = (await adminClient.query(gql`
                mutation { createCustomer(input: { firstName: "${first}", lastName: "${last}", emailAddress: "${email}" }) { ... on Customer { id } } }
            `)) as any;
            return strip(res.createCustomer.id);
        };
        const customerAId = await mkCustomer('写甲', '患者', 'tcm-wa-patient@test.com');
        const customerBId = await mkCustomer('写乙', '患者', 'tcm-wb-patient@test.com');
        const customerSId = await mkCustomer('超管', '患者', 'tcm-sa-patient@test.com');

        // —— 馆B员工先建全套数据，供馆A员工做跨馆写/改尝试 ——
        await adminClient.asUserWithCredentials('tcm-wb@test.com', 'tcm-wb-123');
        const profileB = (await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 2, customerId: ${customerBId} }) { id } }
        `)) as any;
        const profileBId = strip(profileB.createPatientProfile.id);
        const encB = (await adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profileBId}, clinicId: 2 }) { id } }
        `)) as any;
        const encBId = strip(encB.createEncounter.id);
        const recB = (await adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${encBId}, chiefComplaint: "乙馆主诉", diagnosis: "乙馆诊断" }) { id } }
        `)) as any;
        const recBId = strip(recB.createMedicalRecord.id);
        const planB = (await adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profileBId}, clinicId: 2, title: "乙馆方案" }) { id } }
        `)) as any;
        const planBId = strip(planB.createWellnessPlan.id);
        const fuB = (await adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileBId}, planId: ${planBId}, title: "乙馆随访", dueAt: "2026-11-06T10:00:00.000Z" }) { id } }
        `)) as any;
        const fuBId = strip(fuB.createFollowUp.id);

        // —— 馆A员工：本馆写成功 ——
        await adminClient.asUserWithCredentials('tcm-wa@test.com', 'tcm-wa-123');
        const profileA = (await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 1, customerId: ${customerAId} }) { id clinicId } }
        `)) as any;
        const profileAId = strip(profileA.createPatientProfile.id);
        const encA = (await adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profileAId}, clinicId: 1 }) { id } }
        `)) as any;
        const encAId = strip(encA.createEncounter.id);
        const recA = (await adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${encAId}, chiefComplaint: "甲馆主诉", diagnosis: "甲馆诊断" }) { id } }
        `)) as any;
        const recAId = strip(recA.createMedicalRecord.id);
        const planA = (await adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profileAId}, clinicId: 1, title: "甲馆方案" }) { id } }
        `)) as any;
        const planAId = strip(planA.createWellnessPlan.id);
        const fuA = (await adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileAId}, planId: ${planAId}, title: "甲馆随访", dueAt: "2026-11-06T10:00:00.000Z" }) { id } }
        `)) as any;
        const fuAId = strip(fuA.createFollowUp.id);
        const updatedA = (await adminClient.query(gql`
            mutation { updateMedicalRecord(id: "${recAId}", input: { diagnosis: "甲馆诊断（复诊）" }) { id version } }
        `)) as any;
        expect(updatedA.updateMedicalRecord.version).toBe(2);

        // —— 馆A员工：跨馆建档 / 写接诊 / 写病志 / 改病志 / 状态迁移 / 计划 / 随访 全部被拒 ——
        await expectForbidden(adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 2, customerId: ${customerBId} }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { createEncounter(input: { patientProfileId: ${profileBId}, clinicId: 1 }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { createMedicalRecord(input: { encounterId: ${encBId}, chiefComplaint: "x", diagnosis: "y" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { updateMedicalRecord(id: "${recBId}", input: { diagnosis: "被跨馆改写" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { startEncounter(id: "${encBId}") { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { completeEncounter(id: "${encBId}") { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { createWellnessPlan(input: { patientProfileId: ${profileBId}, clinicId: 1, title: "跨馆方案" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { transitionWellnessPlan(id: "${planBId}", to: ACTIVE) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { addPlanItem(input: { planId: ${planBId}, title: "跨馆计划项" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileBId}, title: "跨馆随访", dueAt: "2026-11-07T10:00:00.000Z" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { createFollowUp(input: { patientProfileId: ${profileAId}, planId: ${planBId}, title: "跨馆挂接", dueAt: "2026-11-07T10:00:00.000Z" }) { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { completeFollowUp(id: "${fuBId}") { id } }
        `));
        await expectForbidden(adminClient.query(gql`
            mutation { cancelFollowUp(id: "${fuBId}") { id } }
        `));

        // —— 无绑定员工：写操作被拒，且文案明确「未绑定任何诊所」 ——
        await adminClient.asUserWithCredentials('tcm-wc@test.com', 'tcm-wc-123');
        await expectForbidden(
            adminClient.query(gql`
                mutation { createPatientProfile(input: { clinicId: 1, customerId: ${customerAId} }) { id } }
            `),
            /not bound to any clinic|未绑定任何诊所/,
        );

        // —— SuperAdmin：跨馆可写（建档 + 改他馆病志） ——
        await adminClient.asSuperAdmin();
        const saProfile = (await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 2, customerId: ${customerSId} }) { id clinicId } }
        `)) as any;
        expect(strip(saProfile.createPatientProfile.clinicId)).toBe(2);
        const saUpdate = (await adminClient.query(gql`
            mutation { updateMedicalRecord(id: "${recBId}", input: { diagnosis: "超管复核" }) { id version } }
        `)) as any;
        expect(saUpdate.updateMedicalRecord.version).toBe(2);
        // 本馆员工写的随访仍可被本馆员工正常完成（写守卫未误伤本馆）
        await adminClient.asUserWithCredentials('tcm-wa@test.com', 'tcm-wa-123');
        const doneA = (await adminClient.query(gql`
            mutation { completeFollowUp(id: "${fuAId}") { status } }
        `)) as any;
        expect(doneA.completeFollowUp.status).toBe('DONE');
        expect(planAId).toBeGreaterThan(0);

        // —— 匿名：FORBIDDEN ——
        await adminClient.asAnonymousUser();
        await expectForbidden(adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 1, customerId: ${customerAId} }) { id } }
        `));
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
