import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

// 本插件未注册进 node_modules（新包），从其源码导入；shop-plugin 经 @vendure 别名（构建 lib 已有）。
import { InventoryPlugin } from '../src/inventory.plugin';
import { ShopPlugin } from '@vendure/shop-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('InventoryPlugin · 阶段47 店主自营库存（只读水位 + 归属校准）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), InventoryPlugin.init()],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let productAId: string;
    let variantAId: string;
    let productBId: string;
    let variantBId: string;
    let defaultLocationId: string;

    const MYSTOCK = gql`
        query ($pid: ID!) { myShopStock(productId: $pid) { variantId variantName sku locations { locationId locationName stockOnHand stockAllocated stockAvailable } } }
    `;
    const MYADJUST = gql`
        mutation ($vid: ID!, $lid: ID!, $onh: Int!) { myShopStockAdjust(variantId: $vid, stockLocationId: $lid, stockOnHand: $onh) }
    `;
    const LEDGER = gql`
        query ($vid: ID!, $biz: String) { stockLedger(productVariantId: $vid, bizType: $biz) { items { id bizType bizCode quantity beforeOnHand afterOnHand reason } totalItems } }
    `;
    const TOGGLE = gql`
        mutation ($pid: ID!, $on: Boolean!) { setMyShopProductEnabled(productId: $pid, enabled: $on) }
    `;
    const PROD = gql`
        query ($id: ID!) { product(id: $id) { ... on Product { enabled id variants { id enabled } } } }
    `;
    const PRODSTOCK = gql`
        query ($pid: ID!) { myShopProductStock(productId: $pid) { productId variantCount totalOnHand totalAvailable } }
    `;
    const MYORDERS = gql`
        query { myShopOrders { orderId code state totalWithTax items { orderLineId productId productName variantName quantity fulfilledQuantity unitPriceWithTax lineTotalWithTax } } }
    `;
    const FULFILL = gql`
        mutation ($orderId: ID!, $lines: [FulfillLineInput!], $method: String, $trackingCode: String) {
            fulfillMyShopOrder(orderId: $orderId, lines: $lines, method: $method, trackingCode: $trackingCode) {
                orderId totalItemCount shippedItemCount remainingItemCount fulfillmentIds
            }
        }
    `;
    const MYFULFILLMENTS = gql`
        query ($orderId: ID!) { myShopOrderFulfillments(orderId: $orderId) { fulfillmentId state method trackingCode createdAt items { orderLineId productName variantName quantity } } }
    `;
    const ADMIN_FULFILLMENTS = gql`
        query ($id: ID!) { order(id: $id) { id state lines { id quantity } fulfillments { id state method trackingCode createdAt } } }
    `;
    const STOCKLEDGER = gql`
        query ($vid: ID!) { stockLedger(productVariantId: $vid, page: 1, pageSize: 80) { items { id bizType bizCode orderLineId direction quantity beforeOnHand afterOnHand } } }
    `;

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test" }) { id } }
        `)) as any;
        await adminClient.query(gql`mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }`);
        return res.createShop.id;
    }

    async function provisionOwner(shopId: string, email: string): Promise<void> {
        await adminClient.query(gql`
            mutation { provisionShopOwner(shopId: "${shopId}", input: { emailAddress: "${email}", password: "test", firstName: "店", lastName: "主" }) { id } }
        `);
    }

    async function createVariantProduct(name: string, slug: string, taxCategoryId: string): Promise<{ id: string; variantId: string }> {
        const p = (await adminClient.query(gql`
            mutation { createProduct(input: { translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${slug} desc" }] }) { ... on Product { id } } }
        `)) as any;
        const pid = p.createProduct.id;
        const v = (await adminClient.query(gql`
            mutation { createProductVariants(input: [{ productId: "${pid}", sku: "${slug}-x", price: 100, taxCategoryId: "${taxCategoryId}", trackInventory: TRUE, translations: [{ languageCode: en, name: "${name} variant" }] }]) { ... on ProductVariant { id } } }
        `)) as any;
        return { id: pid, variantId: v.createProductVariants[0].id };
    }

    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    /** 建单支付成功（单阶段结算支付），返回 orderId。 */
    async function createPaidOrder(variantId: string, quantity = 1): Promise<string> {
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: ${quantity}) {
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

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: singleStageRefundablePaymentMethod.code, handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 0,
        });
        await adminClient.asSuperAdmin();

        // 下单顾客（购物车/支付走 shop API）
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "M", lastName: "R", emailAddress: "main.merchant@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials('main.merchant@test.com', 'test');

        shopAId = await createShop('Shop A', 'shop-a');
        shopBId = await createShop('Shop B', 'shop-b');
        await provisionOwner(shopAId, 'ownerA.stock@test.com');
        await provisionOwner(shopBId, 'ownerB.stock@test.com');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createVariantProduct('A店商品', 'shop-a-stock', taxCategoryId);
        const pb = await createVariantProduct('B店商品', 'shop-b-stock', taxCategoryId);
        productAId = pa.id;
        variantAId = pa.variantId;
        productBId = pb.id;
        variantBId = pb.variantId;

        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopAId}", productIds: ["${productAId}"] }) }`);
        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopBId}", productIds: ["${productBId}"] }) }`);

        const locs = (await adminClient.query(gql`query { stockLocations { items { id name } } }`)) as any;
        defaultLocationId = locs.stockLocations.items[0].id;

        // 给 A 店商品所在位置设初始库存 50，给 B 店商品设 5（保证 stockLevels 存在行，供归属隔离断言基线）
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variantAId}", stockLocationId: "${defaultLocationId}", stockOnHand: 50) }
        `);
        await adminClient.query(gql`
            mutation { setVariantStock(productVariantId: "${variantBId}", stockLocationId: "${defaultLocationId}", stockOnHand: 5) }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('2 平台管理员（无 manageOwnShop 权限）调店主库存被拒', async () => {
        // 超管绕过 @Allow；另建一个仅持平台权限、无 manageOwnShop 的管理员验证拒绝
        const role = (await adminClient.query(gql`
            mutation { createRole(input: { code: "platform-staff", description: "platform", permissions: [UpdateSettings] }) { ... on Role { id } } }
        `)) as any;
        await adminClient.query(gql`
            mutation { createAdministrator(input: { firstName: "P", lastName: "A", emailAddress: "platform.staff@test.com", password: "test", roleIds: ["${role.createRole.id}"] }) { id } }
        `);
        const platformClient = await asOwner('platform.staff@test.com');
        await expect(platformClient.query(MYSTOCK, { pid: productAId })).rejects.toThrow();
        await expect(platformClient.query(MYADJUST, { vid: variantAId, lid: defaultLocationId, onh: 99 })).rejects.toThrow();
    });

    it('3 店主A只读水位：myShopStock 返回本人商品逐仓水位且不含他人商品', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        const r = (await ownerA.query(MYSTOCK, { pid: productAId })) as any;
        expect(r.myShopStock.length).toBeGreaterThan(0);
        const row = r.myShopStock.find((x: any) => String(x.variantId) === String(variantAId));
        expect(row).toBeDefined();
        const loc = row.locations.find((l: any) => String(l.locationId) === String(defaultLocationId));
        expect(loc).toBeDefined();
        expect(loc.stockOnHand).toBe(50);
    });

    it('4 店主A调整库存：写 manual 账本 + 水位变化', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        await ownerA.query(MYADJUST, { vid: variantAId, lid: defaultLocationId, onh: 80 });

        const r = (await ownerA.query(MYSTOCK, { pid: productAId })) as any;
        const row = r.myShopStock.find((x: any) => String(x.variantId) === String(variantAId));
        const loc = row.locations.find((l: any) => String(l.locationId) === String(defaultLocationId));
        expect(loc.stockOnHand).toBe(80);
        expect(loc.stockAvailable).toBe(80);

        // manual 账本留痕（bizCode=MyShop-shop-a）
        const ledger = (await adminClient.query(LEDGER, { vid: variantAId, biz: 'manual' })) as any;
        expect(ledger.stockLedger.totalItems).toBeGreaterThanOrEqual(1);
        expect(ledger.stockLedger.items.some((e: any) => String(e.bizCode) === 'MyShop-shop-a')).toBe(true);
    });

    it('5 归属隔离：店主A读/调他人店铺商品被拒', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        // 读 B 店商品
        await expect(ownerA.query(MYSTOCK, { pid: productBId })).rejects.toThrow();
        // 调 B 店变体
        await expect(ownerA.query(MYADJUST, { vid: variantBId, lid: defaultLocationId, onh: 10 })).rejects.toThrow();
        // 且 B 店库存未被改动
        const level = (await adminClient.query(gql`
            query { stockLevels(locationId: "${defaultLocationId}") { items { productVariantId stockOnHand } totalItems } }
        `)) as any;
        const row = level.stockLevels.items.find((x: any) => String(x.productVariantId) === String(variantBId));
        expect(row).toBeDefined();
        expect(row.stockOnHand).toBe(5);
    });

    it('6 上下架：店主A切换本人商品 enabled 并同步变体；对他人商品被拒', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        // 下架 A 商品 → Product.enabled=false 且变体全 false
        expect((await ownerA.query(TOGGLE, { pid: productAId, on: false })) as any).toEqual({ setMyShopProductEnabled: true });
        const p1 = (await adminClient.query(PROD, { id: productAId })) as any;
        expect(p1.product.enabled).toBe(false);
        expect(p1.product.variants.length).toBeGreaterThan(0);
        expect(p1.product.variants.every((v: any) => v.enabled === false)).toBe(true);
        // 重新上架 → enabled 恢复
        expect((await ownerA.query(TOGGLE, { pid: productAId, on: true })) as any).toEqual({ setMyShopProductEnabled: true });
        const p2 = (await adminClient.query(PROD, { id: productAId })) as any;
        expect(p2.product.enabled).toBe(true);
        expect(p2.product.variants.every((v: any) => v.enabled === true)).toBe(true);
        // 越权：对 B 店商品上下架被拒
        await expect(ownerA.query(TOGGLE, { pid: productBId, on: false })).rejects.toThrow();
    });

    it('7 库存聚合查看：myShopProductStock 汇总本人商品库存；对他人商品被拒', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        const r = (await ownerA.query(PRODSTOCK, { pid: productAId })) as any;
        expect(String(r.myShopProductStock.productId)).toBe(String(productAId));
        expect(r.myShopProductStock.variantCount).toBe(1);
        expect(r.myShopProductStock.totalOnHand).toBe(80); // 阶段47 test4 校准到 80
        expect(r.myShopProductStock.totalAvailable).toBe(80);
        // 越权：聚合他人店铺商品被拒
        await expect(ownerA.query(PRODSTOCK, { pid: productBId })).rejects.toThrow();
    });

    it('8 店主发货：本店订单行建履约单并流转至 Shipped', async () => {
        const orderId = await createPaidOrder(variantAId, 2);
        const ownerA = await asOwner('ownerA.stock@test.com');
        const r = (await ownerA.query(FULFILL, { orderId, method: '顺丰', trackingCode: 'SF123' })) as any;
        expect(r.fulfillMyShopOrder.totalItemCount).toBe(2);
        expect(r.fulfillMyShopOrder.fulfillmentIds.length).toBe(1);
        expect(r.fulfillMyShopOrder.remainingItemCount).toBe(0);
        // 履约单状态流转至 Shipped，方法/单号正确
        const detail = (await adminClient.query(ADMIN_FULFILLMENTS, { id: orderId })) as any;
        expect(detail.order.fulfillments.length).toBe(1);
        expect(detail.order.fulfillments[0].state).toBe('Shipped');
        expect(detail.order.fulfillments[0].method).toBe('顺丰');
        expect(detail.order.fulfillments[0].trackingCode).toBe('SF123');
    });

    it('9 店主履约明细：myShopOrderFulfillments 返回履约行；myShopOrders 带 fulfilledQuantity', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        const orders = (await ownerA.query(MYORDERS)) as any;
        const a = orders.myShopOrders.find((o: any) => o.items.some((i: any) => i.fulfilledQuantity > 0));
        expect(a).toBeDefined();
        const line = a.items.find((i: any) => i.fulfilledQuantity > 0);
        expect(line.fulfilledQuantity).toBe(line.quantity);
        const fls = (await ownerA.query(MYFULFILLMENTS, { orderId: a.orderId })) as any;
        expect(fls.myShopOrderFulfillments.length).toBe(1);
        const f = fls.myShopOrderFulfillments[0];
        expect(f.state).toBe('Shipped');
        expect(f.method).toBe('顺丰');
        expect(f.trackingCode).toBe('SF123');
        expect(f.createdAt).toBeDefined();
        expect(f.items.reduce((acc: number, i: any) => acc + i.quantity, 0)).toBe(line.quantity);
    });

    it('10 重复发货：全部已履约再次调用不新建履约单', async () => {
        const ownerA = await asOwner('ownerA.stock@test.com');
        const orders = (await ownerA.query(MYORDERS)) as any;
        const a = orders.myShopOrders.find((o: any) => o.items.some((i: any) => i.fulfilledQuantity > 0));
        const r = (await ownerA.query(FULFILL, { orderId: a.orderId })) as any;
        expect(r.fulfillMyShopOrder.fulfillmentIds.length).toBe(0);
        // 履约单数量仍为 1
        const detail = (await adminClient.query(ADMIN_FULFILLMENTS, { id: a.orderId })) as any;
        expect(detail.order.fulfillments.length).toBe(1);
    });

    it('11 越权隔离：店主A对纯他人店铺订单发货被拒；查看履约返回空', async () => {
        const orderBId = await createPaidOrder(variantBId, 1);
        const ownerA = await asOwner('ownerA.stock@test.com');
        // 发货被拒（订单行无一本店）
        await expect(ownerA.query(FULFILL, { orderId: orderBId })).rejects.toThrow();
        // 查看履约返回空数组（视图不报错但不可见他人行）
        const fls = (await ownerA.query(MYFULFILLMENTS, { orderId: orderBId })) as any;
        expect(fls.myShopOrderFulfillments.length).toBe(0);
        // B店店主可发货本人订单
        const ownerB = await asOwner('ownerB.stock@test.com');
        const rb = (await ownerB.query(FULFILL, { orderId: orderBId })) as any;
        expect(rb.fulfillMyShopOrder.fulfillmentIds.length).toBe(1);
        const detail = (await adminClient.query(ADMIN_FULFILLMENTS, { id: orderBId })) as any;
        expect(detail.order.fulfillments[0].state).toBe('Shipped');
    });

    it('12 分批发货：指定行/数量多次发货，生成多履约单并聚合', async () => {
        const orderId = await createPaidOrder(variantAId, 3);
        // 取本单 orderLineId
        const before = (await adminClient.query(ADMIN_FULFILLMENTS, { id: orderId })) as any;
        const lineId = String(before.order.lines[0].id);
        expect(before.order.lines[0].quantity).toBe(3);

        const ownerA = await asOwner('ownerA.stock@test.com');
        // 第一批：只发 1 件
        const r1 = (await ownerA.query(FULFILL, {
            orderId,
            lines: [{ orderLineId: lineId, quantity: 1 }],
            method: '第一批法务',
            trackingCode: 'SF-B1',
        })) as any;
        expect(r1.fulfillMyShopOrder.totalItemCount).toBe(3);
        expect(r1.fulfillMyShopOrder.shippedItemCount).toBe(1);
        expect(r1.fulfillMyShopOrder.remainingItemCount).toBe(2);
        expect(r1.fulfillMyShopOrder.fulfillmentIds.length).toBe(1);
        const firstFid = r1.fulfillMyShopOrder.fulfillmentIds[0];

        // 第二批：发剩余 2 件
        const r2 = (await ownerA.query(FULFILL, {
            orderId,
            lines: [{ orderLineId: lineId, quantity: 2 }],
            method: '第二批法务',
            trackingCode: 'SF-B2',
        })) as any;
        expect(r2.fulfillMyShopOrder.totalItemCount).toBe(3);
        expect(r2.fulfillMyShopOrder.shippedItemCount).toBe(3); // 累计已履约 = 1 + 2
        expect(r2.fulfillMyShopOrder.remainingItemCount).toBe(0);
        expect(r2.fulfillMyShopOrder.fulfillmentIds.length).toBe(1);

        // 聚合视图：共 2 个履约单，各发 1/2 件，行总量 3 全履约
        const fls = (await ownerA.query(MYFULFILLMENTS, { orderId })) as any;
        expect(fls.myShopOrderFulfillments.length).toBe(2);
        expect(fls.myShopOrderFulfillments.some((f: any) => String(f.fulfillmentId) === String(firstFid))).toBe(true);
        const totalShipped = fls.myShopOrderFulfillments.reduce(
            (acc: number, f: any) => acc + f.items.reduce((a: number, i: any) => a + i.quantity, 0),
            0,
        );
        expect(totalShipped).toBe(3);
        const orderRow = (await ownerA.query(MYORDERS)) as any;
        const o = orderRow.myShopOrders.find((x: any) => String(x.orderId) === String(orderId));
        expect(o.items[0].fulfilledQuantity).toBe(3);
    });

    it('13 发货即出库：店主发货后本店水位扣减 + order:out 账本落库', async () => {
        const before = (await adminClient.query(gql`
            query { stockLevels(page: 1, pageSize: 100) { items { productVariantId stockLocationId stockOnHand } } }
        `)) as any;
        const beforeRow = before.stockLevels.items.find(
            (r: any) => String(r.productVariantId) === String(variantAId),
        );
        expect(beforeRow).toBeDefined();
        const beforeOnHand = beforeRow.stockOnHand;

        const orderId = await createPaidOrder(variantAId, 3);
        const afterOrder = (await adminClient.query(gql`
            query ($id: ID!) { order(id: $id) { lines { id } } }
        `, { id: orderId })) as any;
        const lineId = String(afterOrder.order.lines[0].id);

        // 下单已占货（Allocation），未发货前 onHand 不变、available 减少
        const ownerA = await asOwner('ownerA.stock@test.com');
        await ownerA.query(FULFILL, { orderId });

        // 发货后：本仓 onHand 较下单前扣减 qty=3（core createSalesForOrder 真实减 onHand）
        const after = (await adminClient.query(gql`
            query { stockLevels(page: 1, pageSize: 100) { items { productVariantId stockLocationId stockOnHand } } }
        `)) as any;
        const afterRow = after.stockLevels.items.find(
            (r: any) => String(r.productVariantId) === String(variantAId),
        );
        expect(afterRow.stockOnHand).toBe(beforeOnHand - 3);

        // order:out 账本：同一事务随 SALE 写入向该订单行
        const ledger = (await adminClient.query(STOCKLEDGER, { vid: variantAId })) as any;
        const out = ledger.stockLedger.items.find(
            (e: any) => e.bizType === 'order' && e.direction === 'out' && String(e.orderLineId) === lineId,
        );
        expect(out).toBeDefined();
        expect(out.quantity).toBe(3);
        expect((out.beforeOnHand ?? 0) - (out.afterOnHand ?? 0)).toBe(3);
    });
});