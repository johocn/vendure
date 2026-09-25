import { haversineKm } from '../inventory/mirror-math';
import type { PickBatchState } from './pick-batch.entity';

/** 无库位绑定的行排在最后 */
export const NO_BIN_PATH_INDEX = 9999;

const TRANSITIONS: Record<PickBatchState, PickBatchState[]> = {
    PENDING: ['PICKED', 'CANCELLED'],
    PICKED: ['PRINTED', 'CANCELLED'],
    PRINTED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['HANDOVER', 'EXCEPTION'],
    // 异常件处理完回交接（不回到 SHIPPED，避免重复发货语义）
    EXCEPTION: ['HANDOVER'],
    HANDOVER: ['REVIEWED', 'EXCEPTION'],
    REVIEWED: [],
    CANCELLED: [],
};

export function canTransition(from: PickBatchState, to: PickBatchState): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
}

/** PB + yyyyMMdd + 3 位当日序号 */
export function formatBatchCode(date: Date, seq: number): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `PB${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}

/** 当日已存在批次数量 → 下一个序号 */
export function nextSequence(existingCount: number): number {
    return existingCount + 1;
}

export interface WarehouseCandidate {
    id: number;
    enabled: boolean;
    serviceCities?: string[] | null;
    lat?: number | null;
    lng?: number | null;
}

export interface OrderGeo {
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
}

export interface Recommendation {
    recommendedStockLocationId: number | null;
    distanceKm: number | null;
}

/**
 * 就近选仓。优先级见规格 §7：
 * 1. 有坐标 → 城市命中且距离最小
 * 2. 无坐标但城市文本命中 → 命中第一个
 * 3. 都不命中 → null（不伪造距离）
 */
export function pickRecommendation(
    order: OrderGeo,
    warehouses: WarehouseCandidate[],
): Recommendation {
    const enabled = warehouses.filter((w) => w.enabled);
    const cityHit = order.city
        ? enabled.filter((w) => (w.serviceCities ?? []).includes(order.city as string))
        : [];

    // 全仓文本命中（订单无 city 时作为兜底池）
    const pool = cityHit.length > 0 ? cityHit : enabled;

    const hasOrderGeo = typeof order.lat === 'number' && typeof order.lng === 'number';
    const withGeo = pool.filter(
        (w) => typeof w.lat === 'number' && typeof w.lng === 'number',
    ) as Array<WarehouseCandidate & { lat: number; lng: number }>;

    if (hasOrderGeo && withGeo.length > 0) {
        let best = withGeo[0];
        let bestKm = haversineKm(order.lat as number, order.lng as number, best.lat, best.lng);
        for (const w of withGeo.slice(1)) {
            const km = haversineKm(order.lat as number, order.lng as number, w.lat, w.lng);
            if (km < bestKm) {
                best = w;
                bestKm = km;
            }
        }
        return { recommendedStockLocationId: best.id, distanceKm: Math.round(bestKm * 10) / 10 };
    }

    if (cityHit.length > 0) {
        return { recommendedStockLocationId: cityHit[0].id, distanceKm: null };
    }

    return { recommendedStockLocationId: null, distanceKm: null };
}

export interface PickingRowInput {
    sku: string;
    name: string;
    qty: number;
    orderCodes: string[];
    zoneSortOrder: number | null;
    rowNo: number | null;
    levelNo: number | null;
    binCode: string | null;
    zoneCode: string | null;
    zoneName: string | null;
}

export interface PickingRow extends PickingRowInput {
    pathIndex: number;
}

/**
 * 三档统一排序键：(zone.sortOrder, rowNo || 0, levelNo || 0)。
 * zone 档下 rowNo / levelNo 恒为 null → 天然退化为「按库区顺序」，无需分支。
 */
export function sortPickingRows(rows: PickingRowInput[]): PickingRow[] {
    const keyed = rows.map((r) => ({
        row: r,
        bound: r.zoneSortOrder !== null,
        k1: r.zoneSortOrder ?? 0,
        k2: r.rowNo ?? 0,
        k3: r.levelNo ?? 0,
    }));

    keyed.sort((a, b) => {
        if (a.bound !== b.bound) return a.bound ? -1 : 1;
        if (a.k1 !== b.k1) return a.k1 - b.k1;
        if (a.k2 !== b.k2) return a.k2 - b.k2;
        if (a.k3 !== b.k3) return a.k3 - b.k3;
        return a.row.sku.localeCompare(b.row.sku);
    });

    let idx = 0;
    return keyed.map((k) => ({
        ...k.row,
        pathIndex: k.bound ? ++idx : NO_BIN_PATH_INDEX,
    }));
}