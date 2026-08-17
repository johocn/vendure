import { RequestContext } from '@vendure/core';
import { MapService } from './map.service';
import { DistrictNode, ReverseGeocodeResult } from './map-provider';
export declare class MapShopResolver {
    private mapService;
    constructor(mapService: MapService);
    mapDistricts(ctx: RequestContext, parentAdcode?: string): Promise<DistrictNode[]>;
    reverseGeocode(ctx: RequestContext, lat: number, lng: number): Promise<ReverseGeocodeResult>;
    mapSdkConfig(ctx: RequestContext): Promise<{
        provider: string;
        sdkUrl: string;
        hasConfigured: boolean;
    }>;
}
