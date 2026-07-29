import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';
import { StockOutState } from '../constants';
export declare class StockOutOrder extends VendureEntity {
    constructor(input?: DeepPartial<StockOutOrder>);
    code: string;
    state: StockOutState;
    type: string;
    note: string;
    staffId: string;
    sourceLocation: StockLocation;
    sourceLocationId: ID;
    lines: StockOutOrderLine[];
    completedAt?: Date;
    cancelledAt?: Date;
    channels: Channel[];
}
export declare class StockOutOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StockOutOrderLine>);
    order: StockOutOrder;
    orderId: ID;
    productVariantId: ID;
    quantity: number;
    unitPrice: number | null;
}
