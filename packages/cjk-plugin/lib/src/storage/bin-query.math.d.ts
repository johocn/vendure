/**
 * 「库位 → SKU」反向查询的纯函数层（规格 §7.1）。
 * 过滤 / 排序 / 分页 / 占用归并全部在此，service 只负责取数与补水，便于无 DB 单测。
 */
export declare const BIN_PAGE_DEFAULT = 50;
export declare const BIN_PAGE_MAX = 200;
export interface VariantBinRow {
    bindingId: number;
    variantId: number;
    sku: string;
    variantName: string;
    barcode: string | null;
    internalCode: string | null;
    zoneId: number;
    zoneCode: string;
    zoneName: string;
    zoneSortOrder: number;
    binId: number | null;
    binCode: string | null;
    rowNo: number | null;
    levelNo: number | null;
    isDefault: boolean;
}
export interface BinRowInput {
    zoneId: number;
    zoneCode: string;
    zoneName: string;
    zoneSortOrder: number;
    binId: number;
    binCode: string;
    rowNo: number | null;
    levelNo: number | null;
}
export interface BinOccupancyRow {
    zoneId: number;
    zoneCode: string;
    zoneName: string;
    binId: number;
    binCode: string;
    rowNo: number | null;
    levelNo: number | null;
    skuCount: number;
}
export declare function clampPageSize(pageSize?: number | null): number;
export declare function normalizePage(page?: number | null): number;
/** `zoneId` + `binId` 同时传入时校验从属关系；返回错误原因（null = 通过） */
export declare function assertZoneBinMatch(zoneId?: number | null, binId?: number | null, binZoneId?: number | null): string | null;
/** 前缀匹配 sku / barcode / internalCode（大小写不敏感；空关键词恒真） */
export declare function matchKeyword(row: VariantBinRow, keyword?: string | null): boolean;
export declare function filterVariantBins(rows: VariantBinRow[], filter: {
    zoneId?: number | null;
    binId?: number | null;
    keyword?: string | null;
    includeDisabled?: boolean;
}): VariantBinRow[];
/** 与库位管理页一致的排序键：zone.sortOrder → rowNo → levelNo → sku */
export declare function sortVariantBins(rows: VariantBinRow[]): VariantBinRow[];
export declare function paginate<T>(rows: T[], page: number, pageSize: number): {
    totalItems: number;
    items: T[];
};
/** 全部启用库位 + 占用数 → 概览（含空格，前端可直接渲染角标） */
export declare function buildOccupancyRows(bins: BinRowInput[], counts: Map<number, number>): BinOccupancyRow[];
