import { DeepPartial, VendureEntity } from '@vendure/core';
import { HotelBookingStatus } from './booking-logic';
/**
 * 酒店预订单（P3，per 订单行）：一行酒店订单行 ↔ 一条 booking。
 * - 状态机：pendingDeposit → confirmed（支付事件自动确认）→ checkedIn（核销）→ completed；
 *   分支 cancelled / noShow（均终态）
 * - bookingCode：8 位数字入住码，确认时生成，全局唯一（核销凭码）
 * - cancelDeadlineAt：免费取消截止点（确认时按取消政策 + checkIn 推导固化；P4 取消退款用）
 * - channelToken：创建时的渠道 token（审计冗余；隔离以 productVariantId 全局唯一为准，同 P1 lock）
 * - 日期一律 YYYY-MM-DD varchar（跨库铁律）；时间戳列省略 type + 可选 Date
 */
export declare class HotelBooking extends VendureEntity {
    constructor(input?: DeepPartial<HotelBooking>);
    /** 入住码（8 位数字，确认时生成；pendingDeposit 阶段为 null。唯一索引允许多 NULL） */
    bookingCode: string | null;
    orderId: number;
    orderLineId: number;
    orderCode: string | null;
    channelToken: string | null;
    productVariantId: number;
    checkIn: string;
    checkOut: string;
    nights: number;
    roomCount: number;
    status: HotelBookingStatus;
    ratePlanCode: string | null;
    /** 成交总额（分，订单行实付口径） */
    totalCent: number;
    guestName: string | null;
    guestPhone: string | null;
    /** 免费取消截止点（确认时固化；null = 无免费取消窗口或无政策）。可选 Date 省略 type 跨库铁律（勿写 Date | null：联合类型反射成 Object 跨库必炸） */
    cancelDeadlineAt?: Date;
    confirmedAt?: Date;
    checkedInAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelReason: string | null;
    /** 实际扣款快照（分，P4 取消时落；0 = 免费取消/未付款；null = 未取消） */
    cancelFeeCent: number | null;
    /** 关联售后单 id（逾时部分退款走售后审批链；P4，幂等去重用） */
    afterSalesRequestId: number | null;
    /** 已使用改期次数（P4 Task 15；V1 上限 1，HOTEL_MAX_RESCHEDULES_V1） */
    rescheduleCount: number;
    /** 最近一次改期完成时间（V1 仅 0/1） */
    rescheduledAt?: Date;
    /**
     * 待支付补差的改期意向 JSON（P4 Task 15，补差异步支付期间临时持有）：
     * {checkIn,checkOut,nights,newTotalCent,diffCent,paymentId,createdAt}；
     * 支付 Settled 事件完成改期后清空；支付取消/失败亦清空。null = 无在途补差。
     */
    reschedulePendingJson: string | null;
    /** 是否有在途补差（非持久化；shop SDL 直出） */
    get reschedulePending(): boolean;
    /** 房型名（非持久化；仅 admin 列表 listForAdmin 按 ctx 语言 enrich） */
    variantName?: string | null;
}
