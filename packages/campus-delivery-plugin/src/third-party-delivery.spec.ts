import { describe, expect, it, vi } from 'vitest';
import { nextHallStateAfterHandover, ThirdPartyDeliveryService } from './third-party-delivery.service';

describe('third-party delivery', () => {
    it('R1/R2 送达交接点 → 进抢单大厅接力', () => {
        expect(nextHallStateAfterHandover('to_campus_rider')).toEqual({
            hallStatus: 'open', deliveryStatus: null,
        });
    });

    it('R3 外部快递直送 → 直接完成', () => {
        expect(nextHallStateAfterHandover('direct_to_user')).toEqual({
            hallStatus: 'delivered', deliveryStatus: 'delivered',
        });
    });

    it('无交接方式（不认识的快照）→ 不误判完成，回落大厅', () => {
        expect(nextHallStateAfterHandover('')).toEqual({ hallStatus: 'open', deliveryStatus: null });
    });
});

describe('ThirdPartyDeliveryService.completeFirstLeg 状态前置校验', () => {
    function makeEnv(order: any) {
        const orderRepo = { findOne: vi.fn().mockResolvedValue(order) };
        const hall = {
            updateOrder: vi.fn().mockResolvedValue({}),
            enterHallForHandover: vi.fn().mockResolvedValue({}),
        };
        const notify = { user: vi.fn() };
        const conn = { getRepository: vi.fn(() => orderRepo) } as any;
        const svc = new ThirdPartyDeliveryService(conn, hall as any, notify as any, {} as any);
        return { svc, hall, notify };
    }
    const ctx = { channelId: 1 } as any;

    it('商户配送中（merchant_delivering）→ 进大厅接力', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfilment: 'x', fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'merchant_delivering' } });
        const res = await svc.completeFirstLeg(ctx, 1, 'merchant_handover');
        expect(hall.enterHallForHandover).toHaveBeenCalledWith(ctx, 1, 'merchant_handover');
        expect(res).toEqual({ ok: true, done: false });
    });

    it('重复调用（已回大厅 open）→ 拒绝，不重置大厅/交接码', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'open' } });
        await expect(svc.completeFirstLeg(ctx, 1, 'merchant_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
        expect(hall.enterHallForHandover).not.toHaveBeenCalled();
    });

    it('自营快递配送中（owned_dispatched）R3 → 直接完成', async () => {
        const { svc, hall, notify } = makeEnv({ id: 2, code: 'A2', customFields: { fulfillmentRoute: 'R3', deliveryPlan: 'owned', hallStatus: 'owned_dispatched' } });
        const res = await svc.completeFirstLeg(ctx, 2, 'owned_handover');
        expect(hall.updateOrder).toHaveBeenCalledWith(ctx, 2, expect.objectContaining({
            customFields: expect.objectContaining({ hallStatus: 'delivered', deliveryStatus: 'delivered' }),
        }));
        expect(notify.user).toHaveBeenCalledWith(ctx, 2, 'orderDelivered');
        expect(res).toEqual({ ok: true, done: true });
    });

    it('状态与线路不符（自营 plan 但仍是 merchant_delivering）→ 拒绝', async () => {
        const { svc } = makeEnv({ id: 3, code: 'A3', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'owned', hallStatus: 'merchant_delivering' } });
        await expect(svc.completeFirstLeg(ctx, 3, 'owned_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
    });
});
