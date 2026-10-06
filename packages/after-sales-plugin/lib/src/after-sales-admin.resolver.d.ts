import { RequestContext } from '@vendure/core';
import { AfterSalesService } from './after-sales.service';
export declare class AfterSalesAdminResolver {
    private afterSalesService;
    constructor(afterSalesService: AfterSalesService);
    afterSalesRequests(ctx: RequestContext, options: any): Promise<any>;
    afterSalesRequestAdmin(ctx: RequestContext, id: number): Promise<any>;
    afterSalesReturnAddress(ctx: RequestContext): Promise<string>;
    updateAfterSalesReturnAddress(ctx: RequestContext, address: string): Promise<boolean>;
    batchApproveAfterSalesRequests(ctx: RequestContext, ids: number[]): Promise<any>;
    batchRejectAfterSalesRequests(ctx: RequestContext, ids: number[], reason: string): Promise<any>;
    approveAfterSalesRequest(ctx: RequestContext, id: number): Promise<any>;
    rejectAfterSalesRequest(ctx: RequestContext, id: number, reason: string): Promise<any>;
    confirmReturnReceived(ctx: RequestContext, id: number, receivedQuantity?: number): Promise<any>;
    processAfterSalesRefund(ctx: RequestContext, id: number): Promise<any>;
    retryAfterSalesRefund(ctx: RequestContext, id: number): Promise<any>;
}
