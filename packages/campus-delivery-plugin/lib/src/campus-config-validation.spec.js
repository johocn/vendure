"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const campus_config_service_1 = require("./campus-config.service");
function makeDs(opts = {}) {
    var _a;
    const zoneRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_a = opts.zone) !== null && _a !== void 0 ? _a : null) };
    const buildingRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue(null),
        save: vitest_1.vi.fn().mockImplementation(async (v) => v),
    };
    const slotRepo = {
        findOne: vitest_1.vi.fn().mockImplementation(async (q) => { var _a, _b, _c; return ('id' in ((_a = q === null || q === void 0 ? void 0 : q.where) !== null && _a !== void 0 ? _a : {}) ? (_b = opts.slot) !== null && _b !== void 0 ? _b : null : (_c = opts.dup) !== null && _c !== void 0 ? _c : null); }),
        save: vitest_1.vi.fn().mockImplementation(async (v) => v),
    };
    const dataSource = {
        getRepository: (ent) => {
            var _a;
            const name = (_a = ent === null || ent === void 0 ? void 0 : ent.name) !== null && _a !== void 0 ? _a : String(ent);
            if (name === 'CampusZone')
                return zoneRepo;
            if (name === 'CampusBuilding')
                return buildingRepo;
            return slotRepo;
        },
    };
    const svc = new campus_config_service_1.CampusConfigService(dataSource, {});
    return { svc, zoneRepo, buildingRepo, slotRepo };
}
const ctx = { channelId: 1 };
(0, vitest_1.describe)('CampusConfigService 入参校验', () => {
    (0, vitest_1.it)('createZone 拒绝空名称/负运费', async () => {
        const { svc } = makeDs();
        await (0, vitest_1.expect)(svc.createZone(ctx, '  ', 100)).rejects.toThrow('分区名称不能为空');
        await (0, vitest_1.expect)(svc.createZone(ctx, '东区', -1)).rejects.toThrow('非负整数');
        await (0, vitest_1.expect)(svc.createZone(ctx, '东区', 1.5)).rejects.toThrow('非负整数');
    });
    (0, vitest_1.it)('createBuilding 拒绝空名称与跨店分区', async () => {
        const { svc } = makeDs({ zone: null });
        await (0, vitest_1.expect)(svc.createBuilding(ctx, '', 1)).rejects.toThrow('楼栋名称不能为空');
        await (0, vitest_1.expect)(svc.createBuilding(ctx, '1号楼', 1)).rejects.toThrow('分区不存在或不属于当前店铺');
    });
    (0, vitest_1.it)('createBuilding 经纬度越界拒绝', async () => {
        const { svc } = makeDs({ zone: { id: 1 } });
        await (0, vitest_1.expect)(svc.createBuilding(ctx, '1号楼', 1, undefined, 91, 120)).rejects.toThrow('纬度必须在');
        await (0, vitest_1.expect)(svc.createBuilding(ctx, '1号楼', 1, undefined, 30, 181)).rejects.toThrow('经度必须在');
    });
    (0, vitest_1.it)('createSlot 拒绝非法日期/时刻/容量/起止顺序', async () => {
        const { svc } = makeDs();
        await (0, vitest_1.expect)(svc.createSlot(ctx, { slotDate: '2026/10/06', startTime: '11:00', endTime: '11:30' }))
            .rejects.toThrow('YYYY-MM-DD');
        await (0, vitest_1.expect)(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '25:00', endTime: '11:30' }))
            .rejects.toThrow('HH:mm');
        await (0, vitest_1.expect)(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '12:00', endTime: '11:30' }))
            .rejects.toThrow('开始时间必须早于结束时间');
        await (0, vitest_1.expect)(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', capacity: 0 }))
            .rejects.toThrow('1-9999');
    });
    (0, vitest_1.it)('createSlot 拒绝同店铺同分区重复时段', async () => {
        const { svc } = makeDs({ dup: { id: 9 } });
        await (0, vitest_1.expect)(svc.createSlot(ctx, { slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30' }))
            .rejects.toThrow('同一时段已存在');
    });
    (0, vitest_1.it)('createSlot 分区必须属于当前店铺', async () => {
        const { svc } = makeDs({ zone: null });
        await (0, vitest_1.expect)(svc.createSlot(ctx, {
            slotDate: '2026-10-06', startTime: '11:00', endTime: '11:30', zoneId: 3,
        })).rejects.toThrow('分区不存在或不属于当前店铺');
    });
    (0, vitest_1.it)('updateSlot 拒绝非法容量与起止倒置', async () => {
        const slot = { id: 5, channelId: 1, startTime: '11:00', endTime: '11:30', capacity: 20 };
        const { svc } = makeDs({ slot });
        await (0, vitest_1.expect)(svc.updateSlot(ctx, 5, { capacity: -1 })).rejects.toThrow('1-9999');
        await (0, vitest_1.expect)(svc.updateSlot(ctx, 5, { startTime: '12:00' })).rejects.toThrow('开始时间必须早于结束时间');
    });
});
//# sourceMappingURL=campus-config-validation.spec.js.map