import { OrderService, RequestContext } from '@vendure/core';
import { InvoicePdfService } from './invoice-pdf.service';
export declare class InvoicePdfAdminResolver {
    private invoicePdfService;
    private orderService;
    constructor(invoicePdfService: InvoicePdfService, orderService: OrderService);
    generateInvoicePdf(ctx: RequestContext, orderId: string): Promise<{
        url: string;
        invoiceNumber: any;
    }>;
}
