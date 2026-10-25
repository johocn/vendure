import { describe, expect, it, vi } from 'vitest';
import { RiderLedgerService } from './rider-ledger.service';

function makeEnv(rows: any[] = [{ id: 9, customFields: { riderRealName: '王同学' } }]) {
    const rawQuery = vi.fn();
    const conn = {
        rawConnection: { query: rawQuery },
        getRepository: vi.fn(() => ({ findByIds: vi.fn().mockResolvedValue(rows) })),
    } as any;
    return { svc: new RiderLedgerService(conn), rawQuery };
}

describe('RiderLedgerService.earningsLedger', () => {
    const ctx = { channelId: 2 } as any;

    it('按渠道/日期/骑手/状态/订单号筛选并返回合计与骑手名', async () => {
        const env = makeEnv();
        env.rawQuery
            .mockResolvedValueOnce([{ sumAmount: 2050, sumTip: 200, total: 3 }])
            .mockResolvedValueOnce([
                { id: 11, orderId: 101, orderCode: 'A1024', riderCustomerId: 9, amount: 650, tip: 200, status: 'credited', createdAt: '2026-10-25T04:41:00.000Z' },
            ]);
        const res = await env.svc.earningsLedger(ctx, {
            from: '2026-10-25',
            to: '2026-10-25',
            riderCustomerId: '9',
            status: 'credited',
            orderCode: 'A1024',
            skip: 0,
            take: 20,
        });
        expect(res.total).toBe(3);
        expect(res.sumAmount).toBe(2050);
        expect(res.sumTip).toBe(200);
        expect(res.items[0]).toEqual({
            id: '11',
            orderId: '101',
            orderCode: 'A1024',
            riderCustomerId: '9',
            riderName: '王同学',
            amount: 650,
            tip: 200,
            status: 'credited',
            createdAt: '2026-10-25T04:41:00.000Z',
        });
        const [summarySql, summaryParams] = env.rawQuery.mock.calls[0];
        expect(summarySql).toContain('FROM rider_earning e');
        expect(summarySql).toContain('e."channelId" = $1');
        expect(summarySql).toContain('o.code ILIKE');
        expect(summaryParams[0]).toBe(2);
        expect(summaryParams[1]).toEqual(new Date('2026-10-25T00:00:00+08:00'));
        expect(summaryParams[2]).toEqual(new Date('2026-10-26T00:00:00+08:00'));
        const [itemsSql, itemsParams] = env.rawQuery.mock.calls[1];
        expect(itemsSql).toContain('ORDER BY e."createdAt" DESC');
        expect(itemsParams.slice(-2)).toEqual([20, 0]);
    });

    it('纯数字订单号按 orderId 精确匹配', async () => {
        const env = makeEnv();
        env.rawQuery
            .mockResolvedValueOnce([{ sumAmount: 0, sumTip: 0, total: 0 }])
            .mockResolvedValueOnce([]);
        await env.svc.earningsLedger(ctx, { orderCode: '101' });
        const [sql, params] = env.rawQuery.mock.calls[0];
        expect(sql).toContain('e."orderId" = $2');
        expect(params).toContain(101);
    });

    it('非法日期/状态直接拒绝（不查库）', async () => {
        const env = makeEnv();
        await expect(env.svc.earningsLedger(ctx, { from: '2026/10/25' })).rejects.toThrow('格式应为 YYYY-MM-DD');
        await expect(env.svc.earningsLedger(ctx, { status: 'drop table' })).rejects.toThrow('分成状态不合法');
        await expect(env.svc.earningsLedger(ctx, { orderCode: 'x'.repeat(65) })).rejects.toThrow('订单号过长');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });
});

describe('RiderLedgerService 轨迹', () => {
    const ctx = { channelId: 2 } as any;

    it('订单轨迹按时间升序并累计相邻距离', async () => {
        const env = makeEnv();
        env.rawQuery.mockResolvedValueOnce([
            { id: 1, orderId: 5, orderCode: 'A1', riderCustomerId: 9, lat: 30.1, lng: 120.2, reportedAt: 't1' },
            { id: 2, orderId: 5, orderCode: 'A1', riderCustomerId: 9, lat: 30.109, lng: 120.2, reportedAt: 't2' },
        ]);
        const res = await env.svc.orderTrack(ctx, 5);
        expect(res.orderId).toBe('5');
        expect(res.orderCode).toBe('A1');
        expect(res.points).toHaveLength(2);
        expect(res.distanceMeters).toBeGreaterThan(990);
        expect(res.distanceMeters).toBeLessThan(1010);
        expect(res.truncated).toBe(false);
        const [, params] = env.rawQuery.mock.calls[0];
        expect(params).toEqual([5, 2, 5000]);
    });

    it('无轨迹返回空点集', async () => {
        const env = makeEnv();
        env.rawQuery.mockResolvedValueOnce([]);
        const res = await env.svc.orderTrack(ctx, 5);
        expect(res.points).toEqual([]);
        expect(res.distanceMeters).toBe(0);
        expect(res.riderCustomerId).toBeNull();
    });

    it('骑手时段轨迹带骑手名，跨单点位按时间升序', async () => {
        const env = makeEnv([{ id: 9, customFields: { riderRealName: '王同学' } }]);
        env.rawQuery.mockResolvedValueOnce([
            { id: 1, orderId: 5, orderCode: 'A1', riderCustomerId: 9, lat: 30.1, lng: 120.2, reportedAt: 't1' },
            { id: 2, orderId: 6, orderCode: 'A2', riderCustomerId: 9, lat: 30.11, lng: 120.2, reportedAt: 't2' },
        ]);
        const res = await env.svc.riderTrack(ctx, 9, '2026-10-24', '2026-10-25');
        expect(res.riderName).toBe('王同学');
        expect(res.riderCustomerId).toBe('9');
        expect(res.points.map(p => p.orderCode)).toEqual(['A1', 'A2']);
        const [, params] = env.rawQuery.mock.calls[0];
        expect(params[0]).toBe(2);
        expect(params[1]).toBe(9);
        expect(params[2]).toEqual(new Date('2026-10-24T00:00:00+08:00'));
        expect(params[3]).toEqual(new Date('2026-10-26T00:00:00+08:00'));
    });

    it('区间超过 31 天/结束早于开始直接拒绝', async () => {
        const env = makeEnv();
        await expect(env.svc.riderTrack(ctx, 9, '2026-09-01', '2026-10-25')).rejects.toThrow('不能超过 31 天');
        await expect(env.svc.riderTrack(ctx, 9, '2026-10-25', '2026-10-24')).rejects.toThrow('不能早于开始日期');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });
});
