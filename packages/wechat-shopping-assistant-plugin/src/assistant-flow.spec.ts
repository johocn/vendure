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
        findOne: async ({ where }: any) => ({
            id: where.id,
            token: 'channel-token-a',
            // 渠道装修：客服电话（客服卡片无门店时兜底）+ 店铺名/主营/店铺链接（店铺信息卡）
            customFields: {
                servicePhone: '400-800-1234',
                shopName: '东利民粮油店',
                shopIntro: '只做米、面、油 · 丰满区江南城区免费送货上门',
                domain: 'www.youshop.cn/official-20',
            },
        }),
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

function makeOrderStub(
    outcome: any,
    paymentMethods: Array<{ code: string; name: string }> = [{ code: 'wechatpay', name: '微信支付' }],
) {
    const calls: Array<{ selections: any[]; address?: any }> = [];
    return {
        calls,
        listPaymentMethods: async () => paymentMethods.map(m => ({ ...m })),
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

function makeService(
    overrides: {
        search?: any;
        order?: any;
        binding?: any;
        addressBook?: any;
        geo?: any;
        store?: any;
        supportTickets?: any;
    } = {},
) {
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
    const geo = overrides.geo ?? { geocode: async () => null, reverse: async () => null };
    const store = overrides.store ?? makeStoreStub();
    const supportTickets = overrides.supportTickets ?? makeSupportTicketsStub();
    const svc = new AssistantService(
        { storefrontUrl: 'https://shop.example.com', searchLocale: 'zh', sessionTtlMinutes: 30, searchLimit: 5 } as any,
        connection as any,
        new SessionService(connection as any),
        (overrides.search ?? makeSearchStub(SEARCH_HITS)) as any,
        (overrides.order ?? makeOrderStub(null)) as any,
        sender as any,
        { resolveForChannel: async () => ({}) } as any,
        { findOne: async () => ({ id: '2' }) } as any,
        { create: async ({ channelOrToken }: any) => ({ channelId: '2', channel: channelOrToken }) } as any,
        (overrides.binding ?? makeBindingStub({}, connection)) as any,
        addressBook as any,
        geo as any,
        store as any,
        supportTickets as any,
    );
    return { svc, connection, outbound, addressBook, store, supportTickets };
}

/** 留言工单假件：记录创建/回复入参 */
function makeSupportTicketsStub() {
    const created: any[] = [];
    const replyCalls: any[] = [];
    return {
        created,
        replyCalls,
        create: async (_ctx: any, input: any) => {
            created.push(input);
            return { id: 101, ...input, status: 'open' };
        },
        list: async () => [],
        reply: async (_ctx: any, id: string, content: string) => {
            replyCalls.push({ id, content });
            return { id: Number(id), status: 'replied', reply: content };
        },
    };
}

/**
 * 门店匹配假件：findNearby 按传入的熟店集合打标（排序/3km 过滤由 StoreLocatorService 单测覆盖）。
 */
function makeStoreStub(
    stores: Array<{
        id: string;
        name: string;
        address?: string;
        distanceKm: number;
        phoneNumber?: string;
        businessHours?: string;
    }> = [],
    familiarIds: string[] = [],
) {
    const findCalls: Array<{ lat: number; lng: number; familiar: string[] }> = [];
    const familiarCalls: Array<any> = [];
    const contactCalls: Array<any> = [];
    return {
        findCalls,
        familiarCalls,
        contactCalls,
        familiarStoreIds: async (_ctx: any, customerId?: any) => {
            familiarCalls.push(customerId);
            return new Set(familiarIds);
        },
        findNearby: async (_ctx: any, lat: number, lng: number, options: any = {}) => {
            const familiar: Set<string> = options.familiarStoreIds ?? new Set<string>();
            findCalls.push({ lat, lng, familiar: [...familiar] });
            return stores.map(s => ({ address: '', ...s, familiar: familiar.has(s.id) }));
        },
        findContact: async (_ctx: any, id: string | number) => {
            contactCalls.push(String(id));
            const store = stores.find(s => s.id === String(id));
            if (!store) return null;
            return {
                id: store.id,
                name: store.name,
                address: store.address ?? '',
                phoneNumber: store.phoneNumber ?? null,
                businessHours: store.businessHours ?? null,
            };
        },
    };
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
    const geoCalls: any[] = [];
    return {
        findCustomerByOpenid: async (openid: string) =>
            overrides.boundCustomer !== undefined
                ? overrides.boundCustomer
                : (connection?.customers.get(openid) ?? null),
        bindOrCreateCustomer: async (_ctx: any, openid: string, phone: string, address?: string, geo?: any) => {
            calls.push({ openid, phone, address });
            geoCalls.push(geo);
            return overrides.bindOutcome ?? { status: 'ok', customer: { id: 42 } };
        },
        calls,
        geoCalls,
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

function locationEvent(lat = 39.9087, lng = 116.3975, msgId = 'L1'): WechatMessageEvent {
    return new WechatMessageEvent({
        channelToken: 'channel-token-a',
        msgType: 'location',
        fromUserName: 'openid-user-1',
        toUserName: 'gh_x',
        latitude: lat,
        longitude: lng,
        scale: 15,
        label: '北京市朝阳区建国路1号',
        msgId,
    });
}

/** 逆地理假件：北京市朝阳区建国路1号 */
const REVERSE_RESULT = {
    province: '北京市',
    city: '北京市',
    district: '朝阳区',
    street: '建外街道',
    formattedAddress: '北京市朝阳区建国路1号',
};

const GEO_STUB = {
    reverse: async () => REVERSE_RESULT,
    geocode: async () => null,
};

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

    test('「买袋面」剥离计量词：检索词=面、数量=1', async () => {
        const searchCalls: any[] = [];
        const { svc, connection, outbound } = makeService({
            search: {
                searchProducts: async (input: any) => {
                    searchCalls.push(input);
                    return SEARCH_HITS.map((h, i) => ({ index: i + 1, ...h }));
                },
            } as any,
        });
        await svc.onMessage(textEvent('买袋面'));
        expect(searchCalls[0].query).toBe('面');
        expect(outbound[0].kind).toBe('news');
        const session = connection.sessions.get('openid-user-1');
        expect(session.results[0].quantity).toBe(1);
    });

    test('回复店铺名「利民」→ 店铺信息卡（不触发商品检索）', async () => {
        const searchCalls: any[] = [];
        const { svc, outbound } = makeService({
            search: {
                searchProducts: async (input: any) => {
                    searchCalls.push(input);
                    return [];
                },
            } as any,
        });
        await svc.onMessage(textEvent('利民'));
        expect(searchCalls).toHaveLength(0);
        expect(outbound[0].kind).toBe('text');
        expect(outbound[0].content).toContain('东利民粮油店');
        expect(outbound[0].content).toContain('只做米、面、油');
        expect(outbound[0].content).toContain('https://www.youshop.cn/official-20');
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

    test('地址流程态重发「地址管理」→ 重新列地址簿（不被当无效编号）', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('1', 'M2')); // 进菜单
        await svc.onMessage(textEvent('地址管理', 'M3')); // 重发指令
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('您的地址簿（⭐ = 默认）');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
    });

    test('下单选址流程中发「新增」→ 保留 order 上下文（落库后续下单）', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2')); // 地址列表
        await svc.onMessage(textEvent('0', 'M3')); // 新增
        await svc.onMessage(textEvent('新增', 'M4')); // 流程中重发指令
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('addr_new_text');
        expect(session.draft.flow).toBe('order');
        expect(session.draft.indices).toEqual([1]);
        expect(outbound[outbound.length - 1].content).toContain('请回复新的收货地址');
    });

    test('地址管理流中发「买1」→ 放行下单（重新列地址，order 上下文）', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('地址管理', 'M2')); // 进入管理流 flow=manage
        await svc.onMessage(textEvent('买1', 'M3')); // 改主意下单
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择收货地址');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('addr_pick');
        expect(session.draft.flow).toBe('order');
        expect(session.draft.indices).toEqual([1]);
    });

    test('下单选址流中改发「买2」→ 重新列地址并更新编号', async () => {
        const { svc, connection, outbound } = makeService();
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2')); // 地址列表 indices=[1]
        await svc.onMessage(textEvent('买2', 'M3')); // 改买第 2 个
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择收货地址');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state).toBe('addr_pick');
        expect(session.draft.flow).toBe('order');
        expect(session.draft.indices).toEqual([2]);
    });
});

