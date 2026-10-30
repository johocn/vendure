export interface AfterSalesPluginOptions {
    /** Maximum days after delivery to allow after-sales request (default: 15) */
    maxDaysAfterDelivery?: number;
    /** 售后窗口小时数（>0 时覆盖 maxDaysAfterDelivery 逻辑：从送达时间起算，如 24 = 送达后 24h；默认 0 = 沿用 maxDaysAfterDelivery） */
    afterSalesWindowHours?: number;
    /** 允许售后的订单状态（默认 Shipped/Delivered/PartiallyDelivered/Completed/Cancelled；外卖单全程 PaymentSettled，需显式放行） */
    allowedOrderStates?: string[];
    /**
     * 送达门槛（外卖/骑手场景）：当订单 customFields[field] **有值（存在配送档案）** 时，必须等于 value 才允许售后；
     * 字段为空（普通快递/自提单，无配送档案）则跳过校验。
     * 例 { field: 'deliveryStatus', value: 'delivered' }：骑手/达达单未送达（assigned/in_progress）拒售后，防双退款。
     */
    requireOrderCustomField?: { field: string; value: string };
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
    | 'Appealed'
    | 'Closed';

export const STATE_TRANSITIONS: Record<AfterSalesState, AfterSalesState[]> = {
    Pending: ['Approved', 'Rejected', 'Closed'], // +Closed：商家关闭重复/误申请
    Approved: ['Returning', 'Received', 'Closed'], // +Received：refund_only 免退货直达退款
    Rejected: ['Appealed', 'Closed'], // +Appealed：用户申诉入口
    Appealed: ['Approved', 'Closed'], // 仲裁：同意退款 / 维持拒绝
    Returning: ['Received', 'Closed'],
    Received: ['Refunded', 'RefundFailed', 'ExchangeShipped'],
    ExchangeShipped: ['Closed'], // 换货已发货 → 顾客确认收货即关闭
    RefundFailed: ['Refunded'], // 退款失败后可重试
    Refunded: ['Closed'],
    Closed: [],
};
