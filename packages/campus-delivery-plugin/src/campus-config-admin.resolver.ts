import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class CampusConfigAdminResolver {
    constructor(private config: CampusConfigService) {}

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusZones(@Ctx() ctx: RequestContext) {
        return this.config.listZones(ctx);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusBuildings(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'zoneId', nullable: true }) zoneId?: ID,
    ) {
        return this.config.listBuildings(zoneId != null ? Number(zoneId) : undefined);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusConfig(@Ctx() ctx: RequestContext) {
        return this.config.getConfig(ctx);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateZone(
        @Ctx() ctx: RequestContext,
        @Args('name') name: string,
        @Args('fee') fee: number,
    ) {
        return this.config.createZone(ctx, name, fee);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateBuilding(
        @Ctx() ctx: RequestContext,
        @Args('name') name: string,
        @Args('zoneId') zoneId: ID,
        @Args('detail', { nullable: true }) detail?: string,
    ) {
        return this.config.createBuilding(ctx, name, Number(zoneId), detail);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateConfig(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.config.updateConfig(ctx, input);
    }
}
