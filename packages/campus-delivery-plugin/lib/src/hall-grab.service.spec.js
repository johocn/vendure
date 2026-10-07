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
//# sourceMappingURL=hall-grab.service.spec.js.map