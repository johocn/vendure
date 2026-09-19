import { describe, expect, it, vi } from 'vitest';
import { StockDocService } from './stock-doc.service';

// 用假实体模块替换真实 entity（其 @Column 装饰器依赖 emitDecoratorMetadata，
// 而 vitest/esbuild 不默认生成 design:type 元数据，间接导入会导致 ColumnTypeUndefinedError）。
const h = vi.hoisted(() => {
    class MockStockDocEntity {
        id?: number;
        code?: string;
    }
    class MockStockDocItemEntity {
        id?: number;
    }
    return { MockStockDocEntity, MockStockDocItemEntity };
});

vi.mock('./stock-doc.entity', () => ({ StockDocEntity: h.MockStockDocEntity }));
vi.mock('./stock-doc-item.entity', () => ({ StockDocItemEntity: h.MockStockDocItemEntity }));

function makeCtx() {
    return {
        channel: { code: 't1', customFields: { inventoryMode: 'simple' } },
        activeUserId: 'u1',
    } as any;
}

/**
 * 用与 real VirtualPhysicalStockService 一致的语义做假实现：
 * - adjustPhysicalStock: 负 delta 当物理仓 onHand 不足抛「物理库存不足」
 * - setPhysicalStock: 覆盖为绝对值 target，返回差值
 * 借此在单据引擎层验证三条行为，而不依赖真实 DB。
 */
function makeService(ctx: any) {
    let seq = 0;
    const repo = {
        findOne: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockImplementation(async (e: any) => {
            if (e.id == null) e.id = ++seq;
            return e;
        }),
    };
    const conn = {
        withTransaction: vi.fn(async (_c: any, fn: any) => fn(_c)),
        getRepository: vi.fn().mockReturnValue(repo),
    };
    const physicalStock = new Map<string, number>();
    const key = (vid: any, loc: any) => `${vid}:${loc}`;
    const adjustPhysicalStock = vi.fn().mockImplementation(
        async (_c: any, variantId: any, locationId: any, delta: number) => {
            const k = key(variantId, locationId);
            const current = physicalStock.get(k) ?? 0;
            if (delta < 0 && current + delta < 0) {
                throw new Error(`物理库存不足：variant=${variantId} 仓库=${locationId} 需${-delta} 现有${current}`);
            }
            physicalStock.set(k, current + delta);
        },
    );
    const setPhysicalStock = vi.fn().mockImplementation(
        async (_c: any, variantId: any, locationId: any, target: number) => {
            const k = key(variantId, locationId);
            const current = physicalStock.get(k) ?? 0;
            const diff = target - current;
            physicalStock.set(k, target);
            return diff;
        },
    );
    const stockLedgerService = { list: vi.fn() };
    const inventoryModeService = { assertSimple: vi.fn(), currentMode: vi.fn().mockReturnValue('simple') } as any;
    const svc = new StockDocService(
        conn as any,
        { adjustPhysicalStock, setPhysicalStock } as any,
        stockLedgerService as any,
        inventoryModeService,
    );
    return { svc, physicalStock, key };
}

describe('StockDocService.create 单据引擎行为', () => {
    it('PURCHASE 加入物理仓库存', async () => {
        const ctx = makeCtx();
        const { svc, physicalStock, key } = makeService(ctx);
        await svc.create(ctx, {
            type: 'PURCHASE',
            items: [{ variantId: 1, toStockLocationId: 2, qty: 5, costPrice: 1000 }],
        });
        expect(physicalStock.get(key(1, 2))).toBe(5);
    });

    it('STOCKTAKE 覆盖为 realQty', async () => {
        const ctx = makeCtx();
        const { svc, physicalStock, key } = makeService(ctx);
        await svc.create(ctx, {
            type: 'PURCHASE',
            items: [{ variantId: 1, toStockLocationId: 2, qty: 5 }],
        });
        await svc.create(ctx, {
            type: 'STOCKTAKE',
            items: [{ variantId: 1, toStockLocationId: 2, qty: 0, realQty: 3 }],
        });
        expect(physicalStock.get(key(1, 2))).toBe(3);
    });

    it('TRANSFER 源仓不足抛错', async () => {
        const ctx = makeCtx();
        const { svc } = makeService(ctx);
        await expect(
            svc.create(ctx, {
                type: 'TRANSFER',
                items: [{ variantId: 1, fromStockLocationId: 2, toStockLocationId: 3, qty: 9999000 }],
            }),
        ).rejects.toThrow(/物理库存不足/);
    });
});