describe('AssistantService 位置消息（微信发送位置）', () => {
    test('空闲态发位置 → 识别地址并缓存；「新增地址」直接复用（跳过地址文本）', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        // 先搜索建立会话，再发位置（空闲态）
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('已定位到：北京市朝阳区建国路1号');
        expect(last.content).toContain('回复「新增地址」');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state ?? null).toBeNull();
        expect(session.draft.geo).toMatchObject({ lat: 39.9087, lng: 116.3975, city: '北京市', district: '朝阳区' });
        expect(session.draft.pendingText).toBe('北京市朝阳区建国路1号');

        // 新增地址：直接进入电话确认（有注册号），不再要求回复地址文本
        await svc.onMessage(textEvent('新增地址', 'M2'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('联系电话用注册手机号 138****8000 吗');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_new_phone');
    });

    test('建档补录地址阶段发位置 → 逆地理作为地址建档，并带入坐标续下单', async () => {
        const order = makeOrderStub(null);
        const binding = makeBindingStub();
        const { svc, outbound } = makeService({ order, binding, geo: GEO_STUB });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('13800138000', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('收货地址');
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        expect(binding.calls[0]).toEqual({
            openid: 'openid-user-1',
            phone: '13800138000',
            address: '北京市朝阳区建国路1号',
        });
        expect(binding.geoCalls[0]).toMatchObject({ lat: 39.9087, lng: 116.3975, city: '北京市', district: '朝阳区' });
        // 建档首地址即默认：直接续下单
        expect(order.calls.length).toBe(1);
        expect(order.calls[0].address.streetLine1).toBe('北京市朝阳区建国路1号');
    });

    test('坐标非法（0,0）→ 位置无效提示', async () => {
        const { svc, outbound } = makeService({ geo: GEO_STUB });
        await svc.onMessage(locationEvent(0, 0, 'L1'));
        expect(outbound[0].content).toContain('位置信息不完整');
    });

    test('地址菜单操作态发位置 → 提示先完成当前步骤，不打断流程', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('1', 'M2')); // 进入操作菜单 addr_op
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('当前正在地址选择/操作中');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_op');
    });
});

