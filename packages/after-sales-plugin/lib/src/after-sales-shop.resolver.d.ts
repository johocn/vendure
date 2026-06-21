import { RequestContext } from '@vendure/core';
import { AfterSalesService } from './after-sales.service';
export declare class AfterSalesShopResolver {
    private afterSalesService;
    constructor(afterSalesService: AfterSalesService);
    myAfterSalesRequests(ctx: RequestContext, options: any): Promise<any>;
    afterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    createAfterSalesRequest(ctx: RequestContext, input: any): Promise<any>;
    cancelAfterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    updateReturnTracking(ctx: RequestContext, id: number, trackingNo: string, carrier: string): Promise<any>;
}
