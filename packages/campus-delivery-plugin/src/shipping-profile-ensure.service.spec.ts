import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShippingProfileEnsureService } from './shipping-profile-ensure.service';

/**
 * 合并默认配送档案（R2/R4 档案冲突治本）服务单测：
 * mock rawConnection.getRepository(实体名)（服务经实体名取 repo，避免对 cjk-plugin 构建期依赖）。
 */
function makeEnv(opts: {
    channel?: any;
    methods?: Array<any>;
    existingDefault?: any;
    unboundVariantIds?: number[];
}) {
    const channelRepo = { findOne: vi.fn().mockResolvedValue(opts.channel === undefined ? { id: 113, code: 'canteen-a' } : opts.channel) };
    const methodSaves: any[] = [];
    const methodRepo = {
        find: vi.fn().mockResolvedValue(opts.methods ?? []),
        save: vi.fn(async (m: any) => { methodSaves.push(m); return m; }),
    };
    const profileSaves: any[] = [];
    const clearDefaults = vi.fn().mockResolvedValue({});
    const profileRepo = {
        findOne: vi.fn().mockResolvedValue(opts.existingDefault ?? null),
        save: vi.fn(async (p: any) => { profileSaves.push(p); return p; }),
        createQueryBuilder: vi.fn(() => {
            const qb: any = {};
            qb.update = () => qb;
            qb.set = () => qb;
            qb.where = () => qb;
            qb.execute = clearDefaults;
            return qb;
        }),
    };
    const rawUpdates: Array<{ sql: string; params: any[] }> = [];
    const variantRepo = {
        createQueryBuilder: () => {
            const qb: any = {};
            qb.select = () => qb;
            qb.innerJoin = () => qb;
            qb.where = () => qb;
            qb.getRawMany = vi.fn().mockResolvedValue((opts.unboundVariantIds ?? []).map(id => ({ id })));
            return qb;
        },
        manager: { query: vi.fn(async (sql: string, params: any[]) => { rawUpdates.push({ sql, params }); return {}; }) },
    };
    const rawConnection = {
        getRepository: (name: string) =>
            name === 'Channel' ? channelRepo
            : name === 'ShippingMethod' ? methodRepo
            : name === 'ShippingProfile' ? profileRepo
            : variantRepo,
    };
    const svc = new ShippingProfileEnsureService({ rawConnection } as any);
    return { svc, methodSaves, profileSaves, rawUpdates, clearDefaults, methodRepo, profileRepo, channelRepo };
}

// 工厂函数（勿用共享常量：服务会原地 mutate methods.channels，污染后续用例）
const STORE_PICKUP = () => ({ id: 1, code: 'store-pickup', channels: [{ id: 113 }] });
const COURIER = () => ({ id: 9, code: 'courier-delivery', channels: [] });

describe('ShippingProfileEnsureService.ensureDefaultShippingProfile', () => {
    beforeEach(() => vi.clearAllMocks());

    it('渠道不存在 → 抛错', async () => {
        const { svc, channelRepo } = makeEnv({ channel: null });
        await expect(svc.ensureDefaultShippingProfile({} as any, 999)).rejects.toThrow('渠道不存在');
        expect(channelRepo.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
    });

    it('两个预期方式都缺失 → 抛错', async () => {
        const { svc } = makeEnv({ methods: [{ id: 5, code: 'flat-rate', channels: [] }] });
        await expect(svc.ensureDefaultShippingProfile({} as any, 113)).rejects.toThrow('未找到任何预期配送方式');
    });

    it('无租户默认档案 → 新建（含两方式、置默认、清旧标记）并补绑未绑变体', async () => {
        const { svc, profileSaves, clearDefaults, rawUpdates } = makeEnv({
            methods: [STORE_PICKUP(), COURIER()],
            unboundVariantIds: [87, 88],
        });
        const r = await svc.ensureDefaultShippingProfile({} as any, 113);
        expect(clearDefaults).toHaveBeenCalled();
        expect(profileSaves).toHaveLength(1);
        const p = profileSaves[0];
        expect(p.name).toBe('拾光达默认配送档案');
        expect(p.isTenantDefault).toBe(true);
        expect(p.isGlobal).toBe(false);
        expect(p.ownerChannelId).toBe(113);
        expect(p.shippingMethods.map((m: any) => m.id).sort()).toEqual([1, 9]);
        expect(r.profileId).toBe(String(p.id));
        expect(r.linkedMethodCodes.sort()).toEqual(['courier-delivery', 'store-pickup']);
        expect(r.missingMethodCodes).toEqual([]);
        expect(r.boundVariantCount).toBe(2);
        expect(rawUpdates).toHaveLength(1);
        expect(rawUpdates[0].params).toEqual([String(p.id), 87, 88]);
    });

    it('已有租户默认档案 → union 补缺失方式，不重复添加、不新建', async () => {
        const existing = { id: '1', name: '旧默认档案', enabled: true, shippingMethods: [{ id: 1 }] };
        const { svc, profileSaves, clearDefaults } = makeEnv({
            methods: [STORE_PICKUP(), COURIER()],
            existingDefault: existing,
        });
        const r = await svc.ensureDefaultShippingProfile({} as any, 113);
        expect(clearDefaults).not.toHaveBeenCalled();
        expect(profileSaves).toHaveLength(1);
        expect(profileSaves[0].shippingMethods.map((m: any) => m.id).sort()).toEqual([1, 9]);
        expect(r.profileId).toBe('1');
        expect(r.profileName).toBe('旧默认档案');
        expect(r.boundVariantCount).toBe(0);
    });

    it('方式未绑渠道 → 幂等补绑；已绑渠道 → 不重复 save', async () => {
        const { svc, methodSaves } = makeEnv({ methods: [STORE_PICKUP(), COURIER()] });
        await svc.ensureDefaultShippingProfile({} as any, 113);
        // store-pickup 已在渠道 113 → 不 save；courier-delivery 未绑 → save 补绑
        expect(methodSaves).toHaveLength(1);
        expect(methodSaves[0].code).toBe('courier-delivery');
        expect(methodSaves[0].channels.map((c: any) => Number(c.id))).toContain(113);
    });

    it('缺失方式进 missingMethodCodes，档案仍含找到的方式', async () => {
        const { svc, profileSaves } = makeEnv({ methods: [STORE_PICKUP()] });
        const r = await svc.ensureDefaultShippingProfile({} as any, 113);
        expect(r.missingMethodCodes).toEqual(['courier-delivery']);
        expect(r.linkedMethodCodes).toEqual(['store-pickup']);
        expect(profileSaves[0].shippingMethods.map((m: any) => m.id)).toEqual([1]);
    });

    it('无未绑变体 → boundVariantCount=0 且不执行 UPDATE', async () => {
        const { svc, rawUpdates } = makeEnv({ methods: [STORE_PICKUP(), COURIER()], unboundVariantIds: [] });
        const r = await svc.ensureDefaultShippingProfile({} as any, 113);
        expect(r.boundVariantCount).toBe(0);
        expect(rawUpdates).toHaveLength(0);
    });
});
