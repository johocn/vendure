import { ModuleRef } from '@nestjs/core';
import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CapacityService } from './capacity.service';
import { SlotLockService } from './slot-lock.service';
/**
 * 入厅服务：跑腿单（orderKind='errand'）或路线 R1/R3 的订单在**支付成功后**自动进入抢单大厅。
 * 含预约时段锁位（T0 前置）：锁位失败标 campusCause='slot_full'，靠调度告警人工跟进。
 * 支付闸门：由插件订阅 PaymentStateTransitionEvent（Authorized/Settled）触发，未支付订单不进大厅、不可被抢。
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
    /** 收货楼栋坐标（用于挑最近交接点）；楼栋未配坐标返回 null */
    private resolveDestPoint;
    /** 预约单时段文本（'2026-10-06 11:00-11:30' 或 '11:00-11:30'）解析时长；无法解析返回 null */
    static slotSpanMinutes(text: string): number | null;
    /**
     * 承诺送达时间（支付时固化，超时赔付判定基准）：
     * - 预约单：时段结束时间（文本解析失败退回「时段开始 + 配送时长」）
     * - 即时单：支付时间 + 店铺配送时长（未配置按 40min）
     */
    private resolvePromise;
    onOrderPlaced(ctx: RequestContext, orderInput: Order): Promise<void>;
    /** 预约单放量（调度 job 调用，plan 3.1）：按路由/快照分流 */
    releaseScheduled(ctx: RequestContext, order: Order, cfg: CampusFulfillmentConfig | null): Promise<void>;
    /** 第一段交接完成：订单进校园抢单大厅（R1/R2 接力上楼）。
     * 同时生成 4 位交接码（第二段骑手取货时校验，防丢餐扯皮），返回码值供调用方通知用户。 */
    enterHallForHandover(ctx: RequestContext, orderId: number, cause: string): Promise<string>;
    /** 回大厅：清骑手指派字段，hallStatus 复位 open（拒单/超时改派共用） */
    backToHall(ctx: RequestContext, orderId: number): Promise<void>;
    /** 取消脱厅（3.3 冒烟实测缺陷）：订单取消终态时清 hallStatus，使其退出大厅/打包扫描/整组抢单/调度台。
     * 先读 DB 当前值防 T4 mark() 竞态覆盖（no_rider_final 不碰）；grabbed 单连带清骑手指派字段。 */
    exitHall(ctx: RequestContext, order: Order): Promise<void>;
    /** 通用订单更新（T4 退款终态标记等复用） */
    updateOrder(ctx: RequestContext, orderId: number, patch: any): Promise<import("typeorm").UpdateResult>;
    /** T0: 新单入厅即提醒在线骑手（订阅消息），失败只记日志不阻塞入厅。
     * 模板 ID 复用渠道 orderShippedTemplateId（wechat 插件未定义 campus 专用模板字段），
     * 未配置则跳过；逐骑手发送，单个失败不影响其余骑手。 */
    private notifyRiders;
}
