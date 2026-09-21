import { describe, expect, it } from 'vitest';

import {
    canTransition,
    formatBatchCode,
    pickRecommendation,
    sortPickingRows,
    type PickingRowInput,
} from './pick-batch-math';

describe('批次状态机', () => {
    it('PENDING 可到 PICKED / CANCELLED', () => {
        expect(canTransition('PENDING', 'PICKED')).toBe(true);
        expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
        expect(canTransition('PENDING', 'SHIPPED')).toBe(false);
    });

    it('终态不可再迁移', () => {
        expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
        expect(canTransition('CANCELLED', 'PICKED')).toBe(false);
    });

    it('可跳过拣货直接标记打印（仓管直接录入）', () => {
        expect(canTransition('PICKED', 'PRINTED')).toBe(true);
        expect(canTransition('PRINTED', 'SHIPPED')).toBe(true);
    });
});

describe('批次号', () => {
    it('格式为 PB + yyyyMMdd + 3 位序号', () => {
        expect(formatBatchCode(new Date('2026-09-22T10:00:00'), 1)).toBe('PB20260922-001');
        expect(formatBatchCode(new Date('2026-09-22T10:00:00'), 37)).toBe('PB20260922-037');
    });
});

describe('就近选仓', () => {
    const base = { id: 1, enabled: true };

    it('有坐标时取命中城市且距离最小者', () => {
        const r = pickRecommendation(
            { city: '杭州市', lat: 30.27, lng: 120.15 },
            [
                { ...base, id: 1, serviceCities: ['杭州市'], lat: 30.28, lng: 120.16 },
                { ...base, id: 2, serviceCities: ['杭州市'], lat: 31.23, lng: 121.47 },
            ],
        );
        expect(r.recommendedStockLocationId).toBe(1);
        expect(r.distanceKm).toBeGreaterThan(0);
    });

    it('无坐标但文本命中城市时返回该仓且距离为 null（不伪造距离）', () => {
        const r = pickRecommendation(
            { city: '杭州市', lat: null, lng: null },
            [{ ...base, id: 3, serviceCities: ['杭州市'], lat: null, lng: null }],
        );
        expect(r.recommendedStockLocationId).toBe(3);
        expect(r.distanceKm).toBeNull();
    });

    it('都不命中时返回 null，交给前端提示手动选仓', () => {
        const r = pickRecommendation(
            { city: '拉萨市', lat: null, lng: null },
            [{ ...base, id: 4, serviceCities: ['杭州市'], lat: null, lng: null }],
        );
        expect(r.recommendedStockLocationId).toBeNull();
        expect(r.distanceKm).toBeNull();
    });
});

describe('拣货汇总与库位排序', () => {
    const rows: PickingRowInput[] = [
        // 无库位绑定 → 置底
        { sku: 'SKU-C', name: '无库位商品', qty: 1, orderCodes: ['SO-3'], zoneSortOrder: null, rowNo: null, levelNo: null, binCode: null, zoneCode: null, zoneName: null },
        // B 区
        { sku: 'SKU-B', name: '酸奶', qty: 3, orderCodes: ['SO-2'], zoneSortOrder: 2, rowNo: 1, levelNo: 2, binCode: 'B-01-02', zoneCode: 'B', zoneName: '冷藏区' },
        // A 区货架 2
        { sku: 'SKU-A2', name: '抽纸', qty: 2, orderCodes: ['SO-1'], zoneSortOrder: 1, rowNo: 2, levelNo: 1, binCode: 'A-02-01', zoneCode: 'A', zoneName: '常温存储区' },
        // A 区货架 1
        { sku: 'SKU-A1', name: '矿泉水', qty: 4, orderCodes: ['SO-1', 'SO-2'], zoneSortOrder: 1, rowNo: 1, levelNo: 3, binCode: 'A-01-03', zoneCode: 'A', zoneName: '常温存储区' },
    ];

    it('按 库区顺序 → 货架 → 层 排序，无库位置底且 pathIndex 最大', () => {
        const out = sortPickingRows(rows);
        expect(out.map((r) => r.sku)).toEqual(['SKU-A1', 'SKU-A2', 'SKU-B', 'SKU-C']);
        expect(out.map((r) => r.pathIndex)).toEqual([1, 2, 3, 9999]);
    });

    it('zone 档（无 bin）时退化为仅按库区顺序，不报错', () => {
        const zoneOnly: PickingRowInput[] = [
            { sku: 'Z-B', name: 'x', qty: 1, orderCodes: [], zoneSortOrder: 2, rowNo: null, levelNo: null, binCode: null, zoneCode: 'B', zoneName: '冷藏区' },
            { sku: 'Z-A', name: 'y', qty: 1, orderCodes: [], zoneSortOrder: 1, rowNo: null, levelNo: null, binCode: null, zoneCode: 'A', zoneName: '常温存储区' },
        ];
        const out = sortPickingRows(zoneOnly);
        expect(out.map((r) => r.sku)).toEqual(['Z-A', 'Z-B']);
        expect(out.map((r) => r.pathIndex)).toEqual([1, 2]);
    });
});