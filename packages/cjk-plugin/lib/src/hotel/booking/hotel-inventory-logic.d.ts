export interface RoomDayLike {
    date: string;
    totalRooms: number;
    closed: boolean;
}
export interface LockLike {
    date: string;
    status: 'hold' | 'booked' | 'released';
    holdExpiresAt?: Date | null;
    id?: number | string;
}
export declare const HOTEL_HOLD_TTL_MINUTES = 15;
/** 防超订业务错误：调用方（OrderInterceptor）转用户文案，错误码前缀供前端识别 */
export declare class HotelSoldOutError extends Error {
    readonly shortNights: Array<{
        date: string;
        remaining: number | null;
        reason: 'closed' | 'soldOut';
    }>;
    readonly variantId: number;
    readonly code = "HOTEL_SOLD_OUT";
    constructor(shortNights: Array<{
        date: string;
        remaining: number | null;
        reason: 'closed' | 'soldOut';
    }>, variantId: number);
}
/** 晚序列：含 checkIn，不含 checkOut；非法输入返回空数组 */
export declare function enumerateNights(checkIn: string, checkOut: string): string[];
/**
 * 某晚剩余房量。null = 不限房（无 roomDay 行且变体未配 totalRooms）。
 * closed 当日恒为 0（可区分「关房」与「满房」→ 前端禁选文案不同）。
 */
export declare function computeRemaining(roomDay: RoomDayLike | null | undefined, configTotalRooms: number | null, occupied: number): number | null;
/** 占用统计：只算未过期 hold + booked；released / 过期 hold 不计；excludeLockIds 用于扣除「即将重置释放」的锁 */
export declare function countOccupied(locks: LockLike[], date: string, now: Date, excludeLockIds?: Set<number | string>): number;
/** 逐晚容量校验：返回不可订晚列表（含类型），空数组 = 全部可订 */
export declare function findShortNights(nights: string[], remainingByDate: Map<string, number | null>, neededExtra: number): Array<{
    date: string;
    remaining: number | null;
    reason: 'closed' | 'soldOut';
}>;
/** date-only 加一天（YYYY-MM-DD → YYYY-MM-DD），用于「含尾日」窗口枚举 */
export declare function nextDate(date: string): string;
