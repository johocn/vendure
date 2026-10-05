"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dispatch_job_service_1 = require("./dispatch-job.service");
function makeEnv(opts) {
    var _a, _b;
    const grabResults = [];
    const grabSvc = {
        grabByRider: vitest_1.vi.fn().mockImplementation((_ctx, orderId, rider) => {
            grabResults.push({ orderId, riderId: rider.id });
            return Promise.resolve({ id: orderId });
        }),
    };
    const creditSvc = { adjust: vitest_1.vi.fn().mockResolvedValue(95) };
    const hallSvc = {
        backToHall: vitest_1.vi.fn().mockResolvedValue({}),
        updateOrder: vitest_1.vi.fn().mockResolvedValue({}),
    };
    const capacitySvc = { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue((_a = opts.onlineRiders) !== null && _a !== void 0 ? _a : []) };
    const orderRepo = {
        findOne: vitest_1.vi.fn(),
        createQueryBuilder: () => {
            var _a, _b;
            return ({
                leftJoin: vitest_1.vi.fn().mockReturnThis(),
                where: vitest_1.vi.fn().mockReturnThis(),
                andWhere: vitest_1.vi.fn().mockReturnThis(),
                getMany: vitest_1.vi.fn().mockResolvedValue([...((_a = opts.openOrders) !== null && _a !== void 0 ? _a : []), ...((_b = opts.assignedOrders) !== null && _b !== void 0 ? _b : [])]),
            });
        },
    };
    const configRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_b = opts.cfg) !== null && _b !== void 0 ? _b : { autoAssignMinutes: 10, autoRefundMinutes: 30, inProgressSlaMinutes: 45 }) };
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
            if (name === 'Refund')
                return refundRepo;
            return orderRepo;
        }),
        rawConnection: { getRepository: vitest_1.vi.fn((_ent) => refundRepo) },
    };
    const svc = new dispatch_job_service_1.DispatchJobService(conn, grabSvc, hallSvc, capacitySvc, creditSvc, { get: vitest_1.vi.fn() });
    return { svc, grabSvc, creditSvc, hallSvc, capacitySvc, orderRepo, configRepo, grabResults };
}
const now = Date.now();
const minAgo = (m) => new Date(now - m * 60000);
(0, vitest_1.describe)('DispatchJobService.scan', () => {
    (0, vitest_1.it)('open 超 autoAssignMinutes → 强派最佳在线骑手', async () => {
        const { svc, grabSvc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults[0]).toEqual({ orderId: 1, riderId: 7 }); // 信用分高者优先
        (0, vitest_1.expect)(grabSvc.grabByRider).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('低信用分(<60)骑手不参与强派', async () => {
        const { svc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [{ id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 59 } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults).toHaveLength(0);
    });
    (0, vitest_1.it)('assigned 超 15min 未取货 → 回大厅 + 扣 10 分', async () => {
        const { svc, hallSvc, creditSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(16), hallEnteredAt: minAgo(20) } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.backToHall).toHaveBeenCalledWith(vitest_1.expect.anything(), 2);
        (0, vitest_1.expect)(creditSvc.adjust).toHaveBeenCalledWith(vitest_1.expect.anything(), 9, -10, 'timeout_not_picked', 2);
    });
    (0, vitest_1.it)('assigned 未超 15min 不动', async () => {
        const { svc, hallSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.backToHall).not.toHaveBeenCalled();
    });
});
/** 预注入 T4 依赖的惰性私有服务（绕过 lazy init，injector 不会被真调） */
function injectT4Services(svc) {
    svc['orderSvc'] = {
        refundOrder: vitest_1.vi.fn().mockResolvedValue({ id: 77 }),
        settleRefund: vitest_1.vi.fn().mockResolvedValue({}),
        transitionToState: vitest_1.vi.fn().mockResolvedValue({}),
    };
    svc['paymentRepo'] = { findOne: vitest_1.vi.fn().mockResolvedValue({ id: 55, amount: 8800 }) };
    svc['couponSvc'] = { grantCoupon: vitest_1.vi.fn().mockResolvedValue([]) };
}
(0, vitest_1.describe)('DispatchJobService.scan T4 自动退款', () => {
    (0, vitest_1.it)('open 超 autoRefundMinutes → 退款 + Cancelled + cause=no_rider + 补偿券', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30, compensationCouponTemplateId: '9' },
        });
        injectT4Services(env.svc);
        const orderSvc = env.svc.orderSvc;
        const couponSvc = env.svc.couponSvc;
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(orderSvc.refundOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({
            paymentId: 55,
            amount: 8800,
            shipping: 0, // fork refund 表 shipping/adjustment 列 NOT NULL，必须显式传 0
            adjustment: 0,
        }));
        (0, vitest_1.expect)(orderSvc.settleRefund).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(orderSvc.transitionToState).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, 'Cancelled');
        (0, vitest_1.expect)(couponSvc.grantCoupon).toHaveBeenCalledWith(vitest_1.expect.anything(), '9', [vitest_1.expect.anything()]);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });
    (0, vitest_1.it)('未配置补偿券模板 → 不发券不报错，退款照常', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        injectT4Services(env.svc);
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.svc.couponSvc.grantCoupon).not.toHaveBeenCalled();
        (0, vitest_1.expect)(env.svc.orderSvc.transitionToState).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, 'Cancelled');
        (0, vitest_1.expect)(env.hallSvc.updateOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });
    (0, vitest_1.it)('幂等重试：上轮已全额退款（transition 失败残留）→ 跳过 refundOrder 只做取消+标记', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
            refundedSum: 8800, // 已退全额
        });
        injectT4Services(env.svc);
        const orderSvc = env.svc.orderSvc;
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(orderSvc.refundOrder).not.toHaveBeenCalled();
        (0, vitest_1.expect)(orderSvc.settleRefund).not.toHaveBeenCalled();
        (0, vitest_1.expect)(orderSvc.transitionToState).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, 'Cancelled');
        (0, vitest_1.expect)(env.hallSvc.updateOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });
});
//# sourceMappingURL=dispatch-job.service.spec.js.map