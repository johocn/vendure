import { Injectable } from '@nestjs/common';
import { Logger, Order, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { campusDayKey, campusHour, startOfCampusDay } from './campus-time';

/** P4-1-1 销售侧经营 BI：今日/近 7 日/近 30 日三档窗口。 */
export type SalesRange = 'today' | '7d' | '30d';

const RANGE_MS: Record<Exclude<SalesRange, 'today'>, number> = {
    '7d': 7 * 24 * 3600_000,
    '30d': 30 * 24 * 3600_000,
};

/** 不计入销售的订单状态：草稿/未支付/已取消（只有已付款且未取消的单才算销售）。 */
const NON_SALES_STATES = ['Draft', 'AddingItems', 'ArrangingPayment', 'Cancelled'];

export interface SalesOrderLineLike {
    quantity: number;
    linePriceWithTax?: number | null;
    productVariant?: {
        id: unknown;
        name?: string | null;
        product?: { id: unknown; name?: string | null } | null;
    } | null;
}

export interface SalesOrderLike {
    id: unknown;
    code: string;
    state: string;
    createdAt: Date | string;
    totalWithTax: number;
    customer?: { id: unknown } | null;
    customFields?: { errandKind?: string | null } | null;
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

export function normalizeSalesRange(v?: string | null): SalesRange {
    return v === 'today' || v === '30d' ? v : '7d';
}

/** 本窗口起点：today=校园时区 0 点；7d/30d=滚动窗口。 */
export function salesWindowStart(range: SalesRange, now: number): number {
    if (range === 'today') {
        return startOfCampusDay(now);
    }
    return now - RANGE_MS[range];
}

/** 上一窗口：7d/30d=紧邻等长窗口；today=昨日同时长窗口（昨日 0 点 → 昨日同刻）。 */
export function salesPrevWindow(range: SalesRange, windowStart: number, now: number): { prevStart: number; prevEnd: number } {
    if (range === 'today') {
        const prevStart = windowStart - 24 * 3600_000;
        return { prevStart, prevEnd: prevStart + (now - windowStart) };
    }
    return { prevStart: windowStart - RANGE_MS[range], prevEnd: windowStart };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 中位数（偶数取中间两数均值）；空集合返回 0。 */
export function medianOf(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 环比百分比：上期为 0 时返回 0（不做无穷大）。 */
function pctOf(cur: number, prev: number): number {
    if (!prev) return 0;
    return round1(((cur - prev) / prev) * 100);
}

/** 有效销售单：已付款未取消 + 排除跑腿单（跑腿无商品，会污染菜品四象限与客单价）。 */
function isSalesOrder(o: SalesOrderLike): boolean {
    if (NON_SALES_STATES.includes(o.state)) return false;
    if (o.customFields?.errandKind) return false;
    return true;
}

function kpisOf(orders: SalesOrderLike[], firstOrderAt: Map<number, number>, windowStart: number): SalesKpis {
    const gmvFen = orders.reduce((s, o) => s + (o.totalWithTax ?? 0), 0);
    const custSet = new Set<number>();
    const orderCount = new Map<number, number>();
    for (const o of orders) {
        const cid = o.customer?.id != null ? Number(o.customer.id) : NaN;
        if (!Number.isFinite(cid)) continue;
        custSet.add(cid);
        orderCount.set(cid, (orderCount.get(cid) ?? 0) + 1);
    }
    let newCustomers = 0;
    for (const cid of custSet) {
        const first = firstOrderAt.get(cid);
        if (first != null && first >= windowStart) newCustomers++;
    }
    let repeaters = 0;
    for (const n of orderCount.values()) if (n >= 2) repeaters++;
    return {
        orders: orders.length,
        gmvFen,
        aovFen: orders.length ? Math.round(gmvFen / orders.length) : 0,
        customers: custSet.size,
        newCustomers,
        repurchaseRate: custSet.size ? round1((repeaters / custSet.size) * 100) : 0,
    };
}

/** 纯函数聚合（单测注入时间/数据）。
 * 口径：销售单=已付款未取消且非跑腿；GMV=订单 totalWithTax 汇总；
 * 四象限按「销量中位数 × 销售额中位数」分档（>= 中位为高）；新客=本窗口内首单。 */
export function aggregateSalesStats(args: {
    orders: SalesOrderLike[];
    firstOrderAt: Map<number, number>;
    windowStart: number;
    prevStart: number;
    prevEnd: number;
    now: number;
    range: SalesRange;
}): SalesStatsPayload {
    const { orders: raw, firstOrderAt, windowStart, prevStart, prevEnd, now, range } = args;

    const curOrders = raw.filter(o => isSalesOrder(o) && new Date(o.createdAt).getTime() >= windowStart);
    const prevOrders = raw.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return isSalesOrder(o) && t >= prevStart && t < prevEnd;
    });

    const kpis = kpisOf(curOrders, firstOrderAt, windowStart);
    const prev = kpisOf(prevOrders, firstOrderAt, prevStart);

    // 时段热力：24 小时（今日只到当前小时，未来小时给 0）
    const hours: SalesHourPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, gmvFen: 0 }));
    for (const o of curOrders) {
        const h = campusHour(new Date(o.createdAt).getTime());
        hours[h].orders++;
        hours[h].gmvFen += o.totalWithTax ?? 0;
    }

    // 日趋势：7d/30d 按自然日；today 用时段热力即可，返回空数组
    const dailyTrend: SalesDayPoint[] = [];
    if (range !== 'today') {
        const dayCount = range === '7d' ? 7 : 30;
        const map = new Map<string, { orders: number; gmvFen: number }>();
        for (const o of curOrders) {
            const key = campusDayKey(new Date(o.createdAt).getTime());
            const b = map.get(key) ?? { orders: 0, gmvFen: 0 };
            b.orders++;
            b.gmvFen += o.totalWithTax ?? 0;
            map.set(key, b);
        }
        const today0 = startOfCampusDay(now);
        for (let i = dayCount - 1; i >= 0; i--) {
            const key = campusDayKey(today0 - i * 24 * 3600_000);
            const b = map.get(key);
            dailyTrend.push({ date: key.slice(5), orders: b?.orders ?? 0, gmvFen: b?.gmvFen ?? 0 });
        }
    }

    // 菜品聚合（按商品，非规格）
    const byProduct = new Map<string, { name: string; quantity: number; gmvFen: number }>();
    for (const o of curOrders) {
        for (const line of o.lines ?? []) {
            const product = line.productVariant?.product;
            if (!product) continue;
            const pid = String(product.id);
            const b = byProduct.get(pid) ?? { name: product.name ?? `#${pid}`, quantity: 0, gmvFen: 0 };
            b.quantity += line.quantity ?? 0;
            b.gmvFen += line.linePriceWithTax ?? 0;
            byProduct.set(pid, b);
        }
    }
    const productList = [...byProduct.entries()].map(([productId, b]) => ({ productId, ...b }));
    const medianQuantity = medianOf(productList.map(p => p.quantity));
    const medianGmvFen = medianOf(productList.map(p => p.gmvFen));
    const products: SalesProductRow[] = productList
        .map(p => ({
            ...p,
            quadrant: (p.quantity >= medianQuantity
                ? p.gmvFen >= medianGmvFen ? 'star' : 'traffic'
                : p.gmvFen >= medianGmvFen ? 'premium' : 'slow') as SalesQuadrant,
        }))
        .sort((a, b) => b.gmvFen - a.gmvFen || b.quantity - a.quantity)
        .slice(0, 50);

    // 复购分群：窗口内下单次数 1 / 2-4 / 5+
    const orderCount = new Map<number, number>();
    for (const o of curOrders) {
        const cid = o.customer?.id != null ? Number(o.customer.id) : NaN;
        if (!Number.isFinite(cid)) continue;
        orderCount.set(cid, (orderCount.get(cid) ?? 0) + 1);
    }
    const cohorts: SalesCohorts = { once: 0, twiceToFour: 0, loyal: 0 };
    for (const n of orderCount.values()) {
        if (n === 1) cohorts.once++;
        else if (n <= 4) cohorts.twiceToFour++;
        else cohorts.loyal++;
    }

    return {
        range,
        windowStart: new Date(windowStart),
        kpis,
        prev,
        compare: {
            ordersPct: pctOf(kpis.orders, prev.orders),
            gmvPct: pctOf(kpis.gmvFen, prev.gmvFen),
            aovPct: pctOf(kpis.aovFen, prev.aovFen),
            repurchaseRatePct: pctOf(kpis.repurchaseRate, prev.repurchaseRate),
        },
        hourlyHeat: hours,
        dailyTrend,
        products,
        cohorts,
        medianQuantity,
        medianGmvFen,
    };
}