describe('AssistantService 城市识别 + 3km 门店匹配', () => {
    const STORES = [
        { id: 's1', name: '朝阳门市部', address: '朝阳区建国路2号', distanceKm: 0.4 },
        { id: 's2', name: '国贸店', address: '朝阳区建国门外大街1号', distanceKm: 2.6 },
    ];

    test('空闲态发位置 → 识别城市 + 列出 3km 门店（熟店打标），回复「门店2」选定', async () => {
        const store = makeStoreStub(STORES, ['s2']);
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });

        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));

        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('已定位到：北京市朝阳区建国路1号');
        expect(last.content).toContain('3km 内门店');
        expect(last.content).toContain('朝阳门市部');
        expect(last.content).toContain('国贸店 ⭐熟店（2.6km）');
        expect(last.content).toContain('回复「门店1」');

        const session = connection.sessions.get('openid-user-1');
        expect(session.state ?? null).toBeNull();
        expect(session.draft.city).toBe('北京市');
        expect(session.draft.nearbyStores.map((s: any) => s.id)).toEqual(['s1', 's2']);
        // 定位坐标与熟店集合都传入门店匹配
        expect(store.findCalls[0]).toMatchObject({ lat: 39.9087, lng: 116.3975 });
        expect(store.findCalls[0].familiar).toEqual(['s2']);
        expect(store.familiarCalls[0]).toBe(42);

        // 空闲态回复「门店2」：直接从缓存列表回查并记录
        await svc.onMessage(textEvent('门店2', 'M2'));
        expect(outbound[outbound.length - 1].content).toContain('已记住您的门店：国贸店');
        expect(connection.sessions.get('openid-user-1').draft.storeId).toBe('s2');
    });

    test('3km 内无门店 → 文案提示仍可正常配送，并保留地址新增入口', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('暂未匹配到 3km 内的门店');
        expect(last.content).toContain('回复「新增地址」');
        expect(connection.sessions.get('openid-user-1').draft.nearbyStores).toEqual([]);
    });

    test('未发过位置就查「附近门店」→ 引导发送位置', async () => {
        const { svc, outbound } = makeService({ store: makeStoreStub(STORES) });
        await svc.onMessage(textEvent('附近门店', 'M1'));
        expect(outbound[0].content).toContain('请点聊天框「+」发送位置');
    });

    test('定位后「附近门店」→ 门店选择态，回复「2」选定；超范围提示', async () => {
        const { svc, connection, outbound } = makeService({
            geo: GEO_STUB,
            store: makeStoreStub(STORES),
        });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        await svc.onMessage(textEvent('附近门店', 'M2'));

        const listed = outbound[outbound.length - 1];
        expect(listed.content).toContain('当前城市：北京市');
        expect(listed.content).toContain('回复「门店N」选用');
        expect(connection.sessions.get('openid-user-1').state).toBe('store_pick');

        await svc.onMessage(textEvent('2', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('已记住您的门店：国贸店');
        const session = connection.sessions.get('openid-user-1');
        expect(session.state ?? null).toBeNull();
        expect(session.draft.storeId).toBe('s2');

        // 选择后仍可按缓存列表回查（编号超范围给提示）
        await svc.onMessage(textEvent('门店9', 'M4'));
        expect(outbound[outbound.length - 1].content).toContain('没有找到该门店');
    });

    test('地址操作流中回复「附近门店」→ 不打断当前流程', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store: makeStoreStub(STORES) });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await svc.onMessage(textEvent('地址管理', 'M1'));
        await svc.onMessage(textEvent('1', 'M2')); // addr_op
        await svc.onMessage(textEvent('附近门店', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('当前正在地址操作中');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_op');
    });
});

