import { describe, expect, it, vi } from 'vitest';
import { R2MarkService } from './r2-mark.service';

function makeEnv(opts: { order?: any } = {}) {
    const orderRepo = { update: vi.fn().mockResolvedValue({}) };
    const conn = {
        getRepository: vi.fn(() => orderRepo),
    } as any;
    const orderSvc = { findOne: vi.fn().mockResolvedValue(opts.order ?? null) };
    const svc = new R2MarkService(conn, orderSvc as any);
    return { svc, orderRepo, orderSvc };
}

describe('R2MarkService.markArrived', () => {
    it('本人 R2 单可标记到校（leg1Status=arrived_gate + handoverAt）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: 'preparing' }, customer: { user: { id: 9 } } },
        });
        const res = await env.svc.markArrived({ activeUserId: 9 } as any, 6);
        expect(env.orderRepo.update).toHaveBeenCalledWith(6, expect.objectContaining({
            customFields: expect.objectContaining({ leg1Status: 'arrived_gate' }),
        }));
        expect(res).toEqual({ leg1Status: 'arrived_gate' });
    });

    it('非本人拒绝（ForbiddenError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2' }, customer: { user: { id: 8 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow();
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });

    it('非 R2 单拒绝（UserInputError）', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R3' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('仅 R2 快递单支持到校确认');
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });

    it('已 arrived_gate 幂等返回，不重复写 handoverAt', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: 'arrived_gate' }, customer: { user: { id: 9 } } },
        });
        const res = await env.svc.markArrived({ activeUserId: 9 } as any, 6);
        expect(res).toEqual({ leg1Status: 'arrived_gate' });
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });

    it('leg1Status 非 preparing/arrived_gate 拒绝', async () => {
        const env = makeEnv({
            order: { id: 6, customFields: { fulfillmentRoute: 'R2', leg1Status: 'picked' }, customer: { user: { id: 9 } } },
        });
        await expect(env.svc.markArrived({ activeUserId: 9 } as any, 6)).rejects.toThrow('当前状态不支持到校确认');
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });
});
