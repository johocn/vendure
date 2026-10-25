export interface MapProvider {
    readonly name: 'amap' | 'tencent' | 'baidu';
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
    geocode(input: GeocodeInput, apiKey: string, timeoutMs?: number): Promise<GeocodeResult>;
}
/** 定位精度级别：门牌 > 兴趣点 > 道路 > 区县 > 城市 */
export type GeocodeLevel = 'door' | 'poi' | 'street' | 'district' | 'city';
export interface GeocodeInput {
    /** 待编码地址文本（尽量含省市区 + 详细地址） */
    address: string;
    /** 城市限定（提升命中率，可传城市名/adcode） */
    city?: string;
    district?: string;
}
export interface GeocodeResult {
    lat: number;
    lng: number;
    /** 命中的精度级别，用于判断是否够配送/是否需追问门牌 */
    level: GeocodeLevel;
    formattedAddress: string;
    province: string | null;
    city: string | null;
    district: string | null;
    adcode?: string | null;
}
export interface DistrictNode {
    adcode: string;
    name: string;
    level: 'province' | 'city' | 'district' | 'street';
    center: {
        lat: number;
        lng: number;
    };
}
export interface ReverseGeocodeResult {
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    formattedAddress: string;
}
