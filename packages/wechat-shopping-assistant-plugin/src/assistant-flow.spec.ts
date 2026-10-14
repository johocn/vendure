/**
 * 冒烟 e2e（依赖注入假件，全链路编排断言）：
 * 搜索命中 → 卡片 payload → 回复编号 → 地址列表选址 → 确认下单 → MsgId 幂等 → 异常降级。
 * 含地址簿管理（设默认/修改/删除/新增电话询问）与下单选址全流程。
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WechatMessageEvent } from '@vendure/wechat-auth-plugin';

import { AssistantService } from './assistant.service';
import { AddressBookService } from './address.service';
import { WechatShoppingSession } from './entities/wechat-shopping-session.entity';
import { WechatProcessedMessage } from './entities/wechat-processed-message.entity';
import { SessionService } from './session.service';
import { Channel, Customer } from '@vendure/core';

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
    const channelRepo = {
        findOne: async ({ where }: any) => ({ id: where.id, token: 'channel-token-a' }),
    };
    const repos = new Map<any, any>([
        [WechatProcessedMessage, processedRepo],
        [WechatShoppingSession, sessionRepo],
        [Customer, customerRepo],
        [Channel, channelRepo],
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
    const calls: Array<{ selections: any[]; address?: any }> = [];
    return {
        calls,
        createOrder: async (_ctx: any, _customerId: number, selections: any[], address?: any) => {
            calls.push({ selections, address });
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

/** 默认地址簿：一个默认地址（⭐） */
const DEFAULT_ADDR_BOOK = [
    { id: 'a1', fullName: '张三', phoneNumber: '13800138000', streetLine1: '北京市朝阳区建国路1号', isDefault: true },
];

/**
 * 地址簿假件：内存 CRUD（add 设默认清旧 / remove 删默认顶替剩余最早地址，模拟 core 行为）。
 */
function makeAddressBookStub(initial: any[] = DEFAULT_ADDR_BOOK) {
    let items = initial.map(x => ({ ...x }));
    const calls: any[] = [];
    const sorted = () =>
        items
            .slice()
            .sort((a, b) => Number(a.id) - Number(b.id))
            .map((a, i) => ({ ...a, index: i + 1 }));
    return {
        calls,
        items: () => sorted(),
        list: async () => sorted(),
        getItem: async (_ctx: any, _cid: any, id: string) => sorted().find(a => a.id === id) ?? null,
        add: async (_ctx: any, _cid: any, input: any) => {
            calls.push({ op: 'add', ...input });
            const id = `a${Number(items.reduce((m, a) => Math.max(m, Number(a.id)), 100)) + 1}`;
            if (input.setDefault) items = items.map(a => ({ ...a, isDefault: false }));
            items = [
                ...items,
                { id, fullName: '', phoneNumber: input.phoneNumber, streetLine1: input.streetLine1, isDefault: input.setDefault },
            ];
            return id;
        },
        updateText: async (_ctx: any, id: string, text: string) => {
            calls.push({ op: 'updateText', id, text });
            items = items.map(a => (a.id === id ? { ...a, streetLine1: text } : a));
            return true;
        },
        updatePerson: async (_ctx: any, id: string, input: any) => {
            calls.push({ op: 'updatePerson', id, ...input });
            items = items.map(a =>
                a.id === id
                    ? {
                          ...a,
                          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
                          ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
                      }
                    : a,
            );
            return true;
        },
        remove: async (_ctx: any, id: string) => {
            calls.push({ op: 'remove', id });
            const target = items.find(a => a.id === id);
            items = items.filter(a => a.id !== id);
            // 模拟 core reassignDefaultsForDeletedAddress：删默认 → 剩余最早地址顶替
            if (target?.isDefault && items.length) {
                const first = items.slice().sort((a, b) => Number(a.id) - Number(b.id))[0];
                items = items.map(a => (a.id === first.id ? { ...a, isDefault: true } : a));
            }
            return true;
        },
        setDefault: async (_ctx: any, id: string) => {
            calls.push({ op: 'setDefault', id });
            items = items.map(a => ({ ...a, isDefault: a.id === id }));
            return true;
        },
    } as unknown as AddressBookService & { calls: any[]; items: () => any[] };
}

