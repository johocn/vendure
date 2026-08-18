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
    /** 实收数量（部分退货按实收回补；null 表示全额按订单行数量回补） */
    receivedQuantity: number | null;
    returnTrackingNo: string | null;
    returnCarrier: string | null;
    rejectReason: string | null;
    customer: Customer;
    customerId: number;
    channels: Channel[];
}
