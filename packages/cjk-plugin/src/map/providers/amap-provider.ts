// e:\code\vendure\packages\cjk-plugin\src\map\providers\amap-provider.ts
import { DistrictNode, GeocodeInput, GeocodeLevel, GeocodeResult, MapProvider, ReverseGeocodeResult } from '../map-provider';

/** 高德 geocode 返回的 level 文本 → 内部精度级别 */
function mapAmapLevel(level?: string): GeocodeLevel {
    const value = String(level ?? '');
    if (/门牌|单元|室|号/.test(value)) return 'door';
    if (/兴趣点|poi/i.test(value)) return 'poi';
    if (/道路|路|街|巷|路口/.test(value)) return 'street';
    if (/区县|开发区|城区/.test(value)) return 'district';
    if (/省|市/.test(value)) return 'city';
    return 'street';
}

export class AmapProvider implements MapProvider {
    readonly name = 'amap' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        const plugins = 'AMap.Geocoder,AMap.DistrictSearch,AMap.PlaceSearch,AMap.AutoComplete';
        return `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=${plugins}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        // 高德 /v3/config/district：subdistrict=1 返回下一级
        const keywords = parentAdcode ?? '中国';
        const url = `https://restapi.amap.com/v3/config/district?key=${encodeURIComponent(apiKey)}&keywords=${encodeURIComponent(keywords)}&subdistrict=1&extensions=base`;
        // 外部 API 必须带超时：高德挂起时避免无限等待拖死调用链路
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            throw new Error(`高德行政区划查询失败: HTTP ${res.status}`);
        }
        const data: any = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德行政区划查询失败: ${data.info}`);
        }
        const districts: any[] = data.districts?.[0]?.districts ?? [];
        return districts.map(d => ({
            adcode: d.adcode,
            name: d.name,
            level: d.level as DistrictNode['level'],
            center: { lat: parseFloat(d.center.split(',')[1]), lng: parseFloat(d.center.split(',')[0]) },
        }));
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        const location = `${lng},${lat}`;
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(apiKey)}&location=${encodeURIComponent(location)}&extensions=base`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            throw new Error(`高德逆地理编码失败: HTTP ${res.status}`);
        }
        const data: any = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德逆地理编码失败: ${data.info}`);
        }
        const addr = data.regeocode?.addressComponent ?? {};
        return {
            province: addr.province && addr.province.length > 0 ? addr.province : null,
            city: addr.city && addr.city.length > 0 ? addr.city : null,
            district: addr.district && addr.district.length > 0 ? addr.district : null,
            street: addr.township && addr.township.length > 0 ? addr.township : null,
            formattedAddress: data.regeocode?.formatted_address ?? '',
        };
    }

    async geocode(input: GeocodeInput, apiKey: string, timeoutMs = 1500): Promise<GeocodeResult> {
        const url = new URL('https://restapi.amap.com/v3/geocode/geo');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('address', input.address);
        if (input.city) url.searchParams.set('city', input.city);
        url.searchParams.set('output', 'JSON');

        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) {
            throw new Error(`高德地理编码失败: HTTP ${res.status}`);
        }
        const data: any = await res.json();
        if (data.status !== '1' || !data.geocodes?.length) {
            throw new Error(`高德地理编码失败: ${data.info ?? '未匹配到坐标'}`);
        }
        const geo = data.geocodes[0];
        const [lng, lat] = String(geo.location ?? '').split(',').map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('高德地理编码失败: 坐标格式异常');
        }
        const component = geo.addressComponent ?? {};
        // 高德在直辖市场景 city 可能为空字符串，用 province 兜底
        const city = component.city && component.city.length > 0 ? component.city : component.province || null;
        return {
            lat,
            lng,
            level: mapAmapLevel(geo.level),
            formattedAddress: geo.formatted_address ?? input.address,
            province: component.province && component.province.length > 0 ? component.province : null,
            city,
            district: component.district && component.district.length > 0 ? component.district : null,
            adcode: geo.adcode ?? null,
        };
    }
}
