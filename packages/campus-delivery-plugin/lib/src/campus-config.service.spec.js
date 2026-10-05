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
//# sourceMappingURL=campus-config.service.spec.js.map