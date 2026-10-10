import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { HotelRoomDay } from './room-day.entity';
import { HotelSoldOutError } from './hotel-inventory-logic';
export { HotelSoldOutError };
export declare class HotelInventoryService {
    private conn;
    constructor(conn: TransactionalConnection);
    private roomDayRepo;
    private lockRepo;
    /** 变体缺省总房量（hotelRoomConfig.totalRooms）；坏配置/未配置 → null（不限房） */
    getVariantTotalRooms(ctx: RequestContext, variantId: ID): Promise<number | null>;
    /** 逐晚剩余房量（from..to 含 checkIn 不含 checkOut 段内每一晚） */
    getAvailability(ctx: RequestContext, variantId: ID, from: string, to: string): Promise<Array<{
        date: string;
        remaining: number | null;
        closed: boolean;
    }>>;
    /**
     * 逐晚房态 + 当晚报价（date/priceCent/dayType/remaining/closed）。
     * shop hotelAvailability / admin 房量日历共用；窗口语义由调用方决定（含两端时传 to+1）。
     */
    getAvailabilityDetailed(ctx: RequestContext, variantId: ID, from: string, to: string): Promise<Array<{
        date: string;
        priceCent: number;
        dayType: string;
        remaining: number | null;
        closed: boolean;
    }>>;
    /**
     * 锁房（校验 + 落锁，一体完成，须在调用方事务内）：
     * - 对段内「有限房量」的 HotelRoomDay 行悲观加锁（无行时先 upsert 缺省行以获得锁锚点）
     * - 释放「本次会重置」的 hold：orderLineId 为 null 的孤儿 + toReleaseLineIds 指定行的（幂等自愈，
     *   同房型多行重叠段时互不影响——只重置属于本次操作的锁）
     * - 逐晚校验 remaining ≥ 新增间数（统计扣除待释放集），任一晚不足抛 HotelSoldOutError
     * - 落 hold（每间每晚一行，TTL 15min）；不限房晚不落锁
     */
    holdForOrder(ctx: RequestContext, orderId: ID, variantId: ID, checkIn: string, checkOut: string, quantity: number, options?: {
        orderLineId?: ID | null;
        toReleaseLineIds?: ID[];
    }): Promise<void>;
    /** hold → booked（确认）：可选回填 orderLineId / bookingId；已 booked 的行跳过 */
    confirmLocks(ctx: RequestContext, orderId: ID, variantId: ID, options?: {
        orderLineId?: ID;
        bookingId?: ID;
    }): Promise<void>;
    /** 任意状态 → released（取消/退款/移除行）；released 幂等 */
    releaseLocks(ctx: RequestContext, orderId: ID, variantId?: ID): Promise<number>;
    /** 按订单行释放（移除订单行） */
    releaseLocksByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<number>;
    /**
     * 释放（订单 × 房型 × 日期段内）orderLineId 为 null 的 hold 孤儿。
     * willAdd 落锁时行尚未创建只能落 null；移除行时按行上日期段回溯释放。
     * 同 variant + 同 customFields 的加购 core 会合并为一行，故段不重叠互不误伤。
     */
    releaseOrphanHolds(ctx: RequestContext, orderId: ID, variantId: ID, checkIn: string, checkOut: string): Promise<number>;
    /** 定时清理：过期 hold → released（清理统计面；released 行保留审计） */
    expireStaleHolds(ctx: RequestContext, now?: Date): Promise<number>;
    /** 行创建后回填 orderLineId（按订单+房型，补齐审计链） */
    attachOrderLineId(ctx: RequestContext, orderId: ID, variantId: ID, orderLineId: ID): Promise<void>;
    /** 某月已建房量行（month = YYYY-MM） */
    listRoomDays(ctx: RequestContext, variantId: ID, month: string): Promise<HotelRoomDay[]>;
    /** upsert 单日房量（totalRooms/closed 可选，只更新传入字段；无行则建） */
    upsertRoomDay(ctx: RequestContext, variantId: ID, date: string, patch: {
        totalRooms?: number | null;
        closed?: boolean;
    }): Promise<HotelRoomDay>;
    /**
     * 批量 upsert [from, to] 含两端（weekdays 可选 0-6 过滤，0=周日）。
     * 返回写入行数；任一日期非法即整体失败（调用方事务内）。
     */
    batchUpsertRoomDays(ctx: RequestContext, variantId: ID, from: string, to: string, patch: {
        totalRooms?: number | null;
        closed?: boolean;
        weekdays?: number[];
    }): Promise<number>;
}
