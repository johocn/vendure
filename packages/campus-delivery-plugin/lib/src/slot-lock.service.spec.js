"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const slot_lock_service_1 = require("./slot-lock.service");
(0, vitest_1.describe)('SlotLockService.lock', () => {
    const make = (affected, slot) => {
        const qb = {
            update: vitest_1.vi.fn().mockReturnThis(),
            set: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            execute: vitest_1.vi.fn().mockResolvedValue({ affected }),
        };
        const slotRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(slot), createQueryBuilder: () => qb };
        const conn = { getRepository: vitest_1.vi.fn((_ctx, ent) => ent.name === 'DeliverySlot' ? slotRepo : {}) };
        return { svc: new slot_lock_service_1.SlotLockService(conn), qb };
    };
    (0, vitest_1.it)('余量充足时 affected=1 锁位成功', async () => {
        const { svc, qb } = make(1, { id: 5, capacity: 20, lockedCount: 3 });
        const ok = await svc.lock({ channelId: 1 }, { id: '5', customFields: { deliverySlotId: '5' } });
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith({ lockedCount: vitest_1.expect.anything() });
    });
    (0, vitest_1.it)('容量满时 affected=0 返回 false（不抛错）', async () => {
        const { svc } = make(0, { id: 5, capacity: 20, lockedCount: 20 });
        const ok = await svc.lock({ channelId: 1 }, { id: '5', customFields: { deliverySlotId: '5' } });
        (0, vitest_1.expect)(ok).toBe(false);
    });
    (0, vitest_1.it)('订单未选时段返回 true（跳过）', async () => {
        const { svc } = make(1, null);
        const ok = await svc.lock({ channelId: 1 }, null);
        (0, vitest_1.expect)(ok).toBe(true);
    });
});
//# sourceMappingURL=slot-lock.service.spec.js.map