describe('AssistantService 一键客服（全局生效，不打断状态机）', () => {
    const STORES = [
        {
            id: 's1',
            name: '朝阳门市部',
            address: '朝阳区建国路2号',
            distanceKm: 0.4,
            phoneNumber: '010-88881111',
            businessHours: '09:00-21:00',
        },
        {
            id: 's2',
            name: '国贸店',
            address: '朝阳区建国门外大街1号',
            distanceKm: 2.6,
            phoneNumber: '010-88882222',
            businessHours: '09:00-22:00',
        },
    ];

    test('已选门店后回复「客服」→ 门店在线客服卡（引导留言，不给电话）', async () => {
        const store = makeStoreStub(STORES);
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store });
        connection.customers.set('openid-user-1', { id: 42 });

        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        await svc.onMessage(textEvent('门店2', 'M2'));
        await svc.onMessage(textEvent('客服', 'M3'));

        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('国贸店 · 在线客服');
        expect(last.content).toContain('营业　09:00-22:00');
        expect(last.content).toContain('请先回复「留言」写清问题');
        expect(last.content).not.toContain('010-88882222');
        expect(last.content).not.toContain('点击拨打');
        // 首次求助不给微信号
        expect(last.content).not.toContain('youshopcn');
        // 不进入任何流程态
        expect(connection.sessions.get('openid-user-1').state ?? null).toBeNull();
        expect(store.contactCalls).toContain('s2');
    });

    test('多候选未选门店 → 先让用户「客服N」指定，选中后给该店卡片', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store: makeStoreStub(STORES) });
        connection.customers.set('openid-user-1', { id: 42 });

        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        await svc.onMessage(textEvent('客服', 'M2'));

        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('要联系哪家店？回复「客服N」选择');
        expect(last.content).toContain('1. 朝阳门市部');
        expect(last.content).toContain('2. 国贸店');
        expect(connection.sessions.get('openid-user-1').state ?? null).toBeNull();

        await svc.onMessage(textEvent('客服2', 'M3'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('国贸店 · 在线客服');
        expect(last.content).toContain('请先回复「留言」');
        expect(last.content).not.toContain('010-88882222');
    });

    test('无门店上下文 → 店铺名 + 店铺链接，不给电话', async () => {
        const { svc, outbound } = makeService({});
        await svc.onMessage(textEvent('客服', 'M1'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('东利民粮油店 · 在线客服');
        expect(last.content).toContain('https://www.youshop.cn/official-20');
        expect(last.content).toContain('请先回复「留言」');
        expect(last.content).not.toContain('400-800-1234');
        expect(last.content).not.toContain('youshopcn');
    });

    test('会话已过期（旧行未清理）→ 客服仍可回复，不因唯一索引报错', async () => {
        const { svc, connection, outbound } = makeService({});
        connection.sessions.set('openid-user-1', {
            id: 's-old',
            openid: 'openid-user-1',
            channelId: '2',
            results: [],
            query: null,
            state: null,
            draft: {},
            expireAt: new Date(Date.now() - 60_000),
        });
        await svc.onMessage(textEvent('客服', 'M1'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('东利民粮油店 · 在线客服');
        // 旧行被原地重置并续期
        expect(connection.sessions.get('openid-user-1').expireAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('下单确认态回复「客服」→ 带这单商品上下文，且状态保留可继续下单', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store: makeStoreStub(STORES) });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });

        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2')); // 默认地址 → 地址选址
        await svc.onMessage(textEvent('1', 'M3')); // 选地址 → 下单确认
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');

        await svc.onMessage(textEvent('客服', 'M4'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('关于这单：海天生抽酱油 500ml ×1');
        // 状态机未被打断
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');

        // 仍可继续确认下单
        await svc.onMessage(textEvent('1', 'M5'));
        expect(outbound[outbound.length - 1].content).toContain('下单成功');
    });

    test('10 分钟内第 2 次「客服」→ 只回短提示，不重复刷屏', async () => {
        const { svc, connection, outbound } = makeService({ geo: GEO_STUB, store: makeStoreStub(STORES) });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(locationEvent(39.9087, 116.3975, 'L1'));
        await svc.onMessage(textEvent('门店2', 'M2'));

        await svc.onMessage(textEvent('客服', 'M3'));
        const first = outbound[outbound.length - 1].content;
        expect(first).toContain('国贸店 · 在线客服');

        await svc.onMessage(textEvent('客服', 'M4'));
        const second = outbound[outbound.length - 1].content;
        expect(second).toContain('客服入口刚发过');
        expect(second).not.toContain('国贸店 · 在线客服');
        expect(second).not.toContain('youshopcn');
    });

    test('同一会话第 3 次「客服」→ 附客服微信 youshopcn，第 4 次仍带', async () => {
        const { svc, outbound } = makeService({});

        await svc.onMessage(textEvent('客服', 'M1'));
        expect(outbound[outbound.length - 1].content).not.toContain('youshopcn');

        await svc.onMessage(textEvent('客服', 'M2'));
        expect(outbound[outbound.length - 1].content).not.toContain('youshopcn');

        await svc.onMessage(textEvent('客服', 'M3'));
        const third = outbound[outbound.length - 1].content;
        expect(third).toContain('客服微信：youshopcn');
        expect(third).toContain('直接发语音说明问题');

        await svc.onMessage(textEvent('客服', 'M4'));
        expect(outbound[outbound.length - 1].content).toContain('客服微信：youshopcn');
    });

    test('「客服9」超出候选范围 → 提示重新选择', async () => {
        const { svc, outbound } = makeService({ store: makeStoreStub(STORES) });
        await svc.onMessage(textEvent('客服9', 'M1'));
        expect(outbound[0].content).toContain('没有找到这家店');
    });

    test('卡片/帮助文案带客服入口（消息末尾统一提示）', async () => {
        const { svc, outbound } = makeService({
            search: makeSearchStub('error'),
        });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        expect(outbound[0].content).toContain('回复「客服」联系门店客服');
    });
});

describe('AssistantService 留言工单（≤200 字落库，保存后恢复原流程）', () => {
    /** 走到下单确认态：搜索 → 买1 → 选默认地址 */
    async function toOrderConfirm(svc: AssistantService) {
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3'));
    }

    test('下单确认态留言 → 工单落库（含商品上下文）→ 状态恢复可继续下单', async () => {
        const { svc, connection, outbound, supportTickets } = makeService({ geo: GEO_STUB });
        connection.customers.set('openid-user-1', { id: 42, phoneNumber: '13800138000' });
        await toOrderConfirm(svc);
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');

        await svc.onMessage(textEvent('留言', 'M4'));
        expect(outbound[outbound.length - 1].content).toContain('请直接回复留言内容（200 字以内）');
        expect(connection.sessions.get('openid-user-1').state).toBe('support_note');
        expect(connection.sessions.get('openid-user-1').draft.supportReturnState).toBe('order_confirm');

        await svc.onMessage(textEvent('这单大概多久能送到？', 'M5'));
        expect(outbound[outbound.length - 1].content).toContain('留言已提交（编号 #101）');
        expect(supportTickets.created).toHaveLength(1);
        expect(supportTickets.created[0]).toMatchObject({
            openid: 'openid-user-1',
            channelId: 2,
            customerId: 42,
            content: '这单大概多久能送到？',
        });
        expect(supportTickets.created[0].summary).toContain('商品：海天生抽酱油 500ml ×1');
        // 原流程恢复，继续下单
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');
        await svc.onMessage(textEvent('1', 'M6'));
        expect(outbound[outbound.length - 1].content).toContain('下单成功');
    });

    test('留言超长 → 不落库并提示精简；回复「取消」恢复原状态', async () => {
        const { svc, connection, outbound, supportTickets } = makeService({});
        await svc.onMessage(textEvent('留言', 'M1'));
        await svc.onMessage(textEvent('问'.repeat(201), 'M2'));
        expect(outbound[outbound.length - 1].content).toContain('留言有点长（201 字）');
        expect(supportTickets.created).toHaveLength(0);
        expect(connection.sessions.get('openid-user-1').state).toBe('support_note');

        await svc.onMessage(textEvent('取消', 'M3'));
        expect(outbound[outbound.length - 1].content).toContain('已取消留言');
        expect(connection.sessions.get('openid-user-1').state ?? null).toBeNull();
        expect(supportTickets.created).toHaveLength(0);
    });

    test('客服卡带「留言」入口提示', async () => {
        const { svc, outbound } = makeService({});
        await svc.onMessage(textEvent('客服', 'M1'));
        expect(outbound[0].content).toContain('回复「留言」写清问题');
    });
});

describe('AssistantService 支付方式（按租户渠道配置）', () => {
    const TWO_METHODS = [
        { code: 'wechatpay', name: '微信支付' },
        { code: 'cash-on-delivery', name: '门店收银' },
    ];

    test('「支付方式」查询 → 按渠道配置列出编号', async () => {
        const order = makeOrderStub(null, TWO_METHODS);
        const { svc, outbound } = makeService({ order });
        await svc.onMessage(textEvent('支付方式', 'M1'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('本店支持的支付方式');
        expect(last.content).toContain('1 微信支付');
        expect(last.content).toContain('2 门店收银');
    });

    test('渠道无可用支付方式 → 列空不建单，引导客服/留言', async () => {
        const order = makeOrderStub(null, []);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('支付方式', 'M1'));
        expect(outbound[outbound.length - 1].content).toContain('本店暂未开通在线支付');

        await svc.onMessage(textEvent('买一瓶酱油', 'M2'));
        await svc.onMessage(textEvent('买1', 'M3'));
        await svc.onMessage(textEvent('1', 'M4')); // 选地址 → 确认时发现无支付方式
        expect(outbound[outbound.length - 1].content).toContain('本店暂未开通在线支付');
        expect(order.calls).toHaveLength(0);
        expect(connection.sessions.get('openid-user-1').state ?? null).toBeNull();
    });

    test('多渠道：选址后先选支付方式（reply 2）→ 确认卡展示所选 → 下单成功带支付方式', async () => {
        const order = makeOrderStub(null, TWO_METHODS);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3')); // 选默认地址
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择支付方式');
        expect(connection.sessions.get('openid-user-1').state).toBe('pay_pick');
        await svc.onMessage(textEvent('2', 'M4')); // 门店收银
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('支付方式：门店收银');
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');
        await svc.onMessage(textEvent('1', 'M5'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('下单成功');
        expect(last.content).toContain('支付方式：门店收银');
        expect(order.calls).toHaveLength(1);
    });

    test('单一支付方式：确认页自动选中，无需额外选择', async () => {
        const order = makeOrderStub(null, [{ code: 'wechatpay', name: '微信支付' }]);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3'));
        const last = outbound[outbound.length - 1];
        expect(last.content).toContain('支付方式：微信支付');
        expect(last.content).toContain('回复 1 确认下单');
        expect(connection.sessions.get('openid-user-1').state).toBe('order_confirm');
    });

    test('确认页回复 9 → 重新选择支付方式', async () => {
        const order = makeOrderStub(null, TWO_METHODS);
        const { svc, connection, outbound } = makeService({ order });
        connection.customers.set('openid-user-1', { id: 42 });
        await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
        await svc.onMessage(textEvent('买1', 'M2'));
        await svc.onMessage(textEvent('1', 'M3'));
        await svc.onMessage(textEvent('1', 'M4')); // 微信支付
        let last = outbound[outbound.length - 1];
        expect(last.content).toContain('支付方式：微信支付');
        await svc.onMessage(textEvent('9', 'M5'));
        last = outbound[outbound.length - 1];
        expect(last.content).toContain('请选择支付方式');
        expect(connection.sessions.get('openid-user-1').state).toBe('pay_pick');
        await svc.onMessage(textEvent('0', 'M6'));
        expect(outbound[outbound.length - 1].content).toContain('请选择收货地址');
        expect(connection.sessions.get('openid-user-1').state).toBe('addr_pick');
    });
});
