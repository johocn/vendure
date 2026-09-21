import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageBinService } from './storage-bin.service';

function makeConn() {
    const zoneRepo = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn((x: any) => x),
        save: vi.fn(async (x: any) => ({ ...x, id: x.code === 'A' ? 11 : 99 })),
    };
    const binRepo = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn((x: any) => x),
        save: vi.fn(async (x: any) => x),
        delete: vi.fn(),
    };
    const bindRepo = {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn((x: any) => x),
        save: vi.fn(async (x: any) => x),
        createQueryBuilder: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            getRawMany: vi.fn().mockResolvedValue([]),
            execute: vi.fn().mockResolvedValue({}),
        })),
    };
    const conn = {
        getRepository: vi.fn((_ctx: any, entity: any) => {
            const name = typeof entity === 'function' ? entity.name : String(entity);
            if (name === 'StorageZone') return zoneRepo;
            if (name === 'StorageBin') return binRepo;
            return bindRepo;
        }),
    } as any;
    return { conn, zoneRepo, binRepo, bindRepo };
}

describe('StorageBinService', () => {
    let svc: StorageBinService;
    let m: ReturnType<typeof makeConn>;

    beforeEach(() => {
        m = makeConn();
        svc = new StorageBinService(m.conn);
    });

    it('resolveMode 缺省与非法值都回退 off', () => {
        expect(StorageBinService.resolveMode({})).toBe('off');
        expect(StorageBinService.resolveMode({ binMode: null })).toBe('off');
        expect(StorageBinService.resolveMode({ binMode: 'garbage' })).toBe('off');
        expect(StorageBinService.resolveMode({ binMode: 'zone' })).toBe('zone');
        expect(StorageBinService.resolveMode({ binMode: 'bin' })).toBe('bin');
    });

    it('generateStandard 空仓时建 4 库区 18 库位', async () => {
        const r = await svc.generateStandard({ channelId: 2 } as any, 1);
        expect(r.zonesCreated).toBe(4);
        expect(r.binsCreated).toBe(18);
    });

    it('generateStandard 幂等：已存在编码不重建', async () => {
        m.zoneRepo.find.mockResolvedValue([
            { id: 11, code: 'A' }, { id: 12, code: 'B' }, { id: 13, code: 'C' }, { id: 14, code: 'D' },
        ]);
        m.binRepo.find.mockResolvedValue(
            Array.from({ length: 10 }, (_, i) => ({ id: i + 1, code: `A-0${i}` })),
        );
        const r = await svc.generateStandard({ channelId: 2 } as any, 1);
        expect(r.zonesCreated).toBe(0);
    });

    it('bind 库位不属于所选仓时被拒绝', async () => {
        m.binRepo.findOne.mockResolvedValue({ id: 5, stockLocationId: 9, zoneId: 11 });
        await expect(
            svc.bind({ channelId: 2 } as any, { variantId: 1, stockLocationId: 1, zoneId: 11, binId: 5 }),
        ).rejects.toThrow('库位不属于所选仓库');
    });

    it('bind 库位与库区不匹配时被拒绝', async () => {
        m.binRepo.findOne.mockResolvedValue({ id: 5, stockLocationId: 1, zoneId: 12 });
        await expect(
            svc.bind({ channelId: 2 } as any, { variantId: 1, stockLocationId: 1, zoneId: 11, binId: 5 }),
        ).rejects.toThrow('库位与库区不匹配');
    });

    it('bind 已有绑定时就地更新而非新增行', async () => {
        m.binRepo.findOne.mockResolvedValue({ id: 5, stockLocationId: 1, zoneId: 11 });
        m.bindRepo.findOne.mockResolvedValue({ id: 7, binId: null, zoneId: 11 });
        const out = await svc.bind(
            { channelId: 2 } as any,
            { variantId: 1, stockLocationId: 1, zoneId: 11, binId: 5 },
        );
        expect(out.id).toBe(7);
        expect(out.binId).toBe(5);
    });

    it('deleteBin 有绑定占用时被拒绝并报占用数', async () => {
        m.bindRepo.count.mockResolvedValue(3);
        await expect(svc.deleteBin({ channelId: 2 } as any, 5)).rejects.toThrow('已被 3 个 SKU 占用');
    });
});