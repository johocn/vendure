// 纯逻辑单测：默认配置兜底
import { describe, expect, it, vi } from 'vitest';
import { CampusConfigService } from './campus-config.service';

describe('CampusConfigService.getConfig', () => {
    it('无配置时创建默认配置', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const save = vi.fn().mockImplementation(v => Promise.resolve(v));
        const svc = new CampusConfigService({ getRepository: () => ({ findOne, save }) } as any, {} as any);
        const ctx = { channelId: 1 } as any;
        const cfg = await svc.getConfig(ctx);
        expect(save).toHaveBeenCalledOnce();
        expect(cfg.riderCommissionRate).toBe(100);
        expect(cfg.autoAssignMinutes).toBe(10);
        expect(cfg.paused).toBe(false);
    });
});

describe('CampusConfigService slots', () => {
    const mkRepo = (slots: any[]) => ({
        find: vi.fn().mockResolvedValue(slots),
        findOne: vi.fn(),
        save: vi.fn().mockImplementation(v => Promise.resolve({ id: 1, ...v })),
        createQueryBuilder: vi.fn(),
    });
    it('slotsForShop 只返回 active 且余量>0', async () => {
        const repo = mkRepo([
            { id: 1, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 20 },
            { id: 2, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 5 },
            { id: 3, slotDate: '2099-01-01', active: false, capacity: 20, lockedCount: 0 },
        ]);
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        const out = await svc.slotsForShop({ channelId: 1 } as any);
        expect(out.map((s: any) => s.id)).toEqual([2]);
        expect(out[0].remaining).toBe(15);
    });
    it('createSlot 落 channelId', async () => {
        const repo = mkRepo([]);
        const svc = new CampusConfigService({ getRepository: () => repo } as any, {} as any);
        await svc.createSlot({ channelId: 7 } as any, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', capacity: 30 });
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ channelId: 7, capacity: 30 }));
    });
});
