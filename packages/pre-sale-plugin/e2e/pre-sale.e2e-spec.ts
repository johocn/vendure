import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { PreSalePlugin } from '../src/plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * 阶段32：预售/定金预售 e2e
 * 覆盖：活动创建与状态 / 全款预售一次收清 / 定金→到尾款两阶段 / 预售价格分档(Promotion) /
 *       库存原子扣减与售罄直置 ended / 订单取消回滚库存 / 每人限购 / 到货释放尾款窗口。
 */
describe('PreSalePlugin · 预售/定金预售', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [PreSalePlugin.init({})],
        paymentOptions: { paymentMethodHandlers: [singleStageRefundablePaymentMethod] },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const PAY_METHOD = singleStageRefundablePaymentMethod.code;
    const ORIGINAL_PRICE = 129900; // Laptop 13", pricesIncludeTax=true
    const PRESALE_PRICE = 99900;

    let variantId: string;
    let seq = 0;
    let promoId: string;

    /* ------------------------- helpers ------------------------- */

    function ts(offsetMinutes: number): string {
        return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
    }

    async function setChannelPricesIncludeTax(): Promise<void> {
        const channels = (await adminClient.query(gql`
            query { channels { items { id } } }
        `)) as any;
        const id = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${id}", pricesIncludeTax: true }) { ... on Channel { id } } }
        `);
    }

    async function createActivity(input: {
        presalePrice?: number;
        depositAmount?: number;
        totalStock?: number;
        limitPerUser?: number;
        mode?: string;
    }): Promise<string> {
        const mode = input.mode ?? 'deposit';
        const presalePrice = input.presalePrice ?? 0;
        const depositAmount = input.depositAmount ?? 30000;
        const totalStock = input.totalStock ?? 100;
        const limitPerUser = input.limitPerUser ?? 10;
        const res = (await adminClient.query(gql`
            mutation {
                createPreSaleActivity(input: {
                    name: "预售-${seq++}"
                    mode: ${mode}
                    startAt: "${ts(-60)}"
                    endAt: "${ts(24 * 60)}"
                    presalePrice: ${presalePrice}
                    depositAmount: ${depositAmount}
                    totalStock: ${totalStock}
                    limitPerUser: ${limitPerUser}
                    productId: "${variantId}"
                    variantId: "${variantId}"
                }) { id name mode status soldCount totalStock depositAmount presalePrice }
            }
        `)) as any;
        const act = res.createPreSaleActivity;
        expect(act.status).toBe('active'); // startAt 在过去 → 建单即 active
        return act.id;
    }

    async function activity(id: string): Promise<any> {
        const res = (await adminClient.query(gql`
            query { preSaleActivity(id: "${id}") { id name mode status soldCount totalStock depositAmount presalePrice } }
        `)) as any;
        return res.preSaleActivity;
    }

    async function freshOrder(qty = 1): Promise<string> {
        const active = (await shopClient.query(gql`
            query { activeOrder { id } }
        `)) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } ... on ErrorResult { errorCode message } } }
            `);
        }
        const res = (await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) {
                ... on Order { id totalWithTax }
                ... on ErrorResult { errorCode message }
            } }
        `)) as any;
        return res.addItemToOrder.id as string;
    }

    async function applyPreSale(activityId: string, qty = 1): Promise<string> {
        await freshOrder(qty);
        const res = (await shopClient.query(gql`
            mutation { applyPreSale(activityId: "${activityId}") {
                id state customFields { preSaleActivityId preSaleMode preSaleDepositTotal }
            } }
        `)) as any;
        return res.applyPreSale.id as string;
    }

    /** 断言一次会抛出 UserInputError 的 GraphQL 调用，且 message 命中关键字。 */
    async function assertShopError(fn: () => Promise<any>, substring: string): Promise<void> {
        try {
            await fn();
        } catch (e: any) {
            const msg = e?.response?.errors?.[0]?.message ?? e?.message ?? '';
            expect(msg.toLowerCase()).toContain(substring);
            return;
        }
        throw new Error('Expected the operation to throw, but it succeeded');
    }

    async function applyPreSaleExpectError(activityId: string, substring: string): Promise<void> {
        await assertShopError(
            () => shopClient.query(gql`
                mutation { applyPreSale(activityId: "${activityId}") { id } }
            `),
            substring,
        );
    }

    async function orderState(id: string): Promise<string> {
        const res = (await adminClient.query(gql`
            query { order(id: "${id}") { state } }
        `)) as any;
        return res.order.state as string;
    }

    async function orderLineDiscountedUnitPrice(id: string): Promise<number> {
        const res = (await adminClient.query(gql`
            query { order(id: "${id}") { lines { unitPriceWithTax discountedUnitPriceWithTax quantity } } }
        `)) as any;
        return res.order.lines[0].discountedUnitPriceWithTax as number;
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: PAY_METHOD, handler: { code: PAY_METHOD, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;

        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');

        // 全局启用一条预售价格分档 Promotion：condition pre_sale_discount + action pre_sale_price。
        // 该 condition 只有订单绑定到预售活动且含对应变体时才放行，故不影响普通订单。
        const promo = (await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "预售价格分档", description: "presale price" }]
                    conditions: [{ code: "pre_sale_discount", arguments: [] }]
                    actions: [{ code: "pre_sale_price", arguments: [] }]
                }) { ... on Promotion { id } }
            }
        `)) as any;
        promoId = promo.createPromotion.id;
        expect(promoId).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('活动管理：create/deliver/delete 与状态流转（active→delivered）', async () => {
        const id = await createActivity({ mode: 'deposit', totalStock: 50 });
        // 到货：active → delivered，deposit 模式尾款窗口落在 releaseAt
        const delivered = (await adminClient.query(gql`
            mutation { deliverPreSale(id: "${id}") { id status releaseAt tailStartAt } }
        `)) as any;
        expect(delivered.deliverPreSale.status).toBe('delivered');
        expect(delivered.deliverPreSale.tailStartAt).toBeDefined();
        // 查询可读
        const a = await activity(id);
        expect(a.status).toBe('delivered');
        expect(a.totalStock).toBe(50);
        // 删除
        const del = (await adminClient.query(gql`
            mutation { deletePreSaleActivity(id: "${id}") }
        `)) as any;
        expect(del.deletePreSaleActivity).toBe(true);
    });

    it('时区/窗口：未来活动首屏 activePreSaleActivities 不出现；建单即 active 的活动可被 shop 读取', async () => {
        const id = await createActivity({ mode: 'full' });
        const actives = (await shopClient.query(gql`
            query { activePreSaleActivities { id name mode } }
        `)) as any;
        const found = actives.activePreSaleActivities.some((a: any) => a.id === id);
        expect(found).toBe(true);
    });

    it('全款预售：applyPreSale → ArrangingPayment → payPreSaleFull 一次收清 → PaymentSettled', async () => {
        const id = await createActivity({ mode: 'full', totalStock: 50 });
        const orderId = await applyPreSale(id);
        expect(await orderState(orderId)).toBe('AddingItems');
        const aptId = await proceedToArrangingPayment(shopClient);
        expect(await orderState(aptId)).toBe('ArrangingPayment');
        const paid = (await shopClient.query(gql`
            mutation { payPreSaleFull(orderId: "${aptId}", method: "${PAY_METHOD}") {
                id state customFields { preSaleActivityId preSaleMode }
            } }
        `)) as any;
        expect(paid.payPreSaleFull.state).toBe('PaymentSettled');
        expect(paid.payPreSaleFull.customFields.preSaleMode).toBe('full');
        // 库存已扣减
        expect((await activity(id)).soldCount).toBe(1);
    });

    it('预售价格分档：绑定活动后折扣价 = PRESALE_PRICE（999.00），未生效时原价', async () => {
        // 价格分档活动（presalePrice=99900 < 原价 129900），deposit 定金 30000
        const id = await createActivity({ mode: 'deposit', presalePrice: PRESALE_PRICE });
        const orderId = await applyPreSale(id);
        const aptId = await proceedToArrangingPayment(shopClient);
        expect(await orderLineDiscountedUnitPrice(aptId)).toBe(PRESALE_PRICE);
        // 到货释放尾款窗口
        await adminClient.query(gql`mutation { deliverPreSale(id: "${id}") { id status } }`);
        // 付定金
        const dep = (await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${aptId}", method: "${PAY_METHOD}") { id state } }
        `)) as any;
        expect(dep.payPreSaleDeposit.state).toBe('Deposited');
        // 付尾款（totalWithTax - 定金）
        const tail = (await shopClient.query(gql`
            mutation { payPreSaleTail(orderId: "${aptId}", method: "${PAY_METHOD}") { id state } }
        `)) as any;
        expect(tail.payPreSaleTail.state).toBe('PaymentSettled');
        expect(orderId).toBeTruthy();
    });

    it('定金两阶段支付：未到货不可付尾款；payPreSaleTail 前置校验拦截', async () => {
        const id = await createActivity({ mode: 'deposit', depositAmount: 20000 });
        const orderId = await applyPreSale(id);
        const aptId = await proceedToArrangingPayment(shopClient);
        const dep = (await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${aptId}", method: "${PAY_METHOD}") { id state } }
        `)) as any;
        expect(dep.payPreSaleDeposit.state).toBe('Deposited');
        // 尚未 deliver → 付尾款应被拒绝
        await assertShopError(
            () => shopClient.query(gql`
                mutation { payPreSaleTail(orderId: "${aptId}", method: "${PAY_METHOD}") { id } }
            `),
            'delivered',
        );
        expect(await orderState(aptId)).toBe('Deposited');
        expect(orderId).toBeTruthy();
    });

    it('库存原子扣减与售罄直置 ended；订单取消回滚库存并恢复 active', async () => {
        const id = await createActivity({ mode: 'deposit', totalStock: 2 });
        // 单一订单预购 totalStock=2 件 → soldCount=2=totalStock → 售罄直置 ended
        const o = await applyPreSale(id, 2);
        expect((await activity(id)).soldCount).toBe(2);
        expect((await activity(id)).status).toBe('ended');
        // 已售罄后再抢 → 被拒
        await applyPreSaleExpectError(id, '售罄');
        // 取消该订单 → 回滚 2 件 → soldCount=0，且活动恢复 active（仍在窗口内且未占满）
        await adminClient.query(gql`
            mutation { cancelOrder(input: { orderId: "${o}" }) { ... on Order { id } ... on ErrorResult { errorCode message } } }
        `);
        expect((await activity(id)).soldCount).toBe(0);
        expect((await activity(id)).status).toBe('active');
        expect(o).toBeTruthy();
    });

    it('每人限购：limitPerUser=1 时第二单被拒（购买数超限）', async () => {
        const id = await createActivity({ mode: 'full', totalStock: 5, limitPerUser: 1 });
        const orderId = await applyPreSale(id);
        expect((await activity(id)).soldCount).toBe(1);
        await applyPreSaleExpectError(id, 'limit');
        expect(orderId).toBeTruthy();
    });

    it('活动结束后不可再预售（endAt 过期 → 任务置 ended → 下单被拒）', async () => {
        const id = await createActivity({ mode: 'deposit', totalStock: 50 });
        // 手动把 endAt 拨到过去
        await adminClient.query(gql`
            mutation { updatePreSaleActivity(input: { id: "${id}", endAt: "${ts(-5)}" }) { id endAt } }
        `);
        await applyPreSaleExpectError(id, 'ended');
        expect(promoId).toBeTruthy();
    });
});