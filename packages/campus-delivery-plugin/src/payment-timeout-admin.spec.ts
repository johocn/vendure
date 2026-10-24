import { describe, expect, it, vi } from 'vitest';
import { Between, LessThan } from 'typeorm';
import { Order } from '@vendure/core';
import { PaymentTimeoutJob, PAYMENT_REMIND_MS } from './payment-timeout.job';
import { PaymentTimeoutStatus, PaymentTimeoutTask, PaymentTimeoutType } from './payment-timeout.entity';
import { PaymentTimeoutAdminService } from './payment-timeout-admin.service';

function makeJob(overrides: Record<string, any> = {}) {
    const tasks: PaymentTimeoutTask[] = [];
    const taskRepo = {
        findOne: vi.fn(async ({ where }: any) => tasks.find(t => t.id === where.id) ?? null),
        save: vi.fn(async (t: any) => t),
        find: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        createQueryBuilder: vi.fn(),
    };
    const queryRunner = {
        connect: vi.fn(async () => undefined),
        query: vi.fn(async () => [{ locked: true }]),
        release: vi.fn(async () => undefined),
    };
    const job = new PaymentTimeoutJob(
        {} as any, // jobQueueService：executeTaskNow 不用队列
        { rawConnection: { getRepository: () => taskRepo, createQueryRunner: () => queryRunner } } as any,
        { findOne: vi.fn(async () => ({ id: 1, state: 'ArrangingPayment', lines: [] })), cancelOrder: vi.fn(async () => ({ id: 1 })) } as any, // orderService
        { findOne: vi.fn(async () => ({ id: 1 })) } as any, // channelService
        { createOutstandingReleasesForOrderLines: vi.fn(async () => []) } as any, // stockMovementService
        { user: vi.fn(async () => undefined) } as any, // notify
        { getConfig: vi.fn(async () => ({ h5BaseUrl: 'https://h5.test' })) } as any, // campusConfig
    ) as any;
    (job as any).taskRepo = taskRepo;
    return { job, taskRepo, tasks, notify: (job as any).notify, orderService: (job as any).orderService, queryRunner };
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

    it('同一任务已被其他执行者持锁 → 拒绝执行（PAYMENT_TIMEOUT_TASK_BUSY）', async () => {
        const { job, tasks, queryRunner, orderService } = makeJob();
        queryRunner.query.mockResolvedValue([{ locked: false }]);
        tasks.push(pendingTask());
        await expect(job.executeTaskNow(1)).rejects.toThrow('PAYMENT_TIMEOUT_TASK_BUSY');
        expect(orderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('order 已被并发路径取消（cancelOrder 抛错但状态 Cancelled）→ 视为成功且不重复通知', async () => {
        const { job, tasks, notify, orderService } = makeJob();
        orderService.cancelOrder.mockRejectedValue(new Error('already cancelled'));
        orderService.findOne
            .mockResolvedValueOnce({ id: 1, state: 'ArrangingPayment', lines: [] })
            .mockResolvedValueOnce({ id: 1, state: 'Cancelled', lines: [] });
        tasks.push(pendingTask());
        const out = await job.executeTaskNow(1);
        expect(out.status).toBe(PaymentTimeoutStatus.EXECUTED);
        expect(notify.user).not.toHaveBeenCalled();
    });
});

describe('PaymentTimeoutAdminService', () => {
    const adminCtx = { channelId: 1, userHasPermissions: () => true } as any;
    const tenantCtx = { channelId: 2, userHasPermissions: () => false } as any;

    function makeService(tasks: PaymentTimeoutTask[], orders: any[] = []) {
        const taskRepo = {
            findOne: vi.fn(async ({ where }: any) => tasks.find(t => t.id === where.id) ?? null),
            findAndCount: vi.fn(async (opts: any) => {
                let list = tasks.filter(t => (!opts.where.status || t.status === opts.where.status) && (!opts.where.type || t.type === opts.where.type));
                if (opts.where.channelId != null) list = list.filter(t => Number(t.channelId) === Number(opts.where.channelId));
                return [list.slice(opts.skip ?? 0, (opts.skip ?? 0) + (opts.take ?? 20)), list.length];
            }),
            count: vi.fn(async ({ where }: any) => {
                if ('status' in where && where.status === PaymentTimeoutStatus.PENDING) return 2; // pendingOverdue
                if ('type' in where && where.type === PaymentTimeoutType.REMIND) return 12;      // todayRemind
                if ('type' in where && where.type === PaymentTimeoutType.CANCEL) return 5;       // todayCancel
                return 1;                                                                        // totalFailed
            }),
        };
        const orderRepo = { find: vi.fn(async () => orders) };
        const svc = new PaymentTimeoutAdminService(
            { rawConnection: { getRepository: (e: any) => (e === Order ? orderRepo : taskRepo) } } as any,
            { executeTaskNow: vi.fn(async (id: number) => tasks.find(t => t.id === id)), runCompensation: vi.fn(async () => 3) } as any,
        ) as any;
        (svc as any).taskRepo = taskRepo; (svc as any).orderRepo = orderRepo;
        return { svc, taskRepo, orderRepo };
    }

    it('listTasks：返回任务 + 订单摘要映射', async () => {
        const t = pendingTask();
        const { svc } = makeService([t], [{ id: 1, code: 'A1001', state: 'Cancelled' }]);
        const out = await svc.listTasks(adminCtx, { status: 'PENDING', skip: 0, take: 20 });
        expect(out.total).toBe(1);
        expect(out.items[0]).toMatchObject({ orderCode: 'A1001', orderState: 'Cancelled' });
    });

    it('listTasks：分页参数钳制（负 skip → 0，take 至少 1、最多 100）', async () => {
        const { svc, taskRepo } = makeService([pendingTask()]);
        await svc.listTasks(adminCtx, { skip: -5, take: 0 });
        expect(taskRepo.findAndCount.mock.calls[0][0]).toMatchObject({ skip: 0, take: 1 });
        await svc.listTasks(adminCtx, { take: 999 });
        expect(taskRepo.findAndCount.mock.calls[1][0]).toMatchObject({ skip: 0, take: 100 });
    });

    it('listTasks：非平台超管只返回本渠道任务', async () => {
        const { svc, taskRepo } = makeService([
            pendingTask({ id: 1, channelId: 1 }),
            pendingTask({ id: 2, channelId: 2 }),
        ]);
        const out = await svc.listTasks(tenantCtx, { skip: 0, take: 20 });
        expect(out.items.map((t: any) => t.id)).toEqual([2]);
        expect(taskRepo.findAndCount.mock.calls[0][0].where.channelId).toBe(2);
    });

    it('getStats：四项计数', async () => {
        const { svc } = makeService([]);
        const s = await svc.getStats(adminCtx);
        expect(s).toEqual({ todayRemind: 12, todayCancel: 5, totalFailed: 1, pendingOverdue: 2 });
    });

    it('executeTask 委托 job；runCompensationNow 返回条数', async () => {
        const t = pendingTask(); const { svc } = makeService([t]);
        await svc.executeTask(adminCtx, 1);
        expect((svc as any).job.executeTaskNow).toHaveBeenCalledWith(1);
        await expect(svc.runCompensationNow()).resolves.toBe(3);
    });

    it('非平台超管执行其他渠道任务 → 拒绝', async () => {
        const t = pendingTask({ id: 1, channelId: 1 }); const { svc } = makeService([t]);
        await expect(svc.executeTask(tenantCtx, 1)).rejects.toThrow('任务不属于当前店铺');
        expect((svc as any).job.executeTaskNow).not.toHaveBeenCalled();
    });

    it('非平台超管重发其他渠道提醒 → 拒绝', async () => {
        const t = pendingTask({ id: 1, channelId: 1 }); const { svc } = makeService([t]);
        await expect(svc.resendRemind(tenantCtx, 1)).rejects.toThrow('任务不属于当前店铺');
    });
});
