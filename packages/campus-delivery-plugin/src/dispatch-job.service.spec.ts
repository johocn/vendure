import { describe, expect, it, vi } from 'vitest';
import { DispatchJobService } from './dispatch-job.service';

function makeEnv(opts: {
    openOrders?: any[];
    assignedOrders?: any[];
    onlineRiders?: any[];
    cfg?: any;
    refundedSum?: number;
}) {
    const grabResults: any[] = [];
    const grabSvc = {
        grabByRider: vi.fn().mockImplementation((_ctx: any, orderId: any, rider: any) => {
            grabResults.push({ orderId, riderId: rider.id });
            return Promise.resolve({ id: orderId });
        }),
    };
    const creditSvc = { adjust: vi.fn().mockResolvedValue(95) };
    const hallSvc = {
        backToHall: vi.fn().mockResolvedValue({}),
        updateOrder: vi.fn().mockResolvedValue({}),
        releaseScheduled: vi.fn().mockResolvedValue({}),
    };
    const capacitySvc = { listOnlineRiders: vi.fn().mockResolvedValue(opts.onlineRiders ?? []) };
    const orderRepo = {
        findOne: vi.fn(),
        createQueryBuilder: () => ({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue([...(opts.openOrders ?? []), ...(opts.assignedOrders ?? [])]),
        }),
    };
    const configRepo = { findOne: vi.fn().mockResolvedValue(opts.cfg ?? { autoAssignMinutes: 10, autoRefundMinutes: 30, inProgressSlaMinutes: 45 }) };
    const refundRepo = {
        createQueryBuilder: () => ({
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            getRawOne: vi.fn().mockResolvedValue({ sum: String(opts.refundedSum ?? 0) }),
        }),
    };
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'CampusFulfillmentConfig') return configRepo;
            if (name === 'Refund') return refundRepo;
            return orderRepo;
        }),
        rawConnection: { getRepository: vi.fn((_ent: any) => refundRepo) },
    } as any;
    const svc = new DispatchJobService(
        conn, grabSvc as any, hallSvc as any, capacitySvc as any, creditSvc as any, { get: vi.fn() } as any,
    );
    return { svc, grabSvc, creditSvc, hallSvc, capacitySvc, orderRepo, configRepo, grabResults };
}

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000);

