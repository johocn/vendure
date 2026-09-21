import type { PickBatchState } from './pick-batch.entity';
/** 无库位绑定的行排在最后 */
export declare const NO_BIN_PATH_INDEX = 9999;
export declare function canTransition(from: PickBatchState, to: PickBatchState): boolean;
/** PB + yyyyMMdd + 3 位当日序号 */
export declare function formatBatchCode(date: Date, seq: number): string;
/** 当日已存在批次数量 → 下一个序号 */
export declare function nextSequence(existingCount: number): number;
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
export declare function pickRecommendation(order: OrderGeo, warehouses: WarehouseCandidate[]): Recommendation;
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
export declare function sortPickingRows(rows: PickingRowInput[]): PickingRow[];
