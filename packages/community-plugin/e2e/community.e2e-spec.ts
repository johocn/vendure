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

import { CommunityPlugin } from '../src/community.plugin';
import { SettlementPlugin } from '../../settlement-plugin/src/plugin';
import { PickupPlugin } from '../../pickup-plugin/src/pickup.plugin';
import { DeliveryPlugin } from '../../delivery-plugin/src/delivery.plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 简单的轮询帮助函数（事件订阅 → 异步入账，需轮询等待）。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

describe('CommunityPlugin · 阶段27 社区团购/团长体系(截单集单+商家让利佣金+按店结算联动)', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            DeliveryPlugin.init({}),
            SettlementPlugin.init({ defaultCommissionRate: 0 }),
            PickupPlugin.init({}),
            CommunityPlugin.init({}),
        ],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    let shopAId: string;
    let variantAId: string;

    // 团长身份与 leader id（用例1 apply 时取得）
    let leaderClient: SimpleGraphQLClient;
    let leaderId: string;

    // 主活动/参与单（用例4~7 复用）
    let activityAId: string;
    let mainOrderId: string;
    let mainOrderCode: string;
    let mainSubtotal: number;
    let mainFId: string;

    const COMMISSION_RATE = 100; // 千分比 → 10%（amount = subtotal * rate / 1000）

    const MY_COMMISSION = gql`query { myCommission { totalCommission } }`;
    const MY_ACTIVITIES = gql`query { myActivities { items { id status leaderId pickupLocationId } totalItems } }`;
    const COMM_ENTRIES = gql`query { communityCommissionEntries { items { id orderId leaderId amount status } totalItems } }`;
    const PARTICIPATIONS = gql`query { communityParticipations { items { id activityId orderId leaderId subtotal } totalItems } }`;
    const MY_ENTRIES = gql`query { mySettlementEntries { items { id shopId orderCode } totalItems } }`;

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

    /** 邻居下单并付款，返回 { id, code, totalWithTax }。 */
    async function createPaidOrder(): Promise<{ id: string; code: string; totalWithTax: number }> {
        await resetActiveOrder();
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantAId}", quantity: 1) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.id).toBeDefined();
        const o = (await adminClient.query(gql`query { order(id: "${paid.id}") { code totalWithTax } }`)) as any;
        return { id: paid.id as unknown as string, code: o.order.code as string, totalWithTax: o.order.totalWithTax as number };
    }

    /** 推进订单：addFulfillment(全行) → Shipped，(target=Delivered 时) → Delivered。返回 fId。 */
    async function transitionOrderTo(orderId: string, target: 'Shipped' | 'Delivered', fId?: string): Promise<string> {
        if (!fId) {
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
            fId = f.addFulfillmentToOrder.id;
            expect(fId).toBeDefined();
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

    /** 团长开团（该 cli 须为 active 团长）。默认窗口覆盖"当前时刻"。 */
    async function createActivity(cli: SimpleGraphQLClient, opts: { rate?: number } & { windowStart?: Date; windowEnd?: Date; cutoffTime?: Date } = {}) {
        const now = Date.now();
        const date = (ms: number) => new Date(ms).toISOString();
        const windowStart = opts.windowStart ?? new Date(now - 3600_000);
        const windowEnd = opts.windowEnd ?? new Date(now + 86_400_000);
        const cutoffTime = opts.cutoffTime ?? new Date(now + 1800_000);
        const rate = opts.rate ?? COMMISSION_RATE;
        const r = (await cli.query(
            gql`mutation ($input: CreateCommunityActivityInput!) { createActivity(input: $input) { id status leaderId } }`,
            {
                input: {
                    pickupLocationId: 1,
                    windowStart: date(windowStart.getTime()),
                    windowEnd: date(windowEnd.getTime()),
                    cutoffTime: date(cutoffTime.getTime()),
                    commissionRate: rate,
                    items: [{ variantId: variantAId, price: 100, stockLimit: 10 }],
                },
            },
        )) as any;
        return r.createActivity as { id: string; status: string; leaderId: string };
    }

    const setOpen = async (id: string) => {
        const r = (await adminClient.query(
            gql`mutation ($id: ID!, $s: String!) { setActivityStatus(id: $id, status: $s) { id status } }`,
            { id, s: 'open' },
        )) as any;
        return r.setActivityStatus as { id: string; status: string };
    };

    const participate = async (orderId: string, activityId: string, subtotal: number) => {
        const r = (await adminClient.query(
            gql`mutation ($o: ID!, $a: ID!, $s: Int!) { participate(orderId: $o, activityId: $a, subtotal: $s) { id orderId leaderId activityId subtotal } }`,
            { o: orderId, a: activityId, s: subtotal },
        )) as any;
        return r.participate as { id: string; orderId: string; leaderId: string; activityId: string; subtotal: number };
    };

    const entriesForOrderCode = (ownerEmail: string, orderCode: string) =>
        asOwner(ownerEmail).then(c =>
            c.query(MY_ENTRIES).then((r: any) => r.mySettlementEntries.items.filter((i: any) => String(i.orderCode) === orderCode)),
        );

    const commEntries = async () => {
        const r = (await adminClient.query(COMM_ENTRIES)) as any;
        return r.communityCommissionEntries.items as Array<{ id: string; orderId: string; leaderId: string; amount: number; status: string }>;
    };

    const myCommissionOf = async (cli: SimpleGraphQLClient) => {
        const r = (await cli.query(MY_COMMISSION)) as any;
        return r.myCommission.totalCommission as number;
    };

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
        await provisionOwner(shopAId, 'ownerA.community@test.com');

        // 团长 customer1 / 邻居 customer2 / 非团长 customer3（越权用例）
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "L", lastName: "1", emailAddress: "customer1.community@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "N", lastName: "2", emailAddress: "customer2.community@test.com" }, password: "test") { ... on Customer { id } } }
        `);
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "X", lastName: "3", emailAddress: "customer3.community@test.com" }, password: "test") { ... on Customer { id } } }
        `);

        leaderClient = new SimpleGraphQLClient(config, shopApiUrl);
        await leaderClient.asUserWithCredentials('customer1.community@test.com', 'test');
        // 邻居为 shopClient 主身份
        await shopClient.asUserWithCredentials('customer2.community@test.com', 'test');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pa = await createProduct('社区团购商品', 'community-product', taxCategoryId);
        variantAId = pa.variantId;
        await assign(shopAId, [pa.id]);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件加载 + 买家 applyLeader(绑自提点) → applied', async () => {
        expect(server.app).toBeDefined();
        const r = (await leaderClient.query(
            gql`mutation ($p: ID!) { applyLeader(pickupLocationId: $p) { id status } }`,
            { p: 1 },
        )) as any;
        expect(r.applyLeader.status).toBe('applied');
        leaderId = r.applyLeader.id;
        expect(leaderId).toBeDefined();
    });

    it('2 平台 approveLeader → active', async () => {
        const r = (await adminClient.query(
            gql`mutation ($id: ID!) { approveLeader(id: $id) { id status totalCommission } }`,
            { id: leaderId },
        )) as any;
        expect(r.approveLeader.status).toBe('active');
        expect(r.approveLeader.totalCommission).toBe(0);
    });

    it('3 团长 createActivity（选品/限量/佣金率/截单）→ draft 且 myActivities 可见', async () => {
        const a = await createActivity(leaderClient);
        activityAId = a.id;
        expect(a.status).toBe('draft');
        const list = (await leaderClient.query(MY_ACTIVITIES)) as any;
        expect(list.myActivities.totalItems).toBeGreaterThanOrEqual(1);
        expect(list.myActivities.items.some((i: any) => String(i.id) === activityAId)).toBe(true);
    });

    it('4 open 后邻居下单付款 + participate 绑定 Participation(含 orderId/leaderId/subtotal)', async () => {
        const opened = await setOpen(activityAId);
        expect(opened.status).toBe('open');
        const order = await createPaidOrder();
        mainOrderId = order.id;
        mainOrderCode = order.code;
        mainSubtotal = order.totalWithTax;

        const p = await participate(mainOrderId, activityAId, mainSubtotal);
        expect(String(p.orderId)).toBe(String(mainOrderId));
        expect(String(p.leaderId)).toBe(String(leaderId));
        expect(p.subtotal).toBe(mainSubtotal);
    });

    it('5 cutoverActivity → closed；再调幂等(不重复推进/仍 closed)', async () => {
        const c1 = (await adminClient.query(gql`mutation ($id: ID!) { cutoverActivity(id: $id) { id status } }`, { id: activityAId })) as any;
        expect(c1.cutoverActivity.status).toBe('closed');
        const c2 = (await adminClient.query(gql`mutation ($id: ID!) { cutoverActivity(id: $id) { id status } }`, { id: activityAId })) as any;
        expect(c2.cutoverActivity.status).toBe('closed');
    });

    it('6 参与单照常走阶段24按店结算：备货(Shipped)后 mySettlementEntries 出现该单', async () => {
        mainFId = await transitionOrderTo(mainOrderId, 'Shipped');
        await waitFor(async () => (await entriesForOrderCode('ownerA.community@test.com', mainOrderCode)).length >= 1);
        const e = await entriesForOrderCode('ownerA.community@test.com', mainOrderCode);
        expect(String(e[0].shopId)).toBe(shopAId);
    });

    it('7 佣金单列：订单到 Delivered → CommissionEntry(amount=round(subtotal×rate/1000)) + totalCommission 累计 + 商家结算仍含该单', async () => {
        await transitionOrderTo(mainOrderId, 'Delivered', mainFId);
        const expected = Math.round((mainSubtotal * COMMISSION_RATE) / 1000);
        await waitFor(async () => (await commEntries()).some(e => String(e.orderId) === String(mainOrderId)));
        const hit = (await commEntries()).find(e => String(e.orderId) === String(mainOrderId));
        if (!hit) throw new Error('no commission entry');
        expect(hit.amount).toBe(expected);
        expect(hit.status).toBe('pending');
        // leader.totalCommission 累计
        const tc = await myCommissionOf(leaderClient);
        expect(tc).toBe(expected);
        // 商家结算明细仍含该单
        const e = await entriesForOrderCode('ownerA.community@test.com', mainOrderCode);
        expect(e.length).toBe(1);
    });

    it('8 佣金幂等：重复进 Delivered 不二次累计 totalCommission', async () => {
        // 用主单再尝试二次 Delivered（已在 Delivered，Vendure 会拒绝非法迁移），断言佣金不重复
        const before = await myCommissionOf(leaderClient);
        const beforeEntries = await commEntries();
        try {
            await adminClient.query(gql`mutation { transitionOrderToState(id: "${mainOrderId}", state: "Delivered") { ... on Order { id state } } }`);
        } catch {
            // 已处于 Delivered → 迁移被拒，忽略
        }
        const after = await myCommissionOf(leaderClient);
        const afterEntries = await commEntries();
        expect(after).toBe(before);
        expect(afterEntries.length).toBe(beforeEntries.length);
    });

    it('9 参与幂等：同活同单 participate 返回同一 Participation', async () => {
        const p1 = await participate(mainOrderId, activityAId, mainSubtotal);
        const p2 = await participate(mainOrderId, activityAId, mainSubtotal);
        expect(String(p2.id)).toBe(String(p1.id));
        // 仅一条参与记录
        const parts = (await adminClient.query(PARTICIPATIONS)) as any;
        const hits = parts.communityParticipations.items.filter((i: any) => String(i.orderId) === String(mainOrderId));
        expect(hits.length).toBe(1);
    });

    it('10 拒绝：非 active 开团被拒 / 窗口外 participate 被拒 / 截单后 participate 被拒', async () => {
        // a) 非 active 团长（customer3 仅 applied 未审核）开团被拒
        const xLeader = new SimpleGraphQLClient(config, shopApiUrl);
        await xLeader.asUserWithCredentials('customer3.community@test.com', 'test');
        await xLeader.query(gql`mutation ($p: ID!) { applyLeader(pickupLocationId: $p) { id status } }`, { p: 1 });
        await assertThrowsWithMessage(() => createActivity(xLeader), 'Leader not active');

        // b) 窗口外 participate 被拒（windowEnd 已过）
        const hab = await createActivity(leaderClient, { windowStart: new Date(Date.now() - 7200_000), windowEnd: new Date(Date.now() - 60_000), cutoffTime: new Date(Date.now() + 7200_000) });
        await setOpen(hab.id);
        const ob = await createPaidOrder();
        await assertThrowsWithMessage(() => participate(ob.id, hab.id, ob.totalWithTax), 'Outside activity window');

        // c) 截单后 participate 被拒（cutoffTime 已过）
        const hac = await createActivity(leaderClient, { windowStart: new Date(Date.now() - 7200_000), windowEnd: new Date(Date.now() + 7200_000), cutoffTime: new Date(Date.now() - 60_000) });
        await setOpen(hac.id);
        const oc = await createPaidOrder();
        await assertThrowsWithMessage(() => participate(oc.id, hac.id, oc.totalWithTax), 'Activity cutoff reached');
    });

    it('11 越权：非本人 myCommission Forbidden / 非平台 approveLeader Forbidden', async () => {
        // a) 邻居(customer2) 非团长查 myCommission → Forbidden
        await assertThrowsWithMessage(() => shopClient.query(MY_COMMISSION), 'not authorized');
        // b) 店主(ownerA, 商家域权限) 调平台 approveLeader → Forbidden
        const ownerA = await asOwner('ownerA.community@test.com');
        await assertThrowsWithMessage(() => ownerA.query(gql`mutation ($id: ID!) { approveLeader(id: $id) { id } }`, { id: leaderId }), 'not authorized');
    });

    it('12 1人也发：单参与单 cutover 照常推进履约', async () => {
        const a = await createActivity(leaderClient);
        await setOpen(a.id);
        const order = await createPaidOrder();
        const p = await participate(order.id, a.id, order.totalWithTax);
        expect(String(p.orderId)).toBe(String(order.id));
        // 1 人参团仍可截单
        const c = (await adminClient.query(gql`mutation ($id: ID!) { cutoverActivity(id: $id) { id status } }`, { id: a.id })) as any;
        expect(c.cutoverActivity.status).toBe('closed');
        // 单参与单仍可正常备货→送达
        await transitionOrderTo(order.id, 'Delivered');
        const st = (await adminClient.query(gql`query { order(id: "${order.id}") { state } }`)) as any;
        expect(st.order.state).toBe('Delivered');
    });

    it('13 结算联动 end-to-end：参团单 Shipped→Delivered 后 商家应收 + 佣金双重断言', async () => {
        const a = await createActivity(leaderClient);
        await setOpen(a.id);
        const order = await createPaidOrder();
        const orderCode = order.code;
        const p = await participate(order.id, a.id, order.totalWithTax);
        expect(String(p.orderId)).toBe(String(order.id));

        // 备货 → 商家结算明细出现
        const fId = await transitionOrderTo(order.id, 'Shipped');
        await waitFor(async () => (await entriesForOrderCode('ownerA.community@test.com', orderCode)).length >= 1);
        const entries = await entriesForOrderCode('ownerA.community@test.com', orderCode);
        expect(entries.length).toBe(1);
        expect(String(entries[0].shopId)).toBe(shopAId);

        // 送达 → 佣金单列
        await transitionOrderTo(order.id, 'Delivered', fId);
        const expected = Math.round((order.totalWithTax * COMMISSION_RATE) / 1000);
        await waitFor(async () => (await commEntries()).some(e => String(e.orderId) === String(order.id)));
        const hit = (await commEntries()).find(e => String(e.orderId) === String(order.id));
        if (!hit) throw new Error('no commission entry for end-to-end order');
        expect(hit.amount).toBe(expected);
        expect(hit.leaderId).toBe(leaderId);

        // 商家结算仍含该单（金额不被佣金扣减）
        const afterEntries = await entriesForOrderCode('ownerA.community@test.com', orderCode);
        expect(afterEntries.length).toBe(1);
    });
});