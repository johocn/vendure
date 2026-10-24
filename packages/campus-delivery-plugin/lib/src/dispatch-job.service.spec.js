"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dispatch_job_service_1 = require("./dispatch-job.service");
function makeEnv(opts) {
    var _a, _b, _c, _d;
    const grabResults = [];
    const grabSvc = {
        grabByRider: vitest_1.vi.fn().mockImplementation((_ctx, orderId, rider) => {
            grabResults.push({ orderId, riderId: rider.id });
            return Promise.resolve({ id: orderId });
        }),
    };
    const creditSvc = { adjust: vitest_1.vi.fn().mockResolvedValue(95) };
    const allOrders = [...((_a = opts.openOrders) !== null && _a !== void 0 ? _a : []), ...((_b = opts.assignedOrders) !== null && _b !== void 0 ? _b : [])];
    const hallSvc = {
        backToHall: vitest_1.vi.fn().mockResolvedValue(true),
        updateOrder: vitest_1.vi.fn().mockResolvedValue({}),
        // 状态迁移改走条件写（CAS）；默认命中，用例可 mockResolvedValueOnce(false) 模拟并发脱厅
        transitionFrom: vitest_1.vi.fn().mockResolvedValue(true),
        releaseScheduled: vitest_1.vi.fn().mockResolvedValue(true),
    };
    const capacitySvc = { listOnlineRiders: vitest_1.vi.fn().mockResolvedValue((_c = opts.onlineRiders) !== null && _c !== void 0 ? _c : []) };
    const orderRepo = {
        // T4 锁内复查 / 商家拒单复查用：默认回放扫描到的订单快照
        findOne: vitest_1.vi.fn().mockImplementation(({ where }) => {
            var _a;
            return Promise.resolve((_a = allOrders.find(o => String(o.id) === String(where === null || where === void 0 ? void 0 : where.id))) !== null && _a !== void 0 ? _a : null);
        }),
        update: vitest_1.vi.fn().mockResolvedValue({}),
        createQueryBuilder: () => ({
            leftJoin: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            addOrderBy: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getMany: vitest_1.vi.fn().mockResolvedValue([...allOrders]),
        }),
    };
    const configRepo = { findOne: vitest_1.vi.fn().mockResolvedValue((_d = opts.cfg) !== null && _d !== void 0 ? _d : { autoAssignMinutes: 10, autoRefundMinutes: 30, inProgressSlaMinutes: 45 }) };
    const refundRepo = {
        // 部分退款支付单查询：可退支付单（state 必须是 Settled/Authorized）
        find: vitest_1.vi.fn().mockResolvedValue([{ id: 55, amount: 8800, state: 'Settled' }]),
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
        rawConnection: {
            getRepository: vitest_1.vi.fn((_ent) => refundRepo),
            // 超时赔付闸 CAS（UPDATE ... WHERE timeoutcompensatedat IS NULL RETURNING id）：默认命中
            query: vitest_1.vi.fn().mockImplementation((sql, params) => {
                var _a;
                // 打包条件写：回放命中的 id（模拟全部仍 open）
                if (String(sql).includes('"customFieldsRoutegroupid"')) {
                    return Promise.resolve([((_a = params === null || params === void 0 ? void 0 : params[1]) !== null && _a !== void 0 ? _a : []).map(id => ({ id })), []]);
                }
                return Promise.resolve([[{ id: 30 }], []]);
            }),
            // 退款并发咨询锁 / 扫描多实例锁：默认抢锁成功
            createQueryRunner: () => ({
                connect: vitest_1.vi.fn().mockResolvedValue(undefined),
                query: vitest_1.vi.fn().mockResolvedValue([[{ ok: true }], []]),
                release: vitest_1.vi.fn().mockResolvedValue(undefined),
            }),
        },
    };
    const svc = new dispatch_job_service_1.DispatchJobService(conn, grabSvc, hallSvc, capacitySvc, creditSvc, { get: vitest_1.vi.fn() });
    return { svc, grabSvc, creditSvc, hallSvc, capacitySvc, orderRepo, configRepo, grabResults, rawQuery: conn.rawConnection.query };
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
    (0, vitest_1.it)('T2 轮转派单：多单超时不全部塞给信用最高的一人', async () => {
        const { svc, grabResults } = makeEnv({
            openOrders: [
                { id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(20) } },
                { id: 2, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(15) } },
            ],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults).toEqual([
            { orderId: 1, riderId: 7 }, // 同负载 → 信用高者优先
            { orderId: 2, riderId: 8 }, // 7 已 +1 单，负载更低者接下一单
        ]);
    });
    (0, vitest_1.it)('T2 负载均衡：信用最高者已有 2 单在途 → 新超时单派给空闲骑手', async () => {
        const { svc, grabResults } = makeEnv({
            assignedOrders: [
                { id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '7', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } },
                { id: 3, customFields: { hallStatus: 'grabbed', deliveryStatus: 'in_progress', deliveryStaffId: '7', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } },
            ],
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(grabResults[0]).toEqual({ orderId: 1, riderId: 8 });
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
(0, vitest_1.describe)('DispatchJobService.scan 预约单放量（plan 3.1）', () => {
    (0, vitest_1.it)('scheduledFor 进入 30min 窗口 → releaseScheduled 放量', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 11, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 10 * 60000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 }, // merchantConfirmEnabled 未启用
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.releaseScheduled).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(hallSvc.releaseScheduled).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({ id: 11 }), vitest_1.expect.anything());
    });
    (0, vitest_1.it)('scheduledFor 距今超 30min → 不放量', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 11, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 60 * 60000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.releaseScheduled).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('商家确认模式渠道 → 放量进入 pending_merchant（走 T2 前不误强派）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 12, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 5 * 60000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30, merchantConfirmEnabled: true },
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.releaseScheduled).toHaveBeenCalledOnce();
        // 放量后进 pending_merchant，无 open 单，T2 不触发
        (0, vitest_1.expect)(env.grabSvc.grabByRider).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('scheduled 缺 scheduledFor → 永不放量（脏数据保护）', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 13, customFields: { hallStatus: 'scheduled' } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.releaseScheduled).not.toHaveBeenCalled();
    });
});
/** 预注入 T4 依赖的惰性私有服务（绕过 lazy init，injector 不会被真调） */
function injectT4Services(svc) {
    svc['orderSvc'] = {
        refundOrder: vitest_1.vi.fn().mockResolvedValue({ id: 77 }),
        settleRefund: vitest_1.vi.fn().mockResolvedValue({}),
        cancelOrder: vitest_1.vi.fn().mockResolvedValue({ id: 4 }),
    };
    svc['couponSvc'] = { grantCoupon: vitest_1.vi.fn().mockResolvedValue([]) };
}
(0, vitest_1.describe)('DispatchJobService.scan 异常超时升级', () => {
    (0, vitest_1.it)('异常上报超 SLA 未处置 → 自动回大厅重派', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{
                    id: 9, code: 'E1', createdAt: minAgo(90),
                    customFields: { hallStatus: 'grabbed', deliveryStatus: 'exception', exceptionReportedAt: minAgo(60) },
                }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.backToHall).not.toHaveBeenCalled();
        (0, vitest_1.expect)(hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 9, vitest_1.expect.any(Array), vitest_1.expect.objectContaining({
            hallStatus: 'open',
            campusCause: 'exception_timeout',
            // 重派即新骑手接手：旧异常痕迹必须清空，否则新骑手端仍显示异常单
            exceptionReportedAt: null,
            exceptionType: null,
            exceptionPhotos: null,
            deliveryStatus: null,
            deliveryStaffId: null,
        }));
    });
    (0, vitest_1.it)('异常上报未超 SLA → 保持不动', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{
                    id: 9, code: 'E1', createdAt: minAgo(30),
                    customFields: { hallStatus: 'grabbed', deliveryStatus: 'exception', exceptionReportedAt: minAgo(10) },
                }],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(hallSvc.transitionFrom).not.toHaveBeenCalled();
    });
});
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
        (0, vitest_1.expect)(orderSvc.cancelOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({ orderId: 4 }));
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
        (0, vitest_1.expect)(env.svc.orderSvc.cancelOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({ orderId: 4 }));
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
        (0, vitest_1.expect)(orderSvc.cancelOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({ orderId: 4 }));
        (0, vitest_1.expect)(env.hallSvc.updateOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 4, vitest_1.expect.objectContaining({
            customFields: vitest_1.expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });
    (0, vitest_1.it)('锁内复查：等锁期间订单已被抢单/取消 → 不退款也不标记', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        injectT4Services(env.svc);
        const orderSvc = env.svc.orderSvc;
        env.orderRepo.findOne.mockResolvedValueOnce({ id: 4, customFields: { hallStatus: 'grabbed' } });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(orderSvc.refundOrder).not.toHaveBeenCalled();
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalledWith(vitest_1.expect.anything(), 4, vitest_1.expect.anything());
    });
    (0, vitest_1.it)('单笔退款异常不阻断本轮其余订单（逐单隔离）', async () => {
        const env = makeEnv({
            openOrders: [
                { id: 4, code: 'T4A', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } },
                { id: 5, code: 'T4B', customerId: 502, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(32) } },
            ],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        injectT4Services(env.svc);
        const refundSpy = vitest_1.vi.spyOn(env.svc, 'refundNoRider').mockRejectedValueOnce(new Error('refund boom'));
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(refundSpy).toHaveBeenCalledTimes(2); // 第二单仍继续处理
    });
});
(0, vitest_1.describe)('DispatchJobService.scan 多单顺路打包 T1.5（plan 3.3）', () => {
    const fresh = (id, cf) => ({
        id,
        createdAt: minAgo(20),
        customFields: Object.assign({ hallStatus: 'open', hallEnteredAt: minAgo(1), fulfillmentRoute: 'R1' }, cf),
    });
    // 打包已改裸 SQL 条件写：从 rawConnection.query 调用中筛出 routeGroupId 写入
    const packCalls = (rawQuery) => rawQuery.mock.calls.filter((c) => String(c[0]).includes('"customFieldsRoutegroupid"'));
    (0, vitest_1.it)('同楼栋+同时段 2 单 → 写同一 routeGroupId', async () => {
        const { svc, rawQuery } = makeEnv({
            openOrders: [
                fresh(1, { buildingId: 'b1', deliverySlotId: '11', deliverySlotText: '11:00-11:30' }),
                fresh(2, { buildingId: 'b1', deliverySlotId: '11', deliverySlotText: '11:00-11:30' }),
            ],
        });
        await svc.scan({ channelId: 1 });
        const calls = packCalls(rawQuery);
        (0, vitest_1.expect)(calls).toHaveLength(1);
        const [sql, params] = calls[0];
        // 条件写：仅 open 且未取消的单
        (0, vitest_1.expect)(String(sql)).toContain('"customFieldsHallstatus" = $3');
        (0, vitest_1.expect)(params[1]).toEqual([1, 2]);
        (0, vitest_1.expect)(params[2]).toBe('open');
        (0, vitest_1.expect)(params[0]).toMatch(/^rg-/);
    });
    (0, vitest_1.it)('不同楼栋不成组', async () => {
        const { svc, rawQuery } = makeEnv({
            openOrders: [
                fresh(1, { buildingId: 'b1', deliverySlotId: '11' }),
                fresh(2, { buildingId: 'b2', deliverySlotId: '11' }),
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(packCalls(rawQuery)).toHaveLength(0);
    });
    (0, vitest_1.it)('即时单同楼栋入厅差 ≤10min 成组，超窗不成组', async () => {
        const near = { id: 1, createdAt: minAgo(20), customFields: { hallStatus: 'open', fulfillmentRoute: 'R1', buildingId: 'b1', hallEnteredAt: minAgo(9) } };
        const near2 = { id: 2, createdAt: minAgo(19), customFields: { hallStatus: 'open', fulfillmentRoute: 'R1', buildingId: 'b1', hallEnteredAt: minAgo(1) } };
        const far = { id: 3, createdAt: minAgo(40), customFields: { hallStatus: 'open', fulfillmentRoute: 'R1', buildingId: 'b1', hallEnteredAt: minAgo(30) } };
        const env = makeEnv({ openOrders: [near, near2, far] });
        await env.svc.scan({ channelId: 1 });
        const [, ids] = packCalls(env.rawQuery)[0][1];
        (0, vitest_1.expect)([...ids].sort()).toEqual([1, 2]); // far 单差 29min 不入组
    });
    (0, vitest_1.it)('errand 跑腿单不打包', async () => {
        const { svc, rawQuery } = makeEnv({
            openOrders: [
                fresh(1, { buildingId: 'b1' }),
                fresh(2, { buildingId: 'b1', fulfillmentRoute: undefined, orderKind: 'errand' }),
            ],
        });
        await svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(packCalls(rawQuery)).toHaveLength(0);
    });
    (0, vitest_1.it)('批内已有 routeGroupId → 复用不重生成', async () => {
        const { svc, rawQuery } = makeEnv({
            openOrders: [
                fresh(1, { buildingId: 'b1', deliverySlotId: '11', routeGroupId: 'rg-old' }),
                fresh(2, { buildingId: 'b1', deliverySlotId: '11' }),
            ],
        });
        await svc.scan({ channelId: 1 });
        const calls = packCalls(rawQuery);
        (0, vitest_1.expect)(calls).toHaveLength(1);
        const [, params] = calls[0];
        (0, vitest_1.expect)(params[0]).toBe('rg-old');
        (0, vitest_1.expect)(params[1]).toEqual([2]); // 已带组 id 的单不再 update
    });
});
(0, vitest_1.describe)('DispatchJobService.scan 路线超时兜底（R1–R3）', () => {
    const cfg = { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 };
    (0, vitest_1.it)('R1 商户接单超时 → 转自营快递（owned_dispatched）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 21, code: 'R1T', createdAt: minAgo(10), customFields: { hallStatus: 'pending_merchant', fulfillmentRoute: 'R1', deliveryPlan: 'merchant' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAcceptMinutes: 5 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 21, ['pending_merchant'], vitest_1.expect.objectContaining({
            hallStatus: 'owned_dispatched',
            deliveryPlan: 'owned',
            campusCause: 'merchant_accept_timeout',
        }));
    });
    (0, vitest_1.it)('R2 商户接单超时 → 降级传信者到店取餐直送（open）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 24, code: 'R2A', createdAt: minAgo(10), customFields: { hallStatus: 'pending_merchant', fulfillmentRoute: 'R2', deliveryPlan: 'external_courier' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAcceptMinutes: 5 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 24, ['pending_merchant'], vitest_1.expect.objectContaining({
            hallStatus: 'open',
            deliveryPlan: 'campus_rider',
            campusCause: 'merchant_accept_timeout',
        }));
    });
    (0, vitest_1.it)('R2 已接单但久未出餐 → 降级传信者到店取餐直送（open）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 25, code: 'R2C', createdAt: minAgo(40), customFields: { hallStatus: 'accepted', fulfillmentRoute: 'R2', deliveryPlan: 'external_courier' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAutoOpenMinutes: 15 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 25, ['accepted'], vitest_1.expect.objectContaining({
            hallStatus: 'open',
            deliveryPlan: 'campus_rider',
            campusCause: 'merchant_cooking_timeout',
        }));
    });
    (0, vitest_1.it)('R1 商户久未送达交接点 → 回大厅由传信者取餐', async () => {
        const env = makeEnv({
            openOrders: [{ id: 22, code: 'R1D', createdAt: minAgo(40), customFields: { hallStatus: 'merchant_delivering', fulfillmentRoute: 'R1', deliveryPlan: 'merchant', assignedAt: minAgo(20) } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAutoOpenMinutes: 15 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 22, ['merchant_delivering'], vitest_1.expect.objectContaining({
            hallStatus: 'open',
            deliveryPlan: 'campus_rider',
            campusCause: 'merchant_deliver_timeout',
        }));
    });
    (0, vitest_1.it)('R2 迟迟未推送外部快递 → 回大厅', async () => {
        const env = makeEnv({
            openOrders: [{ id: 23, code: 'R2P', createdAt: minAgo(30), customFields: { hallStatus: 'pending_dispatch', fulfillmentRoute: 'R2', deliveryPlan: 'external_courier' } }],
            cfg: Object.assign(Object.assign({}, cfg), { externalPushTimeoutMinutes: 10 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 23, ['pending_dispatch'], vitest_1.expect.objectContaining({
            hallStatus: 'open', campusCause: 'external_push_timeout',
        }));
    });
    (0, vitest_1.it)('R3 外部快递久未接单 → 取消并回抢单大厅；R2 回待推送', async () => {
        const env = makeEnv({
            openOrders: [
                { id: 24, code: 'R3F', createdAt: minAgo(40), customFields: { hallStatus: 'third_party', fulfillmentRoute: 'R3', deliveryPlan: 'external_courier', thirdPartyDispatchAt: minAgo(30) } },
                { id: 25, code: 'R2F', createdAt: minAgo(40), customFields: { hallStatus: 'third_party', fulfillmentRoute: 'R2', deliveryPlan: 'external_courier', thirdPartyDispatchAt: minAgo(30) } },
            ],
            cfg: Object.assign(Object.assign({}, cfg), { externalFallbackMinutes: 20 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 24, ['third_party'], vitest_1.expect.objectContaining({
            hallStatus: 'open', campusCause: 'external_fallback',
        }));
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 25, ['third_party'], vitest_1.expect.objectContaining({
            hallStatus: 'pending_dispatch', campusCause: 'external_fallback',
        }));
    });
    (0, vitest_1.it)('外部取消失败 → 保持 third_party 不回落重推（防双运单双份运费）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 30, code: 'R3C', createdAt: minAgo(40), customFields: { hallStatus: 'third_party', fulfillmentRoute: 'R3', deliveryPlan: 'external_courier', thirdPartyDispatchAt: minAgo(30) } }],
            cfg: Object.assign(Object.assign({}, cfg), { externalFallbackMinutes: 20 }),
        });
        // 注入外部网关：取消返回失败
        env.svc.thirdParty = { cancel: vitest_1.vi.fn().mockResolvedValue({ ok: false, reason: 'platform busy' }) };
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 30, ['third_party'], {
            campusCause: 'external_cancel_failed',
        });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).not.toHaveBeenCalledWith(vitest_1.expect.anything(), 30, ['third_party'], vitest_1.expect.objectContaining({ hallStatus: 'open' }));
    });
    (0, vitest_1.it)('外部已接单/取货 → 超 fallback 也不取消（避免干掉在途骑手）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 26, code: 'R2A', createdAt: minAgo(60), customFields: { hallStatus: 'third_party', fulfillmentRoute: 'R2', deliveryPlan: 'external_courier', thirdPartyDispatchAt: minAgo(30), thirdPartyState: 'accepted' } }],
            cfg: Object.assign(Object.assign({}, cfg), { externalFallbackMinutes: 20 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('外部接单后超 3×fallback → 硬上限仍取消回落', async () => {
        const env = makeEnv({
            openOrders: [{ id: 27, code: 'R3A', createdAt: minAgo(90), customFields: { hallStatus: 'third_party', fulfillmentRoute: 'R3', deliveryPlan: 'external_courier', thirdPartyDispatchAt: minAgo(70), thirdPartyState: 'pickup' } }],
            cfg: Object.assign(Object.assign({}, cfg), { externalFallbackMinutes: 20 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 27, ['third_party'], vitest_1.expect.objectContaining({
            hallStatus: 'open', campusCause: 'external_fallback',
        }));
    });
    (0, vitest_1.it)('自营快递池久无人接单 → 回抢单大厅（传信者兜底）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 28, code: 'R3O', createdAt: minAgo(40), customFields: { hallStatus: 'owned_pool', fulfillmentRoute: 'R3', deliveryPlan: 'owned' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAutoOpenMinutes: 15 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 28, ['owned_pool'], vitest_1.expect.objectContaining({
            hallStatus: 'open', campusCause: 'owned_pool_timeout',
        }));
    });
    (0, vitest_1.it)('自营快递已派出久未送达 → 回抢单大厅并清空骑手', async () => {
        const env = makeEnv({
            openOrders: [{ id: 29, code: 'R1O', createdAt: minAgo(60), customFields: { hallStatus: 'owned_dispatched', fulfillmentRoute: 'R1', deliveryPlan: 'owned', assignedAt: minAgo(20), deliveryStaffId: '9' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAutoOpenMinutes: 15 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledWith(vitest_1.expect.anything(), 29, ['owned_dispatched'], vitest_1.expect.objectContaining({
            hallStatus: 'open', campusCause: 'owned_deliver_timeout',
            deliveryStaffId: null, assignedAt: null,
        }));
    });
    (0, vitest_1.it)('预约单刚放量：按 hallEnteredAt 计时，不被 createdAt 误判商家超时', async () => {
        const env = makeEnv({
            openOrders: [{
                    id: 31, code: 'SCH', createdAt: minAgo(300), // 预约单很早下单
                    customFields: { hallStatus: 'scheduled', fulfillmentRoute: 'R1', scheduledFor: new Date(now + 10 * 60000) },
                }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAcceptMinutes: 5 }),
        });
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.releaseScheduled).toHaveBeenCalledOnce();
        // 放量后锚点为当前时刻：不应同一轮触发 merchant_accept_timeout
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('CAS 未命中（并发取消/已改派）→ 跳过且不再继续后续兜底', async () => {
        const env = makeEnv({
            openOrders: [{ id: 32, code: 'CAS', createdAt: minAgo(40), customFields: { hallStatus: 'owned_pool', fulfillmentRoute: 'R3', deliveryPlan: 'owned' } }],
            cfg: Object.assign(Object.assign({}, cfg), { merchantAutoOpenMinutes: 15 }),
        });
        env.hallSvc.transitionFrom.mockResolvedValueOnce(false);
        await env.svc.scan({ channelId: 1 });
        (0, vitest_1.expect)(env.hallSvc.transitionFrom).toHaveBeenCalledOnce();
    });
});
/** 超时赔付专用环境：绕过 scan 的混合查询，直接替换仓库返回待判定送达单 */
function makeTimeoutEnv(opts) {
    var _a;
    const env = makeEnv({ cfg: Object.assign({ channelId: 1 }, opts.cfg) });
    const repo = {
        createQueryBuilder: vitest_1.vi.fn(() => ({
            leftJoin: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            addOrderBy: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getMany: vitest_1.vi.fn().mockResolvedValue(opts.orders),
        })),
    };
    // 券服务 mock 需固定实例（services() 每次调用都会重建对象，不能在里面新建 spy）
    const coupon = opts.coupon === null ? null : ((_a = opts.coupon) !== null && _a !== void 0 ? _a : { grantCoupon: vitest_1.vi.fn().mockResolvedValue(['coupon-1']) });
    const baseConn = env.svc.connection;
    env.svc.connection = { getRepository: vitest_1.vi.fn(() => repo), rawConnection: baseConn.rawConnection };
    env.svc.services = () => ({ order: null, coupon });
    return Object.assign(Object.assign({}, env), { coupon, repo, rawQuery: baseConn.rawConnection.query });
}
(0, vitest_1.describe)('DispatchJobService 超时赔付（P0）', () => {
    const cfgOn = { timeoutCompensationEnabled: true, timeoutGraceMinutes: 10, timeoutCompensationCouponTemplateId: 'T-LATE' };
    const deliveredOrder = (over = {}) => ({
        id: 31, code: 'TO1', customerId: '5', createdAt: minAgo(60),
        customFields: Object.assign({ promisedAt: new Date(now - 25 * 60000), deliveredAt: new Date(now), assignedAt: minAgo(58) }, over),
    });
    (0, vitest_1.it)('超出承诺 + 宽限 → 先抢赔付闸（CAS）再发券并写归因', async () => {
        const env = makeTimeoutEnv({ orders: [deliveredOrder()], cfg: cfgOn });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        // 先认领闸：UPDATE ... WHERE timeoutcompensatedat IS NULL（或过期僵死认领）RETURNING id
        (0, vitest_1.expect)(env.rawQuery).toHaveBeenCalledWith(vitest_1.expect.stringContaining('"customFieldsTimeoutcompensatedat" IS NULL'), [vitest_1.expect.any(Date), 31, vitest_1.expect.any(Date)]);
        (0, vitest_1.expect)(env.coupon.grantCoupon).toHaveBeenCalledWith(vitest_1.expect.anything(), 'T-LATE', ['5']);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).toHaveBeenCalledWith(vitest_1.expect.anything(), 31, {
            customFields: vitest_1.expect.objectContaining({
                timeoutLateMinutes: 25,
                timeoutCompensationCouponId: 'coupon-1',
                timeoutAttribution: 'rider',
            }),
        });
        // 闸已在认领时写入，最终留痕不重复写（避免覆盖认领时间）
        (0, vitest_1.expect)(env.hallSvc.updateOrder.mock.calls[0][2].customFields.timeoutCompensatedAt).toBeUndefined();
    });
    (0, vitest_1.it)('赔付闸已被上一轮抢占（认领失败）→ 不发券', async () => {
        const env = makeTimeoutEnv({ orders: [deliveredOrder()], cfg: cfgOn });
        env.rawQuery.mockResolvedValueOnce([[], []]);
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.coupon.grantCoupon).not.toHaveBeenCalled();
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('超时未过宽限 → 不赔', async () => {
        const env = makeTimeoutEnv({
            orders: [deliveredOrder({ promisedAt: new Date(now - 8 * 60000) })], cfg: cfgOn,
        });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('接单前耗时更长 → 归因 merchant', async () => {
        const env = makeTimeoutEnv({
            orders: [deliveredOrder({ assignedAt: minAgo(5), deliveredAt: new Date(now - 40 * 60000), promisedAt: new Date(now - 70 * 60000) })],
            cfg: cfgOn,
        });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder.mock.calls[0][2].customFields.timeoutAttribution).toBe('merchant');
    });
    (0, vitest_1.it)('全程无骑手承接 → 归因 platform', async () => {
        const env = makeTimeoutEnv({ orders: [deliveredOrder({ assignedAt: null })], cfg: cfgOn });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder.mock.calls[0][2].customFields.timeoutAttribution).toBe('platform');
    });
    (0, vitest_1.it)('开关关闭 → 整轮跳过（不发券不查询）', async () => {
        const env = makeTimeoutEnv({ orders: [deliveredOrder()], cfg: { timeoutCompensationEnabled: false } });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, { timeoutCompensationEnabled: false }, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('未配置券模板 → 不发券也不写闸（保留待赔资格）', async () => {
        const env = makeTimeoutEnv({
            orders: [deliveredOrder()],
            cfg: Object.assign(Object.assign({}, cfgOn), { timeoutCompensationCouponTemplateId: null }),
        });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, Object.assign(Object.assign({}, cfgOn), { timeoutCompensationCouponTemplateId: null }), now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('发券异常 → 释放赔付闸，下一轮可重试', async () => {
        const env = makeTimeoutEnv({
            orders: [deliveredOrder()], cfg: cfgOn,
            coupon: { grantCoupon: vitest_1.vi.fn().mockRejectedValue(new Error('template disabled')) },
        });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
        // 认领 + 释放两次 SQL：第二次把闸清空
        (0, vitest_1.expect)(env.rawQuery).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(env.rawQuery.mock.calls[1][0]).toContain('"customFieldsTimeoutcompensatedat" = NULL');
    });
    (0, vitest_1.it)('发券返回空数组 → 释放赔付闸、不写留痕（避免空券把闸占死永久漏赔）', async () => {
        const env = makeTimeoutEnv({
            orders: [deliveredOrder()], cfg: cfgOn,
            coupon: { grantCoupon: vitest_1.vi.fn().mockResolvedValue([]) },
        });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        (0, vitest_1.expect)(env.hallSvc.updateOrder).not.toHaveBeenCalled();
        (0, vitest_1.expect)(env.rawQuery).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(env.rawQuery.mock.calls[1][0]).toContain('"customFieldsTimeoutcompensatedat" = NULL');
    });
    (0, vitest_1.it)('赔付闸过期回收：扫描与认领均允许「券 id 为空且认领超 15min」重新赔付', async () => {
        const env = makeTimeoutEnv({ orders: [deliveredOrder()], cfg: cfgOn });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        const whereSql = env.repo.createQueryBuilder.mock.results[0].value.andWhere.mock.calls
            .map((c) => String(c[0]))
            .join('\n');
        (0, vitest_1.expect)(whereSql).toContain('timeoutCompensationCouponId IS NULL');
        (0, vitest_1.expect)(whereSql).toContain('staleBefore');
        (0, vitest_1.expect)(env.rawQuery.mock.calls[0][0]).toContain('"customFieldsTimeoutcompensationcouponid" IS NULL');
        const staleBefore = env.rawQuery.mock.calls[0][1][2];
        (0, vitest_1.expect)(now - staleBefore.getTime()).toBe(15 * 60000);
    });
    (0, vitest_1.it)('已全额退款订单在查询层剔除（不参与赔付）', async () => {
        const env = makeTimeoutEnv({ orders: [], cfg: cfgOn });
        await env.svc.sweepTimeoutCompensation({ channelId: 1 }, cfgOn, now);
        // 断言扫描 SQL 带「已全额退款排除」子查询（退款单未必是 Cancelled，仅靠 state 过滤不够）
        const whereSql = env.repo.createQueryBuilder.mock.results[0].value.andWhere.mock.calls
            .map((c) => String(c[0]))
            .join('\n');
        (0, vitest_1.expect)(whereSql).toContain('NOT EXISTS');
        (0, vitest_1.expect)(whereSql).toContain('"refund"');
    });
});
(0, vitest_1.describe)('DispatchJobService.tick 多实例扫描锁', () => {
    (0, vitest_1.it)('渠道锁被占用 → 跳过该渠道；其余渠道照常扫描（渠道故障隔离）', async () => {
        const env = makeEnv({});
        const conn = env.svc.connection;
        const channelRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(null) };
        const cfgRepo = { find: vitest_1.vi.fn().mockResolvedValue([{ channelId: 1 }, { channelId: 2 }]) };
        conn.rawConnection.getRepository = vitest_1.vi.fn((ent) => (ent.name === 'Channel' ? channelRepo : cfgRepo));
        const mkRunner = (lockOk) => ({
            connect: vitest_1.vi.fn().mockResolvedValue(undefined),
            query: vitest_1.vi.fn().mockResolvedValueOnce([[{ ok: lockOk }]]).mockResolvedValue([[]]),
            release: vitest_1.vi.fn().mockResolvedValue(undefined),
        });
        const runners = [mkRunner(false), mkRunner(true)];
        conn.rawConnection.createQueryRunner = vitest_1.vi.fn(() => runners.shift());
        const scanSpy = vitest_1.vi.spyOn(env.svc, 'scan').mockResolvedValue({});
        await env.svc.tick();
        (0, vitest_1.expect)(scanSpy).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(scanSpy.mock.calls[0][0].channelId).toBe(2);
    });
    (0, vitest_1.it)('单渠道扫描抛错 → 不中断后续渠道', async () => {
        const env = makeEnv({});
        const conn = env.svc.connection;
        const channelRepo = { findOne: vitest_1.vi.fn().mockResolvedValue(null) };
        const cfgRepo = { find: vitest_1.vi.fn().mockResolvedValue([{ channelId: 1 }, { channelId: 2 }]) };
        conn.rawConnection.getRepository = vitest_1.vi.fn((ent) => (ent.name === 'Channel' ? channelRepo : cfgRepo));
        conn.rawConnection.createQueryRunner = vitest_1.vi.fn(() => ({
            connect: vitest_1.vi.fn().mockResolvedValue(undefined),
            query: vitest_1.vi.fn().mockResolvedValueOnce([[{ ok: true }]]).mockResolvedValue([[]]),
            release: vitest_1.vi.fn().mockResolvedValue(undefined),
        }));
        const scanSpy = vitest_1.vi
            .spyOn(env.svc, 'scan')
            .mockRejectedValueOnce(new Error('channel 1 boom'))
            .mockResolvedValueOnce({});
        await env.svc.tick();
        (0, vitest_1.expect)(scanSpy).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(scanSpy.mock.calls[1][0].channelId).toBe(2);
    });
});
//# sourceMappingURL=dispatch-job.service.spec.js.map