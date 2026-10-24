"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：grab 事务防双抢（open 可抢 / 已被抢抛「手慢了」/ 不能抢自己的订单）
const vitest_1 = require("vitest");
const hall_grab_service_1 = require("./hall-grab.service");
const openOrder = { id: 10, code: 'A1', customer: { id: 7 }, customFields: { hallStatus: 'open' } };
function makeSvc(order) {
    const riderSvc = {
        assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({
            id: 9,
            customFields: { riderStatus: 'approved', riderCredit: 100 },
        }),
    };
    const updated = [];
    const em = {
        getRepository: () => ({
            findOne: vitest_1.vi.fn().mockResolvedValue(order),
            update: vitest_1.vi.fn((_id, patch) => {
                updated.push(patch);
                return Promise.resolve();
            }),
            findOneByOrFail: vitest_1.vi.fn().mockResolvedValue(order),
        }),
    };
    const conn = { rawConnection: { transaction: (fn) => fn(em) } };
    return { svc: new hall_grab_service_1.HallGrabService(conn, riderSvc, { user: vitest_1.vi.fn() }), updated };
}
(0, vitest_1.describe)('HallGrabService.grab', () => {
    (0, vitest_1.it)('open 订单可抢并写入 delivery customFields', async () => {
        const { svc, updated } = makeSvc(openOrder);
        await svc.grab({ channelId: 1 }, 10);
        (0, vitest_1.expect)(updated[0].customFields.hallStatus).toBe('grabbed');
        (0, vitest_1.expect)(updated[0].customFields.deliveryStatus).toBe('assigned');
        (0, vitest_1.expect)(updated[0].customFields.deliveryStaffId).toBe('9');
    });
    (0, vitest_1.it)('已被抢订单抛「手慢了」', async () => {
        const grabbed = Object.assign(Object.assign({}, openOrder), { customFields: { hallStatus: 'grabbed' } });
        const { svc } = makeSvc(grabbed);
        await (0, vitest_1.expect)(svc.grab({ channelId: 1 }, 10)).rejects.toThrow('手慢了');
    });
    (0, vitest_1.it)('不能抢自己的订单', async () => {
        const mine = Object.assign(Object.assign({}, openOrder), { customer: { id: 9 } });
        const { svc } = makeSvc(mine);
        await (0, vitest_1.expect)(svc.grab({ channelId: 1 }, 10)).rejects.toThrow('不能抢自己的订单');
    });
});
// plan 3.3 多单顺路：整组抢单（主单带 routeGroupId → 同组 open 单一并写同一骑手）
(0, vitest_1.describe)('HallGrabService.grab 整组抢单（plan 3.3）', () => {
    function makeGroupSvc(main, mates) {
        const riderSvc = {
            assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 9 }),
        };
        const updates = [];
        const notifyCalls = [];
        const em = {
            getRepository: () => ({
                findOne: vitest_1.vi.fn().mockResolvedValue(main),
                findOneByOrFail: vitest_1.vi.fn().mockResolvedValue(main),
                update: vitest_1.vi.fn((id, patch) => {
                    updates.push({ id, riderId: patch.customFields.deliveryStaffId });
                    return Promise.resolve();
                }),
                createQueryBuilder: () => ({
                    where: vitest_1.vi.fn().mockReturnThis(),
                    andWhere: vitest_1.vi.fn().mockReturnThis(),
                    orderBy: vitest_1.vi.fn().mockReturnThis(),
                    setLock: vitest_1.vi.fn().mockReturnThis(),
                    getMany: vitest_1.vi.fn().mockResolvedValue(mates),
                }),
            }),
        };
        const conn = { rawConnection: { transaction: (fn) => fn(em) } };
        const svc = new hall_grab_service_1.HallGrabService(conn, riderSvc, { user: vitest_1.vi.fn((_c, id) => notifyCalls.push(id)) });
        return { svc, updates, notifyCalls };
    }
    (0, vitest_1.it)('整组接走：组内 open 单全部写同一骑手并逐单通知', async () => {
        const main = { id: 10, code: 'A1', customer: { id: 7 }, customerId: 7, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } };
        const { svc, updates, notifyCalls } = makeGroupSvc(main, [
            { id: 11, customerId: 8, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } },
            { id: 12, customerId: 50, customFields: { hallStatus: 'grabbed', routeGroupId: 'rg-x' } }, // 已被抢，getMany 过滤由 SQL 完成，mock 模拟返回前由 hallStatus 过滤
        ].filter(m => m.customFields.hallStatus === 'open'));
        await svc.grab({ channelId: 1 }, 10);
        (0, vitest_1.expect)(updates.map(u => u.id).sort()).toEqual([10, 11]);
        (0, vitest_1.expect)(new Set(updates.map(u => u.riderId))).toEqual(new Set(['9']));
        (0, vitest_1.expect)(notifyCalls.sort()).toEqual([10, 11]);
    });
    (0, vitest_1.it)('组内骑手自己的单跳过留在大厅', async () => {
        const main = { id: 10, code: 'A1', customer: { id: 7 }, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } };
        const { svc, updates } = makeGroupSvc(main, [
            { id: 12, customerId: 9, customFields: { hallStatus: 'open', routeGroupId: 'rg-x' } }, // 骑手自己(9)的单
        ]);
        await svc.grab({ channelId: 1 }, 10);
        (0, vitest_1.expect)(updates.map(u => u.id)).toEqual([10]);
    });
    (0, vitest_1.it)('无 routeGroupId 的单行为不变（单卡抢单）', async () => {
        const { svc, updates, notifyCalls } = makeGroupSvc(openOrder, []);
        await svc.grab({ channelId: 1 }, 10);
        (0, vitest_1.expect)(updates).toHaveLength(1);
        (0, vitest_1.expect)(updates[0].id).toBe(10);
        (0, vitest_1.expect)(notifyCalls).toEqual([10]);
    });
});
// F5 聚合大厅：一次带回全渠道（非默认渠道+有履约配置+未暂停）open 单并附店铺渠道信息
(0, vitest_1.describe)('HallGrabService.hallAll（F5 聚合大厅）', () => {
    function makeHallAllEnv(orders, channels, configs) {
        // qb 共享实例（Order repo 每次返回同一个）：测试可断言链式调用
        const qb = {
            leftJoinAndSelect: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getMany: vitest_1.vi.fn().mockResolvedValue(orders),
        };
        const repoFor = (ent) => {
            const name = ent.name;
            if (name === 'CampusFulfillmentConfig')
                return { find: vitest_1.vi.fn().mockResolvedValue(configs) };
            if (name === 'Channel')
                return { find: vitest_1.vi.fn().mockResolvedValue(channels) };
            return { createQueryBuilder: () => qb };
        };
        const conn = { getRepository: (_c, ent) => repoFor(ent) };
        return new hall_grab_service_1.HallGrabService(conn, { assertApprovedRider: vitest_1.vi.fn() }, { user: vitest_1.vi.fn() });
    }
    const stores = [
        { id: 1, code: '__default_channel__', token: 'default' },
        { id: 2, code: 'shop-a', token: 'tok-a' },
        { id: 3, code: 'shop-b', token: 'tok-b' },
    ];
    (0, vitest_1.it)('open 单附加 channelToken/channelName；paused 渠道剔除', async () => {
        const o1 = { id: 1, code: 'A', total: 1000, shipping: 300, createdAt: new Date(), channels: [{ id: 2 }], customFields: { hallStatus: 'open', tip: 0, hallEnteredAt: new Date() } };
        const o2 = { id: 2, code: 'B', total: 2000, shipping: 300, createdAt: new Date(), channels: [{ id: 3 }], customFields: { hallStatus: 'open', tip: 100, hallEnteredAt: new Date() } };
        const svc = makeHallAllEnv([o1, o2], stores, [{ channelId: 2, paused: false }, { channelId: 3, paused: true }]);
        const out = await svc.hallAll({});
        (0, vitest_1.expect)(out.map(o => o.id)).toEqual([1]);
        (0, vitest_1.expect)(out[0].channelToken).toBe('tok-a');
        (0, vitest_1.expect)(out[0].channelName).toBe('shop-a');
        (0, vitest_1.expect)(out[0].customFields.hallStatus).toBe('open');
    });
    (0, vitest_1.it)('跨渠道合并后统一排序：非加急单按小费降序', async () => {
        const t = (m) => new Date(Date.now() - m * 60000);
        const low = { id: 1, code: 'L', channels: [{ id: 2 }], createdAt: t(3), customFields: { hallStatus: 'open', tip: 0, hallEnteredAt: t(3) } };
        const high = { id: 2, code: 'H', channels: [{ id: 3 }], createdAt: t(2), customFields: { hallStatus: 'open', tip: 50, hallEnteredAt: t(2) } };
        const svc = makeHallAllEnv([low, high], stores, [{ channelId: 2, paused: false }, { channelId: 3, paused: false }]);
        const out = await svc.hallAll({});
        (0, vitest_1.expect)(out.map(o => o.code)).toEqual(['H', 'L']);
    });
    (0, vitest_1.it)('无履约渠道时返回空数组', async () => {
        const svc = makeHallAllEnv([], stores, []);
        (0, vitest_1.expect)(await svc.hallAll({})).toEqual([]);
    });
    (0, vitest_1.it)('take 截断前固定 orderBy（PG LIMIT 无 ORDER BY 截断集不确定）', async () => {
        const svc = makeHallAllEnv([], stores, [{ channelId: 2, paused: false }]);
        await svc.hallAll({});
        const qb = svc.connection.getRepository(null, { name: 'Order' }).createQueryBuilder();
        (0, vitest_1.expect)(qb.orderBy).toHaveBeenCalledWith('order.createdAt', 'ASC');
        (0, vitest_1.expect)(qb.take).toHaveBeenCalledWith(500);
    });
});
//# sourceMappingURL=hall-grab.service.spec.js.map