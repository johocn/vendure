import { describe, expect, it, vi } from 'vitest';
import { DispatchAdminService } from './dispatch-admin.service';

interface HandleEnvOpts {
    orders?: any[];
    onlineRiders?: any[];
    cfg?: any;
    payment?: any;
    refundedSum?: number;
    orderSvc?: any;
}

function makeEnv(opts: HandleEnvOpts = {}) {
    const grabSvc = { grabByRider: vi.fn().mockResolvedValue(true) };
    const hallSvc = { backToHall: vi.fn().mockResolvedValue({}) };
    const capacitySvc = { listOnlineRiders: vi.fn().mockResolvedValue(opts.onlineRiders ?? []) };
    const orderRepo = {
        findOne: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        createQueryBuilder: () => ({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(opts.orders ?? []),
        }),
    };
    const configRepo = {
        findOne: vi.fn().mockResolvedValue(opts.cfg ?? { autoAssignMinutes: 10, inProgressSlaMinutes: 45 }),
    };
    const paymentRepo = { findOne: vi.fn().mockResolvedValue(opts.payment ?? null) };
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
            return orderRepo;
        }),
        rawConnection: {
            getRepository: vi.fn((ent: any) => {
                const name = (ent as any).name ?? ent;
                if (name === 'Payment') return paymentRepo;
                return refundRepo;
            }),
        },
    } as any;
    const svc = new DispatchAdminService(conn, grabSvc as any, hallSvc as any, capacitySvc as any, {} as any);
    // 测试直接注入惰性服务，绕过 ModuleRef/require（handleException 专用）
    const orderSvc = opts.orderSvc ?? {
        refundOrder: vi.fn().mockResolvedValue({ id: 55 }),
        settleRefund: vi.fn().mockResolvedValue({}),
        cancelOrder: vi.fn().mockResolvedValue({}),
    };
    (svc as any).orderSvc = orderSvc;
    return { svc, grabSvc, hallSvc, capacitySvc, orderRepo, configRepo, paymentRepo, refundRepo, orderSvc };
}

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000);
const exceptionOrder = (id: number, code: string, extra: any = {}) => ({
    id,
    code,
    customerId: 160,
    customFields: { hallStatus: 'grabbed', deliveryStatus: 'exception', exceptionType: 'food_spilled', ...extra },
});

describe('DispatchAdminService.board', () => {
    it('滞留超 autoAssignMinutes 的 open 单 → alert stale_open', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(12), campusZone: 'A区' } }],
            cfg: { autoAssignMinutes: 10, inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '1', type: 'stale_open' }));
    });

    it('open 未超时 → 不告警，进 hallOrders', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } }],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts).toHaveLength(0);
        expect(board.hallOrders).toHaveLength(1);
        expect(board.activeOrders).toHaveLength(0);
    });

    it('in_progress 超 SLA → alert sla_breach', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 2, code: 'A2', customFields: { hallStatus: 'grabbed', deliveryStatus: 'in_progress', assignedAt: minAgo(50) } }],
            cfg: { inProgressSlaMinutes: 45 },
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '2', type: 'sla_breach' }));
        expect(board.activeOrders).toHaveLength(1);
    });

    it('campusCause=slot_full → alert slot_full', async () => {
        const { svc } = makeEnv({
            orders: [{ id: 3, code: 'A3', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(1), campusCause: 'slot_full' } }],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.alerts[0]).toEqual(expect.objectContaining({ orderId: '3', type: 'slot_full' }));
    });

    it('exception_final 已处置完结单 → 不进墙，进 handledOrders 留痕（plan 3.4）', async () => {
        const { svc } = makeEnv({
            orders: [
                exceptionOrder(9, 'A9', { hallStatus: 'exception_final', exceptionAction: 'refund_diff', exceptionCompensation: 300, exceptionHandledAt: minAgo(2), exceptionHandledBy: '3' }),
                { id: 1, code: 'A1', customFields: { hallStatus: 'open', hallEnteredAt: minAgo(3) } },
            ],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.hallOrders).toHaveLength(1);
        expect(board.activeOrders).toHaveLength(0);
        expect(board.handledOrders).toEqual([
            expect.objectContaining({ orderId: '9', orderCode: 'A9', action: 'refund_diff', compensation: 300, handledBy: '3' }),
        ]);
    });
});

