import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { codPaymentHandler } from '../../cjk-plugin/src/payment/cod-handler';

import { PickupPlugin } from '../src/pickup.plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { DeliveryPlugin } from '../../delivery-plugin/src/delivery.plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('PickupPlugin · 到店付款(COD)核销防漏收 + 属店过滤', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            DeliveryPlugin.init(),
            PickupPlugin.init({}),
        ],
        paymentOptions: {
            paymentMethodHandlers: [codPaymentHandler],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let variantAId: string;
    let variantBId: string;

    const CLAIM_BY_SHOP = gql`mutation ($code: String!, $collect: Boolean) { claimPickupByShop(code: $code, collect: $collect) { id orderId code status paymentType collected claimChannel } }`;

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

    async function resetActiveOrder(): Promise<void> {
        try {
            await shopClient.query(gql`mutation { removeAllOrderLines { ... on Order { id } } }`);
        } catch {
            // no active order → ignore
        }
    }

    /** 建 COD 自提单并付款（COD 停在 PaymentAuthorized）。返回订单 id 与核销码。 */
    async function startCodPickupOrder(variantId: string): Promise<{ orderId: string; code: string }> {
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
                setOrderCustomFields(input: { customFields: { deliveryType: "pickup" } }) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        // 复用工具：设地址+配送方式+转入 ArrangingPayment（保证可付款）
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, codPaymentHandler);
        const orderId = paid.id as unknown as string;
        expect(orderId).toBeDefined();
        // COD 停在 PaymentAuthorized 也应能取码
        const codeR = (await shopClient.query(gql`query ($id: ID!) { myPickupCode(orderId: $id) { code status paymentType } }`, { id: orderId })) as any;
        expect(codeR.myPickupCode.code).toMatch(/^[A-Z2-9]{6}$/);
        expect(codeR.myPickupCode.paymentType).toBe('cod');
        return { orderId, code: codeR.myPickupCode.code };
    }

    /** 备货完成：admin 手动结算 COD + addFulfillment + Fulfillment/Order→Shipped。 */
    async function shipCod(orderId: string): Promise<void> {
        const o = (await adminClient.query(gql`query { order(id: "${orderId}") { id lines { id quantity } payments { id state } } }`)) as any;
        const pay = o.order.payments[0];
        await adminClient.query(gql`mutation { transitionPaymentToState(id: "${pay.id}", state: "Settled") { ... on Payment { state } } }`);
        const lines = o.order.lines.map((l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`).join(' ');
        const f = (await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [${lines}]
                    handler: { code: "manual-fulfillment" arguments: [
                        { name: "method", value: "到店" }
                        { name: "trackingCode", value: "PICKUP" }
                    ] }
                }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
            }
        `)) as any;
        const fId = f.addFulfillmentToOrder.id;
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: codPaymentHandler.code, handler: { code: codPaymentHandler.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        shopAId = await createShop('Shop A', 'shop-a');
        shopBId = await createShop('Shop B', 'shop-b');
        await provisionOwner(shopAId, 'ownerA.collect@test.com');
        await provisionOwner(shopBId, 'ownerB.collect@test.com');

        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "C", lastName: "1", emailAddress: "customer1.collect@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials('customer1.collect@test.com', 'test');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createProduct('甲店COD商品', 'shop-a-cod', taxCategoryId);
        const pb = await createProduct('乙店COD商品', 'shop-b-cod', taxCategoryId);
        variantAId = pa.variantId;
        variantBId = pb.variantId;
        await assign(shopAId, [pa.id]);
        await assign(shopBId, [pb.id]);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 COD 自提单：未确认收款(collect=false)核销被拒', async () => {
        const { orderId, code } = await startCodPickupOrder(variantAId);
        await shipCod(orderId);
        const ownerA = await asOwner('ownerA.collect@test.com');
        await assertThrowsWithMessage(
            () => ownerA.query(CLAIM_BY_SHOP, { code, collect: false }),
            '请先确认收款后再核销',
        );
    });

    it('2 COD 自提单：确认收款(collect=true)核销成功 → collected=true/paymentType=cod', async () => {
        const { orderId, code } = await startCodPickupOrder(variantAId);
        await shipCod(orderId);
        const ownerA = await asOwner('ownerA.collect@test.com');
        const r = (await ownerA.query(CLAIM_BY_SHOP, { code, collect: true })) as any;
        expect(r.claimPickupByShop.status).toBe('redeemed');
        expect(r.claimPickupByShop.paymentType).toBe('cod');
        expect(r.claimPickupByShop.collected).toBe(true);
        expect(r.claimPickupByShop.claimChannel).toBe('shop');
        // 订单 collected 同步为 true
        const o = (await adminClient.query(gql`query { order(id: "${orderId}") { customFields { collected paymentType } } }`)) as any;
        expect(o.order.customFields.collected).toBe(true);
    });

    it('3 我的待核销清单(myPickupOrders)仅包含本店商品的单（属店过滤）', async () => {
        // 甲店建一单（归 A），乙店建一单（归 B）
        const a = await startCodPickupOrder(variantAId);
        await shipCod(a.orderId);
        // 不核销，保留 generated 态
        const b = await startCodPickupOrder(variantBId);
        await shipCod(b.orderId);
        const ownerA = await asOwner('ownerA.collect@test.com');
        const r = (await ownerA.query(gql`query { myPickupOrders { items { code orderId } totalItems } }`)) as any;
        const codes = r.myPickupOrders.items.map((i: any) => i.code);
        expect(codes).toContain(a.code);
        expect(codes).not.toContain(b.code); // 乙店单绝不出现在甲店清单
        const ownerB = await asOwner('ownerB.collect@test.com');
        const rb = (await ownerB.query(gql`query { myPickupOrders { items { code } } }`)) as any;
        expect(rb.myPickupOrders.items.map((i: any) => i.code)).toContain(b.code);
    });
});