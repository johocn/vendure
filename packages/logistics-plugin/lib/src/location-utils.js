"use strict";
/**
 * 地理工具：用于「就近发货」策略计算仓库/门店与订单定位的距离。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.distanceKm = distanceKm;
/**
 * 返回两点之间的球面距离（单位：公里，haversine 公式）。
 * 若任一坐标非法，返回 +Infinity，使该锚点自然排在最后。
 */
function distanceKm(a, b) {
    if (!isFinite(a.lat) || !isFinite(a.lng) || !isFinite(b.lat) || !isFinite(b.lng)) {
        return Number.MAX_SAFE_INTEGER;
    }
    const R = 6371; // 地球半径（公里）
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
//# sourceMappingURL=location-utils.js.map