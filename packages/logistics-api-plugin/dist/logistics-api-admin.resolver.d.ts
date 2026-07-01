import { RequestContext } from '@vendure/core';
import { LogisticsQueryService } from './logistics-query.service';
export declare class LogisticsApiAdminResolver {
    private logisticsQueryService;
    constructor(logisticsQueryService: LogisticsQueryService);
    logisticsTracking(ctx: RequestContext, carrierCode: string, trackingNumber: string): Promise<import("./types").TrackingResult>;
    detectCarrier(ctx: RequestContext, trackingNumber: string): Promise<import("./types").CarrierDetectResult[]>;
}
