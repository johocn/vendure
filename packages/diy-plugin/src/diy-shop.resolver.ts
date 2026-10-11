import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { DiyOrderService } from './diy-order.service';
import { DiyMaterialList, DiyPlanList, DiyShopService } from './diy-shop.service';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';

@Resolver()
export class DiyShopResolver {
    constructor(
        private service: DiyShopService,
        private orderService: DiyOrderService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async diyMaterials(
        @Ctx() ctx: RequestContext,
        @Args('filter', { nullable: true }) filter?: any,
    ): Promise<DiyMaterialList> {
        return this.service.findShopMaterials(ctx, filter ?? {});
    }

    @Query()
    @Allow(Permission.Public)
    async diyCategories(@Ctx() ctx: RequestContext): Promise<DiyCategory[]> {
        return this.service.findShopCategories(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async diyShopTemplates(@Ctx() ctx: RequestContext): Promise<DiyTemplate[]> {
        return this.service.findShopTemplates(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async diyShopTemplate(@Ctx() ctx: RequestContext, @Args('code') code: string): Promise<DiyTemplate | null> {
        return this.service.findShopTemplateByCode(ctx, code);
    }

    @Mutation()
    @Allow(Permission.Public)
    async createDiyPlan(
        @Ctx() ctx: RequestContext,
        @Args('templateCode') templateCode: string,
        @Args('spec') spec: any,
        @Args('thumb', { nullable: true }) thumb?: string | null,
    ): Promise<DiyPlan> {
        return this.service.createDiyPlan(ctx, { templateCode, spec, thumb });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myDiyPlans(
        @Ctx() ctx: RequestContext,
        @Args('status', { nullable: true }) status?: 'draft' | 'quoted' | 'ordered',
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ): Promise<DiyPlanList> {
        return this.service.myDiyPlans(ctx, { status, skip, take });
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myDiyPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan | null> {
        return this.service.myDiyPlan(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async quoteDiyPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan> {
        return this.service.quoteDiyPlan(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createOrderFromPlan(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<DiyPlan> {
        return this.orderService.createOrderFromPlan(ctx, id);
    }
}
