import { ID, RequestContext } from '@vendure/core';
import { InvoiceService } from './invoice.service';
export declare class InvoiceAdminResolver {
    private invoiceService;
    constructor(invoiceService: InvoiceService);
    invoices(ctx: RequestContext, options: any): Promise<any>;
    invoice(ctx: RequestContext, id: ID): Promise<any>;
    issueInvoice(ctx: RequestContext, id: ID): Promise<any>;
    bulkIssueInvoices(ctx: RequestContext, ids: string[]): Promise<any>;
    reverseInvoice(ctx: RequestContext, id: ID, reason: string, reverseAmount?: number): Promise<any>;
    voidInvoice(ctx: RequestContext, id: ID, reason: string): Promise<any>;
    exportInvoicesCsv(ctx: RequestContext, options: any): Promise<string>;
}
