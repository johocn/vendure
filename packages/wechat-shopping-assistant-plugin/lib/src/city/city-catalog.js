"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCityIndex = buildCityIndex;
/**
 * 渠道 → 城市索引：只读渠道 `servingCities`（运营显式配置的城市码）。
 * 未配置服务城市的渠道视为「不限城市」（线上历史渠道均未配置），进 allChannels 兜底。
 */
function buildCityIndex(channels) {
    var _a, _b, _c, _d;
    const byCity = new Map();
    const allChannels = [];
    for (const ch of channels) {
        const base = {
            channelId: String(ch.id),
            channelCode: ch.code,
            channelToken: ch.token,
            channelName: ch.name,
            minOrderAmount: (_a = ch.minOrderAmount) !== null && _a !== void 0 ? _a : 0,
            deliveryMinutes: (_b = ch.deliveryMinutes) !== null && _b !== void 0 ? _b : null,
            storeId: null,
            centerLat: null,
            centerLng: null,
            distanceKm: null,
        };
        const cities = (_c = ch.servingCities) !== null && _c !== void 0 ? _c : [];
        if (cities.length === 0) {
            allChannels.push(Object.assign(Object.assign({}, base), { precision: 'all' }));
            continue;
        }
        for (const city of cities) {
            const list = (_d = byCity.get(city)) !== null && _d !== void 0 ? _d : [];
            list.push(Object.assign(Object.assign({}, base), { precision: 'explicit' }));
            byCity.set(city, list);
        }
    }
    return { byCity, allChannels };
}
//# sourceMappingURL=city-catalog.js.map