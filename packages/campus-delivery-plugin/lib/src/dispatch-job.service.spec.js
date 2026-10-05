"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dispatch_job_service_1 = require("./dispatch-job.service");
function makeEnv(opts) {
    var _a, _b;
    const grabResults = [];
    const grabSvc = {
        grabByRider: vitest_1.vi.fn().mockImplementation((_ctx, orderId, rider) => {
            grabResults.push({ orderId, riderId: rider.id });
            return Promise.resolve({ id: orderId });
        }),
    };
    const creditSvc = { adjust: vitest_1.vi.fn().mockResolvedValue(95) };
    const hallSvc = {
        backToHall: vitest_1.vi.fn().mockResolvedValue({}),
        updateOrder: vitest_1.vi.fn().mockResolvedValue({}),
    };
    const capacitySvc = { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue((_a = opts.onlineRiders) !== null && _a !== void 0 ? _a : []) };
    const orderRepo = {
        findOne: vitest_1.vi.fn(),
        createQueryBuilder: () => {
            var _a, _b;
            return ({
                where: vitest_1.vi.fn().mockReturnThis(),
                getMany: vitest_1.vi.fn().mockResolvedValue([...((_a = opts.openOrders) !== null && _a !== void 0 ? _a : []), ...((_b = opts.assignedOrders) !== null && _b !== void 0 ? _b : [])]),
            });
        },
    };
    const configRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.cfg) !== null && _b !== void 0 ? _b : { autoAssignMinutes: 10, autoRefundMinutes: 30, inProgressSlaMinutes: 45 }) };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'CampusFulfillmentConfig')
                return configRepo;
            return orderRepo;
        }),
    };
    const svc = new dispatch_job_service_1.DispatchJobService(conn, grabSvc, hallSvc, capacitySvc, creditSvc);
    return { svc, grabSvc, creditSvc, hallSvc, capacitySvc, orderRepo, configRepo, grabResults };
}
const now = Date.now();
const minAgo = (m) => new Date(now - m * 60000);
(0, vitest_1.describe)('DispatchJobService.scan', () => {
    (0, vitest_1.it)('open 超 autoAssignMinutes → 强派最佳在线骑手', async () => {
        const { svc, grabSvc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults[0]).toEqual({ orderId: 1, riderId: 7 }); // 信用分高者优先
        (0, vitest_1.expect)(grabSvc.grabByRider).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('低信用分(<60)骑手不参与强派', async () => {
        const { svc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [{ id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 59 } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults).toHaveLength(0);
    });
    (0, vitest_1.it)('assigned 超 15min 未取货 → 回大厅 + 扣 10 分', async () => {
        const { svc, hallSvc, creditSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(16), hallEnteredAt: minAgo(20) } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.backToHall).toHaveBeenCalledWith(vitest_1.expect.anything(), 2);
        (0, vitest_1.expect)(creditSvc.adjust).toHaveBeenCalledWith(vitest_1.expect.anything(), 9, -10, 'timeout_not_picked', 2);
    });
    (0, vitest_1.it)('assigned 未超 15min 不动', async () => {
        const { svc, hallSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.backToHall).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=dispatch-job.service.spec.js.map