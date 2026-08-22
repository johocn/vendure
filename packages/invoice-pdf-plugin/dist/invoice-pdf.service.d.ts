import { AssetStorageStrategy, Order, RequestContext } from '@vendure/core';
import type { IssueInvoiceInput } from '@vendure/invoice-plugin';
export declare class InvoicePdfService {
    generatePdf(ctx: RequestContext, order: Order): Promise<Buffer>;
    generateCombinedPdf(ctx: RequestContext, input: IssueInvoiceInput & {
        invoiceNo: string;
    }, orders: Order[]): Promise<Buffer>;
    generateAndStore(ctx: RequestContext, order: Order, assetStorageStrategy: AssetStorageStrategy): Promise<string>;
}
