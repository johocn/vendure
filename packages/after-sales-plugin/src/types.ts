export interface AfterSalesPluginOptions {
    /** Maximum days after delivery to allow after-sales request (default: 15) */
    maxDaysAfterDelivery?: number;
}

export type AfterSalesType = 'return_refund' | 'refund_only' | 'exchange';
export type AfterSalesState =
    | 'Pending'
    | 'Approved'
    | 'Rejected'
    | 'Returning'
    | 'Received'
    | 'ExchangeShipped'
    | 'Refunded'
    | 'RefundFailed'
    | 'Closed';

export const STATE_TRANSITIONS: Record<AfterSalesState, AfterSalesState[]> = {
    Pending: ['Approved', 'Rejected'],
    Approved: ['Returning', 'Closed'],
    Rejected: [],
    Returning: ['Received', 'Closed'],
    Received: ['Refunded', 'RefundFailed', 'ExchangeShipped'],
    ExchangeShipped: ['Closed'], // 换货已发货 → 顾客确认收货即关闭
    RefundFailed: ['Refunded'], // 退款失败后可重试
    Refunded: [],
    Closed: [],
};
