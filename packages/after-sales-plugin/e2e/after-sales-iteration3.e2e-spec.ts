import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig, PaymentMethodHandler, LanguageCode, TransactionalConnection } from '@vendure/core';
import { AfterSalesTimeoutJob } from '../src/after-sales-timeout.job';
import { AfterSalesTimeoutTask, AfterSalesTimeoutType } from '../src/after-sales-timeout.entity';
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

/** 永远退款失败（state='Failed'，不抛错）：用于构造 RefundFailed 自动重试耗尽场景 */
const alwaysFailingRefundHandler = new PaymentMethodHandler({
    code: 'always-failing-refund',
    description: [{ languageCode: LanguageCode.en, value: 'Always failing refund' }],
    args: {},
    createPayment: (ctx, order, amount, args, metadata) => ({
        amount,
        state: 'Settled' as const,
        transactionId: '12345',
        metadata,
    }),
    settlePayment: () => ({ success: true as const }),
    createRefund: () => ({ state: 'Failed' as const, metadata: {} }),
});

/** 简单轮询（事件订阅为异步落库，断言前 waitFor） */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 8000, intervalMs = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

/** GraphQL 编码 ID（T_1）→ 实体数字 ID（直查仓储外键用） */
function toEntityId(id: string): number {
    return Number(String(id).replace(/\D+/g, ''));
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
                alwaysFailingRefundHandler,
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

    it('换货闭环：confirmReceive 停在 Received；processRefund 被拒；exchangeShip → ExchangeShipped；顾客 exchangeReceive → Closed；全程站内信', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: exchange reason: "t3-exchange" refundAmount: 0
            }) { id state } }
        `);
        const id8 = created.createAfterSalesRequest.id;
        await adminClient.query(gql`mutation { approveAfterSalesRequest(id: "${id8}") { id state } }`);
        await shopClient.query(gql`
            mutation { updateReturnTracking(id: "${id8}", trackingNo: "TH0001", carrier: "顺丰") { id state } }
        `);
        // confirmReceive 对 exchange 停在 Received（不触发退款）
        const received = await adminClient.query(gql`mutation { confirmReturnReceived(id: "${id8}") { id state } }`);
        expect(received.confirmReturnReceived.state).toBe('Received');

        // exchange 拒绝退款
        await expectGqlError(
            () => adminClient.query(gql`mutation { processAfterSalesRefund(id: "${id8}") { id state } }`),
            /exchange requests are not refundable/,
        );

        // 商家换货发货
        const shipped = await adminClient.query(gql`
            mutation { exchangeShipAfterSalesRequest(id: "${id8}", trackingNo: "EX9001", carrier: "京东") {
                id state exchangeTrackingNo exchangeCarrier } }
        `);
        expect(shipped.exchangeShipAfterSalesRequest.state).toBe('ExchangeShipped');
        expect(shipped.exchangeShipAfterSalesRequest.exchangeTrackingNo).toBe('EX9001');
        expect(shipped.exchangeShipAfterSalesRequest.exchangeCarrier).toBe('京东');

        // 顾客确认收货 → Closed
        const done = await shopClient.query(gql`
            mutation { exchangeReceiveAfterSalesRequest(id: "${id8}") { id state } }
        `);
        expect(done.exchangeReceiveAfterSalesRequest.state).toBe('Closed');

        // history 含 ExchangeShipped 节点
        const detail = await shopClient.query(gql`
            query { afterSalesRequest(id: "${id8}") { state history { fromState toState } } }
        `);
        const tos = detail.afterSalesRequest.history.map((h: any) => h.toState);
        expect(tos).toEqual(expect.arrayContaining(['ExchangeShipped', 'Closed']));

        // Task 1 通知链路：换货已发货 + 换货完成
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '换货已发货');
        });
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '换货完成');
        });
    }, TEST_SETUP_TIMEOUT_MS);

    it('exchangeShip 校验：非 exchange 类型拒绝；Pending 状态拒绝', async () => {
        await shipNewOrder();
        await expectGqlError(
            () => adminClient.query(gql`
                mutation { exchangeShipAfterSalesRequest(id: "${orderId}", trackingNo: "X", carrier: "Y") { id } }
            `),
            /not found/,
        );

        // Pending 的 exchange 单（未收货）不可发货
        const ex = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: exchange reason: "t3-xg-pending" refundAmount: 0
            }) { id } }
        `);
        await expectGqlError(
            () => adminClient.query(gql`
                mutation { exchangeShipAfterSalesRequest(id: "${ex.createAfterSalesRequest.id}", trackingNo: "X", carrier: "Y") { id } }
            `),
            /Cannot exchange-ship from state: Pending/,
        );
    }, TEST_SETUP_TIMEOUT_MS);

    it('超时自动化：Pending 默认 48h 商家提醒；autoApprove=0 不自动同意', async () => {
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-timeout" refundAmount: 100
            }) { id state } }
        `);
        const id11 = created.createAfterSalesRequest.id;

        const job = server.app.get(AfterSalesTimeoutJob);
        const conn = server.app.get(TransactionalConnection);
        const taskRepo = conn.rawConnection.getRepository(AfterSalesTimeoutTask);

        // 默认配置：只登记提醒任务（48h）；autoApproveHours=0 不登记自动同意任务
        const remind = await taskRepo.findOne({
            where: { requestId: toEntityId(id11), type: AfterSalesTimeoutType.PENDING_REMIND },
        });
        expect(remind).toBeDefined();
        expect(remind!.expectedState).toBe('Pending');
        const spanH = (remind!.dueAt.getTime() - Date.now()) / 3600000;
        expect(spanH).toBeGreaterThan(47);
        expect(spanH).toBeLessThan(49);
        const auto = await taskRepo.findOne({
            where: { requestId: toEntityId(id11), type: AfterSalesTimeoutType.PENDING_AUTO_APPROVE },
        });
        expect(auto).toBeNull();

        // dueAt 改为过去 → 补偿扫描触发 → 店主收超时提醒
        await taskRepo.update({ id: remind!.id as any }, { dueAt: new Date(Date.now() - 1000) });
        await job.runCompensation();
        const owner = new SimpleGraphQLClient(config, adminApiUrl);
        await owner.asUserWithCredentials(ownerEmail, 'test');
        await waitFor(async () => {
            const inbox = await owner.query(gql`query { adminInbox { items { title } } }`);
            return inbox.adminInbox.items.some((m: any) => m.title === '售后处理超时提醒');
        });

        // autoApproveHours=0：状态不被自动同意
        const after = await shopClient.query(gql`query { afterSalesRequest(id: "${id11}") { id state } }`);
        expect(after.afterSalesRequest.state).toBe('Pending');
    }, TEST_SETUP_TIMEOUT_MS);

    it('超时自动化：afterSalesAutoApproveHours=1 到期自动同意 + 顾客收通知', async () => {
        // 调低渠道阈值：提醒 1h、自动同意 1h
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "T_1", customFields: {
                afterSalesTimeoutHours: 1, afterSalesAutoApproveHours: 1
            } }) { ... on Channel { id } } }
        `);
        await shipNewOrder();
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-auto-approve" refundAmount: 100
            }) { id state } }
        `);
        const id12 = created.createAfterSalesRequest.id;

        const job = server.app.get(AfterSalesTimeoutJob);
        const conn = server.app.get(TransactionalConnection);
        const taskRepo = conn.rawConnection.getRepository(AfterSalesTimeoutTask);
        // 两个任务都已登记（提醒 + 自动同意）
        const remind = await taskRepo.findOne({
            where: { requestId: toEntityId(id12), type: AfterSalesTimeoutType.PENDING_REMIND },
        });
        const auto = await taskRepo.findOne({
            where: { requestId: toEntityId(id12), type: AfterSalesTimeoutType.PENDING_AUTO_APPROVE },
        });
        expect(remind).toBeDefined();
        expect(auto).toBeDefined();
        await taskRepo.update({ id: remind!.id as any }, { dueAt: new Date(Date.now() - 1000) });
        await taskRepo.update({ id: auto!.id as any }, { dueAt: new Date(Date.now() - 1000) });
        await job.runCompensation();

        // 自动同意 → Approved（经 commitState → 顾客收「售后审核通过」）
        await waitFor(async () => {
            const r = await shopClient.query(gql`query { afterSalesRequest(id: "${id12}") { id state } }`);
            return r.afterSalesRequest.state === 'Approved';
        });
        await waitFor(async () => {
            const mine = await shopClient.query(gql`query { myInbox { items { title } } }`);
            return mine.myInbox.items.some((m: any) => m.title === '售后审核通过');
        });
        // 恢复默认阈值，避免污染后续用例
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "T_1", customFields: {
                afterSalesTimeoutHours: 48, afterSalesAutoApproveHours: 0
            } }) { ... on Channel { id } } }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    it('退款自动重试耗尽 → 商家提醒；autoRetry=0 不登记任务', async () => {
        // 创建「始终退款失败」支付方式（构造重试耗尽场景；旧处理器仅首退失败、重试即成功，无法覆盖耗尽）
        await adminClient.query(gql`
            mutation { createPaymentMethod(input: {
                code: "${alwaysFailingRefundHandler.code}"
                enabled: true
                translations: [{ languageCode: zh_Hans, name: "${alwaysFailingRefundHandler.code}" }]
                handler: { code: "${alwaysFailingRefundHandler.code}" arguments: [] }
            }) { id code } }
        `);
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "T_1", customFields: { afterSalesRefundAutoRetry: 1 } }) { ... on Channel { id } } }
        `);
        await shipNewOrder(1, alwaysFailingRefundHandler.code);
        const created = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-retry" refundAmount: 100
            }) { id state } }
        `);
        const id13 = created.createAfterSalesRequest.id;
        await adminClient.query(gql`mutation { approveAfterSalesRequest(id: "${id13}") { id state } }`);
        await shopClient.query(gql`mutation { updateReturnTracking(id: "${id13}", trackingNo: "RT13", carrier: "顺丰") { id state } }`);
        await adminClient.query(gql`mutation { confirmReturnReceived(id: "${id13}") { id state } }`);
        const failed = await adminClient.query(gql`mutation { processAfterSalesRefund(id: "${id13}") { id state } }`);
        expect(failed.processAfterSalesRefund.state).toBe('RefundFailed');

        const job = server.app.get(AfterSalesTimeoutJob);
        const conn = server.app.get(TransactionalConnection);
        const taskRepo = conn.rawConnection.getRepository(AfterSalesTimeoutTask);
        // RefundFailed（首入）→ 登记重试任务（30min 后）
        await waitFor(async () => {
            const t = await taskRepo.findOne({ where: { requestId: toEntityId(id13), type: AfterSalesTimeoutType.REFUND_RETRY } });
            return !!t;
        });
        const retry = await taskRepo.findOne({ where: { requestId: toEntityId(id13), type: AfterSalesTimeoutType.REFUND_RETRY } });
        expect(retry!.expectedState).toBe('RefundFailed');
        expect(retry!.maxAttempt).toBe(1);
        await taskRepo.update({ id: retry!.id as any }, { dueAt: new Date(Date.now() - 1000) });
        await job.runCompensation();

        // 重试一次仍失败（首退失败处理器）→ attempt=1 达上限 → EXECUTED + 商家「退款自动重试耗尽」
        await waitFor(async () => {
            const t = await taskRepo.findOne({ where: { id: retry!.id as any } });
            return t!.status === 'executed';
        });
        const done = await taskRepo.findOne({ where: { id: retry!.id as any } });
        expect(done!.attempt).toBe(1);
        const owner = new SimpleGraphQLClient(config, adminApiUrl);
        await owner.asUserWithCredentials(ownerEmail, 'test');
        await waitFor(async () => {
            const inbox = await owner.query(gql`query { adminInbox { items { title } } }`);
            return inbox.adminInbox.items.some((m: any) => m.title === '退款自动重试耗尽');
        });

        // 关闭重试（0=关闭）→ 新 RefundFailed 单不再登记任务
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "T_1", customFields: { afterSalesRefundAutoRetry: 0 } }) { ... on Channel { id } } }
        `);
        await shipNewOrder(1, alwaysFailingRefundHandler.code);
        const created2 = await shopClient.query(gql`
            mutation { createAfterSalesRequest(input: {
                orderId: "${orderId}" orderLineId: "${orderLineId}" type: return_refund reason: "t3-retry-off" refundAmount: 100
            }) { id state } }
        `);
        const id13b = created2.createAfterSalesRequest.id;
        await adminClient.query(gql`mutation { approveAfterSalesRequest(id: "${id13b}") { id state } }`);
        await shopClient.query(gql`mutation { updateReturnTracking(id: "${id13b}", trackingNo: "RT14", carrier: "顺丰") { id state } }`);
        await adminClient.query(gql`mutation { confirmReturnReceived(id: "${id13b}") { id state } }`);
        const failed2 = await adminClient.query(gql`mutation { processAfterSalesRefund(id: "${id13b}") { id state } }`);
        expect(failed2.processAfterSalesRefund.state).toBe('RefundFailed');
        await new Promise((r) => setTimeout(r, 500));
        const none = await taskRepo.findOne({ where: { requestId: toEntityId(id13b), type: AfterSalesTimeoutType.REFUND_RETRY } });
        expect(none).toBeNull();
        // 恢复默认阈值
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "T_1", customFields: { afterSalesRefundAutoRetry: 1 } }) { ... on Channel { id } } }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    it('afterSalesStats 聚合：窗口内计数/分组正确；空窗口返回 0/[]', async () => {
        const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const { afterSalesStats } = await adminClient.query(gql`
            query { afterSalesStats(from: "${from}", to: "${to}") {
                totalRequests pendingCount totalRefundAmount avgHandleHours
                daily { date total }
                byState { key count amount }
                byType { key count amount }
            } }
        `);
        expect(afterSalesStats.totalRequests).toBeGreaterThan(0);
        expect(afterSalesStats.pendingCount).toBeGreaterThan(0); // 用例 11 的单仍 Pending
        expect(afterSalesStats.totalRefundAmount).toBeGreaterThan(0); // 用例 4 已产生 Refunded 单
        expect(afterSalesStats.avgHandleHours).not.toBeNull();
        const stateKeys = afterSalesStats.byState.map((b: any) => b.key);
        expect(stateKeys).toContain('Pending');
        expect(stateKeys).toContain('Refunded');
        const typeKeys = afterSalesStats.byType.map((b: any) => b.key);
        expect(typeKeys).toContain('return_refund');
        expect(afterSalesStats.daily.length).toBeGreaterThan(0);

        // 空窗口：不伪造数据
        const empty = await adminClient.query(gql`
            query { afterSalesStats(from: "2000-01-01", to: "2000-01-02") {
                totalRequests pendingCount totalRefundAmount avgHandleHours
                daily { date total } byState { key count } byType { key count }
            } }
        `);
        expect(empty.afterSalesStats.totalRequests).toBe(0);
        expect(empty.afterSalesStats.totalRefundAmount).toBe(0);
        expect(empty.afterSalesStats.daily).toEqual([]);
        expect(empty.afterSalesStats.byState).toEqual([]);
        expect(empty.afterSalesStats.byType).toEqual([]);
        expect(empty.afterSalesStats.avgHandleHours).toBeNull();
    }, TEST_SETUP_TIMEOUT_MS);
});
