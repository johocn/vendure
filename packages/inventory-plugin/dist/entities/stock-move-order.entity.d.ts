import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';
import { StockMoveState } from '../constants';
export declare class StockMoveOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockMoveOrder>);
    code: string;
    state: StockMoveState;
    note: string;
    staffId: string;
    sourceLocation: StockLocation;
    sourceLocationId: ID;
    targetLocation: StockLocation;
    targetLocationId: ID;
    lines: StockMoveOrderLine[];
    shippedAt?: Date;
    receivedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    channels: Channel[];
}
export declare class StockMoveOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockMoveOrderLine>);
    order: StockMoveOrder;
    orderId: ID;
    productVariantId: ID;
    quantity: number;
}
