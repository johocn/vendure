import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';
export declare class BaiduProvider implements MapProvider {
    readonly name: "baidu";
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
}
