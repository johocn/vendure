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
    /** 多仓回补明细 JSON（[{ stockLocationId, quantity }]）；单仓/旧数据为 null */
    restockJson: string | null;
    returnTrackingNo: string | null;
    returnCarrier: string | null;
    rejectReason: string | null;
    /** 支付网关退款流水号（退款成功后落） */
    refundTransactionId: string | null;
    /** 实际退款到账金额（退款成功后落） */
    actualRefundAmount: number | null;
    /** 退款完成时间（Refund 达 Settled 时落） */
    refundedAt?: Date;
    /** 退款失败原因（RefundFailed 留痕，重试成功前保留） */
    refundError: string | null;
    customer: Customer;
    customerId: number;
    channels: Channel[];
}
