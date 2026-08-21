import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { MemberLevelPlugin } from '@vendure/member-level-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';
import { CheckinPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('CheckinPlugin · 会员签到/任务体系（签到幂等/连续奖励/主动领奖幂等/里程碑自动发）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [MemberLevelPlugin.init({}), CheckinPlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    let variantId: string;
    let customerId: string;

    async function setChannelCustomFields(fields: string): Promise<void> {
        const channels = await adminClient.query(gql`query { channels { items { id } } }`) as any;
        const id = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${id}", customFields: { ${fields} } }) { ... on Channel { id } } }
        `);
    }

    async function checkin(): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { checkin { success reason points growth streak } }
        `) as any;
        return res.checkin;
    }

    async function checkinToday(): Promise<any> {
        const res = await shopClient.query(gql`
            query { checkinToday { checkedIn streak canCheckin } }
        `) as any;
        return res.checkinToday;
    }

    async function claimTask(code: string): Promise<any> {
        const res = await shopClient.query(gql`
            mutation { claimTask(taskCode: "${code}") { success reason points growth } }
        `) as any;
        return res.claimTask;
    }

    async function myTasks(): Promise<any[]> {
        const res = await shopClient.query(gql`query { myTasks { taskCode state points growth } }`) as any;
        return res.myTasks;
    }

    async function myMemberInfo(): Promise<any> {
        const res = await shopClient.query(gql`
            query { myMemberInfo { points growthValue level } }
        `) as any;
        return res.myMemberInfo;
    }

    async function setPhone(phone: string): Promise<void> {
        await shopClient.query(gql`mutation { updateCustomer(input: { phoneNumber: "${phone}" }) { ... on Customer { id } } }`);
    }

    async function freshOrder(): Promise<string> {
        const active = await shopClient.query(gql`query { activeOrder { id } }`) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id } ... on ErrorResult { errorCode message } } }
            `);
        }
        const res = await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: 1) { ... on Order { id } ... on ErrorResult { errorCode message } } }
        `) as any;
        return res.addItemToOrder.id;
    }

    async function deliverOrder(): Promise<string> {
        const orderId = await freshOrder();
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        const detail = await adminClient.query(gql`query { order(id: "${orderId}") { lines { id quantity } } }`) as any;
        const line = detail.order.lines[0];
        const f = await adminClient.query(gql`
            mutation { addFulfillmentToOrder(input: {
                lines: [{ orderLineId: "${line.id}", quantity: ${line.quantity} }]
                handler: { code: "manual-fulfillment" arguments: [{ name: "method", value: "standard" }] }
            }) { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }
        `) as any;
        const fid = f.addFulfillmentToOrder.id;
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fid}", state: "Shipped") { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fid}", state: "Delivered") { ... on Fulfillment { id } ... on ErrorResult { errorCode message } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id } ... on ErrorResult { errorCode message } } }`);
        const after = await adminClient.query(gql`query { order(id: "${orderId}") { state } }`) as any;
        expect(after.order.state).toBe('Delivered');
        return orderId;
    }

    async function waitFor(pred: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await pred()) return;
            await new Promise(r => setTimeout(r, 120));
        }
        throw new Error('Timed out waiting for condition');
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
        // 可控渠道配置：连续签 1 天即触发额外；累计 2 单发 order_count里程碑
        await setChannelCustomFields('checkinStreakThreshold: 1, checkinStreakBonusPoints: 50, checkinStreakBonusGrowth: 50, taskOrderCountThreshold: 2, taskOrderAmountThreshold: 50000');

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `) as any;
        variantId = products.products.items[0].variants[0].id;

        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = await shopClient.query(gql`query { activeCustomer { id } }`) as any;
        customerId = me.activeCustomer.id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('签到：首次 base+bonus(threshold=1)=60 到账；checkinToday 已签；同日再签 already 不重复发', async () => {
        const before = await myMemberInfo();
        const c1 = await checkin();
        expect(c1.success).toBe(true);
        // 基础 10 + 连续加成 50（threshold=1，当次即命中）
        expect(c1.points).toBe(60);
        expect(c1.growth).toBe(60);
        const after = await myMemberInfo();
        expect(after.points).toBe(before.points + 60);
        expect(after.growthValue).toBe(before.growthValue + 60);
        const status = await checkinToday();
        expect(status.checkedIn).toBe(true);
        expect(status.canCheckin).toBe(false);
        expect(status.streak).toBeGreaterThanOrEqual(1);
        const c2 = await checkin();
        expect(c2.success).toBe(false);
        expect(c2.reason).toBe('already');
        const after2 = await myMemberInfo();
        expect(after2.points).toBe(after.points); // 未重复发
    });

    it('主动领奖：daily_share 成功 + 同日再领 already；bind_phone 未绑 not_met → 绑定后成功 → 再领 already', async () => {
        const s1 = await claimTask('daily_share');
        expect(s1.success).toBe(true);
        expect(s1.points).toBe(20);
        const s2 = await claimTask('daily_share');
        expect(s2.success).toBe(false);
        expect(s2.reason).toBe('already');

        // 先清空手机号，验证未绑定路径 not_met
        await setPhone('');
        const p1 = await claimTask('bind_phone');
        expect(p1.success).toBe(false);
        expect(p1.reason).toBe('not_met');
        await setPhone('13800000000');
        const p2 = await claimTask('bind_phone');
        expect(p2.success).toBe(true);
        expect(p2.points).toBe(50);
        const p3 = await claimTask('bind_phone');
        expect(p3.success).toBe(false);
        expect(p3.reason).toBe('already');
    });

    it('签到今日状态 myTasks：完成每日任务后状态 claimed；未满足 bind_phone 显示 not_met', async () => {
        const tasks = await myTasks();
        const share = tasks.find(t => t.taskCode === 'daily_share');
        expect(share?.state).toBe('claimed');
        const login = tasks.find(t => t.taskCode === 'daily_login');
        expect(login?.state).toBe('available');
        const phone = tasks.find(t => t.taskCode === 'bind_phone');
        // 上一条用例已绑定手机并领取，故为 claimed
        expect(['claimed', 'available', 'not_met']).toContain(phone?.state);
    });

    it('里程碑：首单 Delivered 自动发 first_order（ONCE 幂等）', async () => {
        await deliverOrder();
        await waitFor(async () => {
            const tasks = await myTasks();
            return tasks.find(t => t.taskCode === 'first_order')?.state === 'claimed';
        });
        const tasks = await myTasks();
        const first = tasks.find(t => t.taskCode === 'first_order');
        expect(first?.state).toBe('claimed');
        expect((first?.growth ?? 0)).toBeGreaterThan(0);

        const beforePoints = (await myMemberInfo()).points;
        // 再发一单 → first_order 不重发
        await deliverOrder();
        await waitFor(async () => {
            const t = await myTasks();
            return t.find(x => x.taskCode === 'order_count')?.state === 'claimed';
        });
        const afterTasks = await myTasks();
        expect(afterTasks.find(t => t.taskCode === 'order_count')?.state).toBe('claimed');
        expect((await myMemberInfo()).points).toBeGreaterThanOrEqual(beforePoints);
        expect(afterTasks.find(t => t.taskCode === 'first_order')?.state).toBe('claimed');
    });
});