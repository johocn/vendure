import { ChannelService, Injector, RequestContext, ScheduledTask } from '@vendure/core';
import { PaymentScheduleService } from './payment-schedule.service';
export declare class PaymentScheduleJob {
    private channelService;
    private scheduleService;
    constructor(channelService: ChannelService, scheduleService: PaymentScheduleService);
    /** 触发扫描 → 逾期扫描 → 发货超期扫描（逐渠道，避免跨租户误伤） */
    run(ctx: RequestContext): Promise<{
        activated: number;
        overdue: number;
        shipBreaches: number;
    }>;
    /** 供 ScheduledTask 注入器调用：遍历渠道 */
    runAllChannels(injector: Injector): Promise<{
        activated: number;
        overdue: number;
        shipBreaches: number;
    }>;
}
export declare const paymentScheduleTask: ScheduledTask<Record<string, any>>;
