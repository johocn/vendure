import { createTestEnvironment, registerInitializer, SimpleGraphQLClient, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig, ChannelService, RequestContext, RequestContextService } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { MemberLevelPlugin } from '../src/plugin';
import { MemberLevelService } from '../src/member-level.service';
import { MemberPointsHistory, PointsHistoryType } from '../src/member-points-history.entity';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('MemberLevelPlugin · 会员积分闭环（赚分/抵现/不足拦截/上限拦截/取消回退/退款回退/过期清理）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let productId: string;
    let variantId: string;
    let customerId: string;
    let memberService: MemberLevelService;
    let requestContextService: RequestContextService;
    let adminCtx: RequestContext;

    // 折算基准：Channel.pointsPerYuan=100（100 积分抵 1 元），pricesIncludeTax=true。
    const ORIGINAL_PRICE = 129900; // 单件含税价（分）
    const POINTS_PER_YUAN = 100;
    // 预置 50000 积分：抵现 10000 → 折扣 10000 分（=100 元），余额充足
    const SEED_POINTS = 50000;
    const REDEEM_POINTS = 10000;
    const REDEEM_AMOUNT = Math.floor(REDEEM_POINTS / POINTS_PER_YUAN) * 100; // = 10000 分

    let seq = 0;

    /* ------------------------- helpers ------------------------- */

    async function setChannelPricesIncludeTax(): Promise<void> {
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
    }

    async function setPointsExpireDays(days: number): Promise<void> {
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `) as any;
        const defaultChannelId = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation {
                updateChannel(input: { id: "${defaultChannelId}", customFields: { pointsExpireDays: ${days} } }) {
                    ... on Channel { id customFields { pointsExpireDays } }
                }
            }
        `);
    }

    async function myInfo(): Promise<any> {
        const res = await shopClient.query(gql`
            query { myMemberInfo { customerId points growthValue level } }
        `) as any;
        return res.myMemberInfo;
    }

    async function getActiveOrder(): Promise<any> {
        const res = await shopClient.query(gql`
            query {
                activeOrder {
                    id subTotalWithTax totalWithTax
                    customFields { pointsToRedeem pointsRedeemAmount }
                    lines { id quantity }
                    discounts { amountWithTax }
                }
            }
        `) as any;
        return res.activeOrder;
    }

    async function resetActiveOrder(): Promise<void> {
        const active = await getActiveOrder();
        if (active?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.id}" }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                } }
            `);
        }
    }

    async function freshOrder(): Promise<any> {
        await resetActiveOrder();
        const res = await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: 1) {
                    ... on Order { id subTotalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `) as any;
        return res.addItemToOrder;
    }

    async function redeem(points: number): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { redeemPoints(points: ${points}) { id subTotalWithTax } }
        `) as any;
        return res.redeemPoints;
    }

    async function cancelActiveOrderAdmin(orderId: string): Promise<void> {
        await adminClient.query(gql`
            mutation { cancelOrder(input: { orderId: "${orderId}" }) {
                ... on Order { id state }
                ... on ErrorResult { errorCode message }
            } }
        `);
    }

    async function myPointsHistory(): Promise<any[]> {
        const res = await shopClient.query(gql`
            query { myPointsHistory(options: { take: 100 }) { items { id type amount balanceBefore balanceAfter orderId remark expiresAt } } }
        `) as any;
        return res.myPointsHistory.items;
    }

    /**
     * 送达闭环：加购→ArrangingPayment→支付→创建 fulfillment→Shipped→Delivered，
     * 触发 Delivered 事件处理器加积分+成长值（expiresAt 随 Channel.pointsExpireDays 落库）。
     * 返回订单 id。
     */
    async function deliverOrder(): Promise<string> {
        await freshOrder();
        const orderId = await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);

        const detail = await adminClient.query(gql`
            query { order(id: "${orderId}") { state lines { id quantity } } }
        `);
        const line = detail.order.lines[0];
        const fulfillment = await adminClient.query(gql`
            mutation {
                addFulfillmentToOrder(input: {
                    lines: [{ orderLineId: "${line.id}", quantity: ${line.quantity} }]
                    handler: { code: "manual-fulfillment" arguments: [
                        { name: "method", value: "standard" }
                        { name: "trackingCode", value: "SF123" }
                    ] }
                }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
            }
        `);
        const fulfillmentId = fulfillment.addFulfillmentToOrder.id;
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Delivered") { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        await adminClient.query(gql`
            mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } ... on ErrorResult { errorCode message } } }
        `);
        const after = await adminClient.query(gql`
            query { order(id: "${orderId}") { id state } }
        `);
        expect(after.order.state).toBe('Delivered');
        return orderId;
    }

    /** 用原始连接把最新一笔 EARN 明细的 expiresAt 改到过去（模拟已过期） */
    async function forceOldestEarnExpired(): Promise<void> {
        const connection = server.app.get(require('@vendure/core').TransactionalConnection);
        const repo = connection.getRepository(adminCtx, MemberPointsHistory);
        const records = await repo
            .createQueryBuilder('mph')
            .where('mph.type = :type', { type: PointsHistoryType.EARN })
            .andWhere('mph.amount > 0')
            .orderBy('mph.id', 'DESC')
            .take(1)
            .getMany();
        if (records.length) {
            records[0].expiresAt = new Date(Date.now() - 60 * 1000);
            await repo.save(records[0]);
        }
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
                    { name: singleStageRefundablePaymentMethod.code, handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] } },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await setChannelPricesIncludeTax();

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        productId = products.products.items[0].id;
        variantId = products.products.items[0].variants[0].id;

        // 登录 shop 用户并获取其 customerId（hayden.zieme 为 customerCount:1 的种子客户）
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`
            query { activeCustomer { id emailAddress } }
        `) as any;
        customerId = me.activeCustomer.id;

        // 预置积分（admin 调整账户）
        await adminClient.query(gql`
            mutation { adjustPoints(customerId: "${customerId}", amount: ${SEED_POINTS}, remark: "seed") { points } }
        `);

        // 服务/上下文注入（供过期清理用例直接调用）
        memberService = server.app.get(MemberLevelService);
        requestContextService = server.app.get(RequestContextService);
        const channelService = server.app.get(ChannelService);
        const defaultChannel = await channelService.getDefaultChannel();
        adminCtx = await requestContextService.create({ apiType: 'admin', channelOrToken: defaultChannel });

        // 一张无参数促销「积分抵现」= points_redeem 条件 + points_redeem_discount 动作
        const promo = await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [{ languageCode: en, name: "积分抵现", description: "points redeem" }]
                    conditions: [{ code: "points_redeem", arguments: [] }]
                    actions: [{ code: "points_redeem_discount", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `) as any;
        expect(promo.createPromotion.id).toBeDefined();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ------------------------- 用例 ------------------------- */

    it('插件可加载；初始无积分抵现订单字段', async () => {
        expect(server.app).toBeDefined();
        const o = await freshOrder();
        expect(o.subTotalWithTax).toBe(ORIGINAL_PRICE);
        const active = await getActiveOrder();
        // 未绑定抵现时订单字段为默认 0
        expect(active.customFields.pointsToRedeem).toBe(0);
        expect(active.customFields.pointsRedeemAmount).toBe(0);
    });

    it('赚分：订单送达 → 积分/成长值增加 + EARN 明细 + expiresAt 落库', async () => {
        // 开启积分有效期：EARN 记录随 expiresAt（now + 30 天）
        await setPointsExpireDays(30);

        const before = await myInfo();

        // 先创建订单以读取实际 subTotal（未税，收货地址后才有税率影响）
        await freshOrder();
        const pre = await shopClient.query(gql`
            query { activeOrder { subTotal } }
        `) as any;
        const earnedBase = pre.activeOrder ? pre.activeOrder.subTotal : ORIGINAL_PRICE;

        const orderId = await deliverOrder();

        // 送达触发 Delivered 处理器：points = floor(subTotal × ratio) = earnedBase；growth 同 earnedBase
        await waitFor(async () => (await myInfo()).points === before.points + earnedBase);
        const after = await myInfo();
        // subTotal 未税时含税后为 108250；断言积分增量 = 订单 subTotal（未税）× ratio
        expect(after.points).toBe(before.points + earnedBase);
        expect(after.growthValue).toBe(before.growthValue + earnedBase);

        // EARN 明细存在且 expiresAt 已落库（非空）
        const history = await myPointsHistory();
        const earn = history.filter(h => h.type === PointsHistoryType.EARN && h.orderId === orderId);
        expect(earn.length).toBeGreaterThan(0);
        expect(earn[0].expiresAt).toBeDefined();
    });

    it('抵现成功：redeemPoints 绑定即扣 SPEND + 折扣生效落到抵扣后', async () => {
        const o = await freshOrder();
        expect(o.subTotalWithTax).toBe(ORIGINAL_PRICE);

        const infoBefore = await myInfo();
        const res = await redeem(REDEEM_POINTS);
        expect(String(res.id)).toBe(String(o.id));

        const active = await getActiveOrder();
        // 订单级折扣生效：subTotalWithTax 落到 129900 - 10000 = 119900
        expect(active.subTotalWithTax).toBe(ORIGINAL_PRICE - REDEEM_AMOUNT);
        expect(active.customFields.pointsToRedeem).toBe(REDEEM_POINTS);
        expect(active.customFields.pointsRedeemAmount).toBe(REDEEM_AMOUNT);
        const amounts = active.discounts.map((d: any) => d.amountWithTax);
        expect(amounts).toContain(-REDEEM_AMOUNT);

        // 绑定即扣：积分余额减少，SPEND 明细落库
        const infoAfter = await myInfo();
        expect(infoAfter.points).toBe(infoBefore.points - REDEEM_POINTS);
        const history = await myPointsHistory();
        expect(history.some(h => h.type === PointsHistoryType.SPEND && h.orderId === o.id)).toBe(true);
    });

    it('不足拦截：redeemPoints 超余额 → Insufficient points', async () => {
        const o = await freshOrder();
        await assertThrowsWithMessage(() => redeem(SEED_POINTS + 1), 'Insufficient points');
    });

    it('折算上限拦截：抵扣金额 >= 订单小计 → 拦截', async () => {
        const o = await freshOrder();
        // discount = floor(150000/100)*100 = 150000 >= subTotal 129900 → 拦截（先于余额校验）
        await assertThrowsWithMessage(
            () => redeem(150000),
            'Redeemed amount must be less than order subtotal',
        );
    });

    it('取消回退：抵现后取消 → 积分全额回退 + 订单字段清空', async () => {
        const o = await freshOrder();
        const infoBefore = await myInfo();
        await redeem(REDEEM_POINTS);
        let active = await getActiveOrder();
        expect(active.customFields.pointsToRedeem).toBe(REDEEM_POINTS);

        await cancelActiveOrderAdmin(o.id);
        await waitFor(async () => (await myInfo()).points === infoBefore.points);

        // 积分全额回退
        const infoAfter = await myInfo();
        expect(infoAfter.points).toBe(infoBefore.points);

        // 订单字段清空 + 回退 EARN 明细
        const detail = await adminClient.query(gql`
            query { order(id: "${o.id}") { state customFields { pointsToRedeem pointsRedeemAmount } } }
        `);
        expect(detail.order.state).toBe('Cancelled');
        expect(detail.order.customFields.pointsToRedeem).toBe(0);
        expect(detail.order.customFields.pointsRedeemAmount).toBe(0);
        const history = await myPointsHistory();
        expect(history.some(h => h.type === PointsHistoryType.EARN && (h.remark ?? '').includes('order_cancelled'))).toBe(true);
    });

    it('退款回退：抵现支付后退款 → 积分按比例回退（EARN refund_settled）', async () => {
        const o = await freshOrder();
        const infoBefore = await myInfo();
        await redeem(REDEEM_POINTS);

        // 支付（不退运费，全单退款 → 比例 100%）
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);

        // admin 全单退款（手动扣，单笔到位 Settled）
        const detail = await adminClient.query(gql`
            query { order(id: "${o.id}") { totalWithTax shippingWithTax payments { id } lines { id quantity } } }
        `);
        const paymentId = detail.order.payments[0].id;
        await adminClient.query(gql`
            mutation {
                refundOrder(input: {
                    lines: [${detail.order.lines.map((l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`).join(',')}]
                    shipping: ${detail.order.shippingWithTax}
                    adjustment: 0
                    paymentId: "${paymentId}"
                    reason: "e2e-refund"
                }) { ... on Refund { id state total } ... on ErrorResult { errorCode message } }
            }
        `);

        // 全单退款：pointsReturn = floor(10000 × total/total) = 10000 → 余额回增
        await waitFor(async () => (await myInfo()).points === infoBefore.points);
        const infoAfter = await myInfo();
        expect(infoAfter.points).toBe(infoBefore.points);
        const history = await myPointsHistory();
        expect(history.some(h => h.type === PointsHistoryType.EARN && (h.remark ?? '').includes('refund_settled'))).toBe(true);
    });

    it('过期清理：EARN 明细过期 → 定时任务扣余额 + EXPIRE 明细（幂等）', async () => {
        // 前置已开启 pointsExpireDays=30，利用上一笔 EARN（已落库 expiresAt）改到过去模拟过期
        await forceOldestEarnExpired();

        const before = await myInfo();
        const historyBefore = await myPointsHistory();
        const earnIds = new Set(historyBefore.filter(h => h.type === PointsHistoryType.EARN).map(h => `${h.id}:${h.amount}`));

        const count = await memberService.expireEarnedPoints(adminCtx);
        expect(count).toBeGreaterThan(0);

        const after = await myInfo();
        expect(after.points).toBeLessThanOrEqual(before.points);

        // EXPIRE 明细落库且 amount 为负
        const historyAfter = await myPointsHistory();
        const expireRecords = historyAfter.filter(h => h.type === PointsHistoryType.EXPIRE);
        expect(expireRecords.length).toBeGreaterThan(0);
        expect(expireRecords.every(h => h.amount < 0)).toBe(true);

        // 幂等：再次执行不再重复扣减
        const count2 = await memberService.expireEarnedPoints(adminCtx);
        const after2 = await myInfo();
        expect(count2).toBe(0);
        expect(after2.points).toBe(after.points);
    });
});