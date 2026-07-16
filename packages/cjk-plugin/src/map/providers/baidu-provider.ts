// e:\code\vendure\packages\cjk-plugin\src\map\providers\baidu-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

export class BaiduProvider implements MapProvider {
    readonly name = 'baidu' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        return `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(apiKey)}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }
}
