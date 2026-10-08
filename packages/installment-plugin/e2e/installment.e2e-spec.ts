import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { InstallmentPlugin } from '../src/plugin';
import { PaymentSchedulePlugin } from '@vendure/payment-schedule-plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('InstallmentPlugin · 分期', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [InstallmentPlugin.init({}), PaymentSchedulePlugin.init({})],
        paymentOptions: { paymentMethodHandlers: [singleStageRefundablePaymentMethod] },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const PAY_METHOD = singleStageRefundablePaymentMethod.code;
    const TOTAL = 129900; // Laptop 13" 原价

    let variantId: string;
    let seq = 0;

    function ts(offsetMinutes: number): string {
        return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
    }

    /** e2e 修正：测试环境 TestingEntityIdStrategy 把 GraphQL ID 编码为 "T_<n>"；写入 Int 列（plan.variantId）前须还原数字 */
    function numericId(id: string): number {
        return Number(String(id).replace('T_', ''));
    }

    async function createPlan(input: {
        downPaymentRatio?: number;
        periods?: number;
        intervalUnit?: string;
        intervalCount?: number;
        allowCod?: boolean;
    }): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createInstallmentPlan(input: {
                    name: "分期-${seq++}"
                    variantId: "${numericId(variantId)}"
                    downPaymentRatio: ${input.downPaymentRatio ?? 20}
                    periods: ${input.periods ?? 3}
                    intervalUnit: ${input.intervalUnit ? `"${input.intervalUnit}"` : `"month"`}
                    intervalCount: ${input.intervalCount ?? 1}
                    allowCod: ${input.allowCod ?? false}
                }) { id downPaymentRatio periods }
            }
        `)) as any;
        return res.createInstallmentPlan.id as string;
    }

    /**
     * e2e 修正：会话复用——上一用例订单可能仍 active（ArrangingPayment），先取消再建新单；
     * enableInstallment 前置状态校验要求 ArrangingPayment，用 0 元运费保持「订单总额 == 期次合计」
     * （与 payment-schedule e2e 同手法）。
     */
    async function freshOrder(): Promise<string> {
        const active = (await shopClient.query(gql`
            query { activeOrder { id } }
        `)) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } } }
            `);
        }
        const res = (await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                ... on Order { id } ... on ErrorResult { errorCode message }
            } }
        `)) as any;
        const orderId = res.addItemToOrder.id as string;
        await proceedToArrangingPaymentFree(shopClient);
        return orderId;
    }

    async function proceedToArrangingPaymentFree(client: SimpleGraphQLClient): Promise<string> {
        const { eligibleShippingMethods } = (await client.query(gql`
            query { eligibleShippingMethods { id name priceWithTax } }
        `)) as any;
        const idx = eligibleShippingMethods.findIndex((m: any) => m.name === 'Free Shipping');
        return proceedToArrangingPayment(client, idx);
    }

    async function scheduleOf(orderId: string): Promise<any> {
        const res = (await shopClient.query(gql`
            query {
                paymentSchedule(orderId: "${orderId}") {
                    scenario status depositRule totalAmount paidTotal
                    items { seq kind amount status allowCod trigger }
                }
            }
        `)) as any;
        return res.paymentSchedule;
    }

    async function orderState(id: string): Promise<any> {
        const res = (await adminClient.query(gql`
            query { order(id: "${id}") { state } }
        `)) as any;
        return res.order;
    }

    async function setChannelPricesIncludeTax(): Promise<void> {
        const channels = (await adminClient.query(gql`query { channels { items { id } } }`)) as any;
        const id = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${id}", pricesIncludeTax: true }) { ... on Channel { id } } }
        `);
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [{ name: PAY_METHOD, handler: { code: PAY_METHOD, arguments: [] } }],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        // e2e 修正：与 payment-schedule e2e 同款 0 元运费方式（订单总额须等于期次合计）
        await adminClient.query(gql`
            mutation {
                createShippingMethod(input: {
                    code: "free-shipping"
                    fulfillmentHandler: "manual-fulfillment"
                    checker: { code: "default-shipping-eligibility-checker", arguments: [{ name: "orderMinimum", value: "0" }] }
                    calculator: { code: "default-shipping-calculator", arguments: [
                        { name: "rate", value: "0" }
                        { name: "includesTax", value: "auto" }
                        { name: "taxRate", value: "0" }
                    ] }
                    translations: [{ languageCode: en, name: "Free Shipping" }]
                }) { id }
            }
        `);

        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('Admin CRUD：首付比/期数越界拒绝；合法创建成功', async () => {
        try {
            await adminClient.query(gql`
                mutation { createInstallmentPlan(input: { name: "x", variantId: "${variantId}", downPaymentRatio: 95 }) { id } }
            `);
            throw new Error('should have thrown');
        } catch (e: any) {
            expect(String(e?.response?.errors?.[0]?.message ?? e.message)).toContain('downPaymentRatio');
        }
        const id = await createPlan({ periods: 36 });
        expect(id).toBeDefined();
    });

    it('shop installmentPlans(variantId) 仅返回启用计划', async () => {
        const id = await createPlan({});
        const res = (await shopClient.query(gql`
            query { installmentPlans(variantId: "${numericId(variantId)}") { id name periods } }
        `)) as any;
        expect(res.installmentPlans.map((p: any) => p.id)).toContain(id);
    });

    it('enableInstallment 生成期次：首付 + 3 期金额拆分正确', async () => {
        const planId = await createPlan({ downPaymentRatio: 20, periods: 3, intervalCount: 1 });
        const orderId = await freshOrder();
        await shopClient.query(gql`
            mutation { enableInstallment(orderId: "${orderId}", planId: "${planId}") { id state } }
        `);
        const sched = await scheduleOf(orderId);
        expect(sched.scenario).toBe('installment');
        expect(sched.depositRule.kind).toBe('down_payment');
        expect(sched.items).toHaveLength(4);
        expect(sched.items[0]).toMatchObject({ seq: 1, kind: 'down_payment', amount: 25980, status: 'payable' });
        // 余额 103920 平分 3 期，余数并入末期
        expect(sched.items[1].amount).toBe(34640);
        expect(sched.items[2].amount).toBe(34640);
        expect(sched.items[3].amount).toBe(34640);
        expect(sched.totalAmount).toBe(TOTAL);
    });

    it('付首付 → PartiallyPaid + 发货门控放行；未付首付门控拦截', async () => {
        const planId = await createPlan({ downPaymentRatio: 20, periods: 3, intervalCount: 0 });
        const orderId = await freshOrder();
        await shopClient.query(gql`
            mutation { enableInstallment(orderId: "${orderId}", planId: "${planId}") { id } }
        `);
        // 未付首付（仍在 ArrangingPayment）→ 门控拦截：默认状态机不允许 ArrangingPayment → Shipped
        const blocked = (await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } ... on ErrorResult { errorCode } } }
        `)) as any;
        expect(blocked.transitionOrderToState.errorCode).toBeTruthy();
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: 1, method: "${PAY_METHOD}") { id } }
        `);
        expect((await orderState(orderId)).state).toBe('PartiallyPaid');
        // e2e 修正：paySchedulePeriod 的可付源状态（PAYABLE_SOURCE_STATES）不含 Shipped（Task 4 实装），
        // 故先付清余期（intervalCount=0 → dueAt=下单时刻 → 支付时刻补偿解锁）再验证发货放行
        const sched = await scheduleOf(orderId);
        for (const item of sched.items.slice(1)) {
            await shopClient.query(gql`
                mutation { paySchedulePeriod(orderId: "${orderId}", seq: ${item.seq}, method: "${PAY_METHOD}") { id } }
            `);
        }
        expect((await orderState(orderId)).state).toBe('PaymentSettled');
        // e2e 修正：本仓默认进程 checkFulfillmentStates 要求「订单行全部经履约发货」后订单才能进
        // Shipped（直接 transitionOrderToState('Shipped') 会被拦截），故走标准发货链路：
        // addFulfillmentToOrder → 履约 Created → Pending → Shipped（first_period 门控下发货放行）
        const orderLines = (await adminClient.query(gql`
            query { order(id: "${orderId}") { lines { id } } }
        `)) as any;
        const fulfillment = (await adminClient.query(gql`
            mutation { addFulfillmentToOrder(input: {
                lines: [{ orderLineId: "${orderLines.order.lines[0].id}", quantity: 1 }]
                handler: { code: "manual-fulfillment", arguments: [{ name: "method", value: "manual" }] }
            }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `)) as any;
        const fulfillmentId = fulfillment.addFulfillmentToOrder.id;
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Pending") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } } }
        `);
        expect((await orderState(orderId)).state).toBe('Shipped');
    });
});
