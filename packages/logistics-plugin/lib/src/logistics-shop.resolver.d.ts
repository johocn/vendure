import { RequestContext } from '@vendure/core';
import { LogisticsService } from './logistics.service';
export declare class LogisticsShopResolver {
    private logisticsService;
    constructor(logisticsService: LogisticsService);
    myOrderTracks(ctx: RequestContext, orderId: number): Promise<any[]>;
}
