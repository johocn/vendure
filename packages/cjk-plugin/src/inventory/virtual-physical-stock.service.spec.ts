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

/**
 * D54：同一单据内多处物理仓写入**合并补镜像**（移库两段不再产出中间态净零流水）。
 * 合并语义与逐段补等价（每次现算 Σ 绑定仓、幂等），只是「写 N 次 → 补 1 次」。
 */
describe('VirtualPhysicalStockService 事务内合并补镜像（D54）', () => {
    /** 按 where.id 动态返回仓性质；绑定表与库存分别注入 */
    function makeMergeService(opts: {
        kinds: Record<string, string>;
        bindings?: Array<{ variantId: string; locationId: string }>;
        levels?: Array<{ stockLocationId: string; stockOnHand: number }>;
    }) {
        const locRepo = {
            findOne: vi.fn(({ where }: any) =>
                Promise.resolve({
                    id: String(where.id),
                    name: `仓${where.id}`,
                    customFields: { kind: opts.kinds[String(where.id)] ?? 'physical' },
                }),
            ),
        };
        const bindingRepo = { find: vi.fn().mockResolvedValue(opts.bindings ?? []) };
        const svc = makeService({
            connection: {
                getRepository: vi.fn((_ctx: any, entity: any) =>
                    (entity?.name === 'StockLocation' ? locRepo : bindingRepo)),
            },
            stockLevelService: {
                getStockLevel: vi.fn().mockResolvedValue({ stockOnHand: 100 }),
                getStockLevelsForVariant: vi.fn().mockResolvedValue(opts.levels ?? []),
            },
        });
        return svc;
    }

    const ctx = { channel: { code: 't1' } } as any;

    it('deferMirror=true 时写入不补镜像（交给调用方统一补）', async () => {
        const svc = makeMergeService({
            kinds: { l1: 'physical' },
            bindings: [{ variantId: 'p1', locationId: 'l1' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 0 }, { stockLocationId: 'l1', stockOnHand: 5 }],
        });
        await svc.adjustPhysicalStock(ctx, 'p1', 'l1', 3, 'source-out', undefined, { deferMirror: true });
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(1);
    });

    it('两段写入后合并补一次：两仓皆绑定时 Σ 不变 → 不产出中间态镜像流水', async () => {
        const svc = makeMergeService({
            kinds: { l1: 'physical', l2: 'physical' },
            bindings: [{ variantId: 'p1', locationId: 'l1' }, { variantId: 'p1', locationId: 'l2' }],
            // 写完后的实际库存：Σ 绑定仓 = 7 + 5 = 12 = 虚拟仓当前值
            levels: [
                { stockLocationId: 'v1', stockOnHand: 12 },
                { stockLocationId: 'l1', stockOnHand: 7 },
                { stockLocationId: 'l2', stockOnHand: 5 },
            ],
        });
        await svc.adjustPhysicalStock(ctx, 'p1', 'l1', -3, 'source-out', undefined, { deferMirror: true });
        await svc.adjustPhysicalStock(ctx, 'p1', 'l2', 3, 'target-in', undefined, { deferMirror: true });
        await svc.syncMirrorAfterWrites(ctx, 'p1', ['l1', 'l2']);
        // 仅 2 次账面写入、0 次镜像（合并后差额为 0）
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(2);
    });

    it('合并补镜像：只要有一个非虚拟仓就补一次（混合仓）', async () => {
        const svc = makeMergeService({
            kinds: { l1: 'virtual', l2: 'physical' },
            bindings: [{ variantId: 'p1', locationId: 'l2' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 0 }, { stockLocationId: 'l2', stockOnHand: 3 }],
        });
        await svc.syncMirrorAfterWrites(ctx, 'p1', ['l1', 'l2']);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenCalledTimes(1);
        expect(svc.inventoryService.adjustStockPublic).toHaveBeenLastCalledWith(
            expect.anything(), 'p1', 'v1', 3, expect.stringContaining('镜像'),
            expect.objectContaining({ bizType: 'mirror' }),
        );
    });

    it('传入仓全为虚拟仓 → 跳过（直接写账面语义，防 Σ 绑定仓覆盖）', async () => {
        const svc = makeMergeService({
            kinds: { l1: 'virtual', l2: 'virtual' },
            bindings: [{ variantId: 'p1', locationId: 'l1' }],
            levels: [{ stockLocationId: 'v1', stockOnHand: 9 }, { stockLocationId: 'l1', stockOnHand: 0 }],
        });
        await svc.syncMirrorAfterWrites(ctx, 'p1', ['l1', 'l2']);
        expect(svc.inventoryService.adjustStockPublic).not.toHaveBeenCalled();
    });
});

/**
 * D52：盘库目标仓守卫（D51 定稿口径的唯一实现，协同盘库任务与库存单据 STOCKTAKE 共用）。
 * 规则跟渠道 physicalStockEnabled 走，不跟仓的 kind 硬绑。
 */
describe('VirtualPhysicalStockService.assertStocktakeLocationAllowed', () => {
    /** 按实体名分流 getRepository：StockLocation → 目标仓，Channel → 渠道（读 customFields.physicalStockEnabled） */
    function makeGateService(opts: {
        kind?: string | null;
        physicalStockEnabled?: boolean;
        channelId?: number;
    }) {
        const locRepo = {
            findOne: vi.fn().mockResolvedValue(
                opts.kind === null ? null : { id: 5, name: '目标仓', customFields: { kind: opts.kind ?? 'physical' } },
            ),
        };
        const channelRepo = {
            findOne: vi.fn().mockResolvedValue({ id: opts.channelId ?? 37, customFields: { physicalStockEnabled: !!opts.physicalStockEnabled } }),
        };
        const svc = makeService({
            connection: {
                getRepository: vi.fn((_ctx: any, entity: any) =>
                    (entity?.name === 'Channel' ? channelRepo : locRepo)),
            },
        });
        return svc;
    }

    const ctx = { channelId: 37, channel: { code: 't1' } } as any;

    it('物理仓模式（开关 t）+ 虚拟仓 → 拒绝，文案含「必须选物理仓」', async () => {
        const svc = makeGateService({ kind: 'virtual', physicalStockEnabled: true });
        await expect(svc.assertStocktakeLocationAllowed(ctx, 5)).rejects.toThrow(/必须选物理仓/);
    });

    it('物理仓模式 + 物理仓 → 放行', async () => {
        const svc = makeGateService({ kind: 'physical', physicalStockEnabled: true });
        await expect(svc.assertStocktakeLocationAllowed(ctx, 5)).resolves.toBeUndefined();
    });

    it('纯虚拟库存模式（开关 f）+ 虚拟仓 → 放行（存量 24 个盘点任务的形态，不得被废）', async () => {
        const svc = makeGateService({ kind: 'virtual', physicalStockEnabled: false });
        await expect(svc.assertStocktakeLocationAllowed(ctx, 5)).resolves.toBeUndefined();
    });

    it('仓库不存在 → 报「盘点仓库不存在」', async () => {
        const svc = makeGateService({ kind: null, physicalStockEnabled: true });
        await expect(svc.assertStocktakeLocationAllowed(ctx, 999)).rejects.toThrow(/盘点仓库不存在/);
    });
});
