/** 城市 → 可服务渠道索引（纯函数，数据由 service 注入）。 */
export type Precision = 'explicit' | 'district' | 'circle' | 'all';

export interface CatalogChannel {
    channelId: string;
    channelCode: string;
    channelToken: string;
    channelName: string;
    precision: Precision;
    minOrderAmount: number;
    deliveryMinutes: number | null;
    storeId: string | null;
    /** 门店/配送圆心坐标（circle 类型），路由时算用户距离 */
    centerLat: number | null;
    centerLng: number | null;
    /** 用户到门店的距离（km），由路由服务按坐标计算后填入 */
    distanceKm: number | null;
}

export interface ChannelLike {
    id: string;
    code: string;
    token: string;
    name: string;
    servingCities: string[];
    minOrderAmount?: number;
    deliveryMinutes?: number | null;
}

export interface RangeLike {
    channelId: number | string;
    shopId: number | string;
    rangeType: 'all' | 'circle' | 'district' | string;
    districtCodes: string | null;
    radiusKm: number | null;
    centerLat: number | null;
    centerLng: number | null;
    enabled: boolean;
}

export interface CityIndex {
    byCity: Map<string, CatalogChannel[]>;
    allChannels: CatalogChannel[];
}

function parseCodes(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
        return [];
    }
}

export function buildCityIndex(channels: ChannelLike[], ranges: RangeLike[]): CityIndex {
    const byCity = new Map<string, CatalogChannel[]>();
    const allChannels: CatalogChannel[] = [];
    const push = (city: string, item: CatalogChannel) => {
        const list = byCity.get(city) ?? [];
        list.push(item);
        byCity.set(city, list);
    };

    for (const ch of channels) {
        const base = {
            channelId: String(ch.id),
            channelCode: ch.code,
            channelToken: ch.token,
            channelName: ch.name,
            minOrderAmount: ch.minOrderAmount ?? 0,
            deliveryMinutes: ch.deliveryMinutes ?? null,
            storeId: null as string | null,
            centerLat: null as number | null,
            centerLng: null as number | null,
            distanceKm: null as number | null,
        };
        for (const city of ch.servingCities ?? []) {
            push(city, { ...base, precision: 'explicit' });
        }
        const range = ranges.find(r => String(r.channelId) === String(ch.id));
        if (!range || !range.enabled) continue;

        if (range.rangeType === 'all') {
            allChannels.push({ ...base, precision: 'all' });
        } else if (range.rangeType === 'district') {
            for (const code of parseCodes(range.districtCodes)) {
                const cityCode = code.length === 6 ? `${code.slice(0, 4)}00` : code;
                push(cityCode, { ...base, precision: 'district', storeId: String(range.shopId) });
            }
        } else if (range.rangeType === 'circle') {
            // 半径覆盖需要用户坐标：索引阶段带上圆心，距离由 TenantRouterService 计算
            allChannels.push({
                ...base,
                precision: 'circle',
                storeId: String(range.shopId),
                centerLat: range.centerLat,
                centerLng: range.centerLng,
            });
        }
    }
    return { byCity, allChannels };
}
