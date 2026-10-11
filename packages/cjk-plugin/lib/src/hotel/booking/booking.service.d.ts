import { ID, Order, OrderModifier, OrderService, PaymentService, PaymentStateTransitionEvent, RequestContext, TransactionalConnection } from '@vendure/core';
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
/** 改期逐晚可行性（remaining 已含本单旧锁；feasible=扣除旧锁后可住） */
export interface HotelRescheduleNight {
    date: string;
    /** 原始余量（null=不限房） */
    remaining: number | null;
    closed: boolean;
    feasible: boolean;
}
/** 改期报价结果 */
export interface HotelRescheduleQuoteResult {
    booking: HotelBooking;
    eligible: boolean;
    /** 拦截码：纯函数规则码或 soldOut */
    reason?: string;
    message?: string;
    oldCheckIn: string;
    oldCheckOut: string;
    newCheckIn: string;
    newCheckOut: string;
    nights: number;
    oldTotalCent: number;
    /** 规则/房态/配置不通过时为 null */
    newTotalCent: number | null;
    /** 新−旧（分）：正=补差，负=退差 */
    diffCent: number | null;
    refundCent: number | null;
    supplementCent: number | null;
    availability: HotelRescheduleNight[];
}
/** 改期 mutation 结果：applied=false 时为补差异步支付在途，需等支付 Settled 事件收口 */
export interface HotelRescheduleMutationResult {
    booking: HotelBooking;
    applied: boolean;
    paymentState: string | null;
    paymentId: number | null;
    supplementCent: number;
    /** 支付透传参数（如微信 payUrl/payType，原样来自 payment.metadata.public） */
    paymentPublic: Record<string, any> | null;
}
export declare class HotelBookingService {
    private conn;
    private inventory;
    private ratePlans;
    private orderService;
    private orderModifier;
    private paymentService;
    /** after-sales 插件由 plugin.ts onInit 延迟注入（跨插件依赖，规避模块初始化顺序） */
    private afterSales;
    constructor(conn: TransactionalConnection, inventory: HotelInventoryService, ratePlans: HotelRatePlanService, orderService: OrderService, orderModifier: OrderModifier, paymentService: PaymentService);
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
    /**
     * 房型计价上下文：variant + 解析后的 hotelRoomConfig + 有效取消政策 + 房价方案调整。
     * 有效取消政策：方案级 cancelPolicyOverride 优先（坏 JSON 回退房型级），再回退房型 cancelPolicy。
     */
    private resolveRoomContext;
    /** 有效取消政策解析（Task 14；语义保留，实现转调 resolveRoomContext） */
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
    /**
     * 改期报价（不落库）：
     * - 规则（confirmed + V1 限改 1 次 + advanceDays/min/maxNights）不通过 → eligible=false + reason
     * - 房态：逐晚把「本单旧段内自身 booked 锁」加回余量后判定 feasible
     * - 价格：与 HotelOrderItemPriceCalculationStrategy 同口径（calcNightlyPricing.stayTotalCent，
     *   quantity=间数时策略除间数再乘回，行小计≈住宿总价）；最终以提交时重算订单行为准
     */
    quoteReschedule(ctx: RequestContext, id: ID, dto: {
        checkIn: string;
        checkOut: string;
    }, now?: Date): Promise<HotelRescheduleQuoteResult>;
    /** 逐晚可行性：旧段内的晚把本单 roomCount 间自身锁加回（移动锁房的净占用口径） */
    private rescheduleAvailability;
    /**
     * 顾客提交改期（归属隔离在 resolver 层；须在事务内调用）：
     * - 等价/退差：移动锁房 → 订单行重定价 → 退差走售后系统单自动退款 → 预订改期完成
     * - 补差：先建补差 Payment（不动订单行/锁/价）：
     *   · 同步 Settled（钱包/模拟支付）→ Payment 事件内同步完成改期
     *   · 异步 Authorized（微信/COD）→ 落 reschedulePendingJson，等 Settled 事件收口
     */
    rescheduleByCustomer(ctx: RequestContext, id: ID, dto: {
        checkIn: string;
        checkOut: string;
        paymentMethod?: string | null;
    }): Promise<HotelRescheduleMutationResult>;
    /** 顾客放弃补差：支付未结算则取消 Payment 并清空在途意向（Settled 会自动完成改期，拒绝取消） */
    cancelRescheduleSupplement(ctx: RequestContext, id: ID): Promise<HotelBooking>;
    /**
     * 补差 Payment 状态事件入口（plugin.ts 订阅 PaymentStateTransitionEvent）：
     * - Settled → 完成改期（意向单或同步支付 metadata 定日期）
     * - Cancelled/Declined/Error → 清空在途意向
     * 路由双通道：metadata 标记（模拟支付/透传 metadata 的网关）+ 在途意向 paymentId 匹配
     * （COD 等 handler 会覆写 metadata，必须靠 booking.reschedulePendingJson 关联）。
     * 非补差支付一律 no-op。
     */
    handleReschedulePayment(event: PaymentStateTransitionEvent): Promise<void>;
    /** 改期前置守卫：状态 + 限次 + 在途补差 */
    private assertReschedulable;
    /** 规则 + 房态 + 价格，构造改期目标（不通过直接 UserInputError） */
    private buildRescheduleTarget;
    private parsePending;
    /**
     * 改期落地（须在调用方事务内；事件/直提两路复用）：
     * 1. 重新加载并重验规则/房态（支付期间可能被抢房）
     * 2. 释放旧 booked 锁 → holdForOrder 权威重验并落新段 hold → confirmLocks 转 booked
     * 3. 订单行自定义字段改日期 → OrderModifier/OrderCalculator 重定价（酒店计价策略按新日期逐晚计价）
     * 4. 多退少补：退差走售后系统单自动退款；补差校验 Settled Payment 覆盖差额（舍入多收 >1 分退回）
     * 5. booking 日期/晚数/总额/次数/取消截止点固化，清在途意向
     */
    private applyReschedule;
}
