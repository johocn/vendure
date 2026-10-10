// 预订单纯函数（P3 Task 10）：状态机谓词 + 入住码 + 取消截止点推导 + 日常流转判定
// 日期口径：一律 YYYY-MM-DD 字符串比较（与 P1 hotel-inventory-logic 同语义）；today 为服务器本地日期
import type { CancelPolicy } from '../hotel-config';

export type HotelBookingStatus =
    | 'pendingDeposit'
    | 'confirmed'
    | 'checkedIn'
    | 'completed'
    | 'cancelled'
    | 'noShow';

export const HOTEL_BOOKING_STATUSES: HotelBookingStatus[] = [
    'pendingDeposit',
    'confirmed',
    'checkedIn',
    'completed',
    'cancelled',
    'noShow',
];

/** 可确认（进入预订）的订单状态：ArrangingPayment 起建 pendingDeposit；PartiallyPaid/付清即确认 */
export const HOTEL_ORDER_PENDING_STATES = ['ArrangingPayment', 'PartiallyPaid', 'PaymentSettled', 'OrderPlaced'];

/** date-only 提取（与 C 端传参口径一致：YYYY-MM-DD 前缀即认）；非法 → null */
export function toDateOnly(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** 服务器本地 today（YYYY-MM-DD） */
export function todayStr(now?: Date): string {
    const d = now ?? new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 8 位数字入住码（唯一性由 DB 唯一索引 + service 重试兜底） */
export function generateBookingCode(): string {
    let out = '';
    for (let i = 0; i < 8; i++) out += String(Math.floor(Math.random() * 10));
    return out;
}

/**
 * 免费取消截止点（确认时固化）：
 * - freeUntil：入住日 checkInTime（缺省 00:00，本地时区）往前推 freeUntilHours
 * - nonRefundable / 无政策 / 数据不合法 → null（语义「无免费取消窗口」，P4 取消时按政策类型另行判定）
 */
export function deriveCancelDeadline(
    policy: CancelPolicy | null | undefined,
    checkIn: string,
    checkInTime?: string | null,
): Date | null {
    if (!policy || policy.type !== 'freeUntil') return null;
    const n = Number(policy.freeUntilHours);
    if (!Number.isFinite(n) || n <= 0) return null;
    const checkInDate = toDateOnly(checkIn);
    if (!checkInDate) return null;
    const t = /^\d{2}:\d{2}/.exec(String(checkInTime ?? '').trim())?.[0] ?? '00:00';
    const base = new Date(`${checkInDate}T${t}:00`);
    if (Number.isNaN(base.getTime())) return null;
    return new Date(base.getTime() - n * 3_600_000);
}

/** 到店核销前置：confirmed 且当日 ∈ [checkIn, checkOut) */
export function canCheckIn(status: string, checkIn: string, checkOut: string, today: string): boolean {
    if (status !== 'confirmed') return false;
    return !!toDateOnly(checkIn) && !!toDateOnly(checkOut) && checkIn <= today && today < checkOut;
}

/** 日常流转判定：离店日自动完成、离店日已过仍未入住 noShow；其余 → null */
export function dailyTransition(status: string, checkOut: string, today: string): 'completed' | 'noShow' | null {
    const out = toDateOnly(checkOut);
    if (!out) return null;
    if (status === 'checkedIn' && today >= checkOut) return 'completed';
    if (status === 'confirmed' && today > checkOut) return 'noShow';
    return null;
}

/** 订单行酒店日期段（无/不完整 → null） */
export function hotelDatesOfLine(lineCf: Record<string, any> | null | undefined): {
    checkIn: string;
    checkOut: string;
} | null {
    const checkIn = toDateOnly(lineCf?.hotelCheckIn);
    const checkOut = toDateOnly(lineCf?.hotelCheckOut);
    return checkIn && checkOut ? { checkIn, checkOut } : null;
}

/** 订单行成交总额（分）：促销分摊后含税行价优先，回退单价×数量 */
export function bookingTotalCent(line: {
    prunedLinePriceWithTax?: number | null;
    linePriceWithTax?: number | null;
    quantity?: number | null;
}): number {
    if (typeof line.prunedLinePriceWithTax === 'number') return Math.round(line.prunedLinePriceWithTax);
    if (typeof line.linePriceWithTax === 'number') {
        return Math.round(line.linePriceWithTax * Math.max(1, line.quantity ?? 1));
    }
    return 0;
}
