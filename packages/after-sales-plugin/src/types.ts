export interface AfterSalesPluginOptions {
    /** Maximum days after delivery to allow after-sales request (default: 15) */
    maxDaysAfterDelivery?: number;
    /** Pending 超时提醒商家小时数（默认 48；渠道 customFields afterSalesTimeoutHours 优先） */
    afterSalesTimeoutHours?: number;
    /** Pending 超时自动同意小时数（0 = 关闭，默认 0；渠道 customFields afterSalesAutoApproveHours 优先） */
    afterSalesAutoApproveHours?: number;
    /** RefundFailed 自动重试次数（0 = 关闭，默认 1；渠道 customFields afterSalesRefundAutoRetry 优先） */
    afterSalesRefundAutoRetry?: number;
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
