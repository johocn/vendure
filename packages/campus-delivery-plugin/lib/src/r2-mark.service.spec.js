"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const r2_mark_service_1 = require("./r2-mark.service");
function makeEnv(opts = {}) {
    var _a;
    const orderRepo = { update: vitest_1.vi.fn().mockResolvedValue({}) };
    const conn = {
        getRepository: vitest_1.vi.fn(() => orderRepo),
    };
    const orderSvc = { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.order) !== null && _a !== void 0 ? _a : null) };
    const svc = new r2_mark_service_1.R2MarkService(conn, orderSvc);
    return { svc, orderRepo, orderSvc };
}
(0, vitest_1.describe)('R2MarkService.markArrived', () => {
    (0, vitest_1.it)('本人 R2 单可标记到校（leg1Status=arrived_gate + handoverAt）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 9 } } },
        });
        const res = await env.svc.markArrived({ activeUserId: 9 }, 6);
        (0, vitest_1.expect)(env.orderRepo.update).toHaveBeenCalledWith(6, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ leg1Status: 'arrived_gate' }),
        }));
        (0, vitest_1.expect)(res).toEqual({ leg1Status: 'arrived_gate' });
    });
    (0, vitest_1.it)('非本人拒绝（ForbiddenError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 8 } } },
        });
        await (0, vitest_1.expect)(env.svc.markArrived({ activeUserId: 9 }, 6)).rejects.toThrow();
        (0, vitest_1.expect)(env.orderRepo.update).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('非 R2 单拒绝（UserInputError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R3' }, customer: { user: { id: 9 } } },
        });
        await (0, vitest_1.expect)(env.svc.markArrived({ activeUserId: 9 }, 6)).rejects.toThrow('仅 R2 快递单支持到校确认');
        (0, vitest_1.expect)(env.orderRepo.update).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=r2-mark.service.spec.js.map