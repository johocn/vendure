"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cityServes = cityServes;
exports.pinByCity = pinByCity;
/** 仓库 serviceCities 是否服务目标城市：未配置或空数组视为全城可服务；
 *  匹配含精确、包含、前后缀（与 inventory-plugin locationServesCity 同语义）。 */
function cityServes(serviceCities, city) {
    if (!Array.isArray(serviceCities) || serviceCities.length === 0) {
        return true;
    }
    const target = city.trim().toLowerCase();
    return serviceCities.some(s => {
        if (typeof s !== 'string')
            return false;
        const c = s.trim().toLowerCase();
        return c === target || c.startsWith(target) || target.startsWith(c);
    });
}
/** 按城市聚合绑定物理仓可售：city 为空 → 全部绑定仓合计；否则仅过滤可服务仓。
 *  无任何可服务仓返回空 servedLocations + onHand=0（由调用方决定回退虚拟仓）。 */
function pinByCity(levels, bindings, cities, city) {
    const boundIds = bindings.map(b => b.locationId);
    const onHand = (locId) => { var _a, _b; return (_b = (_a = levels.find(l => String(l.stockLocationId) === String(locId))) === null || _a === void 0 ? void 0 : _a.stockOnHand) !== null && _b !== void 0 ? _b : 0; };
    if (!city) {
        return {
            servedLocations: boundIds,
            servedOnHand: boundIds.reduce((s, id) => s + onHand(id), 0),
        };
    }
    const served = boundIds.filter(id => cityServes(cities.get(String(id)), city));
    if (!served.length) {
        return { servedLocations: served, servedOnHand: 0 };
    }
    return { servedLocations: served, servedOnHand: served.reduce((s, id) => s + onHand(id), 0) };
}
//# sourceMappingURL=stock-city-filter.js.map