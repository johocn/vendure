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
//# sourceMappingURL=rider.service.spec.js.map