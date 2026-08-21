import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { WechatpayPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('WechatpayPlugin · 通用支付网关', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [
                WechatpayPlugin.init({
                    notifyUrl: 'http://localhost/wechatpay/notify',
                    devBypass: true,
                }),
            ],
        }),
    );

    async function createCustomerAndLogin(email: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "G", lastName: "W", emailAddress: "${email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `)) as any;
        await shopClient.asUserWithCredentials(email, 'test');
        return res.createCustomer.id;
    }

    beforeAll(async () => {
        await server.init({
            initialData: { ...initialData },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
        });
        await adminClient.asSuperAdmin();
        await createCustomerAndLogin('gateway.pay@test.com');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('wechatpayCreatePayment（devBypass）返回模拟支付 URL', async () => {
        const r = await shopClient.query(gql`
            mutation {
                wechatpayCreatePayment(input: { outTradeNo: "T-1", amount: 10000, tradeType: "JSAPI", description: "t" }) {
                    payType payUrl
                }
            }
        `);
        expect(r.wechatpayCreatePayment.payType).toBe('dev-h5');
        expect(r.wechatpayCreatePayment.payUrl).toContain('outTradeNo=T-1');
    });

    it('wechatpayCreatePayment NATIVE/APP 返回对应 payType（devBypass 统一 dev-h5）', async () => {
        for (const t of ['NATIVE', 'APP', 'H5']) {
            const r = await shopClient.query(gql`
                mutation { wechatpayCreatePayment(input: { outTradeNo: "T-2", amount: 200, tradeType: "${t}" }) { payType payUrl } }
            `);
            expect(r.wechatpayCreatePayment.payType).toBe('dev-h5');
        }
    });
});