// e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts
import { Resolver, Query, Args } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext, Permission } from '@vendure/core';
import { MapService } from './map.service';

@Resolver()
export class MapAdminResolver {
    constructor(private mapService: MapService) {}

    private assertChannelAccess(ctx: RequestContext, channelId: string) {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) return;
        const channelPermissions = (ctx as any).session?.user?.channelPermissions || [];
        const allowed = channelPermissions.some((c: any) => String(c.id) === String(channelId));
        if (!allowed) throw new Error('TENANT_CONFIG_FORBIDDEN');
    }

    @Query()
    @Allow(Permission.Authenticated)
    async mapDistricts(@Ctx() ctx: RequestContext, @Args() args: { parentAdcode?: string | null }) {
        return this.mapService.getDistricts(ctx, args?.parentAdcode ?? null);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async reverseGeocode(@Ctx() ctx: RequestContext, @Args() args: { lat: number; lng: number }) {
        return this.mapService.reverseGeocode(ctx, args.lat, args.lng);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async mapSdkConfig(@Ctx() ctx: RequestContext) {
        // 返回解密后的明文(供 dashboard 加载地图 SDK),不掩码。MapService 内部已 decrypt。
        return this.mapService.getSdkConfig(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async channelMapConfig(@Ctx() ctx: RequestContext, @Args() args: { channelId: string }) {
        this.assertChannelAccess(ctx, args.channelId);
        // MapService.getChannelMapConfig 返回 { provider, apiKey(masked), hasConfigured },与 GraphQL schema 兼容
        return this.mapService.getChannelMapConfig(ctx, args.channelId);
    }
}
