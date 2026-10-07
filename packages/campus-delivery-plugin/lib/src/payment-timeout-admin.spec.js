"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const payment_timeout_job_1 = require("./payment-timeout.job");
const payment_timeout_entity_1 = require("./payment-timeout.entity");
const payment_timeout_admin_service_1 = require("./payment-timeout-admin.service");
function makeJob(overrides = {}) {
    const tasks = [];
    const taskRepo = {
        findOne: vitest_1.vi.fn(async ({ where }) => { var _a; return (_a = tasks.find(t => t.id === where.id)) !== null && _a !== void 0 ? _a : null; }),
        save: vitest_1.vi.fn(async (t) => t),
        find: vitest_1.vi.fn(async () => []),
        count: vitest_1.vi.fn(async () => 0),
        createQueryBuilder: vitest_1.vi.fn(),
    };
    const job = new payment_timeout_job_1.PaymentTimeoutJob({}, // jobQueueService：executeTaskNow 不用队列
    { rawConnection: { getRepository: () => taskRepo } }, { findOne: vitest_1.vi.fn(async () => ({ id: 1, state: 'ArrangingPayment', lines: [] })), cancelOrder: vitest_1.vi.fn(async () => ({ id: 1 })) }, // orderService
    { findOne: vitest_1.vi.fn(async () => ({ id: 1 })) }, // channelService
    { createReleasesForOrderLines: vitest_1.vi.fn(async () => undefined) }, // stockMovementService
    { user: vitest_1.vi.fn(async () => undefined) }, // notify
    { getConfig: vitest_1.vi.fn(async () => ({ h5BaseUrl: 'https://h5.test' })) });
    job.taskRepo = taskRepo;
    return { job, taskRepo, tasks, notify: job.notify, orderService: job.orderService };
}
function pendingTask(partial = {}) {
    return new payment_timeout_entity_1.PaymentTimeoutTask(Object.assign({ id: 1, orderId: 1, channelId: 1, type: payment_timeout_entity_1.PaymentTimeoutType.CANCEL, status: payment_timeout_entity_1.PaymentTimeoutStatus.PENDING, expectedState: 'ArrangingPayment', dueAt: new Date(Date.now() - 60 * 1000), retryCount: 0, lastError: null }, partial));
}
(0, vitest_1.describe)('PaymentTimeoutJob.executeTaskNow', () => {
    (0, vitest_1.it)('PENDING 任务手动执行成功（无视 dueAt 已过与否）→ EXECUTED', async () => {
        const { job, tasks, notify } = makeJob();
        const t = pendingTask({ type: payment_timeout_entity_1.PaymentTimeoutType.REMIND, dueAt: new Date(Date.now() + payment_timeout_job_1.PAYMENT_REMIND_MS) });
        tasks.push(t);
        const out = await job.executeTaskNow(1);
        (0, vitest_1.expect)(out.status).toBe(payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED);
        (0, vitest_1.expect)(notify.user).toHaveBeenCalled();
    });
    (0, vitest_1.it)('CANCEL 任务执行：释放库存 + cancelOrder + orderCancelled 通知', async () => {
        const { job, tasks, notify, orderService } = makeJob();
        tasks.push(pendingTask());
        await job.executeTaskNow(1);
        (0, vitest_1.expect)(orderService.cancelOrder).toHaveBeenCalled();
        (0, vitest_1.expect)(notify.user).toHaveBeenCalledWith(vitest_1.expect.anything(), 1, 'orderCancelled', vitest_1.expect.anything(), vitest_1.expect.anything());
    });
    (0, vitest_1.it)('EXECUTED / CANCELLED → 抛 NOT_EXECUTABLE', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ status: payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED }));
        await (0, vitest_1.expect)(job.executeTaskNow(1)).rejects.toThrow('PAYMENT_TIMEOUT_TASK_NOT_EXECUTABLE');
    });
    (0, vitest_1.it)('FAILED 任务可重试，成功后回到 EXECUTED', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ status: payment_timeout_entity_1.PaymentTimeoutStatus.FAILED, retryCount: 3, lastError: 'boom' }));
        const out = await job.executeTaskNow(1);
        (0, vitest_1.expect)(out.status).toBe(payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED);
        (0, vitest_1.expect)(out.lastError).toBeNull();
    });
    (0, vitest_1.it)('resendRemind：REMIND 任务直发 paymentPending，不经状态机', async () => {
        const { job, tasks, notify } = makeJob();
        tasks.push(pendingTask({ type: payment_timeout_entity_1.PaymentTimeoutType.REMIND, status: payment_timeout_entity_1.PaymentTimeoutStatus.EXECUTED }));
        await (0, vitest_1.expect)(job.resendRemind(1)).resolves.toBe(true);
        (0, vitest_1.expect)(notify.user).toHaveBeenCalledWith(vitest_1.expect.anything(), 1, 'paymentPending', undefined, 'https://h5.test');
    });
    (0, vitest_1.it)('resendRemind：CANCEL 任务 → 抛 REMIND_TASK_NOT_FOUND', async () => {
        const { job, tasks } = makeJob();
        tasks.push(pendingTask({ type: payment_timeout_entity_1.PaymentTimeoutType.CANCEL }));
        await (0, vitest_1.expect)(job.resendRemind(1)).rejects.toThrow('PAYMENT_TIMEOUT_REMIND_TASK_NOT_FOUND');
    });
});
(0, vitest_1.describe)('PaymentTimeoutAdminService', () => {
    function makeService(tasks, orders = []) {
        const taskRepo = {
            findAndCount: vitest_1.vi.fn(async (opts) => {
                var _a, _b, _c;
                let list = tasks.filter(t => (!opts.where.status || t.status === opts.where.status) && (!opts.where.type || t.type === opts.where.type));
                return [list.slice((_a = opts.skip) !== null && _a !== void 0 ? _a : 0, ((_b = opts.skip) !== null && _b !== void 0 ? _b : 0) + ((_c = opts.take) !== null && _c !== void 0 ? _c : 20)), list.length];
            }),
            count: vitest_1.vi.fn(async ({ where }) => {
                if ('status' in where && where.status === payment_timeout_entity_1.PaymentTimeoutStatus.PENDING)
                    return 2; // pendingOverdue
                if ('type' in where && where.type === payment_timeout_entity_1.PaymentTimeoutType.REMIND)
                    return 12; // todayRemind
                if ('type' in where && where.type === payment_timeout_entity_1.PaymentTimeoutType.CANCEL)
                    return 5; // todayCancel
                return 1; // totalFailed
            }),
        };
        const orderRepo = { find: vitest_1.vi.fn(async () => orders) };
        const svc = new payment_timeout_admin_service_1.PaymentTimeoutAdminService({ rawConnection: { getRepository: (e) => (e === core_1.Order ? orderRepo : taskRepo) } }, { executeTaskNow: vitest_1.vi.fn(async (id) => tasks.find(t => t.id === id)), runCompensation: vitest_1.vi.fn(async () => 3) });
        svc.taskRepo = taskRepo;
        svc.orderRepo = orderRepo;
        return { svc, taskRepo, orderRepo };
    }
    (0, vitest_1.it)('listTasks：返回任务 + 订单摘要映射', async () => {
        const t = pendingTask();
        const { svc } = makeService([t], [{ id: 1, code: 'A1001', state: 'Cancelled' }]);
        const out = await svc.listTasks({ status: 'PENDING', skip: 0, take: 20 });
        (0, vitest_1.expect)(out.total).toBe(1);
        (0, vitest_1.expect)(out.items[0]).toMatchObject({ orderCode: 'A1001', orderState: 'Cancelled' });
    });
    (0, vitest_1.it)('getStats：四项计数', async () => {
        const { svc } = makeService([]);
        const s = await svc.getStats();
        (0, vitest_1.expect)(s).toEqual({ todayRemind: 12, todayCancel: 5, totalFailed: 1, pendingOverdue: 2 });
    });
    (0, vitest_1.it)('executeTask 委托 job；runCompensationNow 返回条数', async () => {
        const t = pendingTask();
        const { svc } = makeService([t]);
        await svc.executeTask(1);
        (0, vitest_1.expect)(svc.job.executeTaskNow).toHaveBeenCalledWith(1);
        await (0, vitest_1.expect)(svc.runCompensationNow()).resolves.toBe(3);
    });
});
//# sourceMappingURL=payment-timeout-admin.spec.js.map