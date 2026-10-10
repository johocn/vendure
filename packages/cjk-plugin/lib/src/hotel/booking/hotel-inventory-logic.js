"use strict";
// 防超订纯逻辑（无副作用，供服务与 vitest 共用）
// 口径：remaining = totalRooms(roomDay 行 ?? hotelRoomConfig.totalRooms ?? ∞) − 占用(hold未过期 + booked)；closed → 0
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelSoldOutError = exports.HOTEL_HOLD_TTL_MINUTES = void 0;
exports.enumerateNights = enumerateNights;
exports.computeRemaining = computeRemaining;
exports.countOccupied = countOccupied;
exports.findShortNights = findShortNights;
exports.HOTEL_HOLD_TTL_MINUTES = 15;
/** 防超订业务错误：调用方（OrderInterceptor）转用户文案，错误码前缀供前端识别 */
class HotelSoldOutError extends Error {
    constructor(shortNights, variantId) {
        const first = shortNights[0];
        super(`HOTEL_SOLD_OUT: ${first ? first.date : ''} 剩余 ${first ? first.remaining : 0} 间`);
        this.shortNights = shortNights;
        this.variantId = variantId;
        this.code = 'HOTEL_SOLD_OUT';
    }
}
exports.HotelSoldOutError = HotelSoldOutError;
/** 晚序列：含 checkIn，不含 checkOut；非法输入返回空数组 */
function enumerateNights(checkIn, checkOut) {
    const inD = new Date(`${checkIn}T00:00:00`);
    const outD = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(inD.getTime()) || Number.isNaN(outD.getTime()))
        return [];
    const nights = Math.round((outD.getTime() - inD.getTime()) / 86400000);
    if (nights < 1)
        return [];
    const out = [];
    for (let i = 0; i < nights; i++) {
        const d = new Date(inD.getTime() + i * 86400000);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return out;
}
/**
 * 某晚剩余房量。null = 不限房（无 roomDay 行且变体未配 totalRooms）。
 * closed 当日恒为 0（可区分「关房」与「满房」→ 前端禁选文案不同）。
 */
function computeRemaining(roomDay, configTotalRooms, occupied) {
    if (roomDay === null || roomDay === void 0 ? void 0 : roomDay.closed)
        return 0;
    const total = roomDay ? roomDay.totalRooms : configTotalRooms;
    if (total == null || !Number.isFinite(total) || total < 0)
        return null;
    return Math.max(0, Math.round(total) - occupied);
}
/** 占用统计：只算未过期 hold + booked；released / 过期 hold 不计；excludeLockIds 用于扣除「即将重置释放」的锁 */
function countOccupied(locks, date, now, excludeLockIds) {
    return locks.filter(l => l.date === date
        && (l.status === 'booked' || (l.status === 'hold' && !!l.holdExpiresAt && l.holdExpiresAt > now))
        && !(l.id != null && (excludeLockIds === null || excludeLockIds === void 0 ? void 0 : excludeLockIds.has(l.id)))).length;
}
/** 逐晚容量校验：返回不可订晚列表（含类型），空数组 = 全部可订 */
function findShortNights(nights, remainingByDate, neededExtra) {
    const bad = [];
    for (const date of nights) {
        const remaining = remainingByDate.get(date);
        if (remaining == null)
            continue; // 不限房
        if (remaining <= 0) {
            bad.push({ date, remaining, reason: 'soldOut' });
        }
        else if (remaining < neededExtra) {
            bad.push({ date, remaining, reason: 'soldOut' });
        }
    }
    return bad;
}
//# sourceMappingURL=hotel-inventory-logic.js.map