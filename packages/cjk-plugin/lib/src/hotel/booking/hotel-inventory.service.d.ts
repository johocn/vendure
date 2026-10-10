import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
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
     * 锁房（校验 + 落锁，一体完成）：
     * - 对段内「有限房量」的 HotelRoomDay 行悲观加锁（无行时先 upsert 缺省行以获得锁锚点）
     * - 先释放本订单该房型的既有 hold（幂等自愈：加购/改行/重复调用收敛到最终状态）
     * - 逐晚校验 remaining ≥ 新增间数，任一晚不足抛 HotelSoldOutError（调用方回滚整体）
     * - 落 hold（每间每晚一行，TTL 15min）；不限房晚不落锁
     */
    holdForOrder(ctx: RequestContext, orderId: ID, variantId: ID, checkIn: string, checkOut: string, quantity: number, options?: {
        orderLineId?: ID;
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
    /** 定时清理：过期 hold → released（清理统计面；released 行保留审计） */
    expireStaleHolds(ctx: RequestContext, now?: Date): Promise<number>;
    /** 行创建后回填 orderLineId（按订单+房型，补齐审计链） */
    attachOrderLineId(ctx: RequestContext, orderId: ID, variantId: ID, orderLineId: ID): Promise<void>;
}
