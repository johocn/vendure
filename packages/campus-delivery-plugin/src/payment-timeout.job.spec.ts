import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PaymentTimeoutJob, PAYMENT_REMIND_MS, PAYMENT_CANCEL_MS } from './payment-timeout.job';
import { PaymentTimeoutStatus, PaymentTimeoutType } from './payment-timeout.entity';

describe('PaymentTimeoutJob', () => {
    function makeJob(opts: { orderState: string; dueAtPast?: boolean }) {
        const task = {
            id: 1, orderId: 11, channelId: 7, type: PaymentTimeoutType.CANCEL,
            // dueAtPast 为 false 时 dueAt 在未来（未到期）；默认 1ms 前已到期
            dueAt: new Date(Date.now() + (opts.dueAtPast === false ? 60_000 : -1)),
            status: PaymentTimeoutStatus.PENDING, expectedState: 'ArrangingPayment', retryCount: 0, lastError: null,
        };
        const taskRepo = {
            findOne: vi.fn().mockResolvedValue(task),
            save: vi.fn().mockImplementation(async (t: any) => t),
            find: vi.fn().mockResolvedValue([]),
        };
        const order = { id: 11, code: 'ORD1', state: opts.orderState, lines: [{ id: 'L1', quantity: 1 }] };
        const orderService = {
            findOne: vi.fn().mockResolvedValue(order),
            cancelOrder: vi.fn().mockResolvedValue(order),
        };
        const stockMovementService = { createReleasesForOrderLines: vi.fn().mockResolvedValue([]) };
        const notify = { user: vi.fn() };
        const job = new PaymentTimeoutJob(
            { rawConnection: { getRepository: () => taskRepo } } as any,
            { findOne: vi.fn().mockResolvedValue({}) } as any, // channelService
            orderService,
            stockMovementService,
            notify,
            { getConfig: vi.fn().mockResolvedValue({ h5BaseUrl: null }) } as any,
        );
        return { job, taskRepo, task, orderService, stockMovementService, notify, order };
    }

    beforeEach(() => vi.clearAllMocks());

    it('到点订单已支付（非 ArrangingPayment）→ 任务 CANCELLED，不取消订单', async () => {
        const { job, taskRepo, orderService } = makeJob({ orderState: 'PaymentSettled' });
        await job.process({ taskId: 1 } as any);
        expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentTimeoutStatus.CANCELLED }));
        expect(orderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('到点仍在 ArrangingPayment（CANCEL 型）→ 先释放库存分配再 cancelOrder + 发取消通知', async () => {
        const { job, taskRepo, stockMovementService, orderService, notify } = makeJob({ orderState: 'ArrangingPayment' });
        await job.process({ taskId: 1 } as any);
        expect(stockMovementService.createReleasesForOrderLines).toHaveBeenCalledWith(
            expect.anything(), [{ orderLineId: 'L1', quantity: 1 }],
        );
        expect(orderService.cancelOrder).toHaveBeenCalled();
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 11, 'orderCancelled', '订单超时未支付，已自动取消', undefined);
        expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentTimeoutStatus.EXECUTED }));
    });

    it('REMIND 型到点仍在待支付 → 发提醒，不动订单', async () => {
        const { job, task, notify, orderService } = makeJob({ orderState: 'ArrangingPayment' });
        task.type = PaymentTimeoutType.REMIND;
        await job.process({ taskId: 1 } as any);
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 11, 'paymentPending');
        expect(orderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('未到 dueAt → 跳过保持 PENDING（SQL JobQueue 忽略 delay 兜底语义）', async () => {
        const { job, taskRepo } = makeJob({ orderState: 'ArrangingPayment', dueAtPast: false });
        await job.process({ taskId: 1 } as any);
        expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('常量：提醒 10 分钟 / 取消 15 分钟', () => {
        expect(PAYMENT_REMIND_MS).toBe(10 * 60 * 1000);
        expect(PAYMENT_CANCEL_MS).toBe(15 * 60 * 1000);
    });
});
