import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';
import { StockInState } from '../constants';
export declare class StockInOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockInOrder>);
    code: string;
    state: StockInState;
    type: string;
    note: string;
    staffId: string;
    targetLocation: StockLocation;
    targetLocationId: ID;
    lines: StockInOrderLine[];
    completedAt?: Date;
    cancelledAt?: Date;
    channels: Channel[];
}
export declare class StockInOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockInOrderLine>);
    order: StockInOrder;
    orderId: ID;
    productVariantId: ID;
    quantity: number;
    unitPrice: number | null;
}
