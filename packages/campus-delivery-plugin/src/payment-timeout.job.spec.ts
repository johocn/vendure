import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentTimeoutJob, PAYMENT_REMIND_MS, PAYMENT_CANCEL_MS } from './payment-timeout.job';
import { PaymentTimeoutStatus, PaymentTimeoutType } from './payment-timeout.entity';

describe('PaymentTimeoutJob', () => {
    function makeJob(opts: { orderState: string; dueAtPast?: boolean }) {
        const task = {
            id: 1, orderId: 11, channelId: 7, type: PaymentTimeoutType.CANCEL,
            // dueAtPast=false → 60s 后到期（未到点）；默认 → 已到期（到点复查语义）
            dueAt: new Date(Date.now() - (opts.dueAtPast === false ? -60_000 : 1)),
            status: PaymentTimeoutStatus.PENDING, expectedState: 'ArrangingPayment', retryCount: 0, lastError: null,
        };
        const taskRepo = {
            findOne: vi.fn().mockResolvedValue(task),
            save: vi.fn().mockImplementation(async (t: any) => t),
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnThis(),
                andWhere: vi.fn().mockReturnThis(),
                getMany: vi.fn().mockResolvedValue([]),
            }),
        };
        const orderRepo = { find: vi.fn().mockResolvedValue([{ id: 11, code: 'ORD1' }]) };
        const order = { id: 11, code: 'ORD1', state: opts.orderState, lines: [{ id: 'L1', quantity: 1 }] };
        const orderService = {
            findOne: vi.fn().mockResolvedValue(order),
            cancelOrder: vi.fn().mockResolvedValue(order),
        };
        const stockMovementService = { createOutstandingReleasesForOrderLines: vi.fn().mockResolvedValue([]) };
        const notify = { user: vi.fn() };
        const feishu = { pushEvent: vi.fn().mockResolvedValue(undefined) };
        const queryRunner = {
            connect: vi.fn().mockResolvedValue(undefined),
            query: vi.fn().mockResolvedValue([{ locked: true }]),
            release: vi.fn().mockResolvedValue(undefined),
        };
        // 按实体分派：FAILED 告警取订单号走 Order 仓，任务仓走 PaymentTimeoutTask
        const rawConnection = {
            getRepository: (entity: any) => (entity && entity.name === 'Order' ? orderRepo : taskRepo),
            createQueryRunner: () => queryRunner,
        };
        const job = new PaymentTimeoutJob(
            { createQueue: vi.fn() } as any, // jobQueueService（process 不经 init 也能跑）
            { rawConnection } as any,
            orderService as any,
            { findOne: vi.fn().mockResolvedValue({}) } as any, // channelService
            stockMovementService as any,
            notify as any,
            { getConfig: vi.fn().mockResolvedValue({ h5BaseUrl: null }) } as any, // campusConfig
            feishu as any, // FeishuNotifyService（FAILED 任务告警）
        );
        return { job, taskRepo, orderRepo, task, orderService, stockMovementService, notify, feishu, order, queryRunner };
    }

    beforeEach(() => { vi.clearAllMocks(); });

    it('到点订单已支付（非 ArrangingPayment）→ 任务 CANCELLED，不取消订单', async () => {
        const { job, taskRepo, orderService } = makeJob({ orderState: 'PaymentSettled' });
        await job.process({ taskId: 1 } as any);
        expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentTimeoutStatus.CANCELLED }));
        expect(orderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('到点仍在 ArrangingPayment（CANCEL 型）→ 幂等释放库存分配再 cancelOrder + 发取消通知', async () => {
        const { job, taskRepo, stockMovementService, orderService, notify } = makeJob({ orderState: 'ArrangingPayment' });
        await job.process({ taskId: 1 } as any);
        expect(stockMovementService.createOutstandingReleasesForOrderLines).toHaveBeenCalledWith(
            expect.anything(), [{ orderLineId: 'L1', quantity: 1 }],
        );
        expect(orderService.cancelOrder).toHaveBeenCalled();
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 11, 'orderCancelled', '订单超时未支付，已自动取消', undefined);
        expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentTimeoutStatus.EXECUTED }));
    });

    it('未抢到任务锁 → 跳过本轮，不动订单（并发执行只允许一人）', async () => {
        const { job, taskRepo, orderService, notify, queryRunner } = makeJob({ orderState: 'ArrangingPayment' });
        queryRunner.query.mockResolvedValue([{ locked: false }]);
        await job.process({ taskId: 1 } as any);
        expect(orderService.cancelOrder).not.toHaveBeenCalled();
        expect(notify.user).not.toHaveBeenCalled();
        expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('REMIND 型到点仍在待支付 → 发提醒，不动订单', async () => {
        const { job, task, notify, orderService } = makeJob({ orderState: 'ArrangingPayment' });
        task.type = PaymentTimeoutType.REMIND;
        await job.process({ taskId: 1 } as any);
        expect(notify.user).toHaveBeenCalledWith(expect.anything(), 11, 'paymentPending', undefined, undefined);
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

    describe('补偿定时器（生产无 worker，ScheduledTask 不执行 → 自管循环）', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('30s 首跑 + 每 5min 一轮；重复 start 不叠加；stop 后不再触发', async () => {
            const { job } = makeJob({ orderState: 'ArrangingPayment' });
            const spy = vi.spyOn(job, 'runCompensation').mockResolvedValue(0);
            job.startCompensationLoop();
            job.startCompensationLoop(); // 幂等：不应再挂一套定时器
            expect(spy).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(30_000);
            expect(spy).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(5 * 60_000);
            expect(spy).toHaveBeenCalledTimes(2);
            job.stopCompensationLoop();
            await vi.advanceTimersByTimeAsync(30 * 60_000);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('上一轮未结束 → 本轮跳过，不并发堆叠', async () => {
            const { job } = makeJob({ orderState: 'ArrangingPayment' });
            let resolve!: (n: number) => void;
            const spy = vi.spyOn(job, 'runCompensation').mockImplementation(
                () => new Promise<number>(r => { resolve = r; }),
            );
            job.startCompensationLoop();
            await vi.advanceTimersByTimeAsync(30_000);
            expect(spy).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(5 * 60_000); // 第一轮仍挂着
            expect(spy).toHaveBeenCalledTimes(1);
            resolve(0);
            await vi.advanceTimersByTimeAsync(0); // 释放 running 标记
            await vi.advanceTimersByTimeAsync(5 * 60_000);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('补偿异常只记日志，不抛出（下一轮继续）', async () => {
            const { job } = makeJob({ orderState: 'ArrangingPayment' });
            const spy = vi.spyOn(job, 'runCompensation').mockRejectedValue(new Error('db down'));
            job.startCompensationLoop();
            await vi.advanceTimersByTimeAsync(30_000); // 不抛出即通过（.catch 已吞错）
            expect(spy).toHaveBeenCalledTimes(1);
            job.stopCompensationLoop();
        });

        it('onApplicationShutdown 清理定时器', async () => {
            const { job } = makeJob({ orderState: 'ArrangingPayment' });
            const spy = vi.spyOn(job, 'runCompensation').mockResolvedValue(0);
            job.startCompensationLoop();
            job.onApplicationShutdown();
            await vi.advanceTimersByTimeAsync(30 * 60_000);
            expect(spy).not.toHaveBeenCalled();
        });

        it('init 未完成（无 jobQueue）→ runCompensation 返回 0', async () => {
            const { job } = makeJob({ orderState: 'ArrangingPayment' });
            await expect(job.runCompensation()).resolves.toBe(0);
        });
    });

    describe('FAILED 任务飞书告警（运营不再靠翻日志发现卡单）', () => {
        const failedTask = () => ({
            id: 5, orderId: 11, channelId: 7, type: PaymentTimeoutType.CANCEL,
            dueAt: new Date(Date.now() - 60_000), status: PaymentTimeoutStatus.FAILED,
            expectedState: 'ArrangingPayment', retryCount: 3, lastError: 'db down', updatedAt: new Date(),
        });

        it('有 FAILED 任务 → pushEvent 一次（带订单号/重试次数/lastError），紧接着再扫不重复推', async () => {
            const { job, taskRepo, feishu } = makeJob({ orderState: 'ArrangingPayment' });
            (job as any).jobQueue = { add: vi.fn().mockResolvedValue(undefined) };
            taskRepo.find.mockResolvedValue([failedTask()]);
            await job.runCompensation();
            expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
            expect(feishu.pushEvent).toHaveBeenCalledWith(
                'payment_timeout_failed',
                '待付款任务失败',
                expect.stringContaining('ORD1'),
                'ORD1',
                'paytimeout_failed:5',
            );
            // 24h 去重：同一 taskId 后续轮次不再推
            await job.runCompensation();
            expect(feishu.pushEvent).toHaveBeenCalledTimes(1);
        });

        it('无 FAILED 任务 → 不推送', async () => {
            const { job, taskRepo, feishu } = makeJob({ orderState: 'ArrangingPayment' });
            (job as any).jobQueue = { add: vi.fn().mockResolvedValue(undefined) };
            taskRepo.find.mockResolvedValue([]);
            await job.runCompensation();
            expect(feishu.pushEvent).not.toHaveBeenCalled();
        });

        it('pushEvent 抛错 → 吞错不阻断 runCompensation（返回逾期条数）', async () => {
            const { job, taskRepo, feishu } = makeJob({ orderState: 'ArrangingPayment' });
            (job as any).jobQueue = { add: vi.fn().mockResolvedValue(undefined) };
            taskRepo.find.mockResolvedValue([failedTask()]);
            feishu.pushEvent.mockRejectedValueOnce(new Error('feishu down'));
            await expect(job.runCompensation()).resolves.toBe(0);
        });
    });
});
