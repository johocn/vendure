import { describe, expect, it } from 'vitest';
import {
    aggregateSalesStats,
    medianOf,
    normalizeSalesRange,
    salesPrevWindow,
    salesWindowStart,
    SalesOrderLike,
} from './sales-stats.service';

const now = new Date('2026-10-27T15:30:00+08:00').getTime();
const hoursAgo = (h: number, base = now) => new Date(base - h * 3600_000);

const line = (quantity: number, priceFen: number, productId: number, productName: string) => ({
    quantity,
    linePriceWithTax: priceFen,
    productVariant: {
        id: productId * 10,
        name: `${productName}-默认`,
        // 线上商品名来自 ProductTranslation（Product.name 为空），这里按真实结构造数据
        product: { id: productId, translations: [{ languageCode: 'zh-Hans', name: productName }] },
    },
});

const order = (args: {
    id: number;
    customerId?: number | null;
    createdAt: Date;
    totalWithTax: number;
    lines?: ReturnType<typeof line>[];
    state?: string;
    errandKind?: string | null;
}): SalesOrderLike => ({
    id: args.id,
    code: `A${args.id}`,
    state: args.state ?? 'Delivered',
    createdAt: args.createdAt,
    totalWithTax: args.totalWithTax,
    customer: args.customerId == null ? null : { id: args.customerId },
    customFields: { errandKind: args.errandKind ?? null },
    lines: args.lines ?? [],
});

const baseArgs = {
    windowStart: salesWindowStart('today', now),
    ...salesPrevWindow('today', salesWindowStart('today', now), now),
    now,
    range: 'today' as const,
};

describe('normalizeSalesRange / 窗口', () => {
    it('非法 range 回退 7d', () => {
        expect(normalizeSalesRange('xx')).toBe('7d');
        expect(normalizeSalesRange(null)).toBe('7d');
        expect(normalizeSalesRange('today')).toBe('today');
        expect(normalizeSalesRange('30d')).toBe('30d');
    });

    it('today 起点为校园时区 0 点', () => {
        expect(salesWindowStart('today', now)).toBe(new Date('2026-10-27T00:00:00+08:00').getTime());
    });

    it('today 上一窗口=昨日 0 点起、等长', () => {
        const ws = salesWindowStart('today', now);
        const { prevStart, prevEnd } = salesPrevWindow('today', ws, now);
        expect(prevStart).toBe(ws - 24 * 3600_000);
        expect(prevEnd - prevStart).toBe(now - ws);
    });

    it('7d 起点对齐到「近 7 个自然日」的 0 点', () => {
        expect(salesWindowStart('7d', now)).toBe(new Date('2026-10-21T00:00:00+08:00').getTime());
        expect(salesWindowStart('30d', now)).toBe(new Date('2026-09-28T00:00:00+08:00').getTime());
    });

    it('7d 上一窗口=紧邻等长', () => {
        const ws = salesWindowStart('7d', now);
        const { prevStart, prevEnd } = salesPrevWindow('7d', ws, now);
        expect(prevEnd).toBe(ws);
        expect(prevStart).toBe(ws - 7 * 24 * 3600_000);
    });
});

describe('medianOf', () => {
    it('奇数取中间、偶数取均值、空集合为 0', () => {
        expect(medianOf([3, 1, 2])).toBe(2);
        expect(medianOf([1, 2, 3, 4])).toBe(2.5);
        expect(medianOf([])).toBe(0);
    });
});

