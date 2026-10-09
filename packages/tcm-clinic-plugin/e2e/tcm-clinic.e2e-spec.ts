import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TcmClinicPlugin } from '../src/plugin';

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
});
