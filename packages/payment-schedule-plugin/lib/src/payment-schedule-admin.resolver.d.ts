import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { OrderPaymentSchedule } from './order-payment-schedule.entity';
import { PaymentScheduleService } from './payment-schedule.service';
export declare class PaymentScheduleAdminResolver {
    private scheduleService;
    constructor(scheduleService: PaymentScheduleService);
    paymentSchedules(ctx: RequestContext, options: ListQueryOptions<OrderPaymentSchedule>): Promise<PaginatedList<any>>;
    adminPaymentSchedule(ctx: RequestContext, id: ID): Promise<any | null>;
    openTailWindow(ctx: RequestContext, scheduleId: ID): Promise<any>;
    confirmSellerBreach(ctx: RequestContext, scheduleId: ID): Promise<any>;
    confirmCodReceived(ctx: RequestContext, orderId: ID): Promise<any>;
    releaseRentalDeposit(ctx: RequestContext, orderId: ID): Promise<any>;
    /** 手动触发调度扫描（运维工具 + e2e 依赖；与每分钟 ScheduledTask 等价） */
    runScheduleScan(ctx: RequestContext): Promise<{
        activated: number;
        overdue: number;
        shipBreaches: number;
    }>;
}
