/**
 * 医生工作台联调 fixture：standalone vendure + tcm-clinic-plugin（mock SSO）
 * 运行：cd packages/tcm-clinic-plugin && npx tsx scripts/dev-fixture.mts
 * 医生账号：mock 手机号 13800000001（identifier=13800000001@tcm.test）
 * 患者：李患者 13900000002 / 王患者 13900000003
 *
 * 注意：从 ../lib/plugin 引入编译产物（tsx/esbuild 不支持 emitDecoratorMetadata，
 * 直接引 TS 源码会导致 TypeORM ColumnTypeUndefinedError）。
 */
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';
import { AutoIncrementIdStrategy, LanguageCode, mergeConfig } from '@vendure/core';
import gql from 'graphql-tag';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pluginModule from '../lib/plugin';

const { TcmClinicPlugin } = pluginModule as { TcmClinicPlugin: any };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '../e2e/__data__fixture__')));

const { server, adminClient, shopClient } = createTestEnvironment(
    mergeConfig(testConfig, {
        apiOptions: { port: 3930 },
        // 覆盖 testConfig 的 TestingEntityIdStrategy（T_ 前缀 ID）：前端按生产数字 ID 编写，
        // fixture 使用纯数字自增 ID 保持一致（版本坑③）
        entityOptions: { entityIdStrategy: new AutoIncrementIdStrategy() },
        plugins: [TcmClinicPlugin.init({ sso: { baseUrl: 'http://127.0.0.1:9', mock: true } })],
    }),
);

/** 测试环境实体 ID 带 T_ 前缀（GraphQL ID! 参数需加引号），转回数字 */
function num(id: string | number): number {
    return Number(String(id).replace('T_', ''));
}

async function seed() {
    await adminClient.asSuperAdmin();
    await adminClient.query(gql`
        mutation { createClinic(input: { name: "同德堂中医馆", licenseNo: "BA1101", address: "北京市朝阳区杏林路 1 号" }) { id } }
    `);
    const roles = await adminClient.query(gql`query { roles(options: { take: 20 }) { items { id code } } }`);
    // 版本坑①：超管角色 code 是 __super_admin_role__（vendure 3.x），不是 superadmin
    const adminRole = roles.roles.items.find(
        (r: any) => r.code === '__super_admin_role__' || r.code === 'superadmin',
    );
    const doctor = await adminClient.query(gql`
        mutation {
            createAdministrator(input: { firstName: "张", lastName: "医生", emailAddress: "13800000001@tcm.test", password: "test", roleIds: ["${adminRole.id}"] }) { id }
        }
    `);
    await adminClient.query(gql`
        mutation { createClinicStaff(input: { clinicId: 1, administratorId: ${num(doctor.createAdministrator.id)}, displayName: "张医生", role: "doctor" }) { id } }
    `);

    // 建档等守卫操作需要本馆员工会话：切换为医生身份（Administrator identifier=邮箱）
    await adminClient.asUserWithCredentials('13800000001@tcm.test', 'test');

    for (const [name, phone] of [
        ['李患者', '13900000002'],
        ['王患者', '13900000003'],
    ] as const) {
        // 版本坑②：注册 mutation 是 registerCustomerAccount（vendure 3.x），返回 union 需选择集
        await shopClient.query(gql`
            mutation {
                registerCustomerAccount(input: { emailAddress: "${phone}@p.test", firstName: "${name}", lastName: "", password: "test" }) {
                    __typename
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        const customers = await adminClient.query(gql`query { customers(options: { take: 20 }) { items { id firstName } } }`);
        const c = customers.customers.items.find((x: any) => x.firstName === name);
        await adminClient.query(gql`
            mutation { createPatientProfile(input: { clinicId: 1, customerId: ${num(c.id)}, constitution: { type: "平和质" } }) { id } }
        `);
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
