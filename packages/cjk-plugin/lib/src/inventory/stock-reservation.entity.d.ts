export type ReservationStatus = 'PENDING_ALLOC' | 'ALLOCATED' | 'DONE' | 'RELEASED';
export declare class StockReservationEntity {
    id: number;
    orderId: number;
    orderLineId: number;
    variantId: number;
    totalQty: number;
    status: ReservationStatus;
    tenantChannelId: string;
    createdAt: Date;
    /**
     * 预留单到期时间 = 创建时间 + channel customFields.reservationTtlMinutes（默认 30 分钟）。
     * 仅 PENDING_ALLOC 会用到：超时未完成备货拆分 → worker 的 release-expired-reservations 释放。
     * 历史数据为 NULL = 永不过期（不回溯释放旧单）。
     */
    expiresAt: Date | null;
}
