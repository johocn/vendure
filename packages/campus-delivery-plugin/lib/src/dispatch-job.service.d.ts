import { OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { ThirdPartyDeliveryService } from './third-party-delivery.service';
import { RiderCreditService } from './rider-credit.service';
export declare class DispatchJobService implements OnApplicationShutdown {
    private connection;
    private grab;
    private hall;
    private capacity;
    private credit;
    private moduleRef;
    private thirdParty?;
    private timer;
    private running;
    private orderSvc?;
    private couponSvc?;
    private paymentRepo?;
    /** 超时赔付缺配置告警限频（避免每分钟刷日志） */
    private compensationWarnAt;
    constructor(connection: TransactionalConnection, grab: HallGrabService, hall: HallService, capacity: CapacityService, credit: RiderCreditService, moduleRef: ModuleRef, thirdParty?: ThirdPartyDeliveryService | undefined);
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector();
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    /**
     * 按渠道加扫描锁：多实例幂等（pm2 多进程/多副本时同一渠道同一轮只允许一个实例扫描），
     * 同时把渠道间故障隔离——单渠道扫描抛错不再中断其余渠道（上一版全局锁整体串行，渠道多时
     * 一轮超 60s 会被 running 标志跳过，造成积压）。
     */
    private scanChannelWithLock;
    private ctxForChannel;
    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    scan(ctx: RequestContext): Promise<void>;
    /**
     * 异常上报超时升级：骑手上报异常后运营未在 SLA 内处置（inProgressSlaMinutes，默认 45）→
     * 自动回大厅重新派单（等价运营「重派」处置），避免订单卡死在 exception 占用骑手与履约时效。
     * 单条 CAS 完成「回厅 + 清异常痕迹」：类型/照片/说明保留供追责存疑——不，重派即新骑手接手，
     * 旧骑手的异常标记必须清掉，否则新骑手端会继续显示「异常单」且本轮会再次命中本规则。
     * 异常类型/说明随订单日志已留痕；campusCause=exception_timeout 供运营复盘。
     */
    private sweepExceptionTimeout;
    /**
     * 路线超时兜底：
     * 1) R1 pending_merchant 超 merchantAcceptMinutes → 自动转自营快递（owned_dispatched）
     * 2) merchant_delivering 超 merchantAutoOpenMinutes → 回抢单大厅（传信者到档口取餐）
     * 3) pending_dispatch 超 externalPushTimeoutMinutes → 回抢单大厅
     * 4) third_party 超 externalFallbackMinutes → 取消外部快递；R2 回待推送换一家，R3 回大厅
     *    （平台已接单/取货不按该阈值取消，仅 3× 硬上限兜底）
     * 5) owned_pool 超 merchantAutoOpenMinutes 无人接 → 回大厅
     * 6) owned_dispatched 超 merchantAutoOpenMinutes 未送达交接点 → 回大厅并清空骑手
     */
    private sweepRouteTimeouts;
    /**
     * 超时赔付（P0）：回扫窗口内（默认近 24h，可配）已送达单，实际送达超出承诺时间 + 宽限 → 自动发定向券。
     * 幂等：timeoutCompensatedAt 作闸，已赔单不再扫；发券失败不落痕，下一轮重试。
     * 归因（粗判）：无骑手承接 = platform；接单前耗时 > 骑手在途 = merchant，否则 rider。
     */
    private sweepTimeoutCompensation;
    /** 超时归因粗判：无骑手承接=platform；接单前耗时更长=merchant，否则=rider */
    private timeoutAttribution;
    /** 即时单（无 deliverySlotId）打包时间窗：入厅时间差 ≤10min 视为顺路 */
    private static readonly ROUTE_IMM_WINDOW_MIN;
    /**
     * T1.5 多单顺路打包（plan 3.3）：同渠道 hallStatus='open' 的 R1/R3 配送单
     * （errand 跑腿单性质不同不打包）按「同楼栋 + 同时段」分桶：
     * - 有 deliverySlotId：slot 相等即同时段；
     * - 即时单：按 hallEnteredAt 聚类，相邻时间差 ≤ ROUTE_IMM_WINDOW_MIN 分钟归一批。
     * 每批 ≥2 单写同一 routeGroupId（批内已有组 id 则复用，保持组稳定不抖动）。
     * 组 id 仅用于整组抢单与展示聚合，不严格维护成员一致性——子单被抢/回厅/退款后
     * 自然脱组（回厅清指派字段，成员过滤以 hallStatus='open' 为准）。
     */
    private packRoutes;
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
