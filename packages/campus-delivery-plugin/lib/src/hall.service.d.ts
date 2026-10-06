import { ModuleRef } from '@nestjs/core';
import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在支付后自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 */
export declare class HallService {
    private connection;
    private slotLock;
    private moduleRef;
    private capacity;
    /** 预约单放量窗口：scheduledFor 前 30min 才进入商家确认/抢单大厅（plan 3.1） */
    static readonly SCHEDULE_RELEASE_MIN = 30;
    constructor(connection: TransactionalConnection, slotLock: SlotLockService, moduleRef: ModuleRef, capacity: CapacityService);
    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector();
    onOrderPlaced(ctx: RequestContext, order: Order): Promise<void>;
    /** 预约单放量（调度 job 调用，plan 3.1）：按渠道配置进入商家确认或直接入厅 */
    releaseScheduled(ctx: RequestContext, order: Order, cfg: CampusFulfillmentConfig | null): Promise<void>;
    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用） */
    backToHall(ctx: RequestContext, orderId: number): Promise<void>;
    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx: RequestContext, orderId: number, patch: any): Promise<import("typeorm").UpdateResult>;
    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    private notifyRiders;
}
