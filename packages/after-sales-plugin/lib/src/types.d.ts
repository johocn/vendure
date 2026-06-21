export interface AfterSalesPluginOptions {
    /** Maximum days after delivery to allow after-sales request (default: 15) */
    maxDaysAfterDelivery?: number;
}
export type AfterSalesType = 'return_refund' | 'refund_only' | 'exchange';
export type AfterSalesState = 'Pending' | 'Approved' | 'Rejected' | 'Returning' | 'Received' | 'Refunded' | 'Closed';
export declare const STATE_TRANSITIONS: Record<AfterSalesState, AfterSalesState[]>;
