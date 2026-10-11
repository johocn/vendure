import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext, Transaction } from '@vendure/core';

import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyPlan } from './entities/diy-plan.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCreate, DiyDelete, DiyRead, DiyUpdate } from './permissions';
import { DiyService } from './diy.service';

@Resolver()
export class DiyAdminResolver {
    constructor(private service: DiyService) {}

    /* ------------------------------ 分类 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyCategories(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
    ): Promise<DiyCategory[]> {
        return this.service.findCategories(ctx, app === undefined ? undefined : app ?? null);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyCategory(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyCategory | null> {
        return this.service.findOneCategory(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyCategory(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyCategory> {
        return this.service.createCategory(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyCategory(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyCategory> {
        return this.service.updateCategory(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyCategory(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteCategory(ctx, id);
    }

    /* ------------------------------ 素材 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyMaterials(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
        @Args('skip', { nullable: true }) skip?: number,
        @Args('take', { nullable: true }) take?: number,
    ): Promise<DiyMaterial[]> {
        return this.service.findMaterials(ctx, app === undefined ? undefined : app ?? null, skip ?? 0, take ?? 100);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyMaterial | null> {
        return this.service.findOneMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyMaterial(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyMaterial> {
        return this.service.createMaterial(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyMaterial(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyMaterial> {
        return this.service.updateMaterial(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async copyDiyMaterial(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyMaterial> {
        return this.service.copyMaterial(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async diyMaterialsImport(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<number> {
        return this.service.importMaterials(ctx, input);
    }

    /* ------------------------------ 模板 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyTemplates(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string | null,
    ): Promise<DiyTemplate[]> {
        return this.service.findTemplates(ctx, app === undefined ? undefined : app ?? null);
    }

    @Query()
    @Allow(DiyRead.Permission)
    async diyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate | null> {
        return this.service.findOneTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async createDiyTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyTemplate> {
        return this.service.createTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async updateDiyTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<DiyTemplate> {
        return this.service.updateTemplate(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyDelete.Permission)
    async deleteDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.deleteTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyUpdate.Permission)
    async publishDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate> {
        return this.service.publishTemplate(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(DiyCreate.Permission)
    async copyDiyTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<DiyTemplate> {
        return this.service.copyTemplate(ctx, id);
    }

    /* ------------------------------ 方案 ------------------------------ */

    @Query()
    @Allow(DiyRead.Permission)
    async diyPlans(
        @Ctx() ctx: RequestContext,
        @Args('app', { nullable: true }) app?: string,
        @Args('status', { nullable: true }) status?: string,
        @Args('skip', { nullable: true, defaultValue: 0 }) skip?: number,
        @Args('take', { nullable: true, defaultValue: 50 }) take?: number,
    ): Promise<{ items: DiyPlan[]; total: number }> {
        return this.service.findPlans(ctx, { app, status, skip, take });
    }
}
