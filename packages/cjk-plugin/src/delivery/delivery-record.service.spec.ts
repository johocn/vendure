import { describe, expect, it, vi } from 'vitest';
import { DeliveryRecordService } from './delivery-record.service';

describe('DeliveryRecordService', () => {
    function makeService(overrides: Record<string, any> = {}) {
        const saved: any[] = [];
        const svc: any = new DeliveryRecordService({} as any);
        Object.assign(svc, {
            connection: {
                getRepository: vi.fn((_ctx: any, entity: any) => {
                    if (entity === 'OrderLine') {
                        return {
                            find: vi.fn().mockResolvedValue([{ id: 'ol1', orderId: 'o1' }]),
                        };
                    }
                    return {
                        find: vi.fn().mockResolvedValue([]),
                        save: vi.fn(async (e: any) => { saved.push(e); return e; }),
                    };
                }),
            },
            physicalEnabled: vi.fn(async () => true),
            ...overrides,
        });
        svc.__saved = saved;
        return svc;
    }

    it('SALE 按 orderId+sourceLocationId 分组生成记录（2 仓=2 条）', async () => {
        const svc = makeService();
        const sales: any[] = [
            { productVariantId: 'p1', stockLocationId: 'l1', quantity: 2, orderLine: { id: 'ol1' } },
            { productVariantId: 'p1', stockLocationId: 'l2', quantity: 3, orderLine: { id: 'ol1' } },
        ];
        await svc.createFromSales({} as any, sales);
        expect(svc.__saved.length).toBe(2);
        const modes = svc.__saved.map((s: any) => s.mode);
        expect(modes).toEqual(['self', 'self']);
    });

    it('未开启物理仓租户跳过', async () => {
        const svc = makeService({ physicalEnabled: vi.fn(async () => false) });
        await svc.createFromSales({} as any, [{ productVariantId: 'p1', stockLocationId: 'l1', quantity: 1 }] as any);
        expect(svc.__saved.length).toBe(0);
    });

    it('已存在同 orderId+sourceLocationId 未完成记录则跳过（防重复）', async () => {
        const svc = makeService({
            connection: {
                getRepository: vi.fn((_ctx: any, entity: any) => {
                    if (entity === 'OrderLine') {
                        return {
                            find: vi.fn().mockResolvedValue([{ id: 'ol1', orderId: 'o1' }]),
                        };
                    }
                    return {
                        find: vi.fn().mockResolvedValue([{ id: 'd1', status: 'Draft' }]),
                        save: vi.fn(async (e: any) => { svc.__saved.push(e); return e; }),
                    };
                }),
            },
        });
        await svc.createFromSales({} as any, [{ productVariantId: 'p1', stockLocationId: 'l1', quantity: 1, orderLine: { id: 'ol1' } }] as any);
        expect(svc.__saved.length).toBe(0);
    });

    it('非法状态迁移抛错', async () => {
        const svc = makeService({
            connection: {
                getRepository: vi.fn().mockReturnValue({
                    findOne: vi.fn().mockResolvedValue({ id: 'd1', mode: 'express', status: 'Draft' }),
                    save: vi.fn(async (e: any) => e),
                }),
            },
        });
        await expect(svc.transition({} as any, 'd1', 'Delivered')).rejects.toThrow(/非法状态迁移/);
    });
});
