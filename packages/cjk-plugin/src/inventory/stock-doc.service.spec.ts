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

function makeCtx(overrides: Record<string, any> = {}) {
    return {
        channel: { code: 't1', customFields: { inventoryMode: 'simple' } },
        activeUserId: 'u1',
        ...overrides,
    } as any;
}

/**
 * 用与 real VirtualPhysicalStockService 一致的语义做假实现：
 * - adjustPhysicalStock: 负 delta 当物理仓 onHand 不足抛「物理库存不足」
 * - setPhysicalStock: 覆盖为绝对值 target，返回差值
 * - assertStocktakeLocationAllowed: D52 守卫的假实现（跟渠道 physicalStockEnabled 走 + 仓性质表）
 * 借此在单据引擎层验证行为，而不依赖真实 DB。
 */
function makeService(ctx: any, opts: { locationKinds?: Record<number, string> } = {}) {
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
    const inventoryModeService = { assertSimple: vi.fn(), currentMode: vi.fn().mockReturnValue('simple') } as any;
    // D54：移库两段写入合并补镜像的协作者
    const syncMirrorAfterWrites = vi.fn().mockResolvedValue(undefined);
    const storageBinService = {
        bind: vi.fn().mockResolvedValue({}),
        binZoneId: vi.fn().mockResolvedValue(11),
    } as any;
    // D52 守卫假实现：开关为假 → 直接放行（与 real 一致）；为真 → 目标仓必须是物理仓
    const assertStocktakeLocationAllowed = vi.fn().mockImplementation(async (c: any, locationId: number) => {
        if (!Boolean(c?.channel?.customFields?.physicalStockEnabled)) return;
        if ((opts.locationKinds ?? {})[Number(locationId)] !== 'physical') {
            throw new Error(
                `本店已启用物理仓库存（physicalStockEnabled），盘点仓库必须选物理仓；「仓${locationId}」不是物理仓`,
            );
        }
    });
    const svc = new StockDocService(
        conn as any,
        { adjustPhysicalStock, setPhysicalStock, assertStocktakeLocationAllowed, syncMirrorAfterWrites } as any,
        inventoryModeService,
        storageBinService,
    );
    return { svc, physicalStock, key, storageBinService, assertStocktakeLocationAllowed, adjustPhysicalStock, syncMirrorAfterWrites };
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

/**
 * D54：移库两段写入**合并补镜像**。逐段补会在「源仓出 / 目标仓入」之间产出中间态镜像流水
 *（两仓皆绑定时为净零的两条），故两段均声明 `deferMirror`，写完再按 [源仓, 目标仓] 合并补一次。
 */
describe('StockDocService TRANSFER 合并补镜像（D54）', () => {
    it('两段写入均 deferMirror，写完按 [源仓, 目标仓] 合并补一次', async () => {
        const ctx = makeCtx();
        const { svc, physicalStock, key, adjustPhysicalStock, syncMirrorAfterWrites } = makeService(ctx);
        await svc.create(ctx, { type: 'PURCHASE', items: [{ variantId: 1, toStockLocationId: 2, qty: 5 }] });
        await svc.create(ctx, {
            type: 'TRANSFER',
            items: [{ variantId: 1, fromStockLocationId: 2, toStockLocationId: 3, qty: 5 }],
        });
        // 账面净搬运仍成立
        expect(physicalStock.get(key(1, 2))).toBe(0);
        expect(physicalStock.get(key(1, 3))).toBe(5);
        // 两段都推迟补镜像（不含 PURCHASE 那次）
        expect(adjustPhysicalStock).toHaveBeenCalledWith(
            expect.anything(), 1, 2, -5, expect.stringContaining('source-out'), expect.anything(), { deferMirror: true },
        );
        expect(adjustPhysicalStock).toHaveBeenCalledWith(
            expect.anything(), 1, 3, 5, expect.stringContaining('target-in'), expect.anything(), { deferMirror: true },
        );
        // 合并补一次（不是逐段两次）
        expect(syncMirrorAfterWrites).toHaveBeenCalledTimes(1);
        expect(syncMirrorAfterWrites).toHaveBeenCalledWith(expect.anything(), 1, [2, 3]);
    });
});

/**
 * D52：库存明细页「调整」/「快捷盘点」都走 `createStockDoc(type:'STOCKTAKE')`，
 * 若渠道启用物理仓库存而目标仓是虚拟仓，同一 SKU 会出现「盘点账面 vs 可售账面」二义 → 必须拒绝。
 * 与协同盘库任务共用 VirtualPhysicalStockService 的同一份守卫。
 */
describe('StockDocService STOCKTAKE 目标仓守卫（D52）', () => {
    const physCtx = () => makeCtx({ channel: { code: 't1', customFields: { inventoryMode: 'simple', physicalStockEnabled: true } } });

    it('物理仓模式 + 虚拟仓 → 拒绝，且账面未被写入', async () => {
        const ctx = physCtx();
        const { svc, physicalStock, key } = makeService(ctx, { locationKinds: { 2: 'virtual' } });
        await expect(
            svc.create(ctx, {
                type: 'STOCKTAKE',
                remark: 'MANUAL-ADJUST | 手工调整',
                items: [{ variantId: 1, toStockLocationId: 2, qty: 3, realQty: 3 }],
            }),
        ).rejects.toThrow(/必须选物理仓/);
        expect(physicalStock.has(key(1, 2))).toBe(false);
    });

    it('物理仓模式 + 物理仓 → 放行，账面覆盖为 realQty', async () => {
        const ctx = physCtx();
        const { svc, physicalStock, key } = makeService(ctx, { locationKinds: { 5: 'physical' } });
        await svc.create(ctx, { type: 'STOCKTAKE', items: [{ variantId: 1, toStockLocationId: 5, qty: 7, realQty: 7 }] });
        expect(physicalStock.get(key(1, 5))).toBe(7);
    });

    it('纯虚拟库存模式（开关 f）+ 虚拟仓 → 放行（生产 t2 手工调整的形态）', async () => {
        const ctx = makeCtx();
        const { svc, physicalStock, key } = makeService(ctx, { locationKinds: { 6: 'virtual' } });
        await svc.create(ctx, { type: 'STOCKTAKE', items: [{ variantId: 1, toStockLocationId: 6, qty: 4, realQty: 4 }] });
        expect(physicalStock.get(key(1, 6))).toBe(4);
    });
});