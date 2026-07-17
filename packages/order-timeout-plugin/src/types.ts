export interface OrderTimeoutPluginOptions {
    defaultPaymentTimeoutMinutes?: number;
    defaultFulfillmentTimeoutHours?: number;
    defaultReceiptTimeoutDays?: number;
    defaultReviewReminderDays?: number;
}
