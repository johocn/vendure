import { describe, expect, it, vi } from 'vitest';
import { R2MarkService } from './r2-mark.service';

function makeEnv(opts: { order?: any; relay?: any; casRows?: any[] } = {}) {
    const orderRepo: any = { update: vi.fn().mockResolvedValue({}) };
    orderRepo.createQueryBuilder = vi.fn(() => ({
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(opts.relay ?? null),
    }));
    // markArrived 改裸 SQL 条件写（CAS）：默认命中一行
    const rawQuery = vi.fn().mockResolvedValue([opts.casRows ?? [{ id: 6 }], []]);
    const conn = { getRepository: vi.fn(() => orderRepo), rawConnection: { query: rawQuery } } as any;
    const orderSvc = { findOne: vi.fn().mockResolvedValue(opts.order ?? null) };
    const svc = new R2MarkService(conn, orderSvc as any);
    return { svc, orderRepo, orderSvc, rawQuery };
}

describe('R2MarkService.markArrived', () => {
    it('本人 R2 单可标记到校（thirdPartyState=pickup + leg1Status 空 → arrived_gate）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: null, thirdPartyState: 'pickup' }, customer: { user: { id: 9 } } },
        });
        const res = await env.svc.markArrived({ activeUserId: 9 } as any, 6);
        expect(env.rawQuery).toHaveBeenCalledWith(
            expect.stringContaining('"customFieldsLeg1status" = $2'),
            [6, 'arrived_gate', expect.any(Date)],
        );
        expect(res).toEqual({ leg1Status: 'arrived_gate' });
    });

    it('非本人拒绝（ForbiddenError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 8 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow();
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('非 R2 单拒绝（UserInputError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R3' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('仅 R2 快递单支持到校确认');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('已 arrived_gate 幂等返回，不重复写 handoverAt', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: 'arrived_gate' }, customer: { user: { id: 9 } } },
        });
        const res = await env.svc.markArrived({ activeUserId: 9 } as any, 6);
        expect(res).toEqual({ leg1Status: 'arrived_gate' });
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('leg1Status 已写入（非 arrived_gate）拒绝', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: 'picked', thirdPartyState: 'pickup' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('当前状态不支持到校确认');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('外部运单尚未取件（pending_dispatch）→ 拒绝标记到校', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: null, thirdPartyState: 'pending_dispatch' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('外部运单尚未取件');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('外部运单异常（exception）→ 拒绝标记到校', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: null, thirdPartyState: 'exception' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('外部运单异常');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('外部运单已取消 → 拒绝标记到校', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', thirdPartyState: 'cancelled' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('外部运单已取消');
        expect(env.rawQuery).not.toHaveBeenCalled();
    });

    it('外部回调已写入 handoverAt → 学生端确认不覆盖权威时间（COALESCE）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: null, thirdPartyState: 'delivered', handoverAt: new Date('2026-01-01T00:00:00Z') }, customer: { user: { id: 9 } } },
        });
        await env.svc.markArrived({ activeUserId: 9 } as any, 6);
        expect(env.rawQuery.mock.calls[0][0]).toContain('COALESCE("customFieldsHandoverat", $3)');
    });

    it('CAS 未命中（并发改状态/已取消）→ 报状态已变更', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: null, thirdPartyState: 'pickup' }, customer: { user: { id: 9 } } },
            casRows: [],
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('订单状态已变更，请刷新');
    });
});

describe('R2MarkService.relayStatus', () => {
    it('按本单 code 反查 R5 接力单并返回精简状态', async () => {
        const env = makeEnv({
            order: { id: 6, code: 'A100', customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 9 } } },
            relay: { id: 8, code: 'A105', state: 'PaymentSettled', totalWithTax: 500,
                     customFields: { hallStatus: 'grabbed', deliveryStatus: 'delivered', errandTo: '9 栋', tip: 100 } },
        });
        const res = await env.svc.relayStatus({ activeUserId: 9, channelId: 2 } as any, 6);
        expect(res).toEqual({
            orderId: 8, orderCode: 'A105', state: 'PaymentSettled',
            hallStatus: 'grabbed', deliveryStatus: 'delivered', errandTo: '9 栋', tip: 100, totalWithTax: 500,
        });
    });

    it('无接力单返回 null', async () => {
        const env = makeEnv({
            order: { id: 6, code: 'A100', customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 9 } } },
        });
        expect(await env.svc.relayStatus({ activeUserId: 9, channelId: 2 } as any, 6)).toBeNull();
    });

    it('非本人 R2 单拒绝', async () => {
        const env = makeEnv({
            order: { id: 6, code: 'A100', customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 8 } } },
        });
        await expect(env.svc.relayStatus({ activeUserId: 9, channelId: 2 } as any, 6)).rejects.toThrow();
    });
});
