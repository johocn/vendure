import { describe, expect, it, vi } from 'vitest';
import { PaymentTimeoutJob, PAYMENT_REMIND_MS } from './payment-timeout.job';
import { PaymentTimeoutStatus, PaymentTimeoutTask, PaymentTimeoutType } from './payment-timeout.entity';

function makeJob(overrides: Record<string, any> = {}) {
    const tasks: PaymentTimeoutTask[] = [];
    const taskRepo = {
        findOne: vi.fn(async ({ where }: any) => tasks.find(t => t.id === where.id) ?? null),
        save: vi.fn(async (t: any) => t),
        find: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        createQueryBuilder: vi.fn(),
    };
    const job = new PaymentTimeoutJob(
        {} as any, // jobQueueService：executeTaskNow 不用队列
        { rawConnection: { getRepository: () => taskRepo } } as any,
        { findOne: vi.fn(async () => ({ id: 1, state: 'ArrangingPayment', lines: [] })), cancelOrder: vi.fn(async () => ({ id: 1 })) } as any, // orderService
        { findOne: vi.fn(async () => ({ id: 1 })) } as any, // channelService
        { createReleasesForOrderLines: vi.fn(async () => undefined) } as any, // stockMovementService
        { user: vi.fn(async () => undefined) } as any, // notify
        { getConfig: vi.fn(async () => ({ h5BaseUrl: 'https://h5.test' })) } as any, // campusConfig
    ) as any;
    (job as any).taskRepo = taskRepo;
    return { job, taskRepo, tasks, notify: (job as any).notify, orderService: (job as any).orderService };
}

function pendingTask(partial: Partial<PaymentTimeoutTask> = {}): PaymentTimeoutTask {
    return new PaymentTimeoutTask({
        id: 1, orderId: 1, channelId: 1, type: PaymentTimeoutType.CANCEL,
        status: PaymentTimeoutStatus.PENDING, expectedState: 'ArrangingPayment',
        dueAt: new Date(Date.now() - 60 * 1000), retryCount: 0, lastError: null, ...partial,
    } as any);
}

describe('PaymentTimeoutJob.executeTaskNow', () => {
    it('PENDING 任务手动执行成功（无视 dueAt 已过与否）→ EXECUTED', async () => {
        const { job, tasks, notify } = makeJob();
        const t = pendingTask({ type: PaymentTimeoutType.REMIND, dueAt: new Date(Date.now() + PAYMENT_REMIND_MS) });
        tasks.push(t);
        const out = await job.executeTaskNow(1);
        expect(out.status).toBe(PaymentTimeoutStatus.EXECUTED);
        expect(notify.user).toHaveBeenCalled();
    });

    it('CANCEL 任务执行：释放库存 + cancelOrder + orderCancelled 通知', async () => {
        const { job, tasks, notify, orderService } = makeJob();
        tasks.push(pendingTask());
        await job.executeTaskNow(1);
        expect(orderService.cancelOrder).toHaveBeenCalled();
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 1, 'orderCancelled', expect.anything(), expect.anything());
    });

    it('EXECUTED / CANCELLED → 抛 NOT_EXECUTABLE', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ status: PaymentTimeoutStatus.EXECUTED }));
        await expect(job.executeTaskNow(1)).rejects.toThrow('PAYMENT_TIMEOUT_TASK_NOT_EXECUTABLE');
    });

    it('FAILED 任务可重试，成功后回到 EXECUTED', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ status: PaymentTimeoutStatus.FAILED, retryCount: 3, lastError: 'boom' }));
        const out = await job.executeTaskNow(1);
        expect(out.status).toBe(PaymentTimeoutStatus.EXECUTED);
        expect(out.lastError).toBeNull();
    });

    it('resendRemind：REMIND 任务直发 paymentPending，不经状态机', async () => {
        const { job, tasks, notify } = makeJob();
        tasks.push(pendingTask({ type: PaymentTimeoutType.REMIND, status: PaymentTimeoutStatus.EXECUTED }));
        await expect(job.resendRemind(1)).resolves.toBe(true);
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 1, 'paymentPending', undefined, 'https://h5.test');
    });

    it('resendRemind：CANCEL 任务 → 抛 REMIND_TASK_NOT_FOUND', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ type: PaymentTimeoutType.CANCEL }));
        await expect(job.resendRemind(1)).rejects.toThrow('PAYMENT_TIMEOUT_REMIND_TASK_NOT_FOUND');
    });
});
