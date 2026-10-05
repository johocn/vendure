import { describe, expect, it, vi } from 'vitest';
import { SlotLockService } from './slot-lock.service';

describe('SlotLockService.lock', () => {
    const make = (affected: number, slot: any) => {
        const qb = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({ affected }),
        };
        const slotRepo = { findOne: vi.fn().mockResolvedValue(slot), createQueryBuilder: () => qb };
        const conn = { getRepository: vi.fn((_ctx: any, ent: any) =>
            (ent as any).name === 'DeliverySlot' ? slotRepo : {}) } as any;
        return { svc: new SlotLockService(conn), qb };
    };

    it('余量充足时 affected=1 锁位成功', async () => {
        const { svc, qb } = make(1, { id: 5, capacity: 20, lockedCount: 3 });
        const ok = await svc.lock({ channelId: 1 } as any, { id: '5', customFields: { deliverySlotId: '5' } } as any);
        expect(ok).toBe(true);
        expect(qb.set).toHaveBeenCalledWith({ lockedCount: expect.anything() });
    });

    it('容量满时 affected=0 返回 false（不抛错）', async () => {
        const { svc } = make(0, { id: 5, capacity: 20, lockedCount: 20 });
        const ok = await svc.lock({ channelId: 1 } as any, { id: '5', customFields: { deliverySlotId: '5' } } as any);
        expect(ok).toBe(false);
    });

    it('订单未选时段返回 true（跳过）', async () => {
        const { svc } = make(1, null);
        const ok = await svc.lock({ channelId: 1 } as any, null);
        expect(ok).toBe(true);
    });
});
