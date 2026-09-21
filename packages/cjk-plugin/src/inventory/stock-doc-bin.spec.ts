import { describe, expect, it, vi } from 'vitest';

// 与 stock-doc.service.spec.ts 同因：vitest/esbuild 不生成 design:type 元数据，
// 直接 import 真实 entity 会触发 ColumnTypeUndefinedError，故用假实体替换。
const h = vi.hoisted(() => {
    class MockEntity {
        id?: number;
    }
    return { MockEntity };
});

vi.mock('./stock-doc.entity', () => ({ StockDocEntity: h.MockEntity }));
vi.mock('./stock-doc-item.entity', () => ({ StockDocItemEntity: h.MockEntity }));
vi.mock('../storage/storage-bin.entity', () => ({ StorageBin: h.MockEntity }));
vi.mock('../storage/storage-zone.entity', () => ({ StorageZone: h.MockEntity }));
vi.mock('../storage/variant-storage-bin.entity', () => ({ VariantStorageBin: h.MockEntity }));

import { StockDocService } from './stock-doc.service';

function makeService(bins: any) {
    const repo = { findOne: async () => undefined, save: async (e: any) => ({ ...e, id: 1 }) };
    const conn = { withTransaction: async (_c: any, fn: any) => fn(_c), getRepository: () => repo };
    const physical = { adjustPhysicalStock: async () => undefined, setPhysicalStock: async () => 0 };
    const mode = { assertSimple: () => undefined };
    return new StockDocService(conn as any, physical as any, mode as any, bins);
}

const ctx = { channel: { code: 't1' }, activeUserId: 'u1' } as any;

describe('入库库位归位', () => {
    it('不传 binId / zoneId 时不触发任何绑定（向后兼容）', async () => {
        const bind = vi.fn();
        const svc = makeService({ bind, binZoneId: async () => 11 });
        await svc.create(ctx, {
            type: 'PURCHASE',
            items: [{ variantId: 7, toStockLocationId: 2, qty: 3 }],
        });
        expect(bind).not.toHaveBeenCalled();
    });

    it('只传 binId 时由库位反查库区后调用 bind', async () => {
        let bound: any = null;
        const binZoneId = vi.fn().mockResolvedValue(11);
        const svc = makeService({
            bind: async (_c: any, input: any) => {
                bound = input;
                return input;
            },
            binZoneId,
        });
        await svc.create(ctx, {
            type: 'PURCHASE',
            items: [{ variantId: 7, toStockLocationId: 2, qty: 3, binId: 5 }],
        });
        expect(binZoneId).toHaveBeenCalledWith(ctx, 5);
        expect(bound).toEqual({ variantId: 7, stockLocationId: 2, zoneId: 11, binId: 5 });
    });

    it('zone 档只传 zoneId 时直接归位到库区', async () => {
        let bound: any = null;
        const svc = makeService({
            bind: async (_c: any, input: any) => {
                bound = input;
                return input;
            },
            binZoneId: async () => null,
        });
        await svc.create(ctx, {
            type: 'PURCHASE',
            items: [{ variantId: 7, toStockLocationId: 2, qty: 3, zoneId: 11 }],
        });
        expect(bound).toEqual({ variantId: 7, stockLocationId: 2, zoneId: 11, binId: null });
    });

    it('归位未指定目标仓时给出明确原因', async () => {
        const svc = makeService({ bind: async () => ({}), binZoneId: async () => 11 });
        await expect(
            svc.create(ctx, {
                type: 'ISSUE',
                items: [{ variantId: 7, fromStockLocationId: 2, qty: 1, binId: 5 }],
            }),
        ).rejects.toThrow('库位归位需指定目标仓');
    });
});