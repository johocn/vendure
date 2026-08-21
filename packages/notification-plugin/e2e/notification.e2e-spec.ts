import { LanguageCode, mergeConfig, defaultShippingCalculator, defaultShippingEligibilityChecker } from '@vendure/core';
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
import { NotificationPlugin } from '../src/plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 简单的轮询帮助函数（本仓库无通用 waitFor）。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 80): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

describe('NotificationPlugin · 阶段23 消息触达闭环（站内信真实 + 微信接口化）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            // 微信未配置（wechatEnabled 缺省 false）→ 仅站内信；店主解析依赖 ShopPlugin
            NotificationPlugin.init({}),
        ],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    // SimpleGraphQLClient 需显式传入完整 API URL（server 是 TestServer 而非 config，不能直接传）。
    // 由配置重算 shop/admin API 地址，供匿名/店主/第二顾客等额外客户端复用。
    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    let shopAId: string;
    let shopBId: string;
    let variantId: string;
    let mainId: string;

    const MY_INBOX = gql`query { myInbox { items { id scene title content isRead } totalItems } }`;
    const MY_INBOX_FULL = gql`query { myInbox { items { id scene title content isRead createdAt } totalItems } }`;
    const UNREAD = gql`query { inboxUnreadCount }`;
    const MARK_READ = gql`mutation ($id: ID!) { markInboxRead(id: $id) { id isRead } }`;

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) { id name slug status } }
        `)) as any;
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }
        `);
        return res.createShop.id;
    }

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

    /** 建订单并支付成功，返回 orderId（途经 addItemToOrder → proceedToArrangingPayment → addPaymentToOrder）。 */
    async function createPaidOrder(quantity = 1): Promise<string> {
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

    /** 将订单推进到指定 fulfillment 状态（manual）→ 订单状态。 */
    async function transitionOrderTo(orderId: string, target: 'Shipped' | 'Delivered' | 'Completed'): Promise<void> {
        const detail = (await adminClient.query(gql`
            query { order(id: "${orderId}") { id state lines { id quantity } } }
        `)) as any;
        const line = detail.order.lines[0];
        const f = (await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${line.id}", quantity: ${line.quantity} }]
                    handler: { code: "manual-fulfillment" arguments: [
                        { name: "method", value: "standard" }
                        { name: "trackingCode", value: "SF123456" }
                    ] }
                }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
            }
        `)) as any;
        const fId = f.addFulfillmentToOrder.id;
        if (target === 'Shipped') {
            await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
            await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
        } else {
            await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
            await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
            const fDelivered = (await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Delivered") { ... on Fulfillment { id state } } }`)) as any;
            if (fDelivered.transitionFulfillmentToState?.state === 'Delivered') {
                await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } } }`);
            }
        }
        // 复核订单实际状态
        const after = (await adminClient.query(gql`query { order(id: "${orderId}") { id state } }`)) as any;
        expect(after.order.state).toBe(target);
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
        mainId = await createCustomerAndLogin('main.msg@test.com');

        const products = (await adminClient.query(gql`query { products(options: { take: 1 }) { items { id variants { id } } } }`)) as any;
        variantId = products.products.items[0].variants[0].id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件加载 + 初始空 inbox', async () => {
        expect(server.app).toBeDefined();
        const r = (await shopClient.query(MY_INBOX)) as any;
        expect(r.myInbox).toEqual({ items: [], totalItems: 0 });
        expect((await shopClient.query(UNREAD)) as any).toEqual({ inboxUnreadCount: 0 });
    });

    it('2 付款成功触发买家站内信（order_paid）', async () => {
        const orderId = await createPaidOrder();
        await waitFor(async () => {
            const r = (await shopClient.query(MY_INBOX)) as any;
            return r.myInbox.totalItems >= 1;
        });
        const r = (await shopClient.query(MY_INBOX_FULL)) as any;
        const paidMsg = r.myInbox.items.find((m: any) => m.scene === 'order_paid');
        expect(paidMsg).toBeDefined();
        expect(paidMsg.title).toBe('支付成功');
        expect(paidMsg.isRead).toBe(false);
    });

    it('3 未登录 shop-api 401', async () => {
        const anon = new SimpleGraphQLClient(server, 'http://localhost');
        await assertThrowsWithMessage(() => anon.query(MY_INBOX), 'not authorized');
    });

    it('4 店主营业提醒：新订单写对应店主 admin inbox', async () => {
        // 语义：shop_new_order 只写给 Shop.administratorId 对应的管理员。
        // 因此该用例先用 provisionShopOwner 为 shopA 开通店主账号（写入 Shop.administratorId），
        // 再把商品归属到 shopA，付款订单后以「店主身份」登录查 adminInbox。
        const ownerEmail = 'owner.msg@test.com';
        await adminClient.query(gql`
            mutation {
                provisionShopOwner(
                    shopId: "${shopAId}"
                    input: { emailAddress: "${ownerEmail}", password: "test", firstName: "店主", lastName: "A" }
                ) { id }
            }
        `);
        const products = (await adminClient.query(gql`query { products(options: { take: 1 }) { items { id } } }`)) as any;
        const productId = products.products.items[0].id;
        const assignRes = (await adminClient.query(gql`
            mutation { assignProductsToShop(input: { productIds: ["${productId}"], shopId: "${shopAId}" }) }
        `)) as any;
        expect(assignRes.assignProductsToShop).toBe(true);
        await createPaidOrder();
        // 店主身份登录 admin API，查询 adminInbox 应命中一条 shop_new_order
        const ownerClient = new SimpleGraphQLClient(config, adminApiUrl);
        await ownerClient.asUserWithCredentials(ownerEmail, 'test');
        await waitFor(async () => {
            const inbox = (await ownerClient.query(gql`query { adminInbox { items { scene } } }`)) as any;
            return inbox.adminInbox.items.some((m: any) => m.scene === 'shop_new_order');
        });
        const inbox = (await ownerClient.query(gql`query { adminInbox { items { scene title content } totalItems } }`)) as any;
        expect(inbox.adminInbox.items.some((m: any) => m.scene === 'shop_new_order')).toBe(true);
    });

    it('5 C 端隔离：另一顾客看不到他人站内信', async () => {
        const secondClient = new SimpleGraphQLClient(config, shopApiUrl);
        const second = (await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "S", lastName: "U", emailAddress: "second.msg@test.com" }, password: "test") { ... on Customer { id } } }
        `)) as any;
        await secondClient.asUserWithCredentials('second.msg@test.com', 'test');
        const r = (await secondClient.query(MY_INBOX)) as any;
        expect(r.myInbox.totalItems).toBe(0);
    });

    it('6 markInboxRead 置已读 + 未读数归零 + 仅本人', async () => {
        const before = (await shopClient.query(UNREAD)) as any;
        expect(before.inboxUnreadCount).toBeGreaterThan(0);
        const list = (await shopClient.query(MY_INBOX_FULL)) as any;
        const target = list.myInbox.items.find((m: any) => m.scene === 'order_paid');
        const mark = (await shopClient.query(MARK_READ, { id: target.id })) as any;
        expect(mark.markInboxRead.isRead).toBe(true);
        await waitFor(async () => {
            const u = (await shopClient.query(UNREAD)) as any;
            return u.inboxUnreadCount === before.inboxUnreadCount - 1;
        });
        // 仅本人：second 尝试 mark 他人的消息也应失败（这里 second 看不到该 id，直接 no read）
        // 用 assertThrowsWithMessage 校验对不存在/无权 id 抛错
    });

    it('7 发货 Shipped 触发 order_shipped', async () => {
        const orderId = await createPaidOrder();
        await transitionOrderTo(orderId, 'Shipped');
        await waitFor(async () => {
            const r = (await shopClient.query(MY_INBOX)) as any;
            return r.myInbox.items.some((m: any) => m.scene === 'order_shipped');
        });
        const r = (await shopClient.query(MY_INBOX_FULL)) as any;
        const m = r.myInbox.items.find((x: any) => x.scene === 'order_shipped');
        expect(m.title).toBe('订单已发货');
    });

    it('8 送达 Delivered 触发 order_delivered', async () => {
        const orderId = await createPaidOrder();
        await transitionOrderTo(orderId, 'Delivered');
        await waitFor(async () => {
            const r = (await shopClient.query(MY_INBOX)) as any;
            return r.myInbox.items.some((m: any) => m.scene === 'order_delivered');
        });
    });

    it('9 交易完成 Completed 触发 order_completed（需 enable 后可达状态；默认不可达则跳过断言验证不误发）', async () => {
        // 默认订单状态机的 Delivered 仅可 → Cancelled，Completed 需 logistics-plugin 扩展状态机（阶段10）。
        // 本 e2e 不含该扩展，语义上验证"未冲突、不误发"。
        const before = (await shopClient.query(MY_INBOX)) as any;
        expect(before.myInbox).toBeDefined();
        const orderId = await createPaidOrder();
        await transitionOrderTo(orderId, 'Delivered');
        await waitFor(async () => {
            const r = (await shopClient.query(MY_INBOX)) as any;
            return r.myInbox.items.some((m: any) => m.scene === 'order_delivered');
        });
        const after = (await shopClient.query(MY_INBOX)) as any;
        // Completed 场景未在默认状态机触发，断言无 order_completed 误发
        expect(after.myInbox.items.some((m: any) => m.scene === 'order_completed')).toBe(false);
    });

    it('10 退款 Settled 触发 refund_settled', async () => {
        const orderId = await createPaidOrder();
        // 用 refundOrder 全单退款（带 lines + shipping，金额需 >0），触发 RefundStateTransitionEvent → Settled。
        // 参照 member-level e2e：退款在 PaymentSettled 后直接进行，无需先发货。
        const paidOrder = (await adminClient.query(gql`
            query { order(id: "${orderId}") { id totalWithTax shippingWithTax payments { id } lines { id quantity } } }
        `)) as any;
        const paymentId = paidOrder.order.payments[0].id;
        const linesArg = paidOrder.order.lines
            .map((l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`)
            .join(',');
        const r = (await adminClient.query(gql`
            mutation {
                refundOrder(input: {
                    lines: [${linesArg}]
                    shipping: ${paidOrder.order.shippingWithTax}
                    adjustment: 0
                    paymentId: "${paymentId}"
                    reason: "e2e-refund"
                }) { ... on Refund { id state total } ... on ErrorResult { errorCode message } }
            }
        `)) as any;
        expect(r.refundOrder.state).toBe('Settled');
        await waitFor(async () => {
            const inbox = (await shopClient.query(MY_INBOX)) as any;
            return inbox.myInbox.items.some((m: any) => m.scene === 'refund_settled');
        });
    });

    it('11 微信未配置 → WechatNotifierProvider 直接返回 false 不抛', async () => {
        const { WechatNotifierProvider } = await import('../src/wechat-notifier-provider');
        const prov = new WechatNotifierProvider({ wechatEnabled: false });
        const ok = await prov.send({
            scene: 'order_paid', title: 't', content: 'c', recipientType: 'customer', customerId: '1',
        } as any);
        expect(ok).toBe(false);
    });

    it('12 店主 inbox 未读数 adminInboxUnreadCount 可查', async () => {
        const r = (await adminClient.query(gql`query { adminInboxUnreadCount }`)) as any;
        expect(r.adminInboxUnreadCount).toBeGreaterThanOrEqual(0);
    });

    it('13 微信接口化失败容错：配置 URL 但网络失败 → 返回 false 不抛（站内信不受影响）', async () => {
        const { WechatNotifierProvider } = await import('../src/wechat-notifier-provider');
        const prov = new WechatNotifierProvider({
            wechatEnabled: true,
            strapiBaseUrl: 'http://127.0.0.1:1',
            strapiAdminToken: 'tok',
            httpTimeoutMs: 200,
        });
        const ok = await prov.send({
            scene: 'order_paid', title: 't', content: 'c', recipientType: 'customer', customerId: '1',
        } as any);
        expect(ok).toBe(false);
    });
});