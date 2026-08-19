"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerCtx = void 0;
exports.rankByNearest = rankByNearest;
exports.rankByPriority = rankByPriority;
exports.rankByStockFirst = rankByStockFirst;
exports.rankByMemberRule = rankByMemberRule;
exports.parsePriorityConfig = parsePriorityConfig;
exports.parseMemberRules = parseMemberRules;
const core_1 = require("@vendure/core");
const location_utils_1 = require("./location-utils");
exports.loggerCtx = 'MatrixStockLocationStrategy';
/** 按距离升序 */
function rankByNearest(locations, anchor) {
    if (anchor.lat == null || anchor.lng == null) {
        return locations;
    }
    return [...locations].sort((a, b) => distKm(a, anchor) - distKm(b, anchor));
}
/** 按 stockLocationPriority JSON priority 升序 */
function rankByPriority(locations, priorityConfig) {
    return [...locations].sort((a, b) => {
        var _a, _b, _c, _d;
        const pa = (_b = (_a = priorityConfig.find(p => String(p.locationId) === String(a.id))) === null || _a === void 0 ? void 0 : _a.priority) !== null && _b !== void 0 ? _b : 999;
        const pb = (_d = (_c = priorityConfig.find(p => String(p.locationId) === String(b.id))) === null || _c === void 0 ? void 0 : _c.priority) !== null && _d !== void 0 ? _d : 999;
        return pa - pb;
    });
}
/** 按库存 onHand 降序 */
function rankByStockFirst(locations, stockOnHandMap) {
    return [...locations].sort((a, b) => { var _a, _b; return ((_a = stockOnHandMap.get(String(b.id))) !== null && _a !== void 0 ? _a : 0) - ((_b = stockOnHandMap.get(String(a.id))) !== null && _b !== void 0 ? _b : 0); });
}
/** 会员专属：命中仓按 locationIds 顺序前置，其余按 fallback 规则排序 */
function rankByMemberRule(locations, rule, priorityConfig, stockOnHandMap, anchor) {
    const hit = rule.locationIds
        .map(id => locations.find(l => String(l.id) === String(id)))
        .filter((l) => !!l);
    const rest = locations.filter(l => !hit.includes(l));
    let rankedRest;
    switch (rule.fallback) {
        case 'priority':
            rankedRest = rankByPriority(rest, priorityConfig);
            break;
        case 'stock-first':
            rankedRest = rankByStockFirst(rest, stockOnHandMap);
            break;
        default:
            rankedRest = rankByNearest(rest, anchor);
    }
    return [...hit, ...rankedRest];
}
function distKm(loc, anchor) {
    var _a;
    const cf = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
    const lat = cf.lat != null ? Number(cf.lat) : NaN;
    const lng = cf.lng != null ? Number(cf.lng) : NaN;
    if (!isFinite(lat) || !isFinite(lng)) {
        return Number.MAX_SAFE_INTEGER;
    }
    return (0, location_utils_1.distanceKm)({ lat, lng }, { lat: anchor.lat, lng: anchor.lng });
}
/** 解析 channel 级 stockLocationPriority JSON，容错返回 [] */
function parsePriorityConfig(raw) {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw !== null && raw !== void 0 ? raw : '[]'));
        return Array.isArray(arr) ? arr : [];
    }
    catch (_a) {
        core_1.Logger.warn('stockLocationPriority JSON 解析失败，按空配置处理', exports.loggerCtx);
        return [];
    }
}
/** 解析 channel 级 memberStockStrategy JSON，容错返回 [] */
function parseMemberRules(raw) {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw !== null && raw !== void 0 ? raw : '[]'));
        return Array.isArray(arr) ? arr : [];
    }
    catch (_a) {
        core_1.Logger.warn('memberStockStrategy JSON 解析失败，按空配置处理', exports.loggerCtx);
        return [];
    }
}
//# sourceMappingURL=matrix-allocators.js.map