import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { ReviewPlugin } from '../src/plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('ReviewPlugin · 商品评价体系（评价/追评/修改/删除/评分聚合/防刷评/匿名）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ReviewPlugin.init({ minContentLength: 5, autoApprove: false })],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let productId: string;
    let variantId: string;
    let mainCustomerId: string;
    let secondClient: SimpleGraphQLClient;

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

    async function resetActiveOrder(client: SimpleGraphQLClient): Promise<void> {
        const res = await client.query(gql`
            query { activeOrder { id } }
        `) as any;
        if (res.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${res.activeOrder.id}" }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                } }
            `);
        }
    }

    async function buyItem(client: SimpleGraphQLClient): Promise<any> {
        await resetActiveOrder(client);
        const res = await client.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        return res.addItemToOrder;
    }

    async function cancelActive(client: SimpleGraphQLClient): Promise<void> {
        await resetActiveOrder(client);
    }

    /** 加购→支付→送达，返回送达订单的首个可评价 orderLineId。 */
    async function deliverOrder(client: SimpleGraphQLClient): Promise<{ orderId: string; lineId: string }> {
        const o = await buyItem(client);
        const orderId = await proceedToArrangingPayment(client);
        await addPaymentToOrder(client, singleStageRefundablePaymentMethod);
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
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Delivered") { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        return { orderId, lineId: line.id };
    }

    async function createReview(
        client: SimpleGraphQLClient,
        lineId: string,
        overrides: Record<string, unknown> = {},
    ): Promise<any> {
        const { rating = 5, content = '真不错，值得购买', isAnonymous = false } = overrides;
        const res = await client.query(gql`
            mutation {
                createReview(input: {
                    productId: "${productId}"
                    orderLineId: "${lineId}"
                    rating: ${rating}
                    content: "${content}"
                    isAnonymous: ${isAnonymous}
                }) { id status parentId rating content }
            }
        `) as any;
        return res.createReview;
    }

    async function createFollowUp(client: SimpleGraphQLClient, reviewId: string): Promise<any> {
        const res = await client.query(gql`
            mutation {
                createFollowUpReview(reviewId: "${reviewId}", input: {
                    content: "用了一周再来追评，很稳定"
                }) { id status parentId }
            }
        `) as any;
        return res.createFollowUpReview;
    }

    async function approve(reviewId: string): Promise<void> {
        await adminClient.query(gql`
            mutation { approveReview(id: "${reviewId}") { id status } }
        `);
    }

    async function productRating(): Promise<any> {
        const res = await shopClient.query(gql`
            query { productRating(productId: "${productId}") { rating reviewCount } }
        `) as any;
        return res.productRating;
    }

    async function productReviews(): Promise<any> {
        const res = await shopClient.query(gql`
            query { productReviews(productId: "${productId}", options: { take: 20 }) {
                totalItems
                items {
                    id rating content status parentId
                    customerId customerName
                    followUps { id rating content }
                }
            } }
        `) as any;
        return res.productReviews;
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

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        productId = products.products.items[0].id;
        variantId = products.products.items[0].variants[0].id;

        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`
            query { activeCustomer { id emailAddress } }
        `) as any;
        mainCustomerId = me.activeCustomer.id;

        // 第二个用户（用于越权校验）
        const second = await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Second", lastName: "User", emailAddress: "second.review@test.com" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `) as any;
        expect(second.createCustomer.id).toBeDefined();
        secondClient = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await secondClient.asUserWithCredentials('second.review@test.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；商品默认评分 0/0', async () => {
        expect(server.app).toBeDefined();
        const r = await productRating();
        expect(r.rating).toBe(0);
        expect(r.reviewCount).toBe(0);
    });

    it('评价订单商品：送达后可建（pending、未审核不对外）；重复评价被拦截', async () => {
        const { lineId } = await deliverOrder(shopClient);
        const review = await createReview(shopClient, lineId);
        expect(review.status).toBe('pending');

        // pending 未计入聚合、商品列表不对外
        const pr = await productRating();
        expect(pr.reviewCount).toBe(0);
        const list = await productReviews();
        expect(list.totalItems).toBe(0);

        // 幂等：同一 orderLine 只允许一条
        await assertThrowsWithMessage(() => createReview(shopClient, lineId), 'already reviewed');

        // 返回主评 id 供后续用例使用
        (globalThis as any).__mainReviewId = review.id;
    });

    it('屏蔽刷评：未送达订单不可评价、他人 orderLine 不可评价、内容过短拦截', async () => {
        // 未送达：仅加购不送达 → 不可评价
        await buyItem(shopClient);
        const activeRes = await shopClient.query(gql`
            query { activeOrder { lines { id } } }
        `) as any;
        const undeliveredLine = activeRes.activeOrder.lines[0].id;
        await assertThrowsWithMessage(
            () => createReview(shopClient, undeliveredLine),
            'Order must be delivered',
        );
        await cancelActive(shopClient);

        // 他人 orderLine：second 用户评价 hayden 的已送达行 → Forbidden
        const { lineId } = await deliverOrder(shopClient);
        await assertThrowsWithMessage(() => createReview(secondClient, lineId), 'not authorized');

        // 内容过短（minContentLength=5）
        await assertThrowsWithMessage(
            () => createReview(shopClient, lineId, { content: 'abc' }),
            'at least 5 characters',
        );
    });

    it('审核通过后对外可见 + 评分聚合写入商品', async () => {
        const reviewId = (globalThis as any).__mainReviewId as string;
        await approve(reviewId);

        const list = await productReviews();
        expect(list.totalItems).toBe(1);
        expect(list.items[0].status).toBe('approved');
        expect(list.items[0].parentId).toBeNull();

        const pr = await productRating();
        expect(pr.reviewCount).toBe(1);
        expect(pr.rating).toBe(5);
    });

    it('追评：挂主评下不增加聚合条数', async () => {
        const reviewId = (globalThis as any).__mainReviewId as string;
        const fu = await createFollowUp(shopClient, reviewId);
        expect(fu.status).toBe('pending');
        expect(fu.parentId).toBe(reviewId);
        await approve(fu.id);

        // 追评出现在主评 followUps，但聚合/列表条数不变（只统计主评）
        const list = await productReviews();
        expect(list.totalItems).toBe(1);
        expect(list.items[0].followUps.length).toBe(1);

        const pr = await productRating();
        expect(pr.reviewCount).toBe(1);
        expect(pr.rating).toBe(5);
    });

    it('修改：作者改评分聚合随之变化；非作者改被判 Forbidden', async () => {
        const reviewId = (globalThis as any).__mainReviewId as string;
        const res = await shopClient.query(gql`
            mutation { updateReview(id: "${reviewId}", input: { rating: 3, content: "降价后性价比不错" }) { id rating content } }
        `) as any;
        expect(res.updateReview.rating).toBe(3);

        const pr = await productRating();
        expect(pr.reviewCount).toBe(1);
        expect(pr.rating).toBe(3);

        // 非作者 Update → Forbidden
        await assertThrowsWithMessage(
            () => secondClient.query(gql`
                mutation { updateReview(id: "${reviewId}", input: { content: "hack" }) { id } }
            `),
            'not authorized',
        );
    });

    it('删除：作者删后列表/聚合剔除；非作者删被 Forbidden', async () => {
        const reviewId = (globalThis as any).__mainReviewId as string;

        await assertThrowsWithMessage(
            () => secondClient.query(gql`
                mutation { deleteReview(id: "${reviewId}") }
            `),
            'not authorized',
        );

        const del = await shopClient.query(gql`
            mutation { deleteReview(id: "${reviewId}") }
        `) as any;
        expect(del.deleteReview).toBe(true);

        const list = await productReviews();
        expect(list.totalItems).toBe(0);

        const pr = await productRating();
        expect(pr.reviewCount).toBe(0);
        expect(pr.rating).toBe(0);
    });

    it('匿名：customerName 脱敏为 null，但评分正常计入聚合', async () => {
        const { lineId } = await deliverOrder(shopClient);
        const review = await createReview(shopClient, lineId, { rating: 4, isAnonymous: true });
        await approve(review.id);

        const list = await productReviews();
        expect(list.totalItems).toBe(1);
        // customerName 仅登录态解析，匿名返回 null
        expect(list.items[0].customerName).toBeNull();

        const pr = await productRating();
        expect(pr.reviewCount).toBe(1);
        expect(pr.rating).toBe(4);
    });
});