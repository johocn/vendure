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

describe('setDeliveryTarget route/slot 扩展', () => {
    const slot = {
        id: 5, channelId: 1, active: true, capacity: 20, lockedCount: 3,
        slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30',
    };
    const ctx = { channelId: 1, session: { activeOrderId: 100 } } as any;

    function makeEnv(opts: { slot?: any } = {}) {
        const zoneRepo = { findOne: vi.fn().mockResolvedValue({ id: 1, name: '东区' }) };
        const buildingRepo = { findOne: vi.fn().mockResolvedValue({ id: 7, name: '1号楼' }) };
        const slotRepo = { findOne: vi.fn().mockResolvedValue(opts.slot === undefined ? slot : opts.slot) };
        const repos: Record<string, any> = {
            CampusZone: zoneRepo,
            CampusBuilding: buildingRepo,
            DeliverySlot: slotRepo,
        };
        const dataSource = { getRepository: vi.fn((ent: any) => repos[ent.name ?? String(ent)]) } as any;
        const orderService = { updateCustomFields: vi.fn().mockResolvedValue({ id: 100 }) } as any;
        const svc = new CampusConfigService(dataSource, orderService);
        return { svc, orderService, slotRepo };
    }

    it('传 route+slotId 时写全 fulfillmentRoute/deliverySlotId/deliverySlotText/scheduledFor', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R3', 5);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            fulfillmentRoute: 'R3',
            deliverySlotId: '5',
            deliverySlotText: '2026-10-06 11:00-11:30',
            scheduledFor: new Date('2026-10-06T11:00:00'),
        });
    });
    it('slot 余量为 0 抛 UserInputError("该时段已满")', async () => {
        const env = makeEnv({ slot: { ...slot, lockedCount: 20 } });
        await expect(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('该时段已满');
    });
    it('slot 跨渠道/不存在/未激活 抛 UserInputError("时段不可用")', async () => {
        const a = makeEnv({ slot: { ...slot, channelId: 2 } });
        await expect(a.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const b = makeEnv({ slot: null });
        await expect(b.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const c = makeEnv({ slot: { ...slot, active: false } });
        await expect(c.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
    });
    it('R2 放行写入 fulfillmentRoute=R2；其余非法 route 仍拒绝', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R2' as any);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(
            ctx, 100, expect.objectContaining({ fulfillmentRoute: 'R2' }),
        );
        const bad = makeEnv();
        await expect(bad.svc.setDeliveryTarget(ctx, 1, 7, 'R9' as any)).rejects.toThrow('配送路线不合法');
    });
    it('未传 slotId（尽快送，undefined）同样清空 slot 字段与预约锚点（防 stale scheduledFor）', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            deliverySlotId: null,
            deliverySlotText: null,
            scheduledFor: null,
        });
    });
    it('显式 slotId=null（切回尽快送）同样清空残留字段', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R3', null as unknown as undefined);
        expect(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            fulfillmentRoute: 'R3',
            deliverySlotId: null,
            deliverySlotText: null,
            scheduledFor: null,
        });
    });
});
