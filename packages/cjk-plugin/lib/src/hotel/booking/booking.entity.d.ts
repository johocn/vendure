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
    /** 免费取消截止点（确认时固化；null = 无免费取消窗口或无政策） */
    cancelDeadlineAt?: Date | null;
    confirmedAt?: Date | null;
    checkedInAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    cancelReason: string | null;
}
