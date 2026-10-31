import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { LanguageCode, mergeConfig, PaymentMethodHandler, Injector, RequestContext, Channel, TransactionalConnection } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import {
    PaymentSchedulePlugin,
    PaymentScheduleJob,
    PaymentScheduleService,
    OrderPaymentSchedule,
    OrderScheduleItem,
} from '@vendure/payment-schedule-plugin';
import { GroupBuyActivity, GroupBuyPlugin } from '@vendure/group-buy-plugin';
import { PreSalePlugin } from '@vendure/pre-sale-plugin';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 内联 COD handler：createPayment 返回 Authorized（送达收款），settlePayment 恒成功 */
const testCodHandler = new PaymentMethodHandler({
    code: 'test-cod',
    description: [{ languageCode: LanguageCode.en, value: 'Test COD handler' }],
    args: {},
    createPayment: (ctx, order, amount, args, metadata) => ({
        amount,
        state: 'Authorized' as const,
        transactionId: `cod-${order.code}`,
        metadata,
    }),
    settlePayment: async () => ({ success: true }),
});

/**
 * 期次调度主流程 e2e：
 * 预售期次生成/薄壳（详见 pre-sale e2e）→ 此处覆盖通用调度：
 * date 触发 / 通用 paySchedulePeriod / COD 环 / 买家违约（定金没收·订金退款）/
 * cancelSchedule / 团购成团与失败 / 卖家违约双倍返还。
 */
