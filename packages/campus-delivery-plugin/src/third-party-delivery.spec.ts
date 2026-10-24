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
            enterHallForHandover: vi.fn().mockResolvedValue('1234'),
            transitionFrom: vi.fn().mockResolvedValue(true),
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
        // 条件入厅：仅 merchant_delivering 可入厅，附加 handoverAt/thirdPartyState 同语句落库
        expect(hall.enterHallForHandover).toHaveBeenCalledWith(
            ctx,
            1,
            'merchant_handover',
            ['merchant_delivering'],
            expect.objectContaining({ thirdPartyState: '' }),
        );
        expect(res).toEqual({ ok: true, done: false });
    });

    it('入厅条件写未命中（并发取消）→ 拒绝，不返回成功', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'merchant_delivering' } });
        hall.enterHallForHandover.mockResolvedValueOnce('');
        await expect(svc.completeFirstLeg(ctx, 1, 'merchant_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
    });

    it('重复调用（已回大厅 open）→ 拒绝，不重置大厅/交接码', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'open' } });
        await expect(svc.completeFirstLeg(ctx, 1, 'merchant_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
        expect(hall.enterHallForHandover).not.toHaveBeenCalled();
    });

    it('自营快递配送中（owned_dispatched）R3 → 直接完成', async () => {
        const { svc, hall, notify } = makeEnv({ id: 2, code: 'A2', customFields: { fulfillmentRoute: 'R3', deliveryPlan: 'owned', hallStatus: 'owned_dispatched' } });
        const res = await svc.completeFirstLeg(ctx, 2, 'owned_handover');
        expect(hall.transitionFrom).toHaveBeenCalledWith(ctx, 2, ['owned_dispatched'], expect.objectContaining({
            hallStatus: 'delivered', deliveryStatus: 'delivered',
        }));
        expect(notify.user).toHaveBeenCalledWith(ctx, 2, 'orderDelivered');
        expect(res).toEqual({ ok: true, done: true });
    });

    it('R3 第一段完成时订单已取消（条件写未命中）→ 拒绝且不通知', async () => {
        const { svc, hall, notify } = makeEnv({ id: 2, code: 'A2', customFields: { fulfillmentRoute: 'R3', deliveryPlan: 'owned', hallStatus: 'owned_dispatched' } });
        hall.transitionFrom.mockResolvedValueOnce(false);
        await expect(svc.completeFirstLeg(ctx, 2, 'owned_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
        expect(notify.user).not.toHaveBeenCalled();
    });

    it('状态与线路不符（自营 plan 但仍是 merchant_delivering）→ 拒绝', async () => {
        const { svc } = makeEnv({ id: 3, code: 'A3', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'owned', hallStatus: 'merchant_delivering' } });
        await expect(svc.completeFirstLeg(ctx, 3, 'owned_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
    });
});

describe('ThirdPartyDeliveryService.onDeliveryStatus 回调幂等', () => {
    function makeEnv(order: any) {
        const orderRepo = { findOne: vi.fn().mockResolvedValue(order) };
        const channelRepo = { findOne: vi.fn().mockResolvedValue(null) };
        const cfgRepo = { findOne: vi.fn().mockResolvedValue(null) };
        const hall = {
            updateOrder: vi.fn().mockResolvedValue({}),
            enterHallForHandover: vi.fn().mockResolvedValue('1234'),
            transitionFrom: vi.fn().mockResolvedValue(true),
        };
        const notify = { user: vi.fn() };
        // 第三方字段条件写（P3）：默认命中一行；置 [] 模拟订单已取消/并发状态变更
        const rawQuery = vi.fn().mockResolvedValue([[{ id: 1 }], []]);
        const conn = {
            getRepository: vi.fn(() => orderRepo),
            rawConnection: {
                getRepository: vi.fn((ent: any) => ((ent as any).name === 'Channel' ? channelRepo : cfgRepo)),
                query: rawQuery,
            },
        } as any;
        const svc = new ThirdPartyDeliveryService(conn, hall as any, notify as any, {} as any);
        return { svc, hall, notify, rawQuery };
    }
    const ctx = { channelId: 1 } as any;
    const update = (status: any) => ({ orderId: 1, thirdPartyNo: 'TP1', status });

    it('送达回调落在已进大厅的单 → 只补状态，不二次入厅（防重复派送/分成）', async () => {
        const { svc, hall, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'open', handoverMode: 'to_campus_rider' },
        });
        await svc.onDeliveryStatus(ctx, update('delivered'));
        expect(hall.enterHallForHandover).not.toHaveBeenCalled();
        expect(rawQuery).toHaveBeenCalledOnce();
        const [sql, params] = rawQuery.mock.calls[0];
        expect(sql).not.toContain('Hallstatus');
        expect(params).toContain('delivered');
    });

    it('送达后的乱序回调 → 忽略，不回退状态', async () => {
        const { svc, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'delivered', hallStatus: 'delivered' },
        });
        await svc.onDeliveryStatus(ctx, update('accepted'));
        expect(rawQuery).not.toHaveBeenCalled();
    });

    it('同状态重复回调 → 忽略', async () => {
        const { svc, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party' },
        });
        await svc.onDeliveryStatus(ctx, update('pickup'));
        expect(rawQuery).not.toHaveBeenCalled();
    });

    it('乱序回退（pickup 后收到 accepted）→ 忽略', async () => {
        const { svc, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party' },
        });
        await svc.onDeliveryStatus(ctx, update('accepted'));
        expect(rawQuery).not.toHaveBeenCalled();
    });

    it('仍处 third_party 的送达回调 → 正常入厅接力', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party', handoverMode: 'to_campus_rider' },
        });
        await svc.onDeliveryStatus(ctx, update('delivered'));
        expect(hall.enterHallForHandover).toHaveBeenCalledWith(
            expect.anything(),
            1,
            'external_handover',
            ['third_party'],
            expect.objectContaining({ thirdPartyState: 'delivered' }),
        );
    });

    it('已取消订单收到送达回调 → 只补状态，不复活进入大厅', async () => {
        const { svc, hall, rawQuery } = makeEnv({
            id: 1, code: 'A1', state: 'Cancelled',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'cancelled', handoverMode: 'to_campus_rider' },
        });
        rawQuery.mockResolvedValueOnce([[], []]); // state=Cancelled → 条件写不命中
        await svc.onDeliveryStatus(ctx, update('delivered'));
        expect(hall.enterHallForHandover).not.toHaveBeenCalled();
        expect(rawQuery.mock.calls[0][0]).not.toContain('Hallstatus');
    });

    it('R3 外部运力异常 → 条件写回大厅并刷新入厅时间', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'accepted', hallStatus: 'third_party', fulfillmentRoute: 'R3' },
        });
        await svc.onDeliveryStatus(ctx, update('exception'));
        expect(hall.transitionFrom).toHaveBeenCalledWith(
            expect.anything(),
            1,
            ['third_party'],
            expect.objectContaining({ hallStatus: 'open', hallEnteredAt: expect.any(Date) }),
        );
    });
    it('旧运单号迟到回调（已换运力重推）→ 忽略，不污染新运单状态', async () => {
        const { svc, hall, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyNo: 'TP2', thirdPartyState: 'pending', hallStatus: 'third_party' },
        });
        await svc.onDeliveryStatus(ctx, { ...update('delivered'), thirdPartyNo: 'TP1' });
        expect(rawQuery).not.toHaveBeenCalled();
        expect(hall.transitionFrom).not.toHaveBeenCalled();
    });

    it('已取消终态后的迟到回调 → 忽略（cancelled/exception 同属终态档）', async () => {
        const { svc, hall, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyNo: 'TP1', thirdPartyState: 'cancelled', hallStatus: 'open' },
        });
        await svc.onDeliveryStatus(ctx, update('delivered'));
        expect(rawQuery).not.toHaveBeenCalled();
        expect(hall.enterHallForHandover).not.toHaveBeenCalled();
    });

    it('中间态回调条件写未命中（并发已推进/已取消）→ 不覆盖也不发接单通知', async () => {
        const { svc, notify, rawQuery } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pending', hallStatus: 'third_party' },
        });
        rawQuery.mockResolvedValueOnce([[], []]);
        await svc.onDeliveryStatus(ctx, update('accepted'));
        expect(rawQuery).toHaveBeenCalledOnce();
        expect(rawQuery.mock.calls[0][0]).toContain('customFieldsThirdpartystate');
        expect(notify.user).not.toHaveBeenCalled();
    });
});
