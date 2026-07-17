import { ID, RequestContext } from '@vendure/core';
import { InvoiceService } from './invoice.service';
export declare class InvoiceShopResolver {
    private invoiceService;
    constructor(invoiceService: InvoiceService);
    myInvoices(ctx: RequestContext): Promise<any>;
    myInvoice(ctx: RequestContext, id: ID): Promise<any>;
    createInvoice(ctx: RequestContext, input: any): Promise<any>;
    downloadInvoicePdf(ctx: RequestContext, id: ID): Promise<any>;
}
