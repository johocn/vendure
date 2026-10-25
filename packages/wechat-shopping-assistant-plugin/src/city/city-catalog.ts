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

export interface CityIndex {
    byCity: Map<string, CatalogChannel[]>;
    allChannels: CatalogChannel[];
}

/**
 * 渠道 → 城市索引：只读渠道 `servingCities`（运营显式配置的城市码）。
 * 未配置服务城市的渠道视为「不限城市」（线上历史渠道均未配置），进 allChannels 兜底。
 */
export function buildCityIndex(channels: ChannelLike[]): CityIndex {
    const byCity = new Map<string, CatalogChannel[]>();
    const allChannels: CatalogChannel[] = [];

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
        const cities = ch.servingCities ?? [];
        if (cities.length === 0) {
            allChannels.push({ ...base, precision: 'all' });
            continue;
        }
        for (const city of cities) {
            const list = byCity.get(city) ?? [];
            list.push({ ...base, precision: 'explicit' });
            byCity.set(city, list);
        }
    }
    return { byCity, allChannels };
}
