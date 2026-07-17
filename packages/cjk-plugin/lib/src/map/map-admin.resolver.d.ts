import { RequestContext } from '@vendure/core';
import { MapService } from './map.service';
export declare class MapAdminResolver {
    private mapService;
    constructor(mapService: MapService);
    private assertChannelAccess;
    mapDistricts(ctx: RequestContext, args: {
        parentAdcode?: string | null;
    }): Promise<import("./map-provider").DistrictNode[]>;
    reverseGeocode(ctx: RequestContext, args: {
        lat: number;
        lng: number;
    }): Promise<import("./map-provider").ReverseGeocodeResult>;
    mapSdkConfig(ctx: RequestContext): Promise<{
        provider: string;
        sdkUrl: string;
        hasConfigured: boolean;
    }>;
    channelMapConfig(ctx: RequestContext, args: {
        channelId: string;
    }): Promise<{
        provider: string;
        apiKey: string;
        hasConfigured: boolean;
    }>;
}
