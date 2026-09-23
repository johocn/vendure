"use strict";
/**
 * 「库位 → SKU」反向查询的纯函数层（规格 §7.1）。
 * 过滤 / 排序 / 分页 / 占用归并全部在此，service 只负责取数与补水，便于无 DB 单测。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIN_PAGE_MAX = exports.BIN_PAGE_DEFAULT = void 0;
exports.clampPageSize = clampPageSize;
exports.normalizePage = normalizePage;
exports.assertZoneBinMatch = assertZoneBinMatch;
exports.matchKeyword = matchKeyword;
exports.filterVariantBins = filterVariantBins;
exports.sortVariantBins = sortVariantBins;
exports.paginate = paginate;
exports.buildOccupancyRows = buildOccupancyRows;
exports.BIN_PAGE_DEFAULT = 50;
exports.BIN_PAGE_MAX = 200;
function clampPageSize(pageSize) {
    if (!pageSize || !Number.isFinite(pageSize) || pageSize <= 0)
        return exports.BIN_PAGE_DEFAULT;
    return Math.min(Math.floor(pageSize), exports.BIN_PAGE_MAX);
}
function normalizePage(page) {
    if (!page || !Number.isFinite(page) || page <= 0)
        return 1;
    return Math.floor(page);
}
/** `zoneId` + `binId` 同时传入时校验从属关系；返回错误原因（null = 通过） */
function assertZoneBinMatch(zoneId, binId, binZoneId) {
    if (binId === undefined || binId === null)
        return null;
    if (binZoneId === undefined || binZoneId === null) {
        return `库位 #${binId} 不存在或已被删除`;
    }
    if (zoneId !== undefined && zoneId !== null && String(binZoneId) !== String(zoneId)) {
        return `库位 #${binId} 不属于库区 #${zoneId}`;
    }
    return null;
}
/** 前缀匹配 sku / barcode / internalCode（大小写不敏感；空关键词恒真） */
function matchKeyword(row, keyword) {
    const k = (keyword || '').trim().toLowerCase();
    if (!k)
        return true;
    const fields = [row.sku, row.barcode, row.internalCode];
    return fields.some((f) => !!f && f.toLowerCase().startsWith(k));
}
function filterVariantBins(rows, filter) {
    return rows.filter((r) => {
        if (filter.zoneId !== undefined && filter.zoneId !== null && String(r.zoneId) !== String(filter.zoneId))
            return false;
        if (filter.binId !== undefined && filter.binId !== null && String(r.binId) !== String(filter.binId))
            return false;
        return matchKeyword(r, filter.keyword);
    });
}
/** 与库位管理页一致的排序键：zone.sortOrder → rowNo → levelNo → sku */
function sortVariantBins(rows) {
    return rows.slice().sort((a, b) => {
        if (a.zoneSortOrder !== b.zoneSortOrder)
            return a.zoneSortOrder - b.zoneSortOrder;
        const ar = a.rowNo || 0;
        const br = b.rowNo || 0;
        if (ar !== br)
            return ar - br;
        const al = a.levelNo || 0;
        const bl = b.levelNo || 0;
        if (al !== bl)
            return al - bl;
        return a.sku.localeCompare(b.sku);
    });
}
function paginate(rows, page, pageSize) {
    const p = normalizePage(page);
    const size = clampPageSize(pageSize);
    return { totalItems: rows.length, items: rows.slice((p - 1) * size, p * size) };
}
/** 全部启用库位 + 占用数 → 概览（含空格，前端可直接渲染角标） */
function buildOccupancyRows(bins, counts) {
    return bins
        .map((b) => (Object.assign(Object.assign({}, b), { skuCount: counts.get(b.binId) || 0 })))
        .sort((a, b) => a.zoneSortOrder - b.zoneSortOrder ||
        (a.rowNo || 0) - (b.rowNo || 0) ||
        (a.levelNo || 0) - (b.levelNo || 0));
}
//# sourceMappingURL=bin-query.math.js.map