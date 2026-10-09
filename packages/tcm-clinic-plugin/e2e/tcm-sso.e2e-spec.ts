import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TcmClinicPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__sso__')));

const ADMIN_API = 'http://localhost:3922/admin-api';

async function authenticate(accessToken: string): Promise<{ body: any; token: string | null }> {
    const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation($t: String!) { authenticate(input: { tcmSso: { accessToken: $t } }) {
                __typename
                ... on CurrentUser { id identifier }
                ... on ErrorResult { errorCode message }
                ... on InvalidCredentialsError { authenticationError }
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
            apiOptions: { port: 3922 },
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
        const adminRole = roles.roles.items.find((r: any) => r.code === '__super_admin_role__');
        const doctor = await adminClient.query(gql`
            mutation {
                createAdministrator(input: {
                    firstName: "张", lastName: "医生",
                    emailAddress: "13800000001@tcm.test",
                    password: "test", roleIds: ["${adminRole.id}"]
                }) { id }
            }
        `);
        // 医生绑定为馆1员工（后面 myStaff 断言用）
        await adminClient.query(gql`
            mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${Number(String(doctor.createAdministrator.id).replace('T_', ''))}, displayName: "张医生" }) { id } }
        `);
        // 非员工顾客账号（仅顾客角色）
        await shopClient.query(gql`
            mutation {
                registerCustomerAccount(input: { emailAddress: "13900000002@tcm.test", firstName: "患", lastName: "者", password: "test" }) {
                    __typename
                    ... on ErrorResult { errorCode message }
                }
            }
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
        expect(body.__typename).toBe('InvalidCredentialsError');
        expect(body.authenticationError).toBe('SSO_ACCOUNT_NOT_STAFF');
    });

    it('unknown identity is rejected with SSO_ACCOUNT_NOT_LINKED', async () => {
        const { body } = await authenticate('mock-19999999999');
        expect(body.__typename).toBe('InvalidCredentialsError');
        expect(body.authenticationError).toBe('SSO_ACCOUNT_NOT_LINKED');
    });

    it('non-mock invalid token is rejected with SSO_TOKEN_INVALID', async () => {
        // 不带 mock- 前缀 → 走真实校验路径 → baseUrl 不可达 → SSO_TOKEN_INVALID
        const { body } = await authenticate('real-invalid-token');
        expect(body.__typename).toBe('InvalidCredentialsError');
        expect(body.authenticationError).toBe('SSO_TOKEN_INVALID');
    });
});
