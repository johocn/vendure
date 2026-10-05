"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dispatch_admin_service_1 = require("./dispatch-admin.service");
function makeEnv(opts) {
    var _a, _b;
    const grabSvc = { grabByRider: vitest_1.vi.fn().mockResolvedValue(true) };
    const hallSvc = { backToHall: vitest_1.vi.fn().mockResolvedValue({}) };
    const capacitySvc = { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue((_a = opts.onlineRiders) !== null && _a !== void 0 ? _a : []) };
    const orderRepo = {
        findOne: vitest_1.vi.fn(),
        createQueryBuilder: () => {
            var _a;
            return ({
                leftJoin: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                andWhere: vitest_1.vi.fn().mockReturnThis(),
                getMany: vitest_1.vi.fn().mockResolvedValue((_a = opts.orders) !== null && _a !== void 0 ? _a : []),
            });
        },
    };
    const configRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.cfg) !== null && _b !== void 0 ? _b : { autoAssignMinutes: 10, inProgressSlaMinutes: 45 }),
    };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'CampusFulfillmentConfig')
                return configRepo;
            return orderRepo;
        }),
    };
    const svc = new dispatch_admin_service_1.DispatchAdminService(conn, grabSvc, hallSvc, capacitySvc);
    return { svc, grabSvc, hallSvc, capacitySvc, orderRepo, configRepo };
}
const now = Date.now();
const minAgo = (m) => new Date(now - m * 60000);
(0, vitest_1.describe)('DispatchAdminService.board', () => {
    (0, vitest_1.it)('滞留超 autoAssignMinutes 的 open 单 → alert stale_open', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(12), campusZone: 'A区' } }],
            cfg: { autoAssignMinutes: 10, inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '1', type: 'stale_open' }));
    });
    (0, vitest_1.it)('open 未超时 → 不告警，进 hallOrders', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } }],
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts).toHaveLength(0);
        (0, vitest_1.expect)(board.hallOrders).toHaveLength(1);
        (0, vitest_1.expect)(board.activeOrders).toHaveLength(0);
    });
    (0, vitest_1.it)('in_progress 超 SLA → alert sla_breach', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 2, code: 'A2', customFields: { hallStatus: 'grabbed', deliveryStatus: 'in_progress', assignedAt: minAgo(50) } }],
            cfg: { inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '2', type: 'sla_breach' }));
        (0, vitest_1.expect)(board.activeOrders).toHaveLength(1);
    });
    (0, vitest_1.it)('campusCause=slot_full → alert slot_full', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 3, code: 'A3', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(1), campusCause: 'slot_full' } }],
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '3', type: 'slot_full' }));
    });
});
//# sourceMappingURL=dispatch-admin.service.spec.js.map