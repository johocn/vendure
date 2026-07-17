import { RequestContext } from '@vendure/core';
import { LogisticsService } from './logistics.service';
export declare class LogisticsAdminResolver {
    private logisticsService;
    constructor(logisticsService: LogisticsService);
    logisticsTracks(ctx: RequestContext, orderId: number): Promise<any>;
    logisticsTrack(ctx: RequestContext, id: number): Promise<any>;
    carriers(): Promise<any[]>;
    batchCreateFulfillment(ctx: RequestContext, items: any[]): Promise<any>;
    refreshTrack(ctx: RequestContext, id: number): Promise<any>;
    private toGraphQl;
}
