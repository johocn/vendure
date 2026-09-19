export type FulfillType = 'CLICK_COLLECT' | 'SHIP';
export declare class StockReservationItemEntity {
    id: number;
    reservationId: number;
    stockLocationId: number;
    qty: number;
    fulfillType: FulfillType;
    status: 'PENDING' | 'DONE';
}
