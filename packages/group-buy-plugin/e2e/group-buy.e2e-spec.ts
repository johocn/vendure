import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { GroupBuyPlugin } from '../src/plugin';
import {
    singleStageRefundablePaymentMethod,
    testSuccessfulPaymentMethod,
} from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('GroupBuyPlugin · 拼团闭环（开团/参团/成团/满员/过期取消退款）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [GroupBuyPlugin.init({ defaultTimeoutMinutes: 60 })],
        paymentOptions: {
            paymentMethodHandlers: [testSuccessfulPaymentMethod, singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let variantId: string;
    let variant2Id: string;
    let productId: string;
    let clientB: SimpleGraphQLClient;

    // 拼团价/团长折扣（金额单位：分）。结算基准为含税价（pricesIncludeTax=true），
    // 拼团价动作按 unitPriceWithTax - groupPrice 折让 → 命中行 subTotalWithTax 落到 groupPrice。
    const GROUP_PRICE = 99900;
    const LEADER_DISCOUNT = 5000;

    let seq = 0;

    /* ------------------------- helpers ------------------------- */

    async function createActivity(overrides: Record<string, unknown> = {}): Promise<any> {
        const now = Date.now();
        const defaults = {
            name: `拼团活动${++seq}`,
            description: '拼团闭环测试活动',
            targetCount: 3,
            maxCount: 0,
            startAt: new Date(now - 3600_000).toISOString(),
            endAt: new Date(now + 24 * 3600_000).toISOString(),
            groupPrice: GROUP_PRICE,
            leaderDiscount: LEADER_DISCOUNT,
            leaderRewardType: 'discount',
            allowJoinAfterComplete: false,
        };
        const input = { ...defaults, ...overrides };
        const res = await adminClient.query(gql`
            mutation {
                createGroupBuyActivity(input: {
                    name: "${input.name}"
                    description: "${input.description}"
                    targetCount: ${input.targetCount}
                    maxCount: ${input.maxCount}
                    startAt: "${input.startAt}"
                    endAt: "${input.endAt}"
                    groupPrice: ${input.groupPrice}
                    leaderDiscount: ${input.leaderDiscount}
                    leaderRewardType: "${input.leaderRewardType}"
                    allowJoinAfterComplete: ${input.allowJoinAfterComplete}
                    productId: "${productId}"
                    variantId: "${variantId}"
                }) { id status currentCount targetCount maxCount groupPrice leaderDiscount allowJoinAfterComplete }
            }
        `) as any;
        return res.createGroupBuyActivity;
    }

    async function getActivity(id: string): Promise<any> {
        const res = await adminClient.query(gql`
            query { groupBuyActivity(id: "${id}") { id status currentCount targetCount maxCount } }
        `) as any;
        return res.groupBuyActivity;
    }

    async function adminOrder(id: string): Promise<any> {
        const res = await adminClient.query(gql`
            query { order(id: "${id}") { id state payments { state refunds { state } } } }
        `) as any;
        return res.order;
    }

    async function getActiveOrder(client: SimpleGraphQLClient): Promise<any> {
        const res = await client.query(gql`
            query {
                activeOrder {
                    id subTotalWithTax
                    lines { id quantity unitPrice unitPriceWithTax }
                    discounts { amount amountWithTax }
                }
            }
        `) as any;
        return res.activeOrder;
    }

    async function resetActiveOrder(client: SimpleGraphQLClient): Promise<void> {
        const active = await getActiveOrder(client);
        if (active?.id) {
            await adminClient.query(gql`
                mutation {
                    cancelOrder(input: { orderId: "${active.id}" }) {
                        ... on Order { id state }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `);
        }
    }

    async function freshOrder(client: SimpleGraphQLClient, variant = variantId): Promise<any> {
        await resetActiveOrder(client);
        const res = await client.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variant}", quantity: 1) {
                    ... on Order { id subTotalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        return res.addItemToOrder;
    }

    async function join(
        client: SimpleGraphQLClient,
        activityId: string,
        orderId: string,
        isLeader: boolean,
    ): Promise<any> {
        const res = await client.query(gql`
            mutation {
                joinGroupBuy(activityId: "${activityId}", orderId: "${orderId}", isLeader: ${isLeader}) {
                    id groupBuyActivityId isLeader status
                }
            }
        `) as any;
        return res.joinGroupBuy;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: testSuccessfulPaymentMethod.code,
                        handler: { code: testSuccessfulPaymentMethod.code, arguments: [] },
                    },
                    {
                        name: singleStageRefundablePaymentMethod.code,
                        handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 2,
        });
        await adminClient.asSuperAdmin();

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        productId = products.products.items[0].id;
        variantId = products.products.items[0].variants[0].id;
        variant2Id = products.products.items[0].variants[1].id;

        // 让结算基准统一为「含税价」，使拼团价折让额可精确推算
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

        // 登录主 C 端用户（团长/成员 A），并取另一客户 B 的邮箱（用于跨用户参团）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`
            query { activeCustomer { id } }
        `) as any;
        const myCustomerId = (me.activeCustomer as any).id;
        const custs = await adminClient.query(gql`
            query { customers(options: { take: 5 }) { items { id emailAddress } } }
        `) as any;
        const other = custs.customers.items.find((c: any) => c.id !== myCustomerId);
        clientB = new SimpleGraphQLClient(
            config,
            `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`,
        );
        await clientB.asUserWithCredentials(other.emailAddress, 'test');

        // 两张无参数促销：拼团价 + 团长折扣（活动配置运行时动态读取）
        const pricePromo = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "Group buy price", description: "group buy price" }]
                    conditions: [{ code: "group_buy_discount", arguments: [] }]
                    actions: [{ code: "group_buy_price", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        expect(pricePromo.createPromotion.id).toBeDefined();

        const leaderPromo = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "Group buy leader reward", description: "leader discount" }]
                    conditions: [{ code: "group_buy_leader_reward", arguments: [] }]
                    actions: [{ code: "group_buy_leader_reward", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        expect(leaderPromo.createPromotion.id).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；初始无活动', () => {
        expect(server.app).toBeDefined();
    });

    it('初始活动列表为空', async () => {
        const adminRes = await adminClient.query(gql`
            query { groupBuyActivities(options: { take: 10 }) { items { id } totalItems } }
        `) as any;
        expect(adminRes.groupBuyActivities.totalItems).toBe(0);

        const shopRes = await shopClient.query(gql`
            query { activeGroupBuyActivities { id } }
        `) as any;
        expect(shopRes.activeGroupBuyActivities).toEqual([]);
    });

    it('开团全链路：团长加入 → 拼团价+团长折扣生效 → 支付成功', async () => {
        const act = await createActivity({ targetCount: 3 });
        const order = await freshOrder(shopClient);
        const before = order.subTotalWithTax;
        expect(before).toBeGreaterThan(GROUP_PRICE);

        const j = await join(shopClient, act.id, order.id, true);
        expect(j.isLeader).toBe(true);
        expect(String(j.groupBuyActivityId)).toBe(String(act.id));

        const after = await getActiveOrder(shopClient);
        // 拼团价把该行价格落到 groupPrice，团长再减 leaderDiscount
        expect(after.subTotalWithTax).toBe(before - (before - GROUP_PRICE) - LEADER_DISCOUNT);
        const amounts = after.discounts.map((d: any) => d.amountWithTax);
        expect(amounts).toContain(-(before - GROUP_PRICE));
        expect(amounts).toContain(-LEADER_DISCOUNT);

        // 支付成功
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        expect(paid.id).toBe(order.id);

        const actAfter = await getActivity(act.id);
        expect(actAfter.status).toBe('active');
        expect(actAfter.currentCount).toBe(1);
    });

    it('参团价：成员加入仅享拼团价，无团长折扣', async () => {
        const act = await createActivity({ targetCount: 3 });
        const order = await freshOrder(shopClient);
        const before = order.subTotalWithTax;

        const j = await join(shopClient, act.id, order.id, false);
        expect(j.isLeader).toBe(false);

        const after = await getActiveOrder(shopClient);
        expect(after.subTotalWithTax).toBe(before - (before - GROUP_PRICE));
        const amounts = after.discounts.map((d: any) => d.amountWithTax);
        expect(amounts).toContain(-(before - GROUP_PRICE));
        expect(amounts).not.toContain(-LEADER_DISCOUNT);
    });

    it('成团：跨用户参团达 targetCount → 活动 completed', async () => {
        const act = await createActivity({ targetCount: 2, maxCount: 0, allowJoinAfterComplete: false });

        // A 开团（团长）
        const o1 = await freshOrder(shopClient);
        await join(shopClient, act.id, o1.id, true);

        // B 参团（成员）→ 达到 targetCount=2 → 成团
        const o2 = await freshOrder(clientB);
        await join(clientB, act.id, o2.id, false);

        const actAfter = await getActivity(act.id);
        expect(actAfter.status).toBe('completed');
        expect(actAfter.currentCount).toBe(2);

        // allowJoinAfterComplete=false：已成团活动拒绝续参
        const o3 = await freshOrder(shopClient);
        await assertThrowsWithMessage(
            async () => join(shopClient, act.id, o3.id, false),
            'Activity is not joinable',
        );
    });

    it('满员拦截（maxCount）+ 同订单重复加入幂等', async () => {
        const act = await createActivity({ targetCount: 5, maxCount: 2 });

        // A 开团
        const o1 = await freshOrder(shopClient);
        await join(shopClient, act.id, o1.id, true);

        // 幂等：同订单重复 join（改 isLeader）不重复递增人数
        const re = await join(shopClient, act.id, o1.id, false);
        expect(re.isLeader).toBe(false);
        let actAfter = await getActivity(act.id);
        expect(actAfter.currentCount).toBe(1);

        // B 加入 → currentCount=2 = maxCount → 满员
        const o2 = await freshOrder(clientB);
        await join(clientB, act.id, o2.id, false);
        actAfter = await getActivity(act.id);
        expect(actAfter.currentCount).toBe(2);

        // 第 3 人（A 新订单）被原子守卫拒绝
        const o3 = await freshOrder(shopClient);
        await assertThrowsWithMessage(
            async () => join(shopClient, act.id, o3.id, false),
            'Activity is already full or not joinable',
        );
    });

    it('过期未成团：活动 expired + 订单取消 + 支付退款 Settled', async () => {
        const act = await createActivity({ targetCount: 5, maxCount: 5 });

        // A 开团并支付（走可退款支付方法）
        const o1 = await freshOrder(shopClient);
        await join(shopClient, act.id, o1.id, true);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.id).toBe(o1.id);

        const placed = await adminOrder(paid.id);
        // 支付后处于 PaymentSettled（Placed 由订单放置任务异步推进），两者均为可取消/可退款态
        expect(['PaymentSettled', 'Placed']).toContain(placed.state);
        expect(placed.payments[0].state).toBe('Settled');

        // 把 endAt 改到过去 → 手动触发过期检查（等价定时任务，确定性执行）
        const past = new Date(Date.now() - 60_000).toISOString();
        await adminClient.query(gql`
            mutation { updateGroupBuyActivity(input: { id: "${act.id}", endAt: "${past}" }) { id status } }
        `);
        const ran = await adminClient.query(gql`
            mutation { runGroupBuyExpiryCheck }
        `) as any;
        expect(ran.runGroupBuyExpiryCheck).toBe(true);

        const actAfter = await getActivity(act.id);
        expect(actAfter.status).toBe('expired');

        const cancelled = await adminOrder(paid.id);
        expect(cancelled.state).toBe('Cancelled');
        expect(cancelled.payments[0].refunds.some((r: any) => r.state === 'Settled')).toBe(true);
    });

    it('校验拦截：未开始/已结束/订单不含拼团变体/非本人订单', async () => {
        // 1) 未开始
        const future = new Date(Date.now() + 3600_000).toISOString();
        const actFuture = await createActivity({ startAt: future });
        const o1 = await freshOrder(shopClient);
        await assertThrowsWithMessage(
            async () => join(shopClient, actFuture.id, o1.id, false),
            'Group buy activity has not started yet',
        );

        // 2) 已结束（endAt 在过去，status 仍 active → 窗口校验拦截）
        const past = new Date(Date.now() - 3600_000).toISOString();
        const actPast = await createActivity({ endAt: past });
        const o2 = await freshOrder(shopClient);
        await assertThrowsWithMessage(
            async () => join(shopClient, actPast.id, o2.id, false),
            'Group buy activity has ended',
        );

        // 3) 订单不含拼团变体行
        const actH = await createActivity({});
        const o3 = await freshOrder(shopClient, variant2Id);
        await assertThrowsWithMessage(
            async () => join(shopClient, actH.id, o3.id, false),
            'Order does not contain the group buy variant',
        );

        // 4) 非本人订单（B 试图用 A 的订单参团）
        const actI = await createActivity({});
        const o4 = await freshOrder(shopClient);
        await assertThrowsWithMessage(
            async () => join(clientB, actI.id, o4.id, false),
            'You can only join a group buy with your own order',
        );
    });
});
