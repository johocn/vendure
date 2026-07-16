// e:\code\vendure\packages\cjk-plugin\src\map\providers\tencent-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

export class TencentProvider implements MapProvider {
    readonly name = 'tencent' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        return `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(apiKey)}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }
}
