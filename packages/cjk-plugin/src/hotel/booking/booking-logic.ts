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

// ===== P4 Task 14：取消报价（纯函数，无 DB/时钟副作用，可单测） =====

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

const clampFee = (fee: number, paid: number): number => Math.max(0, Math.min(Math.round(fee), Math.max(0, Math.round(paid))));

/**
 * 取消报价（design §8）：
 * - 无已结算支付（未付/仅授权）→ unpaid：不涉及退款，直接取消
 * - pendingDeposit 但已有结算款（确认事件延迟等边缘）→ 按全额退 free
 * - confirmed + freeUntil：now ≤ 截止点 → free 全额退；逾时 → partial（partial=full 扣全款，否则扣首晚），
 *   应退为 0 时落 forfeit
 * - nonRefundable → forfeit（可取消但不退）
 * - 未配置政策（null）→ blocked：顾客不可自助取消，走管理员强制取消
 */
export function computeCancelQuote(input: CancelQuoteInput): CancelQuote {
    const total = Math.max(0, Math.round(Number(input.totalCent) || 0));
    const paid = Math.max(0, Math.round(Number(input.paidCent) || 0));
    const firstNight = Math.max(0, Math.round(Number(input.firstNightFeeCent) || 0));
    const deadline = input.deadline instanceof Date && !Number.isNaN(input.deadline.getTime()) ? input.deadline : null;
    const base = { deadline };

    if (paid <= 0) return { ...base, mode: 'unpaid', free: false, cancellable: true, refundCent: 0, feeCent: 0 };
    if (input.status === 'pendingDeposit') {
        return { ...base, mode: 'free', free: true, cancellable: true, refundCent: paid, feeCent: 0 };
    }

    const policy = input.policy ?? null;
    if (!policy) {
        return { ...base, mode: 'blocked', free: false, cancellable: false, refundCent: 0, feeCent: 0 };
    }
    if (policy.type === 'nonRefundable') {
        return { ...base, mode: 'forfeit', free: false, cancellable: true, refundCent: 0, feeCent: paid };
    }

    // freeUntil
    const now = input.now ?? new Date();
    if (deadline && now.getTime() <= deadline.getTime()) {
        return { ...base, mode: 'free', free: true, cancellable: true, refundCent: paid, feeCent: 0 };
    }
    const fee = clampFee(policy.partial === 'full' ? total : firstNight, paid);
    const refund = Math.max(0, paid - fee);
    return {
        ...base,
        mode: refund > 0 ? 'partial' : 'forfeit',
        free: false,
        cancellable: true,
        refundCent: refund,
        feeCent: fee,
    };
}
