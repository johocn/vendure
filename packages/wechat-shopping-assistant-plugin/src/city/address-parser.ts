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

export function codesFromAdcode(adcode?: string | null): {
    provinceCode: string | null;
    cityCode: string | null;
    districtCode: string | null;
} {
    const code = String(adcode ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { provinceCode: null, cityCode: null, districtCode: null };
    }
    return {
        provinceCode: `${code.slice(0, 2)}0000`,
        cityCode: `${code.slice(0, 4)}00`,
        districtCode: code,
    };
}

export function extractPhone(text: string): { phoneNumber: string | null; rest: string } {
    const m = /(1[3-9]\d{9})/.exec(text);
    if (!m) return { phoneNumber: null, rest: text.trim() };
    return {
        phoneNumber: m[1],
        rest: text.replace(m[1], '').replace(/\s+/g, ' ').trim(),
    };
}

export function buildParsedAddress(geo: GeoLike | null, rawText: string): ParsedAddress {
    const { phoneNumber, rest } = extractPhone(rawText);
    const codes = codesFromAdcode(geo?.adcode);
    const missing: MissingField[] = [];
    if (!geo?.city) missing.push('city');
    if (!codes.cityCode || !geo?.district) missing.push('district');
    if (!geo?.formattedAddress && !rest) missing.push('street');
    if (!phoneNumber) missing.push('phone');

    return {
        province: geo?.province ?? null,
        city: geo?.city ?? null,
        cityCode: codes.cityCode,
        district: geo?.district ?? null,
        districtCode: codes.districtCode,
        provinceCode: codes.provinceCode,
        streetLine1: geo?.formattedAddress || rest,
        phoneNumber,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        missing,
    };
}
