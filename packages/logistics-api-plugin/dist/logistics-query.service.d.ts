import { ChannelService, RequestContext } from '@vendure/core';
import { CarrierDetectResult, TrackingResult } from './types';
export declare class LogisticsQueryService {
    private channelService;
    private cache;
    constructor(channelService: ChannelService);
    queryTracking(ctx: RequestContext, carrierCode: string, trackingNumber: string): Promise<TrackingResult>;
    detectCarrier(ctx: RequestContext, trackingNumber: string): Promise<CarrierDetectResult[]>;
    private getApiConfig;
    private getFromCache;
    private setToCache;
}
