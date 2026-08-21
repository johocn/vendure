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

import { PickupPlugin } from '../src/pickup.plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { DeliveryPlugin } from '../../delivery-plugin/src/delivery.plugin';
import { SettlementPlugin } from '../../settlement-plugin/src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 简单的轮询帮助函数（事件订阅 → 异步入账/作废，需轮询等待）。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 80): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

describe('PickupPlugin · 阶段26 门店自提闭环(提货码+一次性核销+店铺归属+结算联动)', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            DeliveryPlugin.init(),
            SettlementPlugin.init({ defaultCommissionRate: 0 }),
            PickupPlugin.init({}),
        ],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let variantAId: string;
    let variantBId: string;

    // 用例 1 建立、用例 5/6 复用的「主自提单」
    let mainOrderId: string;
    let mainCode: string;

    const MY_ENTRIES = gql`query { mySettlementEntries { items { id shopId orderCode } totalItems } }`;
    const CLAIM_MY = gql`mutation ($orderId: ID!, $code: String!) { claimMyPickup(orderId: $orderId, code: $code) { id code status claimChannel } }`;
    const CLAIM_BY_SHOP = gql`mutation ($code: String!) { claimPickupByShop(code: $code) { id code status claimChannel } }`;

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

    /** 程序化自建商品（显式传默认税类，规避 active tax zone 推断）。返回 { id, variantId }。 */
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

    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    /** 清理当前活跃订单（消除测试间活跃订单残留）。 */
    async function resetActiveOrder(): Promise<void> {
        try {
            await shopClient.query(gql`mutation { removeAllOrderLines { ... on Order { id } } }`);
        } catch {
            // no active order → ignore
        }
    }

    /** 建单（可指定履约方式）并付款，返回已付款未备货的订单 id。 */
    async function startOrder(variantId: string, deliveryType = 'pickup'): Promise<string> {
        await resetActiveOrder();
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await shopClient.query(gql`
            mutation {
                setOrderCustomFields(input: { customFields: { deliveryType: "${deliveryType}" } }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.id).toBeDefined();
        return paid.id as unknown as string;
    }

    /** 备货完成：addFulfillment(全行) + Fulfillment→Shipped + Order→Shipped。 */
    async function ship(orderId: string): Promise<void> {
        const detail = (await adminClient.query(gql`
            query { order(id: "${orderId}") { id lines { id quantity } } }
        `)) as any;
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
        const fId = f.addFulfillmentToOrder.id;
        expect(fId).toBeDefined();
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
    }

    /** 顾客取码。 */
    async function codeOf(orderId: string): Promise<{ code: string; status: string }> {
        const r = (await shopClient.query(
            gql`query ($id: ID!) { myPickupCode(orderId: $id) { code status } }`,
            { id: orderId },
        )) as any;
        return r.myPickupCode;
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
        await provisionOwner(shopAId, 'ownerA.pickup@test.com');
        await provisionOwner(shopBId, 'ownerB.pickup@test.com');

        // 主买家 customer1（自提买方）；customer2 用于越权用例
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "C", lastName: "1", emailAddress: "customer1.pickup@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "C", lastName: "2", emailAddress: "customer2.pickup@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials('customer1.pickup@test.com', 'test');

        // 两件商品分别归属两店（显式默认税类）
        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createProduct('甲店自提商品', 'shop-a-pickup-product', taxCategoryId);
        const pb = await createProduct('乙店自提商品', 'shop-b-pickup-product', taxCategoryId);
        variantAId = pa.variantId;
        variantBId = pb.variantId;
        await assign(shopAId, [pa.id]);
        await assign(shopBId, [pb.id]);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    // ---------- 11 用例 ----------

    it('1 插件加载+建pickup单付款取码: myPickupCode 生成唯一码', async () => {
        expect(server.app).toBeDefined();
        const orderId = await startOrder(variantAId);
        await ship(orderId);
        const { code, status } = await codeOf(orderId);
        expect(code).toMatch(/^[A-Z2-9]{6}$/);
        expect(status).toBe('generated');
        // 供用例 2/5/6 复用
        mainOrderId = orderId;
        mainCode = code;
    });

    it('2 幂等: 再次取码同一码', async () => {
        const a = await codeOf(mainOrderId);
        const b = await codeOf(mainOrderId);
        expect(a.code).toBe(b.code);
        expect(a.code).toBe(mainCode);
    });

    it('3 未付款/非pickup取码被拒(UserInputError)', async () => {
        // a) 已付款但其履约方式非 pickup → 被拒
        const deliveryOrder = await startOrder(variantAId, 'delivery');
        await assertThrowsWithMessage(() => codeOf(deliveryOrder), 'not a paid pickup order');

        // b) 自提单但未付款 → 被拒
        await resetActiveOrder();
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantAId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await shopClient.query(gql`
            mutation {
                setOrderCustomFields(input: { customFields: { deliveryType: "pickup" } }) {
                    ... on Order { id } ... on ErrorResult { errorCode message }
                }
            }
        `);
        const active = (await shopClient.query(gql`query { activeOrder { id } }`)) as any;
        const unpaidOrderId = active.activeOrder.id as string;
        await assertThrowsWithMessage(() => codeOf(unpaidOrderId), 'not a paid pickup order');
        await resetActiveOrder();
    });

    it('4 备货完成前(未Shipped)核销被拒(UserInputError)', async () => {
        const orderId = await startOrder(variantAId); // 已付款未备货
        const { code } = await codeOf(orderId); // 取码允许（已付款）
        await assertThrowsWithMessage(() => shopClient.query(CLAIM_MY, { orderId, code }), 'not ready for pickup');
    });

    it('5 备货(Shipped)后顾客自核销成功 → redeemed + Fulfillment Delivered', async () => {
        const r = (await shopClient.query(CLAIM_MY, { orderId: mainOrderId, code: mainCode })) as any;
        expect(r.claimMyPickup.status).toBe('redeemed');
        expect(r.claimMyPickup.claimChannel).toBe('customer');
        // Fulfillment 应达 Delivered
        const o = (await adminClient.query(gql`query { order(id: "${mainOrderId}") { fulfillments { state } } }`)) as any;
        expect(o.order.fulfillments.map((f: any) => f.state)).toContain('Delivered');
    });

    it('6 一次性: 核销后同码再核销被拒', async () => {
        await assertThrowsWithMessage(() => shopClient.query(CLAIM_MY, { orderId: mainOrderId, code: mainCode }), 'already redeemed');
    });

    it('7 错误码被拒(UserInputError)', async () => {
        const orderId = await startOrder(variantAId);
        await ship(orderId);
        const { code } = await codeOf(orderId);
        const wrong = code === 'ABCDEF' ? 'FEDCBA' : 'ABCDEF'; // 同字符集但一定不相等
        await assertThrowsWithMessage(() => shopClient.query(CLAIM_MY, { orderId, code: wrong }), 'mismatch');
    });

    it('8 店员核销(claimPickupByShop) 店主域本店成功', async () => {
        const orderId = await startOrder(variantAId);
        await ship(orderId);
        const { code } = await codeOf(orderId);
        const ownerA = await asOwner('ownerA.pickup@test.com');
        const r = (await ownerA.query(CLAIM_BY_SHOP, { code })) as any;
        expect(r.claimPickupByShop.status).toBe('redeemed');
        expect(r.claimPickupByShop.claimChannel).toBe('shop');
    });

    it('9 越权: 非本人查别人单码→Forbidden; 店主核销非本店单→Forbidden', async () => {
        // a) 非本人（另一顾客）查 customer1 的自提单码 → Forbidden
        const orderA = await startOrder(variantAId);
        await ship(orderA);
        const outsider = new SimpleGraphQLClient(config, shopApiUrl);
        await outsider.asUserWithCredentials('customer2.pickup@test.com', 'test');
        await assertThrowsWithMessage(
            () => outsider.query(gql`query ($id: ID!) { myPickupCode(orderId: $id) { code } }`, { id: orderA }),
            'not authorized',
        );

        // b) 店主 A 核销乙店(B)的自提单 → ForbiddenError（店归属强校验）
        const orderB = await startOrder(variantBId);
        await ship(orderB);
        const { code: codeB } = await codeOf(orderB);
        const ownerA = await asOwner('ownerA.pickup@test.com');
        await assertThrowsWithMessage(() => ownerA.query(CLAIM_BY_SHOP, { code: codeB }), 'not authorized');
    });

    it('10 取消作废: 订单Cancelled → redemption status void', async () => {
        const orderId = await startOrder(variantAId);
        const { code } = await codeOf(orderId); // 生成码但未备货
        void code;
        await adminClient.query(gql`
            mutation { cancelOrder(input: { orderId: "${orderId}" }) {
                ... on Order { id state }
                ... on ErrorResult { errorCode message }
            } }
        `);
        // 取消即触发订单 → Cancelled，提货码应作废为 void
        await waitFor(async () => {
            const r = (await adminClient.query(gql`query { order(id: "${orderId}") { state } }`)) as any;
            return r.order.state === 'Cancelled';
        });
        await waitFor(async () => {
            const r = (await adminClient.query(gql`query { pickupRedemptions(options: { take: 100 }) { items { orderId status } } }`)) as any;
            const item = r.pickupRedemptions.items.find((i: any) => String(i.orderId) === String(orderId));
            return item && item.status === 'void';
        });
    });

    it('11 结算联动: 核销后商家 mySettlementEntries 应收明细出现该自提单', async () => {
        const orderId = await startOrder(variantAId);
        await ship(orderId); // Shipped 即触发结算入账
        const { code } = await codeOf(orderId);
        const r = (await shopClient.query(CLAIM_MY, { orderId, code })) as any;
        expect(r.claimMyPickup.status).toBe('redeemed');
        const oc = (await adminClient.query(gql`query { order(id: "${orderId}") { code } }`)) as any;
        const orderCode = oc.order.code as string;
        const ownerA = await asOwner('ownerA.pickup@test.com');
        await waitFor(async () => {
            const e = (await ownerA.query(MY_ENTRIES)) as any;
            return e.mySettlementEntries.items.some((i: any) => String(i.orderCode) === orderCode);
        });
        const e = (await ownerA.query(MY_ENTRIES)) as any;
        const hit = e.mySettlementEntries.items.find((i: any) => String(i.orderCode) === orderCode);
        expect(String(hit.shopId)).toBe(shopAId);
    });
});