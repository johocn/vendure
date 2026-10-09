import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { FeedbackPlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('FeedbackPlugin · 常见问题 + 意见反馈（FAQ 过滤/enabled、反馈全链路、title 超长报错）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [FeedbackPlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('FAQ：saveFaq 建条 → shop faqs 全量/按 type 过滤/enabled=false 不出现；更新与删除生效', async () => {
        const save1 = await adminClient.query(gql`
            mutation {
                saveFaq(input: { title: "怎么取消订单", content: "在订单详情页申请取消", type: "order", sort: 1 }) {
                    id title type sort
                }
            }
        `) as any;
        expect(save1.saveFaq.title).toBe('怎么取消订单');
        expect(save1.saveFaq.type).toBe('order');

        const save2 = await adminClient.query(gql`
            mutation {
                saveFaq(input: { title: "支持哪些支付方式", content: "支持微信支付与支付宝", type: "general", sort: 2 }) { id }
            }
        `) as any;
        expect(save2.saveFaq.id).toBeTruthy();

        // enabled=false 的第三条：shop faqs 不应出现
        const save3 = await adminClient.query(gql`
            mutation {
                saveFaq(input: { title: "内部占位问题", content: "尚未启用", type: "general", enabled: false }) { id }
            }
        `) as any;
        expect(save3.saveFaq.id).toBeTruthy();

        const all = await shopClient.query(gql`
            query { faqs { id title type sort } }
        `) as any;
        expect(all.faqs).toHaveLength(2);
        expect(all.faqs.map((f: any) => f.type).sort()).toEqual(['general', 'order']);
        // sort ASC 排序：sort=1 的取消订单在前
        expect(all.faqs[0].title).toBe('怎么取消订单');

        const orderOnly = await shopClient.query(gql`
            query { faqs(type: "order") { title type } }
        `) as any;
        expect(orderOnly.faqs).toHaveLength(1);
        expect(orderOnly.faqs[0].type).toBe('order');

        // 更新：enabled 切回 true → shop 可见；再删除 → 不可见
        const enabled = await adminClient.query(gql`
            mutation {
                saveFaq(input: { id: "${save3.saveFaq.id}", title: "内部占位问题", content: "尚未启用", type: "general", enabled: true }) {
                    id enabled
                }
            }
        `) as any;
        expect(enabled.saveFaq.enabled).toBe(true);
        const all2 = await shopClient.query(gql`query { faqs { id } }`) as any;
        expect(all2.faqs).toHaveLength(3);

        const del = await adminClient.query(gql`
            mutation { deleteFaq(id: "${save3.saveFaq.id}") }
        `) as any;
        expect(del.deleteFaq).toBe(true);
        const all3 = await shopClient.query(gql`query { faqs { id } }`) as any;
        expect(all3.faqs).toHaveLength(2);
    });

    it('反馈全链路：createFeedback → myFeedbacks → admin feedbacks → updateFeedbackStatus 置 handledAt', async () => {
        const created = await shopClient.query(gql`
            mutation {
                createFeedback(input: {
                    type: "bug"
                    title: "商品图片加载失败"
                    content: "详情页部分图片显示不出来，请排查"
                    imgs: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]
                    contactWay: "wechat: tester01"
                }) { id title status type contactWay imgs }
            }
        `) as any;
        const fb = created.createFeedback;
        expect(fb.status).toBe('pending');
        expect(fb.type).toBe('bug');
        expect(fb.contactWay).toBe('wechat: tester01');
        expect(JSON.parse(fb.imgs)).toEqual([
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
        ]);

        const mine = await shopClient.query(gql`
            query { myFeedbacks(options: { skip: 0, take: 10 }) { items { id title status } totalItems } }
        `) as any;
        expect(mine.myFeedbacks.totalItems).toBe(1);
        expect(mine.myFeedbacks.items[0].title).toBe('商品图片加载失败');

        const adminList = await adminClient.query(gql`
            query { feedbacks(options: { skip: 0, take: 10 }) { items { id status handledAt } totalItems } }
        `) as any;
        expect(adminList.feedbacks.totalItems).toBe(1);
        expect(adminList.feedbacks.items[0].handledAt).toBeNull();

        const resolved = await adminClient.query(gql`
            mutation { updateFeedbackStatus(id: "${fb.id}", status: "resolved") { id status handledAt } }
        `) as any;
        expect(resolved.updateFeedbackStatus.status).toBe('resolved');
        expect(resolved.updateFeedbackStatus.handledAt).toBeTruthy();

        // status 过滤：resolved 1 条、pending 0 条
        const resolvedOnly = await adminClient.query(gql`
            query { feedbacks(options: { skip: 0, take: 10, status: "resolved" }) { totalItems } }
        `) as any;
        expect(resolvedOnly.feedbacks.totalItems).toBe(1);
        const pendingOnly = await adminClient.query(gql`
            query { feedbacks(options: { skip: 0, take: 10, status: "pending" }) { totalItems } }
        `) as any;
        expect(pendingOnly.feedbacks.totalItems).toBe(0);
    });

    it('title 超长（21 字）报 UserInputError', async () => {
        const longTitle = '一二三四五六七八九十一二三四五六七八九十一';
        expect(longTitle.length).toBe(21);
        await expect(shopClient.query(gql`
            mutation { createFeedback(input: { title: "${longTitle}", content: "内容" }) { id } }
        `)).rejects.toThrow(/at most 20 characters/);
    });
});
