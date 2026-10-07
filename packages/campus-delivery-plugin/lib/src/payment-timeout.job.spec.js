"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const payment_timeout_job_1 = require("./payment-timeout.job");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
(0, vitest_1.describe)('PaymentTimeoutJob', () => {
    function makeJob(opts) {
        const task = {
            id: 1, orderId: 11, channelId: 7, type: payment_timeout_entity_1.PaymentTimeoutType.CANCEL,
            // dueAtPast=false → 60s 后到期（未到点）；默认 → 已到期（到点复查语义）
            dueAt: new Date(Date.now() - (opts.dueAtPast === false ? -60000 : 1)),
            status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING, expectedState: 'ArrangingPayment', retryCount: 0, lastError: null,
        };
        const taskRepo = {
            findOne: vitest_1.vi.fn().mockResolvedValue(task),
            save: vitest_1.vi.fn().mockImplementation(async (t) => t),
            find: vitest_1.vi.fn().mockResolvedValue([]),
        };
        const order = { id: 11, code: 'ORD1', state: opts.orderState, lines: [{ id: 'L1', quantity: 1 }] };
        const orderService = {
            findOne: vitest_1.vi.fn().mockResolvedValue(order),
            cancelOrder: vitest_1.vi.fn().mockResolvedValue(order),
        };
        const stockMovementService = { createReleasesForOrderLines: vitest_1.vi.fn().mockResolvedValue([]) };
        const notify = { user: vitest_1.vi.fn() };
        const job = new payment_timeout_job_1.PaymentTimeoutJob({ createQueue: vitest_1.vi.fn() }, // jobQueueService（process 不经 init 也能跑）
        { rawConnection: { getRepository: () => taskRepo } }, orderService, { findOne: vitest_1.vi.fn().mockResolvedValue({}) }, // channelService
        stockMovementService, notify, { getConfig: vitest_1.vi.fn().mockResolvedValue({ h5BaseUrl: null }) });
        return { job, taskRepo, task, orderService, stockMovementService, notify, order };
    }
    (0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
    (0, vitest_1.it)('到点订单已支付（非 ArrangingPayment）→ 任务 CANCELLED，不取消订单', async () => {
        const { job, taskRepo, orderService } = makeJob({ orderState: 'PaymentSettled' });
        await job.process({ taskId: 1 });
        (0, vitest_1.expect)(taskRepo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: payment_timeout_entity_1.PaymentTimeoutStatus.CANCELLED }));
        (0, vitest_1.expect)(orderService.cancelOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('到点仍在 ArrangingPayment（CANCEL 型）→ 先释放库存分配再 cancelOrder + 发取消通知', async () => {
        const { job, taskRepo, stockMovementService, orderService, notify } = makeJob({ orderState: 'ArrangingPayment' });
        await job.process({ taskId: 1 });
        (0, vitest_1.expect)(stockMovementService.createReleasesForOrderLines).toHaveBeenCalledWith(vitest_1.expect.anything(), [{ orderLineId: 'L1', quantity: 1 }]);
        (0, vitest_1.expect)(orderService.cancelOrder).toHaveBeenCalled();
        (0, vitest_1.expect)(notify.user).toHaveBeenCalledWith(vitest_1.expect.anything(), 11, 'orderCancelled', '订单超时未支付，已自动取消', undefined);
        (0, vitest_1.expect)(taskRepo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED }));
    });
    (0, vitest_1.it)('REMIND 型到点仍在待支付 → 发提醒，不动订单', async () => {
        const { job, task, notify, orderService } = makeJob({ orderState: 'ArrangingPayment' });
        task.type = payment_timeout_entity_1.PaymentTimeoutType.REMIND;
        await job.process({ taskId: 1 });
        (0, vitest_1.expect)(notify.user).toHaveBeenCalledWith(vitest_1.expect.anything(), 11, 'paymentPending', undefined, undefined);
        (0, vitest_1.expect)(orderService.cancelOrder).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('未到 dueAt → 跳过保持 PENDING（SQL JobQueue 忽略 delay 兜底语义）', async () => {
        const { job, taskRepo } = makeJob({ orderState: 'ArrangingPayment', dueAtPast: false });
        await job.process({ taskId: 1 });
        (0, vitest_1.expect)(taskRepo.save).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('常量：提醒 10 分钟 / 取消 15 分钟', () => {
        (0, vitest_1.expect)(payment_timeout_job_1.PAYMENT_REMIND_MS).toBe(10 * 60 * 1000);
        (0, vitest_1.expect)(payment_timeout_job_1.PAYMENT_CANCEL_MS).toBe(15 * 60 * 1000);
    });
});
//# sourceMappingURL=payment-timeout.job.spec.js.map