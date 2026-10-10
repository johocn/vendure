import type { CancelPolicy } from '../hotel-config';
export type HotelBookingStatus = 'pendingDeposit' | 'confirmed' | 'checkedIn' | 'completed' | 'cancelled' | 'noShow';
export declare const HOTEL_BOOKING_STATUSES: HotelBookingStatus[];
/** 可确认（进入预订）的订单状态：ArrangingPayment 起建 pendingDeposit；PartiallyPaid/付清即确认 */
export declare const HOTEL_ORDER_PENDING_STATES: string[];
/** date-only 提取（与 C 端传参口径一致：YYYY-MM-DD 前缀即认）；非法 → null */
export declare function toDateOnly(v: unknown): string | null;
/** 服务器本地 today（YYYY-MM-DD） */
export declare function todayStr(now?: Date): string;
/** 8 位数字入住码（唯一性由 DB 唯一索引 + service 重试兜底） */
export declare function generateBookingCode(): string;
/**
 * 免费取消截止点（确认时固化）：
 * - freeUntil：入住日 checkInTime（缺省 00:00，本地时区）往前推 freeUntilHours
 * - nonRefundable / 无政策 / 数据不合法 → null（语义「无免费取消窗口」，P4 取消时按政策类型另行判定）
 */
export declare function deriveCancelDeadline(policy: CancelPolicy | null | undefined, checkIn: string, checkInTime?: string | null): Date | null;
/** 到店核销前置：confirmed 且当日 ∈ [checkIn, checkOut) */
export declare function canCheckIn(status: string, checkIn: string, checkOut: string, today: string): boolean;
/** 日常流转判定：离店日自动完成、离店日已过仍未入住 noShow；其余 → null */
export declare function dailyTransition(status: string, checkOut: string, today: string): 'completed' | 'noShow' | null;
/** 订单行酒店日期段（无/不完整 → null） */
export declare function hotelDatesOfLine(lineCf: Record<string, any> | null | undefined): {
    checkIn: string;
    checkOut: string;
} | null;
/** 订单行成交总额（分）：促销分摊后含税行价优先，回退单价×数量 */
export declare function bookingTotalCent(line: {
    prunedLinePriceWithTax?: number | null;
    linePriceWithTax?: number | null;
    quantity?: number | null;
}): number;