describe('PaymentSchedulePlugin · 期次调度主流程', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [PaymentSchedulePlugin.init({}), PreSalePlugin.init({}), GroupBuyPlugin.init({})],
        paymentOptions: { paymentMethodHandlers: [singleStageRefundablePaymentMethod, testCodHandler] },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const PAY_METHOD = singleStageRefundablePaymentMethod.code;
    const PRESALE_PRICE = 99900; // Laptop 13" 预售价（pricesIncludeTax=true）

    let variantId: string;
    let seq = 0;

    /* ------------------------- helpers ------------------------- */

    function ts(offsetMinutes: number): string {
        return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
    }

    /** e2e 修正：测试环境 TestingEntityIdStrategy 把 GraphQL ID 编码为 "T_<n>"；写入 Int 列（groupBuyActivityId）前须还原数字 */
    function numericId(id: string): number {
        return Number(String(id).replace('T_', ''));
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
        depositAmount?: number;
        depositKind?: string;
        tailTriggerType?: string;
        groupBuyActivityId?: number;
        tailStartAt?: string;
        graceHours?: number;
        earnestRefundPolicy?: string;
        shipDeadlineAt?: string;
    }): Promise<string> {
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
                    name: "调度-${seq++}"
                    mode: deposit
                    startAt: "${ts(-60)}"
                    endAt: "${ts(24 * 60)}"
                    presalePrice: ${PRESALE_PRICE}
                    depositAmount: ${input.depositAmount ?? 19980}
                    totalStock: 50
                    ${optional}
                    productId: "${variantId}"
                    variantId: "${variantId}"
                }) { id status }
            }
        `)) as any;
        return res.createPreSaleActivity.id as string;
    }

    async function createGroupBuyActivity(input: { targetCount: number; endAt: string }): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createGroupBuyActivity(input: {
                    name: "团购-${seq++}"
                    description: "e2e"
                    targetCount: ${input.targetCount}
                    startAt: "${ts(-60)}"
                    endAt: "${input.endAt}"
                    groupPrice: 89900
                    productId: "${variantId}"
                    variantId: "${variantId}"
                }) { id status }
        }
    `)) as any;
        return res.createGroupBuyActivity.id as string;
    }

    /**
     * 活动期次化下单：freshOrder + applyPreSale，返回 orderId。
     * e2e 修正：applyPreSale 后推进到 ArrangingPayment（payPreSaleDeposit/paySchedulePeriod
     * 的前置状态校验要求）；用 0 元运费保持「订单总额 == 期次合计」（与 pre-sale e2e 同手法）。
     */
    async function applyPreSale(activityId: string): Promise<string> {
        const active = (await shopClient.query(gql`
            query { activeOrder { id } }
        `)) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } } }
            `);
        }
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                ... on Order { id } ... on ErrorResult { errorCode message }
            } }
        `);
        const res = (await shopClient.query(gql`
            mutation { applyPreSale(activityId: "${activityId}") { id state } }
        `)) as any;
        const orderId = res.applyPreSale.id as string;
        await proceedToArrangingPaymentFree(shopClient);
        return orderId;
    }

    /**
     * 免运费进 ArrangingPayment：期次金额在 applyPreSale 时快照（未含运费），
     * 挂带价运费会使订单总额大于期次合计，PaymentSettled 的 settled-payments 覆盖校验会失败。
     */
    async function proceedToArrangingPaymentFree(client: SimpleGraphQLClient): Promise<string> {
        const { eligibleShippingMethods } = (await client.query(gql`
            query { eligibleShippingMethods { id name priceWithTax } }
        `)) as any;
        const idx = eligibleShippingMethods.findIndex((m: any) => m.name === 'Free Shipping');
        return proceedToArrangingPayment(client, idx);
    }

    async function scheduleOf(orderId: string): Promise<any> {
        const res = (await shopClient.query(gql`
            query {
                paymentSchedule(orderId: "${orderId}") {
                    id status breachType depositRule totalAmount paidTotal
                    items { seq kind amount status allowCod }
                }
            }
        `)) as any;
        return res.paymentSchedule;
    }

    async function adminSchedule(scheduleId: string): Promise<any> {
        const res = (await adminClient.query(gql`
            query {
                adminPaymentSchedule(id: "${scheduleId}") {
                    id status breachType items { seq kind status }
                }
            }
        `)) as any;
        return res.adminPaymentSchedule;
    }
    // 注：adminPaymentSchedule 供调试使用；用例断言统一走 shop 端 scheduleOf（requireOwner 不适用于 admin 查询）

    async function runScan(): Promise<{ activated: number; overdue: number; shipBreaches: number }> {
        const res = (await adminClient.query(gql`
            mutation { runScheduleScan { activated overdue shipBreaches } }
        `)) as any;
        return res.runScheduleScan;
    }

    /** 返回 order { state, payments[{ state, refunds[{ total }] }] } */
    async function orderState(id: string): Promise<any> {
        const res = (await adminClient.query(gql`
            query { order(id: "${id}") { state payments { state refunds { total } } } }
        `)) as any;
        return res.order;
    }

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

    /** 违约扫描依赖 now > dueAt+graceHours；graceHours=0 时预留 1s 时钟余量 */
    async function tick(seconds = 1): Promise<void> {
        await new Promise(r => setTimeout(r, seconds * 1000));
    }

    /* ------------------------- beforeAll / afterAll ------------------------- */

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    { name: PAY_METHOD, handler: { code: PAY_METHOD, arguments: [] } },
                    { name: testCodHandler.code, handler: { code: testCodHandler.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        // e2e 修正：与 pre-sale e2e 同款 0 元运费方式（订单总额须等于期次合计）
        await adminClient.query(gql`
            mutation {
                createShippingMethod(input: {
                    code: "free-shipping"
                    fulfillmentHandler: "manual-fulfillment"
                    checker: { code: "default-shipping-eligibility-checker", arguments: [{ name: "orderMinimum", value: "0" }] }
                    calculator: { code: "default-shipping-calculator", arguments: [
                        { name: "rate", value: "0" }
                        { name: "includesTax", value: "auto" }
                        { name: "taxRate", value: "0" }
                    ] }
                    translations: [{ languageCode: en, name: "Free Shipping" }]
                }) { id }
            }
        `);

        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('date 触发 + 通用 paySchedulePeriod：扫描解锁尾款期，直付到期次', async () => {
        const actId = await createActivity({ tailTriggerType: 'date', tailStartAt: ts(-1) });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        const scan = await runScan();
        expect(scan.activated).toBeGreaterThanOrEqual(1);
        let sched = await scheduleOf(orderId);
        expect(sched.items[1].status).toBe('payable');

        const res = (await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: 2, method: "${PAY_METHOD}") { status items { seq status } } }
        `)) as any;
        expect(res.paySchedulePeriod.status).toBe('completed');
        expect(await orderState(orderId)).toMatchObject({ state: 'PaymentSettled' } as any);
        sched = await scheduleOf(orderId);
        expect(sched.items[1].status).toBe('paid');
    });

    it('COD 环：Authorized 授权留待确认 → confirmCodReceived 收款收口', async () => {
        const actId = await createActivity({ tailTriggerType: 'manual' });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        const sched = await scheduleOf(orderId);
        await adminClient.query(gql`mutation { openTailWindow(scheduleId: "${sched.id}") { id } }`);

        // COD 支付尾款期：item 留 payable（paymentId 不在 API 暴露，经 confirmCodReceived
        // 成功反证授权已登记——无 pending COD 时该 mutation 会抛错），订单不动
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: 2, method: "test-cod") { id } }
        `);
        let after = await scheduleOf(orderId);
        expect(after.items[1].status).toBe('payable');
        expect((await orderState(orderId)).state).toBe('Deposited');

        // 管理员签收确认 → settle → PaymentSettled
        await adminClient.query(gql`mutation { confirmCodReceived(orderId: "${orderId}") { id } }`);
        after = await scheduleOf(orderId);
        expect(after.items[1].status).toBe('paid');
        expect((await orderState(orderId)).state).toBe('PaymentSettled');
    });

    it('买家超时未付定金（legal_deposit）：没收 + 订单取消 + 库存释放', async () => {
        const actId = await createActivity({ graceHours: 0 });
        const orderId = await applyPreSale(actId); // 不付定金
        await tick();
        const scan = await runScan();
        expect(scan.overdue).toBeGreaterThanOrEqual(1);

        const sched = await scheduleOf(orderId);
        expect(sched.status).toBe('breached');
        expect(sched.breachType).toBe('buyer_timeout');
        expect(sched.items[0].status).toBe('forfeited');
        expect((await orderState(orderId)).state).toBe('Cancelled');
        // 库存释放（pre-sale 订阅订单取消）
        const act = (await adminClient.query(gql`
            query { preSaleActivity(id: "${actId}") { soldCount } }
        `)) as any;
        expect(act.preSaleActivity.soldCount).toBe(0);
    });

    it('买家超时未付订金（earnest）：期次 overdue + 订单取消（未付款无退款）；已付订金经 cancelSchedule 按策略退（全额/比例）', async () => {
        // e2e 修正：订金期未付超时 → overdue → 调度 cancelled（无已支付款，不产生退款）；
        // earnestRefundPolicy 传 GraphQL object 字面量（JSON 标量），unquoted 值会被 parseLiteral 丢弃。
        // 已付款下的策略退款走 cancelSchedule（applyBreachAction 只扫 payable 期，已付期不进违约扫描）。
        // A) 超时未付订金 → overdue + buyer_timeout + 订单取消
        const actTimeout = await createActivity({ depositKind: 'earnest', graceHours: 0 });
        const orderTimeout = await applyPreSale(actTimeout); // 不付订金
        await tick();
        const scan = await runScan();
        expect(scan.overdue).toBeGreaterThanOrEqual(1);
        const schedTimeout = await scheduleOf(orderTimeout);
        expect(schedTimeout.items[0].status).toBe('overdue');
        expect(schedTimeout.status).toBe('cancelled');
        expect(schedTimeout.breachType).toBe('buyer_timeout');
        expect((await orderState(orderTimeout)).state).toBe('Cancelled');

        // B) 全额策略（显式 onTimeout: full）：付订金后主动取消 → 全额退
        const actFull = await createActivity({
            depositKind: 'earnest',
            earnestRefundPolicy: '{ onTimeout: "full" }',
            tailTriggerType: 'manual',
        });
        const orderFull = await applyPreSale(actFull);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderFull}", method: "${PAY_METHOD}") { id state } }
        `);
        const fullRes = (await shopClient.query(gql`
            mutation { cancelSchedule(orderId: "${orderFull}") { status items { seq status } } }
        `)) as any;
        expect(fullRes.cancelSchedule.status).toBe('cancelled');
        expect(fullRes.cancelSchedule.items[0].status).toBe('refunded');
        const fullOrder = await orderState(orderFull);
        expect(fullOrder.state).toBe('Cancelled');
        expect(fullOrder.payments[0].refunds.map((r: any) => r.total)).toContain(19980);

        // C) 比例策略（partial, 0.5）：付订金后主动取消 → 退 50%
        const actPart = await createActivity({
            depositKind: 'earnest',
            earnestRefundPolicy: '{ onTimeout: "partial", partialRate: 0.5 }',
            tailTriggerType: 'manual',
        });
        const orderPart = await applyPreSale(actPart);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderPart}", method: "${PAY_METHOD}") { id state } }
        `);
        await shopClient.query(gql`
            mutation { cancelSchedule(orderId: "${orderPart}") { status items { seq status } } }
        `);
        const partOrder = await orderState(orderPart);
        expect(partOrder.state).toBe('Cancelled');
        expect(partOrder.payments[0].refunds.map((r: any) => r.total)).toContain(9990);
    });

    it('cancelSchedule：定金须确认罚则；订金主动取消退全款', async () => {
        // 定金：未付 → confirmForfeit=false 报错；true → 取消
        const actLegal = await createActivity({ tailTriggerType: 'manual' });
        const orderLegal = await applyPreSale(actLegal);
        await assertShopError(
            () => shopClient.query(gql`mutation { cancelSchedule(orderId: "${orderLegal}") { id } }`),
            'confirmforfeit',
        );
        await shopClient.query(gql`
            mutation { cancelSchedule(orderId: "${orderLegal}", confirmForfeit: true) { status items { seq status } } }
        `);
        expect((await orderState(orderLegal)).state).toBe('Cancelled');
        const legalSched = await scheduleOf(orderLegal);
        expect(legalSched.items[0].status).toBe('waived'); // 未付定金 → waived（无款可没）

        // 订金：已付 → 主动取消全额退
        const actEarnest = await createActivity({ depositKind: 'earnest', tailTriggerType: 'manual' });
        const orderEarnest = await applyPreSale(actEarnest);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderEarnest}", method: "${PAY_METHOD}") { id state } }
        `);
        await shopClient.query(gql`
            mutation { cancelSchedule(orderId: "${orderEarnest}") { status items { seq status } } }
        `);
        const earnestSched = await scheduleOf(orderEarnest);
        expect(earnestSched.items[0].status).toBe('refunded');
        const earnestOrder = await orderState(orderEarnest);
        expect(earnestOrder.payments[0].refunds.map((r: any) => r.total)).toContain(19980);
    });

    it('团购成团事件触发：group_buy 尾款期 locked → payable', async () => {
        const gbId = await createGroupBuyActivity({ targetCount: 1, endAt: ts(60) });
        const actId = await createActivity({
            tailTriggerType: 'group_buy',
            groupBuyActivityId: numericId(gbId),
        });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        // 参团（targetCount=1 → 即刻成团 → GroupBuyCompletedEvent → 期次解锁）
        await shopClient.query(gql`
            mutation { joinGroupBuy(activityId: "${gbId}", orderId: "${orderId}", isLeader: true) { status } }
        `);
        // e2e 修正：事件订阅处理器为异步，留出时钟余量再断言
        await tick();
        const sched = await scheduleOf(orderId);
        expect(sched.items[1].status).toBe('payable');
    });

    /**
     * H：团购成团事件以「活动自身关联渠道」为准解锁期次（不依赖事件 ctx.channelId），
     * 其它渠道的期次必须保持不变；同一渠道的正常流转不受影响。
     */
    it('团购成团事件：只解锁活动所属渠道的期次，跨渠道期次不变', async () => {
        await adminClient.asSuperAdmin();
        const ch1Id = ((await adminClient.query(gql`query { channels { items { id code } } }`)) as any).channels.items[0]
            .id as string;

        // 渠道1：活动 A + 期次 A（期望正常解锁）
        const gbA = await createGroupBuyActivity({ targetCount: 1, endAt: ts(60) });
        const actA = await createActivity({ tailTriggerType: 'group_buy', groupBuyActivityId: numericId(gbA) });
        const orderA = await applyPreSale(actA);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderA}", method: "${PAY_METHOD}") { id state } }
        `);

        // 渠道1：活动 B + 期次 B（随后整体迁到渠道2，模拟另一渠道的数据）
        const gbB = await createGroupBuyActivity({ targetCount: 1, endAt: ts(60) });
        const actB = await createActivity({ tailTriggerType: 'group_buy', groupBuyActivityId: numericId(gbB) });
        const orderB = await applyPreSale(actB);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderB}", method: "${PAY_METHOD}") { id state } }
        `);

        const zoneId = ((await adminClient.query(gql`query { zones { items { id } } }`)) as any).zones.items[0].id;
        await adminClient.query(gql`
            mutation { createChannel(input: {
                code: "ps-ch2-gb" token: "ps-ch2-gb-token"
                defaultLanguageCode: en
                pricesIncludeTax: true
                defaultCurrencyCode: USD
                defaultTaxZoneId: "${zoneId}"
                defaultShippingZoneId: "${zoneId}"
            }) { ... on Channel { id } } }
        `);

        const raw = server.app.get(TransactionalConnection).rawConnection;
        // 手工构造 RequestContext 需带上税区/运费区关系，否则订单取价报 no-active-tax-zone
        const channelRelations = { defaultTaxZone: true, defaultShippingZone: true } as const;
        const ch1 = await raw.getRepository(Channel).findOne({ where: { id: numericId(ch1Id) }, relations: channelRelations });
        const ch2 = await raw
            .getRepository(Channel)
            .findOne({ where: { code: 'ps-ch2-gb' }, relations: channelRelations });
        expect(ch1 && ch2).toBeTruthy();

        const activityRepo = raw.getRepository(GroupBuyActivity);
        const activityB = await activityRepo.findOne({
            where: { id: numericId(gbB) },
            relations: { channels: true },
        });
        activityB!.channels = [ch2!];
        await activityRepo.save(activityB!);

        const scheduleRepo = raw.getRepository(OrderPaymentSchedule);
        const scheduleB = await scheduleRepo.findOne({ where: { orderId: numericId(orderB) } });
        scheduleB!.channelId = ch2!.id as number;
        scheduleB!.channels = [ch2!];
        await scheduleRepo.save(scheduleB!);

        const itemRepo = raw.getRepository(OrderScheduleItem);
        const itemStatus = async (scheduleId: number, seq: number) =>
            (await itemRepo.findOne({ where: { scheduleId, seq } }))?.status;

        const svc = server.app.get(PaymentScheduleService);
        const ctxCh1 = new RequestContext({
            apiType: 'admin',
            channel: ch1!,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const ctxCh2 = new RequestContext({
            apiType: 'admin',
            channel: ch2!,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });

        // 只触发活动 B（属渠道2）→ B 解锁；渠道1 的 A 保持不变
        const nB = await svc.handleGroupBuyCompleted(ctxCh2, numericId(gbB));
        expect(nB).toBe(1);
        expect(await itemStatus(scheduleB!.id as number, 2)).toBe('payable');
        expect((await scheduleOf(orderA)).items[1].status).toBe('locked');

        // 再触发活动 A（渠道1）→ 本渠道期次正常流转
        const nA = await svc.handleGroupBuyCompleted(ctxCh1, numericId(gbA));
        expect(nA).toBe(1);
        expect((await scheduleOf(orderA)).items[1].status).toBe('payable');
    });

    it('团购失败：已付期次全额退 + 调度 breached(group_buy_failed) + 订单取消', async () => {
        const gbId = await createGroupBuyActivity({ targetCount: 2, endAt: ts(-5) }); // 已过期且不成团
        const actId = await createActivity({
            tailTriggerType: 'group_buy',
            groupBuyActivityId: numericId(gbId),
        });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        await runScan(); // 触发扫描兜底：group_buy 活动 active 且 endAt<now → failed

        const sched = await scheduleOf(orderId);
        expect(sched.status).toBe('breached');
        expect(sched.breachType).toBe('group_buy_failed');
        expect(sched.items[0].status).toBe('refunded');
        const order = await orderState(orderId);
        expect(order.state).toBe('Cancelled');
        expect(order.payments[0].refunds.map((r: any) => r.total)).toContain(19980);
    });

    it('卖家超期未发货：runScheduleScan 标记 seller_breach → confirmSellerBreach 双倍返还', async () => {
        const actId = await createActivity({ tailTriggerType: 'manual', shipDeadlineAt: ts(-5) });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        const scan = await runScan();
        expect(scan.shipBreaches).toBeGreaterThanOrEqual(1);
        const sched = await scheduleOf(orderId);
        expect(sched.breachType).toBe('seller_breach');

        const res = (await adminClient.query(gql`
            mutation { confirmSellerBreach(scheduleId: "${sched.id}") { status items { seq status } } }
        `)) as any;
        expect(res.confirmSellerBreach.status).toBe('cancelled');
        expect(res.confirmSellerBreach.items[0].status).toBe('refunded');

        const order = await orderState(orderId);
        expect(order.state).toBe('Cancelled');
        // 双倍返还：本金 + 等额赔偿两笔，合计 2×19980
        const refundTotals = order.payments[0].refunds.map((r: any) => r.total);
        expect(refundTotals.filter((t: number) => t === 19980)).toHaveLength(2);
    });

    /**
     * 权限门禁：生产 manager 角色没有 UpdateOrder，代收 COD / 释放押金改由插件自定义
     * 权限 ManagePaymentSchedule 放行（见 payment-schedule-plugin constants + delivery-plugin RoleSync）。
     * runScheduleScan 同样收敛到 ManagePaymentSchedule，但扫描范围仍限定在请求渠道内。
     * 这里用真实普通管理员（非 superadmin）验证成功路径，并确认只读角色/匿名仍被拒。
     */
    it('权限门禁：真实店长（ManagePaymentSchedule）可确认 COD 收款 + 触发本渠道扫描；只读角色与匿名被拒', async () => {
        await adminClient.asSuperAdmin();
        // 角色/管理员由 superadmin 建（生产环境角色权限由 delivery-plugin RoleSync 增量补齐）
        const mgrRole = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "ps-manager-e2e"
                description: "店长（收付款计划）"
                permissions: [ManagePaymentSchedule, ReadOrder, ReadCustomer]
            }) { id } }
        `)) as any;
        await adminClient.query(gql`
            mutation { createAdministrator(input: {
                firstName: "店长" lastName: "甲" emailAddress: "ps-manager@test.com" password: "ps-manager-123"
                roleIds: ["${mgrRole.createRole.id}"]
            }) { id } }
        `);
        const roRole = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "ps-readonly-e2e" description: "只读（无收付款计划权限）" permissions: [ReadOrder]
            }) { id } }
        `)) as any;
        await adminClient.query(gql`
            mutation { createAdministrator(input: {
                firstName: "只读" lastName: "乙" emailAddress: "ps-readonly@test.com" password: "ps-readonly-123"
                roleIds: ["${roRole.createRole.id}"]
            }) { id } }
        `);

        // 高权限侧造 COD 场景
        const actId = await createActivity({ tailTriggerType: 'manual' });
        const orderId = await applyPreSale(actId);
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${orderId}", method: "${PAY_METHOD}") { id state } }
        `);
        const sched = await scheduleOf(orderId);

        // 真实店长（非 superadmin）：开尾款窗口 → 尾款走 COD → confirmCodReceived
        await adminClient.asUserWithCredentials('ps-manager@test.com', 'ps-manager-123');
        await adminClient.query(gql`mutation { openTailWindow(scheduleId: "${sched.id}") { id } }`);
        await shopClient.query(gql`
            mutation { paySchedulePeriod(orderId: "${orderId}", seq: 2, method: "test-cod") { id } }
        `);
        const confirmed = (await adminClient.query(gql`
            mutation { confirmCodReceived(orderId: "${orderId}") { id status items { seq status } } }
        `)) as any;
        expect(confirmed.confirmCodReceived.items[1].status).toBe('paid');
        expect((await scheduleOf(orderId)).items[1].status).toBe('paid');

        // 店长（ManagePaymentSchedule）现在可手动触发调度扫描（等价于每分钟 ScheduledTask 的同一套 service）
        const mgrScan = await runScan();
        expect(typeof mgrScan.activated).toBe('number');

        // —— 渠道隔离：渠道1 两条已到期 date 计划，店长扫描只解锁本渠道 ——
        await adminClient.asSuperAdmin();
        const ch1OrderA = await applyPreSale(await createActivity({ tailTriggerType: 'date', tailStartAt: ts(-1) }));
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${ch1OrderA}", method: "${PAY_METHOD}") { id state } }
        `);
        const ch1OrderB = await applyPreSale(await createActivity({ tailTriggerType: 'date', tailStartAt: ts(-1) }));
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${ch1OrderB}", method: "${PAY_METHOD}") { id state } }
        `);
        await adminClient.asUserWithCredentials('ps-manager@test.com', 'ps-manager-123');
        const mgrScan1 = await runScan();
        expect(mgrScan1.activated).toBeGreaterThanOrEqual(2);
        expect((await scheduleOf(ch1OrderA)).items[1].status).toBe('payable');
        expect((await scheduleOf(ch1OrderB)).items[1].status).toBe('payable');

        // —— 另建渠道2 + 渠道2 店长：其扫描不得影响渠道1 的计划 ——
        await adminClient.asSuperAdmin();
        const channelMeta = (await adminClient.query(gql`
            query { channels { items { code token } } }
        `)) as any;
        const defaultChannelToken = channelMeta.channels.items[0].token as string;
        const zoneId = ((await adminClient.query(gql`query { zones { items { id } } }`)) as any).zones.items[0].id;
        await adminClient.query(gql`
            mutation { createChannel(input: {
                code: "ps-ch2" token: "ps-ch2-token"
                defaultLanguageCode: en
                pricesIncludeTax: true
                defaultCurrencyCode: USD
                defaultTaxZoneId: "${zoneId}"
                defaultShippingZoneId: "${zoneId}"
            }) { ... on Channel { id token } } }
        `);
        adminClient.setChannelToken('ps-ch2-token');
        const ch2Role = (await adminClient.query(gql`
            mutation { createRole(input: {
                code: "ps-ch2-manager-e2e" description: "渠道2店长" permissions: [ManagePaymentSchedule]
            }) { id } }
        `)) as any;
        await adminClient.query(gql`
            mutation { createAdministrator(input: {
                firstName: "店长" lastName: "丙" emailAddress: "ps-ch2-manager@test.com" password: "ps-ch2-manager-123"
                roleIds: ["${ch2Role.createRole.id}"]
            }) { id } }
        `);
        // 回渠道1：造一条仍为 locked 的计划
        adminClient.setChannelToken(defaultChannelToken);
        const ch1OrderC = await applyPreSale(await createActivity({ tailTriggerType: 'date', tailStartAt: ts(-1) }));
        await shopClient.query(gql`
            mutation { payPreSaleDeposit(orderId: "${ch1OrderC}", method: "${PAY_METHOD}") { id state } }
        `);
        expect((await scheduleOf(ch1OrderC)).items[1].status).toBe('locked');

        // 渠道2 店长扫描 → 只扫渠道2（0 条），渠道1 的 locked 计划不受影响
        await adminClient.asUserWithCredentials('ps-ch2-manager@test.com', 'ps-ch2-manager-123');
        const ch2Scan = await runScan();
        expect(ch2Scan.activated).toBe(0);
        expect((await scheduleOf(ch1OrderC)).items[1].status).toBe('locked');

        // 回渠道1 超管扫描 → 该计划正常解锁（证明未因渠道2 扫描而失效）
        await adminClient.asSuperAdmin();
        adminClient.setChannelToken(defaultChannelToken);
        const saScan = await runScan();
        expect(saScan.activated).toBeGreaterThanOrEqual(1);
        expect((await scheduleOf(ch1OrderC)).items[1].status).toBe('payable');

        // 定时任务路径：ScheduledTask → PaymentScheduleJob.runAllChannels（不经 resolver @Allow），
        // 权限改动不应影响其逐渠道扫描
        const job = server.app.get(PaymentScheduleJob);
        const jobResult = await job.runAllChannels(new Injector(server.app as any));
        expect(typeof jobResult.activated).toBe('number');
        expect(typeof jobResult.overdue).toBe('number');
        expect(typeof jobResult.shipBreaches).toBe('number');

        // 无 ManagePaymentSchedule 的只读角色 → 拒绝
        await adminClient.asUserWithCredentials('ps-readonly@test.com', 'ps-readonly-123');
        await expect(
            adminClient.query(gql`mutation { runScheduleScan { activated overdue shipBreaches } }`),
        ).rejects.toThrow(/not currently authorized/);

        // 匿名 → 拒绝
        await adminClient.asAnonymousUser();
        await expect(
            adminClient.query(gql`mutation { runScheduleScan { activated overdue shipBreaches } }`),
        ).rejects.toThrow(/not currently authorized/);
    });
});
