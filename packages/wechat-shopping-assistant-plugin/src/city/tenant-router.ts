import { CatalogChannel, Precision } from './city-catalog';

export type Candidate = CatalogChannel;

const PRECISION_WEIGHT: Record<Precision, number> = { explicit: 0, district: 1, circle: 2, all: 3 };

export { PRECISION_WEIGHT };

export interface RankOptions {
    /** 半径候选的最大距离（km），缺省 3 */
    maxDistanceKm?: number;
}

export function rankCandidates(candidates: Candidate[], opts: RankOptions = {}): Candidate[] {
    const maxKm = opts.maxDistanceKm ?? 3;
    const usable = candidates.filter(c => c.precision !== 'circle' || (c.distanceKm != null && c.distanceKm <= maxKm));
    const sorted = usable.slice().sort((a, b) => {
        const p = PRECISION_WEIGHT[a.precision] - PRECISION_WEIGHT[b.precision];
        if (p !== 0) return p;
        const min = (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0);
        if (min !== 0) return min;
        const dm = (a.deliveryMinutes ?? 999) - (b.deliveryMinutes ?? 999);
        if (dm !== 0) return dm;
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });
    // 同渠道可能同时命中 explicit/district/all，排序后按渠道去重，保留精度最高的那条
    const seen = new Set<string>();
    return sorted.filter(c => {
        if (seen.has(c.channelId)) return false;
        seen.add(c.channelId);
        return true;
    });
}
