import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

// 本插件未注册进 node_modules（新包），从其源码直接导入，避免依赖安装。
import { SubscriptionPlugin } from '../src/plugin';
import { ShopPlugin } from '@vendure/shop-plugin';
import { InventoryPlugin } from '@vendure/inventory-plugin';
import { SettlementPlugin } from '../../settlement-plugin/src/plugin';

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

describe('SubscriptionPlugin · 阶段25 周期购/订阅复购（套餐档+期次+预存款）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [
            InventoryPlugin.init(),
            ShopPlugin.init({}),
            SubscriptionPlugin.init({}),
            SettlementPlugin.init({ defaultCommissionRate: 0 }),
        ],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    const OWNER_A = 'ownerA.sub@test.com';
    const OWNER_B = 'ownerB.sub@test.com';
    const BUYER_1 = 'buyer1.sub@test.com';
    const BUYER_2 = 'buyer2.sub@test.com';
    const START = '2026-01-01T00:00:00Z';

    let shopAId: string;
    let variantAId: string;

    const CREATE_PLAN = gql`
        mutation ($title: String!, $frequency: String!, $periods: Int!, $periodPrice: Int!) {
            createSubscriptionPlan(input: { title: $title, frequency: $frequency, periods: $periods, periodPrice: $periodPrice }) { id title periods periodPrice }
        }
    `;
    const CREATE_SUBSCRIPTION = gql`
        mutation ($planId: ID!, $startDate: DateTime!) {
            createSubscription(planId: $planId, input: { startDate: $startDate }) { id code planId shopId customerId scheduleJson startDate endDate prepaidBalance purchasedTotal status }
        }
    `;
    const MY_SUBSCRIPTIONS = gql`query { mySubscriptions { items { id code planId customerId prepaidBalance purchasedTotal status } totalItems } }`;
    const MY_OCCURRENCES = gql`
        query ($subscriptionId: ID!) {
            mySubscriptionOccurrences(subscriptionId: $subscriptionId) { items { id subscriptionId periodNo scheduledDate orderCode generatedOrderId status skipReason } totalItems }
        }
    `;
    const SET_ITEMS = gql`
        mutation ($id: ID!, $items: [SubscriptionItemInput!]!) { setSubscriptionOccurrenceItems(id: $id, items: $items) { id status } }
    `;
    const PROCESS_DUE = gql`mutation { processDueSubscriptions { created skipped } }`;
    const CONFIRM_RENEWAL = gql`mutation ($id: ID!) { confirmRenewal(id: $id) { id status } }`;
    const CANCEL = gql`mutation ($id: ID!) { cancelSubscriptionOwner(id: $id) { id status } }`;
    const SET_PLAN_ENABLED = gql`mutation ($id: ID!, $enabled: Boolean!) { setSubscriptionPlanEnabled(id: $id, enabled: $enabled) { id enabled } }`;
    const AVAILABLE_PLANS = gql`query { availablePlans { items { id title enabled } totalItems } }`;
    const MY_ENTRIES = gql`query { mySettlementEntries { items { id shopId orderCode goodsAmountWithTax shippingAmountWithTax commissionAmount netAmountWithTax } totalItems } }`;

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) { id } }
        `)) as any;
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id } }
        `);
        return res.createShop.id;
    }

    async function provisionOwner(shopId: string, email: string): Promise<void> {
        await adminClient.query(gql`
            mutation {
                provisionShopOwner(shopId: "${shopId}", input: {
                    emailAddress: "${email}", password: "test", firstName: "店", lastName: "主"
                }) { id }
            }
        `);
    }

    /** 店主专属 admin-client。 */
    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    /** 买家专属 shop-client。 */
    async function asBuyer(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, shopApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    /** 程序化自建商品（挂在 shopA 下）。返回 variantId。 */
    async function createVariant(name: string, slug: string, taxCategoryId: string): Promise<string> {
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
        await adminClient.query(gql`mutation { assignProductsToShop(input: { shopId: "${shopAId}", productIds: ["${pid}"] }) }`);
        return v.createProductVariants[0].id;
    }

    /** 店主在后台建套餐档（frequency 以 JSON 字符串经 GraphQL 传入）。 */
    async function createPlan(owner: SimpleGraphQLClient, title: string, frequency: any, periods: number, periodPrice: number): Promise<string> {
        const r = (await owner.query(CREATE_PLAN, { title, frequency: JSON.stringify(frequency), periods, periodPrice })) as any;
        return r.createSubscriptionPlan.id;
    }

    /** 买家买断开通，返回订阅对象（含 scheduleJson/prepaidBalance/status）。 */
    async function subscribe(buyer: SimpleGraphQLClient, planId: string, startDate = START): Promise<any> {
        const r = (await buyer.query(CREATE_SUBSCRIPTION, { planId, startDate })) as any;
        return r.createSubscription;
    }

    /** 取某买家在某订阅下的期次列表。 */
    async function occurrencesOf(buyer: SimpleGraphQLClient, subscriptionId: string): Promise<any[]> {
        const r = (await buyer.query(MY_OCCURRENCES, { subscriptionId })) as any;
        return r.mySubscriptionOccurrences.items;
    }

    /** 店主为某期次指定内容（清单 [{variantId,quantity}]）。 */
    async function setItems(owner: SimpleGraphQLClient, occId: string, items: any[]): Promise<void> {
        await owner.query(SET_ITEMS, { id: occId, items });
    }

    /** 平台驱动到期期次处理（每日调度入口）。 */
    async function processDue(): Promise<{ created: number; skipped: number }> {
        const r = (await adminClient.query(PROCESS_DUE)) as any;
        return r.processDueSubscriptions;
    }

    /** admin 端把订阅生成的订单推进到 Delivered 触发阶段24结算。 */
    async function deliverOrder(orderId: string): Promise<void> {
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
        expect(f.addFulfillmentToOrder.id).toBeDefined();
        const fId = f.addFulfillmentToOrder.id;
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Delivered") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } } }`);
        const after = (await adminClient.query(gql`query { order(id: "${orderId}") { state } }`)) as any;
        expect(after.order.state).toBe('Delivered');
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

        shopAId = await createShop('Shop A', 'shop-a-sub');
        const shopBId = await createShop('Shop B', 'shop-b-sub');
        await provisionOwner(shopAId, OWNER_A);
        await provisionOwner(shopBId, OWNER_B);

        // 买家
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "B1", lastName: "U", emailAddress: "${BUYER_1}" }, password: "test") { ... on Customer { id } } }
        `);
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "B2", lastName: "U", emailAddress: "${BUYER_2}" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials(BUYER_1, 'test');

        // 挂一个 shopA 商品，用于期次订单商品行与结算明细
        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        variantAId = await createVariant('订阅商品', 'sub-product', taxCats.taxCategories.items[0].id);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 插件加载 + 店主建套餐档(daily) → 返回 id 且本店可查', async () => {
        expect(server.app).toBeDefined();
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '每日套餐', { kind: 'daily' }, 3, 100);
        expect(planId).toBeDefined();
        const plans = (await ownerA.query(gql`query { myShopSubscriptionPlans { items { id title } totalItems } }`)) as any;
        expect(plans.myShopSubscriptionPlans.items.map((p: any) => p.id)).toContain(planId);
    });

    it('2 买断开通：createSubscription → active、prepaidBalance=total、期次数=periods', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '买断开通', { kind: 'daily' }, 3, 100);
        const sub = await subscribe(shopClient, planId);
        expect(sub.status).toBe('active');
        expect(sub.purchasedTotal).toBe(300);
        expect(sub.prepaidBalance).toBe(300);
        expect(sub.scheduleJson.length).toBe(3);
        const occs = await occurrencesOf(shopClient, sub.id);
        expect(occs.length).toBe(3);
        expect(occs.every((o: any) => o.status === 'pending')).toBe(true);
    });

    it('3 每日调度生单抵扣：到期 pending 期次生成正式订单 + 预存款递减该期价', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '调度生单', { kind: 'daily' }, 2, 100);
        const sub = await subscribe(shopClient, planId);
        expect(sub.prepaidBalance).toBe(200);
        const occs = await occurrencesOf(shopClient, sub.id);
        await setItems(ownerA, occs[0].id, [{ variantId: variantAId, quantity: 1 }]);

        // processDue 是全量扫描，可能命中其他用例遗留的到期期次，故不校验其全局计数，
        // 改为断言本订阅自身的期次/预存款结果（语义等价：第一期生单抵扣、第二期未指定→skipped）。
        await processDue();

        const after = (await shopClient.query(MY_SUBSCRIPTIONS)) as any;
        const my = after.mySubscriptions.items.find((s: any) => s.id === sub.id);
        expect(my.prepaidBalance).toBe(100); // 200 - 100

        const refreshed = await occurrencesOf(shopClient, sub.id);
        const createdOcc = refreshed.find((o: any) => o.status === 'orderCreated');
        expect(createdOcc).toBeDefined();
        expect(createdOcc.generatedOrderId).toBeDefined();
        expect(createdOcc.orderCode).toBeDefined();
        const skippedOcc = refreshed.find((o: any) => o.status === 'skipped');
        expect(skippedOcc.skipReason).toBeDefined();
    });

    it('4 多频次排期：weekly / everyNDays 展开正确', async () => {
        const ownerA = await asOwner(OWNER_A);
        // everyNDays interval=2 → 期次间隔正好 2 天
        const pEvery = await createPlan(ownerA, '隔天套餐', { kind: 'everyNDays', interval: 2 }, 3, 100);
        const subEvery = await subscribe(shopClient, pEvery);
        expect(subEvery.scheduleJson.length).toBe(3);
        for (let i = 1; i < subEvery.scheduleJson.length; i++) {
            const diff = new Date(subEvery.scheduleJson[i]).getTime() - new Date(subEvery.scheduleJson[i - 1]).getTime();
            expect(diff).toBe(2 * 86400000);
        }
        // weekly dayOfWeek=2(Tue) → 期次间隔正好 7 天
        const pWeekly = await createPlan(ownerA, '每周套餐', { kind: 'weekly', dayOfWeek: 2 }, 3, 100);
        const subWeekly = await subscribe(shopClient, pWeekly);
        expect(subWeekly.scheduleJson.length).toBe(3);
        for (let i = 1; i < subWeekly.scheduleJson.length; i++) {
            const diff = new Date(subWeekly.scheduleJson[i]).getTime() - new Date(subWeekly.scheduleJson[i - 1]).getTime();
            expect(diff).toBe(7 * 86400000);
        }
    });

    it('5 卖家逐期指定内容：该期订单 lines = 指定清单', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '指定内容', { kind: 'daily' }, 1, 100);
        const sub = await subscribe(shopClient, planId);
        const occ = (await occurrencesOf(shopClient, sub.id))[0];
        await setItems(ownerA, occ.id, [{ variantId: variantAId, quantity: 2 }]);
        await processDue();

        const refreshed = (await occurrencesOf(shopClient, sub.id))[0];
        expect(refreshed.status).toBe('orderCreated');
        const order = (await adminClient.query(gql`query { order(id: "${refreshed.generatedOrderId}") { id lines { quantity productVariant { id } } } }`)) as any;
        expect(order.order.lines).toHaveLength(1);
        expect(String(order.order.lines[0].productVariant.id)).toBe(String(variantAId));
        expect(order.order.lines[0].quantity).toBe(2);
    });

    it('6 卖家未指定内容 → 期次 skipped、skipReason 非空，且不解扣预存款', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '未指定', { kind: 'daily' }, 2, 100);
        const sub = await subscribe(shopClient, planId);
        const res = await processDue();
        expect(res.created).toBe(0);
        expect(res.skipped).toBe(2);
        const occs = await occurrencesOf(shopClient, sub.id);
        expect(occs.every((o: any) => o.status === 'skipped' && o.skipReason)).toBe(true);
        const after = (await shopClient.query(MY_SUBSCRIPTIONS)) as any;
        expect(after.mySubscriptions.items.find((s: any) => s.id === sub.id).prepaidBalance).toBe(200);
    });

    it('7 幂等：同一到期期次二次 processDue 不再二次生单', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '幂等', { kind: 'daily' }, 1, 100);
        const sub = await subscribe(shopClient, planId);
        const occ = (await occurrencesOf(shopClient, sub.id))[0];
        await setItems(ownerA, occ.id, [{ variantId: variantAId, quantity: 1 }]);
        const first = await processDue();
        expect(first.created).toBe(1);
        const occCreated = (await occurrencesOf(shopClient, sub.id))[0];
        const firstOrderCode = occCreated.orderCode;

        const second = await processDue();
        expect(second.created).toBe(0); // 不再生成第二单
        const again = (await occurrencesOf(shopClient, sub.id))[0];
        expect(again.status).toBe('orderCreated');
        expect(again.orderCode).toBe(firstOrderCode); // 仍是同一单
    });

    it('8 与阶段24结算联动：每期订单达成 Delivered → 商家应收按单增加', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '结算联动', { kind: 'daily' }, 1, 100);
        const sub = await subscribe(shopClient, planId);
        const occ = (await occurrencesOf(shopClient, sub.id))[0];
        await setItems(ownerA, occ.id, [{ variantId: variantAId, quantity: 1 }]);
        await processDue();
        const refreshed = (await occurrencesOf(shopClient, sub.id))[0];
        const orderCode = refreshed.orderCode;

        await deliverOrder(refreshed.generatedOrderId);

        await waitFor(async () => {
            const r = (await ownerA.query(MY_ENTRIES)) as any;
            return r.mySettlementEntries.items.some((i: any) => String(i.orderCode) === String(orderCode));
        });
        const r = (await ownerA.query(MY_ENTRIES)) as any;
        const entry = r.mySettlementEntries.items.find((i: any) => String(i.orderCode) === String(orderCode));
        expect(entry).toBeDefined();
        expect(String(entry.shopId)).toBe(shopAId);
        expect(entry.goodsAmountWithTax).toBeGreaterThan(0);
    });

    it('9 最后一期履约后触发续订：confirmRenewal → status renewalPending', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '续订提醒', { kind: 'daily' }, 1, 100);
        const sub = await subscribe(shopClient, planId);
        const occ = (await occurrencesOf(shopClient, sub.id))[0];
        await setItems(ownerA, occ.id, [{ variantId: variantAId, quantity: 1 }]);
        await processDue(); // 最后一期履约 → 预存款耗尽 → 订阅过期
        const afterFulfil = (await shopClient.query(MY_SUBSCRIPTIONS)) as any;
        expect(afterFulfil.mySubscriptions.items.find((s: any) => s.id === sub.id).status).toBe('expired');
        const renewed = (await shopClient.query(CONFIRM_RENEWAL, { id: sub.id })) as any;
        expect(renewed.confirmRenewal.status).toBe('renewalPending');
    });

    it('10 买断到期续订开启新段：createSubscription 重建段 → active + prepaidBalance 重置为总价，原订阅 expired', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '续订新段', { kind: 'daily' }, 1, 500);
        const oldSub = await subscribe(shopClient, planId);
        expect(oldSub.status).toBe('active');
        expect(oldSub.prepaidBalance).toBe(500);
        const occ = (await occurrencesOf(shopClient, oldSub.id))[0];
        await setItems(ownerA, occ.id, [{ variantId: variantAId, quantity: 1 }]);
        await processDue(); // 原订阅余额耗尽 → expired
        const oldAfter = (await shopClient.query(MY_SUBSCRIPTIONS)) as any;
        expect(oldAfter.mySubscriptions.items.find((s: any) => s.id === oldSub.id).status).toBe('expired');

        // 买家开启新一段 → 再收全款
        const newSub = await subscribe(shopClient, planId);
        expect(newSub.status).toBe('active');
        expect(newSub.prepaidBalance).toBe(500);
        expect(newSub.purchasedTotal).toBe(500);
        expect(newSub.id).not.toBe(oldSub.id);
    });

    it('11 取消：cancelSubscriptionOwner → 订阅 cancelled + pending 期次全 cancelled', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '取消', { kind: 'daily' }, 3, 100);
        const sub = await subscribe(shopClient, planId);
        const r = (await ownerA.query(CANCEL, { id: sub.id })) as any;
        expect(r.cancelSubscriptionOwner.status).toBe('cancelled');
        const occs = await occurrencesOf(shopClient, sub.id);
        expect(occs).toHaveLength(3);
        expect(occs.every((o: any) => o.status === 'cancelled')).toBe(true);
    });

    it('12 越权隔离：买家只见自己的订阅；店主改非本店期次内容被拒', async () => {
        // 买家B1 / B2 各订一档，B1 查 mySubscriptions 只见自己
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '隔离', { kind: 'daily' }, 1, 100);
        const buyer1 = shopClient;
        const buyer2 = await asBuyer(BUYER_2);
        const subB1 = await subscribe(buyer1, planId);
        const subB2 = await subscribe(buyer2, planId);

        const m1 = (await buyer1.query(MY_SUBSCRIPTIONS)) as any;
        const ids1 = m1.mySubscriptions.items.map((s: any) => s.id);
        expect(ids1).toContain(subB1.id);
        expect(ids1).not.toContain(subB2.id);

        // 店主B(非本店 shopA) 改 shopA 期次内容 → Forbidden
        const ownerB = await asOwner(OWNER_B);
        const subB1Occ = (await occurrencesOf(buyer1, subB1.id))[0];
        await assertThrowsWithMessage(
            () => ownerB.query(SET_ITEMS, { id: subB1Occ.id, items: [{ variantId: variantAId, quantity: 1 }] }),
            'not currently authorized',
        );
    });

    it('13 平台停用套餐档：setSubscriptionPlanEnabled(false) → availablePlans 不含该档', async () => {
        const ownerA = await asOwner(OWNER_A);
        const planId = await createPlan(ownerA, '停用档', { kind: 'daily' }, 1, 100);
        const before = (await shopClient.query(AVAILABLE_PLANS)) as any;
        expect(before.availablePlans.items.map((p: any) => p.id)).toContain(planId);

        const toggled = (await adminClient.query(SET_PLAN_ENABLED, { id: planId, enabled: false })) as any;
        expect(toggled.setSubscriptionPlanEnabled.enabled).toBe(false);

        const after = (await shopClient.query(AVAILABLE_PLANS)) as any;
        expect(after.availablePlans.items.map((p: any) => p.id)).not.toContain(planId);
    });
});