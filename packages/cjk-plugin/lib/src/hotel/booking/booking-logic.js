"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOTEL_MAX_RESCHEDULES_V1 = exports.HOTEL_ORDER_PENDING_STATES = exports.HOTEL_BOOKING_STATUSES = void 0;
exports.toDateOnly = toDateOnly;
exports.todayStr = todayStr;
exports.generateBookingCode = generateBookingCode;
exports.deriveCancelDeadline = deriveCancelDeadline;
exports.canCheckIn = canCheckIn;
exports.dailyTransition = dailyTransition;
exports.hotelDatesOfLine = hotelDatesOfLine;
exports.bookingTotalCent = bookingTotalCent;
exports.computeCancelQuote = computeCancelQuote;
exports.isValidDateOnly = isValidDateOnly;
exports.addDaysDateOnly = addDaysDateOnly;
exports.evaluateRescheduleRules = evaluateRescheduleRules;
exports.HOTEL_BOOKING_STATUSES = [
    'pendingDeposit',
    'confirmed',
    'checkedIn',
    'completed',
    'cancelled',
    'noShow',
];
/** 可确认（进入预订）的订单状态：ArrangingPayment 起建 pendingDeposit；PartiallyPaid/付清即确认 */
exports.HOTEL_ORDER_PENDING_STATES = ['ArrangingPayment', 'PartiallyPaid', 'PaymentSettled', 'OrderPlaced'];
/** date-only 提取（与 C 端传参口径一致：YYYY-MM-DD 前缀即认）；非法 → null */
function toDateOnly(v) {
    if (typeof v !== 'string')
        return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
/** 服务器本地 today（YYYY-MM-DD） */
function todayStr(now) {
    const d = now !== null && now !== void 0 ? now : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** 8 位数字入住码（唯一性由 DB 唯一索引 + service 重试兜底） */
function generateBookingCode() {
    let out = '';
    for (let i = 0; i < 8; i++)
        out += String(Math.floor(Math.random() * 10));
    return out;
}
/**
 * 免费取消截止点（确认时固化）：
 * - freeUntil：入住日 checkInTime（缺省 00:00，本地时区）往前推 freeUntilHours
 * - nonRefundable / 无政策 / 数据不合法 → null（语义「无免费取消窗口」，P4 取消时按政策类型另行判定）
 */
function deriveCancelDeadline(policy, checkIn, checkInTime) {
    var _a, _b;
    if (!policy || policy.type !== 'freeUntil')
        return null;
    const n = Number(policy.freeUntilHours);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    const checkInDate = toDateOnly(checkIn);
    if (!checkInDate)
        return null;
    const t = (_b = (_a = /^\d{2}:\d{2}/.exec(String(checkInTime !== null && checkInTime !== void 0 ? checkInTime : '').trim())) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '00:00';
    const base = new Date(`${checkInDate}T${t}:00`);
    if (Number.isNaN(base.getTime()))
        return null;
    return new Date(base.getTime() - n * 3600000);
}
/** 到店核销前置：confirmed 且当日 ∈ [checkIn, checkOut) */
function canCheckIn(status, checkIn, checkOut, today) {
    if (status !== 'confirmed')
        return false;
    return !!toDateOnly(checkIn) && !!toDateOnly(checkOut) && checkIn <= today && today < checkOut;
}
/** 日常流转判定：离店日自动完成、离店日已过仍未入住 noShow；其余 → null */
function dailyTransition(status, checkOut, today) {
    const out = toDateOnly(checkOut);
    if (!out)
        return null;
    if (status === 'checkedIn' && today >= checkOut)
        return 'completed';
    if (status === 'confirmed' && today > checkOut)
        return 'noShow';
    return null;
}
/** 订单行酒店日期段（无/不完整 → null） */
function hotelDatesOfLine(lineCf) {
    const checkIn = toDateOnly(lineCf === null || lineCf === void 0 ? void 0 : lineCf.hotelCheckIn);
    const checkOut = toDateOnly(lineCf === null || lineCf === void 0 ? void 0 : lineCf.hotelCheckOut);
    return checkIn && checkOut ? { checkIn, checkOut } : null;
}
/** 订单行成交总额（分）：促销分摊后含税行价优先，回退单价×数量 */
function bookingTotalCent(line) {
    var _a;
    if (typeof line.prunedLinePriceWithTax === 'number')
        return Math.round(line.prunedLinePriceWithTax);
    if (typeof line.linePriceWithTax === 'number') {
        return Math.round(line.linePriceWithTax * Math.max(1, (_a = line.quantity) !== null && _a !== void 0 ? _a : 1));
    }
    return 0;
}
const clampFee = (fee, paid) => Math.max(0, Math.min(Math.round(fee), Math.max(0, Math.round(paid))));
/**
 * 取消报价（design §8）：
 * - 无已结算支付（未付/仅授权）→ unpaid：不涉及退款，直接取消
 * - pendingDeposit 但已有结算款（确认事件延迟等边缘）→ 按全额退 free
 * - confirmed + freeUntil：now ≤ 截止点 → free 全额退；逾时 → partial（partial=full 扣全款，否则扣首晚），
 *   应退为 0 时落 forfeit
 * - nonRefundable → forfeit（可取消但不退）
 * - 未配置政策（null）→ blocked：顾客不可自助取消，走管理员强制取消
 */
function computeCancelQuote(input) {
    var _a, _b;
    const total = Math.max(0, Math.round(Number(input.totalCent) || 0));
    const paid = Math.max(0, Math.round(Number(input.paidCent) || 0));
    const firstNight = Math.max(0, Math.round(Number(input.firstNightFeeCent) || 0));
    const deadline = input.deadline instanceof Date && !Number.isNaN(input.deadline.getTime()) ? input.deadline : null;
    const base = { deadline };
    if (paid <= 0)
        return Object.assign(Object.assign({}, base), { mode: 'unpaid', free: false, cancellable: true, refundCent: 0, feeCent: 0 });
    if (input.status === 'pendingDeposit') {
        return Object.assign(Object.assign({}, base), { mode: 'free', free: true, cancellable: true, refundCent: paid, feeCent: 0 });
    }
    const policy = (_a = input.policy) !== null && _a !== void 0 ? _a : null;
    if (!policy) {
        return Object.assign(Object.assign({}, base), { mode: 'blocked', free: false, cancellable: false, refundCent: 0, feeCent: 0 });
    }
    if (policy.type === 'nonRefundable') {
        return Object.assign(Object.assign({}, base), { mode: 'forfeit', free: false, cancellable: true, refundCent: 0, feeCent: paid });
    }
    // freeUntil
    const now = (_b = input.now) !== null && _b !== void 0 ? _b : new Date();
    if (deadline && now.getTime() <= deadline.getTime()) {
        return Object.assign(Object.assign({}, base), { mode: 'free', free: true, cancellable: true, refundCent: paid, feeCent: 0 });
    }
    const fee = clampFee(policy.partial === 'full' ? total : firstNight, paid);
    const refund = Math.max(0, paid - fee);
    return Object.assign(Object.assign({}, base), { mode: refund > 0 ? 'partial' : 'forfeit', free: false, cancellable: true, refundCent: refund, feeCent: fee });
}
// ===== P4 Task 15：在线改期规则（纯函数，无 DB/时钟副作用，可单测） =====
/** V1 每单限改 1 次（design §8 L163） */
exports.HOTEL_MAX_RESCHEDULES_V1 = 1;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 严格日历日期校验（拒绝 2026-13-40 这类） */
function isValidDateOnly(d) {
    if (typeof d !== 'string' || !DATE_ONLY_RE.test(d))
        return false;
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime()))
        return false;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === d;
}
/** date-only 加减天；非法输入 → null */
function addDaysDateOnly(date, days) {
    if (!isValidDateOnly(date))
        return null;
    const dt = new Date(`${date}T00:00:00`);
    dt.setDate(dt.getDate() + days);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/**
 * 改期资格规则（design §8 L163）：
 * - 仅 confirmed；每单 V1 限改 1 次
 * - 新日期合法、与旧段不同、入住日不早于 today+advanceDays（advanceDays 缺省 0）
 * - 新晚数落在 [minNights, maxNights]（缺省不约束）
 */
function evaluateRescheduleRules(input) {
    if (input.status !== 'confirmed') {
        return { ok: false, reason: 'notConfirmed', message: `当前状态 ${input.status} 不可改期` };
    }
    if (Math.max(0, Math.round(Number(input.rescheduleCount) || 0)) >= exports.HOTEL_MAX_RESCHEDULES_V1) {
        return { ok: false, reason: 'limitReached', message: '该订单已使用改期机会（每单限改 1 次），请联系酒店/客服' };
    }
    if (!isValidDateOnly(input.newCheckIn) || !isValidDateOnly(input.newCheckOut)) {
        return { ok: false, reason: 'invalidDates', message: '新入离日期不合法' };
    }
    if (input.newCheckOut <= input.newCheckIn) {
        return { ok: false, reason: 'invalidDates', message: '离店日期必须晚于入住日期' };
    }
    if (input.newCheckIn === toDateOnly(input.oldCheckIn) && input.newCheckOut === toDateOnly(input.oldCheckOut)) {
        return { ok: false, reason: 'sameDates', message: '新日期与原入住日期一致，无需改期' };
    }
    const nights = Math.round((new Date(`${input.newCheckOut}T00:00:00`).getTime() - new Date(`${input.newCheckIn}T00:00:00`).getTime()) / 86400000);
    const advance = Math.max(0, Math.round(Number(input.advanceDays) || 0));
    const earliest = addDaysDateOnly(todayStr(input.now), advance);
    if (input.newCheckIn < earliest) {
        return {
            ok: false,
            reason: 'advanceDays',
            message: advance > 0 ? `最早可改期至 ${earliest}（须提前 ${advance} 天）` : `入住日不能早于今天（${earliest}）`,
        };
    }
    const min = Number(input.minNights);
    if (Number.isFinite(min) && min > 0 && nights < min) {
        return { ok: false, reason: 'tooShort', message: `最少连住 ${min} 晚` };
    }
    const max = Number(input.maxNights);
    if (Number.isFinite(max) && max > 0 && nights > max) {
        return { ok: false, reason: 'tooLong', message: `最多连住 ${max} 晚` };
    }
    return { ok: true, nights };
}
//# sourceMappingURL=booking-logic.js.map