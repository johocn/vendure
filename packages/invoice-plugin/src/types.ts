import { InvoiceProvider } from './invoice-provider';

export interface InvoicePluginOptions {
    provider?: InvoiceProvider;
    enabledTypes?: ('ordinary' | 'special' | 'electronic')[];
    /** 自动开票开关（默认关）：订单进入 Delivered/Completed/PartialDelivery 时按订单抬头自动开票 */
    autoIssue?: boolean;
}
