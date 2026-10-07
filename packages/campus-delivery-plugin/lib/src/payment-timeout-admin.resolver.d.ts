import { ID, RequestContext } from '@vendure/core';
import { PaymentTimeoutAdminService } from './payment-timeout-admin.service';
/** 待付款超时任务的运营后台查询 / 统计 / 手动执行（权限按订单读写走） */
export declare class PaymentTimeoutAdminResolver {
    private admin;
    constructor(admin: PaymentTimeoutAdminService);
    paymentTimeoutTasks(ctx: RequestContext, status?: string, type?: string, from?: Date, to?: Date, skip?: number, take?: number): Promise<{
        items: import("./payment-timeout-admin.service").PaymentTimeoutTaskRow[];
        total: number;
    }>;
    paymentTimeoutStats(ctx: RequestContext): Promise<{
        todayRemind: number;
        todayCancel: number;
        totalFailed: number;
        pendingOverdue: number;
    }>;
    executePaymentTimeoutTask(ctx: RequestContext, id: ID): Promise<import("./payment-timeout.entity").PaymentTimeoutTask>;
    resendPaymentTimeoutRemind(ctx: RequestContext, taskId: ID): Promise<boolean>;
    runPaymentTimeoutCompensation(ctx: RequestContext): Promise<number>;
}
