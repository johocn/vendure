import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelRatePlanService } from './rate-plan.service';
import { HotelBooking } from './booking.entity';
export interface HotelBookingAdminFilter {
    status?: string;
    variantId?: ID;
    orderId?: ID;
    orderCode?: string;
}
export declare class HotelBookingService {
    private conn;
    private inventory;
    private ratePlans;
    constructor(conn: TransactionalConnection, inventory: HotelInventoryService, ratePlans: HotelRatePlanService);
    private repo;
    listByOrder(ctx: RequestContext, orderId: ID): Promise<HotelBooking[]>;
    /** 订单行当前预订单（最新一条；同一行重建场景取 id 最大） */
    getByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<HotelBooking | null>;
    findByCode(ctx: RequestContext, code: string): Promise<HotelBooking | null>;
    /** 商家端简版列表（Task 13 预订管理页数据源；id DESC 尾页语义，上限 200） */
    listForAdmin(ctx: RequestContext, filter?: HotelBookingAdminFilter, take?: number): Promise<HotelBooking[]>;
    /** C 端「我的预订」：按顾客名下订单 id 集合过滤（归属隔离在 resolver 层做），可选状态过滤 */
    listForCustomer(ctx: RequestContext, orderIds: number[], status?: string): Promise<HotelBooking[]>;
    /**
     * 幂等创建 pending 预订单（per 酒店订单行）：
     * - 行已有非 cancelled booking → 跳过；若仍为 pendingDeposit 则同步可能变化的日期/数量/金额
     * - 行仅有 cancelled 旧 booking（整单取消后重走支付等边缘）→ 重建新 pending 行
     */
    ensurePendingBookings(ctx: RequestContext, order: Order): Promise<HotelBooking[]>;
    /** pending 阶段与订单行保持一致（加购后调整日期/数量/方案的场景） */
    private syncPendingWithLine;
    /** 客人信息：行 customFields（预留）→ 订单客户 → 收货地址 */
    private guestOf;
    /**
     * 幂等确认订单下全部 pending 预订单：生成入住码 + 固化取消截止点 + hold→booked。
     * 状态守卫在调用方（handleOrderUpdated 按订单状态判断）。
     */
    confirmPendingForOrder(ctx: RequestContext, orderId: ID): Promise<HotelBooking[]>;
    /** 8 位入住码分配：随机 + 查重重试，5 次未命中回退时间戳后 8 位（唯一索引兜底） */
    private allocateCode;
    /** 取消截止点固化：方案级 cancelPolicyOverride 优先，回退房型 hotelRoomConfig.cancelPolicy；checkInTime 取房型配置 */
    private deriveDeadline;
    /**
     * OrderStateTransitionEvent 入口：事件携带的 order 不保证加载 lines/customer，
     * 按 id 重取完整订单后复用 handleOrderUpdated（幂等，双路触发无副作用）。
     */
    handleOrderTransition(ctx: RequestContext, orderId: ID): Promise<void>;
    /**
     * 订单更新 reconcile：
     * - 无酒店行 / 状态不在可处理集合 → no-op
     * - PENDING_STATES → ensure 幂等建单
     * - PartiallyPaid（首期付清）/ PaymentSettled（全清）→ confirm
     */
    handleOrderUpdated(ctx: RequestContext, order: Order): Promise<void>;
    /** 到店核销：凭 id 或 8 位入住码；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    checkIn(ctx: RequestContext, input: {
        id?: ID;
        code?: string;
    }): Promise<HotelBooking>;
    /** 手动完成离店：仅 checkedIn 可完成（日常定时任务兜底自动完成） */
    complete(ctx: RequestContext, id: ID): Promise<HotelBooking>;
    /**
     * 管理员强制取消：pendingDeposit/confirmed → cancelled 并释放锁房。
     * 退款走 Task 14 售后单（本方法不处理钱）。
     */
    forceCancel(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking>;
    /**
     * 离店日自动完成 / 过离店日未入住 noShow：
     * - checkedIn 且 today >= checkOut → completed
     * - confirmed 且 today > checkOut → noShow（不动锁：过去晚 booked 锁留审计，不影响未来售卖）
     */
    runDailyTransitions(ctx: RequestContext, now?: Date): Promise<{
        completed: number;
        noShow: number;
    }>;
}
