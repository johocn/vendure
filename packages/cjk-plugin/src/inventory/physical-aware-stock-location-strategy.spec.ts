import { describe, expect, it, vi } from 'vitest';
import { MatrixStockLocationStrategy } from '@vendure/logistics-plugin';
import { PhysicalAwareStockLocationStrategy } from './physical-aware-stock-location-strategy';

describe('PhysicalAwareStockLocationStrategy', () => {
    function makeStrategy(overrides: Record<string, any> = {}) {
        const s: any = new PhysicalAwareStockLocationStrategy();
        Object.assign(s, {
            bindingService: { findByVariant: vi.fn().mockResolvedValue([]) },
            connection: { getRepository: vi.fn() },
            requestContextCache: { get: vi.fn((_ctx: any, _k: string, fn: any) => fn()) },
            ...overrides,
        });
        return s;
    }

    it('无绑定变体：候选仓原样交给父类逻辑（纯虚拟）', async () => {
        const s = makeStrategy();
        const parentSpy: any = vi.spyOn(MatrixStockLocationStrategy.prototype as any, 'forAllocation');
        parentSpy.mockResolvedValue(undefined);
        try {
            const result = await s.forAllocation({} as any, [{ id: 'v1' }], { productVariantId: 'p0' }, 3);
            expect(parentSpy).toHaveBeenCalledWith(expect.anything(), [{ id: 'v1' }], { productVariantId: 'p0' }, 3);
            expect(result).toBeUndefined();
        } finally {
            parentSpy.mockRestore();
        }
    });

    it('物理驱动变体：只把绑定物理仓传给父类', async () => {
        const s = makeStrategy({
            bindingService: {
                findByVariant: vi.fn().mockResolvedValue([
                    { variantId: 'p1', locationId: 'l1', isDefault: true },
                    { variantId: 'p1', locationId: 'l2', isDefault: false },
                ]),
            },
            connection: {
                getRepository: vi.fn().mockReturnValue({
                    find: vi.fn().mockResolvedValue([
                        { id: 'l1' }, { id: 'l2' },
                    ]),
                }),
            },
        });
        const parentSpy: any = vi.spyOn(MatrixStockLocationStrategy.prototype as any, 'forAllocation');
        parentSpy.mockImplementation(async (_ctx: any, locs: any[], _line: any, _qty: number) => locs);
        try {
            const result = await s.forAllocation({} as any, [{ id: 'v1' }], { productVariantId: 'p1' }, 3);
            expect(result.map((l: any) => l.id).sort()).toEqual(['l1', 'l2']);
            expect(parentSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Array), { productVariantId: 'p1' }, 3);
        } finally {
            parentSpy.mockRestore();
        }
    });

    it('getAvailableStock：物理驱动只统计虚拟仓', async () => {
        const s = makeStrategy({
            bindingService: {
                findByVariant: vi.fn().mockResolvedValue([{ variantId: 'p1', locationId: 'l1' }]),
            },
            requestContextCache: {
                get: vi.fn((_ctx: any, _k: string, fn: any) => fn()),
            },
        });
        s.locationKindOf = vi.fn(async (_ctx: any, id: string) => (id === 'v1' ? 'virtual' : 'physical'));
        const levels = [
            { stockLocationId: 'v1', stockOnHand: 12, stockAllocated: 0 },
            { stockLocationId: 'l1', stockOnHand: 12, stockAllocated: 0 },
        ];
        const result = await s.getAvailableStock({} as any, 'p1', levels as any);
        expect(result.stockOnHand).toBe(12);
    });
});
