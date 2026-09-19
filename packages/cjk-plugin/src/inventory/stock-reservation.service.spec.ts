import { describe, expect, it, vi } from 'vitest';
import { StockReservationService } from './stock-reservation.service';

// 用假实体模块替换真实 entity（其 @Column 装饰器依赖 emitDecoratorMetadata，
// 而 vitest/esbuild 不默认生成 design:type 元数据，间接导入会导致 ColumnTypeUndefinedError）。
// 与 stock-doc.service.spec.ts 同款手法规避。
const h = vi.hoisted(() => {
    class MockStockReservationEntity {
        id?: number;
        orderId?: number;
        orderLineId?: number;
        variantId?: number;
        totalQty?: number;
        status?: string;
        tenantChannelId?: string | null;
        createdAt?: Date;
    }
    class MockStockReservationItemEntity {
        id?: number;
        reservationId?: number;
        stockLocationId?: number;
        qty?: number;
        fulfillType?: string;
        status?: string;
    }
    return { MockStockReservationEntity, MockStockReservationItemEntity };
});

vi.mock('./stock-reservation.entity', () => ({ StockReservationEntity: h.MockStockReservationEntity }));
vi.mock('./stock-reservation-item.entity', () => ({
    StockReservationItemEntity: h.MockStockReservationItemEntity,
}));

function makeCtx(channelCode = 't1') {
    return {
        channel: { code: channelCode, customFields: { inventoryMode: 'simple' } },
        activeUserId: 'u1',
    } as any;
}

/**
 * 用内存 Map 实现两套假 repo + 假 stockLevelService + 假 virtualPhysicalStockService，
 * 在服务层验证预留生命周期，而不依赖真实 DB。
 */
function makeService(ctx: any, opts: { locations?: Array<{ id: number; kind?: string }> } = {}) {
    const locations = opts.locations ?? [
        { id: 1, customFields: { kind: 'physical' } },
        { id: 2, customFields: { kind: 'virtual' } },
    ];

    // --- 内存存储 ---
    let resId = 0;
    const reservations: any[] = [];
    let itemId = 0;
    const items: any[] = [];

    function matching(row: any, where: Record<string, any>): boolean {
        return Object.entries(where).every(([k, raw]) => {
            // typeorm 的 In() 返回 FindOperator（对象带 value 数组），展开成数组比较
            const v = raw && typeof raw === 'object' && Array.isArray(raw.value) ? raw.value : raw;
            if (Array.isArray(v)) {
                return v.includes(row[k]);
            }
            return row[k] === v;
        });
    }

    function makeRepo(store: any[], getId: () => number) {
        return {
            findOne: vi.fn().mockImplementation(async ({ where }: any = {}) => store.find(r => matching(r, where)),
            ),
            find: vi.fn().mockImplementation(async ({ where }: any = {}) => store.filter(r => matching(r, where))),
            save: vi.fn().mockImplementation(async (e: any) => {
                if (e.id == null) {
                    e.id = getId();
                    store.push(e);
                } else {
                    const idx = store.findIndex(r => r.id === e.id);
                    if (idx >= 0) store[idx] = e;
                    else store.push(e);
                }
                return e;
            }),
            delete: vi.fn().mockImplementation(async ({ where }: any = {}) => {
                for (let i = store.length - 1; i >= 0; i--) {
                    if (matching(store[i], where)) store.splice(i, 1);
                }
            }),
            count: vi.fn().mockImplementation(async ({ where }: any = {}) => store.filter(r => matching(r, where)).length),
        };
    }

    const reservationRepo = makeRepo(reservations, () => ++resId);
    const itemRepo = makeRepo(items, () => ++itemId);

    const conn = {
        withTransaction: vi.fn(async (_c: any, fn: any) => fn(_c)),
        getRepository: vi.fn().mockImplementation((_c: any, entity: any) => {
            if (entity === h.MockStockReservationEntity) return reservationRepo;
            if (entity === h.MockStockReservationItemEntity) return itemRepo;
            return {
                find: vi.fn().mockResolvedValue(locations),
            };
        }),
    };

    // 假 stockLevelService：getStockLevel 返回指定 onHand；getStockLevelsForVariant 返回整个 levels 表
    const levelOnHand = new Map<string, number>();
    const levelForVariant = (vid: any): Array<{ stockLocationId: number; stockOnHand: number }> =>
        locations.map((l: any) => ({
            stockLocationId: l.id,
            stockOnHand: levelOnHand.get(`${vid}:${l.id}`) ?? 0,
        }));

    const stockLevelService = {
        getStockLevel: vi.fn().mockImplementation(async (_c: any, vid: any, locId: any) => ({
            stockOnHand: levelOnHand.get(`${vid}:${locId}`) ?? 0,
        })),
        getStockLevelsForVariant: vi.fn().mockImplementation(async (_c: any, vid: any) => levelForVariant(vid)),
    };

    const adjustPhysicalStock = vi.fn().mockResolvedValue(undefined);
    const adjustVirtualStock = vi.fn().mockResolvedValue(undefined);
    const virtualPhysicalStockService = {
        adjustPhysicalStock,
        adjustVirtualStock,
    } as any;

    const svc = new StockReservationService(conn as any, stockLevelService as any, virtualPhysicalStockService, {} as any);
    return { svc, reservationRepo, itemRepo, reservations, items, conn, stockLevelService, adjustPhysicalStock, levelOnHand };
}

