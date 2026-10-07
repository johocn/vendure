export interface AfterSalesPluginOptions {
    /** Maximum days after delivery to allow after-sales request (default: 15) */
    maxDaysAfterDelivery?: number;
    /** 售后窗口小时数（>0 时覆盖 maxDaysAfterDelivery 逻辑：从送达时间起算，如 24 = 送达后 24h；默认 0 = 沿用 maxDaysAfterDelivery） */
    afterSalesWindowHours?: number;
    /** 允许售后的订单状态（默认 Shipped/Delivered/PartiallyDelivered/Completed/Cancelled；外卖单全程 PaymentSettled，需显式放行） */
    allowedOrderStates?: string[];
    /** 要求订单 customFields[field] === value 才允许售后（外卖场景 { field: 'deliveryStatus', value: 'delivered' }；不设置则仅按订单状态校验） */
    requireOrderCustomField?: {
        field: string;
        value: string;
    };
    /** Pending 超时提醒商家小时数（默认 48；渠道 customFields afterSalesTimeoutHours 优先） */
    afterSalesTimeoutHours?: number;
    /** Pending 超时自动同意小时数（0 = 关闭，默认 0；渠道 customFields afterSalesAutoApproveHours 优先） */
    afterSalesAutoApproveHours?: number;
    /** RefundFailed 自动重试次数（0 = 关闭，默认 1；渠道 customFields afterSalesRefundAutoRetry 优先） */
    afterSalesRefundAutoRetry?: number;
}
export type AfterSalesType = 'return_refund' | 'refund_only' | 'exchange';
export type AfterSalesState = 'Pending' | 'Approved' | 'Rejected' | 'Returning' | 'Received' | 'ExchangeShipped' | 'Refunded' | 'RefundFailed' | 'Appealed' | 'Closed';
export declare const STATE_TRANSITIONS: Record<AfterSalesState, AfterSalesState[]>;
