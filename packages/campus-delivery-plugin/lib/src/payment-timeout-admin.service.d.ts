import { RequestContext, TransactionalConnection } from '@vendure/core';
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
    private isPlatformAdmin;
    /** 非平台超管只能操作本渠道任务，避免误读/误取消其他店铺待付款单 */
    private assertTaskScope;
    /** 任务分页列表（dueAt 倒序），附带订单号/订单状态摘要 */
    listTasks(ctx: RequestContext, opts: {
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
    /** 看板统计：今日已提醒 / 今日已取消 / 累计失败 / 逾期未处理（非超管限本渠道） */
    getStats(ctx: RequestContext): Promise<{
        todayRemind: number;
        todayCancel: number;
        totalFailed: number;
        pendingOverdue: number;
    }>;
    executeTask(ctx: RequestContext, id: number): Promise<PaymentTimeoutTask>;
    resendRemind(ctx: RequestContext, taskId: number): Promise<boolean>;
    runCompensationNow(): Promise<number>;
}
