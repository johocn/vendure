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
    const hallSvc = {
        backToHall: vi.fn().mockResolvedValue({}),
        updateOrder: vi.fn().mockResolvedValue({}),
    };
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
    const rawQuery = vi.fn().mockResolvedValue([{ id: 1 }]);
    const conn = {
        getRepository: vi.fn((_ctx: any, ent: any) => {
            const name = (ent as any).name;
            if (name === 'CampusFulfillmentConfig') return configRepo;
            return orderRepo;
        }),
        rawConnection: {
            // 异常处置认领（UPDATE ... RETURNING）：默认认领成功
            query: rawQuery,
            // 退款咨询锁：默认抢锁成功
            createQueryRunner: () => ({
                connect: vi.fn().mockResolvedValue(undefined),
                query: vi.fn().mockResolvedValue([[{ ok: true }], []]),
                release: vi.fn().mockResolvedValue(undefined),
            }),
            getRepository: vi.fn((ent: any) => {
                const name = (ent as any).name ?? ent;
                if (name === 'Payment') return paymentRepo;
                return refundRepo;
            }),
        },
    } as any;
    const svc = new DispatchAdminService(conn, grabSvc as any, hallSvc as any, capacitySvc as any, {} as any, { user: vi.fn() } as any);
    // 测试直接注入惰性服务，绕过 ModuleRef/require（handleException 专用）
    const orderSvc = opts.orderSvc ?? {
        refundOrder: vi.fn().mockResolvedValue({ id: 55 }),
        settleRefund: vi.fn().mockResolvedValue({}),
        cancelOrder: vi.fn().mockResolvedValue({}),
    };
    (svc as any).orderSvc = orderSvc;
    return { svc, grabSvc, hallSvc, capacitySvc, orderRepo, configRepo, paymentRepo, refundRepo, rawQuery, orderSvc, notifySvc: (svc as any).notify };
}

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000);
const exceptionOrder = (id: number, code: string, extra: any = {}) => ({
    id,
    code,
    customerId: 160,
    channels: [{ id: 1 }],
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

    it('终态单（取消/无人接退款/已送达）与历史脏数据不进调度墙', async () => {
        const { svc } = makeEnv({
            orders: [
                { id: 11, code: 'C1', customFields: { hallStatus: 'cancelled', deliveryStatus: 'pending' } },
                { id: 12, code: 'C2', customFields: { hallStatus: 'no_rider_final' } },
                { id: 13, code: 'C3', customFields: { hallStatus: 'delivered', deliveryStatus: 'delivered' } },
                // 历史脏数据：送达后 hallStatus 未同步
                { id: 14, code: 'C4', customFields: { hallStatus: 'grabbed', deliveryStatus: 'delivered' } },
            ],
        });
        const board = await svc.board({ channelId: 1 } as any);
        expect(board.hallOrders).toHaveLength(0);
        expect(board.activeOrders).toHaveLength(0);
        expect(board.alerts).toHaveLength(0);
        expect(board.handledOrders).toHaveLength(0);
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

describe('DispatchAdminService.assign 资质校验', () => {
    const ctx = { channelId: 1 } as any;
    const order = { id: 5, code: 'A5', channels: [{ id: 1 }], customFields: { hallStatus: 'open' } };

    it('未审核/已停用骑手 → 拒绝派单', async () => {
        const { svc, orderRepo, grabSvc } = makeEnv();
        orderRepo.findOne
            .mockResolvedValueOnce(order)
            .mockResolvedValueOnce({ id: 9, customFields: { riderStatus: 'pending', riderCredit: 100 } });
        await expect(svc.assign(ctx, 5 as any, 9 as any)).rejects.toThrow('该骑手未通过审核或已停用');
        expect(grabSvc.grabByRider).not.toHaveBeenCalled();
    });

    it('信用分低于 60 → 拒绝派单', async () => {
        const { svc, orderRepo, grabSvc } = makeEnv();
        orderRepo.findOne
            .mockResolvedValueOnce(order)
            .mockResolvedValueOnce({ id: 9, customFields: { riderStatus: 'approved', riderCredit: 59, riderOnlineAt: new Date() } });
        await expect(svc.assign(ctx, 5 as any, 9 as any)).rejects.toThrow('该骑手信用分不足');
        expect(grabSvc.grabByRider).not.toHaveBeenCalled();
    });

    it('离线骑手（心跳超 5min）→ 拒绝派单', async () => {
        const { svc, orderRepo, grabSvc } = makeEnv();
        orderRepo.findOne
            .mockResolvedValueOnce(order)
            .mockResolvedValueOnce({ id: 9, customFields: { riderStatus: 'approved', riderCredit: 88, riderOnlineAt: minAgo(6) } });
        await expect(svc.assign(ctx, 5 as any, 9 as any)).rejects.toThrow('该骑手当前不在线，无法派单');
        expect(grabSvc.grabByRider).not.toHaveBeenCalled();
    });

    it('在职且信用达标 → 正常强派', async () => {
        const { svc, orderRepo, grabSvc } = makeEnv();
        orderRepo.findOne
            .mockResolvedValueOnce(order)
            .mockResolvedValueOnce({ id: 9, customFields: { riderStatus: 'approved', riderCredit: 88, riderOnlineAt: new Date() } });
        await expect(svc.assign(ctx, 5 as any, 9 as any)).resolves.toEqual({ assigned: true });
        expect(grabSvc.grabByRider).toHaveBeenCalledWith(ctx, 5, { id: 9 });
    });
});

describe('DispatchAdminService.handleException', () => {
    const ctx = { channelId: 1, activeUserId: 3 } as any;

    it('非异常单拒绝处置', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue({ id: 5, code: 'A5', channels: [{ id: 1 }], customFields: { deliveryStatus: 'in_progress' } });
        await expect(svc.handleException(ctx, 5 as any, 'refund_diff', 300)).rejects.toThrow('仅骑手上报异常的订单可处置');
    });

    it('reassign：回大厅 + 留痕，不置 exception_final', async () => {
        const { svc, orderRepo, hallSvc, notifySvc } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(6, 'A6'));
        const res = await svc.handleException(ctx, 6 as any, 'reassign', undefined, undefined, '改派');
        expect(res).toEqual({ ok: true, action: 'reassign' });
        expect(hallSvc.backToHall).toHaveBeenCalledWith(ctx, 6);
        const patch = orderRepo.update.mock.calls[0][1].customFields;
        expect(patch).toEqual(expect.objectContaining({ exceptionAction: 'reassign', exceptionHandledNote: '改派', exceptionHandledBy: '3' }));
        expect(patch.hallStatus).toBeUndefined();
        // 处置完结 push：reassign 也通知
        expect(notifySvc.user).toHaveBeenCalledWith(ctx, 6, 'exceptionHandled', '平台已重新安排配送');
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

    it('处置完结 push（plan 3.4 补全）：按 action 带对应动态文案通知 exceptionHandled', async () => {
        const { svc, orderRepo, notifySvc } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(11, 'A11'));
        (svc as any).couponSvc = { grantCoupon: vi.fn().mockResolvedValue(['CODE1']) };
        await svc.handleException(ctx, 11 as any, 'coupon', undefined, '9' as any, '补偿');
        expect(notifySvc.user).toHaveBeenCalledWith(ctx, 11, 'exceptionHandled', '异常已处理，补偿券已发放');

        const env2 = makeEnv({ payment: { id: 9, amount: 2300 }, refundedSum: 0 });
        env2.orderRepo.findOne.mockResolvedValue(exceptionOrder(12, 'A12'));
        await env2.svc.handleException(ctx, 12 as any, 'refund_diff', 300);
        expect(env2.notifySvc.user).toHaveBeenCalledWith(ctx, 12, 'exceptionHandled', '异常已处理，差价原路退回');
    });

    it('已取消订单 → 拒绝处置（防取消后退款/发券）', async () => {
        const { svc, orderRepo } = makeEnv();
        orderRepo.findOne.mockResolvedValue({ ...exceptionOrder(13, 'A13'), state: 'Cancelled' });
        await expect(svc.handleException(ctx, 13 as any, 'refund_all')).rejects.toThrow('订单已取消，无法处置');
    });

    it('重复/并发处置 → 认领失败直接拒绝（不二次退款/发券）', async () => {
        const { svc, orderRepo, rawQuery, orderSvc } = makeEnv();
        orderRepo.findOne.mockResolvedValue(exceptionOrder(14, 'A14'));
        rawQuery.mockResolvedValueOnce([]); // 异常态已被另一路消费
        await expect(svc.handleException(ctx, 14 as any, 'refund_all')).rejects.toThrow('该异常已处置，请刷新后重试');
        expect(orderSvc.refundOrder).not.toHaveBeenCalled();
        expect(orderSvc.cancelOrder).not.toHaveBeenCalled();
    });

    it('处置失败 → 回滚认领，异常态保留可重试', async () => {
        const env = makeEnv({ payment: { id: 9, amount: 2300 }, refundedSum: 0 });
        env.orderRepo.findOne.mockResolvedValue(exceptionOrder(15, 'A15'));
        env.orderSvc.refundOrder.mockResolvedValue({ errorCode: 'REFUND_FAILED' });
        await expect(env.svc.handleException(ctx, 15 as any, 'refund_diff', 300)).rejects.toThrow('refundOrder failed');
        expect(env.hallSvc.updateOrder).toHaveBeenCalledWith(ctx, 15, {
            customFields: { hallStatus: 'grabbed', deliveryStatus: 'exception' },
        });
        expect(env.orderRepo.update).not.toHaveBeenCalled();
    });
});
