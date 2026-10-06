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
//# sourceMappingURL=hall-grab.service.spec.js.map