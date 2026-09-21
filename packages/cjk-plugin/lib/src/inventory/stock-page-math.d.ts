/**
 * 库存明细页的纯函数层（无 IO、可单测）：分桶 / 查询归一 / 排序 / 汇总。
 * 分桶与排序一律在**服务端**完成（前端不重复实现 bucketOf，见规格 §3.3）。
 */
export type StockBucket = 'out' | 'low' | 'ok';
export type StockSort = 'stockAsc' | 'stockDesc' | 'gapDesc' | 'valueDesc';
export declare const STOCK_BUCKETS: StockBucket[];
export declare const STOCK_SORTS: StockSort[];
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
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
export declare function bucketOf(onHand: number, safetyStock: number): StockBucket;
/** 入参归一：非法 sort/bucket 回退默认，不抛异常；page/pageSize 夹取安全区间 */
export declare function normalizeStockQuery(input?: any): NormalizedStockQuery;
/** 排序（返回新数组，不改入参）：同值按 variantId 升序保证稳定 */
export declare function sortStockRows<T extends StockRowCore>(rows: T[], sort: StockSort): T[];
/** 汇总：对「已应用 location+keyword、未应用 bucket」的行集计算；outCount+lowCount+okCount = skuCount */
export declare function summarizeStock(rows: StockRowCore[], outbound7d: number): StockSummary;
