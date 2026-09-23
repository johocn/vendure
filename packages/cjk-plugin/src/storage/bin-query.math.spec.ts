import { describe, expect, it } from 'vitest';
import {
    assertZoneBinMatch, buildOccupancyRows, clampPageSize, filterVariantBins,
    matchKeyword, normalizePage, paginate, sortVariantBins, type VariantBinRow,
} from './bin-query.math';

const row = (p: Partial<VariantBinRow>): VariantBinRow => ({
    bindingId: 1, variantId: 11, sku: 'SKU-A', variantName: '甲', barcode: null, internalCode: null,
    zoneId: 1, zoneCode: 'A', zoneName: 'A 区', zoneSortOrder: 1, binId: 101, binCode: 'A-01-01',
    rowNo: 1, levelNo: 1, isDefault: false, ...p,
});

describe('分页与归属校验', () => {
    it('pageSize 默认 50、上限 200、非法值回落默认', () => {
        expect(clampPageSize(undefined)).toBe(50);
        expect(clampPageSize(0)).toBe(50);
        expect(clampPageSize(-3)).toBe(50);
        expect(clampPageSize(10)).toBe(10);
        expect(clampPageSize(9999)).toBe(200);
    });

    it('page 默认 1、非法值回落 1', () => {
        expect(normalizePage(undefined)).toBe(1);
        expect(normalizePage(0)).toBe(1);
        expect(normalizePage(3)).toBe(3);
    });

    it('zoneId + binId 不匹配 → 回传明确原因；匹配或未传 → null', () => {
        expect(assertZoneBinMatch(undefined, undefined, null)).toBeNull();
        expect(assertZoneBinMatch(1, 101, 1)).toBeNull();
        expect(assertZoneBinMatch(1, 201, 2)).toContain('库位');
        expect(assertZoneBinMatch(1, 999, null)).toContain('库位');
    });
});

describe('过滤 / 排序 / 分页', () => {
    const rows = [
        row({ bindingId: 1, variantId: 11, sku: 'SKU-B', zoneId: 1, binId: 102, rowNo: 1, levelNo: 2 }),
        row({ bindingId: 2, variantId: 22, sku: 'SKU-A', zoneId: 1, binId: 101, rowNo: 1, levelNo: 1 }),
        row({ bindingId: 3, variantId: 33, sku: 'SKU-C', zoneId: 2, binId: 201, zoneSortOrder: 2, rowNo: 1, levelNo: 1 }),
    ];

    it('keyword 前缀匹配 sku / barcode / internalCode（大小写不敏感）', () => {
        expect(matchKeyword(row({ sku: 'ABC-1' }), 'abc')).toBe(true);
        expect(matchKeyword(row({ barcode: '690111' }), '690')).toBe(true);
        expect(matchKeyword(row({ internalCode: 'IN-X' }), 'in-')).toBe(true);
        expect(matchKeyword(row({ sku: 'ABC-1' }), 'zzz')).toBe(false);
        expect(matchKeyword(row({ sku: 'ABC-1' }), '')).toBe(true);
    });

    it('过滤：zoneId / binId / keyword 逐级收窄', () => {
        expect(filterVariantBins(rows, { zoneId: 1 }).map((r) => r.bindingId)).toEqual([1, 2]);
        expect(filterVariantBins(rows, { binId: 201 }).map((r) => r.bindingId)).toEqual([3]);
        expect(filterVariantBins(rows, { keyword: 'SKU-A' }).map((r) => r.bindingId)).toEqual([2]);
    });

    it('排序：zone.sortOrder → rowNo → levelNo → sku', () => {
        expect(sortVariantBins(rows).map((r) => r.bindingId)).toEqual([2, 1, 3]);
    });

    it('分页：totalItems 为过滤后总数，items 为当前页', () => {
        const p = paginate(sortVariantBins(rows), 1, 2);
        expect(p.totalItems).toBe(3);
        expect(p.items.map((r) => r.bindingId)).toEqual([2, 1]);
        const p2 = paginate(sortVariantBins(rows), 2, 2);
        expect(p2.items.map((r) => r.bindingId)).toEqual([3]);
    });
});

describe('库位占用概览', () => {
    it('含空格（skuCount=0），并复用同样的排序键', () => {
        const bins = [
            { zoneId: 1, zoneCode: 'A', zoneName: 'A 区', zoneSortOrder: 1, binId: 101, binCode: 'A-01-01', rowNo: 1, levelNo: 1 },
            { zoneId: 1, zoneCode: 'A', zoneName: 'A 区', zoneSortOrder: 1, binId: 102, binCode: 'A-01-02', rowNo: 1, levelNo: 2 },
        ];
        const out = buildOccupancyRows(bins, new Map([[101, 2]]));
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ binId: 101, skuCount: 2 });
        expect(out[1]).toMatchObject({ binId: 102, skuCount: 0 });
    });
});