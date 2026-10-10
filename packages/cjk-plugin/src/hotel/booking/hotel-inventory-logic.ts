// 防超订纯逻辑（无副作用，供服务与 vitest 共用）
// 口径：remaining = totalRooms(roomDay 行 ?? hotelRoomConfig.totalRooms ?? ∞) − 占用(hold未过期 + booked)；closed → 0

export interface RoomDayLike {
    date: string;
    totalRooms: number;
    closed: boolean;
}

export interface LockLike {
    date: string;
    status: 'hold' | 'booked' | 'released';
    holdExpiresAt: Date | null;
    orderId?: number;
}

export const HOTEL_HOLD_TTL_MINUTES = 15;

/** 防超订业务错误：调用方（OrderInterceptor）转用户文案，错误码前缀供前端识别 */
export class HotelSoldOutError extends Error {
    readonly code = 'HOTEL_SOLD_OUT';
    constructor(
        readonly shortNights: Array<{ date: string; remaining: number | null; reason: 'closed' | 'soldOut' }>,
        readonly variantId: number,
    ) {
        const first = shortNights[0];
        super(`HOTEL_SOLD_OUT: ${first ? first.date : ''} 剩余 ${first ? first.remaining : 0} 间`);
    }
}

/** 晚序列：含 checkIn，不含 checkOut；非法输入返回空数组 */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
    const inD = new Date(`${checkIn}T00:00:00`);
    const outD = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(inD.getTime()) || Number.isNaN(outD.getTime())) return [];
    const nights = Math.round((outD.getTime() - inD.getTime()) / 86400000);
    if (nights < 1) return [];
    const out: string[] = [];
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
export function computeRemaining(
    roomDay: RoomDayLike | null | undefined,
    configTotalRooms: number | null,
    occupied: number,
): number | null {
    if (roomDay?.closed) return 0;
    const total = roomDay ? roomDay.totalRooms : configTotalRooms;
    if (total == null || !Number.isFinite(total) || total < 0) return null;
    return Math.max(0, Math.round(total) - occupied);
}

/** 占用统计：只算未过期 hold + booked；released / 过期 hold 不计 */
export function countOccupied(locks: LockLike[], date: string, now: Date, excludeOrderId?: number): number {
    return locks.filter(l =>
        l.date === date
        && (l.status === 'booked' || (l.status === 'hold' && !!l.holdExpiresAt && l.holdExpiresAt > now))
        && (excludeOrderId == null || l.orderId !== excludeOrderId)
    ).length;
}

/** 逐晚容量校验：返回不可订晚列表（含类型），空数组 = 全部可订 */
export function findShortNights(
    nights: string[],
    remainingByDate: Map<string, number | null>,
    neededExtra: number,
): Array<{ date: string; remaining: number | null; reason: 'closed' | 'soldOut' }> {
    const bad: Array<{ date: string; remaining: number | null; reason: 'closed' | 'soldOut' }> = [];
    for (const date of nights) {
        const remaining = remainingByDate.get(date);
        if (remaining == null) continue; // 不限房
        if (remaining <= 0) {
            bad.push({ date, remaining, reason: 'soldOut' });
        } else if (remaining < neededExtra) {
            bad.push({ date, remaining, reason: 'soldOut' });
        }
    }
    return bad;
}
