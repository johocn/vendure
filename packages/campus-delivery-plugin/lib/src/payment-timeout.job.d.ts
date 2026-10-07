import { ChannelService, JobQueueService, OrderService, RequestContext, StockMovementService, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
export interface PaymentTimeoutJobData {
    taskId: number;
}
/** 待付款提醒 / 超时取消（时长常量，不做配置，spec §4.3） */
export declare const PAYMENT_REMIND_MS: number;
export declare const PAYMENT_CANCEL_MS: number;
/**
 * 到点复查是竞态防线：任务执行时订单已离开 ArrangingPayment（已支付/已取消）→ 任务作废。
 * 取消路径按 order-timeout-plugin 先例：先显式释放库存分配（active 订单 cancelOrder 不释放），
 * 再 cancelOrder。与 OrderTimeoutPlugin（渠道 30min 兜底）共存，幂等无害。
 */
export declare class PaymentTimeoutJob {
    private jobQueueService;
    private connection;
    private orderService;
    private channelService;
    private stockMovementService;
    private notify;
    private campusConfig;
    private jobQueue;
    private taskRepo;
    constructor(jobQueueService: JobQueueService, connection: TransactionalConnection, orderService: OrderService, channelService: ChannelService, stockMovementService: StockMovementService, notify: CampusNotifyService, campusConfig: CampusConfigService);
    init(): Promise<void>;
    process(data: PaymentTimeoutJobData): Promise<void>;
    /** 登记：进入 ArrangingPayment 时调用（提醒 + 取消两个任务） */
    scheduleForOrder(ctx: RequestContext, orderId: number, channelId: number, expectedState: string): Promise<void>;
    /** 离开 ArrangingPayment → 作废该订单全部 PENDING 任务 */
    cancelForOrder(orderId: number): Promise<void>;
    /** 补偿扫描：捡起 dueAt 已过的 PENDING 任务重新入队 */
    runCompensation(): Promise<void>;
    private h5Base;
    private buildCtx;
}
