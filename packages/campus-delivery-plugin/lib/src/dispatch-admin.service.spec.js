"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dispatch_admin_service_1 = require("./dispatch-admin.service");
function makeEnv(opts = {}) {
    var _a, _b, _c, _d;
    const grabSvc = { grabByRider: vitest_1.vi.fn().mockResolvedValue(true) };
    const hallSvc = { backToHall: vitest_1.vi.fn().mockResolvedValue({}) };
    const capacitySvc = { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue((_a = opts.onlineRiders) !== null && _a !== void 0 ? _a : []) };
    const orderRepo = {
        findOne: vitest_1.vi.fn(),
        update: vitest_1.vi.fn().mockResolvedValue({}),
        createQueryBuilder: () => {
            var _a;
            return ({
                leftJoin: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                andWhere: vitest_1.vi.fn().mockReturnThis(),
                getMany: vitest_1.vi.fn().mockResolvedValue((_a = opts.orders) !== null && _a !== void 0 ? _a : []),
            });
        },
    };
    const configRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.cfg) !== null && _b !== void 0 ? _b : { autoAssignMinutes: 10, inProgressSlaMinutes: 45 }),
    };
    const paymentRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_c = opts.payment) !== null && _c !== void 0 ? _c : null) };
    const refundRepo = {
        createQueryBuilder: () => {
            var _a;
            return ({
                select: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                getRawOne: vitest_1.vi.fn().mockResolvedValue({ sum: String((_a = opts.refundedSum) !== null && _a !== void 0 ? _a : 0) }),
            });
        },
    };
    const conn = {
        getRepository: vitest_1.vi.fn((_ctx, ent) => {
            const name = ent.name;
            if (name === 'CampusFulfillmentConfig')
                return configRepo;
            return orderRepo;
        }),
        rawConnection: {
            getRepository: vitest_1.vi.fn((ent) => {
                var _a;
                const name = (_a = ent.name) !== null && _a !== void 0 ? _a : ent;
                if (name === 'Payment')
                    return paymentRepo;
                return refundRepo;
            }),
        },
    };
    const svc = new dispatch_admin_service_1.DispatchAdminService(conn, grabSvc, hallSvc, capacitySvc, {});
    // 测试直接注入惰性服务，绕过 ModuleRef/require（handleException 专用）
    const orderSvc = (_d = opts.orderSvc) !== null && _d !== void 0 ? _d : {
        refundOrder: vitest_1.vi.fn().mockResolvedValue({ id: 55 }),
        settleRefund: vitest_1.vi.fn().mockResolvedValue({}),
        cancelOrder: vitest_1.vi.fn().mockResolvedValue({}),
    };
    svc.orderSvc = orderSvc;
    return { svc, grabSvc, hallSvc, capacitySvc, orderRepo, configRepo, paymentRepo, refundRepo, orderSvc };
}
const now = Date.now();
const minAgo = (m) => new Date(now - m * 60000);
const exceptionOrder = (id, code, extra = {}) => ({
    id,
    code,
    customerId: 160,
    customFields: Object.assign({ hallStatus: 'grabbed', deliveryStatus: 'exception', exceptionType: 'food_spilled' }, extra),
});
(0, vitest_1.describe)('DispatchAdminService.board', () => {
    (0, vitest_1.it)('滞留超 autoAssignMinutes 的 open 单 → alert stale_open', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(12), campusZone: 'A区' } }],
            cfg: { autoAssignMinutes: 10, inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '1', type: 'stale_open' }));
    });
    (0, vitest_1.it)('open 未超时 → 不告警，进 hallOrders', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } }],
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts).toHaveLength(0);
        (0, vitest_1.expect)(board.hallOrders).toHaveLength(1);
        (0, vitest_1.expect)(board.activeOrders).toHaveLength(0);
    });
    (0, vitest_1.it)('in_progress 超 SLA → alert sla_breach', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 2, code: 'A2', customFields: { hallStatus: 'grabbed', deliveryStatus: 'in_progress', assignedAt: minAgo(50) } }],
            cfg: { inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '2', type: 'sla_breach' }));
        (0, vitest_1.expect)(board.activeOrders).toHaveLength(1);
    });
    (0, vitest_1.it)('campusCause=slot_full → alert slot_full', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 3, code: 'A3', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(1), campusCause: 'slot_full' } }],
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.alerts[0]).toEqual(vitest_1.expect.objectContaining({ orderId: '3', type: 'slot_full' }));
    });
    (0, vitest_1.it)('exception_final 已处置完结单 → 不进墙，进 handledOrders 留痕（plan 3.4）', async () => {
        const { svc } = makeEnv({
            orders: [
                exceptionOrder(9, 'A9', { hallStatus: 'exception_final', exceptionAction: 'refund_diff', exceptionCompensation: 300, exceptionHandledAt: minAgo(2), exceptionHandledBy: '3' }),
                { id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } },
            ],
        });
        const board = await svc.board({ channelId: 1 });
        (0, vitest_1.expect)(board.hallOrders).toHaveLength(1);
        (0, vitest_1.expect)(board.activeOrders).toHaveLength(0);
        (0, vitest_1.expect)(board.handledOrders).toEqual([
            vitest_1.expect.objectContaining({ orderId: '9', orderCode: 'A9', action: 'refund_diff', compensation: 300, handledBy: '3' }),
        ]);
    });
});
(0, vitest_1.describe)('DispatchAdminService.handleException', () => {
    const ctx = { channelId: 1, activeUserId: 3 };
    (0, vitest_1.it)('非异常单拒绝处置', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue({ id: 5, code: 'A5', customFields: { deliveryStatus: 'in_progress' } });
        await (0, vitest_1.expect)(svc.handleException(ctx, 5, 'refund_diff', 300)).rejects.toThrow('仅骑手上报异常的订单可处置');
    });
    (0, vitest_1.it)('reassign：回大厅 + 留痕，不置 exception_final', async () => {
        const { svc, orderRepo, hallSvc } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(6, 'A6'));
        const res = await svc.handleException(ctx, 6, 'reassign', undefined, undefined, '改派');
        (0, vitest_1.expect)(res).toEqual({ ok: true, action: 'reassign' });
        (0, vitest_1.expect)(hallSvc.backToHall).toHaveBeenCalledWith(ctx, 6);
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        (0, vitest_1.expect)(patch).toEqual(vitest_1.expect.objectContaining({ exceptionAction: 'reassign', exceptionHandledNote: '改派', exceptionHandledBy: '3' }));
        (0, vitest_1.expect)(patch.hallStatus).toBeUndefined();
    });
    (0, vitest_1.it)('refund_diff：部分退款（shipping/adjustment 显式 0）+ settleRefund + exception_final 留痕', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({
            payment: { id: 9, amount: 2300 },
            refundedSum: 0,
        });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await svc.handleException(ctx, 7, 'refund_diff', 300, undefined, '洒漏赔付');
        (0, vitest_1.expect)(orderSvc.refundOrder).toHaveBeenCalledWith(ctx, vitest_1.expect.objectContaining({
            paymentId: 9, amount: 300, shipping: 0, adjustment: 0,
        }));
        (0, vitest_1.expect)(orderSvc.settleRefund).toHaveBeenCalledWith(ctx, { id: 55 });
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        (0, vitest_1.expect)(patch).toEqual(vitest_1.expect.objectContaining({
            exceptionAction: 'refund_diff', exceptionCompensation: 300, hallStatus: 'exception_final',
        }));
    });
    (0, vitest_1.it)('refund_diff 超可退余额（已全额退）→ 拒绝', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({ refundedSum: 2300 });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await (0, vitest_1.expect)(svc.handleException(ctx, 7, 'refund_diff', 100)).rejects.toThrow('退款金额超过可退余额');
        (0, vitest_1.expect)(orderSvc.refundOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('refund_diff 金额 ≤0 / 无支付记录 → 拒绝', async () => {
        const { svc, orderRepo, paymentRepo } = makeEnv({ payment: null });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await (0, vitest_1.expect)(svc.handleException(ctx, 7, 'refund_diff', 0)).rejects.toThrow('赔付金额必须大于 0');
        paymentRepo.findOne.mockResolvedValue(null);
        await (0, vitest_1.expect)(svc.handleException(ctx, 7, 'refund_diff', 300)).rejects.toThrow('订单无支付记录');
    });
    (0, vitest_1.it)('coupon：发补偿券 + exception_final 留痕', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(8, 'A8'));
        svc.couponSvc = { grantCoupon: vitest_1.vi.fn().mockResolvedValue(['CODE1']) };
        await svc.handleException(ctx, 8, 'coupon', undefined, '9', '无骑手补偿');
        (0, vitest_1.expect)(svc.couponSvc.grantCoupon).toHaveBeenCalledWith(ctx, '9', [160]);
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        (0, vitest_1.expect)(patch).toEqual(vitest_1.expect.objectContaining({
            exceptionAction: 'coupon', exceptionCouponTemplateId: '9', hallStatus: 'exception_final',
        }));
    });
    (0, vitest_1.it)('coupon 未选模板 → 拒绝', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(8, 'A8'));
        await (0, vitest_1.expect)(svc.handleException(ctx, 8, 'coupon')).rejects.toThrow('请选择补偿券模板');
    });
    (0, vitest_1.it)('refund_all：退剩余全额 + cancelOrder + campusCause=exception_refund', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({ refundedSum: 300 });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(10, 'A10'));
        await svc.handleException(ctx, 10, 'refund_all');
        // 已退 300，剩余 2000 补退
        (0, vitest_1.expect)(orderSvc.refundOrder).toHaveBeenCalledWith(ctx, vitest_1.expect.objectContaining({ paymentId: 9, amount: 2000 }));
        (0, vitest_1.expect)(orderSvc.cancelOrder).toHaveBeenCalledWith(ctx, vitest_1.expect.objectContaining({ orderId: 10 }));
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        (0, vitest_1.expect)(patch).toEqual(vitest_1.expect.objectContaining({
            exceptionAction: 'refund_all', hallStatus: 'exception_final', campusCause: 'exception_refund',
        }));
    });
});
//# sourceMappingURL=dispatch-admin.service.spec.js.map