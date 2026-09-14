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
