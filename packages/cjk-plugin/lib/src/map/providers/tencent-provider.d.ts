import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';
export declare class TencentProvider implements MapProvider {
    readonly name: "tencent";
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
}
