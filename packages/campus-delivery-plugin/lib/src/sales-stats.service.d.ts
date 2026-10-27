import { RequestContext, TransactionalConnection } from '@vendure/core';
/** P4-1-1 销售侧经营 BI：今日/近 7 日/近 30 日三档窗口。 */
export type SalesRange = 'today' | '7d' | '30d';
export interface SalesOrderLineLike {
    quantity: number;
    linePriceWithTax?: number | null;
    productVariant?: {
        id: unknown;
        name?: string | null;
        product?: {
            id: unknown;
            name?: string | null;
        } | null;
    } | null;
}
export interface SalesOrderLike {
    id: unknown;
    code: string;
    state: string;
    createdAt: Date | string;
    totalWithTax: number;
    customer?: {
        id: unknown;
    } | null;
    customFields?: {
        errandKind?: string | null;
    } | null;
    lines?: SalesOrderLineLike[] | null;
}
export interface SalesKpis {
    /** 有效单量（已付款未取消，排除跑腿单） */
    orders: number;
    /** 商品销售额（分），订单 totalWithTax 汇总 */
    gmvFen: number;
    /** 客单价（分） */
    aovFen: number;
    /** 下单客户数（去重，游客单不计） */
    customers: number;
    /** 新客数（本窗口内首次下单） */
    newCustomers: number;
    /** 复购率（≥2 单客户 / 下单客户，百分数） */
    repurchaseRate: number;
}
export interface SalesCompare {
    ordersPct: number;
    gmvPct: number;
    aovPct: number;
    repurchaseRatePct: number;
}
export interface SalesHourPoint {
    hour: number;
    orders: number;
    gmvFen: number;
}
export interface SalesDayPoint {
    date: string;
    orders: number;
    gmvFen: number;
}
export type SalesQuadrant = 'star' | 'traffic' | 'premium' | 'slow';
export interface SalesProductRow {
    productId: string;
    name: string;
    quantity: number;
    gmvFen: number;
    quadrant: SalesQuadrant;
}
export interface SalesCohorts {
    once: number;
    twiceToFour: number;
    loyal: number;
}
export interface SalesStatsPayload {
    range: SalesRange;
    windowStart: Date;
    kpis: SalesKpis;
    prev: SalesKpis;
    compare: SalesCompare;
    hourlyHeat: SalesHourPoint[];
    dailyTrend: SalesDayPoint[];
    products: SalesProductRow[];
    cohorts: SalesCohorts;
    /** 四象限分割线（销量中位数 / 销售额中位数），前端画十字线用 */
    medianQuantity: number;
    medianGmvFen: number;
}
export declare function normalizeSalesRange(v?: string | null): SalesRange;
/** 本窗口起点：today=校园时区今日 0 点；7d/30d=「近 N 个自然日」的 0 点（与日趋势补零区间对齐）。 */
export declare function salesWindowStart(range: SalesRange, now: number): number;
/** 上一窗口：7d/30d=紧邻等长窗口；today=昨日同时长窗口（昨日 0 点 → 昨日同刻）。 */
export declare function salesPrevWindow(range: SalesRange, windowStart: number, now: number): {
    prevStart: number;
    prevEnd: number;
};
/** 中位数（偶数取中间两数均值）；空集合返回 0。 */
export declare function medianOf(values: number[]): number;
/** 纯函数聚合（单测注入时间/数据）。
 * 口径：销售单=已付款未取消且非跑腿；GMV=订单 totalWithTax 汇总；
 * 四象限按「销量中位数 × 销售额中位数」分档（>= 中位为高）；新客=本窗口内首单。 */
export declare function aggregateSalesStats(args: {
    orders: SalesOrderLike[];
    firstOrderAt: Map<number, number>;
    windowStart: number;
    prevStart: number;
    prevEnd: number;
    now: number;
    range: SalesRange;
}): SalesStatsPayload;
export declare class SalesStatsService {
    private connection;
    constructor(connection: TransactionalConnection);
    stats(ctx: RequestContext, rangeInput?: string | null): Promise<SalesStatsPayload>;
    /** 客户全历史首单时间（分 → 用于新客判定）。空集合直接返回。 */
    private firstOrderAt;
}
