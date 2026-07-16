import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';
export declare class AmapProvider implements MapProvider {
    readonly name: "amap";
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
}
