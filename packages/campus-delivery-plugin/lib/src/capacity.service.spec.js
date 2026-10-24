"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：在线骑手 = approved 且 5min 内有心跳；T0 预检透出 paused + 在线数
const vitest_1 = require("vitest");
const capacity_service_1 = require("./capacity.service");
const fiveMin = 5 * 60 * 1000;
(0, vitest_1.describe)('CapacityService', () => {
    const mk = (customers, cfg = { paused: false }) => {
        const customerRepo = { createQueryBuilder: () => ({
                leftJoin: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                andWhere: vitest_1.vi.fn().mockReturnThis(),
                getMany: vitest_1.vi.fn().mockResolvedValue(customers),
            }) };
        const configRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(cfg) };
        const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => ent.name === 'CampusFulfillmentConfig' ? configRepo : customerRepo) };
        const riderService = { assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 9 }) };
        return { svc: new capacity_service_1.CapacityService(conn, riderService), customerRepo, configRepo, riderService };
    };
    (0, vitest_1.it)('在线 = approved 且心跳在 5min 内', async () => {
        const { svc } = mk([
            { id: 1, customFields: { riderStatus: 'approved', riderOnlineAt: new Date(Date.now() - 60000) } },
            { id: 2, customFields: { riderStatus: 'approved', riderOnlineAt: new Date(Date.now() - fiveMin - 1000) } },
            { id: 3, customFields: { riderStatus: 'suspended', riderOnlineAt: new Date() } },
        ]);
        const riders = await svc.listOnlineRiders({ channelId: 1 });
        (0, vitest_1.expect)(riders.map((r) => r.id)).toEqual([1]);
    });
    (0, vitest_1.it)('capacityCheck：0 骑手时 ridersOnline=0 且 paused 透出', async () => {
        const { svc } = mk([], { paused: true });
        const out = await svc.capacityCheck({ channelId: 1 });
        (0, vitest_1.expect)(out).toEqual({ paused: true, ridersOnline: 0 });
    });
});
//# sourceMappingURL=capacity.service.spec.js.map