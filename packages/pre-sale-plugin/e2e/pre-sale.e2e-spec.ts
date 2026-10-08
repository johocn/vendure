import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { PaymentSchedulePlugin } from '@vendure/payment-schedule-plugin';
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
        plugins: [PreSalePlugin.init({}), PaymentSchedulePlugin.init({})],
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
        depositKind?: string;
        tailTriggerType?: string;
        groupBuyActivityId?: number;
        tailStartAt?: string;
        graceHours?: number;
        earnestRefundPolicy?: string;
        shipDeadlineAt?: string;
    }): Promise<string> {
        const mode = input.mode ?? 'deposit';
        const presalePrice = input.presalePrice ?? 0;
        // 默认定金 15000：合规（≤ 基准价 20%——presalePrice=0 时 cap 25980、presalePrice=99900 时 cap 19980）
        const depositAmount = input.depositAmount ?? 15000;
        const totalStock = input.totalStock ?? 100;
        const limitPerUser = input.limitPerUser ?? 10;
        // 可选字段逐条拼接（undefined 不输出，避免 gql 模板出现 "undefined" 字面量）
        const optional = [
            input.depositKind ? `depositKind: "${input.depositKind}"` : '',
            input.tailTriggerType ? `tailTriggerType: "${input.tailTriggerType}"` : '',
            input.groupBuyActivityId != null ? `groupBuyActivityId: ${input.groupBuyActivityId}` : '',
            input.tailStartAt ? `tailStartAt: "${input.tailStartAt}"` : '',
            input.graceHours != null ? `graceHours: ${input.graceHours}` : '',
            input.earnestRefundPolicy ? `earnestRefundPolicy: ${input.earnestRefundPolicy}` : '',
            input.shipDeadlineAt ? `shipDeadlineAt: "${input.shipDeadlineAt}"` : '',
        ]
            .filter(Boolean)
            .join('\n                    ');
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
                    ${optional}
                    productId: "${variantId}"
                    variantId: "${variantId}"
                }) { id name mode status soldCount totalStock depositAmount presalePrice depositKind tailTriggerType graceHours }
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
        // 价格分档活动（presalePrice=99900 < 原价 129900），deposit 定金 15000（合规默认值）
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

    it('合规硬点：定金超出基准价 20% 拒绝保存；恰好 20% 可保存', async () => {
        // 基准价 = presalePrice(99900) > 0 时用预售价；cap = floor(99900 * 0.2) = 19980
        await assertShopError(
            () =>
                adminClient.query(gql`
                    mutation {
                        createPreSaleActivity(input: {
                            name: "超限-${seq++}"
                            mode: deposit
                            startAt: "${ts(-60)}"
                            endAt: "${ts(24 * 60)}"
                            presalePrice: ${PRESALE_PRICE}
                            depositAmount: 19990
                            totalStock: 10
                            productId: "${variantId}"
                            variantId: "${variantId}"
                        }) { id }
                    }
                `),
            '20%',
        );
        // 恰好 cap：可保存
        const ok = (await adminClient.query(gql`
            mutation {
                createPreSaleActivity(input: {
                    name: "合规-${seq++}"
                    mode: deposit
                    startAt: "${ts(-60)}"
                    endAt: "${ts(24 * 60)}"
                    presalePrice: ${PRESALE_PRICE}
                    depositAmount: 19980
                    totalStock: 10
                    productId: "${variantId}"
                    variantId: "${variantId}"
                }) { id depositKind tailTriggerType graceHours agreementVersion }
            }
        `)) as any;
        expect(ok.createPreSaleActivity.id).toBeDefined();
        // presalePrice=0 → 基准价 = variant 原价 129900；cap = 25980；25981 拒绝
        await assertShopError(
            () =>
                adminClient.query(gql`
                    mutation {
                        createPreSaleActivity(input: {
                            name: "原价超限-${seq++}"
                            mode: deposit
                            startAt: "${ts(-60)}"
                            endAt: "${ts(24 * 60)}"
                            presalePrice: 0
                            depositAmount: 25981
                            totalStock: 10
                            productId: "${variantId}"
                            variantId: "${variantId}"
                        }) { id }
                    }
                `),
            '20%',
        );
    });

    it('applyPreSale 生成期次实例：deposit 双项（定金 payable + 尾款 locked）', async () => {
        const actId = await createActivity({
            presalePrice: PRESALE_PRICE,
            depositAmount: 19980,
            tailTriggerType: 'date',
            tailStartAt: ts(-1),
            graceHours: 72,
        });
        const orderId = await applyPreSale(actId);
        const res = (await shopClient.query(gql`
            query {
                paymentSchedule(orderId: "${orderId}") {
                    id scenario status depositRule totalAmount paidTotal
                    items { seq kind amount status allowCod graceHours trigger dueAt }
                }
            }
        `)) as any;
        const sched = res.paymentSchedule;
        expect(sched.scenario).toBe('presale');
        expect(sched.status).toBe('pending');
        expect(sched.depositRule.kind).toBe('legal_deposit');
        expect(sched.items).toHaveLength(2);
        expect(sched.items[0]).toMatchObject({ seq: 1, kind: 'deposit', amount: 19980, status: 'payable' });
        expect(sched.items[1]).toMatchObject({ seq: 2, kind: 'balance', amount: PRESALE_PRICE - 19980, status: 'locked' });
        // trigger 经 GraphQL JSON 标量返回对象（兼容字符串形态）
        const balTrigger =
            typeof sched.items[1].trigger === 'string' ? JSON.parse(sched.items[1].trigger) : sched.items[1].trigger;
        expect(balTrigger.type).toBe('date');
        expect(sched.totalAmount).toBe(PRESALE_PRICE);
        expect(sched.paidTotal).toBe(0);
    });

    it('applyPreSale 生成期次实例：full 单 balance 项（首期立即可付）', async () => {
        const actId = await createActivity({ mode: 'full', presalePrice: PRESALE_PRICE });
        const orderId = await applyPreSale(actId);
        const res = (await shopClient.query(gql`
            query {
                paymentSchedule(orderId: "${orderId}") {
                    scenario items { seq kind amount status }
                }
            }
        `)) as any;
        const sched = res.paymentSchedule;
        expect(sched.items).toHaveLength(1);
        expect(sched.items[0]).toMatchObject({ seq: 1, kind: 'balance', amount: PRESALE_PRICE, status: 'payable' });
    });

    it('applyPreSale 生成期次实例：earnest 订金性质落入 depositRule', async () => {
        const actId = await createActivity({
            presalePrice: PRESALE_PRICE,
            depositAmount: 19980,
            depositKind: 'earnest',
            earnestRefundPolicy: '{ onTimeout: "full" }',
        });
        const orderId = await applyPreSale(actId);
        const res = (await shopClient.query(gql`
            query { paymentSchedule(orderId: "${orderId}") { depositRule items { seq kind status } } }
        `)) as any;
        expect(res.paymentSchedule.depositRule.kind).toBe('earnest');
        expect(res.paymentSchedule.depositRule.earnestRefundPolicy).toEqual({ onTimeout: 'full' });
    });
});