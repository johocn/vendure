import { describe, expect, it, vi } from 'vitest';
import { SlotLockService } from './slot-lock.service';

function make(opts: { affected?: number; slot?: any; unlockRows?: any } = {}) {
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
    const orderRepo = { update: vi.fn().mockResolvedValue({}) };
    const rawQuery = vi.fn().mockResolvedValue(opts.unlockRows ?? []);
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'DeliverySlot') return slotRepo;
            if (name === 'Order') return orderRepo;
            return {};
        }),
        rawConnection: { query: rawQuery },
    } as any;
    return { svc: new SlotLockService(conn), qb, orderRepo, rawQuery, slotRepo };
}

describe('SlotLockService.lock', () => {
    it('余量充足时 affected=1 锁位成功，并写 slotLocked 标记', async () => {
        const { svc, qb, orderRepo } = make({ affected: 1 });
        const ok = await svc.lock({ channelId: 1 } as any, { id: '5', customFields: { deliverySlotId: '5' } } as any);
        expect(ok).toBe(true);
        expect(qb.set).toHaveBeenCalledWith({ lockedCount: expect.anything() });
        expect(orderRepo.update).toHaveBeenCalledWith('5', { customFields: { slotLocked: true } });
    });

    it('容量满时 affected=0 返回 false，且不写锁位标记（取消时不得归还容量）', async () => {
        const { svc, orderRepo } = make({ affected: 0, slot: { id: 5, capacity: 20, lockedCount: 20 } });
        const ok = await svc.lock({ channelId: 1 } as any, { id: '5', customFields: { deliverySlotId: '5' } } as any);
        expect(ok).toBe(false);
        expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('订单未选时段返回 true（跳过），不写标记', async () => {
        const { svc, orderRepo } = make({ slot: null });
        const ok = await svc.lock({ channelId: 1 } as any, null);
        expect(ok).toBe(true);
        expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('时段已被删除返回 true（不阻断下单），不写标记', async () => {
        const { svc, orderRepo } = make({ slot: null });
        const ok = await svc.lock({ channelId: 1 } as any, { id: '6', customFields: { deliverySlotId: '99' } } as any);
        expect(ok).toBe(true);
        expect(orderRepo.update).not.toHaveBeenCalled();
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
        rawQuery.mockResolvedValueOnce([{ slot: 5 }]).mockResolvedValue([]);
        expect(await svc.unlock({ channelId: 1 } as any, 5)).toBe(true);
        expect(await svc.unlock({ channelId: 1 } as any, 5)).toBe(false);
        expect(qb.execute).toHaveBeenCalledOnce();
    });
});
