// e:\code\vendure\packages\cjk-plugin\src\map\map-provider.ts
export interface MapProvider {
    readonly name: 'amap' | 'tencent' | 'baidu';
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
}

export interface DistrictNode {
    adcode: string;
    name: string;
    level: 'province' | 'city' | 'district' | 'street';
    center: { lat: number; lng: number };
}

export interface ReverseGeocodeResult {
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    formattedAddress: string;
}
