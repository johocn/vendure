/**
 * 库存明细页的纯函数层（无 IO、可单测）：分桶 / 查询归一 / 排序 / 汇总。
 * 分桶与排序一律在**服务端**完成（前端不重复实现 bucketOf，见规格 §3.3）。
 */

export type StockBucket = 'out' | 'low' | 'ok';
export type StockSort = 'stockAsc' | 'stockDesc' | 'gapDesc' | 'valueDesc';

export const STOCK_BUCKETS: StockBucket[] = ['out', 'low', 'ok'];
export const STOCK_SORTS: StockSort[] = ['stockAsc', 'stockDesc', 'gapDesc', 'valueDesc'];
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** 单行库存明细（与 GraphQL InventoryStockRow 一一对应，字段名不得改） */
export interface StockRowCore {
    variantId: string;
    productId: string | null;
    variantName: string;
    sku: string;
    optionText: string;
    thumbnail: string;
    stockLocationId: string | null;
    locationName: string | null;
    onHand: number;
    allocated: number;
    available: number;
    safetyStock: number;
    value: number;
    costPrice: number | null;
    bucket: StockBucket;
    lastMovementAt: string | null;
    lastDirection: string | null;
    lastBizType: string | null;
}

export interface NormalizedStockQuery {
    locationId: string | null;
    keyword: string;
    bucket: StockBucket | '';
    sort: StockSort;
    page: number;
    pageSize: number;
}

export interface StockSummary {
    skuCount: number;
    onHandTotal: number;
    allocatedTotal: number;
    availableTotal: number;
    valueTotal: number;
    outCount: number;
    lowCount: number;
    okCount: number;
    outbound7d: number;
}

/** 分桶：现存 <= 0 → 缺货；现存 < 安全库存 → 低库存；否则正常 */
export function bucketOf(onHand: number, safetyStock: number): StockBucket {
    if (onHand <= 0) {
        return 'out';
    }
    if (onHand < safetyStock) {
        return 'low';
    }
    return 'ok';
}

/** 入参归一：非法 sort/bucket 回退默认，不抛异常；page/pageSize 夹取安全区间 */
export function normalizeStockQuery(input?: any): NormalizedStockQuery {
    const src = input ?? {};
    const keyword = String(src.keyword ?? '').trim();
    const bucket: StockBucket | '' = STOCK_BUCKETS.includes(src.bucket) ? (src.bucket as StockBucket) : '';
    const sort: StockSort = STOCK_SORTS.includes(src.sort) ? (src.sort as StockSort) : 'stockAsc';
    const rawPage = Math.trunc(Number(src.page ?? 1));
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Math.trunc(Number(src.pageSize ?? DEFAULT_PAGE_SIZE));
    const pageSize = Number.isFinite(rawSize) ? Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize)) : DEFAULT_PAGE_SIZE;
    const locationId = src.locationId === null || src.locationId === undefined || String(src.locationId) === ''
        ? null
        : String(src.locationId);
    return { locationId, keyword, bucket, sort, page, pageSize };
}

/** 排序（返回新数组，不改入参）：同值按 variantId 升序保证稳定 */
export function sortStockRows<T extends StockRowCore>(rows: T[], sort: StockSort): T[] {
    const num = (v: string | null | undefined): number => {
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
export function summarizeStock(rows: StockRowCore[], outbound7d: number): StockSummary {
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
        } else if (r.bucket === 'low') {
            lowCount++;
        } else {
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