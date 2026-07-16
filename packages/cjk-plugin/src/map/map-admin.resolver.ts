// e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts
import { Resolver, Query, Args } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { MapService } from './map.service';

@Resolver()
export class MapAdminResolver {
    constructor(private mapService: MapService) {}

    @Query()
    async mapDistricts(
        @Ctx() ctx: RequestContext,
        @Args() args: { parentAdcode?: string | null },
    ) {
        return this.mapService.getDistricts(ctx, args?.parentAdcode ?? null);
    }

    @Query()
    async reverseGeocode(
        @Ctx() ctx: RequestContext,
        @Args() args: { lat: number; lng: number },
    ) {
        return this.mapService.reverseGeocode(ctx, args.lat, args.lng);
    }

    @Query()
    async mapSdkConfig(@Ctx() ctx: RequestContext) {
        return this.mapService.getSdkConfig(ctx);
    }

    @Query()
    async channelMapConfig(@Ctx() ctx: RequestContext) {
        return this.mapService.getChannelMapConfig(ctx);
    }
}
