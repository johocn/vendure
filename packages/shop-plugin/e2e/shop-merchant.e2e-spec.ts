import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { ShopPlugin } from '../src/plugin';
import { ReviewPlugin } from '@vendure/review-plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('ShopPlugin · 阶段18 店主自营后台账权体系（店主管理员账号/自定义权限/归属隔离/店铺商品订单评价自营）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), ReviewPlugin.init({ minContentLength: 5, autoApprove: false })],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let shopAId: string;
    let shopBId: string;
    let myProductId: string;
    let myVariantId: string;
    let otherProductId: string;
    let otherVariantId: string;

    /* ------------------------- helpers ------------------------- */

    async function setPricesIncludeTax(): Promise<void> {
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `) as any;
        const defaultChannelId = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation {
                updateChannel(input: { id: "${defaultChannelId}", pricesIncludeTax: true }) {
                    ... on Channel { id pricesIncludeTax }
                }
            }
        `);
    }

    async function createProduct(name: string, slug: string, taxCategoryId: string): Promise<{ id: string; variantId: string }> {
        const p = await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                }) { ... on Product { id } }
            }
        `) as any;
        const pid = p.createProduct.id;
        const v = await adminClient.query(gql`
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
        `) as any;
        return { id: pid, variantId: v.createProductVariants[0].id };
    }

    async function createShop(name: string, slug: string): Promise<string> {
        const res = await adminClient.query(gql`
            mutation {
                createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) {
                    id name slug status
                }
            }
        `) as any;
        return res.createShop.id;
    }

    async function setStatus(id: string, status: string): Promise<void> {
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${id}", status: "${status}") { id status } }
        `);
    }

    async function assign(shopId: string, ids: string[]): Promise<boolean> {
        const list = ids.map(id => `"${id}"`).join(',');
        const res = await adminClient.query(gql`
            mutation { assignProductsToShop(input: { shopId: "${shopId}", productIds: [${list}] }) }
        `) as any;
        return res.assignProductsToShop;
    }

    async function provision(shopId: string, email: string): Promise<string> {
        const res = await adminClient.query(gql`
            mutation {
                provisionShopOwner(shopId: "${shopId}", input: {
                    emailAddress: "${email}", password: "test", firstName: "Owner", lastName: "One"
                }) { id emailAddress }
            }
        `) as any;
        return res.provisionShopOwner;
    }

    async function myShopQuery(client: SimpleGraphQLClient): Promise<any> {
        const res = await client.query(gql`
            query { myShop { id name slug status description } }
        `) as any;
        return res.myShop;
    }

    async function myShopOrders(): Promise<any[]> {
        const res = await adminClient.query(gql`
            query {
                myShopOrders {
                    orderId code state totalWithTax customerName
                    items { orderLineId productId productName variantName quantity unitPriceWithTax lineTotalWithTax }
                }
            }
        `) as any;
        return res.myShopOrders;
    }

    async function deliverOrder(client: SimpleGraphQLClient, variantId: string): Promise<{ orderId: string; lineId: string }> {
        const o = await client.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        const orderId = await proceedToArrangingPayment(client);
        await addPaymentToOrder(client, singleStageRefundablePaymentMethod);
        // 履行/发货操作需平台超管身份（店主自营角色不具备 ReadOrder/OrderOperation 权限）
        await adminClient.asSuperAdmin();
        const detail = await adminClient.query(gql`
            query { order(id: "${orderId}") { lines { id quantity } } }
        `) as any;
        const line = detail.order.lines[0];
        const fulfillment = await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${line.id}", quantity: ${line.quantity} }]
                    handler: { code: "manual-fulfillment" arguments: [
                        { name: "method", value: "standard" }
                        { name: "trackingCode", value: "SF001" }
                    ] }
                }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
            }
        `) as any;
        const fulfillmentId = fulfillment.addFulfillmentToOrder.id;
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Delivered") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } } }
        `);
        return { orderId, lineId: line.id };
    }

    async function createReview(client: SimpleGraphQLClient, lineId: string, content = '真不错，值得购买'): Promise<any> {
        const res = await client.query(gql`
            mutation {
                createReview(input: { productId: "${myProductId}", orderLineId: "${lineId}", rating: 5, content: "${content}" }) {
                    id status parentId rating content
                }
            }
        `) as any;
        return res.createReview;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

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
        await setPricesIncludeTax();

        const taxCats = await adminClient.query(gql`
            query { taxCategories { items { id } } }
        `) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;

        // 归属我店的商品 + 归属他人店的商品 + 两个店铺
        const mine = await createProduct('我的商品', 'my-product', taxCategoryId);
        myProductId = mine.id;
        myVariantId = mine.variantId;
        const other = await createProduct('他人商品', 'other-product', taxCategoryId);
        otherProductId = other.id;
        otherVariantId = other.variantId;

        shopAId = await createShop('甲店', 'jia');
        await setStatus(shopAId, 'active');
        await provision(shopAId, 'owner1@test.com');

        shopBId = await createShop('乙店', 'yi');
        await setStatus(shopBId, 'active');
        await assign(shopBId, [otherProductId]);
        await provision(shopBId, 'owner2@test.com');

        // 店主 A 登录并将我的商品归属到自己店铺
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        await adminClient.query(gql`
            mutation { addProductToMyShop(productId: "${myProductId}") }
        `);
        return;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；无店主权限/无归属店铺时 myShop 报错', async () => {
        expect(server.app).toBeDefined();

        // 平台超级管理员：虽有管理员身份，但无 ManageOwnShop 权限 → Forbidden
        await adminClient.asSuperAdmin();
        await assertThrowsWithMessage(() => myShopQuery(adminClient), 'not authorized');

        // 有 shop-owner 角色但未绑定任何店铺的店主 → 归属解析为空 → Forbidden
        const roles = await adminClient.query(gql`
            query { roles { items { id code } } }
        `) as any;
        const ownerRole = roles.roles.items.find((r: any) => r.code === 'shop-owner');
        expect(ownerRole).toBeDefined();
        await adminClient.query(gql`
            mutation {
                createAdministrator(input: {
                    firstName: "Orphan", lastName: "Owner", emailAddress: "orphan@test.com",
                    password: "test", roleIds: ["${ownerRole.id}"]
                }) { id }
            }
        `);
        await adminClient.asUserWithCredentials('orphan@test.com', 'test');
        await assertThrowsWithMessage(() => myShopQuery(adminClient), 'not authorized');

        // 切回店主 A（已绑定甲店）
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
    });

    it('店主登录可达本人店铺 myShop：返回甲店档案', async () => {
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        const shop = await myShopQuery(adminClient);
        expect(shop.name).toBe('甲店');
        expect(shop.slug).toBe('jia');
        expect(shop.status).toBe('active');
    });

    it('store 信息更新 updateMyShop：改 name/description 生效，slug/status 不可变', async () => {
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        const res = await adminClient.query(gql`
            mutation {
                updateMyShop(input: { name: "甲店升级店", description: "全新升级" }) {
                    id name slug status description
                }
            }
        `) as any;
        expect(res.updateMyShop.name).toBe('甲店升级店');
        expect(res.updateMyShop.description).toBe('全新升级');
        expect(res.updateMyShop.slug).toBe('jia'); // slug 未被改
        expect(res.updateMyShop.status).toBe('active'); // status 未被改

        const shop = await myShopQuery(adminClient);
        expect(shop.name).toBe('甲店升级店');
    });

    it('商品自营：addProductToMyShop 可见 + updateMyShopProduct 改名生效 + removeProductFromMyShop 移出', async () => {
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');

        const list1 = await adminClient.query(gql`
            query { myShopProducts { totalItems items { id } } }
        `) as any;
        expect(list1.myShopProducts.items.map((p: any) => p.id)).toContain(myProductId);

        // 改名
        const upd = await adminClient.query(gql`
            mutation {
                updateMyShopProduct(productId: "${myProductId}", input: { name: "我的商品V2" }) {
                    id translations { languageCode name }
                }
            }
        `) as any;
        const enName = (upd.updateMyShopProduct.translations as any[]).find((t: any) => t.languageCode === 'en')?.name;
        expect(enName).toBe('我的商品V2');

        // 移出
        await adminClient.query(gql`
            mutation { removeProductFromMyShop(productId: "${myProductId}") }
        `);
        const list2 = await adminClient.query(gql`
            query { myShopProducts { totalItems items { id } } }
        `) as any;
        expect(list2.myShopProducts.items.map((p: any) => p.id)).not.toContain(myProductId);

        // 重新归属供后续订单/评价用例使用
        await adminClient.query(gql`
            mutation { addProductToMyShop(productId: "${myProductId}") }
        `);
    });

    it('越权隔离：店主无法访问全局 products；无法读/改他人店商品', async () => {
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');

        // 全局商品列表（核心 admin products query）无权限 → Forbidden
        await assertThrowsWithMessage(
            () => adminClient.query(gql` query { products(options: { take: 3 }) { items { id } } } `),
            'not authorized',
        );

        // myShopProducts 仅含我店商品，不含他人店商品
        const list = await adminClient.query(gql`
            query { myShopProducts { items { id } } }
        `) as any;
        const ids = list.myShopProducts.items.map((p: any) => p.id);
        expect(ids).toContain(myProductId);
        expect(ids).not.toContain(otherProductId);
    });

    it('订单投影隔离：混合订单仅暴露我店行', async () => {
        // 匿名用户下单含「我的商品」+「他人商品」两行
        await shopClient.asAnonymousUser();
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${myVariantId}", quantity: 1) { ... on Order { id } } }
        `);
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${otherVariantId}", quantity: 1) { ... on Order { id } } }
        `);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);

        // 店主 A：该订单出现在 myShopOrders，且 items 仅含「我的商品」行
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        const ordersA = await myShopOrders();
        const mixedA = ordersA.find(o => o.items.length === 1 && o.items[0].productId === myProductId);
        expect(mixedA).toBeDefined();
        expect(mixedA.items.map((i: any) => i.productId)).toEqual([myProductId]);
        expect(mixedA.items.map((i: any) => i.productId)).not.toContain(otherProductId);

        // 店主 B：同一订单 items 仅含「他人商品」行（互不泄露）
        await adminClient.asUserWithCredentials('owner2@test.com', 'test');
        const ordersB = await myShopOrders();
        const mixedB = ordersB.find(o => o.orderId === mixedA.orderId);
        expect(mixedB).toBeDefined();
        expect(mixedB.items.map((i: any) => i.productId)).toEqual([otherProductId]);
        expect(mixedB.items.map((i: any) => i.productId)).not.toContain(myProductId);

        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
    });

    it('评价审核：店主可审核本人商品评价，越权审核他人商品评价被拒', async () => {
        // 顾客登录、对「我的商品」下单送达并评价（pending）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const { orderId, lineId } = await deliverOrder(shopClient, myVariantId);
        const review = await createReview(shopClient, lineId);
        expect(review.status).toBe('pending');

        // 店主 A myShopReviews 列出该 pending 评价
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        const list = await adminClient.query(gql`
            query { myShopReviews { reviewId productId productName rating content status } }
        `) as any;
        const mine = list.myShopReviews.find((r: any) => r.reviewId === review.id);
        expect(mine).toBeDefined();
        expect(mine.productId).toBe(myProductId);
        expect(mine.status).toBe('pending');

        // 审核通过 → 状态 approved + 商品评分聚合写回（productRating 为 shop-api 公开查询）
        await adminClient.query(gql`
            mutation { approveMerchantReview(id: "${review.id}") }
        `);
        const r = await shopClient.query(gql`
            query { productRating(productId: "${myProductId}") { rating reviewCount } }
        `) as any;
        expect(r.productRating.reviewCount).toBe(1);
        expect(r.productRating.rating).toBe(5);

        // 顾客对「他人商品」下单送达并评价（pending）
        const { orderId: o2, lineId: line2 } = await deliverOrder(shopClient, otherVariantId);
        const review2 = await shopClient.query(gql`
            mutation {
                createReview(input: { productId: "${otherProductId}", orderLineId: "${line2}", rating: 4, content: "他人的也不错" }) {
                    id status
                }
            }
        `) as any;

        // 店主 A 审核他人商品评价 → Forbidden（review.productId 不在我店商品）
        await assertThrowsWithMessage(
            () => adminClient.query(gql` mutation { rejectMerchantReview(id: "${review2.createReview.id}") } `),
            'not authorized',
        );
    });

    it('关闭店铺冻结店主后台；重新 active 恢复', async () => {
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        expect((await myShopQuery(adminClient)).status).toBe('active');

        // 平台封店
        await adminClient.asSuperAdmin();
        await setStatus(shopAId, 'closed');
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        await assertThrowsWithMessage(() => myShopQuery(adminClient), 'not authorized');

        // 重开恢复
        await adminClient.asSuperAdmin();
        await setStatus(shopAId, 'active');
        await adminClient.asUserWithCredentials('owner1@test.com', 'test');
        const shop = await myShopQuery(adminClient);
        expect(shop.status).toBe('active');
    });
});