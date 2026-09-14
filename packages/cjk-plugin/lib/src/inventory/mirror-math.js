"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumBoundOnHand = sumBoundOnHand;
exports.calcMirrorDelta = calcMirrorDelta;
exports.pickLocationsByIds = pickLocationsByIds;
exports.haversineKm = haversineKm;
function sumBoundOnHand(levels, boundLocationIds) {
    const set = new Set(boundLocationIds.map(String));
    return levels.reduce((sum, l) => (set.has(String(l.locationId)) ? sum + l.onHand : sum), 0);
}
function calcMirrorDelta(currentVirtual, boundTotal) {
    return boundTotal - currentVirtual;
}
function pickLocationsByIds(locations, ids) {
    const set = new Set(ids.map(String));
    return locations.filter(l => set.has(String(l.id)));
}
/** 地球半径 km，Haversine 公式（与 inventory.service.locationDistanceKm 同源） */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
//# sourceMappingURL=mirror-math.js.map