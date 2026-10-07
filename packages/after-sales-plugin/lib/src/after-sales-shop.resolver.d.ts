import { RequestContext } from '@vendure/core';
import { AfterSalesService } from './after-sales.service';
export declare class AfterSalesShopResolver {
    private afterSalesService;
    constructor(afterSalesService: AfterSalesService);
    myAfterSalesRequests(ctx: RequestContext, options: any): Promise<any>;
    afterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    afterSalesReturnAddress(ctx: RequestContext): Promise<string>;
    createAfterSalesRequest(ctx: RequestContext, input: any): Promise<any>;
    cancelAfterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    updateReturnTracking(ctx: RequestContext, id: number, trackingNo: string, carrier: string): Promise<any>;
    uploadAfterSalesEvidence(ctx: RequestContext, images: string[]): Promise<string[]>;
    afterSalesMessages(ctx: RequestContext, id: number, options: any): Promise<any>;
    addAfterSalesMessage(ctx: RequestContext, id: number, content: string, images?: string[]): Promise<any>;
    exchangeReceiveAfterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
}
