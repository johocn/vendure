import { Logger, StockLocation } from '@vendure/core';
import { distanceKm } from './location-utils';

export const loggerCtx = 'MatrixStockLocationStrategy';

/** 会员等级专属规则项 */
export interface MemberStockRule {
    level: string;             // 如 'LV3'
    locationIds: string[];     // 优先仓
    fallback: 'nearest' | 'priority' | 'stock-first';
}

/** 订单级地理锚点（复用就近逻辑输入） */
export interface OrderGeoAnchor {
    lat: number | null;
    lng: number | null;
}

/** 按距离升序 */
export function rankByNearest(
    locations: StockLocation[],
    anchor: OrderGeoAnchor,
): StockLocation[] {
    if (anchor.lat == null || anchor.lng == null) {
        return locations;
    }
    return [...locations].sort((a, b) => distKm(a, anchor) - distKm(b, anchor));
}

/** 按 stockLocationPriority JSON priority 升序 */
export function rankByPriority(
    locations: StockLocation[],
    priorityConfig: Array<{ locationId: string; priority: number }>,
): StockLocation[] {
    return [...locations].sort((a, b) => {
        const pa = priorityConfig.find(p => String(p.locationId) === String(a.id))?.priority ?? 999;
        const pb = priorityConfig.find(p => String(p.locationId) === String(b.id))?.priority ?? 999;
        return pa - pb;
    });
}

/** 按库存 onHand 降序 */
export function rankByStockFirst(
    locations: StockLocation[],
    stockOnHandMap: Map<string, number>,
): StockLocation[] {
    return [...locations].sort((a, b) =>
        (stockOnHandMap.get(String(b.id)) ?? 0) - (stockOnHandMap.get(String(a.id)) ?? 0));
}

/** 会员专属：命中仓按 locationIds 顺序前置，其余按 fallback 规则排序 */
export function rankByMemberRule(
    locations: StockLocation[],
    rule: MemberStockRule,
    priorityConfig: Array<{ locationId: string; priority: number }>,
    stockOnHandMap: Map<string, number>,
    anchor: OrderGeoAnchor,
): StockLocation[] {
    const hit = rule.locationIds
        .map(id => locations.find(l => String(l.id) === String(id)))
        .filter((l): l is StockLocation => !!l);
    const rest = locations.filter(l => !hit.includes(l));
    let rankedRest: StockLocation[];
    switch (rule.fallback) {
        case 'priority':
            rankedRest = rankByPriority(rest, priorityConfig);
            break;
        case 'stock-first':
            rankedRest = rankByStockFirst(rest, stockOnHandMap);
            break;
        default:
            rankedRest = rankByNearest(rest, anchor);
    }
    return [...hit, ...rankedRest];
}

function distKm(loc: StockLocation, anchor: OrderGeoAnchor): number {
    const cf = (loc.customFields as any) ?? {};
    const lat = cf.lat != null ? Number(cf.lat) : NaN;
    const lng = cf.lng != null ? Number(cf.lng) : NaN;
    if (!isFinite(lat) || !isFinite(lng)) {
        return Number.MAX_SAFE_INTEGER;
    }
    return distanceKm({ lat, lng }, { lat: anchor.lat!, lng: anchor.lng! });
}

/** 解析 channel 级 stockLocationPriority JSON，容错返回 [] */
export function parsePriorityConfig(raw: unknown): Array<{ locationId: string; priority: number }> {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
        return Array.isArray(arr) ? arr : [];
    } catch {
        Logger.warn('stockLocationPriority JSON 解析失败，按空配置处理', loggerCtx);
        return [];
    }
}

/** 解析 channel 级 memberStockStrategy JSON，容错返回 [] */
export function parseMemberRules(raw: unknown): MemberStockRule[] {
    try {
        const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
        return Array.isArray(arr) ? (arr as MemberStockRule[]) : [];
    } catch {
        Logger.warn('memberStockStrategy JSON 解析失败，按空配置处理', loggerCtx);
        return [];
    }
}
