"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：加减分（+2 完单 / -5 拒单 / 扣到 0 下限）+ 流水落库
const vitest_1 = require("vitest");
const rider_credit_service_1 = require("./rider-credit.service");
(0, vitest_1.describe)('RiderCreditService.adjust', () => {
    const mk = (credit) => {
        const saved = [];
        const customerRepo = {
            update: vitest_1.vi.fn().mockResolvedValue({}),
        };
        const logRepo = { save: vitest_1.vi.fn().mockImplementation(v => { saved.push(v); return Promise.resolve(v); }) };
        const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => ent.name === 'RiderCreditLog' ? logRepo : customerRepo) };
        // findOne 返回带 customFields 的 customer（模拟连接池直读）
        conn.rawConnection = { transaction: (fn) => fn({
                getRepository: () => ({ findOne: vitest_1.vi.fn().mockResolvedValue({ id: 9, customFields: { riderCredit: credit } }) }),
            }) };
        return { svc: new rider_credit_service_1.RiderCreditService(conn), customerRepo, logRepo, saved };
    };
    (0, vitest_1.it)('正常完单 +2', async () => {
        const { svc, customerRepo, saved } = mk(100);
        await svc.adjust({ channelId: 1 }, 9, 2, 'complete', 10);
        (0, vitest_1.expect)(customerRepo.update).toHaveBeenCalledWith(9, vitest_1.expect.objectContaining({
            customFields: { riderCredit: 102 },
        }));
        (0, vitest_1.expect)(saved[0]).toEqual(vitest_1.expect.objectContaining({ delta: 2, reason: 'complete', orderId: 10 }));
    });
    (0, vitest_1.it)('拒单 -5', async () => {
        const { svc, customerRepo } = mk(100);
        await svc.adjust({ channelId: 1 }, 9, -5, 'reject_assign');
        (0, vitest_1.expect)(customerRepo.update).toHaveBeenCalledWith(9, vitest_1.expect.objectContaining({
            customFields: { riderCredit: 95 },
        }));
    });
    (0, vitest_1.it)('扣到 0 为下限', async () => {
        const { svc, customerRepo } = mk(3);
        await svc.adjust({ channelId: 1 }, 9, -10, 'timeout_not_picked');
        (0, vitest_1.expect)(customerRepo.update).toHaveBeenCalledWith(9, vitest_1.expect.objectContaining({
            customFields: { riderCredit: 0 },
        }));
    });
});
//# sourceMappingURL=rider-credit.service.spec.js.map