import { TransactionalConnection } from '@vendure/core';
import { PaymentTimeoutJob } from './payment-timeout.job';
import { PaymentTimeoutTask } from './payment-timeout.entity';
export interface PaymentTimeoutTaskRow extends PaymentTimeoutTask {
    orderCode: string | null;
    orderState: string | null;
}
export declare class PaymentTimeoutAdminService {
    private connection;
    private job;
    private taskRepo;
    private orderRepo;
    constructor(connection: TransactionalConnection, job: PaymentTimeoutJob);
    /** 任务分页列表（dueAt 倒序），附带订单号/订单状态摘要 */
    listTasks(opts: {
        status?: string;
        type?: string;
        from?: Date;
        to?: Date;
        skip?: number;
        take?: number;
    }): Promise<{
        items: PaymentTimeoutTaskRow[];
        total: number;
    }>;
    /** 看板统计：今日已提醒 / 今日已取消 / 累计失败 / 逾期未处理 */
    getStats(): Promise<{
        todayRemind: number;
        todayCancel: number;
        totalFailed: number;
        pendingOverdue: number;
    }>;
    executeTask(id: number): Promise<PaymentTimeoutTask>;
    resendRemind(taskId: number): Promise<boolean>;
    runCompensationNow(): Promise<number>;
}
