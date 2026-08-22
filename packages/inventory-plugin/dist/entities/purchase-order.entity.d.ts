import { Channel, DeepPartial, ID, StockLocation, VendureEntity } from '@vendure/core';
import { PurchaseOrderState } from '../constants';
import { Supplier } from './supplier.entity';
export declare class PurchaseOrder extends VendureEntity {
    constructor(input?: DeepPartial<PurchaseOrder>);
    code: string;
    state: PurchaseOrderState;
    supplier: Supplier;
    supplierId: ID;
    targetLocation: StockLocation;
    targetLocationId: ID;
    note: string;
    staffId: string;
    orderDate: Date;
    expectedArrivalDate: Date;
    /** 总投资额（分，按订购量×单价汇总） */
    totalAmount: number;
    lines: PurchaseOrderLine[];
    orderedAt: Date;
    completedAt: Date;
    cancelledAt: Date;
    channelId: number;
    channels: Channel[];
}
export declare class PurchaseOrderLine extends VendureEntity {
    constructor(input?: DeepPartial<PurchaseOrderLine>);
    order: PurchaseOrder;
    orderId: ID;
    productVariantId: ID;
    /** 订购量 */
    quantity: number;
    /** 累计实收 */
    receivedQuantity: number;
    /** 含税单价（分） */
    unitPrice: number | null;
    get amount(): number;
}
