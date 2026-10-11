import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { DiyMaterialList, DiyShopService } from './diy-shop.service';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';

@Resolver()
export class DiyShopResolver {
    constructor(private service: DiyShopService) {}

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
    async diyShopTemplates(@Ctx() ctx: RequestContext): Promise<DiyTemplate[]> {
        return this.service.findShopTemplates(ctx);
    }

    @Query()
    @Allow(Permission.Public)
    async diyShopTemplate(@Ctx() ctx: RequestContext, @Args('code') code: string): Promise<DiyTemplate | null> {
        return this.service.findShopTemplateByCode(ctx, code);
    }
}
