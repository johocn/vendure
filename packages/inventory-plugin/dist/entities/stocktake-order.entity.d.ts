import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';
import { StocktakeState } from '../constants';
export declare class StocktakeOrder extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeOrder>);
    code: string;
    state: StocktakeState;
    note: string;
    staffId: string;
    location: StockLocation;
    locationId: ID;
    lines: StocktakeOrderLine[];
    countingStartedAt?: Date;
    reconcilingStartedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    channels: Channel[];
}
export declare class StocktakeOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeOrderLine>);
    order: StocktakeOrder;
    orderId: ID;
    productVariantId: ID;
    systemQuantity: number;
    countedQuantity: number;
    difference: number;
    reconciled: boolean;
}
