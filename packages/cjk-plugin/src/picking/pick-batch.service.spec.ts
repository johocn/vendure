import { Fulfillment } from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PickBatchService } from './pick-batch.service';

function makeConn(overrides: Record<string, any> = {}) {
    const qb = {
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
        getCount: vi.fn().mockResolvedValue(0),
        getRawMany: vi.fn().mockResolvedValue([]),
    };
    const repo = {
        createQueryBuilder: vi.fn(() => qb),
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn((x: any) => x),
        save: vi.fn(async (x: any) => (Array.isArray(x) ? x : { ...x, id: 1 })),
    };
    return {
        conn: { getRepository: vi.fn(() => repo), rawConnection: { query: vi.fn() }, ...overrides } as any,
        repo,
        qb,
    };
}

describe('PickBatchService', () => {
    let svc: PickBatchService;
    let m: ReturnType<typeof makeConn>;

    beforeEach(() => {
        m = makeConn();
        svc = new PickBatchService(
            m.conn,
            { findAll: vi.fn().mockResolvedValue({ items: [] }) } as any,
            { findOne: vi.fn().mockResolvedValue(null) } as any,
            { create: vi.fn().mockResolvedValue({ id: 1 }) } as any,
        );
    });

    it('nextCode 无既有批次时为 -001', async () => {
        const ctx = { channelId: 2 } as any;
        const code = await svc.nextCode(ctx, new Date('2026-09-22T10:00:00'));
        expect(code).toBe('PB20260922-001');
    });

    it('nextCode 已有 2 条时为 -003', async () => {
        m.qb.getCount.mockResolvedValue(2);
        const code = await svc.nextCode({ channelId: 2 } as any, new Date('2026-09-22T10:00:00'));
        expect(code).toBe('PB20260922-003');
    });

    it('create 空订单列表被拒绝', async () => {
        await expect(
            svc.create({ channelId: 2 } as any, { stockLocationId: 1, orderIds: [] }, null),
        ).rejects.toThrow('请至少选择一张订单');
    });

    it('create 命中冲突批次时抛出含批次号的原因', async () => {
        m.qb.getRawMany.mockResolvedValue([{ orderId: 1023, code: 'PB20260921-004' }]);
        await expect(
            svc.create({ channelId: 2 } as any, { stockLocationId: 1, orderIds: [1023] }, null),
        ).rejects.toThrow('已在批次 PB20260921-004 中');
    });

    it('advance 非法迁移被拒绝', async () => {
        m.repo.findOne.mockResolvedValue({ id: 1, code: 'PB-X', state: 'SHIPPED' });
        await expect(svc.advance({ channelId: 2 } as any, 1, 'CANCELLED')).rejects.toThrow(
            '不能从 SHIPPED 变为 CANCELLED',
        );
    });

    it('advance 合法迁移写入对应时间戳', async () => {
        m.repo.findOne.mockResolvedValue({ id: 1, code: 'PB-X', state: 'PENDING' });
        const out = await svc.advance({ channelId: 2 } as any, 1, 'PICKED');
        expect(out.state).toBe('PICKED');
        expect(out.pickedAt).toBeInstanceOf(Date);
    });

    it('removeOrders 在 SHIPPED 批次上被拒绝', async () => {
        m.repo.findOne.mockResolvedValue({ id: 1, code: 'PB-X', state: 'SHIPPED' });
        await expect(svc.removeOrders({ channelId: 2 } as any, 1, [5])).rejects.toThrow('不可移出订单');
    });

    it('ship 在 PRINTED 批次上只推进 SHIPPED（不回溯 PICKED 而被状态机拒绝）', async () => {
        const batch: any = { id: 1, code: 'PB-X', state: 'PRINTED' };
        m.repo.findOne.mockImplementation(async () => batch);
        m.repo.find.mockResolvedValue([{ orderId: 1023 }] as any);
        svc = new PickBatchService(
            m.conn,
            { findAll: vi.fn().mockResolvedValue({ items: [] }) } as any,
            {
                findOne: vi.fn().mockResolvedValue({
                    id: 1023,
                    code: 'O1',
                    lines: [{ id: 7, quantity: 1 }],
                    fulfillments: [],
                }),
            } as any,
            { create: vi.fn().mockResolvedValue(Object.create(Fulfillment.prototype)) } as any,
        );

        const res = await svc.ship({ channelId: 2 } as any, 1, { method: 'standard' });

        expect(res.failed).toEqual([]);
        expect(batch.state).toBe('SHIPPED');
        expect(batch.shippedAt).toBeInstanceOf(Date);
        expect(batch.pickedAt).toBeUndefined();
    });
});