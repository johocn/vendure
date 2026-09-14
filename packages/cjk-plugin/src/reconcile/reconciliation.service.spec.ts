import { describe, expect, it, vi } from 'vitest';
import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService', () => {
    function makeService(overrides: Record<string, any> = {}) {
        const svc: any = new ReconciliationService({} as any, {} as any, {} as any, {} as any);
        Object.assign(svc, {
            connection: {
                getRepository: vi.fn(),
                getEntityOrThrow: vi.fn(),
            },
            collectOrderData: vi.fn(async () => ({
                deliveryRecords: [],
                ledgerOuts: [{ sourceLocationId: 'l1', quantity: 1 }],
                settlements: [{ status: 'PAID', amount: 10000 }],
                mirrorDiff: 0,
            })),
            ...overrides,
        });
        return svc;
    }

    it('同日重复跑批幂等：已存在 done 批次则跳过', async () => {
        const repo = { findOne: vi.fn().mockResolvedValue({ id: 'b1', status: 'done' }) };
        const svc = makeService({
            connection: { getRepository: vi.fn().mockReturnValue(repo), getEntityOrThrow: vi.fn() },
        });
        const result = await svc.runBatch({ channel: { id: 'c1' } } as any, '2026-09-14', 'manual');
        expect(result).toBeNull();
    });

    it('跑批：差异行落库并计数', async () => {
        const savedBatch: any[] = [];
        const savedLines: any[] = [];
        const repo = {
            findOne: vi.fn().mockResolvedValue(null),
            save: vi.fn(async (e: any) => { savedBatch.push(e); return e; }),
        };
        const lineRepo = {
            find: vi.fn().mockResolvedValue([]),
            save: vi.fn(async (e: any) => { savedLines.push(e); return e; }),
        };
        const orderRepo = {
            find: vi.fn().mockResolvedValue([
                { id: 'o1', totalWithTax: 10000, state: 'Delivered', customFields: {} },
            ]),
        };
        const svc = makeService({
            connection: {
                getRepository: vi.fn((_ctx: any, name: any) => {
                    const n = typeof name === 'string' ? name : name?.name;
                    if (n === 'ReconciliationBatch') return repo;
                    if (n === 'ReconciliationOrderLine') return lineRepo;
                    if (n === 'Order') return orderRepo;
                    return repo;
                }),
                getEntityOrThrow: vi.fn(),
            },
        });
        const batch = await svc.runBatch({ channel: { id: 'c1', code: 't1' } } as any, '2026-09-14', 'manual');
        expect(batch.d1Count).toBe(1);
        expect(savedLines.length).toBe(1);
    });
});
