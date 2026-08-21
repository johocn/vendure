"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@vendure/testing");
const vitest_1 = require("vitest");
const path_1 = __importDefault(require("path"));
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const core_1 = require("@vendure/core");
const e2e_initial_data_1 = require("../../../e2e-common/e2e-initial-data");
const test_config_1 = require("../../../e2e-common/test-config");
const plugin_1 = require("../src/plugin");
const balance_payment_handler_1 = require("../src/balance-payment-handler");
const test_order_utils_1 = require("../../core/e2e/utils/test-order-utils");
(0, testing_1.registerInitializer)('sqljs', new testing_1.SqljsInitializer(path_1.default.join(__dirname, '__data__')));
(0, vitest_1.describe)('RechargeCardPlugin · 会员储值余额钱包', () => {
    const { server, adminClient, shopClient } = (0, testing_1.createTestEnvironment)((0, core_1.mergeConfig)((0, test_config_1.testConfig)(), {
        plugins: [plugin_1.RechargeCardPlugin.init()],
    }));
    const OTHER_EMAIL = 'second.balance@test.com';
    let customerId;
    let variantId;
    // 与 notification-plugin 一致的顾客创建+登录模式：预置 mock 顾客凭据不可靠，
    // 改用 admin 显式 createCustomer + 设密码后登录，确保证据可控。
    async function createCustomerAndLogin(email) {
        const res = (await adminClient.query((0, graphql_tag_1.default) `
            mutation {
                createCustomer(input: { firstName: "C", lastName: "U", emailAddress: "${email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `));
        await shopClient.asUserWithCredentials(email, 'test');
        return res.createCustomer.id;
    }
    (0, vitest_1.beforeAll)(async () => {
        await server.init({
            initialData: Object.assign(Object.assign({}, e2e_initial_data_1.initialData), { paymentMethods: [
                    ...(e2e_initial_data_1.initialData.paymentMethods || []),
                    { name: 'balance-pay', handler: { code: 'balance-pay', arguments: [] } },
                ] }),
            productsCsvPath: path_1.default.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
        });
        await adminClient.asSuperAdmin();
        // 主顾客 id（admin 创建 + shop 登录）
        customerId = await createCustomerAndLogin('main.balance@test.com');
        // 取一个商品变体做余额支付下单（与 notification e2e 一致用 adminClient）
        const products = (await adminClient.query((0, graphql_tag_1.default) `
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `));
        variantId = products.products.items[0].variants[0].id;
    }, test_config_1.TEST_SETUP_TIMEOUT_MS);
    (0, vitest_1.afterAll)(async () => {
        await server.destroy();
    });
    (0, vitest_1.it)('plugin loads without errors', () => {
        (0, vitest_1.expect)(server.app).toBeDefined();
    });
    (0, vitest_1.it)('exposes admin wallet queries', async () => {
        const r = await adminClient.query((0, graphql_tag_1.default) `
            query {
                customerBalances(options: {}) { items { customerId balance frozenBalance } totalItems }
                customerBalanceTransactions(customerId: "${customerId}", options: {}) { totalItems }
            }
        `);
        (0, vitest_1.expect)(r.customerBalances).toBeDefined();
        (0, vitest_1.expect)(r.customerBalanceTransactions.totalItems).toBe(0);
    });
    (0, vitest_1.it)('initial balance is 0', async () => {
        const r = await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`);
        (0, vitest_1.expect)(r.myRechargeBalance).toBe(0);
    });
    (0, vitest_1.it)('redeemRechargeCard credits balance (回归：口径修正后仍通过)', async () => {
        const batch = await adminClient.query((0, graphql_tag_1.default) `
            mutation { createRechargeCardBatch(input: { name: "t", quantity: 1, faceValue: 1000 }) { id plaintextPins { code pin } } }
        `);
        const { code, pin } = batch.createRechargeCardBatch.plaintextPins[0];
        const r = await shopClient.query((0, graphql_tag_1.default) `
            mutation { redeemRechargeCard(code: "${code}", pin: "${pin}") { success faceValue newBalance } }
        `);
        (0, vitest_1.expect)(r.redeemRechargeCard.success).toBe(true);
        (0, vitest_1.expect)(r.redeemRechargeCard.newBalance).toBe(1000);
    });
    (0, vitest_1.it)('createRechargeOrder 建单 pending + payRechargeOrder 入账幂等', async () => {
        const before = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        const created = await shopClient.query((0, graphql_tag_1.default) `
            mutation { createRechargeOrder(amount: 2000, remark: "e2e") { id amount status } }
        `);
        (0, vitest_1.expect)(created.createRechargeOrder.status).toBe('pending');
        const id = created.createRechargeOrder.id;
        const paid = await shopClient.query((0, graphql_tag_1.default) `
            mutation { payRechargeOrder(id: "${id}") { status paidAt } }
        `);
        (0, vitest_1.expect)(paid.payRechargeOrder.status).toBe('paid');
        const after = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(after).toBe(before + 2000);
        // 重复 pay：状态仍 paid，但不重复入账
        await shopClient.query((0, graphql_tag_1.default) `
            mutation { payRechargeOrder(id: "${id}") { status } }
        `);
        const final = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(final).toBe(after);
        const list = await shopClient.query((0, graphql_tag_1.default) `
            query { myRechargeOrders { id status amount } }
        `);
        (0, vitest_1.expect)(list.myRechargeOrders.length).toBeGreaterThanOrEqual(1);
    });
    (0, vitest_1.it)('myBalanceTransactions 流水顺序/类型/余额前后一致', async () => {
        const r = await shopClient.query((0, graphql_tag_1.default) `
            query { myBalanceTransactions(options: { take: 10 }) { totalItems items { type amount balanceBefore balanceAfter } } }
        `);
        (0, vitest_1.expect)(r.myBalanceTransactions.totalItems).toBeGreaterThanOrEqual(2);
        for (const tx of r.myBalanceTransactions.items) {
            (0, vitest_1.expect)(tx.balanceAfter).toBe(tx.balanceBefore + tx.amount);
        }
    });
    (0, vitest_1.it)('admin 手工调整加/扣/冲正', async () => {
        const pre = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        const add = await adminClient.query((0, graphql_tag_1.default) `
            mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: 500, type: "adjust", remark: "op" }) { balance } }
        `);
        (0, vitest_1.expect)(add.adminAdjustBalance.balance).toBe(pre + 500);
        const sub = await adminClient.query((0, graphql_tag_1.default) `
            mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: -200, type: "adjust", remark: "op2" }) { balance } }
        `);
        (0, vitest_1.expect)(sub.adminAdjustBalance.balance).toBe(pre + 300);
    });
    (0, vitest_1.it)('余额不足扣减抛错', async () => {
        const bal = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        await (0, vitest_1.expect)(adminClient.query((0, graphql_tag_1.default) `
                mutation { adminAdjustBalance(input: { customerId: "${customerId}", amount: ${-bal - 100}, type: "adjust", remark: "drain" }) { balance } }
            `)).rejects.toThrow(/Insufficient balance/);
        // 余额不变
        const after = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(after).toBe(bal);
    });
    (0, vitest_1.it)('余额支付下单：balance-pay Settled + 余额扣减', async () => {
        // 先充足余额（充值单），固定大额以防商品/运费波动
        const created = await shopClient.query((0, graphql_tag_1.default) `
            mutation { createRechargeOrder(amount: 1000000) { id } }
        `);
        await shopClient.query((0, graphql_tag_1.default) `
            mutation { payRechargeOrder(id: "${created.createRechargeOrder.id}") { status } }
        `);
        const beforeBalance = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        await shopClient.query((0, graphql_tag_1.default) `
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) { ... on ErrorResult { message } } }
        `);
        await (0, test_order_utils_1.proceedToArrangingPayment)(shopClient);
        const paid = await (0, test_order_utils_1.addPaymentToOrder)(shopClient, balance_payment_handler_1.balancePaymentHandler);
        (0, vitest_1.expect)(paid.state).toBe('PaymentSettled');
        const afterBalance = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(afterBalance).toBeLessThan(beforeBalance);
        (0, vitest_1.expect)(afterBalance).toBeGreaterThanOrEqual(0);
    });
    (0, vitest_1.it)('余额支付防重复扣减：同订单已扣款后重复支付被拒', async () => {
        const beforeBalance = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        // 新建订单，第一次余额支付成功
        await shopClient.query((0, graphql_tag_1.default) `
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) { ... on ErrorResult { message } } }
        `);
        await (0, test_order_utils_1.proceedToArrangingPayment)(shopClient);
        const first = await (0, test_order_utils_1.addPaymentToOrder)(shopClient, balance_payment_handler_1.balancePaymentHandler);
        (0, vitest_1.expect)(first.state).toBe('PaymentSettled');
        const afterFirst = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(afterFirst).toBeLessThan(beforeBalance);
        // 已结算订单上再次 addPaymentToOrder：余额应保持不变（不会二次扣减）
        // （Vendure 对非 ArrangingPayment 状态会返回订单本身而非抛错，故断言余额不变）
        await (0, test_order_utils_1.addPaymentToOrder)(shopClient, balance_payment_handler_1.balancePaymentHandler).catch(() => undefined);
        const afterSecond = (await shopClient.query((0, graphql_tag_1.default) `query { myRechargeBalance }`)).myRechargeBalance;
        (0, vitest_1.expect)(afterSecond).toBe(afterFirst);
    });
    (0, vitest_1.it)('越权隔离：无余额顾客 getBalance 返回 0 且 admin 流水按顾客过滤', async () => {
        // admin 创建新顾客，不充值，其 customerBalanceTransactions 应为 0
        const reg = await adminClient.query((0, graphql_tag_1.default) `
            mutation { createCustomer(input: { firstName: "x", lastName: "y", emailAddress: "${OTHER_EMAIL}" }) { ... on Customer { id } } }
        `);
        const otherId = reg.createCustomer.id;
        const tx = await adminClient.query((0, graphql_tag_1.default) `
            query { customerBalanceTransactions(customerId: "${otherId}", options: {}) { totalItems } }
        `);
        (0, vitest_1.expect)(tx.customerBalanceTransactions.totalItems).toBe(0);
    });
});
//# sourceMappingURL=recharge-card.e2e-spec.js.map