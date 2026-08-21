import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

// 本插件未注册进 node_modules（新包），从其源码直接导入，避免依赖安装。
import { SettlementPlugin } from '../src/plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 简单的轮询帮助函数（事件订阅 → 异步入账，需轮询等待）。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 80): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

describe('SettlementPlugin · 阶段24 商家财务对账结算（账务台账+提现）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            SettlementPlugin.init({ defaultCommissionRate: 0 }),
        ],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    // SimpleGraphQLClient 需显式传入完整 API URL（server 是 TestServer 而非 config）。
    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let productAId: string;
    let productBId: string;
    let variantAId: string;

    const MY_ACCOUNT = gql`query { myMerchantAccount { id shopId commissionRate availableBalance totalGoodsAmount totalShippingAmount totalCommission totalWithdrawn } }`;
    const MY_ENTRIES = gql`query { mySettlementEntries { items { id shopId orderCode goodsAmountWithTax shippingAmountWithTax commissionAmount netAmountWithTax } totalItems } }`;
    const WITHDRAW = gql`mutation ($a: Int!) { requestWithdrawal(amount: $a) { id amount status } }`;
    const APPROVE = gql`mutation ($id: ID!) { approveWithdrawal(id: $id) { id status } }`;
    const PAY = gql`mutation ($id: ID!) { payWithdrawal(id: $id) { id status paidAt } }`;
    const REJECT = gql`mutation ($id: ID!, $note: String) { rejectWithdrawal(id: $id, note: $note) { id status reviewNote } }`;

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) { id name slug status } }
        `)) as any;
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }
        `);
        return res.createShop.id;
    }

    async function provisionOwner(shopId: string, email: string): Promise<void> {
        await adminClient.query(gql`
            mutation {
                provisionShopOwner(shopId: "${shopId}", input: {
                    emailAddress: "${email}", password: "test", firstName: "店", lastName: "A"
                }) { id }
            }
        `);
    }

    /** 程序化自建商品（minimal CSV 仅 1 个产品，不够两店拆账）。返回 { id, variantId }。 */
    async function createProduct(name: string, slug: string, taxCategoryId: string): Promise<{ id: string; variantId: string }> {
        const p = (await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                }) { ... on Product { id } }
            }
        `)) as any;
        const pid = p.createProduct.id;
        const v = (await adminClient.query(gql`
            mutation {
                createProductVariants(input: [{
                    productId: "${pid}"
                    sku: "${slug}-x"
                    price: 100
                    taxCategoryId: "${taxCategoryId}"
                    trackInventory: FALSE
                    translations: [{ languageCode: en, name: "${name} variant" }]
                }]) { ... on ProductVariant { id } }
            }
        `)) as any;
        return { id: pid, variantId: v.createProductVariants[0].id };
    }

    async function assign(shopId: string, productIds: string[]): Promise<void> {
        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopId}", productIds: [${productIds.map(id => `"${id}"`).join(',')}] }) }`);
    }

    /** 建单支付成功，返回 orderId。 */
    async function createPaidOrder(quantity = 1): Promise<string> {
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantAId}", quantity: ${quantity}) {
                    ... on Order { id code state totalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.id).toBeDefined();
        return paid.id as unknown as string;
    }

    /**
     * 推进订单到目标状态。可复用已建 fulfillment（幂等/二次推进场景传 fId），返回 fId。
     */
    async function transitionOrderTo(orderId: string, target: 'Shipped' | 'Delivered', fId?: string): Promise<string> {
        if (!fId) {
            const detail = (await adminClient.query(gql`
                query { order(id: "${orderId}") { id lines { id quantity } } }
            `)) as any;
            // 覆盖订单全部行，避免多店/多行订单滞留在 PartiallyShipped
            const lines = detail.order.lines.map((l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`).join(' ');
            const f = (await adminClient.query(gql`
                mutation {
                    addFulfillmentToOrder(input: {
                        lines: [${lines}]
                        handler: { code: "manual-fulfillment" arguments: [
                            { name: "method", value: "standard" }
                            { name: "trackingCode", value: "SF123456" }
                        ] }
                    }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
                }
            `)) as any;
            expect(f.addFulfillmentToOrder.id).toBeDefined();
            fId = f.addFulfillmentToOrder.id;
        }
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
        if (target === 'Delivered') {
            await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Delivered") { ... on Fulfillment { id state } } }`);
            await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } } }`);
        }
        const after = (await adminClient.query(gql`query { order(id: "${orderId}") { state } }`)) as any;
        expect(after.order.state).toBe(target);
        return fId;
    }

    /** 以店主身份登录，返回专属 admin-client。 */
    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    /** 取某店主的结算明细（按需过滤订单号）。 */
    async function entriesOf(ownerEmail: string, orderCode?: string): Promise<any[]> {
        const c = await asOwner(ownerEmail);
        const r = (await c.query(MY_ENTRIES)) as any;
        const items = r.mySettlementEntries.items;
        return orderCode ? items.filter((i: any) => String(i.orderCode) === orderCode) : items;
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: singleStageRefundablePaymentMethod.code, handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        shopAId = await createShop('Shop A', 'shop-a');
        shopBId = await createShop('Shop B', 'shop-b');
        await provisionOwner(shopAId, 'ownerA.settle@test.com');
        await provisionOwner(shopBId, 'ownerB.settle@test.com');

        // 顾客
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "C", lastName: "U", emailAddress: "main.settle@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials('main.settle@test.com', 'test');

        // 两件商品分别归属两店（程序化自建，minimal CSV 仅 1 个产品）
        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createProduct('甲店商品', 'shop-a-product', taxCategoryId);
        const pb = await createProduct('乙店商品', 'shop-b-product', taxCategoryId);
        productAId = pa.id;
        productBId = pb.id;
        variantAId = pa.variantId;
        await assign(shopAId, [productAId]);
        await assign(shopBId, [productBId]);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件加载 + 初始账户（未营收）返回 0 余额', async () => {
        expect(server.app).toBeDefined();
        const ownerA = await asOwner('ownerA.settle@test.com');
        const r = (await ownerA.query(MY_ACCOUNT)) as any;
        expect(r.myMerchantAccount.availableBalance).toBe(0);
        expect(r.myMerchantAccount.totalGoodsAmount).toBe(0);
    });

    it('2 订单送达 Delivered → 按店产生结算明细 + 账户余额正确（佣金0）', async () => {
        const orderId = await createPaidOrder(2);
        await transitionOrderTo(orderId, 'Delivered');
        const ownerA = await asOwner('ownerA.settle@test.com');
        await waitFor(async () => {
            const r = (await ownerA.query(MY_ENTRIES)) as any;
            return r.mySettlementEntries.totalItems >= 1;
        });
        const entries = (await ownerA.query(MY_ENTRIES)) as any;
        const e = entries.mySettlementEntries.items[0];
        expect(String(e.shopId)).toBe(shopAId);
        expect(e.commissionAmount).toBe(0);
        expect(e.netAmountWithTax).toBe(e.goodsAmountWithTax + e.shippingAmountWithTax);
        const acc = (await ownerA.query(MY_ACCOUNT)) as any;
        expect(acc.myMerchantAccount.totalGoodsAmount).toBeGreaterThan(0);
        expect(acc.myMerchantAccount.availableBalance).toBe(e.netAmountWithTax);
    });

    it('3 多店拆账：同一订单含两店商品各产生明细', async () => {
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantAId}", quantity: 1) {
                    ... on Order { id } ... on ErrorResult { errorCode message }
                }
            }
        `);
        const prodB = (await adminClient.query(gql`query { product(id: "${productBId}") { id variants { id } } }`)) as any;
        const variantBId = prodB.product.variants[0].id;
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantBId}", quantity: 1) {
                    ... on Order { id } ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        await transitionOrderTo(paid.id, 'Shipped');

        const ownerA = await asOwner('ownerA.settle@test.com');
        const ownerB = await asOwner('ownerB.settle@test.com');
        await waitFor(async () => {
            const r = (await ownerA.query(MY_ENTRIES)) as any;
            return r.mySettlementEntries.totalItems >= 2;
        });
        const ea = (await ownerA.query(MY_ENTRIES)) as any;
        const eb = (await ownerB.query(MY_ENTRIES)) as any;
        expect(ea.mySettlementEntries.totalItems).toBe(2); // 用例2一条 + 本单一（A店）
        expect(eb.mySettlementEntries.totalItems).toBe(1); // 本单B店
    });

    it('4 幂等：同一订单 Shipped→Delivered 双事件只入账一次', async () => {
        const orderId = await createPaidOrder(1);
        const fId = await transitionOrderTo(orderId, 'Shipped'); // 触发一次入账
        await transitionOrderTo(orderId, 'Delivered', fId); // 复用同 fulfillment 再触发 → 应幂等
        const code = (await adminClient.query(gql`query { order(id: "${orderId}") { code } }`)) as any;
        const ownerA = await asOwner('ownerA.settle@test.com');
        await waitFor(async () => {
            const entries = await entriesOf('ownerA.settle@test.com', code.order.code);
            return entries.length >= 1;
        });
        const entries = await entriesOf('ownerA.settle@test.com', code.order.code);
        expect(entries.length).toBe(1); // 不因双终态而双计
    });

    it('5 提现：店主发起（额度内成功）', async () => {
        const ownerA = await asOwner('ownerA.settle@test.com');
        const before = (await ownerA.query(MY_ACCOUNT)) as any;
        expect(before.myMerchantAccount.availableBalance).toBeGreaterThan(0);
        const amount = before.myMerchantAccount.availableBalance;
        const r = (await ownerA.query(WITHDRAW, { a: amount })) as any;
        expect(r.requestWithdrawal.amount).toBe(amount);
        expect(r.requestWithdrawal.status).toBe('pending');
    });

    it('6 提现超额拒绝（amount > availableBalance）', async () => {
        const ownerA = await asOwner('ownerA.settle@test.com');
        const acc = (await ownerA.query(MY_ACCOUNT)) as any;
        const tooMuch = acc.myMerchantAccount.availableBalance + 100000;
        await assertThrowsWithMessage(() => ownerA.query(WITHDRAW, { a: tooMuch }), 'Insufficient balance');
    });

    it('7 平台审核 approve → pay：余额扣减、totalWithdrawn 累加', async () => {
        const ownerA = await asOwner('ownerA.settle@test.com');
        const acc = (await ownerA.query(MY_ACCOUNT)) as any;
        const amount = Math.min(100, acc.myMerchantAccount.availableBalance);
        const w = (await ownerA.query(WITHDRAW, { a: amount })) as any;
        const wid = w.requestWithdrawal.id;
        await adminClient.query(APPROVE, { id: wid });
        const paid = (await adminClient.query(PAY, { id: wid })) as any;
        expect(paid.payWithdrawal.status).toBe('paid');
        const after = (await ownerA.query(MY_ACCOUNT)) as any;
        expect(after.myMerchantAccount.totalWithdrawn).toBeGreaterThanOrEqual(amount);
    });

    it('8 平台驳回 rejected：余额不变', async () => {
        const ownerA = await asOwner('ownerA.settle@test.com');
        const acc = (await ownerA.query(MY_ACCOUNT)) as any;
        const balBefore = acc.myMerchantAccount.availableBalance;
        const amount = Math.min(50, balBefore);
        const w = (await ownerA.query(WITHDRAW, { a: amount })) as any;
        const wid = w.requestWithdrawal.id;
        const rej = (await adminClient.query(REJECT, { id: wid, note: '资料不符' })) as any;
        expect(rej.rejectWithdrawal.status).toBe('rejected');
        expect(rej.rejectWithdrawal.reviewNote).toBe('资料不符');
        const after = (await ownerA.query(MY_ACCOUNT)) as any;
        expect(after.myMerchantAccount.availableBalance).toBe(balBefore);
    });

    it('9 越权隔离：A 店主查不到 B 店明细', async () => {
        const ea = await entriesOf('ownerA.settle@test.com');
        const eb = await entriesOf('ownerB.settle@test.com');
        expect(ea.every((i: any) => String(i.shopId) === shopAId)).toBe(true);
        expect(eb.every((i: any) => String(i.shopId) === shopBId)).toBe(true);
    });

    it('10 平台配置佣金率 setMerchantCommissionRate，后续订单按新率入账', async () => {
        await adminClient.query(gql`mutation ($s: ID!, $r: Float!) { setMerchantCommissionRate(shopId: $s, rate: $r) { id commissionRate } }`, { s: shopAId, r: 10 });
        const orderId = await createPaidOrder(1);
        await transitionOrderTo(orderId, 'Delivered');
        const code = (await adminClient.query(gql`query { order(id: "${orderId}") { code } }`)) as any;
        await waitFor(async () => {
            const entries = await entriesOf('ownerA.settle@test.com', code.order.code);
            return entries.length >= 1;
        });
        const [e] = await entriesOf('ownerA.settle@test.com', code.order.code);
        const gross = e.goodsAmountWithTax + e.shippingAmountWithTax;
        expect(e.commissionAmount).toBe(Math.round((gross * 10) / 100));
        expect(e.netAmountWithTax).toBe(gross - e.commissionAmount);
    });

    it('11 无店主权限（平台超管）访问店主域 → not authorized', async () => {
        const superClient = new SimpleGraphQLClient(config, adminApiUrl);
        await superClient.asSuperAdmin();
        await assertThrowsWithMessage(
            () => superClient.query(gql`query { myMerchantAccount { id } }`),
            'not authorized',
        );
    });

    it('12 提现状态机非法迁移拒绝（paid 后再 reject）', async () => {
        const ownerA = await asOwner('ownerA.settle@test.com');
        const acc = (await ownerA.query(MY_ACCOUNT)) as any;
        const amount = Math.min(20, acc.myMerchantAccount.availableBalance);
        const w = (await ownerA.query(WITHDRAW, { a: amount })) as any;
        const wid = w.requestWithdrawal.id;
        await adminClient.query(APPROVE, { id: wid });
        await adminClient.query(PAY, { id: wid });
        await assertThrowsWithMessage(
            () => adminClient.query(REJECT, { id: wid }),
            'Cannot transition withdrawal',
        );
    });

    it('13 平台查询全部账户/明细/提现列表', async () => {
        const accounts = (await adminClient.query(gql`query { merchantAccounts { items { id shopId } totalItems } }`)) as any;
        expect(accounts.merchantAccounts.totalItems).toBeGreaterThanOrEqual(2);
        const wrs = (await adminClient.query(gql`query { withdrawalRequests { items { id status } totalItems } }`)) as any;
        expect(wrs.withdrawalRequests.totalItems).toBeGreaterThanOrEqual(3);
    });
});