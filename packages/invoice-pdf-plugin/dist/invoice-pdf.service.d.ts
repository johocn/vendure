import { AssetStorageStrategy, Order, RequestContext } from '@vendure/core';
export declare class InvoicePdfService {
    generatePdf(ctx: RequestContext, order: Order): Promise<Buffer>;
    generateAndStore(ctx: RequestContext, order: Order, assetStorageStrategy: AssetStorageStrategy): Promise<string>;
}
