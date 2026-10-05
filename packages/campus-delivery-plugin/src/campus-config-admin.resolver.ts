import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { ErrandService } from './errand.service';
import { CampusPermissions } from './permissions';

@Resolver()
export class CampusConfigAdminResolver {
    constructor(private config: CampusConfigService, private errand: ErrandService) {}

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

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusCreateSlot(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.config.createSlot(ctx, input);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusUpdateSlot(@Ctx() ctx: RequestContext, @Args('id') id: number, @Args('input') input: any) {
        return this.config.updateSlot(ctx, id, input);
    }

    @Query()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusSlots(@Ctx() ctx: RequestContext) {
        return this.config.listSlots(ctx);
    }

    /** R5 跑腿单：幂等创建 0 元载体商品（SKU 查重），C 端 addItemToOrder 用其 variantId */
    @Mutation()
    @Allow(CampusPermissions.CampusConfig as any)
    async campusEnsureErrandProducts(@Ctx() ctx: RequestContext) {
        const { variantId, sku } = await this.errand.ensureErrandProduct(ctx);
        return { variantId, sku };
    }
}