function makeService(overrides: { search?: any; order?: any; binding?: any; addressBook?: any } = {}) {
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
    const addressBook = overrides.addressBook ?? makeAddressBookStub();
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
        addressBook as any,
    );
    return { svc, connection, outbound, addressBook };
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

    test('路径 B：补录手机号 → 补录地址 → 建档续下单（默认地址自动落单）', async () => {
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
        // 建档续下单：placeOrder 未选址时回退默认地址（刚建档首地址）落单
        expect(order.calls.length).toBe(1);
        expect(order.calls[0].selections).toEqual([{ productId: '11', quantity: 1 }]);
        expect(order.calls[0].address.streetLine1).toBe('北京市朝阳区建国路1号');
        expect(order.calls[0].address.phoneNumber).toBe('13800138000');
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('下单成功');
        expect(last.content).toContain('ABCD12');
        // 补录完成后状态清空，可直接回复编号下单
        expect(session.state).toBeNull();
        expect(session.draft).toBeNull();
    });

    test('路径 A：sso 附带 boundPhone → 自动建档后直接下单（零输入，默认地址落单）', async () => {
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
        // 未传 addressId → 回退顾客默认地址
        expect(order.calls[0].address.streetLine1).toBe('北京市朝阳区建国路1号');
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

    test('已绑定回复「买1」→ 地址列表 → 选址 → 确认卡 → 下单；重复 MsgId 跳过', async () => {
        const order = makeOrderStub(null);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        // 地址列表卡（⭐ 默认置顶），进入选址态
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择收货地址');
        expect(last.content).toContain('1 ⭐');
        expect(last.content).toContain('张三');
        expect(last.content).toContain('138****8000');
        expect(last.content).toContain('回复 0 新增地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
        // 选地址 1 → 下单确认卡（收货人/电话打码/地址）
        await svc.onMessage(textEvent('1', 'M3'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('海天生抽酱油 500ml ×1');
        expect(last.content).toContain('¥8.90');
        expect(last.content).toContain('收货人：张三');
        expect(last.content).toContain('电话：138****8000');
        expect(last.content).toContain('地址：北京市朝阳区建国路1号');
        expect(last.content).toContain('回复 1 确认下单');
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');
        // 确认下单
        await svc.onMessage(textEvent('1', 'M4'));
        expect(order.calls.length).toBe(1);
        expect(order.calls[0].selections).toEqual([{ productId: '11', quantity: 1 }]);
        expect(order.calls[0].address).toEqual({
            fullName: '张三',
            phoneNumber: '13800138000',
            streetLine1: '北京市朝阳区建国路1号',
        });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('下单成功');
        expect(last.content).toContain('ABCD12');
        expect(last.content).toContain('https://shop.example.com/checkout/confirmation/ABCD12');
        expect(connection.sessions.get('openid-user-1').state).toBeNull();

        // 微信重试：同 MsgId 再推一次 → 不重复下单
        await svc.onMessage(textEvent('1', 'M4'));
        expect(order.calls.length).toBe(1);
        expect(outbound.length).toBe(4);
    });

    test('「买2瓶酱油」数量进会话并用于下单（选址 → 确认四步）', async () => {
        const order = makeOrderStub(null);
        const { svc, connection } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买2瓶酱油', 'M1'));
        await svc.onMessage(textEvent('1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3'));
        await svc.onMessage(textEvent('1', 'M4'));
        expect(order.calls[0].selections).toEqual([{ productId: '11', quantity: 2 }]);
    });

    test('库存不足 → 库存不足文案（选址确认后）', async () => {
        const order = makeOrderStub('stock');
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3'));
        await svc.onMessage(textEvent('1', 'M4'));
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

describe('AssistantService 地址簿管理 + 下单选址（方案 B）', () => {
    test('「地址管理」→ 列表 → 选编号 → 菜单 → 设默认', async () => {
        const addressBook = makeAddressBookStub([
            { id: 'a1', fullName: '张三', phoneNumber: '13800138000', streetLine1: '北京市朝阳区建国路1号', isDefault: false },
            { id: 'a2', fullName: '李四', phoneNumber: '13999990000', streetLine1: '上海市浦东新区世纪大道100号', isDefault: true },
        ]);
        const { svc, connection, outbound } = makeService({ addressBook });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('您的地址簿（⭐ = 默认）');
        expect(last.content).toContain('1 张三');
        expect(last.content).toContain('2 ⭐ 李四');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
        // 选地址 1 → 操作菜单
        await svc.onMessage(textEvent('1', 'M2'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('地址1：张三');
        expect(last.content).toContain('回复 1 设为默认');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_op');
        // 设为默认
        await svc.onMessage(textEvent('1', 'M3'));
        expect(addressBook.calls).toContainEqual({ op: 'setDefault', id: 'a1' });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('设为默认地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
    });

    test('地址管理：修改收货地址文本', async () => {
        const addressBook = makeAddressBookStub();
        const { svc, connection, outbound } = makeService({ addressBook });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('1', 'M2'));
        await svc.onMessage(textEvent('2', 'M3')); // 修改地址
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('要改哪项');
        await svc.onMessage(textEvent('1', 'M4')); // 改收货地址
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('请回复新的收货地址');
        await svc.onMessage(textEvent('广州市天河区珠江新城xx路2号', 'M5'));
        expect(addressBook.calls).toContainEqual({ op: 'updateText', id: 'a1', text: '广州市天河区珠江新城xx路2号' });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('广州市天河区珠江新城xx路2号');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
    });

    test('地址管理：修改收货人电话（「姓名 电话」一行）', async () => {
        const addressBook = makeAddressBookStub();
        const { svc, connection, outbound } = makeService({ addressBook });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('1', 'M2'));
        await svc.onMessage(textEvent('2', 'M3'));
        await svc.onMessage(textEvent('2', 'M4')); // 改收货人/电话
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('收货人和电话');
        await svc.onMessage(textEvent('李四 13999990000', 'M5'));
        expect(addressBook.calls).toContainEqual({ op: 'updatePerson', id: 'a1', fullName: '李四', phoneNumber: '13999990000' });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('李四');
        expect(last.content).toContain('139****0000');
    });

    test('地址管理：删除默认地址 → 剩余最早地址自动顶替并提示', async () => {
        const addressBook = makeAddressBookStub([
            { id: 'a1', fullName: '张三', phoneNumber: '13800138000', streetLine1: '北京市朝阳区建国路1号', isDefault: false },
            { id: 'a2', fullName: '李四', phoneNumber: '13999990000', streetLine1: '上海市浦东新区世纪大道100号', isDefault: true },
        ]);
        const { svc, connection, outbound } = makeService({ addressBook });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('2', 'M2')); // 选中默认地址 a2
        await svc.onMessage(textEvent('3', 'M3')); // 删除
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('确认删除地址2');
        await svc.onMessage(textEvent('1', 'M4')); // 确认
        expect(addressBook.calls).toContainEqual({ op: 'remove', id: 'a2' });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('已删除');
        // a2 是默认 → 提示自动切换到剩余最早地址 a1
        expect(last.content).toContain('默认地址已自动切换为「张三 · 北京市朝阳区建国路1号」');
        expect(addressBook.items()[0].isDefault).toBe(true);
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
    });

    test('下单选址：回复 0 新增 → 电话用注册号 → 设默认 → 确认下单', async () => {
        const order = makeOrderStub(null);
        const addressBook = makeAddressBookStub([]);
        const { svc, connection, outbound } = makeService({ order, addressBook });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        // 无地址 → 空列表引导直接发地址
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('您还没有收货地址');
        expect(last.content).toContain('请直接回复收货地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_text');
        // 发地址文本 → 询问电话（注册号 13800138000）
        await svc.onMessage(textEvent('杭州市西湖区文一路1号', 'M3'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('联系电话用注册手机号 138****8000 吗');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_phone');
        // 回 1 用注册号 → 是否设默认
        await svc.onMessage(textEvent('1', 'M4'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('已收到地址：杭州市西湖区文一路1号（138****8000）');
        expect(last.content).toContain('设为默认地址？');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_default');
        // 回「是」→ 直接进下单确认卡（order 流程）
        await svc.onMessage(textEvent('是', 'M5'));
        expect(addressBook.calls).toContainEqual({ op: 'add', streetLine1: '杭州市西湖区文一路1号', phoneNumber: '13800138000', setDefault: true });
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('回复 1 确认下单');
        expect(last.content).toContain('杭州市西湖区文一路1号');
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');
        // 确认 → 下单，新地址落单
        await svc.onMessage(textEvent('1', 'M6'));
        expect(order.calls[0].address.streetLine1).toBe('杭州市西湖区文一路1号');
        expect(order.calls[0].address.phoneNumber).toBe('13800138000');
        expect(outbound[outbound.length - 1].content).toContain('下单成功');
    });

    test('下单选址：新增电话换新号码（回复 2 → 发新号）', async () => {
        const addressBook = makeAddressBookStub([]);
        const { svc, connection, outbound } = makeService({ addressBook });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('杭州市西湖区文一路1号', 'M3'));
        await svc.onMessage(textEvent('2', 'M4')); // 换新号码
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('请回复该地址的联系电话');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_phone_text');
        await svc.onMessage(textEvent('13712345678', 'M5'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('137****5678');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_default');
    });

    test('下单确认卡回复 0 → 重选地址列表', async () => {
        const order = makeOrderStub(null);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3')); // 进确认卡
        await svc.onMessage(textEvent('0', 'M4')); // 重选
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择收货地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
        expect(order.calls.length).toBe(0);
    });

    test('地址管理中回复「退出」→ 清态退出', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('退出', 'M2'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('已取消');
        expect(connection.sessions.get('openid-user-1').state).toBeNull();
    });
});
