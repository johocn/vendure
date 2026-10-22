"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTE_FIRST_LEG_DEFAULTS = exports.ROUTE_FIRST_LEG_OPTIONS = exports.CAMPUS_ROUTES = void 0;
exports.normalizeRouteFirstLeg = normalizeRouteFirstLeg;
exports.resolveRoutePlan = resolveRoutePlan;
exports.resolvePickup = resolvePickup;
exports.resolveHandoverPoint = resolveHandoverPoint;
exports.resolveDropoff = resolveDropoff;
/**
 * 外卖履约矩阵（唯一事实来源）：R1–R5 × 店铺「按路线第一段承运」配置 → RoutePlan
 *
 * 结构由路线决定，承运由配置决定：
 * - R1 商户/自营快递→校园交接点，传信者接力上楼（接力固定）
 * - R2 外部快递→校园交接点，传信者接力（接力固定，承运固定）
 * - R3 传信者/自营快递/外部快递到档口取餐直送（一段到底）
 * - R4 到店自取
 * - R5 校园跑腿
 *
 * R6 已取消，不在此矩阵内。
 */
exports.CAMPUS_ROUTES = ['R1', 'R2', 'R3', 'R4', 'R5'];
/** 各路线允许的第一段承运方 */
exports.ROUTE_FIRST_LEG_OPTIONS = {
    R1: ['merchant', 'owned'],
    R2: ['external'], // 固定，不在配置项里出现
    R3: ['campus', 'owned', 'external'],
    R4: ['self_pickup'], // 固定到店自取
    R5: ['campus'],
};
/** 默认第一段：R1 商户，R3 传信者 */
exports.ROUTE_FIRST_LEG_DEFAULTS = {
    R1: 'merchant',
    R3: 'campus',
};
/** 校验并归一某条路线的第一段承运方；不合法返回 null */
function normalizeRouteFirstLeg(route, value) {
    if (!exports.CAMPUS_ROUTES.includes(route))
        return null;
    const options = exports.ROUTE_FIRST_LEG_OPTIONS[route];
    const v = String(value !== null && value !== void 0 ? value : '').trim();
    return options.includes(v) ? v : null;
}
function resolveRoutePlan(route, cfg, externalProvider) {
    var _a, _b;
    if (!exports.CAMPUS_ROUTES.includes(route))
        return null;
    const r = route;
    const configured = normalizeRouteFirstLeg(r, (_a = cfg.routeFirstLeg) === null || _a === void 0 ? void 0 : _a[r]);
    const first = (_b = configured !== null && configured !== void 0 ? configured : exports.ROUTE_FIRST_LEG_DEFAULTS[r]) !== null && _b !== void 0 ? _b : null;
    switch (r) {
        case 'R1':
            // 接力固定：第一段商户或自营快递，第二段恒为传信者
            return {
                route: r,
                leg1: first === 'owned' ? 'owned' : 'merchant',
                leg2: 'campus_rider',
                handover: 'to_campus_rider',
                externalProvider: null,
                dispatch: 'merchant_pool',
            };
        case 'R2':
            return {
                route: r,
                leg1: 'external_courier',
                leg2: 'campus_rider',
                handover: 'to_campus_rider',
                externalProvider: externalProvider !== null && externalProvider !== void 0 ? externalProvider : null,
                dispatch: 'external_push',
            };
        case 'R3': {
            const leg1 = first === 'owned' ? 'owned' : first === 'external' ? 'external_courier' : 'campus_rider';
            return {
                route: r,
                leg1,
                leg2: 'none',
                handover: leg1 === 'external_courier' ? 'direct_to_user' : null,
                externalProvider: leg1 === 'external_courier' ? (externalProvider !== null && externalProvider !== void 0 ? externalProvider : null) : null,
                dispatch: 'hall_grab',
            };
        }
        case 'R4':
            return {
                route: r,
                leg1: 'self_pickup',
                leg2: 'none',
                handover: null,
                externalProvider: null,
                dispatch: 'pickup',
            };
        case 'R5':
            return {
                route: r,
                leg1: 'campus_rider',
                leg2: 'none',
                handover: null,
                externalProvider: null,
                dispatch: 'errand',
            };
        default:
            return null;
    }
}
/** 取货点：店铺经纬度（档口/门店）；缺坐标返回 null，禁止用 (0,0) 派单 */
function resolvePickup(_route, cfg) {
    var _a, _b;
    if (cfg.storeLat == null || cfg.storeLng == null)
        return null;
    return {
        name: cfg.storeAddress || '商家门店',
        address: (_a = cfg.storeAddress) !== null && _a !== void 0 ? _a : undefined,
        lat: Number(cfg.storeLat),
        lng: Number(cfg.storeLng),
        phone: (_b = cfg.storePhone) !== null && _b !== void 0 ? _b : undefined,
    };
}
/** 该路线配置的交接点（未配置返回 null，由调用方报「未配置交接点」） */
function resolveHandoverPoint(route, cfg) {
    var _a, _b, _c;
    const p = (_a = cfg.handoverPoints) === null || _a === void 0 ? void 0 : _a[route];
    if (!p || !p.name || p.lat == null || p.lng == null)
        return null;
    return {
        name: p.name,
        address: (_b = p.address) !== null && _b !== void 0 ? _b : undefined,
        phone: (_c = p.phone) !== null && _c !== void 0 ? _c : undefined,
        lat: Number(p.lat),
        lng: Number(p.lng),
    };
}
/** 外部快递的收货点：R1/R2 打本路线交接点；R3 直送打用户地址；R4 无配送 */
function resolveDropoff(route, plan, cfg, userPoint) {
    if (route === 'R1' || route === 'R2')
        return resolveHandoverPoint(route, cfg);
    if (route === 'R4')
        return null;
    return userPoint;
}
//# sourceMappingURL=route-matrix.js.map