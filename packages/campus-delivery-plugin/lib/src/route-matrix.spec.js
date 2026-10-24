"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const route_matrix_1 = require("./route-matrix");
const handoverPoints = {
    R1: { name: '东门岗亭', address: '东门内 50 米', lat: 30.1, lng: 120.2 },
    R2: { name: '菜鸟驿站', address: '二食堂北侧', lat: 30.2, lng: 120.25 },
};
const base = {
    handoverPoints,
    storeAddress: '一食堂 3 号档口',
    storePhone: '021-0000',
    storeLat: 30.0,
    storeLng: 120.0,
};
const user = { name: '学生', address: '三号楼 502', lat: 30.3, lng: 120.3 };
(0, vitest_1.describe)('route-matrix', () => {
    (0, vitest_1.it)('R1 默认商户送第一段，第二段恒接力（交接点=校园点）', () => {
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R1', Object.assign({}, base))).toEqual({
            route: 'R1',
            leg1: 'merchant',
            leg2: 'campus_rider',
            handover: 'to_campus_rider',
            externalProvider: null,
            dispatch: 'merchant_pool',
        });
    });
    (0, vitest_1.it)('R1 改为自营快递后仍是两段接力', () => {
        const cfg = Object.assign(Object.assign({}, base), { routeFirstLeg: { R1: 'owned' } });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R1', cfg)).toMatchObject({
            leg1: 'owned',
            leg2: 'campus_rider',
            handover: 'to_campus_rider',
            externalProvider: null,
        });
        (0, vitest_1.expect)((0, route_matrix_1.resolveDropoff)('R1', (0, route_matrix_1.resolveRoutePlan)('R1', cfg), cfg, user)).toMatchObject({ name: '东门岗亭' });
    });
    (0, vitest_1.it)('R1 不接受外部快递（配置归一为 null，回默认商户）', () => {
        (0, vitest_1.expect)((0, route_matrix_1.normalizeRouteFirstLeg)('R1', 'external')).toBeNull();
        const cfg = Object.assign(Object.assign({}, base), { routeFirstLeg: { R1: 'external' } });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R1', cfg)).toMatchObject({ leg1: 'merchant' });
    });
    (0, vitest_1.it)('R2 固定外部快递 + 传信者接力；provider 由派单时传入', () => {
        const plan = (0, route_matrix_1.resolveRoutePlan)('R2', Object.assign({}, base), 'dada');
        (0, vitest_1.expect)(plan).toMatchObject({
            leg1: 'external_courier',
            leg2: 'campus_rider',
            handover: 'to_campus_rider',
            externalProvider: 'dada',
            dispatch: 'external_push',
        });
        (0, vitest_1.expect)((0, route_matrix_1.resolveDropoff)('R2', plan, base, user)).toMatchObject({ name: '菜鸟驿站', lat: 30.2 });
    });
    (0, vitest_1.it)('R2 未配置交接点 → dropoff 返回 null（不得用 0,0 派单）', () => {
        const cfg = Object.assign(Object.assign({}, base), { handoverPoints: { R1: handoverPoints.R1 } });
        const plan = (0, route_matrix_1.resolveRoutePlan)('R2', cfg);
        (0, vitest_1.expect)((0, route_matrix_1.resolveHandoverPoint)('R2', cfg)).toBeNull();
        (0, vitest_1.expect)((0, route_matrix_1.resolveDropoff)('R2', plan, cfg, user)).toBeNull();
    });
    (0, vitest_1.it)('多交接点：按收货楼栋坐标取最近', () => {
        var _a, _b;
        const multi = Object.assign(Object.assign({}, base), { handoverPoints: {
                R1: [
                    { name: '东门岗亭', lat: 30.10, lng: 120.20, isDefault: true },
                    { name: '西门驿站', lat: 30.30, lng: 120.31 },
                ],
            } });
        (0, vitest_1.expect)((_a = (0, route_matrix_1.resolveHandoverPoint)('R1', multi, { lat: 30.31, lng: 120.32 })) === null || _a === void 0 ? void 0 : _a.name).toBe('西门驿站');
        (0, vitest_1.expect)((_b = (0, route_matrix_1.resolveHandoverPoint)('R1', multi, { lat: 30.11, lng: 120.21 })) === null || _b === void 0 ? void 0 : _b.name).toBe('东门岗亭');
    });
    (0, vitest_1.it)('多交接点：无收货坐标用默认点；未标默认则用第一个', () => {
        var _a, _b;
        const multi = Object.assign(Object.assign({}, base), { handoverPoints: {
                R2: [
                    { name: '菜鸟驿站', lat: 30.2, lng: 120.25 },
                    { name: '体育馆驿站', lat: 30.4, lng: 120.4, isDefault: true },
                ],
            } });
        (0, vitest_1.expect)((_a = (0, route_matrix_1.resolveHandoverPoint)('R2', multi)) === null || _a === void 0 ? void 0 : _a.name).toBe('体育馆驿站');
        const noDefault = Object.assign(Object.assign({}, base), { handoverPoints: { R2: [{ name: '菜鸟驿站', lat: 30.2, lng: 120.25 }] } });
        (0, vitest_1.expect)((_b = (0, route_matrix_1.resolveHandoverPoint)('R2', noDefault)) === null || _b === void 0 ? void 0 : _b.name).toBe('菜鸟驿站');
    });
    (0, vitest_1.it)('R3 默认传信者直送，不接力', () => {
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R3', Object.assign({}, base))).toEqual({
            route: 'R3',
            leg1: 'campus_rider',
            leg2: 'none',
            handover: null,
            externalProvider: null,
            dispatch: 'hall_grab',
        });
    });
    (0, vitest_1.it)('R3 自营快递整段直送', () => {
        const cfg = Object.assign(Object.assign({}, base), { routeFirstLeg: { R3: 'owned' } });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R3', cfg)).toMatchObject({
            leg1: 'owned',
            leg2: 'none',
            handover: null,
            externalProvider: null,
            dispatch: 'hall_grab',
        });
    });
    (0, vitest_1.it)('R3 外部快递整段直送（provider 派单时确定）', () => {
        const cfg = Object.assign(Object.assign({}, base), { routeFirstLeg: { R3: 'external' } });
        const plan = (0, route_matrix_1.resolveRoutePlan)('R3', cfg, 'meituan');
        (0, vitest_1.expect)(plan).toMatchObject({
            leg1: 'external_courier',
            leg2: 'none',
            handover: 'direct_to_user',
            externalProvider: 'meituan',
            dispatch: 'hall_grab',
        });
        (0, vitest_1.expect)((0, route_matrix_1.resolveDropoff)('R3', plan, cfg, user)).toEqual(user);
    });
    (0, vitest_1.it)('R4 到店自取、R5 跑腿，均无第二段', () => {
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R4', base)).toMatchObject({
            leg1: 'self_pickup',
            leg2: 'none',
            handover: null,
            dispatch: 'pickup',
        });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R5', base)).toMatchObject({
            leg1: 'campus_rider',
            leg2: 'none',
            handover: null,
            dispatch: 'errand',
        });
    });
    (0, vitest_1.it)('R2/R4/R5 不接受承运配置（配了也按固定链路处理）', () => {
        const cfg = Object.assign(Object.assign({}, base), { routeFirstLeg: { R2: 'owned', R4: 'merchant', R5: 'owned' } });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R2', cfg)).toMatchObject({ leg1: 'external_courier' });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R4', cfg)).toMatchObject({ leg1: 'self_pickup' });
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R5', cfg)).toMatchObject({ leg1: 'campus_rider' });
    });
    (0, vitest_1.it)('取货点缺经纬度返回 null；非法值归一为 null；非法路线返回 null', () => {
        (0, vitest_1.expect)((0, route_matrix_1.resolvePickup)('R3', Object.assign(Object.assign({}, base), { storeLat: null, storeLng: null }))).toBeNull();
        (0, vitest_1.expect)((0, route_matrix_1.normalizeRouteFirstLeg)('R3', 'merchant')).toBeNull();
        (0, vitest_1.expect)((0, route_matrix_1.normalizeRouteFirstLeg)('R2', 'dada')).toBeNull();
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R6', base)).toBeNull();
        (0, vitest_1.expect)((0, route_matrix_1.resolveRoutePlan)('R9', base)).toBeNull();
    });
});
//# sourceMappingURL=route-matrix.spec.js.map