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
/** free=免费窗口内全额退；partial=逾时扣首晚退余款；forfeit=分文不退；unpaid=未付款直接取消；blocked=无政策不可自助取消 */
export type CancelQuoteMode = 'free' | 'partial' | 'forfeit' | 'unpaid' | 'blocked';
export interface CancelQuote {
    mode: CancelQuoteMode;
    /** 免费取消（全额退） */
    free: boolean;
    /** 顾客可否自助取消（blocked=false：未配置取消政策，引导联系酒店；管理员强制取消不受限） */
    cancellable: boolean;
    /** 应退金额（分，≤ 实付） */
    refundCent: number;
    /** 扣款金额（分） */
    feeCent: number;
    /** 免费取消截止点（无窗口为 null） */
    deadline: Date | null;
}
export interface CancelQuoteInput {
    status: HotelBookingStatus;
    /** 方案级覆盖 → 房型级回退后的有效政策；null = 未配置政策 */
    policy: CancelPolicy | null | undefined;
    /** 确认时固化的免费取消截止点（cancelDeadlineAt） */
    deadline?: Date | null;
    now?: Date;
    /** 订单行成交总额（分） */
    totalCent: number;
    /** 已结算实付（分；未结算的授权单按 0 处理——无 Settled 支付可退） */
    paidCent: number;
    /** 首晚房费（全部房间合计，分） */
    firstNightFeeCent: number;
}
/**
 * 取消报价（design §8）：
 * - 无已结算支付（未付/仅授权）→ unpaid：不涉及退款，直接取消
 * - pendingDeposit 但已有结算款（确认事件延迟等边缘）→ 按全额退 free
 * - confirmed + freeUntil：now ≤ 截止点 → free 全额退；逾时 → partial（partial=full 扣全款，否则扣首晚），
 *   应退为 0 时落 forfeit
 * - nonRefundable → forfeit（可取消但不退）
 * - 未配置政策（null）→ blocked：顾客不可自助取消，走管理员强制取消
 */
export declare function computeCancelQuote(input: CancelQuoteInput): CancelQuote;
