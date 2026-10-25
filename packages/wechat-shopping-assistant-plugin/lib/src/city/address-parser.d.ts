/**
 * 地址解析纯函数：地图编码结果 → 结构化地址 + 缺失字段。
 * 不发起网络请求（geocode 由调用方传入），便于单测与复用。
 */
export type MissingField = 'city' | 'district' | 'street' | 'phone';
export interface ParsedAddress {
    province: string | null;
    city: string | null;
    cityCode: string | null;
    district: string | null;
    districtCode: string | null;
    provinceCode: string | null;
    streetLine1: string;
    phoneNumber: string | null;
    lat: number | null;
    lng: number | null;
    missing: MissingField[];
}
export interface GeoLike {
    province: string | null;
    city: string | null;
    district: string | null;
    adcode?: string | null;
    lat: number;
    lng: number;
    formattedAddress: string;
}
export declare function codesFromAdcode(adcode?: string | null): {
    provinceCode: string | null;
    cityCode: string | null;
    districtCode: string | null;
};
export declare function extractPhone(text: string): {
    phoneNumber: string | null;
    rest: string;
};
export declare function buildParsedAddress(geo: GeoLike | null, rawText: string): ParsedAddress;
