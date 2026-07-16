"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmapProvider = void 0;
class AmapProvider {
    constructor() {
        this.name = 'amap';
    }
    getSdkLoaderUrl(apiKey, securityJsCode) {
        const plugins = 'AMap.Geocoder,AMap.DistrictSearch,AMap.PlaceSearch,AMap.AutoComplete';
        return `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=${plugins}`;
    }
    async fetchDistricts(parentAdcode, apiKey) {
        var _a, _b, _c;
        // 高德 /v3/config/district：subdistrict=1 返回下一级
        const keywords = parentAdcode !== null && parentAdcode !== void 0 ? parentAdcode : '中国';
        const url = `https://restapi.amap.com/v3/config/district?key=${encodeURIComponent(apiKey)}&keywords=${encodeURIComponent(keywords)}&subdistrict=1&extensions=base`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`高德行政区划查询失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德行政区划查询失败: ${data.info}`);
        }
        const districts = (_c = (_b = (_a = data.districts) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.districts) !== null && _c !== void 0 ? _c : [];
        return districts.map(d => ({
            adcode: d.adcode,
            name: d.name,
            level: d.level,
            center: { lat: parseFloat(d.center.split(',')[1]), lng: parseFloat(d.center.split(',')[0]) },
        }));
    }
    async reverseGeocode(lat, lng, apiKey) {
        var _a, _b, _c, _d;
        const location = `${lng},${lat}`;
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(apiKey)}&location=${encodeURIComponent(location)}&extensions=base`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`高德逆地理编码失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德逆地理编码失败: ${data.info}`);
        }
        const addr = (_b = (_a = data.regeocoded) === null || _a === void 0 ? void 0 : _a.addressComponent) !== null && _b !== void 0 ? _b : {};
        return {
            province: addr.province && addr.province.length > 0 ? addr.province : null,
            city: addr.city && addr.city.length > 0 ? addr.city : null,
            district: addr.district && addr.district.length > 0 ? addr.district : null,
            street: addr.township && addr.township.length > 0 ? addr.township : null,
            formattedAddress: (_d = (_c = data.regeocoded) === null || _c === void 0 ? void 0 : _c.formatted_address) !== null && _d !== void 0 ? _d : '',
        };
    }
}
exports.AmapProvider = AmapProvider;
//# sourceMappingURL=amap-provider.js.map