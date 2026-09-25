"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_BIN_PATH_INDEX = void 0;
exports.canTransition = canTransition;
exports.formatBatchCode = formatBatchCode;
exports.nextSequence = nextSequence;
exports.pickRecommendation = pickRecommendation;
exports.sortPickingRows = sortPickingRows;
const mirror_math_1 = require("../inventory/mirror-math");
/** 无库位绑定的行排在最后 */
exports.NO_BIN_PATH_INDEX = 9999;
const TRANSITIONS = {
    PENDING: ['PICKED', 'CANCELLED'],
    PICKED: ['PRINTED', 'CANCELLED'],
    PRINTED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['HANDOVER', 'EXCEPTION'],
    // 异常件处理完回交接（不回到 SHIPPED，避免重复发货语义）
    EXCEPTION: ['HANDOVER'],
    HANDOVER: ['REVIEWED', 'EXCEPTION'],
    REVIEWED: [],
    CANCELLED: [],
};
function canTransition(from, to) {
    var _a, _b;
    return (_b = (_a = TRANSITIONS[from]) === null || _a === void 0 ? void 0 : _a.includes(to)) !== null && _b !== void 0 ? _b : false;
}
/** PB + yyyyMMdd + 3 位当日序号 */
function formatBatchCode(date, seq) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `PB${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}
/** 当日已存在批次数量 → 下一个序号 */
function nextSequence(existingCount) {
    return existingCount + 1;
}
/**
 * 就近选仓。优先级见规格 §7：
 * 1. 有坐标 → 城市命中且距离最小
 * 2. 无坐标但城市文本命中 → 命中第一个
 * 3. 都不命中 → null（不伪造距离）
 */
function pickRecommendation(order, warehouses) {
    const enabled = warehouses.filter((w) => w.enabled);
    const cityHit = order.city
        ? enabled.filter((w) => { var _a; return ((_a = w.serviceCities) !== null && _a !== void 0 ? _a : []).includes(order.city); })
        : [];
    // 全仓文本命中（订单无 city 时作为兜底池）
    const pool = cityHit.length > 0 ? cityHit : enabled;
    const hasOrderGeo = typeof order.lat === 'number' && typeof order.lng === 'number';
    const withGeo = pool.filter((w) => typeof w.lat === 'number' && typeof w.lng === 'number');
    if (hasOrderGeo && withGeo.length > 0) {
        let best = withGeo[0];
        let bestKm = (0, mirror_math_1.haversineKm)(order.lat, order.lng, best.lat, best.lng);
        for (const w of withGeo.slice(1)) {
            const km = (0, mirror_math_1.haversineKm)(order.lat, order.lng, w.lat, w.lng);
            if (km < bestKm) {
                best = w;
                bestKm = km;
            }
        }
        return { recommendedStockLocationId: best.id, distanceKm: Math.round(bestKm * 10) / 10 };
    }
    if (cityHit.length > 0) {
        return { recommendedStockLocationId: cityHit[0].id, distanceKm: null };
    }
    return { recommendedStockLocationId: null, distanceKm: null };
}
/**
 * 三档统一排序键：(zone.sortOrder, rowNo || 0, levelNo || 0)。
 * zone 档下 rowNo / levelNo 恒为 null → 天然退化为「按库区顺序」，无需分支。
 */
function sortPickingRows(rows) {
    const keyed = rows.map((r) => {
        var _a, _b, _c;
        return ({
            row: r,
            bound: r.zoneSortOrder !== null,
            k1: (_a = r.zoneSortOrder) !== null && _a !== void 0 ? _a : 0,
            k2: (_b = r.rowNo) !== null && _b !== void 0 ? _b : 0,
            k3: (_c = r.levelNo) !== null && _c !== void 0 ? _c : 0,
        });
    });
    keyed.sort((a, b) => {
        if (a.bound !== b.bound)
            return a.bound ? -1 : 1;
        if (a.k1 !== b.k1)
            return a.k1 - b.k1;
        if (a.k2 !== b.k2)
            return a.k2 - b.k2;
        if (a.k3 !== b.k3)
            return a.k3 - b.k3;
        return a.row.sku.localeCompare(b.row.sku);
    });
    let idx = 0;
    return keyed.map((k) => (Object.assign(Object.assign({}, k.row), { pathIndex: k.bound ? ++idx : exports.NO_BIN_PATH_INDEX })));
}
//# sourceMappingURL=pick-batch-math.js.map