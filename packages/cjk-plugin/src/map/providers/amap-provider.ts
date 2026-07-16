// e:\code\vendure\packages\cjk-plugin\src\map\providers\amap-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

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
        const res = await fetch(url);
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
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`高德逆地理编码失败: HTTP ${res.status}`);
        }
        const data: any = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德逆地理编码失败: ${data.info}`);
        }
        const addr = data.regeocoded?.addressComponent ?? {};
        return {
            province: addr.province && addr.province.length > 0 ? addr.province : null,
            city: addr.city && addr.city.length > 0 ? addr.city : null,
            district: addr.district && addr.district.length > 0 ? addr.district : null,
            street: addr.township && addr.township.length > 0 ? addr.township : null,
            formattedAddress: data.regeocoded?.formatted_address ?? '',
        };
    }
}
