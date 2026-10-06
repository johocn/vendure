"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shipping_profile_ensure_service_1 = require("./shipping-profile-ensure.service");
/**
 * 合并默认配送档案（R2/R4 档案冲突治本）服务单测：
 * mock rawConnection.getRepository(实体名)（服务经实体名取 repo，避免对 cjk-plugin 构建期依赖）。
 */
function makeEnv(opts) {
    var _a, _b;
    const channelRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(opts.channel === undefined ? { id: 113, code: 'canteen-a' } : opts.channel) };
    const methodSaves = [];
    const methodRepo = {
        find: vitest_1.vi.fn().mockResolvedValue((_a = opts.methods) !== null && _a !== void 0 ? _a : []),
        save: vitest_1.vi.fn(async (m) => { methodSaves.push(m); return m; }),
    };
    const profileSaves = [];
    const clearDefaults = vitest_1.vi.fn().mockResolvedValue({});
    const profileRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.existingDefault) !== null && _b !== void 0 ? _b : null),
        save: vitest_1.vi.fn(async (p) => { profileSaves.push(p); return p; }),
        createQueryBuilder: vitest_1.vi.fn(() => {
            const qb = {};
            qb.update = () => qb;
            qb.set = () => qb;
            qb.where = () => qb;
            qb.execute = clearDefaults;
            return qb;
        }),
    };
    const rawUpdates = [];
    const variantRepo = {
        createQueryBuilder: () => {
            var _a;
            const qb = {};
            qb.select = () => qb;
            qb.innerJoin = () => qb;
            qb.where = () => qb;
            qb.getRawMany = vitest_1.vi.fn().mockResolvedValue(((_a = opts.unboundVariantIds) !== null && _a !== void 0 ? _a : []).map(id => ({ id })));
            return qb;
        },
        manager: { query: vitest_1.vi.fn(async (sql, params) => { rawUpdates.push({ sql, params }); return {}; }) },
    };
    const rawConnection = {
        getRepository: (name) => name === 'Channel' ? channelRepo
            : name === 'ShippingMethod' ? methodRepo
                : name === 'ShippingProfile' ? profileRepo
                    : variantRepo,
    };
    const svc = new shipping_profile_ensure_service_1.ShippingProfileEnsureService({ rawConnection });
    return { svc, methodSaves, profileSaves, rawUpdates, clearDefaults, methodRepo, profileRepo, channelRepo };
}
// 工厂函数（勿用共享常量：服务会原地 mutate methods.channels，污染后续用例）
const STORE_PICKUP = () => ({ id: 1, code: 'store-pickup', channels: [{ id: 113 }] });
const COURIER = () => ({ id: 9, code: 'courier-delivery', channels: [] });
(0, vitest_1.describe)('ShippingProfileEnsureService.ensureDefaultShippingProfile', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('渠道不存在 → 抛错', async () => {
        const { svc, channelRepo } = makeEnv({ channel: null });
        await (0, vitest_1.expect)(svc.ensureDefaultShippingProfile({}, 999)).rejects.toThrow('渠道不存在');
        (0, vitest_1.expect)(channelRepo.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
    });
    (0, vitest_1.it)('两个预期方式都缺失 → 抛错', async () => {
        const { svc } = makeEnv({ methods: [{ id: 5, code: 'flat-rate', channels: [] }] });
        await (0, vitest_1.expect)(svc.ensureDefaultShippingProfile({}, 113)).rejects.toThrow('未找到任何预期配送方式');
    });
    (0, vitest_1.it)('无租户默认档案 → 新建（含两方式、置默认、清旧标记）并补绑未绑变体', async () => {
        const { svc, profileSaves, clearDefaults, rawUpdates } = makeEnv({
            methods: [STORE_PICKUP(), COURIER()],
            unboundVariantIds: [87, 88],
        });
        const r = await svc.ensureDefaultShippingProfile({}, 113);
        (0, vitest_1.expect)(clearDefaults).toHaveBeenCalled();
        (0, vitest_1.expect)(profileSaves).toHaveLength(1);
        const p = profileSaves[0];
        (0, vitest_1.expect)(p.name).toBe('拾光达默认配送档案');
        (0, vitest_1.expect)(p.isTenantDefault).toBe(true);
        (0, vitest_1.expect)(p.isGlobal).toBe(false);
        (0, vitest_1.expect)(p.ownerChannelId).toBe(113);
        (0, vitest_1.expect)(p.shippingMethods.map((m) => m.id).sort()).toEqual([1, 9]);
        (0, vitest_1.expect)(r.profileId).toBe(String(p.id));
        (0, vitest_1.expect)(r.linkedMethodCodes.sort()).toEqual(['courier-delivery', 'store-pickup']);
        (0, vitest_1.expect)(r.missingMethodCodes).toEqual([]);
        (0, vitest_1.expect)(r.boundVariantCount).toBe(2);
        (0, vitest_1.expect)(rawUpdates).toHaveLength(1);
        (0, vitest_1.expect)(rawUpdates[0].params).toEqual([String(p.id), 87, 88]);
    });
    (0, vitest_1.it)('已有租户默认档案 → union 补缺失方式，不重复添加、不新建', async () => {
        const existing = { id: '1', name: '旧默认档案', enabled: true, shippingMethods: [{ id: 1 }] };
        const { svc, profileSaves, clearDefaults } = makeEnv({
            methods: [STORE_PICKUP(), COURIER()],
            existingDefault: existing,
        });
        const r = await svc.ensureDefaultShippingProfile({}, 113);
        (0, vitest_1.expect)(clearDefaults).not.toHaveBeenCalled();
        (0, vitest_1.expect)(profileSaves).toHaveLength(1);
        (0, vitest_1.expect)(profileSaves[0].shippingMethods.map((m) => m.id).sort()).toEqual([1, 9]);
        (0, vitest_1.expect)(r.profileId).toBe('1');
        (0, vitest_1.expect)(r.profileName).toBe('旧默认档案');
        (0, vitest_1.expect)(r.boundVariantCount).toBe(0);
    });
    (0, vitest_1.it)('方式未绑渠道 → 幂等补绑；已绑渠道 → 不重复 save', async () => {
        const { svc, methodSaves } = makeEnv({ methods: [STORE_PICKUP(), COURIER()] });
        await svc.ensureDefaultShippingProfile({}, 113);
        // store-pickup 已在渠道 113 → 不 save；courier-delivery 未绑 → save 补绑
        (0, vitest_1.expect)(methodSaves).toHaveLength(1);
        (0, vitest_1.expect)(methodSaves[0].code).toBe('courier-delivery');
        (0, vitest_1.expect)(methodSaves[0].channels.map((c) => Number(c.id))).toContain(113);
    });
    (0, vitest_1.it)('缺失方式进 missingMethodCodes，档案仍含找到的方式', async () => {
        const { svc, profileSaves } = makeEnv({ methods: [STORE_PICKUP()] });
        const r = await svc.ensureDefaultShippingProfile({}, 113);
        (0, vitest_1.expect)(r.missingMethodCodes).toEqual(['courier-delivery']);
        (0, vitest_1.expect)(r.linkedMethodCodes).toEqual(['store-pickup']);
        (0, vitest_1.expect)(profileSaves[0].shippingMethods.map((m) => m.id)).toEqual([1]);
    });
    (0, vitest_1.it)('无未绑变体 → boundVariantCount=0 且不执行 UPDATE', async () => {
        const { svc, rawUpdates } = makeEnv({ methods: [STORE_PICKUP(), COURIER()], unboundVariantIds: [] });
        const r = await svc.ensureDefaultShippingProfile({}, 113);
        (0, vitest_1.expect)(r.boundVariantCount).toBe(0);
        (0, vitest_1.expect)(rawUpdates).toHaveLength(0);
    });
});
//# sourceMappingURL=shipping-profile-ensure.service.spec.js.map