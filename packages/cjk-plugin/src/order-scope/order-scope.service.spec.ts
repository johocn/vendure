import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { OrderScopeService } from './order-scope.service';

const andWhere = vi.fn().mockReturnThis();
const innerJoin = vi.fn().mockReturnThis();
const orderBy = vi.fn().mockReturnThis();
const skipQb = vi.fn().mockReturnThis();
const takeQb = vi.fn().mockReturnThis();
const setParams = vi.fn().mockReturnThis();
const setFindOptions = vi.fn().mockReturnThis();
const getRawMany = vi.fn().mockResolvedValue([{ id: 11 }, { id: 12 }]);

const qb: any = {
    andWhere,
    innerJoin,
    orderBy,
    skip: skipQb,
    take: takeQb,
    setParameters: setParams,
    setFindOptions,
    getRawMany,
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue({ cnt: '0' }),
    getMany: vi.fn().mockResolvedValue([]),
};

const repo: any = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
const conn: any = { getRepository: vi.fn().mockReturnValue(repo) };
const scopeSvc: any = { resolve: vi.fn().mockResolvedValue({ restricted: true, shippingProfileIds: ['5', '7'] }) };
const ctx: any = { channelId: 3, userHasPermissions: (ps: string[]) => ps.includes('VerifyOrder') };

describe('OrderScopeService', () => {
    it('超管 → 不受限（不叠加档案过滤）', async () => {
        const svc = new OrderScopeService(conn, scopeSvc);
        const s = await svc.resolveScope({ ...ctx, userHasPermissions: () => true } as any);
        expect(s.restricted).toBe(false);
    });

    it('受限 + 空白名单 → 直接 1=0', async () => {
        (scopeSvc.resolve as any).mockResolvedValueOnce({ restricted: true, shippingProfileIds: [] });
        const svc = new OrderScopeService(conn, scopeSvc);
        await svc.scopedOrders(ctx, {}, 20, 0);
        expect(andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it('受限 + 白名单 → 叠加 NOT EXISTS 谓词（含 allow 参数）', async () => {
        andWhere.mockClear();
        setParams.mockClear();
        const svc = new OrderScopeService(conn, scopeSvc);
        await svc.scopedOrders(ctx, {}, 20, 0);
        const calls = andWhere.mock.calls.map((c: any[]) => String(c[0]));
        expect(calls.some((c) => c.includes('NOT EXISTS') && c.includes('pv."customFieldsShippingprofileid"') && c.includes('hasl."orderId"'))).toBe(true);
        expect(setParams).toHaveBeenCalled();
    });

    it('scopedOrders 透传 GraphQL selection relations：setFindOptions relationLoadStrategy=query', async () => {
        setFindOptions.mockClear();
        const svc = new OrderScopeService(conn, scopeSvc);
        const relations = ['lines', 'lines.productVariant', 'shippingLines.shippingMethod'] as any;
        await svc.scopedOrders(ctx, {}, 20, 0, relations);
        // 与原生 listQueryBuilder 同机制：'query' 策略对一对多关系走独立子查询，
        // 避免 join 一对多 + take 的分页错乱；未传 relations 时不产生额外加载
        expect(setFindOptions).toHaveBeenCalledTimes(1);
        const opts = setFindOptions.mock.calls[0][0];
        expect(opts.relations).toEqual(relations);
        expect(opts.relationLoadStrategy).toBe('query');
    });

    it('scopedOrders 未传 relations 时不 setFindOptions（counts/newOrderSignal 不受影响）', async () => {
        setFindOptions.mockClear();
        const svc = new OrderScopeService(conn, scopeSvc);
        await svc.scopedOrders(ctx, {}, 20, 0);
        expect(setFindOptions).not.toHaveBeenCalled();
    });

    it('newOrderSignal 按 since 过滤并返回 latestCreatedAt（游标与计数同轴）', async () => {
        andWhere.mockClear();
        getRawMany.mockResolvedValueOnce([{ cnt: '2', latest: '2026-10-11T08:00:00.000Z' }]);
        const svc = new OrderScopeService(conn, scopeSvc);
        const since = new Date('2026-10-11T00:00:00.000Z');
        const r = await svc.newOrderSignal(ctx, since);
        expect(r).toEqual({ count: 2, latestCreatedAt: '2026-10-11T08:00:00.000Z' });
        // 游标同轴：MAX 聚合必须取 createdAt——取 orderPlacedAt 时未付款单致游标不前进/每轮重复计数
        expect(qb.addSelect).toHaveBeenCalledWith('MAX(order.createdAt)', 'latest');
        // 时区口径：参数必须是 Date 实例——pg 驱动按连接时区序列化「本地字面+偏移」与列字面对齐；
        // toISOString() 字符串会被 PG 丢 Z 按 UTC 字面比较 → 窗口整体早 8h（同批单反复命中）
        const calls = andWhere.mock.calls.map((c: any[]) => String(c[0]));
        expect(calls.some((c) => c.includes('order.createdAt > :timeStart'))).toBe(true);
        expect(calls.some((c) => c.includes('>='))).toBe(false);
        const param = andWhere.mock.calls.map((c: any[]) => c[1]).find((p: any) => p && 'timeStart' in p)?.timeStart;
        expect(param).toBeInstanceOf(Date);
        expect(param.getTime()).toBe(since.getTime());
    });
});
