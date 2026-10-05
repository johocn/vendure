import { OnApplicationShutdown } from '@nestjs/common';
import { Injector, RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { RiderCreditService } from './rider-credit.service';
export declare class DispatchJobService implements OnApplicationShutdown {
    private connection;
    private grab;
    private hall;
    private capacity;
    private credit;
    private injector;
    private timer;
    private running;
    private orderSvc?;
    private couponSvc?;
    private paymentRepo?;
    constructor(connection: TransactionalConnection, grab: HallGrabService, hall: HallService, capacity: CapacityService, credit: RiderCreditService, injector: Injector);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    private ctxForChannel;
    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    scan(ctx: RequestContext): Promise<void>;
    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    private orderInChannel;
    /** T4 惰性服务解析（job 定时器首跳早于完整依赖可用，首次退款时才初始化） */
    private services;
    /** 补偿券服务：coupon-plugin 为可选依赖，动态 require + Injector 解析，
     * 未安装/未启用/解析失败一律返回 null（跳过发券，不阻断退款主流程）。 */
    private tryGetCouponService;
    /**
     * T4: open 超 autoRefundMinutes 无人接单 → 全额原路退款 + Cancelled + no_rider 对账标记 + 定向补偿券。
     * 本 fork 无 core RefundService，退款走 OrderService.refundOrder/settleRefund（与 after-sales 插件同源）。
     * 失败降级：同样写 campusCause='no_rider' + hallStatus='no_rider_final' 留人工，Logger 留痕，不抛出。
     */
    private refundNoRider;
}
