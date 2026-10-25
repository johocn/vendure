"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmapProvider = void 0;
/** 高德 geocode 返回的 level 文本 → 内部精度级别 */
function mapAmapLevel(level) {
    const value = String(level !== null && level !== void 0 ? level : '');
    if (/门牌|单元|室|号/.test(value))
        return 'door';
    if (/兴趣点|poi/i.test(value))
        return 'poi';
    if (/道路|路|街|巷|路口/.test(value))
        return 'street';
    if (/区县|开发区|城区/.test(value))
        return 'district';
    if (/省|市/.test(value))
        return 'city';
    return 'street';
}
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
        // 外部 API 必须带超时：高德挂起时避免无限等待拖死调用链路
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            throw new Error(`高德逆地理编码失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德逆地理编码失败: ${data.info}`);
        }
        const addr = (_b = (_a = data.regeocode) === null || _a === void 0 ? void 0 : _a.addressComponent) !== null && _b !== void 0 ? _b : {};
        return {
            province: addr.province && addr.province.length > 0 ? addr.province : null,
            city: addr.city && addr.city.length > 0 ? addr.city : null,
            district: addr.district && addr.district.length > 0 ? addr.district : null,
            street: addr.township && addr.township.length > 0 ? addr.township : null,
            formattedAddress: (_d = (_c = data.regeocode) === null || _c === void 0 ? void 0 : _c.formatted_address) !== null && _d !== void 0 ? _d : '',
        };
    }
    async geocode(input, apiKey, timeoutMs = 1500) {
        var _a, _b, _c, _d, _e, _f;
        const url = new URL('https://restapi.amap.com/v3/geocode/geo');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('address', input.address);
        if (input.city)
            url.searchParams.set('city', input.city);
        url.searchParams.set('output', 'JSON');
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) {
            throw new Error(`高德地理编码失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1' || !((_a = data.geocodes) === null || _a === void 0 ? void 0 : _a.length)) {
            throw new Error(`高德地理编码失败: ${(_b = data.info) !== null && _b !== void 0 ? _b : '未匹配到坐标'}`);
        }
        const geo = data.geocodes[0];
        const [lng, lat] = String((_c = geo.location) !== null && _c !== void 0 ? _c : '').split(',').map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('高德地理编码失败: 坐标格式异常');
        }
        const component = (_d = geo.addressComponent) !== null && _d !== void 0 ? _d : {};
        // 高德在直辖市场景 city 可能为空字符串，用 province 兜底
        const city = component.city && component.city.length > 0 ? component.city : component.province || null;
        return {
            lat,
            lng,
            level: mapAmapLevel(geo.level),
            formattedAddress: (_e = geo.formatted_address) !== null && _e !== void 0 ? _e : input.address,
            province: component.province && component.province.length > 0 ? component.province : null,
            city,
            district: component.district && component.district.length > 0 ? component.district : null,
            adcode: (_f = geo.adcode) !== null && _f !== void 0 ? _f : null,
        };
    }
}
exports.AmapProvider = AmapProvider;
//# sourceMappingURL=amap-provider.js.map