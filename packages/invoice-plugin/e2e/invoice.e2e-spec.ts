import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { InvoicePlugin } from '../src/plugin';
import { mergeConfig } from '@vendure/core';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('InvoicePlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [InvoicePlugin.init()],
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        // 创建测试客户并以该客户身份打开 shop 会话（createInvoice 需 shop Authenticated）
        await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Inv", lastName: "Test", emailAddress: "inv.test@example.com" }, password: "test") {
                    ... on Customer { id }
                }
            }
        `);
        await shopClient.asUserWithCredentials('inv.test@example.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('plugin loads without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('registers invoice custom fields on Order', async () => {
        const result = await adminClient.query(gql`
            query { orders(options: { take: 1 }) { items { id customFields { invoiceRequired invoiceType } } } }
        `);
        expect(result.orders).toBeDefined();
    });

    it('admin schema exposes lines/totals/invoiceNo and bulkIssueInvoices', async () => {
        const result = await adminClient.query(gql`
            query {
                __type(name: "Invoice") {
                    fields {
                        name
                        type { kind ofType { kind name } name }
                    }
                }
            }
        `);
        const fieldNames = result.__type.fields.map((f: any) => f.name);
        expect(fieldNames).toContain('lines');
        expect(fieldNames).toContain('totals');
        expect(fieldNames).toContain('invoiceNo');

        const mutations = await adminClient.query(gql`
            query {
                __schema { mutationType { fields { name } } }
            }
        `);
        const mutationNames = mutations.__schema.mutationType.fields.map((f: any) => f.name);
        expect(mutationNames).toContain('bulkIssueInvoices');
    });

    it('compliance: 专票缺必填字段被拒绝（无需有效订单即可验证）', async () => {
        // assertCompliant 在订单归属校验前执行，故用不存在的订单即可触发合规错误
        const promise = shopClient.query(
            gql`
                mutation {
                    createInvoice(
                        input: {
                            orderIds: ["999999"]
                            invoiceType: "special"
                            title: "测试专票"
                            taxNumber: "1234567890123456"
                        }
                    ) {
                        id
                    }
                }
            `,
        );
        await expect(promise).rejects.toThrow('专用发票必填');
    });

    it('compliance: 税号格式错误被拒绝', async () => {
        const promise = shopClient.query(
            gql`
                mutation {
                    createInvoice(
                        input: {
                            orderIds: ["999999"]
                            invoiceType: "ordinary"
                            title: "测试普通发票"
                            taxNumber: "INVALID-TAX-ID!!"
                        }
                    ) {
                        id
                    }
                }
            `,
        );
        await expect(promise).rejects.toThrow('税号格式不正确');
    });
});
