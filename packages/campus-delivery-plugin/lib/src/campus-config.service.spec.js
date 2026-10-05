"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 纯逻辑单测：默认配置兜底
const vitest_1 = require("vitest");
const campus_config_service_1 = require("./campus-config.service");
(0, vitest_1.describe)('CampusConfigService.getConfig', () => {
    (0, vitest_1.it)('无配置时创建默认配置', async () => {
        const findOne = vitest_1.vi.fn().mockResolvedValue(null);
        const save = vitest_1.vi.fn().mockImplementation(v => Promise.resolve(v));
        const svc = new campus_config_service_1.CampusConfigService({ getRepository: () => ({ findOne, save }) }, {});
        const ctx = { channelId: 1 };
        const cfg = await svc.getConfig(ctx);
        (0, vitest_1.expect)(save).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(cfg.riderCommissionRate).toBe(100);
        (0, vitest_1.expect)(cfg.autoAssignMinutes).toBe(10);
        (0, vitest_1.expect)(cfg.paused).toBe(false);
    });
});
(0, vitest_1.describe)('CampusConfigService slots', () => {
    const mkRepo = (slots) => ({
        find: vitest_1.vi.fn().mockResolvedValue(slots),
        findOne: vitest_1.vi.fn(),
        save: vitest_1.vi.fn().mockImplementation(v => Promise.resolve(Object.assign({ id: 1 }, v))),
        createQueryBuilder: vitest_1.vi.fn(),
    });
    (0, vitest_1.it)('slotsForShop 只返回 active 且余量>0', async () => {
        const repo = mkRepo([
            { id: 1, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 20 },
            { id: 2, slotDate: '2099-01-01', active: true, capacity: 20, lockedCount: 5 },
            { id: 3, slotDate: '2099-01-01', active: false, capacity: 20, lockedCount: 0 },
        ]);
        const svc = new campus_config_service_1.CampusConfigService({ getRepository: () => repo }, {});
        const out = await svc.slotsForShop({ channelId: 1 });
        (0, vitest_1.expect)(out.map((s) => s.id)).toEqual([2]);
        (0, vitest_1.expect)(out[0].remaining).toBe(15);
    });
    (0, vitest_1.it)('createSlot 落 channelId', async () => {
        const repo = mkRepo([]);
        const svc = new campus_config_service_1.CampusConfigService({ getRepository: () => repo }, {});
        await svc.createSlot({ channelId: 7 }, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', capacity: 30 });
        (0, vitest_1.expect)(repo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ channelId: 7, capacity: 30 }));
    });
});
(0, vitest_1.describe)('setDeliveryTarget route/slot 扩展', () => {
    const slot = {
        id: 5, channelId: 1, active: true, capacity: 20, lockedCount: 3,
        slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30',
    };
    const ctx = { channelId: 1, session: { activeOrderId: 100 } };
    function makeEnv(opts = {}) {
        const zoneRepo = { findOne: vitest_1.vi.fn().mockResolvedValue({ id: 1, name: '东区' }) };
        const buildingRepo = { findOne: vitest_1.vi.fn().mockResolvedValue({ id: 7, name: '1号楼' }) };
        const slotRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(opts.slot === undefined ? slot : opts.slot) };
        const repos = {
            CampusZone: zoneRepo,
            CampusBuilding: buildingRepo,
            DeliverySlot: slotRepo,
        };
        const dataSource = { getRepository: vitest_1.vi.fn((ent) => { var _a; return repos[(_a = ent.name) !== null && _a !== void 0 ? _a : String(ent)]; }) };
        const orderService = { updateCustomFields: vitest_1.vi.fn().mockResolvedValue({ id: 100 }) };
        const svc = new campus_config_service_1.CampusConfigService(dataSource, orderService);
        return { svc, orderService, slotRepo };
    }
    (0, vitest_1.it)('传 route+slotId 时写全 fulfillmentRoute/deliverySlotId/deliverySlotText', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7, 'R3', 5);
        (0, vitest_1.expect)(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
            fulfillmentRoute: 'R3',
            deliverySlotId: '5',
            deliverySlotText: '2026-10-06 11:00-11:30',
        });
    });
    (0, vitest_1.it)('slot 余量为 0 抛 UserInputError("该时段已满")', async () => {
        const env = makeEnv({ slot: Object.assign(Object.assign({}, slot), { lockedCount: 20 }) });
        await (0, vitest_1.expect)(env.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('该时段已满');
    });
    (0, vitest_1.it)('slot 跨渠道/不存在/未激活 抛 UserInputError("时段不可用")', async () => {
        const a = makeEnv({ slot: Object.assign(Object.assign({}, slot), { channelId: 2 }) });
        await (0, vitest_1.expect)(a.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const b = makeEnv({ slot: null });
        await (0, vitest_1.expect)(b.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
        const c = makeEnv({ slot: Object.assign(Object.assign({}, slot), { active: false }) });
        await (0, vitest_1.expect)(c.svc.setDeliveryTarget(ctx, 1, 7, 'R1', 5)).rejects.toThrow('时段不可用');
    });
    (0, vitest_1.it)('非法 route 抛 UserInputError（仅允许 R1/R3）', async () => {
        const env = makeEnv();
        await (0, vitest_1.expect)(env.svc.setDeliveryTarget(ctx, 1, 7, 'R2')).rejects.toThrow('配送路线不合法');
    });
    (0, vitest_1.it)('不传 route/slot 时行为与旧版完全一致（只写 buildingId/campusZone）', async () => {
        const env = makeEnv();
        await env.svc.setDeliveryTarget(ctx, 1, 7);
        (0, vitest_1.expect)(env.orderService.updateCustomFields).toHaveBeenCalledWith(ctx, 100, {
            buildingId: '7',
            campusZone: '东区',
        });
    });
});
//# sourceMappingURL=campus-config.service.spec.js.map