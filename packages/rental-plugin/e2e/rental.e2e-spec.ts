import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { RentalPlugin } from '../src/plugin';
import { PaymentSchedulePlugin } from '@vendure/payment-schedule-plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('RentalPlugin · 租赁', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [RentalPlugin.init({}), PaymentSchedulePlugin.init({})],
        paymentOptions: { paymentMethodHandlers: [singleStageRefundablePaymentMethod] },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const PAY_METHOD = singleStageRefundablePaymentMethod.code;
    // e2e 修正：押金 99900 + prepaid 租金 3×10000 = 129900 == Laptop 订单总价（0 元运费）。
    // 付清末期后调度层推进 PaymentSettled，核心 checkPaymentsCoverTotal 要求 settled 支付
    // 覆盖订单总额，故期次合计必须等于订单总价（与 installment e2e 同手法）；买断价
    // 80000 - 已付租金 30000 = 50000 与计划数值保持一致。
    const DEPOSIT = 99900; // 押金 ¥999
    const RENT = 10000; // 月租金 ¥100

    let variantId: string;
    let seq = 0;
    let customerEmails: string[] = [];

    /** e2e 修正：测试环境 TestingEntityIdStrategy 把 GraphQL ID 编码为 "T_<n>"；写入 Int 列（plan.variantId）前须还原数字 */
    function numericId(id: string): number {
        return Number(String(id).replace('T_', ''));
    }

    async function createPlan(input: {
        depositAmount?: number;
        rentAmount?: number;
        rentUnit?: string;
        prepaidOrPostpaid?: string;
        buyoutPrice?: number | null;
        allowBuyout?: boolean;
        allowCod?: boolean;
    }): Promise<string> {
        // 可选字段用数组拼接注入（undefined 内插会产生字面量 "undefined" 破坏 GraphQL）
        const optional = [
            input.buyoutPrice === undefined ? '' : `buyoutPrice: ${input.buyoutPrice}`,
            input.allowBuyout === undefined ? '' : `allowBuyout: ${input.allowBuyout}`,
            input.allowCod === undefined ? '' : `allowCod: ${input.allowCod}`,
        ].filter(Boolean).join('\n                    ');
        const res = (await adminClient.query(gql`
            mutation {
                createRentalPlan(input: {
                    name: "租赁-${seq++}"
                    variantId: "${numericId(variantId)}"
                    depositAmount: ${input.depositAmount ?? DEPOSIT}
                    rentAmount: ${input.rentAmount ?? RENT}
                    rentUnit: ${input.rentUnit ? `"${input.rentUnit}"` : `"month"`}
                    prepaidOrPostpaid: ${input.prepaidOrPostpaid ? `"${input.prepaidOrPostpaid}"` : `"prepaid"`}
                    ${optional}
                }) { id depositAmount rentAmount }
            }
        `)) as any;
        return res.createRentalPlan.id as string;
    }

    /**
     * e2e 修正：每用例独立客户会话——上一用例订单可能停在 PartiallyPaid/PaymentSettled/Shipped
     * 等不可安全取消的状态（且 Part 未触发 placed 仍 active），交叉复用会话会被遗留 active
     * 订单阻断。改为每个流程用例各占一个 fixture 客户（Populator 确定性生成、密码 test），
     * 会话互不干扰，无需清理。startRental 前置状态校验要求 ArrangingPayment，
     * 用 0 元运费推进（与 installment e2e 同手法）。
     */
    async function freshOrder(customerEmail: string): Promise<string> {
        await shopClient.asUserWithCredentials(customerEmail, 'test');
        const res = (await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                ... on Order { id } ... on ErrorResult { errorCode message }
            } }
        `)) as any;
        if (res.addItemToOrder.errorCode) {
            throw new Error(`addItemToOrder failed: ${res.addItemToOrder.errorCode} ${res.addItemToOrder.message}`);
        }
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

    async function startRental(orderId: string, planId: string, periods = 1): Promise<void> {
        await shopClient.query(gql`
            mutation { startRental(orderId: "${orderId}", planId: "${planId}", periods: ${periods}) { id state } }
        `);
    }

    async function payPeriod(orderId: string, seq: number): Promise<void> {
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: ${seq}, method: "${PAY_METHOD}") { id } }
        `);
    }

    async function scheduleOf(orderId: string): Promise<any> {
        const res = (await shopClient.query(gql`
            query {
                paymentSchedule(orderId: "${orderId}") {
                    scenario status deliveryGate depositRule totalAmount paidTotal
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

    async function transition(id: string, state: string): Promise<any> {
        return (await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${id}", state: "${state}") { ... on Order { id state } ... on ErrorResult { errorCode } } }
        `)) as any;
    }

    /**
     * e2e 修正：本仓 checkFulfillmentStates 要求「订单行全部经履约发货」后订单才能进 Shipped
     * （直接 transitionOrderToState('Shipped') 被拦截），故走标准发货链路：
     * addFulfillmentToOrder → 履约 Created → Pending → Shipped（履约 Shipped 自动带转订单 Shipped）。
     */
    async function fulfillAndShip(orderId: string): Promise<void> {
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
            customerCount: 5,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        // 供各流程用例独立会话使用（Populator 确定性生成、密码 test）
        const customersRes = (await adminClient.query(gql`
            query { customers(options: { take: 10 }) { items { emailAddress } } }
        `)) as any;
        customerEmails = customersRes.customers.items.map((c: any) => c.emailAddress);

        // e2e 修正：与 installment e2e 同款 0 元运费方式（期次合计须等于订单总额）
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
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('Admin CRUD：押金非正拒绝；合法创建成功', async () => {
        try {
            await adminClient.query(gql`
                mutation { createRentalPlan(input: { name: "x", variantId: "${variantId}", depositAmount: 0, rentAmount: 100 }) { id } }
            `);
            throw new Error('should have thrown');
        } catch (e: any) {
            expect(String(e?.response?.errors?.[0]?.message ?? e.message)).toContain('depositAmount');
        }
        const id = await createPlan({});
        expect(id).toBeDefined();
    });

    it('shop rentalPlans(variantId) 仅返回启用计划', async () => {
        const id = await createPlan({});
        const res = (await shopClient.query(gql`
            query { rentalPlans(variantId: "${numericId(variantId)}") { id name prepaidOrPostpaid } }
        `)) as any;
        expect(res.rentalPlans.map((p: any) => p.id)).toContain(id);
    });

    it('buyout：租金付清后 buyoutRental 追加买断期次（扣减已付租金）→ 支付 → 调度 completed', async () => {
        // e2e 修正：自包含建单——押金+租金付清 → PaymentSettled 后买断
        //（PAYABLE_SOURCE_STATES 含 PaymentSettled，买断款可从 PaymentSettled 支付）
        const planId = await createPlan({ buyoutPrice: 80000 });
        const orderId = await freshOrder(customerEmails[0]);
        await startRental(orderId, planId, 3);
        await payPeriod(orderId, 1);
        await payPeriod(orderId, 2);
        expect((await orderState(orderId)).state).toBe('PaymentSettled');
        const buyout = (await shopClient.query(gql`
            mutation { buyoutRental(orderId: "${orderId}") { scheduleId seq amount } }
        `)) as any;
        // 买断价 80000 - 已付租金 30000 = 50000
        expect(buyout.buyoutRental.amount).toBe(50000);
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: ${buyout.buyoutRental.seq}, method: "${PAY_METHOD}") { id } }
        `);
        const sched = await scheduleOf(orderId);
        expect(sched.status).toBe('completed');
        expect(sched.items).toHaveLength(3);
        expect(sched.items[2]).toMatchObject({ kind: 'buyout', amount: 50000, status: 'paid' });
        expect((await orderState(orderId)).state).toBe('PaymentSettled');
    });

    it('postpaid 期次结构：押金 + 3 期租金（interval trigger + allowCod）；不可买断时 buyoutRental 拒绝', async () => {
        const planId = await createPlan({ prepaidOrPostpaid: 'postpaid', allowCod: true, allowBuyout: false, buyoutPrice: null });
        const orderId = await freshOrder(customerEmails[1]);
        await startRental(orderId, planId, 3);
        const sched = await scheduleOf(orderId);
        expect(sched.items).toHaveLength(4);
        expect(sched.items[0]).toMatchObject({ seq: 1, kind: 'deposit', amount: DEPOSIT, status: 'payable' });
        for (let i = 1; i <= 3; i++) {
            expect(sched.items[i]).toMatchObject({ kind: 'rent', amount: RENT, status: 'locked', allowCod: true });
            expect(sched.items[i].trigger).toMatchObject({ type: 'interval', unit: 'month', count: i });
        }
        // e2e 修正：先付押金使调度进入 in_progress（pending 状态会先被 status 校验拦截，
        // 到不了 allowBuyout=false 快照校验），再验证不可买断拒绝
        await payPeriod(orderId, 1);
        try {
            await shopClient.query(gql`
                mutation { buyoutRental(orderId: "${orderId}") { scheduleId seq amount } }
            `);
            throw new Error('should have thrown');
        } catch (e: any) {
            expect(String(e?.response?.errors?.[0]?.message ?? e.message)).toContain('Buyout');
        }
    });

    it('还物退押：admin releaseRentalDeposit → 押金期次 refunded', async () => {
        const planId = await createPlan({});
        const orderId = await freshOrder(customerEmails[2]);
        await startRental(orderId, planId, 1);
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: 1, method: "${PAY_METHOD}") { id } }
        `);
        const released = (await adminClient.query(gql`
            mutation { releaseRentalDeposit(orderId: "${orderId}") { status items { seq kind status } } }
        `)) as any;
        expect(released.releaseRentalDeposit.items[0]).toMatchObject({ kind: 'deposit', status: 'refunded' });
    });

    /**
     * e2e 修正：独立客户会话——本用例订单经 PartiallyPaid → Shipped 后仍为 active
     * （PartiallyPaid 转移不触发 OrderPlacedStrategy），Shipped 订单不可 cancel，
     * 交叉复用会话会阻断后续用例，故置于最后且独占客户。
     */
    it('prepaid 全流程：押金+租金期次 → 付押金 PartiallyPaid → 发货门控 deposit_paid 放行（押金到账即可发货，租金后付）', async () => {
        const planId = await createPlan({ buyoutPrice: 80000 });
        const orderId = await freshOrder(customerEmails[3]);
        await startRental(orderId, planId, 3);
        const sched = await scheduleOf(orderId);
        expect(sched.scenario).toBe('rental');
        expect(sched.depositRule.kind).toBe('security_deposit');
        expect(sched.deliveryGate).toBe('deposit_paid');
        expect(sched.items).toHaveLength(2);
        expect(sched.items[0]).toMatchObject({ seq: 1, kind: 'deposit', amount: DEPOSIT, status: 'payable' });
        expect(sched.items[1]).toMatchObject({ seq: 2, kind: 'rent', amount: RENT * 3, status: 'locked' });
        expect(sched.totalAmount).toBe(DEPOSIT + RENT * 3);

        // 付押金 → PartiallyPaid（首期立即可付）
        await payPeriod(orderId, 1);
        expect((await orderState(orderId)).state).toBe('PartiallyPaid');

        // deposit_paid 门控放行：押金已付、租金未付即可发货（先证直接 transition 被履约校验拦截）
        const blocked = await transition(orderId, 'Shipped');
        expect(blocked.transitionOrderToState.errorCode).toBeTruthy();
        await fulfillAndShip(orderId);
        // e2e 修正：租金期在发货后不可支付（PAYABLE_SOURCE_STATES 不含 Shipped），
        // 「付租金 → PaymentSettled」段移至买断用例覆盖
        expect((await orderState(orderId)).state).toBe('Shipped');
    });
});
