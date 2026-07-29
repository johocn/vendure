import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { MapService } from './map.service';
import { DistrictNode, ReverseGeocodeResult } from './map-provider';

@Resolver()
export class MapShopResolver {
    constructor(private mapService: MapService) {}

    @Query()
    @Allow(Permission.Public)
    async mapDistricts(
        @Ctx() ctx: RequestContext,
        @Args('parentAdcode') parentAdcode?: string,
    ): Promise<DistrictNode[]> {
        return this.mapService.getDistricts(ctx, parentAdcode ?? null);
    }

    @Query()
    @Allow(Permission.Public)
    async reverseGeocode(
        @Ctx() ctx: RequestContext,
        @Args('lat') lat: number,
        @Args('lng') lng: number,
    ): Promise<ReverseGeocodeResult> {
        return this.mapService.reverseGeocode(ctx, lat, lng);
    }
}
