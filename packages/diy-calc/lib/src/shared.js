"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORD_DIAMETERS = exports.CORD_TAIL = void 0;
exports.specOf = specOf;
exports.bomItem = bomItem;
exports.aggregate = aggregate;
exports.pickCordDiameter = pickCordDiameter;
/** 弹力线打结收尾留量（§7.6） */
exports.CORD_TAIL = 160;
/** 线径可选档（mm），按最小孔径从大到小取 */
exports.CORD_DIAMETERS = [1.0, 0.8, 0.6];
function specOf(m) {
    return m.diameter != null ? `${m.diameter}mm ${m.shape}` : m.shape;
}
function bomItem(m, qty) {
    return {
        materialId: m.id,
        code: m.code,
        name: m.name,
        spec: specOf(m),
        unitPrice: m.price,
        qty,
        subtotal: qty * m.price,
    };
}
function aggregate(items) {
    const map = new Map();
    for (const item of items) {
        const existing = map.get(item.materialId);
        if (existing) {
            existing.qty += item.qty;
            existing.subtotal += item.subtotal;
        }
        else {
            map.set(item.materialId, Object.assign({}, item));
        }
    }
    return [...map.values()];
}
function pickCordDiameter(holeMin) {
    var _a;
    if (holeMin == null) {
        return 1.0;
    }
    const max = Math.min(holeMin - 0.2, 1.0);
    return (_a = exports.CORD_DIAMETERS.find(d => d <= max)) !== null && _a !== void 0 ? _a : 0.6;
}
//# sourceMappingURL=shared.js.map