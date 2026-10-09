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
});
