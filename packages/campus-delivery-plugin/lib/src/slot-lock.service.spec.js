"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 时段锁位：认领幂等（slotLocked 标记）+ 容量原子增减 + 满员回滚
const vitest_1 = require("vitest");
const slot_lock_service_1 = require("./slot-lock.service");
function make(opts = {}) {
    var _a;
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
    // 锁位标记改走裸 SQL 条件写（slotLocked false→true 原子认领）；按 SQL 语义区分三种动作
    const rawQuery = vitest_1.vi.fn().mockImplementation((sql) => {
        var _a, _b;
        if (sql.includes('AS slot'))
            return Promise.resolve((_a = opts.unlockRows) !== null && _a !== void 0 ? _a : []);
        if (sql.includes('= false WHERE'))
            return Promise.resolve([[]]); // 满员回滚认领
        return Promise.resolve((_b = opts.claimRows) !== null && _b !== void 0 ? _b : [[{ id: 5 }]]); // 锁位认领
    });
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'DeliverySlot')
                return slotRepo;
            return {};
        }),
        rawConnection: { query: rawQuery },
    };
    return { svc: new slot_lock_service_1.SlotLockService(conn), qb, rawQuery, slotRepo };
}
const order = { id: '5', customFields: { deliverySlotId: '5' } };
(0, vitest_1.describe)('SlotLockService.lock', () => {
    (0, vitest_1.it)('余量充足：原子认领 slotLocked 后容量 +1', async () => {
        const { svc, qb, rawQuery } = make({ affected: 1 });
        const ok = await svc.lock({ channelId: 1 }, order);
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(rawQuery).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(rawQuery.mock.calls[0][0]).toContain('COALESCE("customFieldsSlotlocked", false) = false');
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith({ lockedCount: vitest_1.expect.anything() });
        (0, vitest_1.expect)(qb.execute).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('已锁位（支付事件重放/并发二次入厅）→ 幂等跳过，不再递增容量', async () => {
        const { svc, qb, rawQuery } = make({ claimRows: [[]] });
        const ok = await svc.lock({ channelId: 1 }, order);
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(rawQuery).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(qb.execute).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('容量满（affected=0）→ 返回 false 并回滚认领标记（取消时不得归还名额）', async () => {
        const { svc, rawQuery } = make({ affected: 0, slot: { id: 5, capacity: 20, lockedCount: 20 } });
        const ok = await svc.lock({ channelId: 1 }, order);
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(rawQuery).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(rawQuery.mock.calls[1][0]).toContain('"customFieldsSlotlocked" = false');
    });
    (0, vitest_1.it)('未选时段返回 true（跳过），不写标记', async () => {
        const { svc, rawQuery } = make({ slot: null });
        (0, vitest_1.expect)(await svc.lock({ channelId: 1 }, null)).toBe(true);
        (0, vitest_1.expect)(rawQuery).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('时段已被删除返回 true（不阻断下单），不写标记', async () => {
        const { svc, rawQuery } = make({ slot: null });
        const o = { id: '6', customFields: { deliverySlotId: '99' } };
        (0, vitest_1.expect)(await svc.lock({ channelId: 1 }, o)).toBe(true);
        (0, vitest_1.expect)(rawQuery).not.toHaveBeenCalled();
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
        rawQuery.mockResolvedValueOnce([{ slot: 5 }]).mockResolvedValueOnce([]);
        (0, vitest_1.expect)(await svc.unlock({ channelId: 1 }, 5)).toBe(true);
        (0, vitest_1.expect)(await svc.unlock({ channelId: 1 }, 5)).toBe(false);
        (0, vitest_1.expect)(qb.execute).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=slot-lock.service.spec.js.map