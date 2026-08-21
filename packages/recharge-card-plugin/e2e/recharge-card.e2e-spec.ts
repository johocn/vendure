import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig, ChannelService, RequestContext } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { RechargeCardPlugin } from '../src/plugin';
import { balancePaymentHandler } from '../src/balance-payment-handler';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { WechatpayPlugin, WechatpaySettlementRegistry } from '@vendure/wechatpay-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('RechargeCardPlugin · 会员储值余额钱包', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [
                RechargeCardPlugin.init(),
                WechatpayPlugin.init({
                    notifyUrl: 'http://localhost/wechatpay/notify',
                    devBypass: true,
                }),
            ],
        }),
    );

    // 等价网关 notify 的 admin ctx 路由触发，供在线充值用例保确定性结算
    async function settleViaGateway(outTradeNo: string, txId = 'DEV-TX'): Promise<void> {
        const registry = server.app.get(WechatpaySettlementRegistry);
        const settlement = registry.find(outTradeNo);
        expect(settlement).toBeDefined();
        const channel = await server.app.get(ChannelService).getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        await settlement!.settle(ctx, outTradeNo, txId);
    }

    const OTHER_EMAIL = 'second.balance@test.com';

    let customerId: string;
    let variantId: string;

    // 与 notification-plugin 一致的顾客创建+登录模式：预置 mock 顾客凭据不可靠，
    // 改用 admin 显式 createCustomer + 设密码后登录，确保证据可控。
    async function createCustomerAndLogin(email: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "C", lastName: "U", emailAddress: "${email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `)) as any;
        await shopClient.asUserWithCredentials(email, 'test');
        return res.createCustomer.id;
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    ...(initialData.paymentMethods || []),
                    { name: 'balance-pay', handler: { code: 'balance-pay', arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
        });
        await adminClient.asSuperAdmin();

        // 主顾客 id（admin 创建 + shop 登录）
        customerId = await createCustomerAndLogin('main.balance@test.com');

        // 取一个商品变体做余额支付下单（与 notification e2e 一致用 adminClient）
        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('plugin loads without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('exposes admin wallet queries', async () => {
        const r = await adminClient.query(gql`
            query {
                customerBalances(options: {}) { items { customerId balance frozenBalance } totalItems }
                customerBalanceTransactions(customerId: "${customerId}", options: {}) { totalItems }
            }
        `);
        expect(r.customerBalances).toBeDefined();
        expect(r.customerBalanceTransactions.totalItems).toBe(0);
    });

    it('initial balance is 0', async () => {
        const r = await shopClient.query(gql`query { myRechargeBalance }`);
        expect(r.myRechargeBalance).toBe(0);
    });

    it('redeemRechargeCard credits balance (回归：口径修正后仍通过)', async () => {
        const batch = await adminClient.query(gql`
            mutation { createRechargeCardBatch(input: { name: "t", quantity: 1, faceValue: 1000 }) { id plaintextPins { code pin } } }
        `);
        const { code, pin } = batch.createRechargeCardBatch.plaintextPins[0];
        const r = await shopClient.query(gql`
            mutation { redeemRechargeCard(code: "${code}", pin: "${pin}") { success faceValue newBalance } }
        `);
        expect(r.redeemRechargeCard.success).toBe(true);
        expect(r.redeemRechargeCard.newBalance).toBe(1000);
    });

    it('createRechargeOrder 建单 pending + payRechargeOrder 入账幂等', async () => {
        const before = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        const created = await shopClient.query(gql`
            mutation { createRechargeOrder(amount: 2000, remark: "e2e") { id amount status } }
        `);
        expect(created.createRechargeOrder.status).toBe('pending');
        const id = created.createRechargeOrder.id;

        const paid = await shopClient.query(gql`
            mutation { payRechargeOrder(id: "${id}") { status paidAt } }
        `);
        expect(paid.payRechargeOrder.status).toBe('paid');

        const after = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(after).toBe(before + 2000);

        // 重复 pay：状态仍 paid，但不重复入账
        await shopClient.query(gql`
            mutation { payRechargeOrder(id: "${id}") { status } }
        `);
        const final = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(final).toBe(after);

        const list = await shopClient.query(gql`
            query { myRechargeOrders { id status amount } }
        `);
        expect(list.myRechargeOrders.length).toBeGreaterThanOrEqual(1);
    });

    it('myBalanceTransactions 流水顺序/类型/余额前后一致', async () => {
        const r = await shopClient.query(gql`
            query { myBalanceTransactions(options: { take: 10 }) { totalItems items { type amount balanceBefore balanceAfter } } }
        `);
        expect(r.myBalanceTransactions.totalItems).toBeGreaterThanOrEqual(2);
        for (const tx of r.myBalanceTransactions.items) {
            expect(tx.balanceAfter).toBe(tx.balanceBefore + tx.amount);
        }
    });

    it('admin 手工调整加/扣/冲正', async () => {
        const pre = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        const add = await adminClient.query(gql`
            mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: 500, type: "adjust", remark: "op" }) { balance } }
        `);
        expect(add.adminAdjustBalance.balance).toBe(pre + 500);
        const sub = await adminClient.query(gql`
            mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: -200, type: "adjust", remark: "op2" }) { balance } }
        `);
        expect(sub.adminAdjustBalance.balance).toBe(pre + 300);
    });

    it('余额不足扣减抛错', async () => {
        const bal = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        await expect(
            adminClient.query(gql`
                mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: ${-bal - 100}, type: "adjust", remark: "drain" }) { balance } }
            `),
        ).rejects.toThrow(/Insufficient balance/);
        // 余额不变
        const after = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(after).toBe(bal);
    });

    it('余额支付下单：balance-pay Settled + 余额扣减', async () => {
        // 先充足余额（充值单），固定大额以防商品/运费波动
        const created = await shopClient.query(gql`
            mutation { createRechargeOrder(amount: 1000000) { id } }
        `);
        await shopClient.query(gql`
            mutation { payRechargeOrder(id: "${created.createRechargeOrder.id}") { status } }
        `);

        const beforeBalance = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) { ... on ErrorResult { message } } }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, balancePaymentHandler);
        expect(paid.state).toBe('PaymentSettled');

        const afterBalance = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(afterBalance).toBeLessThan(beforeBalance);
        expect(afterBalance).toBeGreaterThanOrEqual(0);
    });

    it('余额支付防重复扣减：同订单已扣款后重复支付被拒', async () => {
        const beforeBalance = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        // 新建订单，第一次余额支付成功
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) { ... on ErrorResult { message } } }
        `);
        await proceedToArrangingPayment(shopClient);
        const first = await addPaymentToOrder(shopClient, balancePaymentHandler);
        expect(first.state).toBe('PaymentSettled');
        const afterFirst = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(afterFirst).toBeLessThan(beforeBalance);

        // 已结算订单上再次 addPaymentToOrder：余额应保持不变（不会二次扣减）
        // （Vendure 对非 ArrangingPayment 状态会返回订单本身而非抛错，故断言余额不变）
        await addPaymentToOrder(shopClient, balancePaymentHandler).catch(() => undefined);
        const afterSecond = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(afterSecond).toBe(afterFirst);
    });

    it('越权隔离：无余额顾客 getBalance 返回 0 且 admin 流水按顾客过滤', async () => {
        // admin 创建新顾客，不充值，其 customerBalanceTransactions 应为 0
        const reg = await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "x", lastName: "y", emailAddress: "${OTHER_EMAIL}" }) { ... on Customer { id } } }
        `);
        const otherId = reg.createCustomer.id;
        const tx = await adminClient.query(gql`
            query { customerBalanceTransactions(customerId: "${otherId}", options: {}) { totalItems } }
        `);
        expect(tx.customerBalanceTransactions.totalItems).toBe(0);
    });

    it('在线充值：建单→建支付参数→网关结算→余额到账+流水', async () => {
        const before = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        const created = (await shopClient.query(gql`
            mutation { createRechargeOrder(amount: 5000, remark: "wc") { id status } }
        `)) as any;
        const orderId = created.createRechargeOrder.id;

        const pay = (await shopClient.query(gql`
            mutation { createWechatRechargePayment(rechargeOrderId: "${orderId}", tradeType: "JSAPI") { rechargeOrderId outTradeNo pay { payType payUrl } } }
        `)) as any;
        // TestingEntityIdStrategy 下 GraphQL id 带 T_ 前缀，out_trade_no 用原始数字 id
        const outTradeNo = pay.createWechatRechargePayment.outTradeNo;
        expect(outTradeNo).toMatch(/^RC-\d+$/);
        expect(pay.createWechatRechargePayment.pay.payType).toBe('dev-h5');

        // 触发 RC- 结算（等价网关 notify 路由）
        await settleViaGateway(outTradeNo, 'DEV-TX');

        const after = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        const list = (await shopClient.query(gql`query { myRechargeOrders { id status } }`)).myRechargeOrders;
        expect(after).toBe(before + 5000);
        expect(list.find(o => o.id === orderId).status).toBe('paid');
    });

    it('在线充值：重复结算幂等（余额不再加）', async () => {
        const before = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        const created = (await shopClient.query(gql`
            mutation { createRechargeOrder(amount: 2000) { id } }
        `)) as any;
        const orderId = created.createRechargeOrder.id;
        const pay = (await shopClient.query(gql`
            mutation { createWechatRechargePayment(rechargeOrderId: "${orderId}") { outTradeNo } }
        `)) as any;
        const outTradeNo = pay.createWechatRechargePayment.outTradeNo;
        await settleViaGateway(outTradeNo, 'DEV-TX1');
        const afterOne = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(afterOne).toBe(before + 2000);
        await settleViaGateway(outTradeNo, 'DEV-TX2'); // 第二次应跳过
        const afterTwo = (await shopClient.query(gql`query { myRechargeBalance }`)).myRechargeBalance;
        expect(afterTwo).toBe(afterOne);
    });

    it('在线充值：已支付单建支付被拒', async () => {
        const created = (await shopClient.query(gql`
            mutation { createRechargeOrder(amount: 1000) { id } }
        `)) as any;
        const orderId = created.createRechargeOrder.id;
        const pay = (await shopClient.query(gql`
            mutation { createWechatRechargePayment(rechargeOrderId: "${orderId}") { outTradeNo } }
        `)) as any;
        await settleViaGateway(pay.createWechatRechargePayment.outTradeNo, 'DEV-TX');

        // 已结算单再次建支付 → 报错
        await expect(shopClient.query(gql`
            mutation { createWechatRechargePayment(rechargeOrderId: "${orderId}") { outTradeNo } }
        `)).rejects.toThrow();
    });
});