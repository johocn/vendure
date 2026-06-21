import { Channel, ChannelAware, Customer, DeepPartial, Order, OrderLine, VendureEntity } from '@vendure/core';
import { AfterSalesState, AfterSalesType } from './types';
export declare class AfterSalesRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AfterSalesRequest>);
    order: Order;
    orderId: number;
    orderLine: OrderLine | null;
    orderLineId: number | null;
    type: AfterSalesType;
    state: AfterSalesState;
    reason: string;
    description: string | null;
    evidenceImages: string[] | null;
    refundAmount: number;
    returnTrackingNo: string | null;
    returnCarrier: string | null;
    rejectReason: string | null;
    customer: Customer;
    customerId: number;
    channels: Channel[];
}