describe('aggregateSalesStats', () => {
    it('KPI：单量/GMV/客单价/客户数/新客/复购率', () => {
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [
                order({ id: 1, customerId: 11, createdAt: hoursAgo(2), totalWithTax: 3000 }),
                order({ id: 2, customerId: 11, createdAt: hoursAgo(1), totalWithTax: 5000 }),
                order({ id: 3, customerId: 12, createdAt: hoursAgo(3), totalWithTax: 2000 }),
            ],
            // 12 是历史老客，11 是今天首次下单
            firstOrderAt: new Map([
                [11, hoursAgo(2).getTime()],
                [12, hoursAgo(240).getTime()],
            ]),
        });
        expect(res.kpis.orders).toBe(3);
        expect(res.kpis.gmvFen).toBe(10000);
        expect(res.kpis.aovFen).toBe(3333);
        expect(res.kpis.customers).toBe(2);
        expect(res.kpis.newCustomers).toBe(1);
        expect(res.kpis.repurchaseRate).toBe(50); // 11 复购 / 2 客户
    });

    it('环比：上一窗口等长数据参与对比，上期为 0 时百分比为 0', () => {
        const ws = baseArgs.windowStart;
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [
                order({ id: 1, customerId: 11, createdAt: hoursAgo(1), totalWithTax: 4000 }),
                order({ id: 2, customerId: 12, createdAt: new Date(ws - 22 * 3600_000), totalWithTax: 2000 }),
            ],
            firstOrderAt: new Map([
                [11, hoursAgo(1).getTime()],
                [12, new Date(ws - 22 * 3600_000).getTime()],
            ]),
        });
        expect(res.kpis.orders).toBe(1);
        expect(res.prev.orders).toBe(1);
        expect(res.compare.ordersPct).toBe(0);
        expect(res.compare.gmvPct).toBe(100); // 4000 → 2000
    });

    it('取消单、未支付单、跑腿单不计销售', () => {
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [
                order({ id: 1, customerId: 11, createdAt: hoursAgo(1), totalWithTax: 3000 }),
                order({ id: 2, customerId: 12, createdAt: hoursAgo(1), totalWithTax: 3000, state: 'Cancelled' }),
                order({ id: 3, customerId: 13, createdAt: hoursAgo(1), totalWithTax: 3000, state: 'ArrangingPayment' }),
                order({ id: 4, customerId: 14, createdAt: hoursAgo(1), totalWithTax: 3000, errandKind: 'buy' }),
            ],
            firstOrderAt: new Map(),
        });
        expect(res.kpis.orders).toBe(1);
        expect(res.kpis.gmvFen).toBe(3000);
    });

    it('复购分群边界：1 单 / 2-4 单 / 5+ 单', () => {
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [
                order({ id: 1, customerId: 1, createdAt: hoursAgo(1), totalWithTax: 1000 }),
                order({ id: 2, customerId: 2, createdAt: hoursAgo(1), totalWithTax: 1000 }),
                order({ id: 3, customerId: 2, createdAt: hoursAgo(2), totalWithTax: 1000 }),
                ...[4, 5, 6, 7, 8].map(id =>
                    order({ id, customerId: 3, createdAt: hoursAgo(1), totalWithTax: 1000 }),
                ),
            ],
            firstOrderAt: new Map(),
        });
        expect(res.cohorts).toEqual({ once: 1, twiceToFour: 1, loyal: 1 });
    });

    it('菜品四象限：按销量中位数 × 销售额中位数分档', () => {
        // 宫保鸡丁 高销高额(star)、米饭 高销低额(traffic)、双人套餐 低销高额(premium)、凉菜 低销低额(slow)
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [
                order({
                    id: 1,
                    customerId: 11,
                    createdAt: hoursAgo(1),
                    totalWithTax: 10000,
                    lines: [line(5, 8000, 101, '宫保鸡丁'), line(5, 1000, 102, '米饭')],
                }),
                order({
                    id: 2,
                    customerId: 12,
                    createdAt: hoursAgo(2),
                    totalWithTax: 3000,
                    lines: [line(1, 2500, 103, '双人套餐'), line(1, 500, 104, '凉菜')],
                }),
            ],
            firstOrderAt: new Map(),
        });
        expect(res.medianQuantity).toBe(3); // [1,1,5,5] → 3
        expect(res.medianGmvFen).toBe(1750); // [500,1000,2500,8000] → (1000+2500)/2
        const q = Object.fromEntries(res.products.map(p => [p.name, p.quadrant]));
        expect(q).toEqual({ 宫保鸡丁: 'star', 米饭: 'traffic', 双人套餐: 'premium', 凉菜: 'slow' });
        expect(res.products[0].name).toBe('宫保鸡丁');
    });

    it('时段热力固定 24 档，金额与单量落到对应小时', () => {
        const res = aggregateSalesStats({
            ...baseArgs,
            orders: [order({ id: 1, customerId: 11, createdAt: new Date('2026-10-27T15:05:00+08:00'), totalWithTax: 3300 })],
            firstOrderAt: new Map(),
        });
        expect(res.hourlyHeat).toHaveLength(24);
        expect(res.hourlyHeat[15]).toEqual({ hour: 15, orders: 1, gmvFen: 3300 });
        expect(res.dailyTrend).toEqual([]);
    });

    it('空数据不报错，全部为 0', () => {
        const res = aggregateSalesStats({ ...baseArgs, orders: [], firstOrderAt: new Map() });
        expect(res.kpis).toEqual({
            orders: 0,
            gmvFen: 0,
            aovFen: 0,
            customers: 0,
            newCustomers: 0,
            repurchaseRate: 0,
        });
        expect(res.cohorts).toEqual({ once: 0, twiceToFour: 0, loyal: 0 });
        expect(res.products).toEqual([]);
    });

    it('7d 日趋势补零到自然日序列', () => {
        const ws = salesWindowStart('7d', now);
        const res = aggregateSalesStats({
            windowStart: ws,
            ...salesPrevWindow('7d', ws, now),
            now,
            range: '7d',
            orders: [order({ id: 1, customerId: 11, createdAt: hoursAgo(2), totalWithTax: 2000 })],
            firstOrderAt: new Map(),
        });
        expect(res.dailyTrend).toHaveLength(7);
        expect(res.dailyTrend[6].orders).toBe(1);
        expect(res.dailyTrend.reduce((s, d) => s + d.orders, 0)).toBe(1);
    });
});
