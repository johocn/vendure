// 时段锁位：认领幂等（slotLocked 标记）+ 容量原子增减 + 满员回滚
import { describe, expect, it, vi } from 'vitest';
import { SlotLockService } from './slot-lock.service';

function make(opts: { affected?: number; slot?: any; claimRows?: any[]; unlockRows?: any } = {}) {
    const qb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: opts.affected ?? 1 }),
    };
    const slotRepo = {
        findOne: vi.fn().mockResolvedValue(opts.slot === undefined ? { id: 5, capacity: 20, lockedCount: 3 } : opts.slot),
        createQueryBuilder: () => qb,
    };
    // 锁位标记改走裸 SQL 条件写（slotLocked false→true 原子认领）；按 SQL 语义区分三种动作
    const rawQuery = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('AS slot')) return Promise.resolve(opts.unlockRows ?? []);
        if (sql.includes('= false WHERE')) return Promise.resolve([[]]); // 满员回滚认领
        return Promise.resolve(opts.claimRows ?? [[{ id: 5 }]]); // 锁位认领
    });
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'DeliverySlot') return slotRepo;
            return {};
        }),
        rawConnection: { query: rawQuery },
    } as any;
    return { svc: new SlotLockService(conn), qb, rawQuery, slotRepo };
}

const order = { id: '5', customFields: { deliverySlotId: '5' } } as any;

describe('SlotLockService.lock', () => {
    it('余量充足：原子认领 slotLocked 后容量 +1', async () => {
        const { svc, qb, rawQuery } = make({ affected: 1 });
        const ok = await svc.lock({ channelId: 1 } as any, order);
        expect(ok).toBe(true);
        expect(rawQuery).toHaveBeenCalledOnce();
        expect(rawQuery.mock.calls[0][0]).toContain('COALESCE("customFieldsSlotlocked", false) = false');
        expect(qb.set).toHaveBeenCalledWith({ lockedCount: expect.anything() });
        // 容量条件用列比较（并发调低 capacity 也不会超额锁位）
        expect(qb.where).toHaveBeenCalledWith('id = :id AND "lockedCount" < "capacity"', { id: 5 });
        expect(qb.execute).toHaveBeenCalledOnce();
    });

    it('已锁位（支付事件重放/并发二次入厅）→ 幂等跳过，不再递增容量', async () => {
        const { svc, qb, rawQuery } = make({ claimRows: [[]] });
        const ok = await svc.lock({ channelId: 1 } as any, order);
        expect(ok).toBe(true);
        expect(rawQuery).toHaveBeenCalledOnce();
        expect(qb.execute).not.toHaveBeenCalled();
    });

    it('容量满（affected=0）→ 返回 false 并回滚认领标记（取消时不得归还名额）', async () => {
        const { svc, rawQuery } = make({ affected: 0, slot: { id: 5, capacity: 20, lockedCount: 20 } });
        const ok = await svc.lock({ channelId: 1 } as any, order);
        expect(ok).toBe(false);
        expect(rawQuery).toHaveBeenCalledTimes(2);
        expect(rawQuery.mock.calls[1][0]).toContain('"customFieldsSlotlocked" = false');
    });

    it('未选时段返回 true（跳过），不写标记', async () => {
        const { svc, rawQuery } = make({ slot: null });
        expect(await svc.lock({ channelId: 1 } as any, null)).toBe(true);
        expect(rawQuery).not.toHaveBeenCalled();
    });

    it('时段已被删除返回 true（不阻断下单），不写标记', async () => {
        const { svc, rawQuery } = make({ slot: null });
        const o = { id: '6', customFields: { deliverySlotId: '99' } } as any;
        expect(await svc.lock({ channelId: 1 } as any, o)).toBe(true);
        expect(rawQuery).not.toHaveBeenCalled();
    });
});

describe('SlotLockService.unlock 幂等释放', () => {
    it('已锁位的单 → 原子认领并归还容量一次', async () => {
        const { svc, qb, rawQuery } = make({ unlockRows: [{ slot: 5 }] });
        const ok = await svc.unlock({ channelId: 1 } as any, 5);
        expect(ok).toBe(true);
        expect(rawQuery).toHaveBeenCalledOnce();
        expect(qb.set).toHaveBeenCalledWith({ lockedCount: expect.anything() });
        expect(qb.execute).toHaveBeenCalledOnce();
    });

    it('未锁位（未支付/容量满/时段缺失）→ 认领失败，不扣容量', async () => {
        const { svc, qb } = make({ unlockRows: [] });
        const ok = await svc.unlock({ channelId: 1 } as any, 5);
        expect(ok).toBe(false);
        expect(qb.execute).not.toHaveBeenCalled();
    });

    it('重复取消 → 第二次认领失败，容量只归还一次（防容量虚增）', async () => {
        const { svc, qb, rawQuery } = make();
        rawQuery.mockResolvedValueOnce([{ slot: 5 }]).mockResolvedValueOnce([]);
        expect(await svc.unlock({ channelId: 1 } as any, 5)).toBe(true);
        expect(await svc.unlock({ channelId: 1 } as any, 5)).toBe(false);
        expect(qb.execute).toHaveBeenCalledOnce();
    });
});
