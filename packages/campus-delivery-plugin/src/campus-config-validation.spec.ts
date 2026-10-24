import { describe, expect, it, vi } from 'vitest';
import { CampusConfigService } from './campus-config.service';

function makeDs(opts: { zone?: any; dup?: any; slot?: any } = {}) {
    const zoneRepo = { findOne: vi.fn().mockResolvedValue(opts.zone ?? null) };
    const buildingRepo = {
        findOne: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockImplementation(async v => v),
    };
    const slotRepo = {
        findOne: vi.fn().mockImplementation(async (q: any) => ('id' in (q?.where ?? {}) ? opts.slot ?? null : opts.dup ?? null)),
        save: vi.fn().mockImplementation(async v => v),
    };
    const dataSource = {
        getRepository: (ent: any) => {
            const name = ent?.name ?? String(ent);
            if (name === 'CampusZone') return zoneRepo;
            if (name === 'CampusBuilding') return buildingRepo;
            return slotRepo;
        },
    } as any;
    const svc = new CampusConfigService(dataSource, {} as any);
    return { svc, zoneRepo, buildingRepo, slotRepo };
}

const ctx = { channelId: 1 } as any;

describe('CampusConfigService 入参校验', () => {
    it('createZone 拒绝空名称/负运费', async () => {
        const { svc } = makeDs();
        await expect(svc.createZone(ctx, '  ', 100)).rejects.toThrow('分区名称不能为空');
        await expect(svc.createZone(ctx, '东区', -1)).rejects.toThrow('非负整数');
        await expect(svc.createZone(ctx, '东区', 1.5)).rejects.toThrow('非负整数');
    });

    it('createBuilding 拒绝空名称与跨店分区', async () => {
        const { svc } = makeDs({ zone: null });
        await expect(svc.createBuilding(ctx, '', 1)).rejects.toThrow('楼栋名称不能为空');
        await expect(svc.createBuilding(ctx, '1号楼', 1)).rejects.toThrow('分区不存在或不属于当前店铺');
    });

    it('createBuilding 经纬度越界拒绝', async () => {
        const { svc } = makeDs({ zone: { id: 1 } });
        await expect(svc.createBuilding(ctx, '1号楼', 1, undefined, 91, 120)).rejects.toThrow('纬度必须在');
        await expect(svc.createBuilding(ctx, '1号楼', 1, undefined, 30, 181)).rejects.toThrow('经度必须在');
    });

    it('createSlot 拒绝非法日期/时刻/容量/起止顺序', async () => {
        const { svc } = makeDs();
        await expect(svc.createSlot(ctx, { slotDate: '2026/10/06', startTime: '11:00', endTime: '11:30' }))
            .rejects.toThrow('YYYY-MM-DD');
        await expect(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '25:00', endTime: '11:30' }))
            .rejects.toThrow('HH:mm');
        await expect(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '12:00', endTime: '11:30' }))
            .rejects.toThrow('开始时间必须早于结束时间');
        await expect(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', capacity: 0 }))
            .rejects.toThrow('1-9999');
    });

    it('createSlot 拒绝同店铺同分区重复时段', async () => {
        const { svc } = makeDs({ dup: { id: 9 } });
        await expect(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30' }))
            .rejects.toThrow('同一时段已存在');
    });

    it('createSlot 分区必须属于当前店铺', async () => {
        const { svc } = makeDs({ zone: null });
        await expect(svc.createSlot(ctx, {
            slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', zoneId: 3,
        })).rejects.toThrow('分区不存在或不属于当前店铺');
    });

    it('updateSlot 拒绝非法容量与起止倒置', async () => {
        const slot = { id: 5, channelId: 1, startTime: '11:00', endTime: '11:30', capacity: 20 };
        const { svc } = makeDs({ slot });
        await expect(svc.updateSlot(ctx, 5, { capacity: -1 })).rejects.toThrow('1-9999');
        await expect(svc.updateSlot(ctx, 5, { startTime: '12:00' })).rejects.toThrow('开始时间必须早于结束时间');
    });
});
