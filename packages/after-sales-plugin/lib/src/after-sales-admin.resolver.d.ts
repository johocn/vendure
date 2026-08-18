import { RequestContext } from '@vendure/core';
import { AfterSalesService } from './after-sales.service';
export declare class AfterSalesAdminResolver {
    private afterSalesService;
    constructor(afterSalesService: AfterSalesService);
    afterSalesRequests(ctx: RequestContext, options: any): Promise<any>;
    approveAfterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    rejectAfterSalesRequest(ctx: RequestContext, id: number, reason: string): Promise<any>;
    confirmReturnReceived(ctx: RequestContext, id: number, receivedQuantity?: number): Promise<any>;
    processAfterSalesRefund(ctx: RequestContext, id: number): Promise<any>;
}
