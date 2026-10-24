"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：原子加减分（+2 完单 / -5 拒单 / 扣到 0 下限）+ 流水落库
const vitest_1 = require("vitest");
const rider_credit_service_1 = require("./rider-credit.service");
(0, vitest_1.describe)('RiderCreditService.adjust', () => {
    const mk = (credit, delta) => {
        const saved = [];
        const logRepo = { save: vitest_1.vi.fn().mockImplementation(v => { saved.push(v); return Promise.resolve(v); }) };
        const conn = {
            getRepository: vitest_1.vi.fn(() => logRepo),
            // 原子 UPDATE ... RETURNING 返回 [rows, fields]（与 deliver 原子认领同款）
            rawConnection: { query: vitest_1.vi.fn().mockResolvedValue([[{ credit }], []]) },
        };
        void delta;
        return { svc: new rider_credit_service_1.RiderCreditService(conn), conn, logRepo, saved };
    };
    (0, vitest_1.it)('正常完单 +2 → 单条原子 UPDATE 返回新分值', async () => {
        const { svc, conn, saved } = mk(102, 2);
        const next = await svc.adjust({ channelId: 1 }, 9, 2, 'complete', 10);
        (0, vitest_1.expect)(next).toBe(102);
        (0, vitest_1.expect)(conn.rawConnection.query).toHaveBeenCalledWith(vitest_1.expect.stringContaining('GREATEST(0, COALESCE("customFieldsRidercredit", 100) + $1)'), [2, 9]);
        (0, vitest_1.expect)(saved[0]).toEqual(vitest_1.expect.objectContaining({ delta: 2, reason: 'complete', orderId: 10 }));
    });
    (0, vitest_1.it)('拒单 -5', async () => {
        const { svc, saved } = mk(95, -5);
        const next = await svc.adjust({ channelId: 1 }, 9, -5, 'reject_assign');
        (0, vitest_1.expect)(next).toBe(95);
        (0, vitest_1.expect)(saved[0]).toEqual(vitest_1.expect.objectContaining({ delta: -5 }));
    });
    (0, vitest_1.it)('扣到 0 为下限（DB GREATEST 夹紧）', async () => {
        const { svc } = mk(0, -10);
        const next = await svc.adjust({ channelId: 1 }, 9, -10, 'timeout_not_picked');
        (0, vitest_1.expect)(next).toBe(0);
    });
});
//# sourceMappingURL=rider-credit.service.spec.js.map