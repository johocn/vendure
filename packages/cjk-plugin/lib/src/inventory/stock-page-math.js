"use strict";
/**
 * 库存明细页的纯函数层（无 IO、可单测）：分桶 / 查询归一 / 排序 / 汇总。
 * 分桶与排序一律在**服务端**完成（前端不重复实现 bucketOf，见规格 §3.3）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.STOCK_SORTS = exports.STOCK_BUCKETS = void 0;
exports.bucketOf = bucketOf;
exports.normalizeStockQuery = normalizeStockQuery;
exports.sortStockRows = sortStockRows;
exports.summarizeStock = summarizeStock;
exports.STOCK_BUCKETS = ['out', 'low', 'ok'];
exports.STOCK_SORTS = ['stockAsc', 'stockDesc', 'gapDesc', 'valueDesc'];
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
/** 分桶：现存 <= 0 → 缺货；现存 < 安全库存 → 低库存；否则正常 */
function bucketOf(onHand, safetyStock) {
    if (onHand <= 0) {
        return 'out';
    }
    if (onHand < safetyStock) {
        return 'low';
    }
    return 'ok';
}
/** 入参归一：非法 sort/bucket 回退默认，不抛异常；page/pageSize 夹取安全区间 */
function normalizeStockQuery(input) {
    var _a, _b, _c;
    const src = input !== null && input !== void 0 ? input : {};
    const keyword = String((_a = src.keyword) !== null && _a !== void 0 ? _a : '').trim();
    const bucket = exports.STOCK_BUCKETS.includes(src.bucket) ? src.bucket : '';
    const sort = exports.STOCK_SORTS.includes(src.sort) ? src.sort : 'stockAsc';
    const rawPage = Math.trunc(Number((_b = src.page) !== null && _b !== void 0 ? _b : 1));
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Math.trunc(Number((_c = src.pageSize) !== null && _c !== void 0 ? _c : exports.DEFAULT_PAGE_SIZE));
    const pageSize = Number.isFinite(rawSize) ? Math.min(exports.MAX_PAGE_SIZE, Math.max(1, rawSize)) : exports.DEFAULT_PAGE_SIZE;
    const locationId = src.locationId === null || src.locationId === undefined || String(src.locationId) === ''
        ? null
        : String(src.locationId);
    return { locationId, keyword, bucket, sort, page, pageSize };
}
/** 排序（返回新数组，不改入参）：同值按 variantId 升序保证稳定 */
function sortStockRows(rows, sort) {
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };
    const arr = [...rows];
    arr.sort((a, b) => {
        switch (sort) {
            case 'stockDesc':
                return b.onHand - a.onHand || num(a.variantId) - num(b.variantId);
            case 'gapDesc':
                return (b.safetyStock - b.onHand) - (a.safetyStock - a.onHand) || num(a.variantId) - num(b.variantId);
            case 'valueDesc':
                return b.value - a.value || num(a.variantId) - num(b.variantId);
            case 'stockAsc':
            default:
                return a.onHand - b.onHand || num(a.variantId) - num(b.variantId);
        }
    });
    return arr;
}
/** 汇总：对「已应用 location+keyword、未应用 bucket」的行集计算；outCount+lowCount+okCount = skuCount */
function summarizeStock(rows, outbound7d) {
    let onHandTotal = 0;
    let allocatedTotal = 0;
    let availableTotal = 0;
    let valueTotal = 0;
    let outCount = 0;
    let lowCount = 0;
    let okCount = 0;
    for (const r of rows) {
        onHandTotal += r.onHand;
        allocatedTotal += r.allocated;
        availableTotal += r.available;
        valueTotal += r.value;
        if (r.bucket === 'out') {
            outCount++;
        }
        else if (r.bucket === 'low') {
            lowCount++;
        }
        else {
            okCount++;
        }
    }
    const out7 = Math.trunc(Number(outbound7d));
    return {
        skuCount: rows.length,
        onHandTotal,
        allocatedTotal,
        availableTotal,
        valueTotal,
        outCount,
        lowCount,
        okCount,
        outbound7d: Number.isFinite(out7) && out7 > 0 ? out7 : 0,
    };
}
//# sourceMappingURL=stock-page-math.js.map