describe('DispatchJobService.scan', () => {
    it('open 超 autoAssignMinutes → 强派最佳在线骑手', async () => {
        const { svc, grabSvc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [
                { id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 100 } },
                { id: 8, customFields: { riderOnlineAt: minAgo(1), riderCredit: 90 } },
            ],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(grabResults[0]).toEqual({ orderId: 1, riderId: 7 }); // 信用分高者优先
        expect(grabSvc.grabByRider).toHaveBeenCalledOnce();
    });

    it('低信用分(<60)骑手不参与强派', async () => {
        const { svc, grabResults } = makeEnv({
            openOrders: [{ id: 1, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(11) } }],
            onlineRiders: [{ id: 7, customFields: { riderOnlineAt: minAgo(1), riderCredit: 59 } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(grabResults).toHaveLength(0);
    });

    it('assigned 超 15min 未取货 → 回大厅 + 扣 10 分', async () => {
        const { svc, hallSvc, creditSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(16), hallEnteredAt: minAgo(20) } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.backToHall).toHaveBeenCalledWith(expect.anything(), 2);
        expect(creditSvc.adjust).toHaveBeenCalledWith(expect.anything(), 9, -10, 'timeout_not_picked', 2);
    });

    it('assigned 未超 15min 不动', async () => {
        const { svc, hallSvc } = makeEnv({
            assignedOrders: [{ id: 2, customFields: { hallStatus: 'grabbed', deliveryStatus: 'assigned', deliveryStaffId: '9', assignedAt: minAgo(5), hallEnteredAt: minAgo(6) } }],
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.backToHall).not.toHaveBeenCalled();
    });
});

describe('DispatchJobService.scan 预约单放量（plan 3.1）', () => {
    it('scheduledFor 进入 30min 窗口 → releaseScheduled 放量', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 11, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 10 * 60_000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 }, // merchantConfirmEnabled 未启用
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.releaseScheduled).toHaveBeenCalledOnce();
        expect(hallSvc.releaseScheduled).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 11 }), expect.anything());
    });

    it('scheduledFor 距今超 30min → 不放量', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 11, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 60 * 60_000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.releaseScheduled).not.toHaveBeenCalled();
    });

    it('商家确认模式渠道 → 放量进入 pending_merchant（走 T2 前不误强派）', async () => {
        const env = makeEnv({
            openOrders: [{ id: 12, customFields: { hallStatus: 'scheduled', scheduledFor: new Date(now + 5 * 60_000) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30, merchantConfirmEnabled: true },
        });
        await env.svc.scan({ channelId: 1 } as any);
        expect(env.hallSvc.releaseScheduled).toHaveBeenCalledOnce();
        // 放量后进 pending_merchant，无 open 单，T2 不触发
        expect(env.grabSvc.grabByRider).not.toHaveBeenCalled();
    });

    it('scheduled 缺 scheduledFor → 永不放量（脏数据保护）', async () => {
        const { svc, hallSvc } = makeEnv({
            openOrders: [{ id: 13, customFields: { hallStatus: 'scheduled' } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        await svc.scan({ channelId: 1 } as any);
        expect(hallSvc.releaseScheduled).not.toHaveBeenCalled();
    });
});

/** 预注入 T4 依赖的惰性私有服务（绕过 lazy init，injector 不会被真调） */
function injectT4Services(svc: DispatchJobService) {
    svc['orderSvc'] = {
        refundOrder: vi.fn().mockResolvedValue({ id: 77 }),
        settleRefund: vi.fn().mockResolvedValue({}),
        cancelOrder: vi.fn().mockResolvedValue({ id: 4 }),
    } as any;
    svc['paymentRepo'] = { findOne: vi.fn().mockResolvedValue({ id: 55, amount: 8800 }) };
    svc['couponSvc'] = { grantCoupon: vi.fn().mockResolvedValue([]) };
}

describe('DispatchJobService.scan T4 自动退款', () => {
    it('open 超 autoRefundMinutes → 退款 + Cancelled + cause=no_rider + 补偿券', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30, compensationCouponTemplateId: '9' },
        });
        injectT4Services(env.svc);
        const orderSvc = (env.svc as any).orderSvc;
        const couponSvc = (env.svc as any).couponSvc;
        await env.svc.scan({ channelId: 1 } as any);
        expect(orderSvc.refundOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentId: 55,
            amount: 8800,
            shipping: 0, // fork refund 表 shipping/adjustment 列 NOT NULL，必须显式传 0
            adjustment: 0,
        }));
        expect(orderSvc.settleRefund).toHaveBeenCalledOnce();
        expect(orderSvc.cancelOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 4 }));
        expect(couponSvc.grantCoupon).toHaveBeenCalledWith(expect.anything(), '9', [expect.anything()]);
        expect(env.hallSvc.updateOrder).toHaveBeenCalledWith(expect.anything(), 4, expect.objectContaining({
            customFields: expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });

    it('未配置补偿券模板 → 不发券不报错，退款照常', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
        });
        injectT4Services(env.svc);
        await env.svc.scan({ channelId: 1 } as any);
        expect((env.svc as any).couponSvc.grantCoupon).not.toHaveBeenCalled();
        expect((env.svc as any).orderSvc.cancelOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 4 }));
        expect(env.hallSvc.updateOrder).toHaveBeenCalledWith(expect.anything(), 4, expect.objectContaining({
            customFields: expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });

    it('幂等重试：上轮已全额退款（transition 失败残留）→ 跳过 refundOrder 只做取消+标记', async () => {
        const env = makeEnv({
            openOrders: [{ id: 4, code: 'T4', customerId: 501, customFields: { hallStatus: 'open', hallEnteredAt: minAgo(31) } }],
            cfg: { channelId: 1, autoAssignMinutes: 10, autoRefundMinutes: 30 },
            refundedSum: 8800, // 已退全额
        });
        injectT4Services(env.svc);
        const orderSvc = (env.svc as any).orderSvc;
        await env.svc.scan({ channelId: 1 } as any);
        expect(orderSvc.refundOrder).not.toHaveBeenCalled();
        expect(orderSvc.settleRefund).not.toHaveBeenCalled();
        expect(orderSvc.cancelOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: 4 }));
        expect(env.hallSvc.updateOrder).toHaveBeenCalledWith(expect.anything(), 4, expect.objectContaining({
            customFields: expect.objectContaining({ campusCause: 'no_rider', hallStatus: 'no_rider_final' }),
        }));
    });
});