@Injectable()
export class SalesStatsService {
    constructor(private connection: TransactionalConnection) {}

    async stats(ctx: RequestContext, rangeInput?: string | null): Promise<SalesStatsPayload> {
        const range = normalizeSalesRange(rangeInput);
        const now = Date.now();
        const windowStart = salesWindowStart(range, now);
        const { prevStart, prevEnd } = salesPrevWindow(range, windowStart, now);
        const from = Math.min(prevStart, windowStart);

        // 租户隔离：平台超管看全部；店铺级只看本渠道（与 campusDeliveryStats 一致）
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.lines', 'line')
            .leftJoinAndSelect('line.productVariant', 'variant')
            .leftJoinAndSelect('variant.product', 'product')
            .where('order.createdAt >= :from', { from: new Date(from) })
            .andWhere('order.state NOT IN (:...states)', { states: NON_SALES_STATES })
            .andWhere('(order.customFields.errandKind IS NULL)');
        if (!ctx.userHasPermissions([Permission.SuperAdmin])) {
            qb.andWhere('channel.id = :ch', { ch: ctx.channelId as any });
        }
        const orders = (await qb.getMany()) as unknown as SalesOrderLike[];

        // 新客判定需要客户历史首单时间：只对窗口内出现过的客户回查一次
        const curCustomerIds = [
            ...new Set(
                orders
                    .filter(o => new Date(o.createdAt).getTime() >= windowStart)
                    .map(o => (o.customer?.id != null ? Number(o.customer.id) : NaN))
                    .filter(Number.isFinite),
            ),
        ];
        const firstOrderAt = await this.firstOrderAt(ctx, curCustomerIds);

        Logger.debug(
            `campusSalesStats ${range}: ${orders.length} orders, ${curCustomerIds.length} customers (channel ${ctx.channelId})`,
        );

        return aggregateSalesStats({ orders, firstOrderAt, windowStart, prevStart, prevEnd, now, range });
    }

    /** 客户全历史首单时间（分 → 用于新客判定）。空集合直接返回。 */
    private async firstOrderAt(ctx: RequestContext, customerIds: number[]): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (!customerIds.length) return map;
        const rows = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .select('order.customerId', 'customerId')
            .addSelect('MIN(order.createdAt)', 'firstAt')
            .where('order.customerId IN (:...ids)', { ids: customerIds })
            .andWhere('order.state NOT IN (:...states)', { states: NON_SALES_STATES })
            .groupBy('order.customerId')
            .getRawMany<{ customerId: number | string; firstAt: Date | string }>();
        for (const r of rows) {
            map.set(Number(r.customerId), new Date(r.firstAt).getTime());
        }
        return map;
    }
}
