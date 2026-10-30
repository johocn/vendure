import { OnApplicationShutdown } from '@nestjs/common';
import { ChannelService, JobQueueService, OrderService, RequestContext, StockMovementService, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
import { PaymentTimeoutTask } from './payment-timeout.entity';
export interface PaymentTimeoutJobData {
    taskId: number;
}
/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
export declare const PAYMENT_REMIND_MS: number;
export declare const PAYMENT_CANCEL_MS: number;
/**
 * 到点复查是竞态防线：任务执行时订单已离开 ArrangingPayment（已支付/已取消）→ 任务作废。
 * 取消路径按 order-timeout-plugin 先例：先幂等释放库存分配（createOutstandingReleasesForOrderLines），
 * 再 cancelOrder。任务级咨询锁保证队列 / 手动 / 补偿扫描并发时只有一人真正执行。
 *
 * 补偿扫描用自管定时器（startCompensationLoop）而非 Vendure ScheduledTask：生产为单进程
 * （pm2 只跑 API，dev-config 配 runTasksInWorkerOnly: true），ScheduledTask 在生产从不执行，
 * 曾导致超时任务永久 PENDING、订单卡在 ArrangingPayment。本插件其余后台任务（调度扫描 /
 * 飞书汇总）同样用自管定时器，部署形态一致。
 */
export declare class PaymentTimeoutJob implements OnApplicationShutdown {
    private jobQueueService;
    private connection;
    private orderService;
    private channelService;
    private stockMovementService;
    private notify;
    private campusConfig;
    private feishu;
    private jobQueue;
    private taskRepo;
    private compensation;
    /** FAILED 任务告警去重：taskId → 上次告警时间（24h 内不重复推） */
    private alertedFailed;
    constructor(jobQueueService: JobQueueService, connection: TransactionalConnection, orderService: OrderService, channelService: ChannelService, stockMovementService: StockMovementService, notify: CampusNotifyService, campusConfig: CampusConfigService, feishu: FeishuNotifyService);
    init(): Promise<void>;
    /**
     * 启动补偿扫描循环（幂等）：30s 后首跑，此后每 intervalMs 一轮。
     * 必须晚于 init()（runCompensation 依赖 jobQueue）。
     */
    startCompensationLoop(intervalMs?: number): void;
    stopCompensationLoop(): void;
    onApplicationShutdown(): void;
    process(data: PaymentTimeoutJobData): Promise<void>;
    /** 执行核心（定时队列与手动执行共用）：任务级咨询锁 → 锁内复查状态 → 提醒/取消 → 落库 */
    private runTask;
    /**
     * 会话级咨询锁（手动执行 + 队列 + 5min 补偿扫描可能同时命中同一任务）。
     * 持锁连接全程不归还连接池，保证 unlock 命中同一会话。
     */
    private withTaskLock;
    private runTaskLocked;
    /** 登记：进入 ArrangingPayment 时调用（提醒 + 取消两个任务） */
    scheduleForOrder(ctx: RequestContext, orderId: number, channelId: number, expectedState: string): Promise<void>;
    /** 离开 ArrangingPayment → 作废该订单全部 PENDING 任务 */
    cancelForOrder(orderId: number): Promise<void>;
    /** 手动执行：PENDING（无视 dueAt）/ FAILED 重试；EXECUTED/CANCELLED 拒绝。条件防并发：执行前复查状态 */
    executeTaskNow(taskId: number): Promise<PaymentTimeoutTask>;
    /** 手动重发提醒：按任务取 orderId/channelId 直发通知，不经状态机 */
    resendRemind(taskId: number): Promise<boolean>;
    /** 补偿扫描：捡起 dueAt 已过的 PENDING 任务重新入队，返回处理条数 */
    runCompensation(): Promise<number>;
    /**
     * FAILED 任务告警：补偿轮次里扫 FAILED 任务，按 taskId 24h 内只推一次飞书。
     * 此前仅 Logger.warn 到 stdout，生产曾有订单卡在 ArrangingPayment 11 天才被发现。
     * 未启用飞书时 pushEvent 静默降级，不影响主流程。
     */
    private alertFailedTasks;
    private h5Base;
    private buildCtx;
}
