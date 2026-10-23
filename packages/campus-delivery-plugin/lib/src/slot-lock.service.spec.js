"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const slot_lock_service_1 = require("./slot-lock.service");
function make(opts = {}) {
    var _a, _b;
    const qb = {
        update: vitest_1.vi.fn().mockReturnThis(),
        set: vitest_1.vi.fn().mockReturnThis(),
        where: vitest_1.vi.fn().mockReturnThis(),
        execute: vitest_1.vi.fn().mockResolvedValue({ affected: (_a = opts.affected) !== null && _a !== void 0 ? _a : 1 }),
    };
    const slotRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue(opts.slot === undefined ? { id: 5, capacity: 20, lockedCount: 3 } : opts.slot),
        createQueryBuilder: () => qb,
    };
    const orderRepo = { update: vitest_1.vi.fn().mockResolvedValue({}) };
    const rawQuery = vitest_1.vi.fn().mockResolvedValue((_b = opts.unlockRows) !== null && _b !== void 0 ? _b : []);
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'DeliverySlot')
                return slotRepo;
            if (name === 'Order')
                return orderRepo;
            return {};
        }),
        rawConnection: { query: rawQuery },
    };
    return { svc: new slot_lock_service_1.SlotLockService(conn), qb, orderRepo, rawQuery, slotRepo };
}
(0, vitest_1.describe)('SlotLockService.lock', () => {
    (0, vitest_1.it)('余量充足时 affected=1 锁位成功，并写 slotLocked 标记', async () => {
        const { svc, qb, orderRepo } = make({ affected: 1 });
        const ok = await svc.lock({ channelId: 1 }, { id: '5', customFields: { deliverySlotId: '5' } });
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith({ lockedCount: vitest_1.expect.anything() });
        (0, vitest_1.expect)(orderRepo.update).toHaveBeenCalledWith('5', { customFields: { slotLocked: true } });
    });
    (0, vitest_1.it)('容量满时 affected=0 返回 false，且不写锁位标记（取消时不得归还容量）', async () => {
        const { svc, orderRepo } = make({ affected: 0, slot: { id: 5, capacity: 20, lockedCount: 20 } });
        const ok = await svc.lock({ channelId: 1 }, { id: '5', customFields: { deliverySlotId: '5' } });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(orderRepo.update).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('订单未选时段返回 true（跳过），不写标记', async () => {
        const { svc, orderRepo } = make({ slot: null });
        const ok = await svc.lock({ channelId: 1 }, null);
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(orderRepo.update).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('时段已被删除返回 true（不阻断下单），不写标记', async () => {
        const { svc, orderRepo } = make({ slot: null });
        const ok = await svc.lock({ channelId: 1 }, { id: '6', customFields: { deliverySlotId: '99' } });
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(orderRepo.update).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)('SlotLockService.unlock 幂等释放', () => {
    (0, vitest_1.it)('已锁位的单 → 原子认领并归还容量一次', async () => {
        const { svc, qb, rawQuery } = make({ unlockRows: [{ slot: 5 }] });
        const ok = await svc.unlock({ channelId: 1 }, 5);
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(rawQuery).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith({ lockedCount: vitest_1.expect.anything() });
        (0, vitest_1.expect)(qb.execute).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('未锁位（未支付/容量满/时段缺失）→ 认领失败，不扣容量', async () => {
        const { svc, qb } = make({ unlockRows: [] });
        const ok = await svc.unlock({ channelId: 1 }, 5);
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(qb.execute).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('重复取消 → 第二次认领失败，容量只归还一次（防容量虚增）', async () => {
        const { svc, qb, rawQuery } = make();
        rawQuery.mockResolvedValueOnce([{ slot: 5 }]).mockResolvedValue([]);
        (0, vitest_1.expect)(await svc.unlock({ channelId: 1 }, 5)).toBe(true);
        (0, vitest_1.expect)(await svc.unlock({ channelId: 1 }, 5)).toBe(false);
        (0, vitest_1.expect)(qb.execute).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=slot-lock.service.spec.js.map