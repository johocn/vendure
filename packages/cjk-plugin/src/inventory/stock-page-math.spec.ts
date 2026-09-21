import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    bucketOf,
    normalizeStockQuery,
    sortStockRows,
    summarizeStock,
    type StockRowCore,
} from './stock-page-math';

function row(p: Partial<StockRowCore> & { variantId: string }): StockRowCore {
    return {
        productId: null, variantName: 'n', sku: 's', optionText: '', thumbnail: '',
        stockLocationId: null, locationName: null,
        onHand: 0, allocated: 0, available: 0, safetyStock: 10, value: 0, costPrice: null,
        bucket: 'ok', lastMovementAt: null, lastDirection: null, lastBizType: null,
        ...p,
    };
}

describe('bucketOf', () => {
    it('现存 <= 0 → out（即使安全库存为 0）', () => {
        expect(bucketOf(0, 10)).toBe('out');
        expect(bucketOf(-2, 0)).toBe('out');
    });
    it('现存 < 安全库存 → low', () => {
        expect(bucketOf(6, 10)).toBe('low');
    });
    it('现存 >= 安全库存 → ok（安全库存为 0 时非零点恒 ok）', () => {
        expect(bucketOf(10, 10)).toBe('ok');
        expect(bucketOf(1, 0)).toBe('ok');
    });
});

describe('normalizeStockQuery', () => {
    it('空入参 → 默认值', () => {
        const q = normalizeStockQuery(null);
        expect(q).toEqual({ locationId: null, keyword: '', bucket: '', sort: 'stockAsc', page: 1, pageSize: DEFAULT_PAGE_SIZE });
    });
    it('非法 sort/bucket 回退默认（不抛异常）', () => {
        const q = normalizeStockQuery({ sort: 'bogus', bucket: 'weird' });
        expect(q.sort).toBe('stockAsc');
        expect(q.bucket).toBe('');
    });
    it('page 下限 1、pageSize 夹在 1..MAX', () => {
        expect(normalizeStockQuery({ page: 0 }).page).toBe(1);
        expect(normalizeStockQuery({ page: -5 }).page).toBe(1);
        expect(normalizeStockQuery({ pageSize: 0 }).pageSize).toBe(1);
        expect(normalizeStockQuery({ pageSize: 9999 }).pageSize).toBe(MAX_PAGE_SIZE);
    });
    it('keyword 去首尾空格；locationId 空串视为 null', () => {
        expect(normalizeStockQuery({ keyword: '  奶粉  ' }).keyword).toBe('奶粉');
        expect(normalizeStockQuery({ locationId: '' }).locationId).toBe(null);
        expect(normalizeStockQuery({ locationId: '3' }).locationId).toBe('3');
    });
});

describe('sortStockRows', () => {
    const rows = [
        row({ variantId: '3', onHand: 10, safetyStock: 20, value: 500 }),
        row({ variantId: '1', onHand: 0, safetyStock: 10, value: 0 }),
        row({ variantId: '2', onHand: 6, safetyStock: 30, value: 900 }),
    ];
    it('stockAsc：现存升序，同值按 variantId 稳定升序', () => {
        expect(sortStockRows(rows, 'stockAsc').map(r => r.variantId)).toEqual(['1', '2', '3']);
    });
    it('stockDesc：现存降序', () => {
        expect(sortStockRows(rows, 'stockDesc').map(r => r.variantId)).toEqual(['3', '2', '1']);
    });
    it('gapDesc：缺口（安全库存-现存）降序，同值按 variantId 稳定升序', () => {
        expect(sortStockRows(rows, 'gapDesc').map(r => r.variantId)).toEqual(['2', '1', '3']);
    });
    it('valueDesc：货值降序', () => {
        expect(sortStockRows(rows, 'valueDesc').map(r => r.variantId)).toEqual(['2', '3', '1']);
    });
    it('不修改入参数组（返回新数组）', () => {
        const before = rows.map(r => r.variantId);
        sortStockRows(rows, 'valueDesc');
        expect(rows.map(r => r.variantId)).toEqual(before);
    });
});

describe('summarizeStock', () => {
    it('汇总口径与分桶计数，bucket 之和 = 行数', () => {
        const rows = [
            row({ variantId: '1', onHand: 0, allocated: 0, available: 0, value: 0, bucket: 'out' }),
            row({ variantId: '2', onHand: 6, allocated: 2, available: 4, value: 1140, bucket: 'low' }),
            row({ variantId: '3', onHand: 86, allocated: 12, available: 74, value: 12900, bucket: 'ok' }),
        ];
        const s = summarizeStock(rows, 1208);
        expect(s).toEqual({
            skuCount: 3, onHandTotal: 92, allocatedTotal: 14, availableTotal: 78,
            valueTotal: 14040, outCount: 1, lowCount: 1, okCount: 1, outbound7d: 1208,
        });
        expect(s.outCount + s.lowCount + s.okCount).toBe(s.skuCount);
    });
    it('outbound7d 非法值规整为 0，空行集全为 0', () => {
        expect(summarizeStock([], Number.NaN).outbound7d).toBe(0);
        expect(summarizeStock([], -9)).toEqual({
            skuCount: 0, onHandTotal: 0, allocatedTotal: 0, availableTotal: 0,
            valueTotal: 0, outCount: 0, lowCount: 0, okCount: 0, outbound7d: 0,
        });
    });
});