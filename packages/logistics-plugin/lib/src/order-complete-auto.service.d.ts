import { Injector, RequestContext } from '@vendure/core';
/**
 * 自动交易完成：扫描 state='Delivered' 且 fulfillmentDeliveredAt <= now - completeDays 的订单
 * 推进到 Completed。手动（runAutoCompleteScan mutation）/定时（order-complete-auto ScheduledTask）共用。
 * 完成天数：Channel.orderCompleteDays 覆盖 > 插件 defaultCompleteDays > 默认 3 天。
 */
export declare class OrderCompleteAutoService {
    private injector;
    private orderService;
    private channelService;
    private requestContextService;
    init(injector: Injector): void;
    /** 定时任务入口：构造默认渠道 ctx 后扫描（内部任务，无用户上下文） */
    runAutoCompleteJob(): Promise<number>;
    /** 扫描并自动完成；返回本次完成订单数 */
    runAutoCompleteScan(ctx: RequestContext, now?: Date): Promise<number>;
}
