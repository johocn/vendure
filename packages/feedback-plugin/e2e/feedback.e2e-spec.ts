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

    it('type 白名单：非法值报 UserInputError，合法三值通过', async () => {
        await expect(shopClient.query(gql`
            mutation { createFeedback(input: { type: "功能异常", title: "白名单校验", content: "内容" }) { id } }
        `)).rejects.toThrow(/Invalid feedback type/);
        await expect(shopClient.query(gql`
            mutation { createFeedback(input: { type: "suggest", title: "白名单校验", content: "内容" }) { id } }
        `)).rejects.toThrow(/Invalid feedback type/);
        for (const type of ['bug', 'experience', 'other']) {
            const r = await shopClient.query(gql`
                mutation { createFeedback(input: { type: "${type}", title: "白名单${type}", content: "内容" }) { id type } }
            `) as any;
            expect(r.createFeedback.type).toBe(type);
        }
    });

    it('faqs lang 合并与回退：zh/en 命中、ko 回退基线、不传 lang 原行为、admin 回显 titleI18n', async () => {
        // zh-CN 键带连字符，内联对象字面量写不了 → 用 variables 传 JSON
        const save = await adminClient.query(
            gql`
                mutation SaveFaqI18n($input: SaveFaqInput!) {
                    saveFaq(input: $input) { id title titleI18n }
                }
            `,
            {
                input: {
                    title: '包邮门槛',
                    content: '满99包邮',
                    type: 'account',
                    sort: 1,
                    titleI18n: { 'zh-CN': '包邮门槛', en: 'Free shipping threshold' },
                    contentI18n: { 'zh-CN': '满99包邮', en: 'Free over ¥99' },
                },
            },
        ) as any;
        expect(save.saveFaq.title).toBe('包邮门槛');
        expect(JSON.parse(save.saveFaq.titleI18n).en).toBe('Free shipping threshold');

        const zh = await shopClient.query(gql`query { faqs(type: "account", lang: "zh-CN") { title content } }`) as any;
        expect(zh.faqs).toHaveLength(1);
        expect(zh.faqs[0].title).toBe('包邮门槛');
        expect(zh.faqs[0].content).toBe('满99包邮');

        const en = await shopClient.query(gql`query { faqs(type: "account", lang: "en") { title content } }`) as any;
        expect(en.faqs[0].title).toBe('Free shipping threshold');
        expect(en.faqs[0].content).toBe('Free over ¥99');

        // 未配置语言回退基线
        const ko = await shopClient.query(gql`query { faqs(type: "account", lang: "ko") { title } }`) as any;
        expect(ko.faqs[0].title).toBe('包邮门槛');

        // 非白名单 lang 与不传 lang 均原行为
        const bad = await shopClient.query(gql`query { faqs(type: "account", lang: "xx-YY") { title } }`) as any;
        expect(bad.faqs[0].title).toBe('包邮门槛');
        const noLang = await shopClient.query(gql`query { faqs(type: "account") { title } }`) as any;
        expect(noLang.faqs[0].title).toBe('包邮门槛');

        // admin 列表回显（web-admin 编辑卡数据源）
        const adminList = await adminClient.query(gql`
            query { faqEntries(options: { skip: 0, take: 10 }) { items { id title titleI18n contentI18n } } }
        `) as any;
        const acc = adminList.faqEntries.items.find((f: any) => f.title === '包邮门槛');
        expect(acc).toBeTruthy();
        expect(JSON.parse(acc.titleI18n)['zh-CN']).toBe('包邮门槛');
        expect(JSON.parse(acc.contentI18n).en).toBe('Free over ¥99');
    });

    it('回复闭环：pending 不计未读、processing 计未读、已读幂等、再回复重开未读、resolved 拒绝再回复', async () => {
        // 前序用例已留下 fb1（resolved、未读）；此刻 unread = 1（fb1），新建 pending 不计
        const created = await shopClient.query(gql`
            mutation { createFeedback(input: { title: "回复闭环测试", content: "请尽快处理" }) { id title status } }
        `) as any;
        const id = created.createFeedback.id;
        expect(created.createFeedback.status).toBe('pending');
        const c1 = await shopClient.query(gql`query { unreadFeedbackCount }`) as any;
        expect(c1.unreadFeedbackCount).toBe(1);

        // 回复不解决：pending → processing，计入未读
        const replied = await adminClient.query(gql`
            mutation { replyFeedback(id: "${id}", reply: "已收到，正在处理", resolve: false) { id reply status repliedAt repliedBy } }
        `) as any;
        expect(replied.replyFeedback.status).toBe('processing');
        expect(replied.replyFeedback.reply).toBe('已收到，正在处理');
        expect(replied.replyFeedback.repliedAt).toBeTruthy();
        expect(replied.replyFeedback.repliedBy).toBeTruthy();
        const c2 = await shopClient.query(gql`query { unreadFeedbackCount }`) as any;
        expect(c2.unreadFeedbackCount).toBe(2);

        // myFeedbacks 透出回复
        const mine = await shopClient.query(gql`
            query { myFeedbacks(options: { skip: 0, take: 10 }) { items { id reply repliedAt readAt } totalItems } }
        `) as any;
        const mineFb = mine.myFeedbacks.items.find((f: any) => f.id === id);
        expect(mineFb.reply).toBe('已收到，正在处理');
        expect(mineFb.readAt).toBeNull();

        // 标记已读（幂等）：fb1 + 本条全部清零
        expect((await shopClient.query(gql`mutation { markFeedbacksRead }`) as any).markFeedbacksRead).toBe(0);
        expect((await shopClient.query(gql`mutation { markFeedbacksRead }`) as any).markFeedbacksRead).toBe(0);
        const c3 = await shopClient.query(gql`query { unreadFeedbackCount }`) as any;
        expect(c3.unreadFeedbackCount).toBe(0);

        // 再次回复（resolve=true）：processing → resolved，且重开未读
        const r2 = await adminClient.query(gql`
            mutation { replyFeedback(id: "${id}", reply: "已解决", resolve: true) { id status handledAt } }
        `) as any;
        expect(r2.replyFeedback.status).toBe('resolved');
        expect(r2.replyFeedback.handledAt).toBeTruthy();
        const c4 = await shopClient.query(gql`query { unreadFeedbackCount }`) as any;
        expect(c4.unreadFeedbackCount).toBe(1);
        expect((await shopClient.query(gql`mutation { markFeedbacksRead }`) as any).markFeedbacksRead).toBe(0);

        // resolved 拒绝再回复
        await expect(adminClient.query(gql`
            mutation { replyFeedback(id: "${id}", reply: "x") { id } }
        `)).rejects.toThrow(/resolved/);

        // 空 reply 拒绝
        const fb2 = await shopClient.query(gql`
            mutation { createFeedback(input: { title: "空回复校验", content: "内容" }) { id } }
        `) as any;
        await expect(adminClient.query(gql`
            mutation { replyFeedback(id: "${fb2.createFeedback.id}", reply: "   ") { id } }
        `)).rejects.toThrow(/reply is required/);
    });
});