describe('StockReservationService 预留生命周期', () => {
    it('reserveOnOrder 建单 + 幂等复购不重复建单', async () => {
        const ctx = makeCtx();
        const { svc, reservations } = makeService(ctx);

        const r1 = await svc.reserveOnOrder(ctx, 100, 1001, 7, 5);
        expect(r1.status).toBe('PENDING_ALLOC');
        expect(r1.totalQty).toBe(5);
        expect(r1.orderLineId).toBe(1001);
        expect(r1.variantId).toBe(7);
        expect(reservations.length).toBe(1);

        // 同一 orderLine+variant 再次下单 → 更新而非新增
        const r2 = await svc.reserveOnOrder(ctx, 100, 1001, 7, 8);
        expect(r2.id).toBe(r1.id);
        expect(r2.totalQty).toBe(8);
        expect(reservations.length).toBe(1);
    });

    it('allocate 守恒校验 Σ≠totalQty 抛错', async () => {
        const ctx = makeCtx();
        const { svc, items } = makeService(ctx);
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 10);

        await expect(
            svc.allocate(ctx, r.id!, [
                { locationId: 1, fulfillType: 'SHIP', qty: 6 },
                { locationId: 2, fulfillType: 'SHIP', qty: 2 },
            ]),
        ).rejects.toThrow(/拆分总量/);

        expect(items.length).toBe(0); // 校验失败不落 item
        expect((await svc.get(ctx, r.id!)).status).toBe('PENDING_ALLOC');
    });

    it('allocate 单仓物理库存不足抛错', async () => {
        const ctx = makeCtx();
        const { svc, levelOnHand, items } = makeService(ctx);
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 8);
        levelOnHand.set('7:1', 5); // 物理仅 5 < 需求 8

        await expect(
            svc.allocate(ctx, r.id!, [{ locationId: 1, fulfillType: 'SHIP', qty: 8 }]),
        ).rejects.toThrow(/物理库存不足/);
        expect(items.length).toBe(0);
    });

    it('allocate 成功 → 头 ALLOCATED 且逐仓落 PENDING item', async () => {
        const ctx = makeCtx();
        const { svc, levelOnHand, items } = makeService(ctx);
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 10);
        levelOnHand.set('7:1', 100);
        levelOnHand.set('7:2', 100);

        await svc.allocate(ctx, r.id!, [
            { locationId: 1, fulfillType: 'SHIP', qty: 6 },
            { locationId: 2, fulfillType: 'CLICK_COLLECT', qty: 4 },
        ]);

        expect((await svc.get(ctx, r.id!)).status).toBe('ALLOCATED');
        expect(items).toHaveLength(2);
        expect(items.every(i => i.status === 'PENDING')).toBe(true);
        expect(items.map(i => i.qty).sort()).toEqual([4, 6]);
    });

    it('fulfill 明细→DONE，全 DONE→头 DONE', async () => {
        const ctx = makeCtx();
        const { svc, levelOnHand, items } = makeService(ctx);
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 10);
        levelOnHand.set('7:1', 100);
        levelOnHand.set('7:2', 100);
        await svc.allocate(ctx, r.id!, [
            { locationId: 1, fulfillType: 'SHIP', qty: 6 },
            { locationId: 2, fulfillType: 'SHIP', qty: 4 },
        ]);
        const [i1, i2] = items;

        const done1 = await svc.fulfill(ctx, r.id!, i1.id!, 6);
        expect(done1.status).toBe('DONE');
        // 仍有 i2 PENDING → 头仍是 ALLOCATED
        expect((await svc.get(ctx, r.id!)).status).toBe('ALLOCATED');

        await svc.fulfill(ctx, r.id!, i2.id!, 4);
        // 全部 DONE → 头 DONE
        expect((await svc.get(ctx, r.id!)).status).toBe('DONE');
    });

    it('release 头→RELEASED 且不二次扣库', async () => {
        const ctx = makeCtx();
        const { svc, levelOnHand, items, adjustPhysicalStock } = makeService(ctx);
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 10);
        levelOnHand.set('7:1', 100);
        levelOnHand.set('7:2', 100);
        await svc.allocate(ctx, r.id!, [
            { locationId: 1, fulfillType: 'SHIP', qty: 6 },
            { locationId: 2, fulfillType: 'SHIP', qty: 4 },
        ]);
        const [i1, i2] = items;
        await svc.fulfill(ctx, r.id!, i1.id!, 6); // i1 DONE、i2 PENDING → 头仍 ALLOCATED

        await svc.release(ctx, r.id!, { returnPhysical: true });
        expect((await svc.get(ctx, r.id!)).status).toBe('RELEASED');
        // DONE 明细回补物理仓（fulfill 已把 qty 归零，此处回补量即明细当前 qty=0）
        expect(adjustPhysicalStock).toHaveBeenCalledTimes(1);
        expect(adjustPhysicalStock).toHaveBeenCalledWith(ctx, 7, 1, 0, '预留单释放回补:1');

        // 重复 release 幂等 → 不再二次扣库
        adjustPhysicalStock.mockClear();
        const again = await svc.release(ctx, r.id!, { returnPhysical: true });
        expect(again.status).toBe('RELEASED');
        expect(adjustPhysicalStock).not.toHaveBeenCalled();
    });

    it('reconcileScan 对账恒等式 diff==0', async () => {
        // 物理=10（location1），虚拟=2（location2），pending item qty=8
        // Σ物理 - 虚拟 - ΣPENDING == 10 - 2 - 8 == 0
        const ctx = makeCtx();
        const { svc, levelOnHand } = makeService(ctx, {
            locations: [
                { id: 1, customFields: { kind: 'physical' } },
                { id: 2, customFields: { kind: 'virtual' } },
            ],
        });
        const r = await svc.reserveOnOrder(ctx, 100, 1001, 7, 8);
        levelOnHand.set('7:1', 10);
        levelOnHand.set('7:2', 2);
        // 直接把头拆成一个 PENDING item（绕过 allocate 的 onHand 校验不影响结果）
        await svc.allocate(ctx, r.id!, [{ locationId: 1, fulfillType: 'SHIP', qty: 8 }]);

        const diffs = await svc.reconcileScan(ctx);
        expect(diffs).toHaveLength(1);
        expect(diffs[0]).toMatchObject({ variantId: 7, physicalSum: 10, virtualSum: 2, pendingQty: 8 });
        expect(diffs[0].diff).toBe(0);
    });
});