"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankCandidates = rankCandidates;
const PRECISION_WEIGHT = { explicit: 0, district: 1, circle: 2, all: 3 };
function rankCandidates(candidates, opts = {}) {
    var _a;
    const maxKm = (_a = opts.maxDistanceKm) !== null && _a !== void 0 ? _a : 3;
    const usable = candidates.filter(c => c.precision !== 'circle' || (c.distanceKm != null && c.distanceKm <= maxKm));
    const sorted = usable.slice().sort((a, b) => {
        var _a, _b, _c, _d, _e, _f;
        const p = PRECISION_WEIGHT[a.precision] - PRECISION_WEIGHT[b.precision];
        if (p !== 0)
            return p;
        const min = ((_a = a.minOrderAmount) !== null && _a !== void 0 ? _a : 0) - ((_b = b.minOrderAmount) !== null && _b !== void 0 ? _b : 0);
        if (min !== 0)
            return min;
        const dm = ((_c = a.deliveryMinutes) !== null && _c !== void 0 ? _c : 999) - ((_d = b.deliveryMinutes) !== null && _d !== void 0 ? _d : 999);
        if (dm !== 0)
            return dm;
        return ((_e = a.distanceKm) !== null && _e !== void 0 ? _e : 999) - ((_f = b.distanceKm) !== null && _f !== void 0 ? _f : 999);
    });
    // 同渠道可能同时命中 explicit/district/all，排序后按渠道去重，保留精度最高的那条
    const seen = new Set();
    return sorted.filter(c => {
        if (seen.has(c.channelId))
            return false;
        seen.add(c.channelId);
        return true;
    });
}
//# sourceMappingURL=tenant-router.js.map