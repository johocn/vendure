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
}
