/**
 * 冒烟 e2e（依赖注入假件，全链路编排断言）：
 * 搜索命中 → 卡片 payload → 回复编号下单成功 → MsgId 幂等 → 异常降级。
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WechatMessageEvent } from '@vendure/wechat-auth-plugin';

import { AssistantService } from './assistant.service';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { SessionService } from './session.service';
import { Customer } from '@vendure/core';

// ============ 假件 ============

function makeConnection() {
    const processed = new Set<string>();
    const sessions = new Map<string, any>();
    const customers = new Map<string, { id: number }>();

    const processedRepo = {
        insert: async (row: { dedupKey: string }) => {
            if (processed.has(row.dedupKey)) throw new Error('duplicate');
            processed.add(row.dedupKey);
        },
    };
    const sessionRepo = {
        create: (x: any) => x,
        findOne: async ({ where: { openid } }: any) => sessions.get(openid) ?? null,
        insert: async (row: any) => sessions.set(row.openid, { id: 's1', ...row, expireAt: new Date(Date.now() + 30 * 60_000) }),
        update: async (id: any, patch: any) => {
            const cur = [...sessions.values()].find(s => s.id === id);
            Object.assign(cur, patch);
        },
        delete: async () => {},
        createQueryBuilder: () => ({
            delete: () => ({ where: () => ({ execute: async () => {} }) }),
        }),
    };
    const customerRepo = {
        findOne: async ({ where }: any) => customers.get(where.customFields.wechatOpenid) ?? null,
    };
    const repos = new Map<any, any>([
        [WechatProcessedMessage, processedRepo],
        [WechatShoppingSession, sessionRepo],
        [Customer, customerRepo],
    ]);
    return {
        getRepository: (entity: any) => repos.get(entity),
        customers,
        sessions,
    };
}

function makeSearchStub(hits: any[] | 'error') {
    return {
        searchProducts: async (input: any) => {
            if (hits === 'error') throw new Error('meili down');
            return hits.map((h, i) => ({ index: i + 1, quantity: 1, ...h }));
        },
    };
}

function makeOrderStub(outcome: any) {
    const calls: any[] = [];
    return {
        calls,
        createOrder: async (_ctx: any, _customerId: number, selections: any[]) => {
            calls.push(selections);
            if (outcome === 'stock') return { status: 'out_of_stock', title: '海天生抽酱油 500ml' };
            return {
                status: 'ok',
                order: { code: 'ABCD12', totalWithTax: 890 },
                items: [{ title: '海天生抽酱油 500ml', quantity: 1, price: 890 }],
            };
        },
    };
}

const SEARCH_HITS = [
    { productId: '11', title: '海天生抽酱油 500ml', price: 890, thumbnail: 'https://cdn.example.com/a.jpg', url: 'https://shop.example.com/soy-sauce' },
    { productId: '12', title: '千禾零添加酱油 1L', price: 1280 },
];

function makeService(overrides: { search?: any; order?: any; binding?: any } = {}) {
    const connection = makeConnection();
    const outbound: any[] = [];
    const sender = {
        setEchoMode: () => {},
        send: async (m: any) => {
            outbound.push(m);
        },
        sendOrFallback: async (m: any, fallback: string) => {
            outbound.push(m);
        },
    };
    const svc = new AssistantService(
        { storefrontUrl: 'https://shop.example.com', searchLocale: 'zh', sessionTtlMinutes: 30, searchLimit: 5 } as any,
        connection as any,
        new SessionService(connection as any),
        (overrides.search ?? makeSearchStub(SEARCH_HITS)) as any,
        (overrides.order ?? makeOrderStub(null)) as any,
        sender as any,
        { resolveForChannel: async () => ({}) } as any,
        { findOne: async () => ({ id: '2' }) } as any,
        { create: async () => ({ channelId: '2' }) } as any,
        (overrides.binding ?? makeBindingStub({}, connection)) as any,
    );
    return { svc, connection, outbound };
}

/**
 * 绑定建档假件：findCustomerByOpenid 默认读 connection.customers（对齐旧用例「已绑定」语义）；
 * bindOrCreateCustomer 默认建档成功（customerId=42）。
 */
