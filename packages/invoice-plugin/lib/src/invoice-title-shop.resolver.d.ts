import { ID, RequestContext } from '@vendure/core';
import { InvoiceTitleService } from './invoice-title.service';
export declare class InvoiceTitleShopResolver {
    private titleService;
    constructor(titleService: InvoiceTitleService);
    myInvoiceTitles(ctx: RequestContext): Promise<any>;
    createInvoiceTitle(ctx: RequestContext, input: any): Promise<any>;
    updateInvoiceTitle(ctx: RequestContext, id: ID, input: any): Promise<any>;
    setDefaultInvoiceTitle(ctx: RequestContext, id: ID): Promise<any>;
    deleteInvoiceTitle(ctx: RequestContext, id: ID): Promise<boolean>;
}
