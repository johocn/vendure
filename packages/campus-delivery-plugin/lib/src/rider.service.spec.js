"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：覆盖 assertApprovedRider 三个断言分支（非骑手/待审拒、低信用分拒）
const vitest_1 = require("vitest");
const rider_service_1 = require("./rider.service");
(0, vitest_1.describe)('RiderService.assertApprovedRider', () => {
    const make = (cf) => {
        const svc = new rider_service_1.RiderService({}, {
            findOneByUserId: vitest_1.vi.fn().mockResolvedValue({ id: 1, customFields: cf }),
        });
        return svc.assertApprovedRider({ channelId: 1, activeUserId: 1 });
    };
    (0, vitest_1.it)('approved 且信用分达标通过', async () => (0, vitest_1.expect)(make({ riderStatus: 'approved', riderCredit: 100 })).resolves.toBeTruthy());
    (0, vitest_1.it)('pending 拒绝', async () => (0, vitest_1.expect)(make({ riderStatus: 'pending', riderCredit: 100 })).rejects.toThrow());
    (0, vitest_1.it)('信用分低于 60 拒绝', async () => (0, vitest_1.expect)(make({ riderStatus: 'approved', riderCredit: 59 })).rejects.toThrow());
});
// F8 审核列表分页：skip/take 透传 QueryBuilder，返回 { items, total }
(0, vitest_1.describe)('RiderService.listApplications（F8 分页）', () => {
    (0, vitest_1.it)('skip/take 透传并返回 items+total', async () => {
        const qb = {
            where: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            skip: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getManyAndCount: vitest_1.vi.fn().mockResolvedValue([[{ id: 1 }], 1]),
        };
        const conn = {
            getRepository: vitest_1.vi.fn().mockReturnValue({ createQueryBuilder: () => qb }),
        };
        const svc = new rider_service_1.RiderService(conn, {});
        const out = await svc.listApplications({ channelId: 1 }, 'pending', 50, 25);
        (0, vitest_1.expect)(qb.skip).toHaveBeenCalledWith(50);
        (0, vitest_1.expect)(qb.take).toHaveBeenCalledWith(25);
        (0, vitest_1.expect)(qb.orderBy).toHaveBeenCalled();
        (0, vitest_1.expect)(out).toEqual({ items: [{ id: 1 }], total: 1 });
    });
    (0, vitest_1.it)('缺省参数：skip=0 / take=200 兜底防全量', async () => {
        const qb = {
            where: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            skip: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getManyAndCount: vitest_1.vi.fn().mockResolvedValue([[], 0]),
        };
        const conn = { getRepository: vitest_1.vi.fn().mockReturnValue({ createQueryBuilder: () => qb }) };
        const svc = new rider_service_1.RiderService(conn, {});
        await svc.listApplications({ channelId: 1 }, 'approved');
        (0, vitest_1.expect)(qb.skip).toHaveBeenCalledWith(0);
        (0, vitest_1.expect)(qb.take).toHaveBeenCalledWith(200);
    });
});
//# sourceMappingURL=rider.service.spec.js.map