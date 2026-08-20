import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { FlashSalePlugin } from '../src/plugin';
import { testSuccessfulPaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('FlashSalePlugin · 秒杀闭环（建活动/状态机/抢购价/限购/售罄/取消回滚/动态取价）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [FlashSalePlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [testSuccessfulPaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let productId: string;
    let variantId: string;
    let variant2Id: string;

    // 金额单位：分；结算基准为含税价（pricesIncludeTax=true），
    // 秒杀价动作按 unitPriceWithTax - flashPrice 折让 → 命中行 subTotalWithTax 落到 flashPrice。
    const ORIGINAL_PRICE = 129900; // Laptop 13inch/8GB 原价（含税）
    const FLASH_PRICE_A = 89900; // 活动A 秒杀价 → 折扣 40000
    const FLASH_PRICE_B = 109900; // 活动B 秒杀价 → 折扣 20000

    let seq = 0;

    /* ------------------------- helpers ------------------------- */

    async function createActivity(overrides: Record<string, unknown> = {}): Promise<any> {
        const now = Date.now();
        const defaults = {
            name: `秒杀活动${++seq}`,
            startAt: new Date(now - 3600_000).toISOString(),
            endAt: new Date(now + 24 * 3600_000).toISOString(),
            flashPrice: FLASH_PRICE_A,
            totalStock: 10,
            limitPerUser: 5,
        };
        const input = { ...defaults, ...overrides };
        const res = await adminClient.query(gql`
            mutation {
                createFlashSaleActivity(input: {
                    name: "${input.name}"
                    startAt: "${input.startAt}"
                    endAt: "${input.endAt}"
                    flashPrice: ${input.flashPrice}
                    totalStock: ${input.totalStock}
                    limitPerUser: ${input.limitPerUser}
                    productId: "${productId}"
                    variantId: "${variantId}"
                }) { id status soldCount totalStock limitPerUser flashPrice }
            }
        `) as any;
        return res.createFlashSaleActivity;
    }

    async function getActivity(id: string): Promise<any> {
        const res = await adminClient.query(gql`
            query { flashSaleActivity(id: "${id}") { id status soldCount totalStock limitPerUser flashPrice } }
        `) as any;
        return res.flashSaleActivity;
    }

    async function getActiveOrder(client: SimpleGraphQLClient): Promise<any> {
        const res = await client.query(gql`
            query {
                activeOrder {
                    id subTotalWithTax
                    lines { id quantity unitPriceWithTax }
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

    async function freshOrder(
        client: SimpleGraphQLClient,
        variant = variantId,
        quantity = 1,
    ): Promise<any> {
        await resetActiveOrder(client);
        const res = await client.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variant}", quantity: ${quantity}) {
                    ... on Order { id subTotalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        return res.addItemToOrder;
    }

    async function grab(client: SimpleGraphQLClient, activityId: string): Promise<any> {
        const res = await client.query(gql`
            mutation {
                applyFlashSale(activityId: "${activityId}") {
                    id subTotalWithTax
                }
            }
        `) as any;
        return res.applyFlashSale;
    }

    async function cancelOrderAdmin(orderId: string): Promise<any> {
        return adminClient.query(gql`
            mutation {
                cancelOrder(input: { orderId: "${orderId}" }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
    }

    async function waitFor(pred: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await pred()) return;
            await new Promise(r => setTimeout(r, 120));
        }
        throw new Error('Timed out waiting for condition');
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

        // 结算基准统一为「含税价」，使秒杀价折让额可精确推算
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

        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // 一张无参数促销「秒杀价」= flash_sale_discount 条件 + flash_sale_price 动作，
        // 活动配置运行时动态读取，无需随活动维护促销。
        const promo = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "Flash sale price", description: "flash sale price" }]
                    conditions: [{ code: "flash_sale_discount", arguments: [] }]
                    actions: [{ code: "flash_sale_price", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        expect(promo.createPromotion.id).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；初始无活动', async () => {
        expect(server.app).toBeDefined();
        const adminRes = await adminClient.query(gql`
            query { flashSaleActivities(options: { take: 10 }) { items { id } totalItems } }
        `) as any;
        expect(adminRes.flashSaleActivities.totalItems).toBe(0);

        const shopRes = await shopClient.query(gql`
            query { activeFlashSaleActivities { id } }
        `) as any;
        expect(shopRes.activeFlashSaleActivities).toEqual([]);
    });

    it('状态机初始态：upcoming 活动（未来开始）不入列表、shop 不展示', async () => {
        const future = new Date(Date.now() + 3600_000).toISOString();
        const act = await createActivity({ startAt: future });
        expect(act.status).toBe('upcoming');

        const shopRes = await shopClient.query(gql`
            query { activeFlashSaleActivities { id status } }
        `) as any;
        expect(shopRes.activeFlashSaleActivities).toEqual([]);
    });

    it('抢购全链路：秒杀价生效 + 支付成功 + soldCount 精确占用（无双计）', async () => {
        const act = await createActivity({});
        const order = await freshOrder(shopClient);
        expect(order.subTotalWithTax).toBe(ORIGINAL_PRICE);

        const res = await grab(shopClient, act.id);
        expect(String(res.id)).toBe(String(order.id));

        const after = await getActiveOrder(shopClient);
        // 秒杀价把该行价格落到 flashPrice
        expect(after.subTotalWithTax).toBe(FLASH_PRICE_A);
        const amounts = after.discounts.map((d: any) => d.amountWithTax);
        expect(amounts).toContain(-(ORIGINAL_PRICE - FLASH_PRICE_A));

        // 支付成功
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        expect(paid.id).toBe(order.id);

        // 库存双计修复：支付（OrderPlaced）后 soldCount 仍精确 = 占用件数 1
        const actAfter = await getActivity(act.id);
        expect(actAfter.soldCount).toBe(1);
        expect(actAfter.status).toBe('active');
    });

    it('动态取价：同变体不同活动分别生效对应秒杀价（非硬编码）', async () => {
        const actA = await createActivity({ flashPrice: FLASH_PRICE_A });
        const actB = await createActivity({ flashPrice: FLASH_PRICE_B });

        // 抢活动 A → 89900
        const o1 = await freshOrder(shopClient);
        await grab(shopClient, actA.id);
        let ao = await getActiveOrder(shopClient);
        expect(ao.subTotalWithTax).toBe(FLASH_PRICE_A);

        // 换新单抢活动 B → 109900
        const o2 = await freshOrder(shopClient);
        expect(String(o2.id)).not.toBe(String(o1.id));
        await grab(shopClient, actB.id);
        ao = await getActiveOrder(shopClient);
        expect(ao.subTotalWithTax).toBe(FLASH_PRICE_B);
        const amounts = ao.discounts.map((d: any) => d.amountWithTax);
        expect(amounts).toContain(-(ORIGINAL_PRICE - FLASH_PRICE_B));
    });

    it('限购拦截：limitPerUser=1 → 第一单成功，第二单 Purchase limit exceeded', async () => {
        const act = await createActivity({ totalStock: 10, limitPerUser: 1 });

        // 第一单抢购并支付（落单计入限购）
        const o1 = await freshOrder(shopClient);
        await grab(shopClient, act.id);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);

        // 第二单（新 active order）被限购拦截
        const o2 = await freshOrder(shopClient);
        expect(String(o2.id)).not.toBe(String(o1.id));
        await assertThrowsWithMessage(async () => grab(shopClient, act.id), 'Purchase limit exceeded');
    });

    it('售罄：原子防超卖拒绝超量 + 占满即 ended + 最后一单仍享秒杀价', async () => {
        const act = await createActivity({ totalStock: 2, limitPerUser: 10 });

        // 单1：抢 1 件并支付 → soldCount=1，仍 active
        const o1 = await freshOrder(shopClient);
        await grab(shopClient, act.id);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        let a = await getActivity(act.id);
        expect(a.soldCount).toBe(1);
        expect(a.status).toBe('active');

        // 单2：抢 2 件（超剩余 1）→ 原子守卫拒绝 Sold out，soldCount 不变
        const o2 = await freshOrder(shopClient, variantId, 2);
        expect(o2.subTotalWithTax).toBe(ORIGINAL_PRICE * 2);
        await assertThrowsWithMessage(async () => grab(shopClient, act.id), 'Sold out');
        a = await getActivity(act.id);
        expect(a.soldCount).toBe(1);
        expect(a.status).toBe('active');

        // 单3：抢 1 件 → soldCount=2=totalStock → 售罄即时 ended；且最后一单仍享秒杀价
        const o3 = await freshOrder(shopClient);
        await grab(shopClient, act.id);
        a = await getActivity(act.id);
        expect(a.soldCount).toBe(2);
        expect(a.status).toBe('ended');
        const ao3 = await getActiveOrder(shopClient);
        expect(ao3.subTotalWithTax).toBe(FLASH_PRICE_A);
    });

    it('取消回滚：抢购占用 + 取消 → soldCount 回落，可重新抢购', async () => {
        const act = await createActivity({ totalStock: 1, limitPerUser: 5 });

        // 抢购占用
        const o1 = await freshOrder(shopClient);
        await grab(shopClient, act.id);
        let a = await getActivity(act.id);
        expect(a.soldCount).toBe(1);

        // 取消订单 → 事件处理器按实际件数回滚
        await cancelOrderAdmin(o1.id);
        await waitFor(async () => (await getActivity(act.id)).soldCount === 0);
        a = await getActivity(act.id);
        expect(a.soldCount).toBe(0);

        // 可重新抢购
        const o2 = await freshOrder(shopClient);
        const res = await grab(shopClient, act.id);
        expect(String(res.id)).toBe(String(o2.id));
        a = await getActivity(act.id);
        expect(a.soldCount).toBe(1);
    });

    it('校验拦截：未开始 / 已结束 / 订单不含秒杀变体', async () => {
        // 1) 未开始（upcoming，status != active）
        const future = new Date(Date.now() + 3600_000).toISOString();
        const actFuture = await createActivity({ startAt: future });
        const o1 = await freshOrder(shopClient);
        await assertThrowsWithMessage(async () => grab(shopClient, actFuture.id), 'Activity is not active');

        // 2) 已结束（active 活动把 startAt 改到未来 → 窗口校验拦截）
        const actNotStart = await createActivity({});
        const future2 = new Date(Date.now() + 3600_000).toISOString();
        await adminClient.query(gql`
            mutation { updateFlashSaleActivity(input: { id: "${actNotStart.id}", startAt: "${future2}" }) { id status } }
        `);
        const o2 = await freshOrder(shopClient);
        await assertThrowsWithMessage(async () => grab(shopClient, actNotStart.id), 'Activity has not started');

        // 3) 已结束（active 活动把 endAt 改到过去 → 窗口校验拦截）
        const actPast = await createActivity({});
        const past = new Date(Date.now() - 3600_000).toISOString();
        await adminClient.query(gql`
            mutation { updateFlashSaleActivity(input: { id: "${actPast.id}", endAt: "${past}" }) { id status } }
        `);
        const o3 = await freshOrder(shopClient);
        await assertThrowsWithMessage(async () => grab(shopClient, actPast.id), 'Activity has ended');

        // 4) 订单不含秒杀变体行
        const actH = await createActivity({});
        const o4 = await freshOrder(shopClient, variant2Id);
        await assertThrowsWithMessage(
            async () => grab(shopClient, actH.id),
            'Order does not contain the flash sale variant',
        );
    });
});
