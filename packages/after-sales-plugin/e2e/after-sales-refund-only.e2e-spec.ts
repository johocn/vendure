import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { AfterSalesPlugin } from '../src/plugin';
import { STATE_TRANSITIONS } from '../src/types';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

const CREATE_REQ = gql`
    mutation($i: CreateAfterSalesRequestInput!) {
        createAfterSalesRequest(input: $i) { id state type refundAmount orderId }
    }
`;

describe('AfterSalesPlugin · refund_only 外卖链路（创建侧）', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [
                AfterSalesPlugin.init({
                    allowedOrderStates: ['PaymentSettled'],
                    afterSalesWindowHours: 24,
                }),
                InventoryPlugin.init(),
                LogisticsPlugin.init(),
            ],
            paymentOptions: {
                // 单段可退款处理器：refundOrder 直接 Settled（真实网关主路径）
                paymentMethodHandlers: [singleStageRefundablePaymentMethod],
            },
        }),
    );

    let variantId: string;
    let orderId: string;

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: singleStageRefundablePaymentMethod.code,
                        handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        // 此测试环境未配置 search 插件，用 products 查询取变体
        const { products } = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { variants { id } } } }
        `);
        variantId = products.items[0].variants[0].id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('状态机：Appealed/Approved→Received 转移合法', () => {
        expect(STATE_TRANSITIONS.Approved).toContain('Received');
        expect(STATE_TRANSITIONS.Rejected).toContain('Appealed');
        expect(STATE_TRANSITIONS.Appealed).toEqual(expect.arrayContaining(['Approved', 'Closed']));
        expect(STATE_TRANSITIONS.Appealed).not.toContain('Rejected');
    });

    it('下单（PaymentSettled 即可售后）', async () => {
        await shopClient.query(gql`mutation($v: ID!) { addItemToOrder(productVariantId: $v, quantity: 2) { ... on Order { id } } }`, { v: variantId });
        await proceedToArrangingPayment(shopClient);
        // 单段支付处理器结算后订单即完成，activeOrder 置空，须用支付返回值取订单
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.state).toBe('PaymentSettled');
        orderId = paid.id;
    });

    it('创建整单 refund_only 售后 → Pending', async () => {
        const { createAfterSalesRequest: req } = await shopClient.query(CREATE_REQ, {
            i: { orderId, type: 'refund_only', reason: '少送', refundAmount: 500 },
        });
        expect(req.state).toBe('Pending');
        expect(req.type).toBe('refund_only');
    });

    it('同订单进行中重复创建被拒', async () => {
        await expect(
            shopClient.query(CREATE_REQ, { i: { orderId, type: 'refund_only', reason: '少送', refundAmount: 100 } }),
        ).rejects.toThrow(/already exists/);
    });

    it('退款金额超上限被拒（第二单）', async () => {
        await shopClient.query(gql`mutation($v: ID!) { addItemToOrder(productVariantId: $v, quantity: 1) { ... on Order { id } } }`, { v: variantId });
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        await expect(
            shopClient.query(CREATE_REQ, {
                i: { orderId: paid.id, type: 'refund_only', reason: '其他', refundAmount: paid.totalWithTax + 100000 },
            }),
        ).rejects.toThrow(/exceeds max/);
    });
});
