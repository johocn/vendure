import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { AfterSalesPlugin } from '../src/plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { LogisticsPlugin } from '@vendure/logistics-plugin';
// notification-plugin 的 lib 是旧编译产物（不含售后事件订阅），必须从源码导入（与 notification.e2e-spec.ts 同模式）
import { NotificationPlugin } from '../../notification-plugin/src/plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import {
    singleStageRefundFailingPaymentMethod,
    singleStageRefundablePaymentMethod,
} from '../../core/e2e/fixtures/test-payment-methods';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data3__')));

/** 简单轮询（事件订阅为异步落库，断言前 waitFor） */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 8000, intervalMs = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

/** 断言 GraphQL 操作抛错且文案匹配（宽松子串，SimpleGraphQLClient 把 GraphQL error 拼进 Error.message） */
async function expectGqlError(fn: () => Promise<any>, pattern: RegExp): Promise<void> {
    let threw = false;
    try {
        await fn();
    } catch (e: any) {
        threw = true;
        expect(String(e?.message ?? e)).toMatch(pattern);
    }
    expect(threw).toBe(true);
}

describe('AfterSalesPlugin · 迭代三期（通知/留言/换货/超时/看板）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            AfterSalesPlugin.init(),
            NotificationPlugin.init(),
            InventoryPlugin.init(),
            LogisticsPlugin.init(),
            ShopPlugin.init({}),
        ],
        paymentOptions: {
            paymentMethodHandlers: [
                singleStageRefundablePaymentMethod,
                singleStageRefundFailingPaymentMethod,
            ],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);
    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;

    let variantId: string;
    let orderId: string;
    let orderLineId: string;
    let asId: string;
    let ownerEmail: string;

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: singleStageRefundablePaymentMethod.code,
                        handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // 店主 + 店铺 + 商品归属（商家站内信收件人 = Shop.administratorId）
        const shopName = `shop-${Date.now()}`;
        const s = await adminClient.query(gql`
            mutation { createShop(input: { name: "${shopName}", slug: "${shopName}", description: "t3" }) { id name slug } }
        `);
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${s.createShop.id}", status: "active") { id status } }
        `);
        ownerEmail = `owner-${Date.now()}@test.com`;
        await adminClient.query(gql`
            mutation {
                provisionShopOwner(shopId: "${s.createShop.id}",
                    input: { emailAddress: "${ownerEmail}", password: "test", firstName: "店主", lastName: "三" }) { id }
            }
        `);
        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id sku } } } }
        `);
        const productId = products.products.items[0].id;
        variantId = products.products.items[0].variants[0].id;
        await adminClient.query(gql`
            mutation { assignProductsToShop(input: { productIds: ["${productId}"], shopId: "${s.createShop.id}" }) }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /** 下单 → 支付 → 发货（Shipped），返回订单行 id。每次用新顾客：避免上一用例订单停在 Shipped（非 AddingItems）导致加购被拒 */
    async function shipNewOrder(quantity = 1, paymentCode = singleStageRefundablePaymentMethod.code): Promise<void> {
        const email = `t3-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
        await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "T", lastName: "3", emailAddress: "${email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `);
        await shopClient.asUserWithCredentials(email, 'test');
        const added = await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: ${quantity}) {
                ... on Order { id } ... on ErrorResult { errorCode message } } }
        `);
        expect(added.addItemToOrder.id).toBeDefined();
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, { code: paymentCode } as any);
        orderId = paid.id;
        const detail = await adminClient.query(gql`
            query { order(id: "${orderId}") { id state lines { id quantity } } }
        `);
        const line = detail.order.lines[0];
        orderLineId = line.id;
        const f = await adminClient.query(gql`
            mutation { addFulfillmentToOrder(input: {
                lines: [{ orderLineId: "${orderLineId}", quantity: ${line.quantity} }]
                handler: { code: "manual-fulfillment" arguments: [
                    { name: "method", value: "standard" } { name: "trackingCode", value: "SF-T3" }] }
            }) { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${f.addFulfillmentToOrder.id}", state: "Shipped") { ... on Fulfillment { id state } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }
        `);
        const after = await adminClient.query(gql`query { order(id: "${orderId}") { id state } }`);
        expect(after.order.state).toBe('Shipped');
    }

    /** 店主客户端（admin API，查商家收件箱） */
    async function ownerClient(): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(ownerEmail, 'test');
        return c;
    }

    it('插件可加载', () => {
        expect(server.app).toBeDefined();
    });

    it('新建售后 → 店主收「新售后待处理」；approve → 顾客收「售后审核通过」', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-notify" refundAmount: 100
            }) { id state } }
        `);
        asId = created.createAfterSalesRequest.id;
        expect(created.createAfterSalesRequest.state).toBe('Pending');

        // 店主侧
        const owner = await ownerClient();
        await waitFor(async () => {
            const inbox = await owner.query(gql`query { adminInbox { items { scene title link } } }`);
            return inbox.adminInbox.items.some((m: any) => m.scene === 'after_sales' && m.title === '新售后待处理');
        });
        const inbox = await owner.query(gql`query { adminInbox { items { scene title content link } } }`);
        const msg = inbox.adminInbox.items.find((m: any) => m.title === '新售后待处理');
        expect(msg.link).toBe(`/after-sale/detail?id=${asId.replace(/^T_/, '')}`);

        // 顾客侧：approve → 审核通过
        await adminClient.query(gql`mutation { approveAfterSalesRequest(id: "${asId}") { id state } }`);
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { scene title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '售后审核通过');
        });
    }, TEST_SETUP_TIMEOUT_MS);

    it('reject → 顾客收「售后被拒绝」含原因摘要', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: { orderId: "${orderId}" type: refund_only reason: "t3-reject" refundAmount: 1 }) { id state } }
        `);
        const id2 = created.createAfterSalesRequest.id;
        await adminClient.query(gql`
            mutation { rejectAfterSalesRequest(id: "${id2}", reason: "凭证不足无法核实") { id state } }
        `);
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title content } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '售后被拒绝');
        });
        const mine = await shopClient.query(gql`query { myInbox { items { title content } } }`);
        const msg = mine.myInbox.items.find((m: any) => m.title === '售后被拒绝');
        expect(msg.content).toContain('凭证不足');
    }, TEST_SETUP_TIMEOUT_MS);

    it('updateReturnTracking → 店主收「顾客已寄回」；confirmReceive → 顾客收「商家已收货」；processRefund → 顾客收「退款已到账」', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-flow" refundAmount: 100
            }) { id state } }
        `);
        const id3 = created.createAfterSalesRequest.id;
        await adminClient.query(gql`mutation { approveAfterSalesRequest(id: "${id3}") { id state } }`);
        await shopClient.query(gql`
            mutation { updateReturnTracking(id: "${id3}", trackingNo: "SF999", carrier: "顺丰") { id state } }
        `);
        const owner = await ownerClient();
        await waitFor(async () => {
            const inbox = await owner.query(gql`query { adminInbox { items { title } } }`);
            return inbox.adminInbox.items.some((m: any) => m.title === '顾客已寄回');
        });
        await adminClient.query(gql`mutation { confirmReturnReceived(id: "${id3}") { id state } }`);
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '商家已收货');
        });
        await adminClient.query(gql`mutation { processAfterSalesRefund(id: "${id3}") { id state } }`);
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '退款已到账');
        });
    }, TEST_SETUP_TIMEOUT_MS);

    it('顾客主动取消 → Closed 不误发「换货完成」', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: { orderId: "${orderId}" type: refund_only reason: "t3-cancel" refundAmount: 1 }) { id state } }
        `);
        const id4 = created.createAfterSalesRequest.id;
        await shopClient.query(gql`mutation { cancelAfterSalesRequest(id: "${id4}") { id state } }`);
        await new Promise((r) => setTimeout(r, 500));
        const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
        expect(mine.myInbox.items.some((m: any) => m.title === '换货完成')).toBe(false);
    }, TEST_SETUP_TIMEOUT_MS);

    it('协商留言：顾客发 2 条 → 商家回复 1 条 → 正序 + messageCount=3', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-msg" refundAmount: 100
            }) { id state messageCount } }
        `);
        const id5 = created.createAfterSalesRequest.id;
        expect(created.createAfterSalesRequest.messageCount).toBe(0);

        await shopClient.query(gql`
            mutation { addAfterSalesMessage(id: "${id5}", content: "请问可以加快处理吗？") { id senderType senderName content } }
        `);
        await shopClient.query(gql`
            mutation { addAfterSalesMessage(id: "${id5}", content: "补充图片", images: ["https://cdn.example.com/a.png"]) { id images } }
        `);
        // 店主无 UpdateOrder 权限，商家回复以平台管理员身份验证（生产端由后台操作）
        const reply = await adminClient.query(gql`
            mutation { replyAfterSalesMessage(id: "${id5}", content: "已加急，24小时内处理") { id senderType senderName content } }
        `);
        expect(reply.replyAfterSalesMessage.senderType).toBe('admin');

        // 顾客端：正序 + messageCount
        const list = await shopClient.query(gql`
            query { afterSalesMessages(id: "${id5}") { totalItems items { senderType content images createdAt } } }
        `);
        expect(list.afterSalesMessages.totalItems).toBe(3);
        expect(list.afterSalesMessages.items[0].senderType).toBe('customer');
        expect(list.afterSalesMessages.items[2].senderType).toBe('admin');
        expect(list.afterSalesMessages.items[0].content).toBe('请问可以加快处理吗？');
        const detail = await shopClient.query(gql`query { afterSalesRequest(id: "${id5}") { id messageCount } }`);
        expect(detail.afterSalesRequest.messageCount).toBe(3);

        // Admin 端同名 query（含回复人姓名）
        const adminList = await adminClient.query(gql`
            query { afterSalesMessages(id: "${id5}") { totalItems items { senderType senderName content } } }
        `);
        expect(adminList.afterSalesMessages.totalItems).toBe(3);
        expect(adminList.afterSalesMessages.items[2].senderType).toBe('admin');
        expect(adminList.afterSalesMessages.items[2].senderName).toBeTruthy();
    }, TEST_SETUP_TIMEOUT_MS);

    it('留言校验：图片 >3 拒绝；正文 >1000 拒绝；未登录拒绝', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: { orderId: "${orderId}" type: refund_only reason: "t3-msg-guard" refundAmount: 1 }) { id } }
        `);
        const id6 = created.createAfterSalesRequest.id;
        await expectGqlError(
            () => shopClient.query(gql`
                mutation { addAfterSalesMessage(id: "${id6}", content: "x", images: ["1", "2", "3", "4"]) { id } }
            `),
            /exceed limit of 3/,
        );
        await expectGqlError(
            () => shopClient.query(gql`
                mutation { addAfterSalesMessage(id: "${id6}", content: "${'长'.repeat(1001)}") { id } }
            `),
            /exceeds 1000 characters/,
        );
        const anon = new SimpleGraphQLClient(config, `http://localhost:${config.apiOptions.port}/shop-api`);
        await expectGqlError(
            () => anon.query(gql`mutation { addAfterSalesMessage(id: "${id6}", content: "anon") { id } }`),
            /not.*authorized|forbidden/i,
        );
    }, TEST_SETUP_TIMEOUT_MS);

    it('Closed 禁言 + 顾客越权读他人留言被拒', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: { orderId: "${orderId}" type: refund_only reason: "t3-msg-closed" refundAmount: 1 }) { id } }
        `);
        const id7 = created.createAfterSalesRequest.id;
        await shopClient.query(gql`mutation { cancelAfterSalesRequest(id: "${id7}") { id state } }`);
        await expectGqlError(
            () => shopClient.query(gql`mutation { addAfterSalesMessage(id: "${id7}", content: "还能改吗") { id } }`),
            /messaging disabled/,
        );

        // 第二位顾客越权读留言
        const customer2Email = `other-${Date.now()}@test.com`;
        await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "O", lastName: "T", emailAddress: "${customer2Email}" }, password: "test") {
                    ... on Customer { id emailAddress }
                }
            }
        `);
        const other = new SimpleGraphQLClient(config, `http://localhost:${config.apiOptions.port}/shop-api`);
        await other.asUserWithCredentials(customer2Email, 'test');
        await expectGqlError(
            () => other.query(gql`query { afterSalesMessages(id: "${id7}") { totalItems } }`),
            /not.*authorized|forbidden/i,
        );
    }, TEST_SETUP_TIMEOUT_MS);
});