function makeBindingStub(
    overrides: { boundCustomer?: any; bindOutcome?: any; calls?: any[] } = {},
    connection?: any,
) {
    const calls = overrides.calls ?? [];
    return {
        findCustomerByOpenid: async (openid: string) =>
            overrides.boundCustomer !== undefined
                ? overrides.boundCustomer
                : (connection?.customers.get(openid) ?? null),
        bindOrCreateCustomer: async (_ctx: any, openid: string, phone: string, address?: string) => {
            calls.push({ openid, phone, address });
            return overrides.bindOutcome ?? { status: 'ok', customer: { id: 42 } };
        },
        calls,
    };
}

function textEvent(content: string, msgId = 'M1'): WechatMessageEvent {
    return new WechatMessageEvent({
        channelToken: 'channel-token-a',
        msgType: 'text',
        fromUserName: 'openid-user-1',
        toUserName: 'gh_x',
        content,
        msgId,
        createTime: 1728777600,
    });
}

beforeEach(() => {
    vi.useRealTimers();
});

describe('AssistantService 冒烟闭环', () => {
    test('搜索命中 → 保存会话 → 回复图文卡片', async () => {
        const { svc, connection, outbound } = makeService();
        await svc.onMessage(textEvent('买一瓶酱油'));
        expect(outbound.length).toBe(1);
        const card = outbound[0];
        expect(card.kind).toBe('news');
        expect(card.articles[0].title).toContain('海天生抽酱油');
        expect(card.articles[0].description).toContain('回复「1」');
        const session = connection.sessions.get('openid-user-1');
        expect(session.results.length).toBe(2);
        expect(session.channelId).toBe('2');
    });

    test('回复「买1」未绑定 → 引导绑定 + 进入补录状态机', async () => {
        const { svc, connection, outbound } = makeService();
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        const last = outbound[outbound.length - 1];
        expect(last.kind).toBe('text');
        expect(last.content).toContain('未绑定');
        expect(last.content).toContain('13800138000');
        expect(last.content).toContain('https://shop.example.com/account/login');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('awaiting_phone');
        expect(session.draft.indices).toEqual([1]);
    });

    test('路径 B：补录手机号 → 补录地址 → 建档续下单', async () => {
        const order = makeOrderStub(null);
        const binding = makeBindingStub();
        const { svc, connection, outbound } = makeService({ order, binding });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('13800138000', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('收货地址');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('awaiting_address');
        expect(session.draft.phone).toBe('13800138000');
        await svc.onMessage(textEvent('北京市朝阳区建国路1号院', 'M4'));
        expect(binding.calls[0]).toEqual({
            openid: 'openid-user-1',
            phone: '13800138000',
            address: '北京市朝阳区建国路1号院',
        });
        expect(order.calls.length).toBe(1);
        expect(order.calls[0]).toEqual([{ productId: '11', quantity: 1 }]);
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('下单成功');
        expect(last.content).toContain('ABCD12');
        // 补录完成后状态清空，可直接回复编号下单
        expect(session.state).toBeNull();
        expect(session.draft).toBeNull();
    });

    test('路径 A：sso 附带 boundPhone → 自动建档后直接下单（零输入）', async () => {
        const order = makeOrderStub(null);
        const binding = makeBindingStub();
        const { svc, outbound } = makeService({ order, binding });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        // sso 转调链路：processMessage 第二参携带绑定手机号（纯决策，不发送，断言返回值）
        const out: any = await svc.processMessage(
            {
                channelToken: 'channel-token-a',
                msgType: 'text',
                fromUserName: 'openid-user-1',
                toUserName: 'gh_x',
                content: '买1',
                msgId: 'M2',
            } as any,
            { boundPhone: '13900139000' },
        );
        expect(binding.calls[0]).toEqual({ openid: 'openid-user-1', phone: '13900139000', address: undefined });
        expect(order.calls.length).toBe(1);
        expect(out.content).toContain('下单成功');
    });

    test('路径 A 手机号被冒用（phone_taken）→ 回退路径 B 补录引导', async () => {
        const binding = makeBindingStub({ bindOutcome: { status: 'phone_taken' } });
        const { svc, connection, outbound } = makeService({ binding });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        const out: any = await svc.processMessage(
            {
                channelToken: 'channel-token-a',
                msgType: 'text',
                fromUserName: 'openid-user-1',
                toUserName: 'gh_x',
                content: '买1',
                msgId: 'M2',
            } as any,
            { boundPhone: '13900139000' },
        );
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('awaiting_phone');
        expect(out.content).toContain('未绑定');
    });

    test('补录中回复「取消」→ 清态退出', async () => {
        const { svc, connection, outbound } = makeService();
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('取消', 'M3'));
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBeNull();
        expect(outbound[outbound.length - 1].content).toContain('已取消');
    });

    test('补录手机号格式无效 → 重新提示', async () => {
        const { svc, outbound } = makeService();
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('12345', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('手机号格式不对');
    });

    test('补录地址过短 → 重新提示', async () => {
        const { svc, outbound } = makeService();
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('13800138000', 'M3'));
        await svc.onMessage(textEvent('北京', 'M4'));
        expect(outbound[outbound.length - 1].content).toContain('不完整');
    });

    test('未绑定用户直接发手机号 → 进入地址补录；完成后无待下单商品回绑定成功', async () => {
        const binding = makeBindingStub();
        const { svc, connection, outbound } = makeService({ binding });
        await svc.onMessage(textEvent('13800138000', 'M1'));
        expect(outbound[0].content).toContain('收货地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('awaiting_address');
        await svc.onMessage(textEvent('上海市浦东新区世纪大道100号', 'M2'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('绑定成功');
        expect(binding.calls[0].phone).toBe('13800138000');
        expect(binding.calls[0].address).toBe('上海市浦东新区世纪大道100号');
    });

    test('已绑定用户回复「买1」→ 下单成功通知 + 支付链接；重复 MsgId 跳过', async () => {
        const order = makeOrderStub(null);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        expect(order.calls.length).toBe(1);
        expect(order.calls[0]).toEqual([{ productId: '11', quantity: 1 }]);
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('下单成功');
        expect(last.content).toContain('ABCD12');
        expect(last.content).toContain('https://shop.example.com/checkout/confirmation/ABCD12');

        // 微信重试：同 MsgId 再推一次 → 不重复下单
        await svc.onMessage(textEvent('买1', 'M2'));
        expect(order.calls.length).toBe(1);
        expect(outbound.length).toBe(2);
    });

    test('「买2瓶酱油」数量进会话并用于下单', async () => {
        const order = makeOrderStub(null);
        const { svc, connection } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买2瓶酱油', 'M1'));
        await svc.onMessage(textEvent('1', 'M2'));
        expect(order.calls[0]).toEqual([{ productId: '11', quantity: 2 }]);
    });

    test('库存不足 → 库存不足文案', async () => {
        const order = makeOrderStub('stock');
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        expect(outbound[outbound.length - 1].content).toContain('库存不足');
    });

    test('无匹配商品 → 兜底回复', async () => {
        const { svc, outbound } = makeService({ search: makeSearchStub([]) });
        await svc.onMessage(textEvent('买火箭', 'M1'));
        expect(outbound[0].content).toContain('没有找到');
        expect(outbound[0].content).toContain('火箭');
    });

    test('搜索异常 → 降级文案', async () => {
        const { svc, outbound } = makeService({ search: makeSearchStub('error') });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        expect(outbound[0].content).toContain('开小差');
    });

    test('会话过期 → 引导重搜', async () => {
        const order = makeOrderStub(null);
        const { svc, connection, outbound } = makeService({ order });
        // 构造过期会话：saveResults 后把 expireAt 置为过去
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        const session = [...connection.sessions.values()][0];
        session.expireAt = new Date(Date.now() - 60_000);
        await svc.onMessage(textEvent('买1', 'M2'));
        expect(outbound[outbound.length - 1].content).toContain('已过期');
    });

    test('无效编号 → 引导提示', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买9', 'M2'));
        expect(outbound[outbound.length - 1].content).toContain('「9」');
        expect(outbound[outbound.length - 1].content).toContain('重新发送');
    });

    test('关注事件 → 欢迎语', async () => {
        const { svc, outbound } = makeService();
        await svc.onMessage(new WechatMessageEvent({
            channelToken: 'channel-token-a',
            msgType: 'event',
            fromUserName: 'openid-user-1',
            toUserName: 'gh_x',
            event: 'subscribe',
        }));
        expect(outbound[0].content).toContain('欢迎');
    });
});
