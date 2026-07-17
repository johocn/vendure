import { ID, RequestContext } from '@vendure/core';
import { InvoiceService } from './invoice.service';
export declare class InvoiceAdminResolver {
    private invoiceService;
    constructor(invoiceService: InvoiceService);
    invoices(ctx: RequestContext, options: any): Promise<any>;
    invoice(ctx: RequestContext, id: ID): Promise<any>;
    issueInvoice(ctx: RequestContext, id: ID): Promise<any>;
    reverseInvoice(ctx: RequestContext, id: ID, reason: string): Promise<any>;
}