describe('DispatchAdminService.handleException', () => {
    const ctx = { channelId: 1, activeUserId: 3 } as any;

    it('非异常单拒绝处置', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue({ id: 5, code: 'A5', customFields: { deliveryStatus: 'in_progress' } });
        await expect(svc.handleException(ctx, 5 as any, 'refund_diff', 300)).rejects.toThrow('仅骑手上报异常的订单可处置');
    });

    it('reassign：回大厅 + 留痕，不置 exception_final', async () => {
        const { svc, orderRepo, hallSvc } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(6, 'A6'));
        const res = await svc.handleException(ctx, 6 as any, 'reassign', undefined, undefined, '改派');
        expect(res).toEqual({ ok: true, action: 'reassign' });
        expect(hallSvc.backToHall).toHaveBeenCalledWith(ctx, 6);
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        expect(patch).toEqual(expect.objectContaining({ exceptionAction: 'reassign', exceptionHandledNote: '改派', exceptionHandledBy: '3' }));
        expect(patch.hallStatus).toBeUndefined();
    });

    it('refund_diff：部分退款（shipping/adjustment 显式 0）+ settleRefund + exception_final 留痕', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({
            payment: { id: 9, amount: 2300 },
            refundedSum: 0,
        });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await svc.handleException(ctx, 7 as any, 'refund_diff', 300, undefined, '洒漏赔付');
        expect(orderSvc.refundOrder).toHaveBeenCalledWith(ctx, expect.objectContaining({
            paymentId: 9, amount: 300, shipping: 0, adjustment: 0,
        }));
        expect(orderSvc.settleRefund).toHaveBeenCalledWith(ctx, { id: 55 });
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        expect(patch).toEqual(expect.objectContaining({
            exceptionAction: 'refund_diff', exceptionCompensation: 300, hallStatus: 'exception_final',
        }));
    });

    it('refund_diff 超可退余额（已全额退）→ 拒绝', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({ refundedSum: 2300 });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await expect(svc.handleException(ctx, 7 as any, 'refund_diff', 100)).rejects.toThrow('退款金额超过可退余额');
        expect(orderSvc.refundOrder).not.toHaveBeenCalled();
    });

    it('refund_diff 金额 ≤0 / 无支付记录 → 拒绝', async () => {
        const { svc, orderRepo, paymentRepo } = makeEnv({ payment: null });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(7, 'A7'));
        await expect(svc.handleException(ctx, 7 as any, 'refund_diff', 0)).rejects.toThrow('赔付金额必须大于 0');
        paymentRepo.findOne.mockResolvedValue(null);
        await expect(svc.handleException(ctx, 7 as any, 'refund_diff', 300)).rejects.toThrow('订单无支付记录');
    });

    it('coupon：发补偿券 + exception_final 留痕', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(8, 'A8'));
        (svc as any).couponSvc = { grantCoupon: vi.fn().mockResolvedValue(['CODE1']) };
        await svc.handleException(ctx, 8 as any, 'coupon', undefined, '9' as any, '无骑手补偿');
        expect((svc as any).couponSvc.grantCoupon).toHaveBeenCalledWith(ctx, '9', [160]);
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        expect(patch).toEqual(expect.objectContaining({
            exceptionAction: 'coupon', exceptionCouponTemplateId: '9', hallStatus: 'exception_final',
        }));
    });

    it('coupon 未选模板 → 拒绝', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(8, 'A8'));
        await expect(svc.handleException(ctx, 8 as any, 'coupon')).rejects.toThrow('请选择补偿券模板');
    });

    it('refund_all：退剩余全额 + cancelOrder + campusCause=exception_refund', async () => {
        const { svc, orderRepo, orderSvc, paymentRepo } = makeEnv({ refundedSum: 300 });
        paymentRepo.findOne.mockResolvedValue({ id: 9, amount: 2300 });
        orderRepo.findOne.mockResolvedValue(exceptionOrder(10, 'A10'));
        await svc.handleException(ctx, 10 as any, 'refund_all');
        // 已退 300，剩余 2000 补退
        expect(orderSvc.refundOrder).toHaveBeenCalledWith(ctx, expect.objectContaining({ paymentId: 9, amount: 2000 }));
        expect(orderSvc.cancelOrder).toHaveBeenCalledWith(ctx, expect.objectContaining({ orderId: 10 }));
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        expect(patch).toEqual(expect.objectContaining({
            exceptionAction: 'refund_all', hallStatus: 'exception_final', campusCause: 'exception_refund',
        }));
    });
});
