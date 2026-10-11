import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { AfterSalesStateTransitionEvent } from '@vendure/after-sales-plugin';
import type { AfterSalesService } from '@vendure/after-sales-plugin';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelRatePlanService } from './rate-plan.service';
import { type CancelQuote } from './booking-logic';
import { HotelBooking } from './booking.entity';
export interface HotelBookingAdminFilter {
    status?: string;
    variantId?: ID;
    orderId?: ID;
    orderCode?: string;
}
/** 取消报价结果（shop/admin 共用；SDL 映射由 resolver 完成） */
export interface HotelCancelQuoteResult {
    booking: HotelBooking;
    quote: CancelQuote;
    /** 已结算实付快照（分） */
    paidCent: number;
    /** 首晚房费（全部房间合计，分） */
    firstNightFeeCent: number;
}
export declare class HotelBookingService {
    private conn;
    private inventory;
    private ratePlans;
    /** after-sales 插件由 plugin.ts onInit 延迟注入（跨插件依赖，规避模块初始化顺序） */
    private afterSales;
    constructor(conn: TransactionalConnection, inventory: HotelInventoryService, ratePlans: HotelRatePlanService);
    setAfterSalesService(svc: AfterSalesService): void;
    private repo;
    listByOrder(ctx: RequestContext, orderId: ID): Promise<HotelBooking[]>;
    /** 订单行当前预订单（最新一条；同一行重建场景取 id 最大） */
    getByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<HotelBooking | null>;
    findByCode(ctx: RequestContext, code: string): Promise<HotelBooking | null>;
    /** 商家端简版列表（Task 13 预订管理页数据源；id DESC 尾页语义，上限 200） */
    listForAdmin(ctx: RequestContext, filter?: HotelBookingAdminFilter, take?: number): Promise<HotelBooking[]>;
    /** 批量补房型名（非持久化字段，仅 admin 列表展示；按 ctx 语言取 translation） */
    private enrichVariantNames;
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
    /** 有效取消政策解析：方案级 cancelPolicyOverride 优先（坏 JSON 回退），再回退房型 hotelRoomConfig.cancelPolicy */
    private resolvePolicy;
    /** 取消截止点固化：checkInTime 取房型配置（缺省 00:00） */
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
     * 取消报价（design §8）：解析有效政策 + 已结算实付 + 首晚房费，交纯函数 computeCancelQuote。
     * 可取消状态白名单之外（已入住/已完成/noShow/已取消）一律拒绝。
     */
    quoteCancel(ctx: RequestContext, id: ID, now?: Date): Promise<HotelCancelQuoteResult>;
    /** 订单已结算（Settled）支付合计（分）；仅 Settled 可走 refundOrder 退款，Authorized 不计 */
    private settledPaidCent;
    /**
     * 首晚房费（全部房间合计，分）：服务端用房型配置+方案重算（hotelNightly 不落库）；
     * 配置缺失/重算失败时兜底 ceil(成交总额/晚数)，保证扣款口径非 0。
     */
    private firstNightFeeCent;
    /**
     * 顾客自助取消（归属隔离在 resolver 层）：
     * - unpaid（未付/仅授权）/ forfeit（扣全款不退）→ 立即置 cancelled + 释放锁房，无售后单
     * - free（免费窗口内）→ 建 refund_only 售后单并自动审批退款；退款成功后立即收口；
     *   RefundFailed 不取消、不释放，售后单留痕可重试
     * - partial（逾时扣首晚退余款）→ 建 Pending 售后单等待商家审批，booking 保持 confirmed 与锁房；
     *   审批 Refunded 后由 handleAfterSalesRefunded 收口
     * - blocked（未配置政策）→ 拒绝，引导联系酒店
     */
    cancelByCustomer(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking>;
    /**
     * 管理员强制取消（升级）：
     * - 已有售后单在途 → 拒绝（防止双退；退款完成事件会自动收口）
     * - 有已结算款 → 建售后单全额退款并自动审批，Refunded 后才置 cancelled + 释放锁房
     * - 无结算款 / 售后插件缺失（仅遗留环境）→ 直接取消释放
     */
    forceCancel(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking>;
    /**
     * 售后状态事件收口（plugin.ts 订阅 AfterSalesStateTransitionEvent）：
     * 仅 Refunded 触发；按 orderLineId 反查在途预订，置 cancelled + 释放锁房。
     * 扣款快照 = 已付 − 实际退款；幂等（已取消/noShow/已入住均 no-op）。
     */
    handleAfterSalesRefunded(event: AfterSalesStateTransitionEvent): Promise<void>;
    /**
     * 售后单在途守卫：关联单处于 Pending/Approved/Received/RefundFailed 等活动态 → 阻断（防双退）；
     * Rejected/Closed → 视为已终结，清空关联放行（可重新发起）；Refunded 理论上 booking 已收口，亦阻断。
     */
    private assertNoActiveAfterSales;
    /** 取消收口：置 cancelled + 扣款快照 + 释放该行全部 lock（幂等） */
    private finalizeCancel;
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
