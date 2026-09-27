import { describe, expect, it, vi } from 'vitest';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

function makeService(overrides: Record<string, any> = {}) {
    const svc: any = new VirtualPhysicalStockService(
        {} as any, { create: vi.fn() } as any, {} as any, {} as any, {} as any, {} as any,
    );
    Object.assign(svc, {
        ensureVirtualLocation: vi.fn().mockResolvedValue({ id: 'v1' }),
        connection: { getRepository: vi.fn() },
        stockLevelService: { getStockLevelsForVariant: vi.fn() },
        inventoryService: { adjustStockPublic: vi.fn().mockResolvedValue(undefined) },
        ...overrides,
    });
    return svc;
}

describe('VirtualPhysicalStockService.syncVirtualMirror', () => {
    it('物理驱动变体按 Σ 绑定仓同步虚拟仓', async () => {
        const svc = makeService({
            stockLevelService: {
                getStockLevelsForVariant: vi.fn().mockResolvedValue([
                    { stockLocationId: 'v1', stockOnHand: 10 },
                    { stockLocationId: 'l1', stockOnHand: 5 },
                    { stockLocationId: 'l2', stockOnHand: 7 },
                ]),
            },
            connection: {
                getRepository: vi.fn().mockReturnValue({
                    find: vi.fn().mockResolvedValue([
                        { variantId: 'p1', locationId: 'l1' },
                        { variantId: 'p1', locationId: 'l2' },
                    ]),
                }),
            },
        });
        const sales: any[] = [
            { productVariantId: 'p1', stockLocationId: 'l1', quantity: 2 },
        ];
        await svc.syncVirtualMirror({ channel: { code: 't1' } } as any, sales);
        // 10 + (12 - 10) = 12
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledWith(
            expect.anything(), 'p1', 'v1', 2, expect.stringContaining('镜像'), expect.objectContaining({ bizType: 'mirror' }),
        );
    });

    it('无绑定变体跳过', async () => {
        const svc = makeService({
            connection: {
                getRepository: vi.fn().mockReturnValue({ find: vi.fn().mockResolvedValue([]) }),
            },
        });
        await svc.syncVirtualMirror({ channel: { code: 't1' } } as any, [{ productVariantId: 'p0', stockLocationId: 'v1', quantity: 1 }] as any);
        expect(svc.inventoryService.adjustStockPublic).not.toHaveBeenCalled();
    });

    it('镜像差额为 0 不写流水', async () => {
        const svc = makeService({
            stockLevelService: {
                getStockLevelsForVariant: vi.fn().mockResolvedValue([
                    { stockLocationId: 'v1', stockOnHand: 12 },
                    { stockLocationId: 'l1', stockOnHand: 12 },
                ]),
            },
            connection: {
                getRepository: vi.fn().mockReturnValue({
                    find: vi.fn().mockResolvedValue([{ variantId: 'p1', locationId: 'l1' }]),
                }),
            },
        });
        await svc.syncVirtualMirror({ channel: { code: 't1' } } as any, [{ productVariantId: 'p1', stockLocationId: 'l1', quantity: 1 }] as any);
        expect(svc.inventoryService.adjustStockPublic).not.toHaveBeenCalled();
    });
});

/**
 * 2026-09-27 口径修正：物理仓写入原语写完即补虚拟镜像；
 * 写入目标本身是虚拟仓时（纯虚拟库存店盘点）必须早退，否则会用 Σ 绑定仓覆盖掉刚写入的账面。
 */
describe('VirtualPhysicalStockService 物理仓写入补镜像', () => {
    /** 按实体名分流 getRepository：StockLocation → 目标仓；其余（绑定表）→ bindings */
    function makeWriteService(opts: {
        targetKind: string;
        currentOnHand?: number;
        bindings?: Array<{ variantId: string; locationId: string }>;
        levels?: Array<{ stockLocationId: string; stockOnHand: number }>;
    }) {
        const locRepo = {
            findOne: vi.fn().mockResolvedValue({ id: 'l1', name: '物理A', customFields: { kind: opts.targetKind } }),
        };
        const bindingRepo = { find: vi.fn().mockResolvedValue(opts.bindings ?? []) };
        const svc = makeService({
            connection: {
                getRepository: vi.fn((_ctx: any, entity: any) =>
                    (entity?.name === 'StockLocation' ? locRepo : bindingRepo)),
            },
            stockLevelService: {
                getStockLevel: vi.fn().mockResolvedValue({ stockOnHand: opts.currentOnHand ?? 0 }),
                getStockLevelsForVariant: vi.fn().mockResolvedValue(opts.levels ?? []),
            },
        });
        return { svc, bindingRepo };
    }

    it('写物理仓后追加一次镜像流水，把虚拟仓拉齐为 Σ 绑定仓', async () => {
        const { svc } = makeWriteService({
            targetKind: 'physical',
            bindings: [{ variantId: 'p1', locationId: 'l1' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 10 }, { stockLocationId: 'l1', stockOnHand: 8 }],
        });
        await svc.adjustPhysicalStock({ channel: { code: 't1' } } as any, 'p1', 'l1', 3, 'purchase-in');
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(2);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenLastCalledWith(
            expect.anything(), 'p1', 'v1', -2, expect.stringContaining('镜像'),
            expect.objectContaining({ bizType: 'mirror' }),
        );
    });

    it('盘点写虚拟仓时早退：只写一次账面，不跑镜像（防 Σ 绑定=0 覆盖账面）', async () => {
        const { svc } = makeWriteService({
            targetKind: 'virtual',
            currentOnHand: 5,
            bindings: [{ variantId: 'p1', locationId: 'l1' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 5 }, { stockLocationId: 'l1', stockOnHand: 0 }],
        });
        const delta = await svc.setPhysicalStock({ channel: { code: 't2' } } as any, 'p1', 'l1', 9, 'STOCKTAKE#TK1');
        expect(delta).toBe(4);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(1);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledWith(
            expect.anything(), 'p1', 'l1', 4, 'STOCKTAKE#TK1', undefined,
        );
    });

    it('无绑定变体：写物理仓不产生镜像流水（差额本就无可拉齐对象）', async () => {
        const { svc } = makeWriteService({ targetKind: 'physical', bindings: [] });
        await svc.adjustPhysicalStock({ channel: { code: 't2' } } as any, 'p0', 'l1', 3, 'purchase-in');
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(1);
    });

    it('syncVirtualMirrorForVariants 对重复 variantId 去重，只查一次绑定表', async () => {
        const { svc, bindingRepo } = makeWriteService({
            targetKind: 'physical',
            bindings: [{ variantId: 'p1', locationId: 'l1' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 0 }, { stockLocationId: 'l1', stockOnHand: 4 }],
        });
        await svc.syncVirtualMirrorForVariants({ channel: { code: 't1' } } as any, ['p1', 'p1', 'p1']);
        expect(bindingRepo.find).toHaveBeenCalledTimes(1);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(1);
    });
});
