"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
(0, vitest_1.describe)('third-party delivery', () => {
    (0, vitest_1.it)('R1/R2 送达交接点 → 进抢单大厅接力', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('to_campus_rider')).toEqual({
            hallStatus: 'open', deliveryStatus: null,
        });
    });
    (0, vitest_1.it)('R3 外部快递直送 → 直接完成', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('direct_to_user')).toEqual({
            hallStatus: 'delivered', deliveryStatus: 'delivered',
        });
    });
    (0, vitest_1.it)('无交接方式（不认识的快照）→ 不误判完成，回落大厅', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('')).toEqual({ hallStatus: 'open', deliveryStatus: null });
    });
});
(0, vitest_1.describe)('ThirdPartyDeliveryService.completeFirstLeg 状态前置校验', () => {
    function makeEnv(order) {
        const orderRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(order) };
        const hall = {
            updateOrder: vitest_1.vi.fn().mockResolvedValue({}),
            enterHallForHandover: vitest_1.vi.fn().mockResolvedValue({}),
        };
        const notify = { user: vitest_1.vi.fn() };
        const conn = { getRepository: vitest_1.vi.fn(() => orderRepo) };
        const svc = new third_party_delivery_service_1.ThirdPartyDeliveryService(conn, hall, notify, {});
        return { svc, hall, notify };
    }
    const ctx = { channelId: 1 };
    (0, vitest_1.it)('商户配送中（merchant_delivering）→ 进大厅接力', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfilment: 'x', fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'merchant_delivering' } });
        const res = await svc.completeFirstLeg(ctx, 1, 'merchant_handover');
        (0, vitest_1.expect)(hall.enterHallForHandover).toHaveBeenCalledWith(ctx, 1, 'merchant_handover');
        (0, vitest_1.expect)(res).toEqual({ ok: true, done: false });
    });
    (0, vitest_1.it)('重复调用（已回大厅 open）→ 拒绝，不重置大厅/交接码', async () => {
        const { svc, hall } = makeEnv({ id: 1, code: 'A1', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'merchant', hallStatus: 'open' } });
        await (0, vitest_1.expect)(svc.completeFirstLeg(ctx, 1, 'merchant_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
        (0, vitest_1.expect)(hall.enterHallForHandover).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('自营快递配送中（owned_dispatched）R3 → 直接完成', async () => {
        const { svc, hall, notify } = makeEnv({ id: 2, code: 'A2', customFields: { fulfillmentRoute: 'R3', deliveryPlan: 'owned', hallStatus: 'owned_dispatched' } });
        const res = await svc.completeFirstLeg(ctx, 2, 'owned_handover');
        (0, vitest_1.expect)(hall.updateOrder).toHaveBeenCalledWith(ctx, 2, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ hallStatus: 'delivered', deliveryStatus: 'delivered' }),
        }));
        (0, vitest_1.expect)(notify.user).toHaveBeenCalledWith(ctx, 2, 'orderDelivered');
        (0, vitest_1.expect)(res).toEqual({ ok: true, done: true });
    });
    (0, vitest_1.it)('状态与线路不符（自营 plan 但仍是 merchant_delivering）→ 拒绝', async () => {
        const { svc } = makeEnv({ id: 3, code: 'A3', customFields: { fulfillmentRoute: 'R1', deliveryPlan: 'owned', hallStatus: 'merchant_delivering' } });
        await (0, vitest_1.expect)(svc.completeFirstLeg(ctx, 3, 'owned_handover')).rejects.toThrow('第一段已送达或订单状态已变更');
    });
});
(0, vitest_1.describe)('ThirdPartyDeliveryService.onDeliveryStatus 回调幂等', () => {
    function makeEnv(order) {
        const orderRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(order) };
        const channelRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(null) };
        const cfgRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(null) };
        const hall = {
            updateOrder: vitest_1.vi.fn().mockResolvedValue({}),
            enterHallForHandover: vitest_1.vi.fn().mockResolvedValue({}),
        };
        const notify = { user: vitest_1.vi.fn() };
        const conn = {
            getRepository: vitest_1.vi.fn(() => orderRepo),
            rawConnection: {
                getRepository: vitest_1.vi.fn((ent) => (ent.name === 'Channel' ? channelRepo : cfgRepo)),
            },
        };
        const svc = new third_party_delivery_service_1.ThirdPartyDeliveryService(conn, hall, notify, {});
        return { svc, hall, notify };
    }
    const ctx = { channelId: 1 };
    const update = (status) => ({ orderId: 1, thirdPartyNo: 'TP1', status });
    (0, vitest_1.it)('送达回调落在已进大厅的单 → 只补状态，不二次入厅（防重复派送/分成）', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'open', handoverMode: 'to_campus_rider' },
        });
        await svc.onDeliveryStatus(ctx, update('delivered'));
        (0, vitest_1.expect)(hall.enterHallForHandover).not.toHaveBeenCalled();
        (0, vitest_1.expect)(hall.updateOrder).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(hall.updateOrder.mock.calls[0][2].customFields).toEqual(vitest_1.expect.objectContaining({ thirdPartyState: 'delivered' }));
        (0, vitest_1.expect)(hall.updateOrder.mock.calls[0][2].customFields.hallStatus).toBeUndefined();
    });
    (0, vitest_1.it)('送达后的乱序回调 → 忽略，不回退状态', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'delivered', hallStatus: 'delivered' },
        });
        await svc.onDeliveryStatus(ctx, update('accepted'));
        (0, vitest_1.expect)(hall.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('同状态重复回调 → 忽略', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party' },
        });
        await svc.onDeliveryStatus(ctx, update('pickup'));
        (0, vitest_1.expect)(hall.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('乱序回退（pickup 后收到 accepted）→ 忽略', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party' },
        });
        await svc.onDeliveryStatus(ctx, update('accepted'));
        (0, vitest_1.expect)(hall.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('仍处 third_party 的送达回调 → 正常入厅接力', async () => {
        const { svc, hall } = makeEnv({
            id: 1, code: 'A1',
            customFields: { thirdPartyState: 'pickup', hallStatus: 'third_party', handoverMode: 'to_campus_rider' },
        });
        await svc.onDeliveryStatus(ctx, update('delivered'));
        (0, vitest_1.expect)(hall.enterHallForHandover).toHaveBeenCalledWith(vitest_1.expect.anything(), 1, 'external_handover');
    });
});
//# sourceMappingURL=third-party-delivery.spec.js.map