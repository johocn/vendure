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
    /**
     * 手动触发调度扫描（与每分钟 ScheduledTask 等价的同一套 service 方法）。
     * 扫描范围由 ctx.channelId 限定（processTriggers / processOverdue / processShipDeadlines
     * 均按 channelScheduleIds(ctx) 取数），店长手动触发只会影响自己渠道的数据。
     * 定时任务走 PaymentScheduleJob.runAllChannels（逐渠道），不经过本 resolver 的 @Allow。
     */
    runScheduleScan(ctx: RequestContext): Promise<{
        activated: number;
        overdue: number;
        shipBreaches: number;
    }>;
}
