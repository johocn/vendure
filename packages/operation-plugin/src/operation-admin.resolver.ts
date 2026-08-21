import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { OperationService } from './operation.service';

@Resolver()
export class OperationAdminResolver {
    constructor(private operationService: OperationService) {}

    @Query()
    @Allow(Permission.UpdateSettings)
    async operationSections(@Ctx() ctx: RequestContext): Promise<any[]> {
        return this.operationService.listSections(ctx);
    }

    @Query()
    @Allow(Permission.UpdateSettings)
    async operationSection(@Ctx() ctx: RequestContext, @Args('code') code: string): Promise<any> {
        return this.operationService.getByCode(ctx, code);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async createOperationSection(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.operationService.createSection(ctx, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async updateOperationSection(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('input') input: any,
    ): Promise<any> {
        return this.operationService.updateSection(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async deleteOperationSection(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.operationService.deleteSection(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateSettings)
    async setOperationItems(
        @Ctx() ctx: RequestContext,
        @Args('sectionId') sectionId: ID,
        @Args('items') items: any[],
    ): Promise<any[]> {
        return this.operationService.setOperationItems(ctx, sectionId, items);
    }
}